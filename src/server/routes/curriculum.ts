import { Router } from 'express';
import { z } from 'zod';
import { eq, and, asc, desc, inArray, isNull, gt, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  academicYears,
  baccalaureatePathways,
  courses,
  curriculumSubjects,
  curriculumVersions,
  educationalGrades,
  educationalStages,
  educationalSystems,
  fields,
  gradeSubjects,
  providerProfiles,
  roles,
  secondaryDivisions,
  sessionEnrollments,
  subjects,
  teacherTeachingAssignments,
  teachingSessions,
  userRoles,
  users,
} from '../../db/schema.ts';
import {
  optionalAuth,
  requireAuth,
  requireRole,
  type AuthRequest,
} from '../auth.ts';
import {
  canAssignTeacherToCurriculumSubject,
  computeIndividualSlotStatus,
  computeSessionAvailability,
  filterAndSortDiscoveredTeachers,
  formatOfflineAddress,
  isOfflineDeliveryMode,
  normalizeDeliveryMode,
  validateCurriculumContextCombination,
  type DeliveryMode,
  type SessionStatus,
  type SessionType,
} from '../../lib/domain.ts';

const router = Router();

const EGYPTIAN_STAGE_SLUGS = new Set(['primary', 'preparatory', 'secondary']);

async function getActiveVersionAndYear(
  requestedVersionId?: number,
  requestedYearId?: number
) {
  const [allYears, allVersions] = await Promise.all([
    db.select().from(academicYears).orderBy(desc(academicYears.isCurrent), asc(academicYears.id)),
    db
      .select()
      .from(curriculumVersions)
      .orderBy(desc(curriculumVersions.isActive), desc(curriculumVersions.id)),
  ]);

  let version = requestedVersionId
    ? allVersions.find((v) => v.id === requestedVersionId) || null
    : null;

  if (!version && requestedYearId) {
    version =
      allVersions.find(
        (v) => v.academicYearId === requestedYearId && v.isActive && v.isPublished
      ) ||
      allVersions.find((v) => v.academicYearId === requestedYearId && v.isPublished) ||
      null;
  }

  if (!version) {
    const currentYear = allYears.find((y) => y.isCurrent && y.isActive) || allYears[0];
    version =
      allVersions.find(
        (v) =>
          v.isActive &&
          v.isPublished &&
          (!currentYear || v.academicYearId === currentYear.id)
      ) ||
      allVersions.find((v) => v.isActive && v.isPublished) ||
      allVersions[0] ||
      null;
  }

  const academicYear = version
    ? allYears.find((y) => y.id === version!.academicYearId) || allYears[0] || null
    : allYears.find((y) => y.isCurrent) || allYears[0] || null;

  return { allYears, allVersions, version, academicYear };
}

function getCurriculumScopeCondition(
  versionId: number,
  gradeId: number,
  divisionId?: number | null,
  pathwayId?: number | null
) {
  const base = [
    eq(curriculumSubjects.curriculumVersionId, versionId),
    eq(curriculumSubjects.gradeId, gradeId),
    eq(curriculumSubjects.isActive, true),
  ];
  if (divisionId) {
    base.push(eq(curriculumSubjects.divisionId, divisionId));
  } else {
    base.push(isNull(curriculumSubjects.divisionId));
  }
  if (pathwayId) {
    base.push(eq(curriculumSubjects.pathwayId, pathwayId));
  } else {
    base.push(isNull(curriculumSubjects.pathwayId));
  }
  return and(...base);
}

// ----------------------------------------------------------------------------
// PUBLIC / STUDENT DISCOVERY ENDPOINTS
// ----------------------------------------------------------------------------

router.get('/curriculum/overview', async (req, res) => {
  try {
    const versionIdParam = req.query.versionId ? Number(req.query.versionId) : undefined;
    const yearIdParam = req.query.academicYearId ? Number(req.query.academicYearId) : undefined;

    const [
      { allYears, allVersions, version, academicYear },
      allStages,
      allSystems,
      allGrades,
      allDivisions,
      allPathways,
    ] = await Promise.all([
      getActiveVersionAndYear(versionIdParam, yearIdParam),
      db
        .select()
        .from(educationalStages)
        .where(eq(educationalStages.isActive, true))
        .orderBy(asc(educationalStages.sortOrder), asc(educationalStages.id)),
      db
        .select()
        .from(educationalSystems)
        .where(eq(educationalSystems.isActive, true))
        .orderBy(asc(educationalSystems.sortOrder), asc(educationalSystems.id)),
      db
        .select()
        .from(educationalGrades)
        .where(eq(educationalGrades.isActive, true))
        .orderBy(asc(educationalGrades.sortOrder), asc(educationalGrades.id)),
      db
        .select()
        .from(secondaryDivisions)
        .where(eq(secondaryDivisions.isActive, true))
        .orderBy(asc(secondaryDivisions.sortOrder), asc(secondaryDivisions.id)),
      db
        .select()
        .from(baccalaureatePathways)
        .where(eq(baccalaureatePathways.isActive, true))
        .orderBy(asc(baccalaureatePathways.sortOrder), asc(baccalaureatePathways.id)),
    ]);

    const systemStageIds = new Set(allSystems.map((s) => s.stageId));
    const schoolStages = allStages.filter(
      (s) => EGYPTIAN_STAGE_SLUGS.has(s.slug) || systemStageIds.has(s.id)
    );

    res.json({
      academicYears: allYears.filter((y) => y.isActive),
      activeAcademicYear: academicYear,
      versions: allVersions.filter((v) => v.isPublished && v.isActive),
      activeVersion: version,
      stages: schoolStages,
      systems: allSystems,
      grades: allGrades,
      divisions: allDivisions,
      pathways: allPathways,
    });
  } catch (error) {
    console.error('Curriculum overview error:', error);
    res.status(500).json({ error: 'تعذر جلب بيانات المراحل والمناهج التعليمية.' });
  }
});

router.get('/curriculum/academic-years', async (_req, res) => {
  try {
    const years = await db
      .select()
      .from(academicYears)
      .where(eq(academicYears.isActive, true))
      .orderBy(desc(academicYears.isCurrent), asc(academicYears.id));
    res.json({ academicYears: years });
  } catch (error) {
    console.error('Academic years list error:', error);
    res.status(500).json({ error: 'تعذر جلب السنوات الدراسية.' });
  }
});

router.get('/curriculum/stages', async (_req, res) => {
  try {
    const [allStages, allSystems] = await Promise.all([
      db
        .select()
        .from(educationalStages)
        .where(eq(educationalStages.isActive, true))
        .orderBy(asc(educationalStages.sortOrder), asc(educationalStages.id)),
      db.select({ stageId: educationalSystems.stageId }).from(educationalSystems),
    ]);
    const systemStageIds = new Set(allSystems.map((s) => s.stageId));
    res.json({
      stages: allStages.filter(
        (s) => EGYPTIAN_STAGE_SLUGS.has(s.slug) || systemStageIds.has(s.id)
      ),
    });
  } catch (error) {
    console.error('Curriculum stages error:', error);
    res.status(500).json({ error: 'تعذر جلب المراحل التعليمية.' });
  }
});

router.get('/curriculum/systems', async (req, res) => {
  try {
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const rows = stageId
      ? await db
          .select()
          .from(educationalSystems)
          .where(
            and(
              eq(educationalSystems.stageId, stageId),
              eq(educationalSystems.isActive, true)
            )
          )
          .orderBy(asc(educationalSystems.sortOrder), asc(educationalSystems.id))
      : await db
          .select()
          .from(educationalSystems)
          .where(eq(educationalSystems.isActive, true))
          .orderBy(asc(educationalSystems.sortOrder), asc(educationalSystems.id));
    res.json({ systems: rows });
  } catch (error) {
    console.error('Curriculum systems error:', error);
    res.status(500).json({ error: 'تعذر جلب الأنظمة التعليمية.' });
  }
});

router.get('/curriculum/grades', async (req, res) => {
  try {
    const systemId = req.query.systemId ? Number(req.query.systemId) : undefined;
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const rows = await db
      .select()
      .from(educationalGrades)
      .where(eq(educationalGrades.isActive, true))
      .orderBy(asc(educationalGrades.sortOrder), asc(educationalGrades.id));
    const filtered = rows.filter((g) => {
      if (systemId && g.systemId !== systemId) return false;
      if (stageId && g.stageId !== stageId) return false;
      return true;
    });
    res.json({ grades: filtered });
  } catch (error) {
    console.error('Curriculum grades error:', error);
    res.status(500).json({ error: 'تعذر جلب الصفوف الدراسية.' });
  }
});

router.get('/curriculum/divisions', async (req, res) => {
  try {
    const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
    const systemId = req.query.systemId ? Number(req.query.systemId) : undefined;
    const rows = await db
      .select()
      .from(secondaryDivisions)
      .where(eq(secondaryDivisions.isActive, true))
      .orderBy(asc(secondaryDivisions.sortOrder), asc(secondaryDivisions.id));
    res.json({
      divisions: rows.filter((d) => {
        if (gradeId && d.gradeId !== gradeId) return false;
        if (systemId && d.systemId !== systemId) return false;
        return true;
      }),
    });
  } catch (error) {
    console.error('Curriculum divisions error:', error);
    res.status(500).json({ error: 'تعذر جلب شعب الثانوية العامة.' });
  }
});

router.get('/curriculum/pathways', async (req, res) => {
  try {
    const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
    const systemId = req.query.systemId ? Number(req.query.systemId) : undefined;
    const rows = await db
      .select()
      .from(baccalaureatePathways)
      .where(eq(baccalaureatePathways.isActive, true))
      .orderBy(asc(baccalaureatePathways.sortOrder), asc(baccalaureatePathways.id));
    res.json({
      pathways: rows.filter((p) => {
        if (gradeId && p.gradeId !== gradeId) return false;
        if (systemId && p.systemId !== systemId) return false;
        return true;
      }),
    });
  } catch (error) {
    console.error('Curriculum pathways error:', error);
    res.status(500).json({ error: 'تعذر جلب مسارات البكالوريا المصرية.' });
  }
});

router.get('/curriculum/subjects', async (req, res) => {
  try {
    const systemId = req.query.systemId ? Number(req.query.systemId) : undefined;
    const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const divisionId = req.query.divisionId ? Number(req.query.divisionId) : null;
    const pathwayId = req.query.pathwayId ? Number(req.query.pathwayId) : null;
    const versionId = req.query.versionId ? Number(req.query.versionId) : undefined;
    const academicYearId = req.query.academicYearId
      ? Number(req.query.academicYearId)
      : undefined;
    const category =
      typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    if (!gradeId || !Number.isInteger(gradeId) || gradeId <= 0) {
      return res.status(400).json({ error: 'يرجى تحديد الصف الدراسي.' });
    }

    const [gradeRow] = await db
      .select()
      .from(educationalGrades)
      .where(eq(educationalGrades.id, gradeId))
      .limit(1);
    if (!gradeRow || !gradeRow.isActive) {
      return res.status(404).json({ error: 'الصف الدراسي غير موجود.' });
    }

    const resolvedSystemId = systemId || gradeRow.systemId;
    if (resolvedSystemId !== gradeRow.systemId) {
      return res.status(400).json({ error: 'الصف الدراسي المختار لا يتبع هذا النظام التعليمي.' });
    }
    if (stageId && stageId !== gradeRow.stageId) {
      return res.status(400).json({ error: 'الصف الدراسي المختار لا يتبع هذه المرحلة.' });
    }

    const [systemRow] = await db
      .select()
      .from(educationalSystems)
      .where(eq(educationalSystems.id, resolvedSystemId))
      .limit(1);
    if (!systemRow || !systemRow.isActive) {
      return res.status(404).json({ error: 'النظام التعليمي غير موجود.' });
    }

    let divisionRow: typeof secondaryDivisions.$inferSelect | null = null;
    if (divisionId) {
      const [row] = await db
        .select()
        .from(secondaryDivisions)
        .where(eq(secondaryDivisions.id, divisionId))
        .limit(1);
      if (!row || !row.isActive) {
        return res.status(400).json({ error: 'الشعبة المحددة غير صالحة.' });
      }
      divisionRow = row;
    }

    let pathwayRow: typeof baccalaureatePathways.$inferSelect | null = null;
    if (pathwayId) {
      const [row] = await db
        .select()
        .from(baccalaureatePathways)
        .where(eq(baccalaureatePathways.id, pathwayId))
        .limit(1);
      if (!row || !row.isActive) {
        return res.status(400).json({ error: 'المسار المحدد غير صالح.' });
      }
      pathwayRow = row;
    }

    const validation = validateCurriculumContextCombination({
      systemCode: systemRow.code,
      gradeNumber: gradeRow.gradeNumber,
      divisionId,
      pathwayId,
      divisionBelongsToGrade: divisionRow
        ? divisionRow.gradeId === gradeRow.id && divisionRow.systemId === systemRow.id
        : undefined,
      pathwayBelongsToGrade: pathwayRow
        ? pathwayRow.gradeId === gradeRow.id && pathwayRow.systemId === systemRow.id
        : undefined,
    });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.reason });
    }

    const { version, academicYear } = await getActiveVersionAndYear(
      versionId,
      academicYearId
    );
    if (!version) {
      return res.json({ version: null, academicYear, subjects: [] });
    }

    const rawRows = await db
      .select({
        id: curriculumSubjects.id,
        curriculumVersionId: curriculumSubjects.curriculumVersionId,
        academicYearId: curriculumSubjects.academicYearId,
        stageId: curriculumSubjects.stageId,
        systemId: curriculumSubjects.systemId,
        gradeId: curriculumSubjects.gradeId,
        divisionId: curriculumSubjects.divisionId,
        pathwayId: curriculumSubjects.pathwayId,
        subjectId: curriculumSubjects.subjectId,
        subjectSlug: subjects.slug,
        subjectNameAr: subjects.nameAr,
        subjectNameEn: subjects.nameEn,
        fieldId: fields.id,
        fieldNameAr: fields.nameAr,
        fieldNameEn: fields.nameEn,
        subjectType: curriculumSubjects.subjectType,
        isCompulsory: curriculumSubjects.isCompulsory,
        isElective: curriculumSubjects.isElective,
        isSpecialization: curriculumSubjects.isSpecialization,
        isIncludedInTotal: curriculumSubjects.isIncludedInTotal,
        isPassFail: curriculumSubjects.isPassFail,
        isNonTotal: curriculumSubjects.isNonTotal,
        isActivity: curriculumSubjects.isActivity,
        passThresholdPercent: curriculumSubjects.passThresholdPercent,
        electiveGroupCode: curriculumSubjects.electiveGroupCode,
        defaultLanguageOfInstruction: curriculumSubjects.defaultLanguageOfInstruction,
        languagesOfInstruction: curriculumSubjects.languagesOfInstructionJson,
        curriculumVariants: curriculumSubjects.curriculumVariantsJson,
        notesAr: curriculumSubjects.notesAr,
        notesEn: curriculumSubjects.notesEn,
        isAvailableForTeacherAssignment:
          curriculumSubjects.isAvailableForTeacherAssignment,
        sortOrder: curriculumSubjects.sortOrder,
      })
      .from(curriculumSubjects)
      .innerJoin(subjects, eq(curriculumSubjects.subjectId, subjects.id))
      .innerJoin(fields, eq(subjects.fieldId, fields.id))
      .where(
        getCurriculumScopeCondition(version.id, gradeRow.id, divisionId, pathwayId)
      )
      .orderBy(asc(curriculumSubjects.sortOrder), asc(curriculumSubjects.id));

    const csIds = rawRows.map((r) => r.id);
    const subjectIds = Array.from(new Set(rawRows.map((r) => r.subjectId)));

    const [activeAssignments, openSessionAggs] = await Promise.all([
      csIds.length > 0
        ? db
            .select({
              id: teacherTeachingAssignments.id,
              curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
              teacherUserId: teacherTeachingAssignments.teacherUserId,
              accountStatus: users.accountStatus,
            })
            .from(teacherTeachingAssignments)
            .innerJoin(users, eq(teacherTeachingAssignments.teacherUserId, users.id))
            .where(
              and(
                inArray(teacherTeachingAssignments.curriculumSubjectId, csIds),
                eq(teacherTeachingAssignments.isActive, true)
              )
            )
        : Promise.resolve([]),
      csIds.length > 0 && subjectIds.length > 0
        ? db
            .select({
              teacherUserId: teachingSessions.teacherUserId,
              curriculumSubjectId: teachingSessions.curriculumSubjectId,
              subjectId: teachingSessions.subjectId,
              gradeId: teachingSessions.gradeId,
              sessionCount: sql<number>`count(*)::int`,
            })
            .from(teachingSessions)
            .where(
              and(
                eq(teachingSessions.status, 'OPEN'),
                gt(teachingSessions.endTime, new Date()),
                or(
                  inArray(teachingSessions.curriculumSubjectId, csIds),
                  and(
                    isNull(teachingSessions.curriculumSubjectId),
                    inArray(teachingSessions.subjectId, subjectIds)
                  )
                )
              )
            )
            .groupBy(
              teachingSessions.teacherUserId,
              teachingSessions.curriculumSubjectId,
              teachingSessions.subjectId,
              teachingSessions.gradeId
            )
        : Promise.resolve([]),
    ]);

    const teachersByCs = new Map<number, Set<number>>();
    for (const a of activeAssignments) {
      if (a.accountStatus !== 'ACTIVE') continue;
      const set = teachersByCs.get(a.curriculumSubjectId) || new Set<number>();
      set.add(a.teacherUserId);
      teachersByCs.set(a.curriculumSubjectId, set);
    }

    const enriched = rawRows
      .filter((r) => {
        if (q) {
          const hay = `${r.subjectNameAr} ${r.subjectNameEn} ${r.notesAr || ''} ${
            r.notesEn || ''
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (category === 'CORE') {
          return r.isIncludedInTotal && !r.isActivity && !r.isNonTotal;
        }
        if (category === 'SPECIALIZATION_ELECTIVE') {
          return r.isSpecialization || r.isElective;
        }
        if (category === 'NON_TOTAL') {
          return (r.isNonTotal || !r.isIncludedInTotal) && !r.isActivity;
        }
        if (category === 'ACTIVITY') {
          return r.isActivity;
        }
        return true;
      })
      .map((r) => {
        const assignedTeacherSet = teachersByCs.get(r.id) || new Set<number>();
        let matchingSessionsCount = 0;
        for (const agg of openSessionAggs) {
          if (
            agg.curriculumSubjectId === r.id ||
            (agg.curriculumSubjectId === null &&
              agg.subjectId === r.subjectId &&
              assignedTeacherSet.has(agg.teacherUserId) &&
              (agg.gradeId === null || agg.gradeId === r.gradeId))
          ) {
            matchingSessionsCount += Number(agg.sessionCount || 0);
          }
        }

        return {
          ...r,
          activeTeachersCount: assignedTeacherSet.size,
          sessionsCount: matchingSessionsCount,
        };
      });

    res.json({
      academicYear,
      version,
      system: systemRow,
      grade: gradeRow,
      division: divisionRow,
      pathway: pathwayRow,
      subjects: enriched,
    });
  } catch (error) {
    console.error('Curriculum subjects error:', error);
    res.status(500).json({ error: 'تعذر جلب المواد الدراسية لهذا الصف.' });
  }
});

router.get(
  '/curriculum/subjects/:curriculumSubjectId/teachers',
  optionalAuth,
  async (req: AuthRequest, res) => {
    try {
      const curriculumSubjectId = Number(req.params.curriculumSubjectId);
      if (!Number.isInteger(curriculumSubjectId) || curriculumSubjectId <= 0) {
        return res.status(400).json({ error: 'معرف المادة المنهجية غير صالح.' });
      }

      const [csRow] = await db
        .select({
          id: curriculumSubjects.id,
          curriculumVersionId: curriculumSubjects.curriculumVersionId,
          academicYearId: curriculumSubjects.academicYearId,
          stageId: curriculumSubjects.stageId,
          systemId: curriculumSubjects.systemId,
          gradeId: curriculumSubjects.gradeId,
          divisionId: curriculumSubjects.divisionId,
          pathwayId: curriculumSubjects.pathwayId,
          subjectId: curriculumSubjects.subjectId,
          subjectNameAr: subjects.nameAr,
          subjectNameEn: subjects.nameEn,
          subjectType: curriculumSubjects.subjectType,
          isCompulsory: curriculumSubjects.isCompulsory,
          isElective: curriculumSubjects.isElective,
          isSpecialization: curriculumSubjects.isSpecialization,
          isIncludedInTotal: curriculumSubjects.isIncludedInTotal,
          isPassFail: curriculumSubjects.isPassFail,
          isNonTotal: curriculumSubjects.isNonTotal,
          isActivity: curriculumSubjects.isActivity,
          passThresholdPercent: curriculumSubjects.passThresholdPercent,
          electiveGroupCode: curriculumSubjects.electiveGroupCode,
          languagesOfInstruction: curriculumSubjects.languagesOfInstructionJson,
          curriculumVariants: curriculumSubjects.curriculumVariantsJson,
          notesAr: curriculumSubjects.notesAr,
          notesEn: curriculumSubjects.notesEn,
          systemCode: educationalSystems.code,
          systemNameAr: educationalSystems.nameAr,
          systemNameEn: educationalSystems.nameEn,
          gradeNameAr: educationalGrades.nameAr,
          gradeNameEn: educationalGrades.nameEn,
          gradeNumber: educationalGrades.gradeNumber,
          stageNameAr: educationalStages.nameAr,
          stageNameEn: educationalStages.nameEn,
          divisionNameAr: secondaryDivisions.nameAr,
          divisionNameEn: secondaryDivisions.nameEn,
          pathwayNameAr: baccalaureatePathways.nameAr,
          pathwayNameEn: baccalaureatePathways.nameEn,
        })
        .from(curriculumSubjects)
        .innerJoin(subjects, eq(curriculumSubjects.subjectId, subjects.id))
        .innerJoin(
          educationalSystems,
          eq(curriculumSubjects.systemId, educationalSystems.id)
        )
        .innerJoin(
          educationalGrades,
          eq(curriculumSubjects.gradeId, educationalGrades.id)
        )
        .innerJoin(
          educationalStages,
          eq(curriculumSubjects.stageId, educationalStages.id)
        )
        .leftJoin(
          secondaryDivisions,
          eq(curriculumSubjects.divisionId, secondaryDivisions.id)
        )
        .leftJoin(
          baccalaureatePathways,
          eq(curriculumSubjects.pathwayId, baccalaureatePathways.id)
        )
        .where(eq(curriculumSubjects.id, curriculumSubjectId))
        .limit(1);

      if (!csRow) {
        return res.status(404).json({ error: 'المادة الدراسية غير موجودة في المنهج.' });
      }

      const assignments = await db
        .select({
          assignmentId: teacherTeachingAssignments.id,
          teacherUserId: teacherTeachingAssignments.teacherUserId,
          languagesOffered: teacherTeachingAssignments.languagesOfferedJson,
          religiousVariant: teacherTeachingAssignments.religiousVariant,
          hourlyRate: teacherTeachingAssignments.hourlyRate,
          currency: teacherTeachingAssignments.currency,
          supportsOnline: teacherTeachingAssignments.supportsOnline,
          supportsInPerson: teacherTeachingAssignments.supportsInPerson,
          notes: teacherTeachingAssignments.notes,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          accountStatus: users.accountStatus,
          providerType: providerProfiles.providerType,
          headline: providerProfiles.headline,
          bio: providerProfiles.bio,
          qualifications: providerProfiles.qualifications,
          yearsExperience: providerProfiles.yearsExperience,
          profileHourlyRate: providerProfiles.hourlyRate,
          profileCurrency: providerProfiles.currency,
          verificationStatus: providerProfiles.verificationStatus,
          ratingAvg: providerProfiles.ratingAvg,
          reviewsCount: providerProfiles.reviewsCount,
        })
        .from(teacherTeachingAssignments)
        .innerJoin(users, eq(teacherTeachingAssignments.teacherUserId, users.id))
        .leftJoin(
          providerProfiles,
          eq(teacherTeachingAssignments.teacherUserId, providerProfiles.userId)
        )
        .where(
          and(
            eq(teacherTeachingAssignments.curriculumSubjectId, curriculumSubjectId),
            eq(teacherTeachingAssignments.isActive, true)
          )
        );

      const activeAssignments = assignments.filter((a) => a.accountStatus === 'ACTIVE');
      if (activeAssignments.length === 0) {
        return res.json({
          curriculumSubject: csRow,
          total: 0,
          page: 1,
          limit: 12,
          teachers: [],
        });
      }

      const teacherIds = activeAssignments.map((a) => a.teacherUserId);

      const [allTeacherAssignments, publishedCourses, teacherSessions] =
        await Promise.all([
          db
            .select({
              teacherUserId: teacherTeachingAssignments.teacherUserId,
              curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
              subjectNameAr: subjects.nameAr,
              subjectNameEn: subjects.nameEn,
              gradeNameAr: educationalGrades.nameAr,
              gradeNameEn: educationalGrades.nameEn,
              systemNameAr: educationalSystems.nameAr,
              systemNameEn: educationalSystems.nameEn,
              divisionNameAr: secondaryDivisions.nameAr,
              pathwayNameAr: baccalaureatePathways.nameAr,
            })
            .from(teacherTeachingAssignments)
            .innerJoin(subjects, eq(teacherTeachingAssignments.subjectId, subjects.id))
            .innerJoin(
              educationalGrades,
              eq(teacherTeachingAssignments.gradeId, educationalGrades.id)
            )
            .innerJoin(
              educationalSystems,
              eq(teacherTeachingAssignments.systemId, educationalSystems.id)
            )
            .leftJoin(
              secondaryDivisions,
              eq(teacherTeachingAssignments.divisionId, secondaryDivisions.id)
            )
            .leftJoin(
              baccalaureatePathways,
              eq(teacherTeachingAssignments.pathwayId, baccalaureatePathways.id)
            )
            .where(
              and(
                inArray(teacherTeachingAssignments.teacherUserId, teacherIds),
                eq(teacherTeachingAssignments.isActive, true)
              )
            ),
          db
            .select({
              id: courses.id,
              instructorUserId: courses.instructorUserId,
            })
            .from(courses)
            .where(
              and(
                inArray(courses.instructorUserId, teacherIds),
                eq(courses.status, 'PUBLISHED')
              )
            ),
          db
            .select()
            .from(teachingSessions)
            .where(
              and(
                inArray(teachingSessions.teacherUserId, teacherIds),
                inArray(teachingSessions.status, ['OPEN', 'FULL']),
                gt(teachingSessions.endTime, new Date()),
                or(
                  eq(teachingSessions.curriculumSubjectId, curriculumSubjectId),
                  and(
                    isNull(teachingSessions.curriculumSubjectId),
                    eq(teachingSessions.subjectId, csRow.subjectId),
                    or(
                      isNull(teachingSessions.gradeId),
                      eq(teachingSessions.gradeId, csRow.gradeId)
                    )
                  )
                )
              )
            )
            .orderBy(asc(teachingSessions.startTime)),
        ]);

      const relevantSessions = teacherSessions;

      const relevantSessionIds = relevantSessions.map((s) => s.id);
      const enrollmentRows =
        relevantSessionIds.length > 0
          ? await db
              .select({
                id: sessionEnrollments.id,
                sessionId: sessionEnrollments.sessionId,
                studentUserId: sessionEnrollments.studentUserId,
                status: sessionEnrollments.status,
              })
              .from(sessionEnrollments)
              .where(inArray(sessionEnrollments.sessionId, relevantSessionIds))
          : [];

      const religiousVariantFilter =
        typeof req.query.religiousVariant === 'string'
          ? req.query.religiousVariant.trim().toUpperCase()
          : '';

      const enrichedTeachers = activeAssignments
        .filter((a) => {
          if (
            religiousVariantFilter &&
            a.religiousVariant &&
            a.religiousVariant !== 'BOTH' &&
            a.religiousVariant !== religiousVariantFilter
          ) {
            return false;
          }
          return true;
        })
        .map((a) => {
          const tCourses = publishedCourses.filter(
            (c) => c.instructorUserId === a.teacherUserId
          );
          const tAllAssignments = allTeacherAssignments.filter(
            (ta) => ta.teacherUserId === a.teacherUserId
          );
          const tSessionsRaw = relevantSessions.filter(
            (s) => s.teacherUserId === a.teacherUserId
          );

          const formattedSessions = tSessionsRaw.map((s) => {
            const sessEnrs = enrollmentRows.filter((e) => e.sessionId === s.id);
            const acceptedCount = sessEnrs.filter(
              (e) => e.status === 'ACCEPTED'
            ).length;
            const pendingCount = sessEnrs.filter(
              (e) => e.status === 'PENDING'
            ).length;
            const avail = computeSessionAvailability({
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
            const myEnrollment = req.authUser
              ? sessEnrs.find((e) => e.studentUserId === req.authUser!.id) || null
              : null;
            const isTeacherOrAdmin = Boolean(
              req.authUser &&
                (req.authUser.id === s.teacherUserId ||
                  req.authUser.roles.includes('ADMIN'))
            );
            const isAccepted = myEnrollment?.status === 'ACCEPTED';
            const canSeeMeetingDetails = isTeacherOrAdmin || isAccepted;
            const isOffline = isOfflineDeliveryMode(s.deliveryMode);
            const publicLocation = isOffline
              ? s.location ||
                formatOfflineAddress({
                  governorate: s.governorate,
                  city: s.city,
                  district: s.district,
                  streetName: s.streetName,
                  buildingOrCenterName: s.buildingOrCenterName,
                  locationNotes: s.locationNotes,
                }) ||
                null
              : null;

            return {
              id: s.id,
              teacherUserId: s.teacherUserId,
              sessionType: s.sessionType as SessionType,
              title: s.title,
              description: s.description,
              startTime: s.startTime,
              endTime: s.endTime,
              durationMinutes: s.durationMinutes,
              capacity: avail.effectiveCapacity,
              acceptedCount,
              pendingCount,
              remainingSeats: avail.remainingSeats,
              isFull: avail.isFull,
              isRegistrationOpen: avail.isRegistrationOpen,
              slotStatus,
              price: s.price,
              currency: s.currency || 'EGP',
              deliveryMode: normalizeDeliveryMode(s.deliveryMode) as DeliveryMode,
              location: publicLocation,
              governorate: isOffline ? s.governorate : null,
              city: isOffline ? s.city : null,
              district: isOffline ? s.district : null,
              streetName: isOffline ? s.streetName : null,
              buildingOrCenterName: isOffline ? s.buildingOrCenterName : null,
              locationNotes: isOffline ? s.locationNotes : null,
              isDemoLocation: Boolean(s.isDemoLocation),
              meetingUrl: canSeeMeetingDetails ? s.meetingUrl : null,
              status: s.status as SessionStatus,
              curriculumSubjectId: s.curriculumSubjectId,
              gradeId: s.gradeId,
              systemId: s.systemId,
              divisionId: s.divisionId,
              pathwayId: s.pathwayId,
              myEnrollment,
            };
          });

          const individualCount = formattedSessions.filter(
            (s) => s.sessionType === 'ONE_TO_ONE' && s.isRegistrationOpen
          ).length;
          const groupCount = formattedSessions.filter(
            (s) => s.sessionType === 'GROUP' && s.isRegistrationOpen
          ).length;
          const onlineGroupSessionsCount = formattedSessions.filter(
            (s) => s.sessionType === 'GROUP' && s.deliveryMode === 'ONLINE' && s.isRegistrationOpen
          ).length;
          const onlineIndividualSlotsCount = formattedSessions.filter(
            (s) => s.sessionType === 'ONE_TO_ONE' && s.deliveryMode === 'ONLINE' && s.isRegistrationOpen
          ).length;
          const offlineGroupSessionsCount = formattedSessions.filter(
            (s) => s.sessionType === 'GROUP' && s.deliveryMode === 'IN_PERSON' && s.isRegistrationOpen
          ).length;

          const effectivePrice = Number(a.hourlyRate || a.profileHourlyRate || 120);

          return {
            teacherId: a.teacherUserId,
            assignmentId: a.assignmentId,
            fullName: a.fullName,
            avatarUrl: a.avatarUrl,
            providerType: a.providerType || 'TEACHER',
            jobTitle: a.headline || 'معلّم متخصص',
            headline: a.headline || 'معلّم متخصص',
            bio: a.bio || '',
            qualifications: a.qualifications || null,
            yearsExperience: a.yearsExperience ?? 1,
            verificationStatus: a.verificationStatus || 'PENDING',
            ratingAvg: Number(a.ratingAvg || 0),
            reviewsCount: a.reviewsCount ?? 0,
            effectivePrice,
            currency: a.currency || a.profileCurrency || 'EGP',
            supportsOnline: a.supportsOnline,
            supportsInPerson: a.supportsInPerson,
            languagesOffered:
              a.languagesOffered && a.languagesOffered.length > 0
                ? a.languagesOffered
                : csRow.languagesOfInstruction,
            religiousVariant: a.religiousVariant,
            assignmentNotes: a.notes,
            publishedCoursesCount: tCourses.length,
            individualSessionsCount: individualCount,
            groupSessionsCount: groupCount,
            onlineGroupSessionsCount,
            onlineIndividualSlotsCount,
            offlineGroupSessionsCount,
            sessions: formattedSessions,
            teachingAssignmentsSummary: tAllAssignments.map((ta) => ({
              curriculumSubjectId: ta.curriculumSubjectId,
              subjectNameAr: ta.subjectNameAr,
              subjectNameEn: ta.subjectNameEn,
              gradeNameAr: ta.gradeNameAr,
              gradeNameEn: ta.gradeNameEn,
              systemNameAr: ta.systemNameAr,
              systemNameEn: ta.systemNameEn,
              divisionNameAr: ta.divisionNameAr,
              pathwayNameAr: ta.pathwayNameAr,
            })),
          };
        });

      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const rawDelivery = typeof req.query.deliveryMode === 'string' ? req.query.deliveryMode.trim().toUpperCase() : '';
      const deliveryMode =
        rawDelivery === 'ONLINE'
          ? 'ONLINE'
          : isOfflineDeliveryMode(rawDelivery)
          ? 'IN_PERSON'
          : '';
      const language = typeof req.query.language === 'string' ? req.query.language : '';
      const hasSessionsOnly = req.query.hasSessions === 'true';
      const sortRaw = typeof req.query.sort === 'string' ? req.query.sort : 'rating';
      const allowedSorts = ['rating', 'price_asc', 'price_desc', 'experience', 'sessions'] as const;
      const sort = allowedSorts.includes(sortRaw as (typeof allowedSorts)[number])
        ? (sortRaw as (typeof allowedSorts)[number])
        : 'rating';

      const filteredAndSorted = filterAndSortDiscoveredTeachers(enrichedTeachers, {
        q,
        deliveryMode,
        language,
        hasSessionsOnly,
        sort,
      });

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
      const offset = (page - 1) * limit;
      const paged = filteredAndSorted.slice(offset, offset + limit);

      res.json({
        curriculumSubject: csRow,
        total: filteredAndSorted.length,
        page,
        limit,
        teachers: paged,
      });
    } catch (error) {
      console.error('Curriculum subject teachers error:', error);
      res.status(500).json({ error: 'تعذر جلب المعلّمين لهذه المادة الدراسية.' });
    }
  }
);

// ----------------------------------------------------------------------------
// TEACHER SELF-SERVICE TEACHING ASSIGNMENTS
// ----------------------------------------------------------------------------

router.get(
  '/teaching-assignments/mine',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const uid = req.authUser!.id;
      const rows = await db
        .select({
          id: teacherTeachingAssignments.id,
          curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
          subjectId: teacherTeachingAssignments.subjectId,
          gradeId: teacherTeachingAssignments.gradeId,
          systemId: teacherTeachingAssignments.systemId,
          divisionId: teacherTeachingAssignments.divisionId,
          pathwayId: teacherTeachingAssignments.pathwayId,
          languagesOffered: teacherTeachingAssignments.languagesOfferedJson,
          religiousVariant: teacherTeachingAssignments.religiousVariant,
          hourlyRate: teacherTeachingAssignments.hourlyRate,
          currency: teacherTeachingAssignments.currency,
          supportsOnline: teacherTeachingAssignments.supportsOnline,
          supportsInPerson: teacherTeachingAssignments.supportsInPerson,
          notes: teacherTeachingAssignments.notes,
          isActive: teacherTeachingAssignments.isActive,
          subjectNameAr: subjects.nameAr,
          subjectNameEn: subjects.nameEn,
          gradeNameAr: educationalGrades.nameAr,
          gradeNameEn: educationalGrades.nameEn,
          systemNameAr: educationalSystems.nameAr,
          systemNameEn: educationalSystems.nameEn,
          stageNameAr: educationalStages.nameAr,
          stageNameEn: educationalStages.nameEn,
          divisionNameAr: secondaryDivisions.nameAr,
          divisionNameEn: secondaryDivisions.nameEn,
          pathwayNameAr: baccalaureatePathways.nameAr,
          pathwayNameEn: baccalaureatePathways.nameEn,
        })
        .from(teacherTeachingAssignments)
        .innerJoin(subjects, eq(teacherTeachingAssignments.subjectId, subjects.id))
        .innerJoin(
          educationalGrades,
          eq(teacherTeachingAssignments.gradeId, educationalGrades.id)
        )
        .innerJoin(
          educationalSystems,
          eq(teacherTeachingAssignments.systemId, educationalSystems.id)
        )
        .innerJoin(
          educationalStages,
          eq(educationalSystems.stageId, educationalStages.id)
        )
        .leftJoin(
          secondaryDivisions,
          eq(teacherTeachingAssignments.divisionId, secondaryDivisions.id)
        )
        .leftJoin(
          baccalaureatePathways,
          eq(teacherTeachingAssignments.pathwayId, baccalaureatePathways.id)
        )
        .where(eq(teacherTeachingAssignments.teacherUserId, uid))
        .orderBy(asc(educationalGrades.sortOrder), asc(subjects.nameAr));

      res.json({ assignments: rows });
    } catch (error) {
      console.error('Get my teaching assignments error:', error);
      res.status(500).json({ error: 'تعذر جلب المواد والصفوف المعيّنة لك.' });
    }
  }
);

const upsertAssignmentSchema = z.object({
  curriculumSubjectId: z.number().int().positive(),
  languagesOffered: z.array(z.string().trim().min(2).max(10)).min(1).default(['ar']),
  religiousVariant: z.enum(['ISLAMIC', 'CHRISTIAN', 'BOTH']).optional().nullable(),
  hourlyRate: z.number().min(0).max(5000).optional().nullable(),
  currency: z.string().trim().min(3).max(6).default('USD'),
  supportsOnline: z.boolean().default(true),
  supportsInPerson: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
});

router.post(
  '/teaching-assignments/mine',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const parsed = upsertAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات تعيين المادة غير صالحة.',
        });
      }

      const d = parsed.data;
      const [csRow] = await db
        .select()
        .from(curriculumSubjects)
        .where(eq(curriculumSubjects.id, d.curriculumSubjectId))
        .limit(1);
      if (!csRow) {
        return res.status(404).json({ error: 'المادة المنهجية المحددة غير موجودة.' });
      }

      const assignable = canAssignTeacherToCurriculumSubject({
        isActive: csRow.isActive,
        isAvailableForTeacherAssignment: csRow.isAvailableForTeacherAssignment,
      });
      if (!assignable.allowed) {
        return res.status(400).json({ error: assignable.reason });
      }

      const uid = req.authUser!.id;
      const [saved] = await db
        .insert(teacherTeachingAssignments)
        .values({
          teacherUserId: uid,
          curriculumSubjectId: csRow.id,
          subjectId: csRow.subjectId,
          gradeId: csRow.gradeId,
          systemId: csRow.systemId,
          divisionId: csRow.divisionId,
          pathwayId: csRow.pathwayId,
          languagesOfferedJson: d.languagesOffered,
          religiousVariant: d.religiousVariant ?? null,
          hourlyRate: d.hourlyRate !== undefined && d.hourlyRate !== null ? d.hourlyRate.toFixed(2) : null,
          currency: d.currency.toUpperCase(),
          supportsOnline: d.supportsOnline,
          supportsInPerson: d.supportsInPerson,
          notes: d.notes?.trim() || null,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [
            teacherTeachingAssignments.teacherUserId,
            teacherTeachingAssignments.curriculumSubjectId,
          ],
          set: {
            languagesOfferedJson: d.languagesOffered,
            religiousVariant: d.religiousVariant ?? null,
            hourlyRate:
              d.hourlyRate !== undefined && d.hourlyRate !== null
                ? d.hourlyRate.toFixed(2)
                : null,
            currency: d.currency.toUpperCase(),
            supportsOnline: d.supportsOnline,
            supportsInPerson: d.supportsInPerson,
            notes: d.notes?.trim() || null,
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.status(201).json({ assignment: saved });
    } catch (error) {
      console.error('Create my teaching assignment error:', error);
      res.status(500).json({ error: 'تعذر حفظ تعيين المادة والصف.' });
    }
  }
);

router.patch(
  '/teaching-assignments/mine/:id',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'معرف التعيين غير صالح.' });
      }
      const schema = z.object({
        languagesOffered: z.array(z.string().trim().min(2).max(10)).min(1).optional(),
        religiousVariant: z.enum(['ISLAMIC', 'CHRISTIAN', 'BOTH']).optional().nullable(),
        hourlyRate: z.number().min(0).max(5000).optional().nullable(),
        supportsOnline: z.boolean().optional(),
        supportsInPerson: z.boolean().optional(),
        notes: z.string().trim().max(500).optional().nullable(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات التحديث غير صالحة.' });
      }

      const [existing] = await db
        .select()
        .from(teacherTeachingAssignments)
        .where(eq(teacherTeachingAssignments.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'التعيين غير موجود.' });
      }
      if (
        existing.teacherUserId !== req.authUser!.id &&
        !req.authUser!.roles.includes('ADMIN')
      ) {
        return res.status(403).json({ error: 'غير مصرح بتعديل تعيين معلّم آخر.' });
      }

      const d = parsed.data;
      const [updated] = await db
        .update(teacherTeachingAssignments)
        .set({
          ...(d.languagesOffered !== undefined
            ? { languagesOfferedJson: d.languagesOffered }
            : {}),
          ...(d.religiousVariant !== undefined
            ? { religiousVariant: d.religiousVariant }
            : {}),
          ...(d.hourlyRate !== undefined
            ? {
                hourlyRate:
                  d.hourlyRate !== null ? d.hourlyRate.toFixed(2) : null,
              }
            : {}),
          ...(d.supportsOnline !== undefined
            ? { supportsOnline: d.supportsOnline }
            : {}),
          ...(d.supportsInPerson !== undefined
            ? { supportsInPerson: d.supportsInPerson }
            : {}),
          ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          updatedAt: new Date(),
        })
        .where(eq(teacherTeachingAssignments.id, id))
        .returning();

      res.json({ assignment: updated });
    } catch (error) {
      console.error('Patch my teaching assignment error:', error);
      res.status(500).json({ error: 'تعذر تحديث بيانات التعيين.' });
    }
  }
);

router.delete(
  '/teaching-assignments/mine/:id',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'معرف التعيين غير صالح.' });
      }

      const [existing] = await db
        .select()
        .from(teacherTeachingAssignments)
        .where(eq(teacherTeachingAssignments.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'التعيين غير موجود.' });
      }
      if (
        existing.teacherUserId !== req.authUser!.id &&
        !req.authUser!.roles.includes('ADMIN')
      ) {
        return res.status(403).json({ error: 'غير مصرح بحذف تعيين معلّم آخر.' });
      }

      await db
        .delete(teacherTeachingAssignments)
        .where(eq(teacherTeachingAssignments.id, id));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete my teaching assignment error:', error);
      res.status(500).json({ error: 'تعذر حذف التعيين.' });
    }
  }
);

// ----------------------------------------------------------------------------
// ADMIN CURRICULUM MANAGEMENT ENDPOINTS (STRICT ADMIN ROLE)
// ----------------------------------------------------------------------------

router.get(
  '/admin/curriculum/all',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const versionId = req.query.versionId ? Number(req.query.versionId) : undefined;
      const gradeId = req.query.gradeId ? Number(req.query.gradeId) : undefined;

      const [
        allYears,
        allVersions,
        allStages,
        allSystems,
        allGrades,
        allDivisions,
        allPathways,
        allFields,
        allSubjects,
        allTeachers,
      ] = await Promise.all([
        db.select().from(academicYears).orderBy(desc(academicYears.isCurrent), asc(academicYears.id)),
        db.select().from(curriculumVersions).orderBy(desc(curriculumVersions.isActive), desc(curriculumVersions.id)),
        db.select().from(educationalStages).orderBy(asc(educationalStages.sortOrder), asc(educationalStages.id)),
        db.select().from(educationalSystems).orderBy(asc(educationalSystems.sortOrder), asc(educationalSystems.id)),
        db.select().from(educationalGrades).orderBy(asc(educationalGrades.sortOrder), asc(educationalGrades.id)),
        db.select().from(secondaryDivisions).orderBy(asc(secondaryDivisions.sortOrder), asc(secondaryDivisions.id)),
        db.select().from(baccalaureatePathways).orderBy(asc(baccalaureatePathways.sortOrder), asc(baccalaureatePathways.id)),
        db.select().from(fields).orderBy(asc(fields.id)),
        db.select().from(subjects).orderBy(asc(subjects.nameAr)),
        db
          .select({
            id: users.id,
            fullName: users.fullName,
            roleCode: roles.code,
          })
          .from(users)
          .innerJoin(userRoles, eq(users.id, userRoles.userId))
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(inArray(roles.code, ['TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'])),
      ]);

      const activeVersionId =
        versionId ||
        allVersions.find((v) => v.isActive)?.id ||
        allVersions[0]?.id;

      const csQueryRows = activeVersionId
        ? await db
            .select({
              id: curriculumSubjects.id,
              curriculumVersionId: curriculumSubjects.curriculumVersionId,
              academicYearId: curriculumSubjects.academicYearId,
              stageId: curriculumSubjects.stageId,
              systemId: curriculumSubjects.systemId,
              gradeId: curriculumSubjects.gradeId,
              divisionId: curriculumSubjects.divisionId,
              pathwayId: curriculumSubjects.pathwayId,
              subjectId: curriculumSubjects.subjectId,
              subjectNameAr: subjects.nameAr,
              subjectNameEn: subjects.nameEn,
              subjectType: curriculumSubjects.subjectType,
              isCompulsory: curriculumSubjects.isCompulsory,
              isElective: curriculumSubjects.isElective,
              isSpecialization: curriculumSubjects.isSpecialization,
              isIncludedInTotal: curriculumSubjects.isIncludedInTotal,
              isPassFail: curriculumSubjects.isPassFail,
              isNonTotal: curriculumSubjects.isNonTotal,
              isActivity: curriculumSubjects.isActivity,
              passThresholdPercent: curriculumSubjects.passThresholdPercent,
              electiveGroupCode: curriculumSubjects.electiveGroupCode,
              defaultLanguageOfInstruction:
                curriculumSubjects.defaultLanguageOfInstruction,
              languagesOfInstruction:
                curriculumSubjects.languagesOfInstructionJson,
              curriculumVariants: curriculumSubjects.curriculumVariantsJson,
              notesAr: curriculumSubjects.notesAr,
              notesEn: curriculumSubjects.notesEn,
              isAvailableForTeacherAssignment:
                curriculumSubjects.isAvailableForTeacherAssignment,
              isActive: curriculumSubjects.isActive,
              sortOrder: curriculumSubjects.sortOrder,
            })
            .from(curriculumSubjects)
            .innerJoin(subjects, eq(curriculumSubjects.subjectId, subjects.id))
            .where(
              gradeId
                ? and(
                    eq(curriculumSubjects.curriculumVersionId, activeVersionId),
                    eq(curriculumSubjects.gradeId, gradeId)
                  )
                : eq(curriculumSubjects.curriculumVersionId, activeVersionId)
            )
            .orderBy(asc(curriculumSubjects.gradeId), asc(curriculumSubjects.sortOrder), asc(curriculumSubjects.id))
        : [];

      const assignmentRows = await db
        .select({
          id: teacherTeachingAssignments.id,
          teacherUserId: teacherTeachingAssignments.teacherUserId,
          teacherName: users.fullName,
          curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
          subjectId: teacherTeachingAssignments.subjectId,
          subjectNameAr: subjects.nameAr,
          gradeId: teacherTeachingAssignments.gradeId,
          gradeNameAr: educationalGrades.nameAr,
          systemNameAr: educationalSystems.nameAr,
          divisionNameAr: secondaryDivisions.nameAr,
          pathwayNameAr: baccalaureatePathways.nameAr,
          languagesOffered: teacherTeachingAssignments.languagesOfferedJson,
          religiousVariant: teacherTeachingAssignments.religiousVariant,
          hourlyRate: teacherTeachingAssignments.hourlyRate,
          supportsOnline: teacherTeachingAssignments.supportsOnline,
          supportsInPerson: teacherTeachingAssignments.supportsInPerson,
          isActive: teacherTeachingAssignments.isActive,
        })
        .from(teacherTeachingAssignments)
        .innerJoin(users, eq(teacherTeachingAssignments.teacherUserId, users.id))
        .innerJoin(subjects, eq(teacherTeachingAssignments.subjectId, subjects.id))
        .innerJoin(
          educationalGrades,
          eq(teacherTeachingAssignments.gradeId, educationalGrades.id)
        )
        .innerJoin(
          educationalSystems,
          eq(teacherTeachingAssignments.systemId, educationalSystems.id)
        )
        .leftJoin(
          secondaryDivisions,
          eq(teacherTeachingAssignments.divisionId, secondaryDivisions.id)
        )
        .leftJoin(
          baccalaureatePathways,
          eq(teacherTeachingAssignments.pathwayId, baccalaureatePathways.id)
        )
        .orderBy(desc(teacherTeachingAssignments.id));

      const uniqueTeachers = Array.from(
        new Map(allTeachers.map((t) => [t.id, { id: t.id, fullName: t.fullName }])).values()
      );

      res.json({
        academicYears: allYears,
        versions: allVersions,
        selectedVersionId: activeVersionId || null,
        stages: allStages,
        systems: allSystems,
        grades: allGrades,
        divisions: allDivisions,
        pathways: allPathways,
        fields: allFields,
        masterSubjects: allSubjects,
        curriculumSubjects: csQueryRows,
        teacherAssignments: assignmentRows,
        teachers: uniqueTeachers,
      });
    } catch (error) {
      console.error('Admin curriculum overview error:', error);
      res.status(500).json({ error: 'تعذر جلب بيانات إدارة المناهج.' });
    }
  }
);

// Academic Years CRUD
router.post(
  '/admin/curriculum/academic-years',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().trim().min(4).max(30),
        nameAr: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().min(2).max(120),
        startDate: z.string().trim().optional().nullable(),
        endDate: z.string().trim().optional().nullable(),
        isCurrent: z.boolean().default(false),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات السنة الدراسية غير صالحة.' });
      }
      const d = parsed.data;
      const created = await db.transaction(async (tx) => {
        if (d.isCurrent) {
          await tx.update(academicYears).set({ isCurrent: false });
        }
        const [row] = await tx
          .insert(academicYears)
          .values({
            code: d.code,
            nameAr: d.nameAr,
            nameEn: d.nameEn,
            startDate: d.startDate || null,
            endDate: d.endDate || null,
            isCurrent: d.isCurrent,
            isActive: d.isActive,
          })
          .returning();
        return row;
      });
      res.status(201).json({ academicYear: created });
    } catch (error) {
      console.error('Create academic year error:', error);
      res.status(500).json({ error: 'تعذر إنشاء السنة الدراسية.' });
    }
  }
);

router.patch(
  '/admin/curriculum/academic-years/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(120).optional(),
        nameEn: z.string().trim().min(2).max(120).optional(),
        isCurrent: z.boolean().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات التعديل غير صالحة.' });
      }
      const updated = await db.transaction(async (tx) => {
        if (parsed.data.isCurrent) {
          await tx.update(academicYears).set({ isCurrent: false });
        }
        const [row] = await tx
          .update(academicYears)
          .set(parsed.data)
          .where(eq(academicYears.id, id))
          .returning();
        return row;
      });
      if (!updated) return res.status(404).json({ error: 'السنة غير موجودة.' });
      res.json({ academicYear: updated });
    } catch (error) {
      console.error('Update academic year error:', error);
      res.status(500).json({ error: 'تعذر تحديث السنة الدراسية.' });
    }
  }
);

// Curriculum Versions CRUD + Copy
router.post(
  '/admin/curriculum/versions',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        academicYearId: z.number().int().positive(),
        versionCode: z.string().trim().min(3).max(60),
        nameAr: z.string().trim().min(2).max(140),
        nameEn: z.string().trim().min(2).max(140),
        description: z.string().trim().max(500).optional().nullable(),
        isActive: z.boolean().default(false),
        isPublished: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات نسخة المنهج غير صالحة.' });
      }
      const d = parsed.data;
      const created = await db.transaction(async (tx) => {
        if (d.isActive) {
          await tx.update(curriculumVersions).set({ isActive: false });
        }
        const [row] = await tx
          .insert(curriculumVersions)
          .values({
            academicYearId: d.academicYearId,
            versionCode: d.versionCode,
            nameAr: d.nameAr,
            nameEn: d.nameEn,
            description: d.description || null,
            isActive: d.isActive,
            isPublished: d.isPublished,
          })
          .returning();
        return row;
      });
      res.status(201).json({ version: created });
    } catch (error) {
      console.error('Create version error:', error);
      res.status(500).json({ error: 'تعذر إنشاء نسخة المنهج.' });
    }
  }
);

router.patch(
  '/admin/curriculum/versions/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(140).optional(),
        nameEn: z.string().trim().min(2).max(140).optional(),
        description: z.string().trim().max(500).optional().nullable(),
        isActive: z.boolean().optional(),
        isPublished: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات تعديل النسخة غير صالحة.' });
      }
      const updated = await db.transaction(async (tx) => {
        if (parsed.data.isActive) {
          await tx.update(curriculumVersions).set({ isActive: false });
        }
        const [row] = await tx
          .update(curriculumVersions)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(curriculumVersions.id, id))
          .returning();
        return row;
      });
      if (!updated) return res.status(404).json({ error: 'النسخة غير موجودة.' });
      res.json({ version: updated });
    } catch (error) {
      console.error('Update version error:', error);
      res.status(500).json({ error: 'تعذر تحديث نسخة المنهج.' });
    }
  }
);

router.post(
  '/admin/curriculum/versions/:id/copy',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const sourceVersionId = Number(req.params.id);
      if (!Number.isInteger(sourceVersionId) || sourceVersionId <= 0) {
        return res.status(400).json({ error: 'معرف النسخة المصدر غير صالح.' });
      }

      const schema = z.object({
        academicYearId: z.number().int().positive(),
        versionCode: z.string().trim().min(3).max(60),
        nameAr: z.string().trim().min(2).max(140),
        nameEn: z.string().trim().min(2).max(140),
        description: z.string().trim().max(500).optional().nullable(),
        activate: z.boolean().default(false),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات النسخ غير مكتملة أو غير صالحة.' });
      }
      const d = parsed.data;

      const [sourceVersion] = await db
        .select()
        .from(curriculumVersions)
        .where(eq(curriculumVersions.id, sourceVersionId))
        .limit(1);
      if (!sourceVersion) {
        return res.status(404).json({ error: 'النسخة المصدر غير موجودة.' });
      }

      const [targetYear] = await db
        .select()
        .from(academicYears)
        .where(eq(academicYears.id, d.academicYearId))
        .limit(1);
      if (!targetYear) {
        return res.status(404).json({ error: 'السنة الدراسية المستهدفة غير موجودة.' });
      }

      const result = await db.transaction(async (tx) => {
        if (d.activate) {
          await tx.update(curriculumVersions).set({ isActive: false });
        }
        const [newVersion] = await tx
          .insert(curriculumVersions)
          .values({
            academicYearId: d.academicYearId,
            versionCode: d.versionCode,
            nameAr: d.nameAr,
            nameEn: d.nameEn,
            description: d.description || `نسخة مستنسخة من ${sourceVersion.nameAr}`,
            copiedFromVersionId: sourceVersionId,
            isActive: d.activate,
            isPublished: true,
          })
          .returning();

        const sourceItems = await tx
          .select()
          .from(curriculumSubjects)
          .where(eq(curriculumSubjects.curriculumVersionId, sourceVersionId));

        if (sourceItems.length > 0) {
          await tx.insert(curriculumSubjects).values(
            sourceItems.map((item) => ({
              curriculumVersionId: newVersion.id,
              academicYearId: d.academicYearId,
              stageId: item.stageId,
              systemId: item.systemId,
              gradeId: item.gradeId,
              divisionId: item.divisionId,
              pathwayId: item.pathwayId,
              gradeSubjectId: item.gradeSubjectId,
              subjectId: item.subjectId,
              subjectType: item.subjectType,
              isCompulsory: item.isCompulsory,
              isElective: item.isElective,
              isSpecialization: item.isSpecialization,
              isIncludedInTotal: item.isIncludedInTotal,
              isPassFail: item.isPassFail,
              isNonTotal: item.isNonTotal,
              isActivity: item.isActivity,
              passThresholdPercent: item.passThresholdPercent,
              electiveGroupCode: item.electiveGroupCode,
              defaultLanguageOfInstruction: item.defaultLanguageOfInstruction,
              languagesOfInstructionJson: item.languagesOfInstructionJson,
              curriculumVariantsJson: item.curriculumVariantsJson,
              notesAr: item.notesAr,
              notesEn: item.notesEn,
              isAvailableForTeacherAssignment: item.isAvailableForTeacherAssignment,
              isActive: item.isActive,
              sortOrder: item.sortOrder,
            }))
          );
        }

        return { version: newVersion, copiedCount: sourceItems.length };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Copy curriculum version error:', error);
      res.status(500).json({ error: 'تعذر نسخ نسخة المنهج.' });
    }
  }
);

// Stages, Systems, Grades, Divisions, Pathways CRUD
router.post(
  '/admin/curriculum/stages',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        slug: z.string().trim().min(2).max(60),
        nameAr: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().min(2).max(120),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات المرحلة غير صالحة.' });
      const [stage] = await db.insert(educationalStages).values(parsed.data).returning();
      res.status(201).json({ stage });
    } catch (error) {
      console.error('Create stage error:', error);
      res.status(500).json({ error: 'تعذر إضافة المرحلة.' });
    }
  }
);

router.patch(
  '/admin/curriculum/stages/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(120).optional(),
        nameEn: z.string().trim().min(2).max(120).optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات المرحلة غير صالحة.' });
      const [stage] = await db
        .update(educationalStages)
        .set(parsed.data)
        .where(eq(educationalStages.id, id))
        .returning();
      if (!stage) return res.status(404).json({ error: 'المرحلة غير موجودة.' });
      res.json({ stage });
    } catch (error) {
      console.error('Update stage error:', error);
      res.status(500).json({ error: 'تعذر تعديل المرحلة.' });
    }
  }
);

router.post(
  '/admin/curriculum/systems',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        stageId: z.number().int().positive(),
        code: z.string().trim().min(2).max(60),
        nameAr: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().min(2).max(120),
        descriptionAr: z.string().trim().optional().nullable(),
        descriptionEn: z.string().trim().optional().nullable(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات النظام غير صالحة.' });
      const [system] = await db.insert(educationalSystems).values(parsed.data).returning();
      res.status(201).json({ system });
    } catch (error) {
      console.error('Create system error:', error);
      res.status(500).json({ error: 'تعذر إضافة النظام التعليمي.' });
    }
  }
);

router.patch(
  '/admin/curriculum/systems/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(120).optional(),
        nameEn: z.string().trim().min(2).max(120).optional(),
        descriptionAr: z.string().trim().optional().nullable(),
        descriptionEn: z.string().trim().optional().nullable(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات النظام غير صالحة.' });
      const [system] = await db
        .update(educationalSystems)
        .set(parsed.data)
        .where(eq(educationalSystems.id, id))
        .returning();
      if (!system) return res.status(404).json({ error: 'النظام غير موجود.' });
      res.json({ system });
    } catch (error) {
      console.error('Update system error:', error);
      res.status(500).json({ error: 'تعذر تعديل النظام التعليمي.' });
    }
  }
);

router.post(
  '/admin/curriculum/grades',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        stageId: z.number().int().positive(),
        systemId: z.number().int().positive(),
        gradeNumber: z.number().int().min(1).max(12),
        slug: z.string().trim().min(2).max(60),
        nameAr: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().min(2).max(120),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات الصف غير صالحة.' });
      const [grade] = await db.insert(educationalGrades).values(parsed.data).returning();
      res.status(201).json({ grade });
    } catch (error) {
      console.error('Create grade error:', error);
      res.status(500).json({ error: 'تعذر إضافة الصف الدراسي.' });
    }
  }
);

router.patch(
  '/admin/curriculum/grades/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(120).optional(),
        nameEn: z.string().trim().min(2).max(120).optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات الصف غير صالحة.' });
      const [grade] = await db
        .update(educationalGrades)
        .set(parsed.data)
        .where(eq(educationalGrades.id, id))
        .returning();
      if (!grade) return res.status(404).json({ error: 'الصف غير موجود.' });
      res.json({ grade });
    } catch (error) {
      console.error('Update grade error:', error);
      res.status(500).json({ error: 'تعذر تعديل الصف الدراسي.' });
    }
  }
);

router.post(
  '/admin/curriculum/divisions',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        systemId: z.number().int().positive(),
        gradeId: z.number().int().positive(),
        code: z.string().trim().min(2).max(60),
        nameAr: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().min(2).max(120),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات الشعبة غير صالحة.' });
      const [division] = await db.insert(secondaryDivisions).values(parsed.data).returning();
      res.status(201).json({ division });
    } catch (error) {
      console.error('Create division error:', error);
      res.status(500).json({ error: 'تعذر إضافة الشعبة.' });
    }
  }
);

router.patch(
  '/admin/curriculum/divisions/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(120).optional(),
        nameEn: z.string().trim().min(2).max(120).optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات الشعبة غير صالحة.' });
      const [division] = await db
        .update(secondaryDivisions)
        .set(parsed.data)
        .where(eq(secondaryDivisions.id, id))
        .returning();
      if (!division) return res.status(404).json({ error: 'الشعبة غير موجودة.' });
      res.json({ division });
    } catch (error) {
      console.error('Update division error:', error);
      res.status(500).json({ error: 'تعذر تعديل الشعبة.' });
    }
  }
);

router.post(
  '/admin/curriculum/pathways',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        systemId: z.number().int().positive(),
        gradeId: z.number().int().positive(),
        code: z.string().trim().min(2).max(60),
        nameAr: z.string().trim().min(2).max(120),
        nameEn: z.string().trim().min(2).max(120),
        descriptionAr: z.string().trim().optional().nullable(),
        descriptionEn: z.string().trim().optional().nullable(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات المسار غير صالحة.' });
      const [pathway] = await db.insert(baccalaureatePathways).values(parsed.data).returning();
      res.status(201).json({ pathway });
    } catch (error) {
      console.error('Create pathway error:', error);
      res.status(500).json({ error: 'تعذر إضافة المسار.' });
    }
  }
);

router.patch(
  '/admin/curriculum/pathways/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        nameAr: z.string().trim().min(2).max(120).optional(),
        nameEn: z.string().trim().min(2).max(120).optional(),
        descriptionAr: z.string().trim().optional().nullable(),
        descriptionEn: z.string().trim().optional().nullable(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات المسار غير صالحة.' });
      const [pathway] = await db
        .update(baccalaureatePathways)
        .set(parsed.data)
        .where(eq(baccalaureatePathways.id, id))
        .returning();
      if (!pathway) return res.status(404).json({ error: 'المسار غير موجود.' });
      res.json({ pathway });
    } catch (error) {
      console.error('Update pathway error:', error);
      res.status(500).json({ error: 'تعذر تعديل المسار.' });
    }
  }
);

// Master Subjects CRUD
router.post(
  '/admin/curriculum/subjects',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        fieldId: z.number().int().positive(),
        stageId: z.number().int().positive().optional().nullable(),
        nameAr: z.string().trim().min(2).max(160),
        nameEn: z.string().trim().min(2).max(160),
        slug: z.string().trim().min(2).max(80).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات المادة غير صالحة.' });
      const slug =
        parsed.data.slug?.trim() ||
        `eg-custom-${parsed.data.nameEn
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${Date.now()}`;
      const [subject] = await db
        .insert(subjects)
        .values({
          fieldId: parsed.data.fieldId,
          stageId: parsed.data.stageId ?? null,
          slug,
          nameAr: parsed.data.nameAr,
          nameEn: parsed.data.nameEn,
          isActive: true,
        })
        .returning();
      res.status(201).json({ subject });
    } catch (error) {
      console.error('Create master subject error:', error);
      res.status(500).json({ error: 'تعذر إنشاء المادة الدراسية.' });
    }
  }
);

router.patch(
  '/admin/curriculum/subjects/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        fieldId: z.number().int().positive().optional(),
        nameAr: z.string().trim().min(2).max(160).optional(),
        nameEn: z.string().trim().min(2).max(160).optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات التعديل غير صالحة.' });
      const [subject] = await db
        .update(subjects)
        .set(parsed.data)
        .where(eq(subjects.id, id))
        .returning();
      if (!subject) return res.status(404).json({ error: 'المادة غير موجودة.' });
      res.json({ subject });
    } catch (error) {
      console.error('Update master subject error:', error);
      res.status(500).json({ error: 'تعذر تعديل المادة.' });
    }
  }
);

// Curriculum Subject Assignments (Version + Grade + Division/Pathway + Flags)
router.post(
  '/admin/curriculum/curriculum-subjects',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = z.object({
        curriculumVersionId: z.number().int().positive(),
        gradeId: z.number().int().positive(),
        divisionId: z.number().int().positive().optional().nullable(),
        pathwayId: z.number().int().positive().optional().nullable(),
        subjectId: z.number().int().positive(),
        subjectType: z
          .enum([
            'CORE',
            'NON_TOTAL',
            'ACTIVITY',
            'ELECTIVE',
            'SPECIALIZATION',
            'ADDITIONAL_SCHOOL',
            'RELIGIOUS',
            'FOREIGN_LANGUAGE',
          ])
          .default('CORE'),
        isCompulsory: z.boolean().default(true),
        isElective: z.boolean().default(false),
        isSpecialization: z.boolean().default(false),
        isIncludedInTotal: z.boolean().default(true),
        isPassFail: z.boolean().default(false),
        isNonTotal: z.boolean().default(false),
        isActivity: z.boolean().default(false),
        passThresholdPercent: z.number().int().min(1).max(100).optional().nullable(),
        electiveGroupCode: z.string().trim().max(60).optional().nullable(),
        languagesOfInstruction: z.array(z.string().trim().min(2).max(10)).default(['ar']),
        curriculumVariants: z.array(z.string().trim().min(2).max(40)).default([]),
        notesAr: z.string().trim().max(400).optional().nullable(),
        notesEn: z.string().trim().max(400).optional().nullable(),
        isAvailableForTeacherAssignment: z.boolean().default(true),
        isActive: z.boolean().default(true),
        sortOrder: z.number().int().default(10),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات ربط المادة بالمنهج غير صالحة.',
        });
      }
      const d = parsed.data;

      const [[versionRow], [gradeRow]] = await Promise.all([
        db
          .select()
          .from(curriculumVersions)
          .where(eq(curriculumVersions.id, d.curriculumVersionId))
          .limit(1),
        db
          .select()
          .from(educationalGrades)
          .where(eq(educationalGrades.id, d.gradeId))
          .limit(1),
      ]);

      if (!versionRow) return res.status(404).json({ error: 'نسخة المنهج غير موجودة.' });
      if (!gradeRow) return res.status(404).json({ error: 'الصف الدراسي غير موجود.' });

      const [systemRow] = await db
        .select()
        .from(educationalSystems)
        .where(eq(educationalSystems.id, gradeRow.systemId))
        .limit(1);
      if (!systemRow) return res.status(404).json({ error: 'النظام التعليمي غير موجود.' });

      let divisionBelongs: boolean | undefined;
      if (d.divisionId) {
        const [divRow] = await db
          .select()
          .from(secondaryDivisions)
          .where(eq(secondaryDivisions.id, d.divisionId))
          .limit(1);
        divisionBelongs = Boolean(
          divRow && divRow.gradeId === gradeRow.id && divRow.systemId === systemRow.id
        );
      }

      let pathwayBelongs: boolean | undefined;
      if (d.pathwayId) {
        const [pwRow] = await db
          .select()
          .from(baccalaureatePathways)
          .where(eq(baccalaureatePathways.id, d.pathwayId))
          .limit(1);
        pathwayBelongs = Boolean(
          pwRow && pwRow.gradeId === gradeRow.id && pwRow.systemId === systemRow.id
        );
      }

      const check = validateCurriculumContextCombination({
        systemCode: systemRow.code,
        gradeNumber: gradeRow.gradeNumber,
        divisionId: d.divisionId ?? null,
        pathwayId: d.pathwayId ?? null,
        divisionBelongsToGrade: divisionBelongs,
        pathwayBelongsToGrade: pathwayBelongs,
      });
      if (!check.valid) {
        return res.status(400).json({ error: check.reason });
      }

      const existingSameScope = await db
        .select({ id: curriculumSubjects.id })
        .from(curriculumSubjects)
        .where(
          and(
            eq(curriculumSubjects.curriculumVersionId, d.curriculumVersionId),
            eq(curriculumSubjects.gradeId, d.gradeId),
            eq(curriculumSubjects.subjectId, d.subjectId),
            d.divisionId
              ? eq(curriculumSubjects.divisionId, d.divisionId)
              : isNull(curriculumSubjects.divisionId),
            d.pathwayId
              ? eq(curriculumSubjects.pathwayId, d.pathwayId)
              : isNull(curriculumSubjects.pathwayId)
          )
        )
        .limit(1);
      if (existingSameScope.length > 0) {
        return res
          .status(409)
          .json({ error: 'هذه المادة مضافة بالفعل لنفس الصف والشعبة/المسار في هذه النسخة.' });
      }

      const [gsRow] = await db
        .insert(gradeSubjects)
        .values({ gradeId: d.gradeId, subjectId: d.subjectId, isActive: true })
        .onConflictDoUpdate({
          target: [gradeSubjects.gradeId, gradeSubjects.subjectId],
          set: { isActive: true },
        })
        .returning();

      const [created] = await db
        .insert(curriculumSubjects)
        .values({
          curriculumVersionId: d.curriculumVersionId,
          academicYearId: versionRow.academicYearId,
          stageId: gradeRow.stageId,
          systemId: gradeRow.systemId,
          gradeId: d.gradeId,
          divisionId: d.divisionId ?? null,
          pathwayId: d.pathwayId ?? null,
          gradeSubjectId: gsRow.id,
          subjectId: d.subjectId,
          subjectType: d.subjectType,
          isCompulsory: d.isCompulsory,
          isElective: d.isElective,
          isSpecialization: d.isSpecialization,
          isIncludedInTotal: d.isIncludedInTotal,
          isPassFail: d.isPassFail,
          isNonTotal: d.isNonTotal,
          isActivity: d.isActivity,
          passThresholdPercent: d.passThresholdPercent ?? null,
          electiveGroupCode: d.electiveGroupCode?.trim() || null,
          defaultLanguageOfInstruction: d.languagesOfInstruction[0] || 'ar',
          languagesOfInstructionJson: d.languagesOfInstruction,
          curriculumVariantsJson: d.curriculumVariants,
          notesAr: d.notesAr?.trim() || null,
          notesEn: d.notesEn?.trim() || null,
          isAvailableForTeacherAssignment: d.isAvailableForTeacherAssignment,
          isActive: d.isActive,
          sortOrder: d.sortOrder,
        })
        .returning();

      res.status(201).json({ curriculumSubject: created });
    } catch (error) {
      console.error('Create curriculum subject error:', error);
      res.status(500).json({ error: 'تعذر إضافة المادة إلى نسخة المنهج.' });
    }
  }
);

router.patch(
  '/admin/curriculum/curriculum-subjects/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        subjectType: z
          .enum([
            'CORE',
            'NON_TOTAL',
            'ACTIVITY',
            'ELECTIVE',
            'SPECIALIZATION',
            'ADDITIONAL_SCHOOL',
            'RELIGIOUS',
            'FOREIGN_LANGUAGE',
          ])
          .optional(),
        isCompulsory: z.boolean().optional(),
        isElective: z.boolean().optional(),
        isSpecialization: z.boolean().optional(),
        isIncludedInTotal: z.boolean().optional(),
        isPassFail: z.boolean().optional(),
        isNonTotal: z.boolean().optional(),
        isActivity: z.boolean().optional(),
        passThresholdPercent: z.number().int().min(1).max(100).optional().nullable(),
        languagesOfInstruction: z.array(z.string()).optional(),
        curriculumVariants: z.array(z.string()).optional(),
        notesAr: z.string().trim().max(400).optional().nullable(),
        notesEn: z.string().trim().max(400).optional().nullable(),
        isAvailableForTeacherAssignment: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات التحديث غير صالحة.' });

      const d = parsed.data;
      const [updated] = await db
        .update(curriculumSubjects)
        .set({
          ...(d.subjectType !== undefined ? { subjectType: d.subjectType } : {}),
          ...(d.isCompulsory !== undefined ? { isCompulsory: d.isCompulsory } : {}),
          ...(d.isElective !== undefined ? { isElective: d.isElective } : {}),
          ...(d.isSpecialization !== undefined
            ? { isSpecialization: d.isSpecialization }
            : {}),
          ...(d.isIncludedInTotal !== undefined
            ? { isIncludedInTotal: d.isIncludedInTotal }
            : {}),
          ...(d.isPassFail !== undefined ? { isPassFail: d.isPassFail } : {}),
          ...(d.isNonTotal !== undefined ? { isNonTotal: d.isNonTotal } : {}),
          ...(d.isActivity !== undefined ? { isActivity: d.isActivity } : {}),
          ...(d.passThresholdPercent !== undefined
            ? { passThresholdPercent: d.passThresholdPercent }
            : {}),
          ...(d.languagesOfInstruction !== undefined
            ? { languagesOfInstructionJson: d.languagesOfInstruction }
            : {}),
          ...(d.curriculumVariants !== undefined
            ? { curriculumVariantsJson: d.curriculumVariants }
            : {}),
          ...(d.notesAr !== undefined ? { notesAr: d.notesAr } : {}),
          ...(d.notesEn !== undefined ? { notesEn: d.notesEn } : {}),
          ...(d.isAvailableForTeacherAssignment !== undefined
            ? { isAvailableForTeacherAssignment: d.isAvailableForTeacherAssignment }
            : {}),
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
          updatedAt: new Date(),
        })
        .where(eq(curriculumSubjects.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'السجل غير موجود.' });
      res.json({ curriculumSubject: updated });
    } catch (error) {
      console.error('Update curriculum subject error:', error);
      res.status(500).json({ error: 'تعذر تحديث المادة في المنهج.' });
    }
  }
);

router.delete(
  '/admin/curriculum/curriculum-subjects/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const deleted = await db
        .delete(curriculumSubjects)
        .where(eq(curriculumSubjects.id, id))
        .returning();
      if (deleted.length === 0) return res.status(404).json({ error: 'السجل غير موجود.' });
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete curriculum subject error:', error);
      res.status(500).json({ error: 'تعذر حذف المادة من المنهج.' });
    }
  }
);

// Admin Teacher Assignments CRUD
router.post(
  '/admin/curriculum/assignments',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schema = upsertAssignmentSchema.extend({
        teacherUserId: z.number().int().positive(),
        isActive: z.boolean().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'بيانات تعيين المعلّم غير صالحة.' });
      }
      const d = parsed.data;
      const [[csRow], [teacherRow]] = await Promise.all([
        db
          .select()
          .from(curriculumSubjects)
          .where(eq(curriculumSubjects.id, d.curriculumSubjectId))
          .limit(1),
        db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, d.teacherUserId))
          .limit(1),
      ]);
      if (!csRow) return res.status(404).json({ error: 'المادة المنهجية غير موجودة.' });
      if (!teacherRow) return res.status(404).json({ error: 'المعلّم غير موجود.' });

      const [saved] = await db
        .insert(teacherTeachingAssignments)
        .values({
          teacherUserId: d.teacherUserId,
          curriculumSubjectId: csRow.id,
          subjectId: csRow.subjectId,
          gradeId: csRow.gradeId,
          systemId: csRow.systemId,
          divisionId: csRow.divisionId,
          pathwayId: csRow.pathwayId,
          languagesOfferedJson: d.languagesOffered,
          religiousVariant: d.religiousVariant ?? null,
          hourlyRate: d.hourlyRate !== undefined && d.hourlyRate !== null ? d.hourlyRate.toFixed(2) : null,
          currency: d.currency.toUpperCase(),
          supportsOnline: d.supportsOnline,
          supportsInPerson: d.supportsInPerson,
          notes: d.notes?.trim() || null,
          isActive: d.isActive,
        })
        .onConflictDoUpdate({
          target: [
            teacherTeachingAssignments.teacherUserId,
            teacherTeachingAssignments.curriculumSubjectId,
          ],
          set: {
            languagesOfferedJson: d.languagesOffered,
            religiousVariant: d.religiousVariant ?? null,
            hourlyRate:
              d.hourlyRate !== undefined && d.hourlyRate !== null
                ? d.hourlyRate.toFixed(2)
                : null,
            supportsOnline: d.supportsOnline,
            supportsInPerson: d.supportsInPerson,
            notes: d.notes?.trim() || null,
            isActive: d.isActive,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.status(201).json({ assignment: saved });
    } catch (error) {
      console.error('Admin assign teacher error:', error);
      res.status(500).json({ error: 'تعذر حفظ تعيين المعلّم للمادة.' });
    }
  }
);

router.patch(
  '/admin/curriculum/assignments/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const schema = z.object({
        isActive: z.boolean().optional(),
        languagesOffered: z.array(z.string()).optional(),
        hourlyRate: z.number().min(0).max(5000).optional().nullable(),
        supportsOnline: z.boolean().optional(),
        supportsInPerson: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'بيانات التعديل غير صالحة.' });

      const d = parsed.data;
      const [updated] = await db
        .update(teacherTeachingAssignments)
        .set({
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          ...(d.languagesOffered !== undefined
            ? { languagesOfferedJson: d.languagesOffered }
            : {}),
          ...(d.hourlyRate !== undefined
            ? { hourlyRate: d.hourlyRate !== null ? d.hourlyRate.toFixed(2) : null }
            : {}),
          ...(d.supportsOnline !== undefined
            ? { supportsOnline: d.supportsOnline }
            : {}),
          ...(d.supportsInPerson !== undefined
            ? { supportsInPerson: d.supportsInPerson }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(teacherTeachingAssignments.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'التعيين غير موجود.' });
      res.json({ assignment: updated });
    } catch (error) {
      console.error('Admin update assignment error:', error);
      res.status(500).json({ error: 'تعذر تحديث التعيين.' });
    }
  }
);

router.delete(
  '/admin/curriculum/assignments/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const deleted = await db
        .delete(teacherTeachingAssignments)
        .where(eq(teacherTeachingAssignments.id, id))
        .returning();
      if (deleted.length === 0) return res.status(404).json({ error: 'التعيين غير موجود.' });
      res.json({ deleted: true });
    } catch (error) {
      console.error('Admin delete assignment error:', error);
      res.status(500).json({ error: 'تعذر حذف التعيين.' });
    }
  }
);

export default router;
