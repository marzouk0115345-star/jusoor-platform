import crypto from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  baccalaureatePathways,
  centerAttendance,
  centerBranches,
  centerMembers,
  centerRooms,
  centers,
  centerStudentPayments,
  centerStudents,
  centerTeacherAssignments,
  courseLessons,
  courses,
  educationalGrades,
  educationalStages,
  educationalSystems,
  enrollments,
  fields,
  payments,
  progress,
  providerProfiles,
  reviews,
  roles,
  secondaryDivisions,
  studentProfiles,
  subjects,
  userRoles,
  users,
} from '../../db/schema.ts';
import { hashPassword, requireAuth, type AuthRequest } from '../auth.ts';
import {
  canManageCenterResource,
  DEFAULT_CENTER_BOOKING_POLICIES,
  DEFAULT_CENTER_NOTIFICATION_SETTINGS,
  DEFAULT_CENTER_WORKING_HOURS,
  isValidCalendarDate,
  MAX_COURSE_IMAGE_BYTES,
  resolveCourseFieldDisplay,
  validateCoordinates,
  validateCurriculumContextCombination,
  validateManualCourseField,
  type CenterPermissionKey,
} from '../../lib/domain.ts';
import {
  deleteUploadedImageByUrl,
  isAllowedStoredImageUrl,
  saveValidatedImageUpload,
} from '../uploadStorage.ts';
import { resolveAnchorFieldId } from '../courseHelpers.ts';

const router = Router();

interface AuthorizedCenterContext {
  center: typeof centers.$inferSelect;
  membership: typeof centerMembers.$inferSelect | null;
  isOwner: boolean;
  isAdmin: boolean;
}

async function resolveAuthorizedCenter(
  req: AuthRequest,
  centerId: number,
  requiredPermission: CenterPermissionKey
): Promise<
  | { ok: true; ctx: AuthorizedCenterContext }
  | { ok: false; status: number; error: string }
> {
  if (!Number.isInteger(centerId) || centerId <= 0) {
    return { ok: false, status: 400, error: 'معرف المركز التعليمي غير صالح.' };
  }
  if (!req.authUser) {
    return { ok: false, status: 401, error: 'يرجى تسجيل الدخول أولاً.' };
  }

  const [centerRow] = await db
    .select()
    .from(centers)
    .where(eq(centers.id, centerId))
    .limit(1);

  if (!centerRow) {
    return { ok: false, status: 404, error: 'المركز التعليمي غير موجود.' };
  }

  const [membership] = await db
    .select()
    .from(centerMembers)
    .where(
      and(
        eq(centerMembers.centerId, centerId),
        eq(centerMembers.userId, req.authUser.id)
      )
    )
    .limit(1);

  const isAdmin = req.authUser.roles.includes('ADMIN');
  const isOwner = centerRow.ownerUserId === req.authUser.id;

  const allowed = canManageCenterResource({
    isAdmin,
    ownerUserId: centerRow.ownerUserId,
    callerUserId: req.authUser.id,
    membership: membership
      ? {
          memberRole: membership.memberRole,
          status: membership.status,
          permissionsJson: membership.permissionsJson,
        }
      : null,
    requiredPermission,
  });

  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: 'لا تملك صلاحية الوصول أو إدارة هذا المركز التعليمي.',
    };
  }

  return {
    ok: true,
    ctx: {
      center: centerRow,
      membership: membership || null,
      isOwner,
      isAdmin,
    },
  };
}

function withCenterDefaults(center: typeof centers.$inferSelect) {
  return {
    ...center,
    latitude:
      center.latitude !== null && center.latitude !== undefined
        ? Number(center.latitude)
        : null,
    longitude:
      center.longitude !== null && center.longitude !== undefined
        ? Number(center.longitude)
        : null,
    workingHoursJson:
      center.workingHoursJson && center.workingHoursJson.length === 7
        ? center.workingHoursJson
        : DEFAULT_CENTER_WORKING_HOURS,
    bookingPoliciesJson:
      center.bookingPoliciesJson || DEFAULT_CENTER_BOOKING_POLICIES,
    notificationSettingsJson:
      center.notificationSettingsJson || DEFAULT_CENTER_NOTIFICATION_SETTINGS,
  };
}

async function validateCurriculumIds(input: {
  systemId?: number | null;
  gradeId?: number | null;
  divisionId?: number | null;
  pathwayId?: number | null;
}): Promise<string | null> {
  if (!input.systemId && !input.gradeId && !input.divisionId && !input.pathwayId) {
    return null;
  }
  if (!input.systemId || !input.gradeId) {
    if (input.divisionId || input.pathwayId) {
      return 'يرجى تحديد النظام والصف الدراسي مع الشعبة أو المسار.';
    }
    return null;
  }

  const [[sys], [grade]] = await Promise.all([
    db
      .select()
      .from(educationalSystems)
      .where(eq(educationalSystems.id, input.systemId))
      .limit(1),
    db
      .select()
      .from(educationalGrades)
      .where(eq(educationalGrades.id, input.gradeId))
      .limit(1),
  ]);

  if (!sys || !grade || grade.systemId !== sys.id) {
    return 'النظام التعليمي أو الصف الدراسي المختار غير متطابق.';
  }

  let divisionBelongsToGrade = true;
  if (input.divisionId) {
    const [div] = await db
      .select()
      .from(secondaryDivisions)
      .where(eq(secondaryDivisions.id, input.divisionId))
      .limit(1);
    divisionBelongsToGrade = Boolean(div && div.gradeId === grade.id);
  }

  let pathwayBelongsToGrade = true;
  if (input.pathwayId) {
    const [pw] = await db
      .select()
      .from(baccalaureatePathways)
      .where(eq(baccalaureatePathways.id, input.pathwayId))
      .limit(1);
    pathwayBelongsToGrade = Boolean(pw && pw.gradeId === grade.id);
  }

  const combo = validateCurriculumContextCombination({
    systemCode: sys.code,
    gradeNumber: grade.gradeNumber,
    divisionId: input.divisionId ?? null,
    pathwayId: input.pathwayId ?? null,
    divisionBelongsToGrade,
    pathwayBelongsToGrade,
  });

  return combo.valid ? null : combo.reason || 'سياق المنهج غير صالح.';
}

async function ensureStudentBelongsToCenter(
  centerId: number,
  studentUserId: number
): Promise<boolean> {
  const [cs] = await db
    .select({ id: centerStudents.id })
    .from(centerStudents)
    .where(
      and(
        eq(centerStudents.centerId, centerId),
        eq(centerStudents.studentUserId, studentUserId)
      )
    )
    .limit(1);
  if (cs) return true;

  const [enr] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(courses.centerId, centerId),
        eq(enrollments.studentUserId, studentUserId)
      )
    )
    .limit(1);
  return Boolean(enr);
}

// ============================================================================
// 1. CENTER LISTING & OVERVIEW
// ============================================================================

router.get('/center-dashboard/my-centers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;
    const isAdmin = req.authUser!.roles.includes('ADMIN');

    const allCenters = await db
      .select()
      .from(centers)
      .orderBy(asc(centers.id));

    if (isAdmin) {
      return res.json({
        centers: allCenters.map((c) => ({
          ...withCenterDefaults(c),
          callerRole: c.ownerUserId === uid ? 'OWNER' : 'ADMIN',
          callerPermissions: [
            'MANAGE_CENTER',
            'MANAGE_STAFF',
            'MANAGE_STUDENTS',
            'MANAGE_COURSES',
            'MANAGE_SETTINGS',
            'VIEW_REPORTS',
            'VIEW_ENROLLMENTS',
          ],
          isOwner: c.ownerUserId === uid || isAdmin,
        })),
      });
    }

    const myMemberships = await db
      .select()
      .from(centerMembers)
      .where(
        and(eq(centerMembers.userId, uid), eq(centerMembers.status, 'ACTIVE'))
      );
    const membershipByCenter = new Map(
      myMemberships.map((m) => [m.centerId, m])
    );

    const accessible = allCenters
      .filter((c) => {
        if (c.ownerUserId === uid) return true;
        const m = membershipByCenter.get(c.id);
        if (!m) return false;
        return (
          m.memberRole === 'OWNER' ||
          m.memberRole === 'MANAGER' ||
          m.permissionsJson.length > 0
        );
      })
      .map((c) => {
        const m = membershipByCenter.get(c.id);
        const isOwner = c.ownerUserId === uid;
        return {
          ...withCenterDefaults(c),
          callerRole: isOwner ? 'OWNER' : m?.memberRole || 'STAFF',
          callerPermissions: isOwner
            ? [
                'MANAGE_CENTER',
                'MANAGE_STAFF',
                'MANAGE_STUDENTS',
                'MANAGE_COURSES',
                'MANAGE_SETTINGS',
                'VIEW_REPORTS',
                'VIEW_ENROLLMENTS',
              ]
            : m?.permissionsJson || [],
          isOwner,
        };
      });

    res.json({ centers: accessible });
  } catch (error) {
    console.error('Center dashboard my-centers error:', error);
    res.status(500).json({ error: 'تعذر جلب المراكز التعليمية الخاصة بك.' });
  }
});

router.get(
  '/center-dashboard/:centerId/overview',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'VIEW_REPORTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [
        memberRows,
        centerCourses,
        centerStudentRows,
        branchRows,
        roomRows,
        attendanceRows,
        centerPaymentRows,
      ] = await Promise.all([
        db
          .select({
            id: centerMembers.id,
            userId: centerMembers.userId,
            memberRole: centerMembers.memberRole,
            status: centerMembers.status,
            fullName: users.fullName,
            jobTitle: centerMembers.jobTitle,
          })
          .from(centerMembers)
          .innerJoin(users, eq(centerMembers.userId, users.id))
          .where(eq(centerMembers.centerId, centerId)),
        db
          .select({
            id: courses.id,
            title: courses.title,
            status: courses.status,
            enrollmentStatus: courses.enrollmentStatus,
            price: courses.price,
            thumbnailUrl: courses.thumbnailUrl,
            instructorName: users.fullName,
            createdAt: courses.createdAt,
          })
          .from(courses)
          .innerJoin(users, eq(courses.instructorUserId, users.id))
          .where(eq(courses.centerId, centerId))
          .orderBy(desc(courses.createdAt)),
        db
          .select({
            id: centerStudents.id,
            studentUserId: centerStudents.studentUserId,
            status: centerStudents.status,
          })
          .from(centerStudents)
          .where(eq(centerStudents.centerId, centerId)),
        db
          .select()
          .from(centerBranches)
          .where(eq(centerBranches.centerId, centerId))
          .orderBy(desc(centerBranches.isMain), asc(centerBranches.id)),
        db
          .select()
          .from(centerRooms)
          .where(eq(centerRooms.centerId, centerId)),
        db
          .select({
            id: centerAttendance.id,
            status: centerAttendance.status,
            attendanceDate: centerAttendance.attendanceDate,
          })
          .from(centerAttendance)
          .where(eq(centerAttendance.centerId, centerId)),
        db
          .select({
            id: centerStudentPayments.id,
            amount: centerStudentPayments.amount,
            status: centerStudentPayments.status,
          })
          .from(centerStudentPayments)
          .where(eq(centerStudentPayments.centerId, centerId)),
      ]);

      const courseIds = centerCourses.map((c) => c.id);
      const courseEnrollmentRows =
        courseIds.length > 0
          ? await db
              .select({
                id: enrollments.id,
                courseId: enrollments.courseId,
                studentUserId: enrollments.studentUserId,
                status: enrollments.status,
                enrolledAt: enrollments.enrolledAt,
                studentName: users.fullName,
                courseTitle: courses.title,
              })
              .from(enrollments)
              .innerJoin(users, eq(enrollments.studentUserId, users.id))
              .innerJoin(courses, eq(enrollments.courseId, courses.id))
              .where(inArray(enrollments.courseId, courseIds))
              .orderBy(desc(enrollments.enrolledAt))
          : [];

      const uniqueStudentIds = new Set<number>();
      for (const s of centerStudentRows) uniqueStudentIds.add(s.studentUserId);
      for (const e of courseEnrollmentRows) uniqueStudentIds.add(e.studentUserId);

      const teachersList = memberRows.filter(
        (m) => m.memberRole === 'INSTRUCTOR' || m.memberRole === 'OWNER'
      );
      const activeTeachersCount = memberRows.filter(
        (m) => m.memberRole === 'INSTRUCTOR' && m.status === 'ACTIVE'
      ).length;
      const inactiveTeachersCount = memberRows.filter(
        (m) => m.memberRole === 'INSTRUCTOR' && m.status !== 'ACTIVE'
      ).length;

      const totalCollectedPayments = centerPaymentRows
        .filter((p) => p.status === 'PAID' || p.status === 'PARTIAL')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const presentCount = attendanceRows.filter((a) => a.status === 'PRESENT').length;
      const attendanceRate =
        attendanceRows.length > 0
          ? Math.round((presentCount / attendanceRows.length) * 100)
          : 100;

      res.json({
        center: withCenterDefaults(auth.ctx.center),
        isOwner: auth.ctx.isOwner || auth.ctx.isAdmin,
        stats: {
          activeTeachersCount,
          inactiveTeachersCount,
          totalStaffCount: memberRows.length,
          studentsCount: uniqueStudentIds.size,
          coursesCount: centerCourses.length,
          publishedCoursesCount: centerCourses.filter((c) => c.status === 'PUBLISHED')
            .length,
          totalEnrollments: courseEnrollmentRows.length,
          branchesCount: branchRows.length,
          activeBranchesCount: branchRows.filter((b) => b.isActive).length,
          roomsCount: roomRows.length,
          activeRoomsCount: roomRows.filter((r) => r.isActive).length,
          attendanceRate,
          totalCollectedPayments: Number(totalCollectedPayments.toFixed(2)),
        },
        recentEnrollments: courseEnrollmentRows.slice(0, 6),
        recentCourses: centerCourses.slice(0, 5),
        branches: branchRows,
        teachersPreview: teachersList.slice(0, 6),
      });
    } catch (error) {
      console.error('Center overview error:', error);
      res.status(500).json({ error: 'تعذر تحميل ملخص لوحة المركز.' });
    }
  }
);

// ============================================================================
// 2. TEACHERS MANAGEMENT (CENTER-SCOPED)
// ============================================================================

router.get(
  '/center-dashboard/:centerId/teachers',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STAFF');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [memberRows, assignmentRows, centerCourses] = await Promise.all([
        db
          .select({
            id: centerMembers.id,
            centerId: centerMembers.centerId,
            userId: centerMembers.userId,
            memberRole: centerMembers.memberRole,
            jobTitle: centerMembers.jobTitle,
            employmentType: centerMembers.employmentType,
            permissionsJson: centerMembers.permissionsJson,
            status: centerMembers.status,
            notes: centerMembers.notes,
            joinedAt: centerMembers.joinedAt,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
            accountStatus: users.accountStatus,
            headline: providerProfiles.headline,
            yearsExperience: providerProfiles.yearsExperience,
            ratingAvg: providerProfiles.ratingAvg,
          })
          .from(centerMembers)
          .innerJoin(users, eq(centerMembers.userId, users.id))
          .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
          .where(eq(centerMembers.centerId, centerId))
          .orderBy(asc(centerMembers.id)),
        db
          .select({
            id: centerTeacherAssignments.id,
            memberId: centerTeacherAssignments.memberId,
            teacherUserId: centerTeacherAssignments.teacherUserId,
            subjectId: centerTeacherAssignments.subjectId,
            subjectNameAr: subjects.nameAr,
            stageId: centerTeacherAssignments.stageId,
            stageNameAr: educationalStages.nameAr,
            systemId: centerTeacherAssignments.systemId,
            systemNameAr: educationalSystems.nameAr,
            gradeId: centerTeacherAssignments.gradeId,
            gradeNameAr: educationalGrades.nameAr,
            divisionId: centerTeacherAssignments.divisionId,
            divisionNameAr: secondaryDivisions.nameAr,
            pathwayId: centerTeacherAssignments.pathwayId,
            pathwayNameAr: baccalaureatePathways.nameAr,
            notes: centerTeacherAssignments.notes,
            isActive: centerTeacherAssignments.isActive,
          })
          .from(centerTeacherAssignments)
          .innerJoin(subjects, eq(centerTeacherAssignments.subjectId, subjects.id))
          .innerJoin(
            educationalStages,
            eq(centerTeacherAssignments.stageId, educationalStages.id)
          )
          .leftJoin(
            educationalSystems,
            eq(centerTeacherAssignments.systemId, educationalSystems.id)
          )
          .leftJoin(
            educationalGrades,
            eq(centerTeacherAssignments.gradeId, educationalGrades.id)
          )
          .leftJoin(
            secondaryDivisions,
            eq(centerTeacherAssignments.divisionId, secondaryDivisions.id)
          )
          .leftJoin(
            baccalaureatePathways,
            eq(centerTeacherAssignments.pathwayId, baccalaureatePathways.id)
          )
          .where(eq(centerTeacherAssignments.centerId, centerId))
          .orderBy(asc(centerTeacherAssignments.id)),
        db
          .select({
            id: courses.id,
            title: courses.title,
            instructorUserId: courses.instructorUserId,
            status: courses.status,
          })
          .from(courses)
          .where(eq(courses.centerId, centerId)),
      ]);

      const courseIds = centerCourses.map((c) => c.id);
      const enrollmentRows =
        courseIds.length > 0
          ? await db
              .select({
                courseId: enrollments.courseId,
                studentUserId: enrollments.studentUserId,
              })
              .from(enrollments)
              .where(inArray(enrollments.courseId, courseIds))
          : [];

      const studentsByCourse = new Map<number, Set<number>>();
      for (const e of enrollmentRows) {
        const set = studentsByCourse.get(e.courseId) || new Set<number>();
        set.add(e.studentUserId);
        studentsByCourse.set(e.courseId, set);
      }

      const teachers = memberRows.map((m) => {
        const taughtCourses = centerCourses.filter(
          (c) => c.instructorUserId === m.userId
        );
        const assignedStudentIds = new Set<number>();
        for (const c of taughtCourses) {
          const sSet = studentsByCourse.get(c.id);
          if (sSet) {
            for (const sid of sSet) assignedStudentIds.add(sid);
          }
        }
        const assignments = assignmentRows.filter(
          (a) => a.memberId === m.id && a.isActive
        );
        return {
          ...m,
          coursesCount: taughtCourses.length,
          studentsCount: assignedStudentIds.size,
          courses: taughtCourses,
          assignments,
        };
      });

      res.json({ teachers });
    } catch (error) {
      console.error('List center teachers error:', error);
      res.status(500).json({ error: 'تعذر جلب معلّمي المركز.' });
    }
  }
);

const teacherAssignmentInputSchema = z.object({
  subjectId: z.number().int().positive(),
  stageId: z.number().int().positive(),
  systemId: z.number().int().positive().nullable().optional(),
  gradeId: z.number().int().positive().nullable().optional(),
  divisionId: z.number().int().positive().nullable().optional(),
  pathwayId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(300).optional(),
});

router.post(
  '/center-dashboard/:centerId/teachers',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STAFF');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const schema = z.object({
        fullName: z.string().trim().min(2, 'اسم المعلّم مطلوب').max(120).optional(),
        email: z.string().trim().email('البريد الإلكتروني غير صالح'),
        phone: z.string().trim().max(40).optional(),
        password: z.string().min(8).optional(),
        jobTitle: z
          .string()
          .trim()
          .min(2, 'المسمى الوظيفي أو التخصص مطلوب')
          .max(140),
        employmentType: z
          .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE'])
          .default('PART_TIME'),
        memberRole: z.enum(['INSTRUCTOR', 'MANAGER', 'STAFF']).default('INSTRUCTOR'),
        notes: z.string().trim().max(500).optional(),
        assignments: z.array(teacherAssignmentInputSchema).default([]),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات المعلّم غير صالحة.',
        });
      }

      const d = parsed.data;
      for (const a of d.assignments) {
        const errMsg = await validateCurriculumIds(a);
        if (errMsg) {
          return res.status(400).json({ error: errMsg });
        }
      }

      const emailLower = d.email.toLowerCase();
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (!existingUser && !d.fullName) {
        return res.status(400).json({
          error: 'يرجى إدخال الاسم الكامل عند تسجيل معلّم جديد غير مسجل مسبقاً.',
        });
      }

      if (existingUser && existingUser.accountStatus !== 'ACTIVE') {
        return res.status(400).json({
          error: 'هذا الحساب موقوف على مستوى المنصة ولا يمكن إضافته.',
        });
      }

      const result = await db.transaction(async (tx) => {
        let userId: number;
        if (existingUser) {
          userId = existingUser.id;
          if (d.phone && !existingUser.phone) {
            await tx
              .update(users)
              .set({ phone: d.phone, updatedAt: new Date() })
              .where(eq(users.id, userId));
          }
        } else {
          const passwordHash = hashPassword(
            d.password || crypto.randomBytes(12).toString('hex')
          );
          const [createdUser] = await tx
            .insert(users)
            .values({
              email: emailLower,
              passwordHash,
              fullName: d.fullName!,
              phone: d.phone || null,
              emailVerified: true,
              accountStatus: 'ACTIVE',
              isDemo: false,
            })
            .returning();
          userId = createdUser.id;
        }

        const [teacherRole] = await tx
          .select()
          .from(roles)
          .where(eq(roles.code, d.memberRole === 'INSTRUCTOR' ? 'TEACHER' : 'CENTER_STAFF'))
          .limit(1);
        if (teacherRole) {
          await tx
            .insert(userRoles)
            .values({ userId, roleId: teacherRole.id })
            .onConflictDoNothing();
        }

        if (d.memberRole === 'INSTRUCTOR') {
          const [pp] = await tx
            .select({ id: providerProfiles.id })
            .from(providerProfiles)
            .where(eq(providerProfiles.userId, userId))
            .limit(1);
          if (!pp) {
            await tx.insert(providerProfiles).values({
              userId,
              providerType: 'TEACHER',
              headline: d.jobTitle,
              bio: `معلّم منتسب إلى ${auth.ctx.center.name}.`,
              verificationStatus: 'VERIFIED',
            });
          }
        }

        const defaultPermissions =
          d.memberRole === 'MANAGER'
            ? ['MANAGE_STAFF', 'MANAGE_STUDENTS', 'MANAGE_COURSES', 'VIEW_REPORTS']
            : d.memberRole === 'INSTRUCTOR'
            ? ['MANAGE_COURSES', 'VIEW_ENROLLMENTS']
            : ['VIEW_ENROLLMENTS', 'MANAGE_STUDENTS'];

        const [member] = await tx
          .insert(centerMembers)
          .values({
            centerId,
            userId,
            memberRole: d.memberRole,
            jobTitle: d.jobTitle,
            employmentType: d.employmentType,
            permissionsJson: defaultPermissions,
            status: 'ACTIVE',
            notes: d.notes || null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [centerMembers.centerId, centerMembers.userId],
            set: {
              memberRole: d.memberRole,
              jobTitle: d.jobTitle,
              employmentType: d.employmentType,
              status: 'ACTIVE',
              notes: d.notes || null,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (d.assignments.length > 0) {
          await tx
            .delete(centerTeacherAssignments)
            .where(
              and(
                eq(centerTeacherAssignments.centerId, centerId),
                eq(centerTeacherAssignments.memberId, member.id)
              )
            );
          await tx.insert(centerTeacherAssignments).values(
            d.assignments.map((a) => ({
              centerId,
              memberId: member.id,
              teacherUserId: userId,
              subjectId: a.subjectId,
              stageId: a.stageId,
              systemId: a.systemId ?? null,
              gradeId: a.gradeId ?? null,
              divisionId: a.divisionId ?? null,
              pathwayId: a.pathwayId ?? null,
              notes: a.notes || null,
              isActive: true,
            }))
          );
        }

        return member;
      });

      res.status(201).json({ member: result });
    } catch (error) {
      console.error('Add center teacher error:', error);
      res.status(500).json({ error: 'تعذر إضافة المعلّم إلى المركز.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/teachers/:memberId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const memberId = Number(req.params.memberId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STAFF');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      if (!Number.isInteger(memberId) || memberId <= 0) {
        return res.status(400).json({ error: 'معرف العضو غير صالح.' });
      }

      const schema = z.object({
        fullName: z.string().trim().min(2).max(120).optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        jobTitle: z.string().trim().min(2).max(140).optional(),
        employmentType: z
          .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE'])
          .optional(),
        memberRole: z.enum(['INSTRUCTOR', 'MANAGER', 'STAFF']).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        notes: z.string().trim().max(500).nullable().optional(),
        assignments: z.array(teacherAssignmentInputSchema).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات التحديث غير صالحة.',
        });
      }

      const [targetMember] = await db
        .select()
        .from(centerMembers)
        .where(
          and(
            eq(centerMembers.id, memberId),
            eq(centerMembers.centerId, centerId)
          )
        )
        .limit(1);

      if (!targetMember) {
        return res.status(404).json({ error: 'المعلّم غير موجود ضمن هذا المركز.' });
      }

      const d = parsed.data;
      if (d.assignments) {
        for (const a of d.assignments) {
          const errMsg = await validateCurriculumIds(a);
          if (errMsg) {
            return res.status(400).json({ error: errMsg });
          }
        }
      }

      const updated = await db.transaction(async (tx) => {
        if (targetMember.memberRole !== 'OWNER' && (d.fullName || d.phone !== undefined)) {
          // Update phone/name only if user was created without demo lock or owner editing center teacher profile
          if (d.phone !== undefined) {
            await tx
              .update(users)
              .set({ phone: d.phone, updatedAt: new Date() })
              .where(eq(users.id, targetMember.userId));
          }
          if (d.fullName) {
            await tx
              .update(users)
              .set({ fullName: d.fullName, updatedAt: new Date() })
              .where(eq(users.id, targetMember.userId));
          }
        }

        const nextStatus =
          targetMember.memberRole === 'OWNER'
            ? 'ACTIVE'
            : d.status ?? targetMember.status;

        const nextRole =
          targetMember.memberRole === 'OWNER'
            ? 'OWNER'
            : d.memberRole ?? targetMember.memberRole;

        const [saved] = await tx
          .update(centerMembers)
          .set({
            ...(d.jobTitle !== undefined ? { jobTitle: d.jobTitle } : {}),
            ...(d.employmentType !== undefined
              ? { employmentType: d.employmentType }
              : {}),
            memberRole: nextRole,
            status: nextStatus,
            ...(d.notes !== undefined ? { notes: d.notes } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(centerMembers.id, memberId),
              eq(centerMembers.centerId, centerId)
            )
          )
          .returning();

        if (d.assignments !== undefined) {
          await tx
            .delete(centerTeacherAssignments)
            .where(
              and(
                eq(centerTeacherAssignments.centerId, centerId),
                eq(centerTeacherAssignments.memberId, memberId)
              )
            );
          if (d.assignments.length > 0) {
            await tx.insert(centerTeacherAssignments).values(
              d.assignments.map((a) => ({
                centerId,
                memberId,
                teacherUserId: targetMember.userId,
                subjectId: a.subjectId,
                stageId: a.stageId,
                systemId: a.systemId ?? null,
                gradeId: a.gradeId ?? null,
                divisionId: a.divisionId ?? null,
                pathwayId: a.pathwayId ?? null,
                notes: a.notes || null,
                isActive: true,
              }))
            );
          }
        }

        return saved;
      });

      res.json({ member: updated });
    } catch (error) {
      console.error('Update center teacher error:', error);
      res.status(500).json({ error: 'تعذر تحديث بيانات المعلّم.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/teachers/:memberId/status',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const memberId = Number(req.params.memberId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STAFF');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const schema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'الحالة المطلوبة غير صالحة.' });
      }

      const [target] = await db
        .select()
        .from(centerMembers)
        .where(
          and(
            eq(centerMembers.id, memberId),
            eq(centerMembers.centerId, centerId)
          )
        )
        .limit(1);

      if (!target) {
        return res.status(404).json({ error: 'العضو غير موجود في هذا المركز.' });
      }
      if (target.memberRole === 'OWNER' && parsed.data.status !== 'ACTIVE') {
        return res
          .status(400)
          .json({ error: 'لا يمكن تعطيل عضوية مالك المركز.' });
      }

      const [updated] = await db
        .update(centerMembers)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(
          and(
            eq(centerMembers.id, memberId),
            eq(centerMembers.centerId, centerId)
          )
        )
        .returning();

      res.json({ member: updated });
    } catch (error) {
      console.error('Toggle center member status error:', error);
      res.status(500).json({ error: 'تعذر تحديث حالة العضوية في المركز.' });
    }
  }
);

// ============================================================================
// 3. STUDENTS MANAGEMENT (STRICTLY CENTER-SCOPED)
// ============================================================================

router.get(
  '/center-dashboard/:centerId/students',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STUDENTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const stageIdFilter = req.query.stageId ? Number(req.query.stageId) : undefined;
      const gradeIdFilter = req.query.gradeId ? Number(req.query.gradeId) : undefined;

      const [
        centerStudentRows,
        centerCourseRows,
        attendanceRows,
        centerPaymentRows,
      ] = await Promise.all([
        db
          .select({
            id: centerStudents.id,
            studentUserId: centerStudents.studentUserId,
            phone: centerStudents.phone,
            stageId: centerStudents.stageId,
            stageNameAr: educationalStages.nameAr,
            gradeId: centerStudents.gradeId,
            gradeNameAr: educationalGrades.nameAr,
            guardianName: centerStudents.guardianName,
            guardianPhone: centerStudents.guardianPhone,
            notes: centerStudents.notes,
            status: centerStudents.status,
            joinedAt: centerStudents.joinedAt,
            fullName: users.fullName,
            email: users.email,
            userPhone: users.phone,
            profileStageId: studentProfiles.stageId,
          })
          .from(centerStudents)
          .innerJoin(users, eq(centerStudents.studentUserId, users.id))
          .leftJoin(educationalStages, eq(centerStudents.stageId, educationalStages.id))
          .leftJoin(educationalGrades, eq(centerStudents.gradeId, educationalGrades.id))
          .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
          .where(eq(centerStudents.centerId, centerId))
          .orderBy(desc(centerStudents.joinedAt)),
        db
          .select({
            id: courses.id,
            title: courses.title,
            instructorUserId: courses.instructorUserId,
            instructorName: users.fullName,
            stageId: courses.stageId,
            gradeId: courses.gradeId,
          })
          .from(courses)
          .innerJoin(users, eq(courses.instructorUserId, users.id))
          .where(eq(courses.centerId, centerId)),
        db
          .select()
          .from(centerAttendance)
          .where(eq(centerAttendance.centerId, centerId)),
        db
          .select()
          .from(centerStudentPayments)
          .where(eq(centerStudentPayments.centerId, centerId))
          .orderBy(desc(centerStudentPayments.createdAt)),
      ]);

      const courseIds = centerCourseRows.map((c) => c.id);
      const centerEnrollmentRows =
        courseIds.length > 0
          ? await db
              .select({
                enrollmentId: enrollments.id,
                courseId: enrollments.courseId,
                studentUserId: enrollments.studentUserId,
                status: enrollments.status,
                enrolledAt: enrollments.enrolledAt,
                completionPercent: progress.completionPercent,
                fullName: users.fullName,
                email: users.email,
                userPhone: users.phone,
                profileStageId: studentProfiles.stageId,
              })
              .from(enrollments)
              .innerJoin(users, eq(enrollments.studentUserId, users.id))
              .leftJoin(progress, eq(progress.enrollmentId, enrollments.id))
              .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
              .where(inArray(enrollments.courseId, courseIds))
          : [];

      const stageLookup = new Map(
        (await db.select().from(educationalStages)).map((s) => [s.id, s.nameAr])
      );
      const courseById = new Map(centerCourseRows.map((c) => [c.id, c]));

      const studentMap = new Map<
        number,
        {
          centerStudentId: number | null;
          studentUserId: number;
          fullName: string;
          email: string;
          phone: string;
          stageId: number | null;
          stageNameAr: string | null;
          gradeId: number | null;
          gradeNameAr: string | null;
          guardianName: string | null;
          guardianPhone: string | null;
          notes: string | null;
          status: string;
          joinedAt: Date;
          enrolledCourses: Array<{
            enrollmentId: number;
            courseId: number;
            courseTitle: string;
            status: string;
            completionPercent: number;
          }>;
          assignedTeachers: Array<{ id: number; fullName: string }>;
          attendanceSummary: {
            present: number;
            absent: number;
            late: number;
            excused: number;
            total: number;
          };
          paymentsSummary: {
            totalPaid: number;
            totalPending: number;
            recordsCount: number;
            lastStatus: string | null;
          };
        }
      >();

      for (const cs of centerStudentRows) {
        const effStageId = cs.stageId ?? cs.profileStageId ?? null;
        studentMap.set(cs.studentUserId, {
          centerStudentId: cs.id,
          studentUserId: cs.studentUserId,
          fullName: cs.fullName,
          email: cs.email,
          phone: cs.phone || cs.userPhone || '',
          stageId: effStageId,
          stageNameAr: cs.stageNameAr || (effStageId ? stageLookup.get(effStageId) || null : null),
          gradeId: cs.gradeId ?? null,
          gradeNameAr: cs.gradeNameAr || null,
          guardianName: cs.guardianName,
          guardianPhone: cs.guardianPhone,
          notes: cs.notes,
          status: cs.status,
          joinedAt: cs.joinedAt,
          enrolledCourses: [],
          assignedTeachers: [],
          attendanceSummary: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
          paymentsSummary: { totalPaid: 0, totalPending: 0, recordsCount: 0, lastStatus: null },
        });
      }

      for (const enr of centerEnrollmentRows) {
        const courseInfo = courseById.get(enr.courseId);
        if (!courseInfo) continue;

        let entry = studentMap.get(enr.studentUserId);
        if (!entry) {
          const effStageId = enr.profileStageId ?? courseInfo.stageId ?? null;
          entry = {
            centerStudentId: null,
            studentUserId: enr.studentUserId,
            fullName: enr.fullName,
            email: enr.email,
            phone: enr.userPhone || '',
            stageId: effStageId,
            stageNameAr: effStageId ? stageLookup.get(effStageId) || null : null,
            gradeId: courseInfo.gradeId ?? null,
            gradeNameAr: null,
            guardianName: null,
            guardianPhone: null,
            notes: null,
            status: 'ACTIVE',
            joinedAt: enr.enrolledAt,
            enrolledCourses: [],
            assignedTeachers: [],
            attendanceSummary: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
            paymentsSummary: { totalPaid: 0, totalPending: 0, recordsCount: 0, lastStatus: null },
          };
          studentMap.set(enr.studentUserId, entry);
        }

        entry.enrolledCourses.push({
          enrollmentId: enr.enrollmentId,
          courseId: enr.courseId,
          courseTitle: courseInfo.title,
          status: enr.status,
          completionPercent: enr.completionPercent ?? 0,
        });

        if (!entry.assignedTeachers.some((t) => t.id === courseInfo.instructorUserId)) {
          entry.assignedTeachers.push({
            id: courseInfo.instructorUserId,
            fullName: courseInfo.instructorName,
          });
        }
      }

      for (const att of attendanceRows) {
        const entry = studentMap.get(att.studentUserId);
        if (!entry) continue;
        entry.attendanceSummary.total += 1;
        if (att.status === 'PRESENT') entry.attendanceSummary.present += 1;
        else if (att.status === 'ABSENT') entry.attendanceSummary.absent += 1;
        else if (att.status === 'LATE') entry.attendanceSummary.late += 1;
        else if (att.status === 'EXCUSED') entry.attendanceSummary.excused += 1;
      }

      for (const pay of centerPaymentRows) {
        const entry = studentMap.get(pay.studentUserId);
        if (!entry) continue;
        entry.paymentsSummary.recordsCount += 1;
        if (!entry.paymentsSummary.lastStatus) {
          entry.paymentsSummary.lastStatus = pay.status;
        }
        const amt = Number(pay.amount);
        if (pay.status === 'PAID' || pay.status === 'PARTIAL') {
          entry.paymentsSummary.totalPaid += amt;
        } else if (pay.status === 'PENDING' || pay.status === 'OVERDUE') {
          entry.paymentsSummary.totalPending += amt;
        }
      }

      const students = Array.from(studentMap.values()).filter((s) => {
        if (q) {
          const hay = `${s.fullName} ${s.phone} ${s.email} ${s.guardianPhone || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (stageIdFilter && s.stageId !== stageIdFilter) return false;
        if (gradeIdFilter && s.gradeId !== gradeIdFilter) return false;
        return true;
      });

      res.json({ students });
    } catch (error) {
      console.error('List center students error:', error);
      res.status(500).json({ error: 'تعذر جلب طلاب المركز.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/students',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STUDENTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const schema = z.object({
        fullName: z.string().trim().min(2, 'اسم الطالب مطلوب').max(120),
        email: z.string().trim().email('البريد الإلكتروني غير صالح').optional().or(z.literal('')),
        phone: z.string().trim().min(6, 'رقم هاتف الطالب مطلوب').max(40),
        password: z.string().min(8).optional(),
        stageId: z.number().int().positive().nullable().optional(),
        gradeId: z.number().int().positive().nullable().optional(),
        guardianName: z.string().trim().max(120).optional(),
        guardianPhone: z.string().trim().max(40).optional(),
        notes: z.string().trim().max(500).optional(),
        courseId: z.number().int().positive().nullable().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الطالب غير مكتملة.',
        });
      }

      const d = parsed.data;
      if (d.courseId) {
        const [crs] = await db
          .select()
          .from(courses)
          .where(and(eq(courses.id, d.courseId), eq(courses.centerId, centerId)))
          .limit(1);
        if (!crs) {
          return res
            .status(400)
            .json({ error: 'الدورة المختارة لا تتبع هذا المركز.' });
        }
      }

      const normalizedEmail = d.email?.trim()
        ? d.email.trim().toLowerCase()
        : `student.c${centerId}.${Date.now()}@students.jusoor.local`;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      const created = await db.transaction(async (tx) => {
        let studentUserId: number;
        if (existingUser) {
          studentUserId = existingUser.id;
          if (!existingUser.phone && d.phone) {
            await tx
              .update(users)
              .set({ phone: d.phone, updatedAt: new Date() })
              .where(eq(users.id, studentUserId));
          }
        } else {
          const passwordHash = hashPassword(
            d.password || crypto.randomBytes(12).toString('hex')
          );
          const [newUser] = await tx
            .insert(users)
            .values({
              email: normalizedEmail,
              passwordHash,
              fullName: d.fullName,
              phone: d.phone,
              emailVerified: false,
              accountStatus: 'ACTIVE',
              isDemo: false,
            })
            .returning();
          studentUserId = newUser.id;
        }

        const [studentRole] = await tx
          .select()
          .from(roles)
          .where(eq(roles.code, 'STUDENT'))
          .limit(1);
        if (studentRole) {
          await tx
            .insert(userRoles)
            .values({ userId: studentUserId, roleId: studentRole.id })
            .onConflictDoNothing();
        }

        const [existingProfile] = await tx
          .select({ id: studentProfiles.id })
          .from(studentProfiles)
          .where(eq(studentProfiles.userId, studentUserId))
          .limit(1);
        if (!existingProfile) {
          await tx.insert(studentProfiles).values({
            userId: studentUserId,
            stageId: d.stageId ?? null,
            learningGoal: `متعلّم مسجل في ${auth.ctx.center.name}`,
          });
        }

        const [cs] = await tx
          .insert(centerStudents)
          .values({
            centerId,
            studentUserId,
            phone: d.phone,
            stageId: d.stageId ?? null,
            gradeId: d.gradeId ?? null,
            guardianName: d.guardianName || null,
            guardianPhone: d.guardianPhone || null,
            notes: d.notes || null,
            status: 'ACTIVE',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [centerStudents.centerId, centerStudents.studentUserId],
            set: {
              phone: d.phone,
              stageId: d.stageId ?? null,
              gradeId: d.gradeId ?? null,
              guardianName: d.guardianName || null,
              guardianPhone: d.guardianPhone || null,
              notes: d.notes || null,
              status: 'ACTIVE',
              updatedAt: new Date(),
            },
          })
          .returning();

        if (d.courseId) {
          const [existingEnr] = await tx
            .select()
            .from(enrollments)
            .where(
              and(
                eq(enrollments.courseId, d.courseId),
                eq(enrollments.studentUserId, studentUserId)
              )
            )
            .limit(1);
          if (!existingEnr) {
            const lessonList = await tx
              .select({ id: courseLessons.id })
              .from(courseLessons)
              .where(eq(courseLessons.courseId, d.courseId));
            const [enr] = await tx
              .insert(enrollments)
              .values({
                courseId: d.courseId,
                studentUserId,
                status: 'ACTIVE',
              })
              .returning();
            await tx.insert(progress).values({
              enrollmentId: enr.id,
              completedLessonsCount: 0,
              totalLessonsCount: lessonList.length,
              completionPercent: 0,
            });
          }
        }

        return cs;
      });

      res.status(201).json({ student: created });
    } catch (error) {
      console.error('Register center student error:', error);
      res.status(500).json({ error: 'تعذر تسجيل الطالب في المركز.' });
    }
  }
);

router.get(
  '/center-dashboard/:centerId/students/:studentUserId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const studentUserId = Number(req.params.studentUserId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STUDENTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      if (!Number.isInteger(studentUserId) || studentUserId <= 0) {
        return res.status(400).json({ error: 'معرف الطالب غير صالح.' });
      }

      const belongs = await ensureStudentBelongsToCenter(centerId, studentUserId);
      if (!belongs) {
        return res
          .status(404)
          .json({ error: 'هذا الطالب غير مسجل ضمن هذا المركز.' });
      }

      const [[userRow], [csRow], [spRow], centerCourses] = await Promise.all([
        db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
            accountStatus: users.accountStatus,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, studentUserId))
          .limit(1),
        db
          .select({
            id: centerStudents.id,
            phone: centerStudents.phone,
            stageId: centerStudents.stageId,
            stageNameAr: educationalStages.nameAr,
            gradeId: centerStudents.gradeId,
            gradeNameAr: educationalGrades.nameAr,
            guardianName: centerStudents.guardianName,
            guardianPhone: centerStudents.guardianPhone,
            notes: centerStudents.notes,
            status: centerStudents.status,
            joinedAt: centerStudents.joinedAt,
          })
          .from(centerStudents)
          .leftJoin(educationalStages, eq(centerStudents.stageId, educationalStages.id))
          .leftJoin(educationalGrades, eq(centerStudents.gradeId, educationalGrades.id))
          .where(
            and(
              eq(centerStudents.centerId, centerId),
              eq(centerStudents.studentUserId, studentUserId)
            )
          )
          .limit(1),
        db
          .select()
          .from(studentProfiles)
          .where(eq(studentProfiles.userId, studentUserId))
          .limit(1),
        db
          .select({
            id: courses.id,
            title: courses.title,
            price: courses.price,
            instructorUserId: courses.instructorUserId,
            instructorName: users.fullName,
          })
          .from(courses)
          .innerJoin(users, eq(courses.instructorUserId, users.id))
          .where(eq(courses.centerId, centerId)),
      ]);

      if (!userRow) {
        return res.status(404).json({ error: 'حساب الطالب غير موجود.' });
      }

      const centerCourseIds = centerCourses.map((c) => c.id);
      const studentEnrollments =
        centerCourseIds.length > 0
          ? await db
              .select({
                enrollmentId: enrollments.id,
                courseId: enrollments.courseId,
                status: enrollments.status,
                enrolledAt: enrollments.enrolledAt,
                completedAt: enrollments.completedAt,
                completionPercent: progress.completionPercent,
                completedLessonsCount: progress.completedLessonsCount,
                totalLessonsCount: progress.totalLessonsCount,
                courseTitle: courses.title,
                instructorName: users.fullName,
              })
              .from(enrollments)
              .innerJoin(courses, eq(enrollments.courseId, courses.id))
              .innerJoin(users, eq(courses.instructorUserId, users.id))
              .leftJoin(progress, eq(progress.enrollmentId, enrollments.id))
              .where(
                and(
                  eq(enrollments.studentUserId, studentUserId),
                  inArray(enrollments.courseId, centerCourseIds)
                )
              )
              .orderBy(desc(enrollments.enrolledAt))
          : [];

      const enrollmentIds = studentEnrollments.map((e) => e.enrollmentId);
      const [attendanceList, centerPaymentsList, platformCoursePayments] =
        await Promise.all([
          db
            .select({
              id: centerAttendance.id,
              courseId: centerAttendance.courseId,
              courseTitle: courses.title,
              attendanceDate: centerAttendance.attendanceDate,
              status: centerAttendance.status,
              notes: centerAttendance.notes,
              createdAt: centerAttendance.createdAt,
            })
            .from(centerAttendance)
            .leftJoin(courses, eq(centerAttendance.courseId, courses.id))
            .where(
              and(
                eq(centerAttendance.centerId, centerId),
                eq(centerAttendance.studentUserId, studentUserId)
              )
            )
            .orderBy(desc(centerAttendance.attendanceDate), desc(centerAttendance.id)),
          db
            .select({
              id: centerStudentPayments.id,
              courseId: centerStudentPayments.courseId,
              courseTitle: courses.title,
              amount: centerStudentPayments.amount,
              currency: centerStudentPayments.currency,
              status: centerStudentPayments.status,
              paymentMethod: centerStudentPayments.paymentMethod,
              referenceCode: centerStudentPayments.referenceCode,
              notes: centerStudentPayments.notes,
              paidAt: centerStudentPayments.paidAt,
              createdAt: centerStudentPayments.createdAt,
            })
            .from(centerStudentPayments)
            .leftJoin(courses, eq(centerStudentPayments.courseId, courses.id))
            .where(
              and(
                eq(centerStudentPayments.centerId, centerId),
                eq(centerStudentPayments.studentUserId, studentUserId)
              )
            )
            .orderBy(desc(centerStudentPayments.createdAt)),
          enrollmentIds.length > 0
            ? db
                .select({
                  id: payments.id,
                  entityId: payments.entityId,
                  amount: payments.amount,
                  currency: payments.currency,
                  status: payments.status,
                  paymentReference: payments.paymentReference,
                  createdAt: payments.createdAt,
                })
                .from(payments)
                .where(
                  and(
                    eq(payments.payerUserId, studentUserId),
                    eq(payments.entityType, 'COURSE_ENROLLMENT'),
                    inArray(payments.entityId, enrollmentIds)
                  )
                )
            : Promise.resolve([]),
        ]);

      res.json({
        student: {
          studentUserId: userRow.id,
          fullName: userRow.fullName,
          email: userRow.email,
          phone: csRow?.phone || userRow.phone || '',
          stageId: csRow?.stageId ?? spRow?.stageId ?? null,
          stageNameAr: csRow?.stageNameAr || null,
          gradeId: csRow?.gradeId ?? null,
          gradeNameAr: csRow?.gradeNameAr || null,
          guardianName: csRow?.guardianName || null,
          guardianPhone: csRow?.guardianPhone || null,
          notes: csRow?.notes || null,
          status: csRow?.status || 'ACTIVE',
          joinedAt: csRow?.joinedAt || userRow.createdAt,
        },
        enrollments: studentEnrollments,
        attendance: attendanceList,
        payments: centerPaymentsList,
        platformPayments: platformCoursePayments,
      });
    } catch (error) {
      console.error('Get center student detail error:', error);
      res.status(500).json({ error: 'تعذر جلب سجل الطالب في المركز.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/students/:studentUserId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const studentUserId = Number(req.params.studentUserId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STUDENTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const belongs = await ensureStudentBelongsToCenter(centerId, studentUserId);
      if (!belongs) {
        return res.status(404).json({ error: 'هذا الطالب غير مسجل في المركز.' });
      }

      const schema = z.object({
        phone: z.string().trim().max(40).optional(),
        stageId: z.number().int().positive().nullable().optional(),
        gradeId: z.number().int().positive().nullable().optional(),
        guardianName: z.string().trim().max(120).nullable().optional(),
        guardianPhone: z.string().trim().max(40).nullable().optional(),
        notes: z.string().trim().max(500).nullable().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
        enrollCourseId: z.number().int().positive().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات تحديث الطالب غير صالحة.' });
      }

      const d = parsed.data;
      if (d.enrollCourseId) {
        const [crs] = await db
          .select()
          .from(courses)
          .where(
            and(eq(courses.id, d.enrollCourseId), eq(courses.centerId, centerId))
          )
          .limit(1);
        if (!crs) {
          return res.status(400).json({ error: 'الدورة المختارة لا تتبع هذا المركز.' });
        }
      }

      const saved = await db.transaction(async (tx) => {
        const [cs] = await tx
          .insert(centerStudents)
          .values({
            centerId,
            studentUserId,
            phone: d.phone || null,
            stageId: d.stageId ?? null,
            gradeId: d.gradeId ?? null,
            guardianName: d.guardianName ?? null,
            guardianPhone: d.guardianPhone ?? null,
            notes: d.notes ?? null,
            status: d.status ?? 'ACTIVE',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [centerStudents.centerId, centerStudents.studentUserId],
            set: {
              ...(d.phone !== undefined ? { phone: d.phone } : {}),
              ...(d.stageId !== undefined ? { stageId: d.stageId } : {}),
              ...(d.gradeId !== undefined ? { gradeId: d.gradeId } : {}),
              ...(d.guardianName !== undefined ? { guardianName: d.guardianName } : {}),
              ...(d.guardianPhone !== undefined ? { guardianPhone: d.guardianPhone } : {}),
              ...(d.notes !== undefined ? { notes: d.notes } : {}),
              ...(d.status !== undefined ? { status: d.status } : {}),
              updatedAt: new Date(),
            },
          })
          .returning();

        if (d.enrollCourseId) {
          const [existingEnr] = await tx
            .select()
            .from(enrollments)
            .where(
              and(
                eq(enrollments.courseId, d.enrollCourseId),
                eq(enrollments.studentUserId, studentUserId)
              )
            )
            .limit(1);
          if (!existingEnr) {
            const lessonList = await tx
              .select({ id: courseLessons.id })
              .from(courseLessons)
              .where(eq(courseLessons.courseId, d.enrollCourseId));
            const [enr] = await tx
              .insert(enrollments)
              .values({
                courseId: d.enrollCourseId,
                studentUserId,
                status: 'ACTIVE',
              })
              .returning();
            await tx.insert(progress).values({
              enrollmentId: enr.id,
              completedLessonsCount: 0,
              totalLessonsCount: lessonList.length,
              completionPercent: 0,
            });
          }
        }
        return cs;
      });

      res.json({ student: saved });
    } catch (error) {
      console.error('Update center student error:', error);
      res.status(500).json({ error: 'تعذر تحديث بيانات الطالب.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/students/:studentUserId/attendance',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const studentUserId = Number(req.params.studentUserId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STUDENTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const belongs = await ensureStudentBelongsToCenter(centerId, studentUserId);
      if (!belongs) {
        return res.status(404).json({ error: 'الطالب غير مسجل في هذا المركز.' });
      }

      const schema = z.object({
        attendanceDate: z.string().trim(),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
        courseId: z.number().int().positive().nullable().optional(),
        notes: z.string().trim().max(300).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success || !isValidCalendarDate(parsed.data.attendanceDate)) {
        return res
          .status(400)
          .json({ error: 'تاريخ أو حالة الحضور غير صالحة (YYYY-MM-DD).' });
      }

      let teacherUserId: number | null = null;
      if (parsed.data.courseId) {
        const [crs] = await db
          .select()
          .from(courses)
          .where(
            and(
              eq(courses.id, parsed.data.courseId),
              eq(courses.centerId, centerId)
            )
          )
          .limit(1);
        if (!crs) {
          return res
            .status(400)
            .json({ error: 'الدورة المختارة لا تتبع هذا المركز.' });
        }
        teacherUserId = crs.instructorUserId;
      }

      const [record] = await db
        .insert(centerAttendance)
        .values({
          centerId,
          studentUserId,
          courseId: parsed.data.courseId ?? null,
          teacherUserId,
          attendanceDate: parsed.data.attendanceDate,
          status: parsed.data.status,
          notes: parsed.data.notes || null,
          recordedByUserId: req.authUser!.id,
        })
        .returning();

      res.status(201).json({ attendance: record });
    } catch (error) {
      console.error('Record attendance error:', error);
      res.status(500).json({ error: 'تعذر تسجيل الحضور أو الغياب.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/students/:studentUserId/payments',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const studentUserId = Number(req.params.studentUserId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_STUDENTS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }
      const belongs = await ensureStudentBelongsToCenter(centerId, studentUserId);
      if (!belongs) {
        return res.status(404).json({ error: 'الطالب غير مسجل في هذا المركز.' });
      }

      const schema = z.object({
        amount: z.number().min(0, 'المبلغ يجب أن يكون صفراً أو موجباً').max(100000),
        currency: z.string().trim().min(3).max(6).default('EGP'),
        status: z.enum(['PAID', 'PENDING', 'PARTIAL', 'OVERDUE', 'REFUNDED']),
        paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'WALLET']).default('CASH'),
        courseId: z.number().int().positive().nullable().optional(),
        paidAt: z.string().trim(),
        referenceCode: z.string().trim().max(80).optional(),
        notes: z.string().trim().max(300).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success || !isValidCalendarDate(parsed.data.paidAt)) {
        return res
          .status(400)
          .json({ error: 'بيانات الدفعة المالية أو التاريخ غير صالحة.' });
      }

      if (parsed.data.courseId) {
        const [crs] = await db
          .select({ id: courses.id })
          .from(courses)
          .where(
            and(
              eq(courses.id, parsed.data.courseId),
              eq(courses.centerId, centerId)
            )
          )
          .limit(1);
        if (!crs) {
          return res
            .status(400)
            .json({ error: 'الدورة المختارة لا تتبع هذا المركز.' });
        }
      }

      const [payment] = await db
        .insert(centerStudentPayments)
        .values({
          centerId,
          studentUserId,
          courseId: parsed.data.courseId ?? null,
          amount: parsed.data.amount.toFixed(2),
          currency: parsed.data.currency.toUpperCase(),
          status: parsed.data.status,
          paymentMethod: parsed.data.paymentMethod,
          referenceCode:
            parsed.data.referenceCode || `CTR-${centerId}-${Date.now()}`,
          notes: parsed.data.notes || null,
          paidAt: parsed.data.paidAt,
          recordedByUserId: req.authUser!.id,
        })
        .returning();

      res.status(201).json({ payment });
    } catch (error) {
      console.error('Record center payment error:', error);
      res.status(500).json({ error: 'تعذر تسجيل الدفعة المالية.' });
    }
  }
);

// ============================================================================
// 4. COURSES MANAGEMENT & DEDICATED COURSE IMAGE UPLOAD
// ============================================================================

router.post(
  '/center-dashboard/:centerId/course-images',
  requireAuth,
  express.raw({ type: '*/*', limit: '6mb' }),
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_COURSES');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim();
      const rawFileNameHeader = req.headers['x-file-name'];
      const fileName =
        typeof rawFileNameHeader === 'string'
          ? decodeURIComponent(rawFileNameHeader)
          : undefined;

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buffer.length > MAX_COURSE_IMAGE_BYTES) {
        return res.status(413).json({
          error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).',
        });
      }

      const saved = await saveValidatedImageUpload({
        category: 'courses',
        centerId,
        mimeType,
        fileName,
        buffer,
      });

      if (!saved.ok) {
        return res.status(saved.status).json({ error: saved.error });
      }

      const courseIdParam = req.query.courseId ? Number(req.query.courseId) : null;
      if (courseIdParam) {
        const [courseRow] = await db
          .select()
          .from(courses)
          .where(
            and(eq(courses.id, courseIdParam), eq(courses.centerId, centerId))
          )
          .limit(1);
        if (!courseRow) {
          await deleteUploadedImageByUrl(saved.url);
          return res
            .status(404)
            .json({ error: 'الدورة غير موجودة ضمن هذا المركز.' });
        }
        const previousUrl = courseRow.thumbnailUrl;
        await db
          .update(courses)
          .set({
            thumbnailUrl: saved.url,
            coverImageKey: saved.filename,
            updatedAt: new Date(),
          })
          .where(eq(courses.id, courseRow.id));

        if (previousUrl && previousUrl !== saved.url) {
          await deleteUploadedImageByUrl(previousUrl);
        }
      }

      res.status(201).json({
        thumbnailUrl: saved.url,
        coverImageKey: saved.filename,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
      });
    } catch (error) {
      console.error('Upload course image error:', error);
      res.status(500).json({ error: 'تعذر رفع صورة الدورة.' });
    }
  }
);

router.delete(
  '/center-dashboard/:centerId/courses/:courseId/image',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const courseId = Number(req.params.courseId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_COURSES');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [courseRow] = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.centerId, centerId)))
        .limit(1);

      if (!courseRow) {
        return res.status(404).json({ error: 'الدورة غير موجودة في هذا المركز.' });
      }

      const oldUrl = courseRow.thumbnailUrl;
      const [updated] = await db
        .update(courses)
        .set({
          thumbnailUrl: null,
          coverImageKey: null,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, courseId))
        .returning();

      await deleteUploadedImageByUrl(oldUrl);
      res.json({ course: updated });
    } catch (error) {
      console.error('Delete course image error:', error);
      res.status(500).json({ error: 'تعذر إزالة صورة الدورة.' });
    }
  }
);

router.get(
  '/center-dashboard/:centerId/courses',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_COURSES');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const courseRows = await db
        .select({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          subtitle: courses.subtitle,
          description: courses.description,
          instructorUserId: courses.instructorUserId,
          instructorName: users.fullName,
          fieldId: courses.fieldId,
          customFieldName: courses.customFieldName,
          targetAudience: courses.targetAudience,
          taxonomyFieldNameAr: fields.nameAr,
          subjectId: courses.subjectId,
          subjectNameAr: subjects.nameAr,
          stageId: courses.stageId,
          stageNameAr: educationalStages.nameAr,
          systemId: courses.systemId,
          gradeId: courses.gradeId,
          gradeNameAr: educationalGrades.nameAr,
          divisionId: courses.divisionId,
          pathwayId: courses.pathwayId,
          level: courses.level,
          language: courses.language,
          price: courses.price,
          currency: courses.currency,
          maxStudents: courses.maxStudents,
          enrollmentStatus: courses.enrollmentStatus,
          thumbnailUrl: courses.thumbnailUrl,
          coverImageKey: courses.coverImageKey,
          status: courses.status,
          createdAt: courses.createdAt,
          updatedAt: courses.updatedAt,
        })
        .from(courses)
        .innerJoin(users, eq(courses.instructorUserId, users.id))
        .innerJoin(fields, eq(courses.fieldId, fields.id))
        .leftJoin(subjects, eq(courses.subjectId, subjects.id))
        .leftJoin(educationalStages, eq(courses.stageId, educationalStages.id))
        .leftJoin(educationalGrades, eq(courses.gradeId, educationalGrades.id))
        .where(eq(courses.centerId, centerId))
        .orderBy(desc(courses.createdAt));

      const courseIds = courseRows.map((c) => c.id);
      const [allLessons, allEnrollments, allReviews] =
        courseIds.length > 0
          ? await Promise.all([
              db
                .select()
                .from(courseLessons)
                .where(inArray(courseLessons.courseId, courseIds))
                .orderBy(asc(courseLessons.sortOrder)),
              db
                .select({
                  id: enrollments.id,
                  courseId: enrollments.courseId,
                  status: enrollments.status,
                })
                .from(enrollments)
                .where(inArray(enrollments.courseId, courseIds)),
              db
                .select({
                  id: reviews.id,
                  courseId: reviews.courseId,
                  rating: reviews.rating,
                  comment: reviews.comment,
                  authorName: users.fullName,
                  createdAt: reviews.createdAt,
                })
                .from(reviews)
                .innerJoin(users, eq(reviews.authorUserId, users.id))
                .where(inArray(reviews.courseId, courseIds))
                .orderBy(desc(reviews.createdAt)),
            ])
          : [[], [], []];

      const enriched = courseRows.map((c) => {
        const lessons = allLessons.filter((l) => l.courseId === c.id);
        const enr = allEnrollments.filter((e) => e.courseId === c.id);
        const revs = allReviews.filter((r) => r.courseId === c.id);
        const ratingAvg =
          revs.length > 0
            ? Number(
                (revs.reduce((s, r) => s + r.rating, 0) / revs.length).toFixed(1)
              )
            : null;
        const resolvedField = resolveCourseFieldDisplay(
          c.customFieldName,
          c.taxonomyFieldNameAr
        );
        return {
          ...c,
          fieldNameAr: resolvedField,
          customFieldName: c.customFieldName || resolvedField,
          lessons,
          lessonsCount: lessons.length,
          enrollmentsCount: enr.length,
          ratingAvg,
          reviewsCount: revs.length,
          reviews: revs.slice(0, 5),
        };
      });

      res.json({ courses: enriched });
    } catch (error) {
      console.error('List center courses error:', error);
      res.status(500).json({ error: 'تعذر جلب دورات المركز.' });
    }
  }
);

const lessonInputSchema = z.object({
  id: z.number().int().positive().optional(),
  moduleTitle: z.string().trim().max(140).nullable().optional(),
  title: z.string().trim().min(2, 'عنوان الدرس مطلوب').max(200),
  content: z.string().trim().min(3, 'محتوى الدرس مطلوب').max(8000),
  durationMinutes: z.number().int().min(1).max(600).default(20),
  isFreePreview: z.boolean().default(false),
});

router.post(
  '/center-dashboard/:centerId/courses',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_COURSES');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const schema = z.object({
        instructorUserId: z.number().int().positive(),
        title: z.string().trim().min(3, 'عنوان الدورة مطلوب').max(180),
        subtitle: z.string().trim().max(240).optional(),
        description: z.string().trim().min(10, 'وصف الدورة التفصيلي مطلوب').max(4000),
        customFieldName: z.string().trim().max(100).nullable().optional(),
        fieldName: z.string().trim().max(100).nullable().optional(),
        fieldId: z.number().int().positive().nullable().optional(),
        targetAudience: z.string().trim().max(300).nullable().optional(),
        subjectId: z.number().int().positive().nullable().optional(),
        stageId: z.number().int().positive().nullable().optional(),
        systemId: z.number().int().positive().nullable().optional(),
        gradeId: z.number().int().positive().nullable().optional(),
        divisionId: z.number().int().positive().nullable().optional(),
        pathwayId: z.number().int().positive().nullable().optional(),
        level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
        price: z.number().min(0).max(50000).default(0),
        currency: z.string().trim().min(3).max(6).default('EGP'),
        maxStudents: z.number().int().min(1).max(1000).nullable().optional(),
        status: z
          .enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'])
          .default('PUBLISHED'),
        enrollmentStatus: z.enum(['OPEN', 'PAUSED', 'CLOSED']).default('OPEN'),
        thumbnailUrl: z.string().trim().max(500).nullable().optional(),
        coverImageKey: z.string().trim().max(200).nullable().optional(),
        lessons: z
          .array(lessonInputSchema)
          .min(1, 'يجب إضافة درس واحد على الأقل ضمن المنهج'),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الدورة غير صالحة.',
        });
      }

      const d = parsed.data;
      const rawManualField = d.customFieldName ?? d.fieldName ?? null;
      let resolvedCustomFieldName: string;
      if (rawManualField !== null && rawManualField !== undefined) {
        const fc = validateManualCourseField(rawManualField);
        if (!fc.valid) {
          return res.status(400).json({ error: fc.error });
        }
        resolvedCustomFieldName = fc.value;
      } else if (d.fieldId) {
        const [fRow] = await db
          .select({ nameAr: fields.nameAr })
          .from(fields)
          .where(eq(fields.id, d.fieldId))
          .limit(1);
        if (!fRow) {
          return res.status(400).json({ error: 'التخصص المحدد غير موجود.' });
        }
        resolvedCustomFieldName = fRow.nameAr;
      } else {
        return res.status(400).json({
          error: 'يرجى إدخال المجال أو التخصص التعليمي للدورة يدوياً.',
        });
      }

      const anchorFieldId = await resolveAnchorFieldId({
        customFieldName: resolvedCustomFieldName,
        explicitFieldId: d.fieldId,
      });
      if (!anchorFieldId) {
        return res.status(500).json({ error: 'تعذر تهيئة مرجع التخصص.' });
      }

      if (!isAllowedStoredImageUrl(d.thumbnailUrl, 'courses')) {
        return res.status(400).json({
          error: 'مرجع صورة الدورة غير صالح. يرجى رفع الصورة عبر أداة الرفع المخصصة.',
        });
      }

      const currErr = await validateCurriculumIds({
        systemId: d.systemId,
        gradeId: d.gradeId,
        divisionId: d.divisionId,
        pathwayId: d.pathwayId,
      });
      if (currErr) {
        return res.status(400).json({ error: currErr });
      }

      // Verify selected instructor is active in THIS center or is center owner
      const isCenterOwner = d.instructorUserId === auth.ctx.center.ownerUserId;
      if (!isCenterOwner) {
        const [memberRow] = await db
          .select()
          .from(centerMembers)
          .where(
            and(
              eq(centerMembers.centerId, centerId),
              eq(centerMembers.userId, d.instructorUserId),
              eq(centerMembers.status, 'ACTIVE')
            )
          )
          .limit(1);
        if (!memberRow) {
          return res.status(400).json({
            error: 'المعلّم المختار غير نشط أو لا ينتمي إلى هذا المركز.',
          });
        }
      }

      const slug = `center-${centerId}-course-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`;
      const normalizedSubtitle =
        d.subtitle && d.subtitle.trim().length >= 3
          ? d.subtitle.trim()
          : d.description.trim().slice(0, 140);

      const created = await db.transaction(async (tx) => {
        const [courseRow] = await tx
          .insert(courses)
          .values({
            instructorUserId: d.instructorUserId,
            centerId,
            fieldId: anchorFieldId,
            customFieldName: resolvedCustomFieldName,
            targetAudience: d.targetAudience ? d.targetAudience.trim() : null,
            subjectId: d.subjectId ?? null,
            stageId: d.stageId ?? null,
            systemId: d.systemId ?? null,
            gradeId: d.gradeId ?? null,
            divisionId: d.divisionId ?? null,
            pathwayId: d.pathwayId ?? null,
            title: d.title,
            slug,
            subtitle: normalizedSubtitle,
            description: d.description,
            level: d.level,
            price: d.price.toFixed(2),
            currency: d.currency.toUpperCase(),
            maxStudents: d.maxStudents ?? null,
            enrollmentStatus: d.enrollmentStatus,
            status: d.status,
            thumbnailUrl: d.thumbnailUrl || null,
            coverImageKey: d.coverImageKey || null,
            isDemo: false,
          })
          .returning();

        await tx.insert(courseLessons).values(
          d.lessons.map((l, idx) => ({
            courseId: courseRow.id,
            moduleTitle: l.moduleTitle || null,
            title: l.title,
            content: l.content,
            durationMinutes: l.durationMinutes,
            sortOrder: idx + 1,
            isFreePreview: l.isFreePreview,
          }))
        );

        return courseRow;
      });

      res.status(201).json({
        course: { ...created, fieldNameAr: resolvedCustomFieldName },
      });
    } catch (error) {
      console.error('Create center course error:', error);
      res.status(500).json({ error: 'تعذر إنشاء الدورة التدريبية.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/courses/:courseId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const courseId = Number(req.params.courseId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_COURSES');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [existing] = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.centerId, centerId)))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'الدورة غير موجودة ضمن هذا المركز.' });
      }

      const schema = z.object({
        instructorUserId: z.number().int().positive().optional(),
        title: z.string().trim().min(3).max(180).optional(),
        subtitle: z.string().trim().max(240).optional(),
        description: z.string().trim().min(10).max(4000).optional(),
        customFieldName: z.string().trim().max(100).optional(),
        fieldName: z.string().trim().max(100).optional(),
        fieldId: z.number().int().positive().optional(),
        targetAudience: z.string().trim().max(300).nullable().optional(),
        subjectId: z.number().int().positive().nullable().optional(),
        stageId: z.number().int().positive().nullable().optional(),
        systemId: z.number().int().positive().nullable().optional(),
        gradeId: z.number().int().positive().nullable().optional(),
        divisionId: z.number().int().positive().nullable().optional(),
        pathwayId: z.number().int().positive().nullable().optional(),
        level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
        price: z.number().min(0).max(50000).optional(),
        currency: z.string().trim().min(3).max(6).optional(),
        maxStudents: z.number().int().min(1).max(1000).nullable().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED']).optional(),
        enrollmentStatus: z.enum(['OPEN', 'PAUSED', 'CLOSED']).optional(),
        thumbnailUrl: z.string().trim().max(500).nullable().optional(),
        coverImageKey: z.string().trim().max(200).nullable().optional(),
        removeThumbnail: z.boolean().optional(),
        lessons: z.array(lessonInputSchema).min(1).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات تعديل الدورة غير صالحة.',
        });
      }

      const d = parsed.data;
      if (d.thumbnailUrl !== undefined && !isAllowedStoredImageUrl(d.thumbnailUrl, 'courses')) {
        return res.status(400).json({
          error: 'مرجع صورة الدورة غير صالح.',
        });
      }

      let nextCustomFieldName = existing.customFieldName;
      let nextAnchorFieldId = existing.fieldId;
      const rawManualField = d.customFieldName ?? d.fieldName;
      if (rawManualField !== undefined) {
        const fc = validateManualCourseField(rawManualField);
        if (!fc.valid) {
          return res.status(400).json({ error: fc.error });
        }
        nextCustomFieldName = fc.value;
        const anchor = await resolveAnchorFieldId({
          customFieldName: nextCustomFieldName,
          explicitFieldId: d.fieldId,
        });
        if (anchor) nextAnchorFieldId = anchor;
      } else if (d.fieldId !== undefined) {
        const [fRow] = await db
          .select({ id: fields.id, nameAr: fields.nameAr })
          .from(fields)
          .where(eq(fields.id, d.fieldId))
          .limit(1);
        if (fRow) {
          nextAnchorFieldId = fRow.id;
          if (!nextCustomFieldName) nextCustomFieldName = fRow.nameAr;
        }
      }

      if (d.instructorUserId && d.instructorUserId !== auth.ctx.center.ownerUserId) {
        const [memberRow] = await db
          .select()
          .from(centerMembers)
          .where(
            and(
              eq(centerMembers.centerId, centerId),
              eq(centerMembers.userId, d.instructorUserId),
              eq(centerMembers.status, 'ACTIVE')
            )
          )
          .limit(1);
        if (!memberRow) {
          return res.status(400).json({
            error: 'المعلّم المختار غير نشط أو لا يتبع هذا المركز.',
          });
        }
      }

      const nextSystemId = d.systemId !== undefined ? d.systemId : existing.systemId;
      const nextGradeId = d.gradeId !== undefined ? d.gradeId : existing.gradeId;
      const nextDivisionId =
        d.divisionId !== undefined ? d.divisionId : existing.divisionId;
      const nextPathwayId =
        d.pathwayId !== undefined ? d.pathwayId : existing.pathwayId;

      const currErr = await validateCurriculumIds({
        systemId: nextSystemId,
        gradeId: nextGradeId,
        divisionId: nextDivisionId,
        pathwayId: nextPathwayId,
      });
      if (currErr) {
        return res.status(400).json({ error: currErr });
      }

      const oldThumbnailUrl = existing.thumbnailUrl;
      const nextThumbnailUrl = d.removeThumbnail
        ? null
        : d.thumbnailUrl !== undefined
        ? d.thumbnailUrl
        : existing.thumbnailUrl;
      const nextCoverImageKey = d.removeThumbnail
        ? null
        : d.coverImageKey !== undefined
        ? d.coverImageKey
        : d.thumbnailUrl !== undefined && d.thumbnailUrl !== existing.thumbnailUrl
        ? null
        : existing.coverImageKey;

      const updated = await db.transaction(async (tx) => {
        const [savedCourse] = await tx
          .update(courses)
          .set({
            ...(d.instructorUserId !== undefined
              ? { instructorUserId: d.instructorUserId }
              : {}),
            ...(d.title !== undefined ? { title: d.title } : {}),
            ...(d.subtitle !== undefined
              ? {
                  subtitle:
                    d.subtitle.trim() ||
                    (d.description ?? existing.description).trim().slice(0, 140),
                }
              : {}),
            ...(d.description !== undefined ? { description: d.description } : {}),
            fieldId: nextAnchorFieldId,
            customFieldName: nextCustomFieldName,
            ...(d.targetAudience !== undefined
              ? { targetAudience: d.targetAudience ? d.targetAudience.trim() : null }
              : {}),
            ...(d.subjectId !== undefined ? { subjectId: d.subjectId } : {}),
            ...(d.stageId !== undefined ? { stageId: d.stageId } : {}),
            ...(d.systemId !== undefined ? { systemId: d.systemId } : {}),
            ...(d.gradeId !== undefined ? { gradeId: d.gradeId } : {}),
            ...(d.divisionId !== undefined ? { divisionId: d.divisionId } : {}),
            ...(d.pathwayId !== undefined ? { pathwayId: d.pathwayId } : {}),
            ...(d.level !== undefined ? { level: d.level } : {}),
            ...(d.price !== undefined ? { price: d.price.toFixed(2) } : {}),
            ...(d.currency !== undefined
              ? { currency: d.currency.toUpperCase() }
              : {}),
            ...(d.maxStudents !== undefined ? { maxStudents: d.maxStudents } : {}),
            ...(d.status !== undefined ? { status: d.status } : {}),
            ...(d.enrollmentStatus !== undefined
              ? { enrollmentStatus: d.enrollmentStatus }
              : {}),
            thumbnailUrl: nextThumbnailUrl,
            coverImageKey: nextCoverImageKey,
            updatedAt: new Date(),
          })
          .where(and(eq(courses.id, courseId), eq(courses.centerId, centerId)))
          .returning();

        if (d.lessons) {
          const existingLessonRows = await tx
            .select({ id: courseLessons.id })
            .from(courseLessons)
            .where(eq(courseLessons.courseId, courseId));
          const existingIdSet = new Set(existingLessonRows.map((r) => r.id));
          const keptIds: number[] = [];

          for (let idx = 0; idx < d.lessons.length; idx += 1) {
            const l = d.lessons[idx];
            const sortOrder = idx + 1;
            if (l.id && existingIdSet.has(l.id)) {
              keptIds.push(l.id);
              await tx
                .update(courseLessons)
                .set({
                  moduleTitle: l.moduleTitle || null,
                  title: l.title,
                  content: l.content,
                  durationMinutes: l.durationMinutes,
                  sortOrder,
                  isFreePreview: l.isFreePreview,
                })
                .where(
                  and(
                    eq(courseLessons.id, l.id),
                    eq(courseLessons.courseId, courseId)
                  )
                );
            } else {
              const [ins] = await tx
                .insert(courseLessons)
                .values({
                  courseId,
                  moduleTitle: l.moduleTitle || null,
                  title: l.title,
                  content: l.content,
                  durationMinutes: l.durationMinutes,
                  sortOrder,
                  isFreePreview: l.isFreePreview,
                })
                .returning({ id: courseLessons.id });
              keptIds.push(ins.id);
            }
          }

          if (keptIds.length > 0) {
            await tx
              .delete(courseLessons)
              .where(
                and(
                  eq(courseLessons.courseId, courseId),
                  notInArray(courseLessons.id, keptIds)
                )
              );
          } else {
            await tx
              .delete(courseLessons)
              .where(eq(courseLessons.courseId, courseId));
          }
        }

        return savedCourse;
      });

      if (oldThumbnailUrl && oldThumbnailUrl !== nextThumbnailUrl) {
        await deleteUploadedImageByUrl(oldThumbnailUrl);
      }

      res.json({
        course: {
          ...updated,
          fieldNameAr: resolveCourseFieldDisplay(
            updated.customFieldName,
            undefined
          ),
        },
      });
    } catch (error) {
      console.error('Update center course error:', error);
      res.status(500).json({ error: 'تعذر تحديث الدورة.' });
    }
  }
);

// ============================================================================
// 5. CENTER SETTINGS (BASIC INFO, HOURS, BRANCHES, ROOMS, POLICIES, NOTIFS, PERMISSIONS)
// ============================================================================

router.get(
  '/center-dashboard/:centerId/settings',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [branches, rooms, staff] = await Promise.all([
        db
          .select()
          .from(centerBranches)
          .where(eq(centerBranches.centerId, centerId))
          .orderBy(desc(centerBranches.isMain), asc(centerBranches.id)),
        db
          .select({
            id: centerRooms.id,
            centerId: centerRooms.centerId,
            branchId: centerRooms.branchId,
            branchName: centerBranches.name,
            name: centerRooms.name,
            roomNumber: centerRooms.roomNumber,
            capacity: centerRooms.capacity,
            equipmentNotes: centerRooms.equipmentNotes,
            isActive: centerRooms.isActive,
          })
          .from(centerRooms)
          .innerJoin(centerBranches, eq(centerRooms.branchId, centerBranches.id))
          .where(eq(centerRooms.centerId, centerId))
          .orderBy(asc(centerRooms.id)),
        db
          .select({
            id: centerMembers.id,
            userId: centerMembers.userId,
            fullName: users.fullName,
            email: users.email,
            memberRole: centerMembers.memberRole,
            jobTitle: centerMembers.jobTitle,
            status: centerMembers.status,
            permissionsJson: centerMembers.permissionsJson,
          })
          .from(centerMembers)
          .innerJoin(users, eq(centerMembers.userId, users.id))
          .where(eq(centerMembers.centerId, centerId))
          .orderBy(asc(centerMembers.id)),
      ]);

      res.json({
        center: withCenterDefaults(auth.ctx.center),
        isOwner: auth.ctx.isOwner || auth.ctx.isAdmin,
        branches,
        rooms,
        staff,
      });
    } catch (error) {
      console.error('Get center settings error:', error);
      res.status(500).json({ error: 'تعذر جلب إعدادات المركز.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/logo',
  requireAuth,
  express.raw({ type: '*/*', limit: '6mb' }),
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim();
      const rawFileNameHeader = req.headers['x-file-name'];
      const fileName =
        typeof rawFileNameHeader === 'string'
          ? decodeURIComponent(rawFileNameHeader)
          : undefined;
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      const saved = await saveValidatedImageUpload({
        category: 'centers',
        centerId,
        mimeType,
        fileName,
        buffer,
      });

      if (!saved.ok) {
        return res.status(saved.status).json({ error: saved.error });
      }

      const previousLogo = auth.ctx.center.logoUrl;
      const [updated] = await db
        .update(centers)
        .set({ logoUrl: saved.url, updatedAt: new Date() })
        .where(eq(centers.id, centerId))
        .returning();

      if (previousLogo && previousLogo !== saved.url) {
        await deleteUploadedImageByUrl(previousLogo);
      }

      res.status(201).json({ logoUrl: saved.url, center: withCenterDefaults(updated) });
    } catch (error) {
      console.error('Upload center logo error:', error);
      res.status(500).json({ error: 'تعذر رفع شعار المركز.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/front-image',
  requireAuth,
  express.raw({ type: '*/*', limit: '6mb' }),
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim();
      const rawFileNameHeader = req.headers['x-file-name'];
      const fileName =
        typeof rawFileNameHeader === 'string'
          ? decodeURIComponent(rawFileNameHeader)
          : undefined;
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      const saved = await saveValidatedImageUpload({
        category: 'centers',
        centerId,
        mimeType,
        fileName,
        buffer,
      });

      if (!saved.ok) {
        return res.status(saved.status).json({ error: saved.error });
      }

      const previousBanner = auth.ctx.center.bannerUrl;
      const [updated] = await db
        .update(centers)
        .set({ bannerUrl: saved.url, updatedAt: new Date() })
        .where(eq(centers.id, centerId))
        .returning();

      if (previousBanner && previousBanner !== saved.url) {
        await deleteUploadedImageByUrl(previousBanner);
      }

      res.status(201).json({
        frontImageUrl: saved.url,
        bannerUrl: saved.url,
        center: withCenterDefaults(updated),
      });
    } catch (error) {
      console.error('Upload center front image error:', error);
      res.status(500).json({ error: 'تعذر رفع صورة واجهة المركز.' });
    }
  }
);

router.delete(
  '/center-dashboard/:centerId/front-image',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const previousBanner = auth.ctx.center.bannerUrl;
      const [updated] = await db
        .update(centers)
        .set({ bannerUrl: null, updatedAt: new Date() })
        .where(eq(centers.id, centerId))
        .returning();

      if (previousBanner) {
        await deleteUploadedImageByUrl(previousBanner);
      }

      res.json({
        frontImageUrl: null,
        bannerUrl: null,
        center: withCenterDefaults(updated),
      });
    } catch (error) {
      console.error('Remove center front image error:', error);
      res.status(500).json({ error: 'تعذر إزالة صورة واجهة المركز.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/settings',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const workingHourSchema = z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        isOpen: z.boolean(),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
        note: z.string().max(120).optional(),
      });

      const bookingPoliciesSchema = z.object({
        allowStudentBookings: z.boolean(),
        requireApproval: z.boolean(),
        minBookingNoticeHours: z.number().int().min(0).max(168),
        allowCancellation: z.boolean(),
        minCancellationNoticeHours: z.number().int().min(0).max(168),
        maxReschedulesPerBooking: z.number().int().min(0).max(20),
        policySummary: z.string().max(1000),
      });

      const notificationSettingsSchema = z.object({
        notifyNewStudentRegistration: z.boolean(),
        notifyNewCourseEnrollment: z.boolean(),
        notifyBookingRequests: z.boolean(),
        notifyCancellations: z.boolean(),
        notifyPaymentUpdates: z.boolean(),
        notifyStaffActivities: z.boolean(),
      });

      const schema = z.object({
        name: z.string().trim().min(3).max(160).optional(),
        description: z.string().trim().min(10).max(2000).optional(),
        governorate: z.string().trim().max(100).nullable().optional(),
        city: z.string().trim().min(2).max(100).optional(),
        country: z.string().trim().min(2).max(100).optional(),
        street: z.string().trim().max(200).nullable().optional(),
        buildingDetails: z.string().trim().max(200).nullable().optional(),
        address: z.string().trim().max(300).nullable().optional(),
        latitude: z.union([z.number(), z.string()]).nullable().optional(),
        longitude: z.union([z.number(), z.string()]).nullable().optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        secondaryPhone: z.string().trim().max(40).nullable().optional(),
        website: z.string().trim().max(300).nullable().optional(),
        removeLogo: z.boolean().optional(),
        removeFrontImage: z.boolean().optional(),
        workingHoursJson: z.array(workingHourSchema).length(7).optional(),
        bookingPoliciesJson: bookingPoliciesSchema.optional(),
        notificationSettingsJson: notificationSettingsSchema.optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الإعدادات غير صالحة.',
        });
      }

      const d = parsed.data;
      const oldLogo = auth.ctx.center.logoUrl;
      const oldBanner = auth.ctx.center.bannerUrl;

      let coordsUpdate: { latitude: string | null; longitude: string | null } | undefined;
      if (d.latitude !== undefined || d.longitude !== undefined) {
        const nextLatInput =
          d.latitude !== undefined ? d.latitude : auth.ctx.center.latitude;
        const nextLngInput =
          d.longitude !== undefined ? d.longitude : auth.ctx.center.longitude;
        const coordCheck = validateCoordinates(nextLatInput, nextLngInput);
        if (!coordCheck.valid) {
          return res.status(400).json({ error: coordCheck.error });
        }
        coordsUpdate = {
          latitude:
            coordCheck.latitude !== null ? String(coordCheck.latitude) : null,
          longitude:
            coordCheck.longitude !== null ? String(coordCheck.longitude) : null,
        };
      }

      const [updated] = await db
        .update(centers)
        .set({
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.governorate !== undefined
            ? { governorate: d.governorate || null }
            : {}),
          ...(d.city !== undefined ? { city: d.city } : {}),
          ...(d.country !== undefined ? { country: d.country } : {}),
          ...(d.street !== undefined ? { street: d.street || null } : {}),
          ...(d.buildingDetails !== undefined
            ? { buildingDetails: d.buildingDetails || null }
            : {}),
          ...(d.address !== undefined ? { address: d.address || null } : {}),
          ...(coordsUpdate ?? {}),
          ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
          ...(d.secondaryPhone !== undefined
            ? { secondaryPhone: d.secondaryPhone || null }
            : {}),
          ...(d.website !== undefined ? { website: d.website || null } : {}),
          ...(d.removeLogo ? { logoUrl: null } : {}),
          ...(d.removeFrontImage ? { bannerUrl: null } : {}),
          ...(d.workingHoursJson !== undefined
            ? { workingHoursJson: d.workingHoursJson }
            : {}),
          ...(d.bookingPoliciesJson !== undefined
            ? { bookingPoliciesJson: d.bookingPoliciesJson }
            : {}),
          ...(d.notificationSettingsJson !== undefined
            ? { notificationSettingsJson: d.notificationSettingsJson }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(centers.id, centerId))
        .returning();

      if (d.removeLogo && oldLogo) {
        await deleteUploadedImageByUrl(oldLogo);
      }
      if (d.removeFrontImage && oldBanner) {
        await deleteUploadedImageByUrl(oldBanner);
      }

      res.json({ center: withCenterDefaults(updated) });
    } catch (error) {
      console.error('Update center settings error:', error);
      res.status(500).json({ error: 'تعذر حفظ إعدادات المركز.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/branches',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const schema = z.object({
        name: z.string().trim().min(2, 'اسم الفرع مطلوب').max(140),
        city: z.string().trim().min(2, 'المدينة مطلوبة').max(100),
        address: z.string().trim().min(3, 'العنوان مطلوب').max(300),
        phone: z.string().trim().max(40).nullable().optional(),
        isMain: z.boolean().default(false),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الفرع غير صالحة.',
        });
      }

      const branch = await db.transaction(async (tx) => {
        if (parsed.data.isMain) {
          await tx
            .update(centerBranches)
            .set({ isMain: false })
            .where(eq(centerBranches.centerId, centerId));
        }
        const [created] = await tx
          .insert(centerBranches)
          .values({
            centerId,
            name: parsed.data.name,
            city: parsed.data.city,
            address: parsed.data.address,
            phone: parsed.data.phone || null,
            isMain: parsed.data.isMain,
            isActive: parsed.data.isActive,
          })
          .returning();
        return created;
      });

      res.status(201).json({ branch });
    } catch (error) {
      console.error('Create center branch error:', error);
      res.status(500).json({ error: 'تعذر إضافة الفرع.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/branches/:branchId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const branchId = Number(req.params.branchId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [existing] = await db
        .select()
        .from(centerBranches)
        .where(
          and(
            eq(centerBranches.id, branchId),
            eq(centerBranches.centerId, centerId)
          )
        )
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'الفرع غير موجود ضمن هذا المركز.' });
      }

      const schema = z.object({
        name: z.string().trim().min(2).max(140).optional(),
        city: z.string().trim().min(2).max(100).optional(),
        address: z.string().trim().min(3).max(300).optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        isMain: z.boolean().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات تعديل الفرع غير صالحة.' });
      }

      const updated = await db.transaction(async (tx) => {
        if (parsed.data.isMain) {
          await tx
            .update(centerBranches)
            .set({ isMain: false })
            .where(eq(centerBranches.centerId, centerId));
        }
        const [saved] = await tx
          .update(centerBranches)
          .set({
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
            ...(parsed.data.address !== undefined
              ? { address: parsed.data.address }
              : {}),
            ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
            ...(parsed.data.isMain !== undefined ? { isMain: parsed.data.isMain } : {}),
            ...(parsed.data.isActive !== undefined
              ? { isActive: parsed.data.isActive }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(centerBranches.id, branchId),
              eq(centerBranches.centerId, centerId)
            )
          )
          .returning();
        return saved;
      });

      res.json({ branch: updated });
    } catch (error) {
      console.error('Update center branch error:', error);
      res.status(500).json({ error: 'تعذر تحديث بيانات الفرع.' });
    }
  }
);

router.post(
  '/center-dashboard/:centerId/rooms',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const schema = z.object({
        branchId: z.number().int().positive(),
        name: z.string().trim().min(2, 'اسم القاعة مطلوب').max(120),
        roomNumber: z.string().trim().max(40).default(''),
        capacity: z.number().int().min(1).max(500),
        equipmentNotes: z.string().trim().max(300).nullable().optional(),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات القاعة غير صالحة.',
        });
      }

      const [branch] = await db
        .select({ id: centerBranches.id })
        .from(centerBranches)
        .where(
          and(
            eq(centerBranches.id, parsed.data.branchId),
            eq(centerBranches.centerId, centerId)
          )
        )
        .limit(1);
      if (!branch) {
        return res.status(400).json({ error: 'الفرع المختار لا يتبع هذا المركز.' });
      }

      const [room] = await db
        .insert(centerRooms)
        .values({
          centerId,
          branchId: parsed.data.branchId,
          name: parsed.data.name,
          roomNumber: parsed.data.roomNumber,
          capacity: parsed.data.capacity,
          equipmentNotes: parsed.data.equipmentNotes || null,
          isActive: parsed.data.isActive,
        })
        .returning();

      res.status(201).json({ room });
    } catch (error) {
      console.error('Create center room error:', error);
      res.status(500).json({ error: 'تعذر إضافة القاعة الدراسية.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/rooms/:roomId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const roomId = Number(req.params.roomId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_SETTINGS');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      const [existing] = await db
        .select()
        .from(centerRooms)
        .where(and(eq(centerRooms.id, roomId), eq(centerRooms.centerId, centerId)))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'القاعة غير موجودة ضمن هذا المركز.' });
      }

      const schema = z.object({
        branchId: z.number().int().positive().optional(),
        name: z.string().trim().min(2).max(120).optional(),
        roomNumber: z.string().trim().max(40).optional(),
        capacity: z.number().int().min(1).max(500).optional(),
        equipmentNotes: z.string().trim().max(300).nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات تعديل القاعة غير صالحة.' });
      }

      if (parsed.data.branchId) {
        const [branch] = await db
          .select({ id: centerBranches.id })
          .from(centerBranches)
          .where(
            and(
              eq(centerBranches.id, parsed.data.branchId),
              eq(centerBranches.centerId, centerId)
            )
          )
          .limit(1);
        if (!branch) {
          return res
            .status(400)
            .json({ error: 'الفرع المختار لا يتبع هذا المركز.' });
        }
      }

      const [updated] = await db
        .update(centerRooms)
        .set({
          ...(parsed.data.branchId !== undefined
            ? { branchId: parsed.data.branchId }
            : {}),
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.roomNumber !== undefined
            ? { roomNumber: parsed.data.roomNumber }
            : {}),
          ...(parsed.data.capacity !== undefined
            ? { capacity: parsed.data.capacity }
            : {}),
          ...(parsed.data.equipmentNotes !== undefined
            ? { equipmentNotes: parsed.data.equipmentNotes }
            : {}),
          ...(parsed.data.isActive !== undefined
            ? { isActive: parsed.data.isActive }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(centerRooms.id, roomId), eq(centerRooms.centerId, centerId)))
        .returning();

      res.json({ room: updated });
    } catch (error) {
      console.error('Update center room error:', error);
      res.status(500).json({ error: 'تعذر تحديث القاعة.' });
    }
  }
);

router.patch(
  '/center-dashboard/:centerId/staff-permissions/:memberId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.centerId);
      const memberId = Number(req.params.memberId);
      const auth = await resolveAuthorizedCenter(req, centerId, 'MANAGE_CENTER');
      if (!auth.ok) {
        return res.status(auth.status).json({ error: auth.error });
      }

      if (!auth.ctx.isOwner && !auth.ctx.isAdmin) {
        return res.status(403).json({
          error: 'إدارة صلاحيات الطاقم حصرية لمالك المركز فقط.',
        });
      }

      const [target] = await db
        .select()
        .from(centerMembers)
        .where(
          and(
            eq(centerMembers.id, memberId),
            eq(centerMembers.centerId, centerId)
          )
        )
        .limit(1);
      if (!target) {
        return res.status(404).json({ error: 'العضو غير موجود ضمن هذا المركز.' });
      }
      if (target.memberRole === 'OWNER') {
        return res.status(400).json({
          error: 'صلاحيات مالك المركز الكاملة محفوظة ولا يمكن تقليصها.',
        });
      }

      const schema = z.object({
        memberRole: z.enum(['MANAGER', 'INSTRUCTOR', 'STAFF']).optional(),
        permissions: z.array(
          z.enum([
            'MANAGE_STAFF',
            'MANAGE_STUDENTS',
            'MANAGE_COURSES',
            'MANAGE_SETTINGS',
            'VIEW_REPORTS',
            'VIEW_ENROLLMENTS',
          ])
        ),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'قائمة الصلاحيات غير صالحة.' });
      }

      const [updated] = await db
        .update(centerMembers)
        .set({
          ...(parsed.data.memberRole ? { memberRole: parsed.data.memberRole } : {}),
          permissionsJson: parsed.data.permissions,
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(centerMembers.id, memberId),
            eq(centerMembers.centerId, centerId)
          )
        )
        .returning();

      res.json({ member: updated });
    } catch (error) {
      console.error('Update staff permissions error:', error);
      res.status(500).json({ error: 'تعذر تحديث صلاحيات الموظف.' });
    }
  }
);

export default router;
