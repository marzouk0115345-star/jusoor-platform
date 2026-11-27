import { Router } from 'express';
import { z } from 'zod';
import {
  eq,
  and,
  desc,
  asc,
  ne,
  gte,
  lte,
  or,
  ilike,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  teachingSessions,
  sessionEnrollments,
  teacherAvailability,
  users,
  providerProfiles,
  studentProfiles,
  educationalStages,
  educationalGrades,
  educationalSystems,
  secondaryDivisions,
  baccalaureatePathways,
  curriculumSubjects,
  subjects,
  fields,
  notifications,
} from '../../db/schema.ts';
import {
  requireAuth,
  optionalAuth,
  requireRole,
  type AuthRequest,
} from '../auth.ts';
import {
  calculateDurationMinutes,
  computeSessionAvailability,
  computeIndividualSlotStatus,
  doTimeRangesOverlap,
  validateSessionSchedule,
  canCancelSessionEnrollment,
  canEditTeachingSession,
  normalizeDeliveryMode,
  isOfflineDeliveryMode,
  formatOfflineAddress,
  type SessionType,
  type SessionStatus,
  type SessionEnrollmentStatus,
  type DeliveryMode,
} from '../../lib/domain.ts';

const router = Router();

const createSessionSchema = z.object({
  sessionType: z.enum(['ONE_TO_ONE', 'GROUP']),
  title: z.string().trim().min(3, 'عنوان الجلسة مطلوب (3 أحرف على الأقل)').max(180),
  description: z.string().trim().max(2000).optional().nullable(),
  subjectId: z.number().int().positive().optional().nullable(),
  curriculumSubjectId: z.number().int().positive().optional().nullable(),
  systemId: z.number().int().positive().optional().nullable(),
  gradeId: z.number().int().positive().optional().nullable(),
  stageId: z.number().int().positive().optional().nullable(),
  divisionId: z.number().int().positive().optional().nullable(),
  pathwayId: z.number().int().positive().optional().nullable(),
  startTime: z.string().min(1, 'وقت البداية مطلوب'),
  endTime: z.string().min(1, 'وقت النهاية مطلوب'),
  capacity: z.number().int().min(1).max(500).optional(),
  minStudents: z.number().int().min(1).max(500).optional().nullable(),
  price: z.number().min(0).max(50000).default(0),
  currency: z.string().trim().min(3).max(6).default('EGP'),
  deliveryMode: z.enum(['ONLINE', 'IN_PERSON', 'OFFLINE']).default('ONLINE'),
  location: z.string().trim().max(400).optional().nullable(),
  governorate: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  district: z.string().trim().max(120).optional().nullable(),
  streetName: z.string().trim().max(160).optional().nullable(),
  buildingOrCenterName: z.string().trim().max(180).optional().nullable(),
  locationNotes: z.string().trim().max(300).optional().nullable(),
  isDemoLocation: z.boolean().optional(),
  meetingUrl: z.string().trim().max(500).optional().nullable(),
  registrationDeadline: z.string().optional().nullable(),
});

const updateSessionSchema = createSessionSchema.partial();

const availabilityScheduleSchema = z.object({
  slots: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت HH:mm مطلوبة'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت HH:mm مطلوبة'),
        isActive: z.boolean().default(true),
      })
    )
    .max(50),
});

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function lockSessionRow(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: number
) {
  const locked = await tx.execute(
    sql`SELECT id, teacher_user_id, session_type, title, start_time, end_time, capacity, registration_deadline, status FROM teaching_sessions WHERE id = ${sessionId} FOR UPDATE`
  );
  const row = locked.rows[0] as
    | {
        id: number;
        teacher_user_id: number;
        session_type: SessionType;
        title: string;
        start_time: Date | string;
        end_time: Date | string;
        capacity: number;
        registration_deadline: Date | string | null;
        status: SessionStatus;
      }
    | undefined;
  return row || null;
}

async function enrichSessionsForViewer(
  sessionRows: Array<typeof teachingSessions.$inferSelect>,
  viewer: AuthRequest['authUser'] | undefined
) {
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const teacherIds = Array.from(new Set(sessionRows.map((s) => s.teacherUserId)));
  const subjectIds = Array.from(
    new Set(sessionRows.map((s) => s.subjectId).filter((v): v is number => v !== null))
  );
  const stageIds = Array.from(
    new Set(sessionRows.map((s) => s.stageId).filter((v): v is number => v !== null))
  );
  const gradeIds = Array.from(
    new Set(sessionRows.map((s) => s.gradeId).filter((v): v is number => v !== null))
  );
  const systemIds = Array.from(
    new Set(sessionRows.map((s) => s.systemId).filter((v): v is number => v !== null))
  );
  const divisionIds = Array.from(
    new Set(sessionRows.map((s) => s.divisionId).filter((v): v is number => v !== null))
  );
  const pathwayIds = Array.from(
    new Set(sessionRows.map((s) => s.pathwayId).filter((v): v is number => v !== null))
  );

  const [
    teacherRows,
    providerRows,
    subjectRows,
    stageRows,
    gradeRows,
    systemRows,
    divisionRows,
    pathwayRows,
    enrollmentRows,
  ] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, teacherIds)),
    db
      .select({
        userId: providerProfiles.userId,
        headline: providerProfiles.headline,
        providerType: providerProfiles.providerType,
        verificationStatus: providerProfiles.verificationStatus,
      })
      .from(providerProfiles)
      .where(inArray(providerProfiles.userId, teacherIds)),
    subjectIds.length > 0
      ? db
          .select({
            id: subjects.id,
            nameAr: subjects.nameAr,
            nameEn: subjects.nameEn,
            fieldId: subjects.fieldId,
            fieldNameAr: fields.nameAr,
          })
          .from(subjects)
          .innerJoin(fields, eq(subjects.fieldId, fields.id))
          .where(inArray(subjects.id, subjectIds))
      : Promise.resolve([]),
    stageIds.length > 0
      ? db
          .select({
            id: educationalStages.id,
            nameAr: educationalStages.nameAr,
            nameEn: educationalStages.nameEn,
          })
          .from(educationalStages)
          .where(inArray(educationalStages.id, stageIds))
      : Promise.resolve([]),
    gradeIds.length > 0
      ? db
          .select({
            id: educationalGrades.id,
            nameAr: educationalGrades.nameAr,
            nameEn: educationalGrades.nameEn,
            systemId: educationalSystems.id,
            systemNameAr: educationalSystems.nameAr,
            systemNameEn: educationalSystems.nameEn,
          })
          .from(educationalGrades)
          .innerJoin(
            educationalSystems,
            eq(educationalGrades.systemId, educationalSystems.id)
          )
          .where(inArray(educationalGrades.id, gradeIds))
      : Promise.resolve([]),
    systemIds.length > 0
      ? db
          .select({
            id: educationalSystems.id,
            nameAr: educationalSystems.nameAr,
            nameEn: educationalSystems.nameEn,
          })
          .from(educationalSystems)
          .where(inArray(educationalSystems.id, systemIds))
      : Promise.resolve([]),
    divisionIds.length > 0
      ? db
          .select({
            id: secondaryDivisions.id,
            nameAr: secondaryDivisions.nameAr,
            nameEn: secondaryDivisions.nameEn,
          })
          .from(secondaryDivisions)
          .where(inArray(secondaryDivisions.id, divisionIds))
      : Promise.resolve([]),
    pathwayIds.length > 0
      ? db
          .select({
            id: baccalaureatePathways.id,
            nameAr: baccalaureatePathways.nameAr,
            nameEn: baccalaureatePathways.nameEn,
          })
          .from(baccalaureatePathways)
          .where(inArray(baccalaureatePathways.id, pathwayIds))
      : Promise.resolve([]),
    db
      .select({
        id: sessionEnrollments.id,
        sessionId: sessionEnrollments.sessionId,
        studentUserId: sessionEnrollments.studentUserId,
        status: sessionEnrollments.status,
        notes: sessionEnrollments.notes,
        requestedAt: sessionEnrollments.requestedAt,
        respondedAt: sessionEnrollments.respondedAt,
        cancelledAt: sessionEnrollments.cancelledAt,
      })
      .from(sessionEnrollments)
      .where(inArray(sessionEnrollments.sessionId, sessionIds)),
  ]);

  const teacherMap = new Map(teacherRows.map((t) => [t.id, t]));
  const providerMap = new Map(providerRows.map((p) => [p.userId, p]));
  const subjectMap = new Map(subjectRows.map((s) => [s.id, s]));
  const stageMap = new Map(stageRows.map((s) => [s.id, s]));
  const gradeMap = new Map(gradeRows.map((g) => [g.id, g]));
  const systemMap = new Map(systemRows.map((s) => [s.id, s]));
  const divisionMap = new Map(divisionRows.map((d) => [d.id, d]));
  const pathwayMap = new Map(pathwayRows.map((p) => [p.id, p]));

  const viewerIsAdmin = Boolean(viewer?.roles.includes('ADMIN'));

  return sessionRows.map((s) => {
    const sessEnrs = enrollmentRows.filter((e) => e.sessionId === s.id);
    const acceptedCount = sessEnrs.filter((e) => e.status === 'ACCEPTED').length;
    const pendingCount = sessEnrs.filter((e) => e.status === 'PENDING').length;

    const myEnrollment = viewer
      ? sessEnrs
          .filter((e) => e.studentUserId === viewer.id)
          .sort(
            (a, b) =>
              new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
          )[0] || null
      : null;

    const availability = computeSessionAvailability({
      sessionType: s.sessionType as SessionType,
      capacity: s.capacity,
      acceptedCount,
      status: s.status as SessionStatus,
      startTime: s.startTime,
      registrationDeadline: s.registrationDeadline,
    });

    const slotStatus = computeIndividualSlotStatus({
      sessionType: s.sessionType as SessionType,
      status: s.status as SessionStatus,
      acceptedCount,
      pendingCount,
      startTime: s.startTime,
      registrationDeadline: s.registrationDeadline,
    });

    const isTeacherOrAdmin = Boolean(
      viewer && (viewer.id === s.teacherUserId || viewerIsAdmin)
    );
    const isAcceptedStudent = Boolean(
      myEnrollment &&
        myEnrollment.status === 'ACCEPTED' &&
        s.status !== 'CANCELLED'
    );
    const canSeeMeetingDetails = isTeacherOrAdmin || isAcceptedStudent;

    const teacher = teacherMap.get(s.teacherUserId);
    const provider = providerMap.get(s.teacherUserId);
    const subject = s.subjectId ? subjectMap.get(s.subjectId) : undefined;
    const stage = s.stageId ? stageMap.get(s.stageId) : undefined;
    const grade = s.gradeId ? gradeMap.get(s.gradeId) : undefined;
    const system = s.systemId ? systemMap.get(s.systemId) : undefined;
    const division = s.divisionId ? divisionMap.get(s.divisionId) : undefined;
    const pathway = s.pathwayId ? pathwayMap.get(s.pathwayId) : undefined;

    const isOffline = isOfflineDeliveryMode(s.deliveryMode);
    const publicPhysicalLocation = isOffline
      ? formatOfflineAddress(s) || s.location || null
      : null;

    return {
      id: s.id,
      teacherUserId: s.teacherUserId,
      teacherName: teacher?.fullName || 'معلّم',
      teacherAvatarUrl: teacher?.avatarUrl || null,
      teacherHeadline: provider?.headline || 'مدرّب ومقدّم خدمات تعليمية',
      teacherVerificationStatus: provider?.verificationStatus || 'PENDING',
      subjectId: s.subjectId,
      subjectNameAr: subject?.nameAr || null,
      subjectNameEn: subject?.nameEn || null,
      curriculumSubjectId: s.curriculumSubjectId,
      systemId: s.systemId ?? grade?.systemId ?? null,
      systemNameAr: system?.nameAr || grade?.systemNameAr || null,
      systemNameEn: system?.nameEn || grade?.systemNameEn || null,
      gradeId: s.gradeId,
      gradeNameAr: grade?.nameAr || null,
      gradeNameEn: grade?.nameEn || null,
      divisionId: s.divisionId,
      divisionNameAr: division?.nameAr || null,
      divisionNameEn: division?.nameEn || null,
      pathwayId: s.pathwayId,
      pathwayNameAr: pathway?.nameAr || null,
      pathwayNameEn: pathway?.nameEn || null,
      fieldId: subject?.fieldId || null,
      fieldNameAr: subject?.fieldNameAr || null,
      stageId: s.stageId,
      stageNameAr: stage?.nameAr || null,
      stageNameEn: stage?.nameEn || null,
      sessionType: s.sessionType as SessionType,
      title: s.title,
      description: s.description,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      capacity: availability.effectiveCapacity,
      minStudents: s.minStudents,
      acceptedCount,
      pendingCount: isTeacherOrAdmin ? pendingCount : undefined,
      hasPendingRequests: pendingCount > 0,
      slotStatus,
      remainingSeats: availability.remainingSeats,
      isFull: availability.isFull,
      isRegistrationOpen: availability.isRegistrationOpen,
      price: s.price,
      currency: s.currency,
      deliveryMode: normalizeDeliveryMode(s.deliveryMode) as DeliveryMode,
      location: publicPhysicalLocation,
      governorate: isOffline ? s.governorate : null,
      city: isOffline ? s.city : null,
      district: isOffline ? s.district : null,
      streetName: isOffline ? s.streetName : null,
      buildingOrCenterName: isOffline ? s.buildingOrCenterName : null,
      locationNotes: isOffline ? s.locationNotes : null,
      isDemoLocation: isOffline ? s.isDemoLocation : false,
      meetingUrl: canSeeMeetingDetails ? s.meetingUrl : null,
      registrationDeadline: s.registrationDeadline,
      status: s.status as SessionStatus,
      isDemo: s.isDemo,
      createdAt: s.createdAt,
      myEnrollment,
    };
  });
}

// ----------------------------------------------------------------------------
// PUBLIC / OPTIONAL AUTH BROWSING
// ----------------------------------------------------------------------------

router.get('/teaching-sessions', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const sessionType =
      typeof req.query.sessionType === 'string' && req.query.sessionType
        ? req.query.sessionType
        : undefined;
    const teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const curriculumSubjectId = req.query.curriculumSubjectId
      ? Number(req.query.curriculumSubjectId)
      : undefined;
    const systemId = req.query.systemId ? Number(req.query.systemId) : undefined;
    const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const divisionId = req.query.divisionId ? Number(req.query.divisionId) : undefined;
    const pathwayId = req.query.pathwayId ? Number(req.query.pathwayId) : undefined;
    const fieldId = req.query.fieldId ? Number(req.query.fieldId) : undefined;
    const status =
      typeof req.query.status === 'string' && req.query.status
        ? req.query.status
        : undefined;
    const deliveryModeRaw =
      typeof req.query.deliveryMode === 'string' && req.query.deliveryMode
        ? req.query.deliveryMode
        : undefined;
    const deliveryMode = deliveryModeRaw
      ? normalizeDeliveryMode(deliveryModeRaw)
      : undefined;
    const dateExact =
      typeof req.query.date === 'string' && req.query.date.trim()
        ? req.query.date.trim()
        : undefined;
    const dateFrom =
      typeof req.query.dateFrom === 'string' && req.query.dateFrom.trim()
        ? req.query.dateFrom.trim()
        : undefined;
    const dateTo =
      typeof req.query.dateTo === 'string' && req.query.dateTo.trim()
        ? req.query.dateTo.trim()
        : undefined;
    const minPrice =
      req.query.minPrice !== undefined && req.query.minPrice !== ''
        ? Number(req.query.minPrice)
        : undefined;
    const maxPrice =
      req.query.maxPrice !== undefined && req.query.maxPrice !== ''
        ? Number(req.query.maxPrice)
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const includePast = req.query.includePast === 'true';

    const page = Math.max(1, Number(req.query.page || 1));
    const maxLimit = teacherId ? 200 : 100;
    const defaultLimit = teacherId ? 60 : 24;
    const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit || defaultLimit)));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (sessionType === 'ONE_TO_ONE' || sessionType === 'GROUP') {
      conditions.push(eq(teachingSessions.sessionType, sessionType));
    }
    if (teacherId && Number.isInteger(teacherId)) {
      conditions.push(eq(teachingSessions.teacherUserId, teacherId));
    }
    if (curriculumSubjectId && Number.isInteger(curriculumSubjectId)) {
      conditions.push(eq(teachingSessions.curriculumSubjectId, curriculumSubjectId));
    }
    if (systemId && Number.isInteger(systemId)) {
      conditions.push(eq(teachingSessions.systemId, systemId));
    }
    if (gradeId && Number.isInteger(gradeId)) {
      conditions.push(eq(teachingSessions.gradeId, gradeId));
    }
    if (stageId && Number.isInteger(stageId)) {
      conditions.push(eq(teachingSessions.stageId, stageId));
    }
    if (divisionId && Number.isInteger(divisionId)) {
      conditions.push(eq(teachingSessions.divisionId, divisionId));
    }
    if (pathwayId && Number.isInteger(pathwayId)) {
      conditions.push(eq(teachingSessions.pathwayId, pathwayId));
    }
    if (subjectId && Number.isInteger(subjectId)) {
      conditions.push(eq(teachingSessions.subjectId, subjectId));
    }
    if (deliveryMode) {
      conditions.push(eq(teachingSessions.deliveryMode, deliveryMode));
    }
    if (status) {
      conditions.push(eq(teachingSessions.status, status));
    } else {
      conditions.push(ne(teachingSessions.status, 'CANCELLED'));
    }

    if (!includePast) {
      const nowDt = new Date();
      conditions.push(
        or(
          gte(teachingSessions.endTime, nowDt),
          eq(teachingSessions.status, 'COMPLETED')
        )!
      );
    }

    if (dateExact) {
      const dayStart = new Date(`${dateExact}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateExact}T23:59:59.999Z`);
      if (!Number.isNaN(dayStart.getTime()) && !Number.isNaN(dayEnd.getTime())) {
        conditions.push(gte(teachingSessions.startTime, dayStart));
        conditions.push(lte(teachingSessions.startTime, dayEnd));
      }
    } else {
      if (dateFrom) {
        const fromDt = new Date(dateFrom);
        if (!Number.isNaN(fromDt.getTime())) {
          conditions.push(gte(teachingSessions.startTime, fromDt));
        }
      }
      if (dateTo) {
        const toDt = new Date(
          dateTo.length === 10 ? `${dateTo}T23:59:59.999Z` : dateTo
        );
        if (!Number.isNaN(toDt.getTime())) {
          conditions.push(lte(teachingSessions.startTime, toDt));
        }
      }
    }

    if (minPrice !== undefined && Number.isFinite(minPrice)) {
      conditions.push(
        sql`CAST(${teachingSessions.price} AS NUMERIC) >= ${minPrice}`
      );
    }
    if (maxPrice !== undefined && Number.isFinite(maxPrice)) {
      conditions.push(
        sql`CAST(${teachingSessions.price} AS NUMERIC) <= ${maxPrice}`
      );
    }

    if (fieldId && Number.isInteger(fieldId)) {
      const fieldSubjRows = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.fieldId, fieldId));
      const fSubjIds = fieldSubjRows.map((r) => r.id);
      if (fSubjIds.length === 0) {
        return res.json({ sessions: [], total: 0, page, limit, totalPages: 0 });
      }
      conditions.push(inArray(teachingSessions.subjectId, fSubjIds));
    }

    if (q) {
      const likePattern = `%${q}%`;
      const [matchedTeachers, matchedSubjects] = await Promise.all([
        db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              ilike(users.fullName, likePattern),
              eq(users.accountStatus, 'ACTIVE')
            )
          ),
        db
          .select({ id: subjects.id })
          .from(subjects)
          .where(
            or(ilike(subjects.nameAr, likePattern), ilike(subjects.nameEn, likePattern))
          ),
      ]);

      const searchParts: SQL[] = [
        ilike(teachingSessions.title, likePattern),
        ilike(teachingSessions.description, likePattern),
        ilike(teachingSessions.location, likePattern),
        ilike(teachingSessions.governorate, likePattern),
        ilike(teachingSessions.city, likePattern),
        ilike(teachingSessions.district, likePattern),
      ];
      if (matchedTeachers.length > 0) {
        searchParts.push(
          inArray(
            teachingSessions.teacherUserId,
            matchedTeachers.map((t) => t.id)
          )
        );
      }
      if (matchedSubjects.length > 0) {
        searchParts.push(
          inArray(
            teachingSessions.subjectId,
            matchedSubjects.map((s) => s.id)
          )
        );
      }
      conditions.push(or(...searchParts)!);
    }

    conditions.push(eq(users.accountStatus, 'ACTIVE'));
    const whereClause = and(...conditions);

    const [[countRow], pagedJoinedRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(teachingSessions)
        .innerJoin(users, eq(teachingSessions.teacherUserId, users.id))
        .where(whereClause),
      db
        .select({ session: teachingSessions })
        .from(teachingSessions)
        .innerJoin(users, eq(teachingSessions.teacherUserId, users.id))
        .where(whereClause)
        .orderBy(asc(teachingSessions.startTime))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countRow?.count ?? 0;
    const pagedRows = pagedJoinedRows.map((r) => r.session);
    const enriched = await enrichSessionsForViewer(pagedRows, req.authUser);

    res.json({
      sessions: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('List teaching sessions error:', error);
    res.status(500).json({ error: 'تعذر جلب الجلسات التعليمية.' });
  }
});

// Teacher's own sessions + availability (must come BEFORE /:id)
router.get(
  '/teaching-sessions/mine',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const uid = req.authUser!.id;
      const status =
        typeof req.query.status === 'string' && req.query.status
          ? req.query.status
          : undefined;
      const sessionType =
        typeof req.query.sessionType === 'string' && req.query.sessionType
          ? req.query.sessionType
          : undefined;
      const deliveryModeRaw =
        typeof req.query.deliveryMode === 'string' && req.query.deliveryMode
          ? req.query.deliveryMode
          : undefined;
      const deliveryMode = deliveryModeRaw
        ? normalizeDeliveryMode(deliveryModeRaw)
        : undefined;
      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
      const view =
        typeof req.query.view === 'string' ? req.query.view : 'all';

      const [mySessionsRaw, myAvailability] = await Promise.all([
        db
          .select()
          .from(teachingSessions)
          .where(eq(teachingSessions.teacherUserId, uid))
          .orderBy(asc(teachingSessions.startTime)),
        db
          .select()
          .from(teacherAvailability)
          .where(eq(teacherAvailability.teacherUserId, uid))
          .orderBy(
            asc(teacherAvailability.dayOfWeek),
            asc(teacherAvailability.startTime)
          ),
      ]);

      const nowMs = Date.now();
      const summaryCounts = {
        all: mySessionsRaw.length,
        onlineGroup: mySessionsRaw.filter(
          (s) => s.sessionType === 'GROUP' && s.deliveryMode === 'ONLINE'
        ).length,
        onlineOneToOne: mySessionsRaw.filter(
          (s) => s.sessionType === 'ONE_TO_ONE' && s.deliveryMode === 'ONLINE'
        ).length,
        offlineGroup: mySessionsRaw.filter(
          (s) => s.sessionType === 'GROUP' && s.deliveryMode === 'IN_PERSON'
        ).length,
        upcoming: mySessionsRaw.filter(
          (s) =>
            (s.status === 'OPEN' || s.status === 'FULL') &&
            new Date(s.endTime).getTime() >= nowMs
        ).length,
        completed: mySessionsRaw.filter((s) => s.status === 'COMPLETED').length,
        cancelled: mySessionsRaw.filter((s) => s.status === 'CANCELLED').length,
      };

      const filtered = mySessionsRaw.filter((s) => {
        if (status && s.status !== status) return false;
        if (sessionType && s.sessionType !== sessionType) return false;
        if (deliveryMode && s.deliveryMode !== deliveryMode) return false;
        if (subjectId && s.subjectId !== subjectId) return false;
        if (gradeId && s.gradeId !== gradeId) return false;
        if (view === 'online_group') {
          if (s.sessionType !== 'GROUP' || s.deliveryMode !== 'ONLINE') return false;
        } else if (view === 'online_one_to_one') {
          if (s.sessionType !== 'ONE_TO_ONE' || s.deliveryMode !== 'ONLINE') {
            return false;
          }
        } else if (view === 'offline_group') {
          if (s.sessionType !== 'GROUP' || s.deliveryMode !== 'IN_PERSON') {
            return false;
          }
        } else if (view === 'upcoming') {
          if (
            (s.status !== 'OPEN' && s.status !== 'FULL') ||
            new Date(s.endTime).getTime() < nowMs
          ) {
            return false;
          }
        } else if (view === 'completed') {
          if (s.status !== 'COMPLETED') return false;
        } else if (view === 'cancelled') {
          if (s.status !== 'CANCELLED') return false;
        }
        return true;
      });

      const enriched = await enrichSessionsForViewer(filtered, req.authUser);

      res.json({
        sessions: enriched,
        availability: myAvailability,
        counts: summaryCounts,
      });
    } catch (error) {
      console.error('Teacher sessions mine error:', error);
      res.status(500).json({ error: 'تعذر جلب جلساتك.' });
    }
  }
);

// Teacher's incoming booking & enrollment requests across their sessions
router.get(
  '/teaching-sessions/teacher/requests',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const uid = req.authUser!.id;
      const isAdmin = req.authUser!.roles.includes('ADMIN');
      const sessionType =
        typeof req.query.sessionType === 'string' && req.query.sessionType
          ? req.query.sessionType
          : undefined;
      const deliveryModeRaw =
        typeof req.query.deliveryMode === 'string' && req.query.deliveryMode
          ? req.query.deliveryMode
          : undefined;
      const deliveryMode = deliveryModeRaw
        ? normalizeDeliveryMode(deliveryModeRaw)
        : undefined;
      const statusFilter =
        typeof req.query.status === 'string' && req.query.status
          ? req.query.status
          : undefined;
      const subjectId = req.query.subjectId
        ? Number(req.query.subjectId)
        : undefined;
      const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
      const sessionIdFilter = req.query.sessionId
        ? Number(req.query.sessionId)
        : undefined;
      const dateFilter =
        typeof req.query.date === 'string' ? req.query.date.trim() : undefined;

      const teacherSessions =
        isAdmin && req.query.all === 'true'
          ? await db.select().from(teachingSessions)
          : await db
              .select()
              .from(teachingSessions)
              .where(eq(teachingSessions.teacherUserId, uid));

      const matchingSessions = teacherSessions.filter((s) => {
        if (sessionType && s.sessionType !== sessionType) return false;
        if (deliveryMode && s.deliveryMode !== deliveryMode) return false;
        if (subjectId && s.subjectId !== subjectId) return false;
        if (gradeId && s.gradeId !== gradeId) return false;
        if (sessionIdFilter && s.id !== sessionIdFilter) return false;
        if (dateFilter) {
          const isoDate = new Date(s.startTime).toISOString().slice(0, 10);
          if (isoDate !== dateFilter) return false;
        }
        return true;
      });

      if (matchingSessions.length === 0) {
        return res.json({ requests: [] });
      }

      const sessionMap = new Map(matchingSessions.map((s) => [s.id, s]));
      const sessionIds = matchingSessions.map((s) => s.id);

      const enrRows = await db
        .select()
        .from(sessionEnrollments)
        .where(inArray(sessionEnrollments.sessionId, sessionIds))
        .orderBy(desc(sessionEnrollments.requestedAt));

      const filteredEnrs = statusFilter
        ? enrRows.filter((e) => e.status === statusFilter)
        : enrRows;

      if (filteredEnrs.length === 0) {
        return res.json({ requests: [] });
      }

      const studentIds = Array.from(
        new Set(filteredEnrs.map((e) => e.studentUserId))
      );
      const subjectIds = Array.from(
        new Set(
          matchingSessions
            .map((s) => s.subjectId)
            .filter((v): v is number => v !== null)
        )
      );
      const gradeIds = Array.from(
        new Set(
          matchingSessions
            .map((s) => s.gradeId)
            .filter((v): v is number => v !== null)
        )
      );
      const systemIds = Array.from(
        new Set(
          matchingSessions
            .map((s) => s.systemId)
            .filter((v): v is number => v !== null)
        )
      );

      // Only permitted public student profile fields — NEVER email, phone, or passwordHash
      const [
        studentUsers,
        studentProfileRows,
        subjectRows,
        gradeRows,
        systemRows,
      ] = await Promise.all([
        db
          .select({
            id: users.id,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(inArray(users.id, studentIds)),
        db
          .select({
            userId: studentProfiles.userId,
            learningGoal: studentProfiles.learningGoal,
            bio: studentProfiles.bio,
            stageNameAr: educationalStages.nameAr,
          })
          .from(studentProfiles)
          .leftJoin(
            educationalStages,
            eq(studentProfiles.stageId, educationalStages.id)
          )
          .where(inArray(studentProfiles.userId, studentIds)),
        subjectIds.length > 0
          ? db
              .select({ id: subjects.id, nameAr: subjects.nameAr })
              .from(subjects)
              .where(inArray(subjects.id, subjectIds))
          : Promise.resolve([]),
        gradeIds.length > 0
          ? db
              .select({ id: educationalGrades.id, nameAr: educationalGrades.nameAr })
              .from(educationalGrades)
              .where(inArray(educationalGrades.id, gradeIds))
          : Promise.resolve([]),
        systemIds.length > 0
          ? db
              .select({ id: educationalSystems.id, nameAr: educationalSystems.nameAr })
              .from(educationalSystems)
              .where(inArray(educationalSystems.id, systemIds))
          : Promise.resolve([]),
      ]);

      const userMap = new Map(studentUsers.map((u) => [u.id, u]));
      const profileMap = new Map(studentProfileRows.map((p) => [p.userId, p]));
      const subjectMap = new Map(subjectRows.map((s) => [s.id, s.nameAr]));
      const gradeMap = new Map(gradeRows.map((g) => [g.id, g.nameAr]));
      const systemMap = new Map(systemRows.map((s) => [s.id, s.nameAr]));

      const requests = filteredEnrs.map((e) => {
        const sess = sessionMap.get(e.sessionId)!;
        const st = userMap.get(e.studentUserId);
        const prof = profileMap.get(e.studentUserId);
        return {
          id: e.id,
          sessionId: e.sessionId,
          sessionTitle: sess.title,
          sessionType: sess.sessionType,
          deliveryMode: sess.deliveryMode,
          location:
            sess.deliveryMode === 'IN_PERSON'
              ? formatOfflineAddress(sess) || sess.location || null
              : null,
          sessionStartTime: sess.startTime,
          sessionEndTime: sess.endTime,
          durationMinutes: sess.durationMinutes,
          price: sess.price,
          currency: sess.currency,
          sessionStatus: sess.status,
          subjectId: sess.subjectId,
          subjectNameAr: sess.subjectId
            ? subjectMap.get(sess.subjectId) || null
            : null,
          gradeId: sess.gradeId,
          gradeNameAr: sess.gradeId ? gradeMap.get(sess.gradeId) || null : null,
          systemNameAr: sess.systemId ? systemMap.get(sess.systemId) || null : null,
          status: e.status,
          notes: e.notes,
          requestedAt: e.requestedAt,
          respondedAt: e.respondedAt,
          cancelledAt: e.cancelledAt,
          student: {
            id: e.studentUserId,
            fullName: st?.fullName || 'طالب',
            avatarUrl: st?.avatarUrl || null,
            stageNameAr: prof?.stageNameAr || null,
            learningGoal: prof?.learningGoal || null,
            bio: prof?.bio || null,
          },
        };
      });

      res.json({ requests });
    } catch (error) {
      console.error('Teacher requests error:', error);
      res.status(500).json({ error: 'تعذر جلب طلبات الحجز والتسجيل.' });
    }
  }
);

router.get('/teaching-sessions/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ error: 'معرف الجلسة غير صالح.' });
    }

    const [sessionJoined] = await db
      .select({
        session: teachingSessions,
        teacherStatus: users.accountStatus,
      })
      .from(teachingSessions)
      .innerJoin(users, eq(teachingSessions.teacherUserId, users.id))
      .where(eq(teachingSessions.id, sessionId))
      .limit(1);

    if (!sessionJoined) {
      return res.status(404).json({ error: 'الجلسة غير موجودة.' });
    }
    const sessionRow = sessionJoined.session;

    const isTeacherOrAdmin = Boolean(
      req.authUser &&
        (req.authUser.id === sessionRow.teacherUserId ||
          req.authUser.roles.includes('ADMIN'))
    );

    if (sessionJoined.teacherStatus !== 'ACTIVE' && !isTeacherOrAdmin) {
      let hasEnrollment = false;
      if (req.authUser) {
        const [enr] = await db
          .select({ id: sessionEnrollments.id })
          .from(sessionEnrollments)
          .where(
            and(
              eq(sessionEnrollments.sessionId, sessionId),
              eq(sessionEnrollments.studentUserId, req.authUser.id)
            )
          )
          .limit(1);
        hasEnrollment = Boolean(enr);
      }
      if (!hasEnrollment) {
        return res.status(404).json({ error: 'الجلسة غير موجودة.' });
      }
    }

    const [enriched] = await enrichSessionsForViewer([sessionRow], req.authUser);

    let enrollmentsList: Array<{
      id: number;
      status: string;
      notes: string | null;
      requestedAt: Date;
      respondedAt: Date | null;
      student: {
        id: number;
        fullName: string;
        avatarUrl: string | null;
        stageNameAr: string | null;
        learningGoal: string | null;
        bio: string | null;
      };
    }> = [];

    if (isTeacherOrAdmin) {
      const rows = await db
        .select({
          id: sessionEnrollments.id,
          status: sessionEnrollments.status,
          notes: sessionEnrollments.notes,
          requestedAt: sessionEnrollments.requestedAt,
          respondedAt: sessionEnrollments.respondedAt,
          studentId: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          stageNameAr: educationalStages.nameAr,
          learningGoal: studentProfiles.learningGoal,
          bio: studentProfiles.bio,
        })
        .from(sessionEnrollments)
        .innerJoin(users, eq(sessionEnrollments.studentUserId, users.id))
        .leftJoin(
          studentProfiles,
          eq(studentProfiles.userId, sessionEnrollments.studentUserId)
        )
        .leftJoin(
          educationalStages,
          eq(studentProfiles.stageId, educationalStages.id)
        )
        .where(eq(sessionEnrollments.sessionId, sessionId))
        .orderBy(desc(sessionEnrollments.requestedAt));

      enrollmentsList = rows.map((r) => ({
        id: r.id,
        status: r.status,
        notes: r.notes,
        requestedAt: r.requestedAt,
        respondedAt: r.respondedAt,
        student: {
          id: r.studentId,
          fullName: r.fullName,
          avatarUrl: r.avatarUrl,
          stageNameAr: r.stageNameAr || null,
          learningGoal: r.learningGoal || null,
          bio: r.bio || null,
        },
      }));
    }

    res.json({
      session: enriched,
      ...(isTeacherOrAdmin ? { enrollments: enrollmentsList } : {}),
    });
  } catch (error) {
    console.error('Get teaching session detail error:', error);
    res.status(500).json({ error: 'تعذر جلب تفاصيل الجلسة.' });
  }
});

// ----------------------------------------------------------------------------
// TEACHER SESSION MANAGEMENT (CREATE, EDIT, CANCEL, COMPLETE, STUDENTS)
// ----------------------------------------------------------------------------

router.post(
  '/teaching-sessions',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الجلسة غير مكتملة.',
        });
      }

      const d = parsed.data;
      const effectiveCapacity = d.sessionType === 'ONE_TO_ONE' ? 1 : (d.capacity ?? 10);
      const canonicalDelivery = normalizeDeliveryMode(d.deliveryMode);
      const resolvedOfflineLocation =
        canonicalDelivery === 'IN_PERSON'
          ? formatOfflineAddress({
              governorate: d.governorate,
              city: d.city,
              district: d.district,
              streetName: d.streetName,
              buildingOrCenterName: d.buildingOrCenterName,
              locationNotes: d.locationNotes,
              location: d.location,
            }) || null
          : null;

      if (!isSafeHttpUrl(d.meetingUrl)) {
        return res.status(400).json({ error: 'رابط الاجتماع غير صالح.' });
      }

      const scheduleError = validateSessionSchedule({
        sessionType: d.sessionType,
        startTime: d.startTime,
        endTime: d.endTime,
        capacity: effectiveCapacity,
        minStudents: d.sessionType === 'GROUP' ? d.minStudents ?? null : null,
        registrationDeadline: d.registrationDeadline ?? null,
        deliveryMode: canonicalDelivery,
        location: resolvedOfflineLocation,
        governorate: d.governorate ?? null,
        city: d.city ?? null,
        district: d.district ?? null,
        streetName: d.streetName ?? null,
        buildingOrCenterName: d.buildingOrCenterName ?? null,
        meetingUrl: d.meetingUrl ?? null,
        price: d.price,
      });
      if (scheduleError) {
        return res.status(400).json({ error: scheduleError });
      }

      let resolvedSubjectId = d.subjectId ?? null;
      let resolvedGradeId = d.gradeId ?? null;
      let resolvedStageId = d.stageId ?? null;
      let resolvedSystemId = d.systemId ?? null;
      let resolvedDivisionId = d.divisionId ?? null;
      let resolvedPathwayId = d.pathwayId ?? null;
      const resolvedCurriculumSubjectId = d.curriculumSubjectId ?? null;

      if (resolvedCurriculumSubjectId) {
        const [cs] = await db
          .select()
          .from(curriculumSubjects)
          .where(eq(curriculumSubjects.id, resolvedCurriculumSubjectId))
          .limit(1);
        if (!cs || !cs.isActive) {
          return res
            .status(400)
            .json({ error: 'المادة المنهجية المحددة غير موجودة أو غير مفعّلة.' });
        }
        resolvedSubjectId = cs.subjectId;
        resolvedGradeId = cs.gradeId;
        resolvedStageId = cs.stageId;
        resolvedSystemId = cs.systemId;
        resolvedDivisionId = cs.divisionId;
        resolvedPathwayId = cs.pathwayId;
      } else {
        if (resolvedSubjectId) {
          const [subj] = await db
            .select({ id: subjects.id })
            .from(subjects)
            .where(eq(subjects.id, resolvedSubjectId))
            .limit(1);
          if (!subj) {
            return res.status(400).json({ error: 'المادة الدراسية المحددة غير موجودة.' });
          }
        }
        if (resolvedGradeId) {
          const [grd] = await db
            .select({
              id: educationalGrades.id,
              stageId: educationalGrades.stageId,
              systemId: educationalGrades.systemId,
            })
            .from(educationalGrades)
            .where(eq(educationalGrades.id, resolvedGradeId))
            .limit(1);
          if (!grd) {
            return res.status(400).json({ error: 'الصف الدراسي المحدد غير موجود.' });
          }
          if (!resolvedStageId) resolvedStageId = grd.stageId;
          if (!resolvedSystemId) resolvedSystemId = grd.systemId;
        }
        if (resolvedStageId) {
          const [stg] = await db
            .select({ id: educationalStages.id })
            .from(educationalStages)
            .where(eq(educationalStages.id, resolvedStageId))
            .limit(1);
          if (!stg) {
            return res.status(400).json({ error: 'المرحلة التعليمية المحددة غير موجودة.' });
          }
        }
      }

      const startDt = new Date(d.startTime);
      const endDt = new Date(d.endTime);
      const deadlineDt = d.registrationDeadline
        ? new Date(d.registrationDeadline)
        : null;
      const durationMinutes = calculateDurationMinutes(startDt, endDt);
      const teacherId = req.authUser!.id;

      const created = await db.transaction(async (tx) => {
        // Prevent overlapping non-cancelled sessions for the same teacher
        const existingSessions = await tx
          .select({
            id: teachingSessions.id,
            startTime: teachingSessions.startTime,
            endTime: teachingSessions.endTime,
          })
          .from(teachingSessions)
          .where(
            and(
              eq(teachingSessions.teacherUserId, teacherId),
              ne(teachingSessions.status, 'CANCELLED')
            )
          );

        const hasOverlap = existingSessions.some((ex) =>
          doTimeRangesOverlap(startDt, endDt, ex.startTime, ex.endTime)
        );
        if (hasOverlap) {
          throw new Error('SESSION_OVERLAP');
        }

        const safeMeetingUrl =
          canonicalDelivery === 'ONLINE'
            ? d.meetingUrl?.trim() ||
              `https://meet.jusoor.example/session-${Date.now()}`
            : null;

        const [row] = await tx
          .insert(teachingSessions)
          .values({
            teacherUserId: teacherId,
            subjectId: resolvedSubjectId,
            curriculumSubjectId: resolvedCurriculumSubjectId,
            systemId: resolvedSystemId,
            gradeId: resolvedGradeId,
            stageId: resolvedStageId,
            divisionId: resolvedDivisionId,
            pathwayId: resolvedPathwayId,
            sessionType: d.sessionType,
            title: d.title.trim(),
            description: d.description?.trim() || null,
            startTime: startDt,
            endTime: endDt,
            durationMinutes,
            capacity: effectiveCapacity,
            minStudents: d.sessionType === 'GROUP' ? d.minStudents ?? null : null,
            price: d.price.toFixed(2),
            currency: d.currency.toUpperCase(),
            deliveryMode: canonicalDelivery,
            location: resolvedOfflineLocation,
            governorate:
              canonicalDelivery === 'IN_PERSON' ? d.governorate?.trim() || null : null,
            city: canonicalDelivery === 'IN_PERSON' ? d.city?.trim() || null : null,
            district:
              canonicalDelivery === 'IN_PERSON' ? d.district?.trim() || null : null,
            streetName:
              canonicalDelivery === 'IN_PERSON' ? d.streetName?.trim() || null : null,
            buildingOrCenterName:
              canonicalDelivery === 'IN_PERSON'
                ? d.buildingOrCenterName?.trim() || null
                : null,
            locationNotes:
              canonicalDelivery === 'IN_PERSON' ? d.locationNotes?.trim() || null : null,
            isDemoLocation:
              canonicalDelivery === 'IN_PERSON' ? Boolean(d.isDemoLocation) : false,
            meetingUrl: safeMeetingUrl,
            registrationDeadline: deadlineDt,
            status: 'OPEN',
            isDemo: false,
          })
          .returning();

        return row;
      });

      const [enriched] = await enrichSessionsForViewer([created], req.authUser);
      res.status(201).json({ session: enriched });
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_OVERLAP') {
        return res.status(409).json({
          error: 'يوجد تعارض زمني مع جلسة أخرى مجدولة لديك في نفس الوقت.',
        });
      }
      console.error('Create teaching session error:', error);
      res.status(500).json({ error: 'تعذر إنشاء الجلسة التعليمية.' });
    }
  }
);

router.patch(
  '/teaching-sessions/:id',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'معرف الجلسة غير صالح.' });
      }

      const parsed = updateSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات التعديل غير صالحة.',
        });
      }
      const d = parsed.data;
      if (d.meetingUrl !== undefined && !isSafeHttpUrl(d.meetingUrl)) {
        return res.status(400).json({ error: 'رابط الاجتماع غير صالح.' });
      }

      const isAdmin = req.authUser!.roles.includes('ADMIN');

      const updated = await db.transaction(async (tx) => {
        const locked = await lockSessionRow(tx, sessionId);
        if (!locked) throw new Error('NOT_FOUND');

        if (locked.teacher_user_id !== req.authUser!.id && !isAdmin) {
          throw new Error('FORBIDDEN');
        }

        const [current] = await tx
          .select()
          .from(teachingSessions)
          .where(eq(teachingSessions.id, sessionId))
          .limit(1);
        if (!current) throw new Error('NOT_FOUND');

        const enrs = await tx
          .select({
            id: sessionEnrollments.id,
            studentUserId: sessionEnrollments.studentUserId,
            status: sessionEnrollments.status,
          })
          .from(sessionEnrollments)
          .where(eq(sessionEnrollments.sessionId, sessionId));

        const acceptedCount = enrs.filter((e) => e.status === 'ACCEPTED').length;
        const activeRequestsCount = enrs.filter(
          (e) => e.status === 'ACCEPTED' || e.status === 'PENDING'
        ).length;

        const nextSessionType =
          (d.sessionType as SessionType | undefined) ||
          (current.sessionType as SessionType);
        const nextCapacity =
          nextSessionType === 'ONE_TO_ONE'
            ? 1
            : d.capacity ?? current.capacity;

        const editCheck = canEditTeachingSession({
          currentStatus: current.status as SessionStatus,
          acceptedCount,
          activeRequestsCount,
          nextCapacity,
          currentSessionType: current.sessionType as SessionType,
          nextSessionType,
        });
        if (!editCheck.allowed) {
          throw new Error(`RULE:${editCheck.reason}`);
        }

        const nextStart = d.startTime ? new Date(d.startTime) : current.startTime;
        const nextEnd = d.endTime ? new Date(d.endTime) : current.endTime;
        const nextDeadline =
          d.registrationDeadline !== undefined
            ? d.registrationDeadline
              ? new Date(d.registrationDeadline)
              : null
            : current.registrationDeadline;
        const nextDelivery = normalizeDeliveryMode(
          d.deliveryMode ?? current.deliveryMode
        );
        const nextGov = d.governorate !== undefined ? d.governorate : current.governorate;
        const nextCity = d.city !== undefined ? d.city : current.city;
        const nextDist = d.district !== undefined ? d.district : current.district;
        const nextStreet =
          d.streetName !== undefined ? d.streetName : current.streetName;
        const nextBldg =
          d.buildingOrCenterName !== undefined
            ? d.buildingOrCenterName
            : current.buildingOrCenterName;
        const nextLocNotes =
          d.locationNotes !== undefined ? d.locationNotes : current.locationNotes;
        const rawNextLoc = d.location !== undefined ? d.location : current.location;
        const nextLocation =
          nextDelivery === 'IN_PERSON'
            ? formatOfflineAddress({
                governorate: nextGov,
                city: nextCity,
                district: nextDist,
                streetName: nextStreet,
                buildingOrCenterName: nextBldg,
                locationNotes: nextLocNotes,
                location: rawNextLoc,
              }) || null
            : null;
        const nextMeetingUrl =
          d.meetingUrl !== undefined ? d.meetingUrl : current.meetingUrl;
        const nextPrice =
          d.price !== undefined ? d.price : Number(current.price);
        const nextCurrency =
          d.currency !== undefined ? d.currency.toUpperCase() : current.currency;
        const nextMinStudents =
          nextSessionType === 'ONE_TO_ONE'
            ? null
            : d.minStudents !== undefined
            ? d.minStudents
            : current.minStudents;

        const scheduleError = validateSessionSchedule({
          sessionType: nextSessionType,
          startTime: nextStart,
          endTime: nextEnd,
          capacity: nextCapacity,
          minStudents: nextMinStudents,
          registrationDeadline: nextDeadline,
          deliveryMode: nextDelivery,
          location: nextLocation,
          governorate: nextGov,
          city: nextCity,
          district: nextDist,
          streetName: nextStreet,
          buildingOrCenterName: nextBldg,
          meetingUrl: nextMeetingUrl,
          price: nextPrice,
        });
        if (scheduleError) {
          throw new Error(`RULE:${scheduleError}`);
        }

        // Check overlap with other non-cancelled teacher sessions
        const otherSessions = await tx
          .select({
            id: teachingSessions.id,
            startTime: teachingSessions.startTime,
            endTime: teachingSessions.endTime,
          })
          .from(teachingSessions)
          .where(
            and(
              eq(teachingSessions.teacherUserId, current.teacherUserId),
              ne(teachingSessions.id, sessionId),
              ne(teachingSessions.status, 'CANCELLED')
            )
          );

        if (
          otherSessions.some((ex) =>
            doTimeRangesOverlap(nextStart, nextEnd, ex.startTime, ex.endTime)
          )
        ) {
          throw new Error('SESSION_OVERLAP');
        }

        const avail = computeSessionAvailability({
          sessionType: nextSessionType,
          capacity: nextCapacity,
          acceptedCount,
          status: current.status as SessionStatus,
          startTime: nextStart,
          registrationDeadline: nextDeadline,
        });

        let nextSubjectId = d.subjectId !== undefined ? d.subjectId : current.subjectId;
        let nextStageId = d.stageId !== undefined ? d.stageId : current.stageId;
        let nextGradeId = d.gradeId !== undefined ? d.gradeId : current.gradeId;
        let nextSystemId = d.systemId !== undefined ? d.systemId : current.systemId;
        let nextDivisionId =
          d.divisionId !== undefined ? d.divisionId : current.divisionId;
        let nextPathwayId =
          d.pathwayId !== undefined ? d.pathwayId : current.pathwayId;
        const nextCurriculumSubjectId =
          d.curriculumSubjectId !== undefined
            ? d.curriculumSubjectId
            : current.curriculumSubjectId;

        if (d.curriculumSubjectId !== undefined && d.curriculumSubjectId !== null) {
          const [cs] = await tx
            .select()
            .from(curriculumSubjects)
            .where(eq(curriculumSubjects.id, d.curriculumSubjectId))
            .limit(1);
          if (!cs || !cs.isActive) {
            throw new Error('RULE:المادة المنهجية المحددة غير موجودة أو غير مفعّلة.');
          }
          nextSubjectId = cs.subjectId;
          nextGradeId = cs.gradeId;
          nextStageId = cs.stageId;
          nextSystemId = cs.systemId;
          nextDivisionId = cs.divisionId;
          nextPathwayId = cs.pathwayId;
        }

        const [saved] = await tx
          .update(teachingSessions)
          .set({
            sessionType: nextSessionType,
            title: d.title !== undefined ? d.title.trim() : current.title,
            description:
              d.description !== undefined
                ? d.description?.trim() || null
                : current.description,
            subjectId: nextSubjectId,
            curriculumSubjectId: nextCurriculumSubjectId,
            systemId: nextSystemId,
            gradeId: nextGradeId,
            stageId: nextStageId,
            divisionId: nextDivisionId,
            pathwayId: nextPathwayId,
            startTime: nextStart,
            endTime: nextEnd,
            durationMinutes: calculateDurationMinutes(nextStart, nextEnd),
            capacity: nextCapacity,
            minStudents: nextMinStudents,
            price: nextPrice.toFixed(2),
            currency: nextCurrency,
            deliveryMode: nextDelivery,
            location: nextLocation,
            governorate:
              nextDelivery === 'IN_PERSON' ? nextGov?.trim() || null : null,
            city: nextDelivery === 'IN_PERSON' ? nextCity?.trim() || null : null,
            district:
              nextDelivery === 'IN_PERSON' ? nextDist?.trim() || null : null,
            streetName:
              nextDelivery === 'IN_PERSON' ? nextStreet?.trim() || null : null,
            buildingOrCenterName:
              nextDelivery === 'IN_PERSON' ? nextBldg?.trim() || null : null,
            locationNotes:
              nextDelivery === 'IN_PERSON' ? nextLocNotes?.trim() || null : null,
            meetingUrl:
              nextDelivery === 'ONLINE'
                ? nextMeetingUrl?.trim() ||
                  current.meetingUrl ||
                  `https://meet.jusoor.example/session-${sessionId}`
                : null,
            registrationDeadline: nextDeadline,
            status: avail.nextStatus,
            updatedAt: new Date(),
          })
          .where(eq(teachingSessions.id, sessionId))
          .returning();

        const scheduleChanged =
          nextStart.getTime() !== current.startTime.getTime() ||
          nextEnd.getTime() !== current.endTime.getTime() ||
          nextLocation !== current.location;
        if (scheduleChanged) {
          const affectedStudentIds = Array.from(
            new Set(
              enrs
                .filter((e) => e.status === 'ACCEPTED' || e.status === 'PENDING')
                .map((e) => e.studentUserId)
            )
          );
          if (affectedStudentIds.length > 0) {
            await tx.insert(notifications).values(
              affectedStudentIds.map((studentUid) => ({
                userId: studentUid,
                type: 'BOOKING',
                title: 'تم تحديث تفاصيل الجلسة',
                body: `قام المدرّب بتحديث موعد أو موقع جلسة "${saved.title}". يرجى مراجعة التفاصيل الجديدة.`,
                linkUrl: '/dashboard',
              }))
            );
          }
        }

        return saved;
      });

      const [enriched] = await enrichSessionsForViewer([updated], req.authUser);
      res.json({ session: enriched });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'الجلسة غير موجودة.' });
        }
        if (error.message === 'FORBIDDEN') {
          return res
            .status(403)
            .json({ error: 'ممنوع: لا تملك صلاحية تعديل هذه الجلسة.' });
        }
        if (error.message === 'SESSION_OVERLAP') {
          return res.status(409).json({
            error: 'يوجد تعارض زمني مع جلسة أخرى مجدولة لديك.',
          });
        }
        if (error.message.startsWith('RULE:')) {
          return res.status(400).json({ error: error.message.slice(5) });
        }
      }
      console.error('Update teaching session error:', error);
      res.status(500).json({ error: 'تعذر تحديث بيانات الجلسة.' });
    }
  }
);

router.post(
  '/teaching-sessions/:id/cancel',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'معرف الجلسة غير صالح.' });
      }
      const isAdmin = req.authUser!.roles.includes('ADMIN');

      const cancelled = await db.transaction(async (tx) => {
        const locked = await lockSessionRow(tx, sessionId);
        if (!locked) throw new Error('NOT_FOUND');

        if (locked.teacher_user_id !== req.authUser!.id && !isAdmin) {
          throw new Error('FORBIDDEN');
        }
        if (locked.status === 'CANCELLED' || locked.status === 'COMPLETED') {
          throw new Error('INVALID_STATE');
        }

        const [saved] = await tx
          .update(teachingSessions)
          .set({ status: 'CANCELLED', updatedAt: new Date() })
          .where(eq(teachingSessions.id, sessionId))
          .returning();

        const affectedEnrs = await tx
          .select({
            id: sessionEnrollments.id,
            studentUserId: sessionEnrollments.studentUserId,
          })
          .from(sessionEnrollments)
          .where(
            and(
              eq(sessionEnrollments.sessionId, sessionId),
              inArray(sessionEnrollments.status, ['PENDING', 'ACCEPTED'])
            )
          );

        if (affectedEnrs.length > 0) {
          await tx
            .update(sessionEnrollments)
            .set({
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancellationReason: 'تم إلغاء الجلسة من قِبل المدرّب',
              updatedAt: new Date(),
            })
            .where(
              inArray(
                sessionEnrollments.id,
                affectedEnrs.map((e) => e.id)
              )
            );

          const uniqueStudentIds = Array.from(
            new Set(affectedEnrs.map((e) => e.studentUserId))
          );
          await tx.insert(notifications).values(
            uniqueStudentIds.map((studentUid) => ({
              userId: studentUid,
              type: 'BOOKING',
              title: 'إلغاء جلسة تعليمية',
              body: `نعتذر، قام المدرّب بإلغاء جلسة "${saved.title}".`,
              linkUrl: '/dashboard',
            }))
          );
        }

        return saved;
      });

      const [enriched] = await enrichSessionsForViewer([cancelled], req.authUser);
      res.json({ session: enriched });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'الجلسة غير موجودة.' });
        }
        if (error.message === 'FORBIDDEN') {
          return res
            .status(403)
            .json({ error: 'ممنوع: لا تملك صلاحية إلغاء هذه الجلسة.' });
        }
        if (error.message === 'INVALID_STATE') {
          return res
            .status(409)
            .json({ error: 'هذه الجلسة ملغاة أو مكتملة بالفعل.' });
        }
      }
      console.error('Cancel teaching session error:', error);
      res.status(500).json({ error: 'تعذر إلغاء الجلسة.' });
    }
  }
);

router.post(
  '/teaching-sessions/:id/complete',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'معرف الجلسة غير صالح.' });
      }
      const isAdmin = req.authUser!.roles.includes('ADMIN');

      const completed = await db.transaction(async (tx) => {
        const locked = await lockSessionRow(tx, sessionId);
        if (!locked) throw new Error('NOT_FOUND');

        if (locked.teacher_user_id !== req.authUser!.id && !isAdmin) {
          throw new Error('FORBIDDEN');
        }
        if (locked.status === 'CANCELLED' || locked.status === 'COMPLETED') {
          throw new Error('INVALID_STATE');
        }

        const [saved] = await tx
          .update(teachingSessions)
          .set({ status: 'COMPLETED', updatedAt: new Date() })
          .where(eq(teachingSessions.id, sessionId))
          .returning();

        return saved;
      });

      const [enriched] = await enrichSessionsForViewer([completed], req.authUser);
      res.json({ session: enriched });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'الجلسة غير موجودة.' });
        }
        if (error.message === 'FORBIDDEN') {
          return res
            .status(403)
            .json({ error: 'ممنوع: لا تملك صلاحية إنهاء هذه الجلسة.' });
        }
        if (error.message === 'INVALID_STATE') {
          return res
            .status(409)
            .json({ error: 'هذه الجلسة ملغاة أو مكتملة بالفعل.' });
        }
      }
      console.error('Complete teaching session error:', error);
      res.status(500).json({ error: 'تعذر تحديث حالة الجلسة.' });
    }
  }
);

router.get(
  '/teaching-sessions/:id/students',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'معرف الجلسة غير صالح.' });
      }

      const [sessionRow] = await db
        .select()
        .from(teachingSessions)
        .where(eq(teachingSessions.id, sessionId))
        .limit(1);
      if (!sessionRow) {
        return res.status(404).json({ error: 'الجلسة غير موجودة.' });
      }

      const isAdmin = req.authUser!.roles.includes('ADMIN');
      if (sessionRow.teacherUserId !== req.authUser!.id && !isAdmin) {
        return res
          .status(403)
          .json({ error: 'ممنوع: لا يمكنك عرض قائمة طلاب جلسة لست مدرّبها.' });
      }

      const accepted = await db
        .select({
          enrollmentId: sessionEnrollments.id,
          studentUserId: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          stageNameAr: educationalStages.nameAr,
          learningGoal: studentProfiles.learningGoal,
          bio: studentProfiles.bio,
          notes: sessionEnrollments.notes,
          respondedAt: sessionEnrollments.respondedAt,
        })
        .from(sessionEnrollments)
        .innerJoin(users, eq(sessionEnrollments.studentUserId, users.id))
        .leftJoin(
          studentProfiles,
          eq(studentProfiles.userId, sessionEnrollments.studentUserId)
        )
        .leftJoin(
          educationalStages,
          eq(studentProfiles.stageId, educationalStages.id)
        )
        .where(
          and(
            eq(sessionEnrollments.sessionId, sessionId),
            eq(sessionEnrollments.status, 'ACCEPTED')
          )
        )
        .orderBy(asc(sessionEnrollments.respondedAt));

      res.json({ students: accepted });
    } catch (error) {
      console.error('Session accepted students error:', error);
      res.status(500).json({ error: 'تعذر جلب قائمة الطلاب المقبولين.' });
    }
  }
);

// ----------------------------------------------------------------------------
// STUDENT ENROLLMENT / BOOKING REQUESTS & LIFECYCLE
// ----------------------------------------------------------------------------

router.post(
  '/teaching-sessions/:id/enroll',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'معرف الجلسة غير صالح.' });
      }

      const schema = z.object({
        notes: z.string().trim().max(1000).optional().nullable(),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'ملاحظات الطلب غير صالحة.' });
      }

      const studentId = req.authUser!.id;

      const enrollment = await db.transaction(async (tx) => {
        const locked = await lockSessionRow(tx, sessionId);
        if (!locked) throw new Error('NOT_FOUND');

        const [teacherAccount] = await tx
          .select({ accountStatus: users.accountStatus })
          .from(users)
          .where(eq(users.id, locked.teacher_user_id))
          .limit(1);
        if (!teacherAccount || teacherAccount.accountStatus !== 'ACTIVE') {
          throw new Error('NOT_FOUND');
        }

        if (locked.teacher_user_id === studentId) {
          throw new Error('CANNOT_BOOK_SELF');
        }

        const existingForSession = await tx
          .select({
            id: sessionEnrollments.id,
            studentUserId: sessionEnrollments.studentUserId,
            status: sessionEnrollments.status,
          })
          .from(sessionEnrollments)
          .where(eq(sessionEnrollments.sessionId, sessionId));

        const duplicateActive = existingForSession.find(
          (e) =>
            e.studentUserId === studentId &&
            (e.status === 'PENDING' || e.status === 'ACCEPTED')
        );
        if (duplicateActive) {
          throw new Error('DUPLICATE_REQUEST');
        }

        const acceptedCount = existingForSession.filter(
          (e) => e.status === 'ACCEPTED'
        ).length;

        const avail = computeSessionAvailability({
          sessionType: locked.session_type,
          capacity: locked.capacity,
          acceptedCount,
          status: locked.status,
          startTime: locked.start_time,
          registrationDeadline: locked.registration_deadline,
        });

        if (!avail.isRegistrationOpen) {
          throw new Error('REGISTRATION_CLOSED');
        }

        const [created] = await tx
          .insert(sessionEnrollments)
          .values({
            sessionId,
            studentUserId: studentId,
            notes: parsed.data.notes?.trim() || null,
            status: 'PENDING',
          })
          .returning();

        await tx.insert(notifications).values({
          userId: locked.teacher_user_id,
          type: 'BOOKING',
          title:
            locked.session_type === 'ONE_TO_ONE'
              ? 'طلب حجز جلسة فردية جديد'
              : 'طلب انضمام لجلسة جماعية',
          body: `تقدّم ${req.authUser!.fullName} بطلب حجز للجلسة "${locked.title}".`,
          linkUrl: '/dashboard',
        });

        return created;
      });

      res.status(201).json({ enrollment });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'الجلسة غير موجودة.' });
        }
        if (error.message === 'CANNOT_BOOK_SELF') {
          return res
            .status(400)
            .json({ error: 'لا يمكنك تقديم طلب حجز لجلستك الخاصة.' });
        }
        if (error.message === 'DUPLICATE_REQUEST') {
          return res.status(409).json({
            error: 'لديك طلب حجز أو تسجيل نشط بالفعل في هذه الجلسة.',
          });
        }
        if (error.message === 'REGISTRATION_CLOSED') {
          return res.status(409).json({
            error: 'التسجيل مغلق لهذه الجلسة أو اكتمل عدد المقاعد المتاحة.',
          });
        }
      }
      console.error('Session enroll error:', error);
      res.status(500).json({ error: 'تعذر إرسال طلب التسجيل.' });
    }
  }
);

router.get(
  '/session-enrollments/mine',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const uid = req.authUser!.id;
      const statusFilter =
        typeof req.query.status === 'string' ? req.query.status : undefined;

      const myRows = await db
        .select()
        .from(sessionEnrollments)
        .where(eq(sessionEnrollments.studentUserId, uid))
        .orderBy(desc(sessionEnrollments.requestedAt));

      const filtered = statusFilter
        ? myRows.filter((r) => r.status === statusFilter)
        : myRows;

      if (filtered.length === 0) {
        return res.json({ enrollments: [] });
      }

      const sessionIds = Array.from(new Set(filtered.map((r) => r.sessionId)));
      const sessionRows = await db
        .select()
        .from(teachingSessions)
        .where(inArray(teachingSessions.id, sessionIds));

      const enrichedSessions = await enrichSessionsForViewer(
        sessionRows,
        req.authUser
      );
      const sessionMap = new Map(enrichedSessions.map((s) => [s.id, s]));

      const result = filtered
        .map((e) => {
          const session = sessionMap.get(e.sessionId);
          if (!session) return null;
          return {
            id: e.id,
            sessionId: e.sessionId,
            status: e.status as SessionEnrollmentStatus,
            notes: e.notes,
            requestedAt: e.requestedAt,
            respondedAt: e.respondedAt,
            cancelledAt: e.cancelledAt,
            cancellationReason: e.cancellationReason,
            session,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      res.json({ enrollments: result });
    } catch (error) {
      console.error('My session enrollments error:', error);
      res.status(500).json({ error: 'تعذر جلب حجوزات الجلسات.' });
    }
  }
);

router.post(
  '/session-enrollments/:enrollmentId/accept',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'معرف الطلب غير صالح.' });
      }
      const isAdmin = req.authUser!.roles.includes('ADMIN');

      const result = await db.transaction(async (tx) => {
        const [target] = await tx
          .select()
          .from(sessionEnrollments)
          .where(eq(sessionEnrollments.id, enrollmentId))
          .limit(1);
        if (!target) throw new Error('NOT_FOUND');

        const lockedSession = await lockSessionRow(tx, target.sessionId);
        if (!lockedSession) throw new Error('NOT_FOUND');

        if (lockedSession.teacher_user_id !== req.authUser!.id && !isAdmin) {
          throw new Error('FORBIDDEN');
        }

        if (target.status !== 'PENDING') {
          throw new Error('ENROLLMENT_NOT_PENDING');
        }

        if (lockedSession.status !== 'OPEN') {
          throw new Error('SESSION_NOT_OPEN');
        }

        if (Date.now() >= new Date(lockedSession.start_time).getTime()) {
          throw new Error('SESSION_STARTED');
        }

        const allSessionEnrs = await tx
          .select()
          .from(sessionEnrollments)
          .where(eq(sessionEnrollments.sessionId, lockedSession.id));

        const acceptedCount = allSessionEnrs.filter(
          (e) => e.status === 'ACCEPTED'
        ).length;

        const effectiveCap =
          lockedSession.session_type === 'ONE_TO_ONE'
            ? 1
            : lockedSession.capacity;

        if (acceptedCount >= effectiveCap) {
          await tx
            .update(teachingSessions)
            .set({ status: 'FULL', updatedAt: new Date() })
            .where(eq(teachingSessions.id, lockedSession.id));
          throw new Error('CAPACITY_REACHED');
        }

        const now = new Date();
        const [acceptedRow] = await tx
          .update(sessionEnrollments)
          .set({
            status: 'ACCEPTED',
            respondedAt: now,
            updatedAt: now,
          })
          .where(eq(sessionEnrollments.id, enrollmentId))
          .returning();

        const newAcceptedCount = acceptedCount + 1;
        const shouldMarkFull = newAcceptedCount >= effectiveCap;

        if (shouldMarkFull) {
          await tx
            .update(teachingSessions)
            .set({ status: 'FULL', updatedAt: now })
            .where(eq(teachingSessions.id, lockedSession.id));
        }

        // Notify the accepted student
        await tx.insert(notifications).values({
          userId: target.studentUserId,
          type: 'BOOKING',
          title: 'تم قبول طلب الجلسة التعليمية',
          body: `وافق المدرّب على طلبك للانضمام إلى جلسة "${lockedSession.title}".`,
          linkUrl: '/dashboard',
        });

        // For ONE_TO_ONE slots, safely auto-reject competing pending requests
        if (lockedSession.session_type === 'ONE_TO_ONE') {
          const competingPending = allSessionEnrs.filter(
            (e) => e.id !== enrollmentId && e.status === 'PENDING'
          );
          if (competingPending.length > 0) {
            await tx
              .update(sessionEnrollments)
              .set({
                status: 'REJECTED',
                respondedAt: now,
                updatedAt: now,
              })
              .where(
                inArray(
                  sessionEnrollments.id,
                  competingPending.map((e) => e.id)
                )
              );

            const competingStudentIds = Array.from(
              new Set(competingPending.map((e) => e.studentUserId))
            );
            await tx.insert(notifications).values(
              competingStudentIds.map((studentUid) => ({
                userId: studentUid,
                type: 'BOOKING',
                title: 'لم يعد الموعد الفردي متاحاً',
                body: `تم حجز الموعد الفردي "${lockedSession.title}" لطالب آخر. يمكنك اختيار موعد آخر متاح.`,
                linkUrl: '/providers',
              }))
            );
          }
        }

        return {
          enrollment: acceptedRow,
          sessionStatus: shouldMarkFull ? 'FULL' : 'OPEN',
          acceptedCount: newAcceptedCount,
          remainingSeats: Math.max(0, effectiveCap - newAcceptedCount),
        };
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'طلب التسجيل غير موجود.' });
        }
        if (error.message === 'FORBIDDEN') {
          return res
            .status(403)
            .json({ error: 'ممنوع: لا تملك صلاحية إدارة طلبات هذه الجلسة.' });
        }
        if (error.message === 'ENROLLMENT_NOT_PENDING') {
          return res
            .status(409)
            .json({ error: 'هذا الطلب لم يعد قيد الانتظار.' });
        }
        if (
          error.message === 'SESSION_NOT_OPEN' ||
          error.message === 'CAPACITY_REACHED'
        ) {
          return res.status(409).json({
            error: 'اكتملت سعة الجلسة أو لم تعد مفتوحة لقبول طلاب جدد.',
          });
        }
        if (error.message === 'SESSION_STARTED') {
          return res
            .status(409)
            .json({ error: 'انتهى وقت بدء الجلسة ولا يمكن قبول طلبات جديدة.' });
        }
      }
      console.error('Accept enrollment error:', error);
      res.status(500).json({ error: 'تعذر قبول الطلب.' });
    }
  }
);

router.post(
  '/session-enrollments/:enrollmentId/reject',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'معرف الطلب غير صالح.' });
      }
      const isAdmin = req.authUser!.roles.includes('ADMIN');

      const result = await db.transaction(async (tx) => {
        const [target] = await tx
          .select()
          .from(sessionEnrollments)
          .where(eq(sessionEnrollments.id, enrollmentId))
          .limit(1);
        if (!target) throw new Error('NOT_FOUND');

        const lockedSession = await lockSessionRow(tx, target.sessionId);
        if (!lockedSession) throw new Error('NOT_FOUND');

        if (lockedSession.teacher_user_id !== req.authUser!.id && !isAdmin) {
          throw new Error('FORBIDDEN');
        }

        if (target.status !== 'PENDING' && target.status !== 'ACCEPTED') {
          throw new Error('INVALID_STATE');
        }

        const wasAccepted = target.status === 'ACCEPTED';
        const now = new Date();
        const [rejectedRow] = await tx
          .update(sessionEnrollments)
          .set({
            status: 'REJECTED',
            respondedAt: now,
            updatedAt: now,
          })
          .where(eq(sessionEnrollments.id, enrollmentId))
          .returning();

        let nextSessionStatus = lockedSession.status;
        if (
          wasAccepted &&
          lockedSession.status === 'FULL' &&
          Date.now() < new Date(lockedSession.start_time).getTime()
        ) {
          const acceptedRows = await tx
            .select({ id: sessionEnrollments.id })
            .from(sessionEnrollments)
            .where(
              and(
                eq(sessionEnrollments.sessionId, lockedSession.id),
                eq(sessionEnrollments.status, 'ACCEPTED')
              )
            );
          const avail = computeSessionAvailability({
            sessionType: lockedSession.session_type,
            capacity: lockedSession.capacity,
            acceptedCount: acceptedRows.length,
            status: lockedSession.status,
            startTime: lockedSession.start_time,
            registrationDeadline: lockedSession.registration_deadline,
          });
          nextSessionStatus = avail.nextStatus;
          if (nextSessionStatus !== lockedSession.status) {
            await tx
              .update(teachingSessions)
              .set({ status: nextSessionStatus, updatedAt: now })
              .where(eq(teachingSessions.id, lockedSession.id));
          }
        }

        await tx.insert(notifications).values({
          userId: target.studentUserId,
          type: 'BOOKING',
          title: 'تحديث حول طلب الجلسة',
          body: `تم رفض طلبك للانضمام إلى جلسة "${lockedSession.title}".`,
          linkUrl: '/providers',
        });

        return {
          enrollment: rejectedRow,
          sessionStatus: nextSessionStatus,
        };
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'طلب التسجيل غير موجود.' });
        }
        if (error.message === 'FORBIDDEN') {
          return res
            .status(403)
            .json({ error: 'ممنوع: لا تملك صلاحية رفض طلبات هذه الجلسة.' });
        }
        if (error.message === 'INVALID_STATE') {
          return res
            .status(409)
            .json({ error: 'هذا الطلب مرفوض أو ملغى بالفعل.' });
        }
      }
      console.error('Reject enrollment error:', error);
      res.status(500).json({ error: 'تعذر رفض الطلب.' });
    }
  }
);

router.post(
  '/session-enrollments/:enrollmentId/cancel',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
        return res.status(400).json({ error: 'معرف الطلب غير صالح.' });
      }
      const schema = z.object({
        reason: z.string().trim().max(300).optional().nullable(),
      });
      const parsed = schema.safeParse(req.body || {});
      const isAdmin = req.authUser!.roles.includes('ADMIN');

      const result = await db.transaction(async (tx) => {
        const [target] = await tx
          .select()
          .from(sessionEnrollments)
          .where(eq(sessionEnrollments.id, enrollmentId))
          .limit(1);
        if (!target) throw new Error('NOT_FOUND');

        if (target.studentUserId !== req.authUser!.id && !isAdmin) {
          throw new Error('FORBIDDEN');
        }

        const lockedSession = await lockSessionRow(tx, target.sessionId);
        if (!lockedSession) throw new Error('NOT_FOUND');

        const cancelCheck = canCancelSessionEnrollment({
          enrollmentStatus: target.status as SessionEnrollmentStatus,
          sessionStatus: lockedSession.status,
          startTime: lockedSession.start_time,
        });
        if (!cancelCheck.allowed) {
          throw new Error(`RULE:${cancelCheck.reason}`);
        }

        const wasAccepted = target.status === 'ACCEPTED';
        const now = new Date();
        const [cancelledRow] = await tx
          .update(sessionEnrollments)
          .set({
            status: 'CANCELLED',
            cancelledAt: now,
            cancellationReason: parsed.success
              ? parsed.data.reason?.trim() || null
              : null,
            updatedAt: now,
          })
          .where(eq(sessionEnrollments.id, enrollmentId))
          .returning();

        let nextSessionStatus = lockedSession.status;
        if (wasAccepted && lockedSession.status === 'FULL') {
          const acceptedRows = await tx
            .select({ id: sessionEnrollments.id })
            .from(sessionEnrollments)
            .where(
              and(
                eq(sessionEnrollments.sessionId, lockedSession.id),
                eq(sessionEnrollments.status, 'ACCEPTED')
              )
            );
          const avail = computeSessionAvailability({
            sessionType: lockedSession.session_type,
            capacity: lockedSession.capacity,
            acceptedCount: acceptedRows.length,
            status: lockedSession.status,
            startTime: lockedSession.start_time,
            registrationDeadline: lockedSession.registration_deadline,
          });
          nextSessionStatus = avail.nextStatus;
          if (nextSessionStatus !== lockedSession.status) {
            await tx
              .update(teachingSessions)
              .set({ status: nextSessionStatus, updatedAt: now })
              .where(eq(teachingSessions.id, lockedSession.id));
          }
        }

        await tx.insert(notifications).values({
          userId: lockedSession.teacher_user_id,
          type: 'BOOKING',
          title: 'إلغاء حجز من قِبل الطالب',
          body: `قام ${req.authUser!.fullName} بإلغاء ${
            wasAccepted ? 'حجزه المقبول' : 'طلبه'
          } في جلسة "${lockedSession.title}".`,
          linkUrl: '/dashboard',
        });

        return {
          enrollment: cancelledRow,
          sessionStatus: nextSessionStatus,
        };
      });

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'NOT_FOUND') {
          return res.status(404).json({ error: 'الطلب غير موجود.' });
        }
        if (error.message === 'FORBIDDEN') {
          return res
            .status(403)
            .json({ error: 'ممنوع: لا يمكنك إلغاء حجز طالب آخر.' });
        }
        if (error.message.startsWith('RULE:')) {
          return res.status(409).json({ error: error.message.slice(5) });
        }
      }
      console.error('Cancel enrollment error:', error);
      res.status(500).json({ error: 'تعذر إلغاء الحجز.' });
    }
  }
);

// ----------------------------------------------------------------------------
// WEEKLY RECURRING TEACHER AVAILABILITY
// ----------------------------------------------------------------------------

router.get(
  '/teacher-availability/mine',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const slots = await db
        .select()
        .from(teacherAvailability)
        .where(eq(teacherAvailability.teacherUserId, req.authUser!.id))
        .orderBy(
          asc(teacherAvailability.dayOfWeek),
          asc(teacherAvailability.startTime)
        );
      res.json({ slots });
    } catch (error) {
      console.error('Fetch teacher availability error:', error);
      res.status(500).json({ error: 'تعذر جلب جدول التفرغ الأسبوعي.' });
    }
  }
);

router.put(
  '/teacher-availability',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const parsed = availabilityScheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error:
            parsed.error.issues[0]?.message || 'بيانات جدول التفرغ غير صالحة.',
        });
      }

      const slots = parsed.data.slots;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (timeToMinutes(s.endTime) <= timeToMinutes(s.startTime)) {
          return res.status(400).json({
            error: 'وقت نهاية التفرغ يجب أن يكون بعد وقت البداية.',
          });
        }
        for (let j = i + 1; j < slots.length; j++) {
          const other = slots[j];
          if (
            s.dayOfWeek === other.dayOfWeek &&
            s.isActive &&
            other.isActive &&
            timeToMinutes(s.startTime) < timeToMinutes(other.endTime) &&
            timeToMinutes(s.endTime) > timeToMinutes(other.startTime)
          ) {
            return res.status(400).json({
              error: 'يوجد تعارض بين فترتي تفرغ في نفس اليوم.',
            });
          }
        }
      }

      const uid = req.authUser!.id;
      const saved = await db.transaction(async (tx) => {
        await tx
          .delete(teacherAvailability)
          .where(eq(teacherAvailability.teacherUserId, uid));
        if (slots.length === 0) return [];
        return tx
          .insert(teacherAvailability)
          .values(
            slots.map((s) => ({
              teacherUserId: uid,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              isActive: s.isActive,
            }))
          )
          .returning();
      });

      res.json({ slots: saved });
    } catch (error) {
      console.error('Save teacher availability error:', error);
      res.status(500).json({ error: 'تعذر حفظ جدول التفرغ الأسبوعي.' });
    }
  }
);

export default router;
