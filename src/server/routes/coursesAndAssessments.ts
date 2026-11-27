import express, { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, ilike, or, inArray, notInArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  courses,
  courseLessons,
  enrollments,
  progress,
  lessonProgress,
  users,
  fields,
  subjects,
  educationalStages,
  educationalSystems,
  educationalGrades,
  secondaryDivisions,
  baccalaureatePathways,
  providerProfiles,
  centers,
  centerStudents,
  quizzes,
  questions,
  quizAnswers,
  quizAttempts,
  quizAttemptAnswers,
  assignments,
  assignmentSubmissions,
  reviews,
  certificates,
  payments,
  earnings,
  studyGroups,
  groupMembers,
  platformSettings,
  notifications,
} from '../../db/schema.ts';
import {
  requireAuth,
  optionalAuth,
  requireRole,
  type AuthRequest,
} from '../auth.ts';
import {
  calculateCompletionPercent,
  calculateCommissionAndNet,
  canCourseAcceptNewEnrollment,
  gradeQuizAttempt,
  MAX_COURSE_IMAGE_BYTES,
  resolveCourseFieldDisplay,
  validateCourseLessonInput,
  validateManualCourseField,
} from '../../lib/domain.ts';
import {
  deleteUploadedImageByUrl,
  isAllowedStoredImageUrl,
  saveValidatedImageUpload,
} from '../uploadStorage.ts';
import {
  canUserManageCourse,
  resolveAnchorFieldId,
  validateCourseCurriculumIds,
} from '../courseHelpers.ts';

const router = Router();

router.post(
  '/courses/cover-image',
  requireAuth,
  requireRole(
    'TEACHER',
    'MENTOR',
    'EXPERT',
    'CENTER_OWNER',
    'CENTER_STAFF',
    'ADMIN'
  ),
  express.raw({ type: '*/*', limit: '6mb' }),
  async (req: AuthRequest, res) => {
    try {
      const mimeType = String(req.headers['content-type'] || '')
        .split(';')[0]
        .trim();
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

      const courseIdParam = req.query.courseId
        ? Number(req.query.courseId)
        : null;
      let targetCourse: typeof courses.$inferSelect | null = null;
      if (courseIdParam !== null) {
        if (!Number.isInteger(courseIdParam) || courseIdParam <= 0) {
          return res.status(400).json({ error: 'معرف الدورة غير صالح.' });
        }
        const [found] = await db
          .select()
          .from(courses)
          .where(eq(courses.id, courseIdParam))
          .limit(1);
        if (!found) {
          return res.status(404).json({ error: 'الدورة غير موجودة.' });
        }
        const allowed = await canUserManageCourse(req.authUser!, found);
        if (!allowed) {
          return res
            .status(403)
            .json({ error: 'لا تملك صلاحية تعديل صورة هذه الدورة.' });
        }
        targetCourse = found;
      }

      const saved = await saveValidatedImageUpload({
        category: 'courses',
        userId: req.authUser!.id,
        mimeType,
        fileName,
        buffer,
      });

      if (!saved.ok) {
        return res.status(saved.status).json({ error: saved.error });
      }

      if (targetCourse) {
        const previousUrl = targetCourse.thumbnailUrl;
        await db
          .update(courses)
          .set({
            thumbnailUrl: saved.url,
            coverImageKey: saved.filename,
            updatedAt: new Date(),
          })
          .where(eq(courses.id, targetCourse.id));

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
      console.error('Upload provider course image error:', error);
      res.status(500).json({ error: 'تعذر رفع صورة الدورة.' });
    }
  }
);

router.delete(
  '/courses/:id/cover-image',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.id);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        return res.status(400).json({ error: 'معرف الدورة غير صالح.' });
      }

      const [existing] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: 'الدورة غير موجودة.' });
      }

      const allowed = await canUserManageCourse(req.authUser!, existing);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية حذف صورة هذه الدورة.' });
      }

      const oldUrl = existing.thumbnailUrl;
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
      console.error('Delete provider course image error:', error);
      res.status(500).json({ error: 'تعذر حذف صورة الدورة.' });
    }
  }
);

router.get('/courses', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const fieldQuery =
      typeof req.query.field === 'string' ? req.query.field.trim().toLowerCase() : '';
    const fieldId = req.query.fieldId ? Number(req.query.fieldId) : undefined;
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const level = typeof req.query.level === 'string' ? req.query.level : undefined;
    const priceType =
      typeof req.query.priceType === 'string' ? req.query.priceType : undefined;
    const mine = req.query.mine === 'true';

    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        subtitle: courses.subtitle,
        description: courses.description,
        customFieldName: courses.customFieldName,
        targetAudience: courses.targetAudience,
        level: courses.level,
        language: courses.language,
        price: courses.price,
        currency: courses.currency,
        thumbnailUrl: courses.thumbnailUrl,
        coverImageKey: courses.coverImageKey,
        status: courses.status,
        isDemo: courses.isDemo,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        instructorId: users.id,
        instructorName: users.fullName,
        instructorStatus: users.accountStatus,
        fieldId: fields.id,
        taxonomyFieldNameAr: fields.nameAr,
        subjectId: courses.subjectId,
        subjectNameAr: subjects.nameAr,
        stageId: courses.stageId,
        stageNameAr: educationalStages.nameAr,
        systemId: courses.systemId,
        systemNameAr: educationalSystems.nameAr,
        gradeId: courses.gradeId,
        gradeNameAr: educationalGrades.nameAr,
        divisionId: courses.divisionId,
        divisionNameAr: secondaryDivisions.nameAr,
        pathwayId: courses.pathwayId,
        pathwayNameAr: baccalaureatePathways.nameAr,
        maxStudents: courses.maxStudents,
        enrollmentStatus: courses.enrollmentStatus,
        centerId: courses.centerId,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorUserId, users.id))
      .innerJoin(fields, eq(courses.fieldId, fields.id))
      .leftJoin(subjects, eq(courses.subjectId, subjects.id))
      .leftJoin(educationalStages, eq(courses.stageId, educationalStages.id))
      .leftJoin(educationalSystems, eq(courses.systemId, educationalSystems.id))
      .leftJoin(educationalGrades, eq(courses.gradeId, educationalGrades.id))
      .leftJoin(secondaryDivisions, eq(courses.divisionId, secondaryDivisions.id))
      .leftJoin(
        baccalaureatePathways,
        eq(courses.pathwayId, baccalaureatePathways.id)
      )
      .where(
        q
          ? or(
              ilike(courses.title, `%${q}%`),
              ilike(courses.subtitle, `%${q}%`),
              ilike(courses.description, `%${q}%`),
              ilike(courses.customFieldName, `%${q}%`),
              ilike(fields.nameAr, `%${q}%`)
            )
          : undefined
      )
      .orderBy(desc(courses.createdAt));

    const filtered = rows.filter((c) => {
      if (mine && req.authUser) {
        if (
          c.instructorId !== req.authUser.id &&
          !req.authUser.roles.includes('ADMIN')
        ) {
          return false;
        }
      } else {
        if (c.instructorStatus !== 'ACTIVE') {
          return false;
        }
        if (c.status !== 'PUBLISHED') {
          const isOwnerOrAdmin =
            req.authUser &&
            (c.instructorId === req.authUser.id ||
              req.authUser.roles.includes('ADMIN'));
          if (!isOwnerOrAdmin) return false;
        }
      }
      const displayField = resolveCourseFieldDisplay(
        c.customFieldName,
        c.taxonomyFieldNameAr
      );
      if (fieldQuery && !displayField.toLowerCase().includes(fieldQuery)) {
        return false;
      }
      if (fieldId && c.fieldId !== fieldId) return false;
      if (stageId && c.stageId !== stageId) return false;
      if (level && c.level !== level) return false;
      if (priceType === 'free' && Number(c.price) > 0) return false;
      if (priceType === 'paid' && Number(c.price) === 0) return false;
      return true;
    });

    const courseIds = filtered.map((c) => c.id);
    const [allLessons, allEnrollments, allReviews] =
      courseIds.length > 0
        ? await Promise.all([
            db
              .select()
              .from(courseLessons)
              .where(inArray(courseLessons.courseId, courseIds))
              .orderBy(asc(courseLessons.sortOrder)),
            db
              .select({ id: enrollments.id, courseId: enrollments.courseId })
              .from(enrollments)
              .where(inArray(enrollments.courseId, courseIds)),
            db
              .select({ courseId: reviews.courseId, rating: reviews.rating })
              .from(reviews)
              .where(inArray(reviews.courseId, courseIds)),
          ])
        : [[], [], []];

    const centerIds = Array.from(
      new Set(
        filtered
          .map((c) => c.centerId)
          .filter((cid): cid is number => Boolean(cid))
      )
    );
    const centerRows =
      centerIds.length > 0
        ? await db
            .select({ id: centers.id, name: centers.name })
            .from(centers)
            .where(inArray(centers.id, centerIds))
        : [];
    const centerMap = new Map(centerRows.map((c) => [c.id, c.name]));

    const enriched = filtered.map((c) => {
      const lessonsList = allLessons.filter((l) => l.courseId === c.id);
      const enrollmentsList = allEnrollments.filter((e) => e.courseId === c.id);
      const reviewsList = allReviews.filter((r) => r.courseId === c.id);
      const avgRating =
        reviewsList.length > 0
          ? Number(
              (
                reviewsList.reduce((acc, r) => acc + r.rating, 0) /
                reviewsList.length
              ).toFixed(1)
            )
          : 4.8;

      const resolvedField = resolveCourseFieldDisplay(
        c.customFieldName,
        c.taxonomyFieldNameAr
      );

      return {
        ...c,
        fieldNameAr: resolvedField,
        customFieldName: c.customFieldName || resolvedField,
        lessonsCount: lessonsList.length,
        totalMinutes: lessonsList.reduce(
          (sum, l) => sum + l.durationMinutes,
          0
        ),
        enrollmentsCount: enrollmentsList.length,
        ratingAvg: avgRating,
        reviewsCount: reviewsList.length,
        centerName: c.centerId ? centerMap.get(c.centerId) || null : null,
        ...(mine && req.authUser ? { lessons: lessonsList } : {}),
      };
    });

    res.json({ courses: enriched });
  } catch (error) {
    console.error('List courses error:', error);
    res.status(500).json({ error: 'تعذر جلب الدورات التدريبية.' });
  }
});

router.get('/courses/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح.' });
    }

    const [courseRow] = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        subtitle: courses.subtitle,
        description: courses.description,
        customFieldName: courses.customFieldName,
        targetAudience: courses.targetAudience,
        level: courses.level,
        language: courses.language,
        price: courses.price,
        currency: courses.currency,
        thumbnailUrl: courses.thumbnailUrl,
        coverImageKey: courses.coverImageKey,
        status: courses.status,
        isDemo: courses.isDemo,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
        instructorId: users.id,
        instructorName: users.fullName,
        instructorAvatarUrl: users.avatarUrl,
        instructorHeadline: providerProfiles.headline,
        instructorStatus: users.accountStatus,
        fieldId: fields.id,
        taxonomyFieldNameAr: fields.nameAr,
        subjectId: courses.subjectId,
        subjectNameAr: subjects.nameAr,
        stageId: courses.stageId,
        stageNameAr: educationalStages.nameAr,
        systemId: courses.systemId,
        systemNameAr: educationalSystems.nameAr,
        gradeId: courses.gradeId,
        gradeNameAr: educationalGrades.nameAr,
        divisionId: courses.divisionId,
        divisionNameAr: secondaryDivisions.nameAr,
        pathwayId: courses.pathwayId,
        pathwayNameAr: baccalaureatePathways.nameAr,
        maxStudents: courses.maxStudents,
        enrollmentStatus: courses.enrollmentStatus,
        centerId: courses.centerId,
        centerName: centers.name,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorUserId, users.id))
      .innerJoin(fields, eq(courses.fieldId, fields.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(subjects, eq(courses.subjectId, subjects.id))
      .leftJoin(educationalStages, eq(courses.stageId, educationalStages.id))
      .leftJoin(educationalSystems, eq(courses.systemId, educationalSystems.id))
      .leftJoin(educationalGrades, eq(courses.gradeId, educationalGrades.id))
      .leftJoin(secondaryDivisions, eq(courses.divisionId, secondaryDivisions.id))
      .leftJoin(
        baccalaureatePathways,
        eq(courses.pathwayId, baccalaureatePathways.id)
      )
      .leftJoin(centers, eq(courses.centerId, centers.id))
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!courseRow) {
      return res.status(404).json({ error: 'الدورة غير موجودة.' });
    }

    const isInstructorOrAdmin = req.authUser
      ? await canUserManageCourse(req.authUser, {
          instructorUserId: courseRow.instructorId,
          centerId: courseRow.centerId,
        })
      : false;

    let enrollmentRow: typeof enrollments.$inferSelect | null = null;
    let progressRow: typeof progress.$inferSelect | null = null;
    let completedLessonIds: number[] = [];

    if (req.authUser) {
      const [enr] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            eq(enrollments.studentUserId, req.authUser.id)
          )
        )
        .limit(1);
      if (enr) {
        enrollmentRow = enr;
        const [prog] = await db
          .select()
          .from(progress)
          .where(eq(progress.enrollmentId, enr.id))
          .limit(1);
        progressRow = prog || null;

        const lpRows = await db
          .select({ lessonId: lessonProgress.lessonId })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.enrollmentId, enr.id),
              eq(lessonProgress.isCompleted, true)
            )
          );
        completedLessonIds = lpRows.map((x) => x.lessonId);
      }
    }

    if (
      courseRow.instructorStatus !== 'ACTIVE' &&
      !isInstructorOrAdmin &&
      !enrollmentRow
    ) {
      return res.status(404).json({ error: 'الدورة غير موجودة.' });
    }

    if (courseRow.status !== 'PUBLISHED' && !isInstructorOrAdmin) {
      return res.status(403).json({ error: 'هذه الدورة غير منشورة حالياً.' });
    }

    const canAccessFullLessons = Boolean(enrollmentRow) || isInstructorOrAdmin;

    const rawLessons = await db
      .select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(asc(courseLessons.sortOrder));

    const safeLessons = rawLessons.map((l) => ({
      id: l.id,
      moduleTitle: l.moduleTitle,
      title: l.title,
      durationMinutes: l.durationMinutes,
      sortOrder: l.sortOrder,
      isFreePreview: l.isFreePreview,
      unlocked: canAccessFullLessons || l.isFreePreview,
      content:
        canAccessFullLessons || l.isFreePreview
          ? l.content
          : 'محتوى الدرس متاح للمشتركين في الدورة فقط.',
      completed: completedLessonIds.includes(l.id),
    }));

    const enrollmentsCountRows = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));

    const courseQuizzes = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId));

    const quizzesWithQuestions = await Promise.all(
      courseQuizzes.map(async (qz) => {
        const qList = await db
          .select()
          .from(questions)
          .where(eq(questions.quizId, qz.id))
          .orderBy(asc(questions.sortOrder));

        const qWithAnswers = await Promise.all(
          qList.map(async (q) => {
            const ans = await db
              .select({
                id: quizAnswers.id,
                answerText: quizAnswers.answerText,
              })
              .from(quizAnswers)
              .where(eq(quizAnswers.questionId, q.id));
            return { ...q, answers: ans };
          })
        );

        let attempts: Array<typeof quizAttempts.$inferSelect> = [];
        if (req.authUser) {
          attempts = await db
            .select()
            .from(quizAttempts)
            .where(
              and(
                eq(quizAttempts.quizId, qz.id),
                eq(quizAttempts.studentUserId, req.authUser.id)
              )
            )
            .orderBy(desc(quizAttempts.submittedAt));
        }
        return { ...qz, questions: qWithAnswers, attempts };
      })
    );

    const courseAssignments = await db
      .select()
      .from(assignments)
      .where(eq(assignments.courseId, courseId));

    const assignmentsWithSubs = await Promise.all(
      courseAssignments.map(async (a) => {
        const subs = req.authUser
          ? await db
              .select()
              .from(assignmentSubmissions)
              .where(
                isInstructorOrAdmin
                  ? eq(assignmentSubmissions.assignmentId, a.id)
                  : and(
                      eq(assignmentSubmissions.assignmentId, a.id),
                      eq(assignmentSubmissions.studentUserId, req.authUser.id)
                    )
              )
          : [];
        return { ...a, submissions: subs };
      })
    );

    const courseReviews = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        authorName: users.fullName,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.authorUserId, users.id))
      .where(eq(reviews.courseId, courseId))
      .orderBy(desc(reviews.createdAt));

    const resolvedFieldNameAr = resolveCourseFieldDisplay(
      courseRow.customFieldName,
      courseRow.taxonomyFieldNameAr
    );

    res.json({
      course: {
        ...courseRow,
        fieldNameAr: resolvedFieldNameAr,
        customFieldName: courseRow.customFieldName || resolvedFieldNameAr,
        enrollmentsCount: enrollmentsCountRows.length,
        canManage: isInstructorOrAdmin,
      },
      lessons: safeLessons,
      enrollment: enrollmentRow,
      progress: progressRow,
      quizzes: canAccessFullLessons ? quizzesWithQuestions : [],
      assignments: canAccessFullLessons ? assignmentsWithSubs : [],
      reviews: courseReviews,
    });
  } catch (error) {
    console.error('Get course details error:', error);
    res.status(500).json({ error: 'تعذر جلب تفاصيل الدورة.' });
  }
});

const courseLessonPayloadSchema = z.object({
  id: z.number().int().positive().optional(),
  moduleTitle: z.string().trim().max(140).nullable().optional(),
  title: z.string().trim().min(2, 'عنوان الدرس مطلوب').max(200),
  content: z.string().trim().min(5, 'محتوى الدرس مطلوب').max(8000),
  durationMinutes: z.number().int().min(1).max(600).default(20),
  isFreePreview: z.boolean().default(false),
});

router.post(
  '/courses',
  requireAuth,
  requireRole(
    'TEACHER',
    'MENTOR',
    'EXPERT',
    'CENTER_OWNER',
    'CENTER_STAFF',
    'ADMIN'
  ),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().trim().min(3, 'عنوان الدورة مطلوب (3 أحرف على الأقل)').max(180),
        subtitle: z.string().trim().max(240).optional(),
        description: z
          .string()
          .trim()
          .min(10, 'وصف الدورة التفصيلي مطلوب (10 أحرف على الأقل)')
          .max(4000),
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
        centerId: z.number().int().positive().nullable().optional(),
        level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
        language: z.string().trim().min(2).max(16).default('ar'),
        price: z.number().min(0).max(50000).default(0),
        currency: z.string().trim().min(3).max(6).default('EGP'),
        maxStudents: z.number().int().min(1).max(1000).nullable().optional(),
        enrollmentStatus: z.enum(['OPEN', 'PAUSED', 'CLOSED']).default('OPEN'),
        thumbnailUrl: z.string().trim().max(500).nullable().optional(),
        coverImageKey: z.string().trim().max(200).nullable().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
        lessons: z.array(courseLessonPayloadSchema).default([]),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الدورة غير مكتملة.',
        });
      }

      const d = parsed.data;
      const rawManualField = d.customFieldName ?? d.fieldName ?? null;
      let resolvedCustomFieldName: string;

      if (rawManualField !== null && rawManualField !== undefined) {
        const fieldCheck = validateManualCourseField(rawManualField);
        if (!fieldCheck.valid) {
          return res.status(400).json({ error: fieldCheck.error });
        }
        resolvedCustomFieldName = fieldCheck.value;
      } else if (d.fieldId) {
        const [fieldRow] = await db
          .select({ nameAr: fields.nameAr })
          .from(fields)
          .where(eq(fields.id, d.fieldId))
          .limit(1);
        if (!fieldRow) {
          return res.status(400).json({ error: 'التخصص المحدد غير موجود.' });
        }
        resolvedCustomFieldName = fieldRow.nameAr;
      } else {
        return res.status(400).json({
          error: 'يرجى إدخال المجال أو التخصص التعليمي للدورة يدوياً.',
        });
      }

      if (d.status === 'PUBLISHED' && d.lessons.length === 0) {
        return res.status(400).json({
          error: 'يجب إضافة درس واحد على الأقل قبل نشر الدورة.',
        });
      }

      for (let i = 0; i < d.lessons.length; i += 1) {
        const check = validateCourseLessonInput(d.lessons[i], i);
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
      }

      if (!isAllowedStoredImageUrl(d.thumbnailUrl, 'courses')) {
        return res.status(400).json({
          error: 'مرجع صورة الدورة غير صالح. يرجى رفع الصورة عبر أداة الرفع المخصصة.',
        });
      }

      if (d.centerId) {
        const canCenterCourse = await canUserManageCourse(req.authUser!, {
          instructorUserId: -1,
          centerId: d.centerId,
        });
        if (!canCenterCourse) {
          return res
            .status(403)
            .json({ error: 'لا تملك صلاحية ربط دورة بهذا المركز التعليمي.' });
        }
      }

      const currErr = await validateCourseCurriculumIds({
        subjectId: d.subjectId,
        stageId: d.stageId,
        systemId: d.systemId,
        gradeId: d.gradeId,
        divisionId: d.divisionId,
        pathwayId: d.pathwayId,
      });
      if (currErr) {
        return res.status(400).json({ error: currErr });
      }

      const anchorFieldId = await resolveAnchorFieldId({
        customFieldName: resolvedCustomFieldName,
        explicitFieldId: d.fieldId,
      });
      if (!anchorFieldId) {
        return res.status(500).json({ error: 'تعذر تهيئة مرجع التخصص في قاعدة البيانات.' });
      }

      const slug = `course-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const normalizedSubtitle =
        d.subtitle && d.subtitle.trim().length >= 3
          ? d.subtitle.trim()
          : d.description.trim().slice(0, 140);

      const created = await db.transaction(async (tx) => {
        const [courseRow] = await tx
          .insert(courses)
          .values({
            instructorUserId: req.authUser!.id,
            centerId: d.centerId ?? null,
            fieldId: anchorFieldId,
            customFieldName: resolvedCustomFieldName,
            targetAudience: d.targetAudience ? d.targetAudience.trim() : null,
            subjectId: d.subjectId ?? null,
            stageId: d.stageId ?? null,
            systemId: d.systemId ?? null,
            gradeId: d.gradeId ?? null,
            divisionId: d.divisionId ?? null,
            pathwayId: d.pathwayId ?? null,
            title: d.title.trim(),
            slug,
            subtitle: normalizedSubtitle,
            description: d.description.trim(),
            level: d.level,
            language: d.language.trim(),
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

        let createdLessons: Array<typeof courseLessons.$inferSelect> = [];
        if (d.lessons.length > 0) {
          createdLessons = await tx
            .insert(courseLessons)
            .values(
              d.lessons.map((l, idx) => ({
                courseId: courseRow.id,
                moduleTitle: l.moduleTitle ? l.moduleTitle.trim() : null,
                title: l.title.trim(),
                content: l.content.trim(),
                durationMinutes: l.durationMinutes,
                sortOrder: idx + 1,
                isFreePreview: l.isFreePreview,
              }))
            )
            .returning();
        }

        return { courseRow, createdLessons };
      });

      res.status(201).json({
        course: {
          ...created.courseRow,
          fieldNameAr: resolvedCustomFieldName,
        },
        lessons: created.createdLessons,
      });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ error: 'تعذر إنشاء الدورة.' });
    }
  }
);

router.patch('/courses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ error: 'معرف الدورة غير صالح.' });
    }

    const [existing] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'الدورة غير موجودة.' });
    }

    const isAllowed = await canUserManageCourse(req.authUser!, existing);
    if (!isAllowed) {
      return res
        .status(403)
        .json({ error: 'لا تملك صلاحية تعديل هذه الدورة.' });
    }

    const schema = z.object({
      title: z.string().trim().min(3, 'عنوان الدورة قصير جداً').max(180).optional(),
      subtitle: z.string().trim().max(240).optional(),
      description: z.string().trim().min(10, 'وصف الدورة قصير جداً').max(4000).optional(),
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
      language: z.string().trim().min(2).max(16).optional(),
      price: z.number().min(0).max(50000).optional(),
      currency: z.string().trim().min(3).max(6).optional(),
      maxStudents: z.number().int().min(1).max(1000).nullable().optional(),
      status: z
        .enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED'])
        .optional(),
      enrollmentStatus: z.enum(['OPEN', 'PAUSED', 'CLOSED']).optional(),
      thumbnailUrl: z.string().trim().max(500).nullable().optional(),
      coverImageKey: z.string().trim().max(200).nullable().optional(),
      removeThumbnail: z.boolean().optional(),
      lessons: z.array(courseLessonPayloadSchema).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'بيانات التحديث غير صالحة.',
      });
    }

    const d = parsed.data;
    if (
      d.thumbnailUrl !== undefined &&
      !isAllowedStoredImageUrl(d.thumbnailUrl, 'courses')
    ) {
      return res.status(400).json({ error: 'مرجع صورة الدورة غير صالح.' });
    }

    let nextCustomFieldName = existing.customFieldName;
    let nextAnchorFieldId = existing.fieldId;
    const rawManualField = d.customFieldName ?? d.fieldName;

    if (rawManualField !== undefined) {
      const check = validateManualCourseField(rawManualField);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      nextCustomFieldName = check.value;
      const anchor = await resolveAnchorFieldId({
        customFieldName: nextCustomFieldName,
        explicitFieldId: d.fieldId,
      });
      if (anchor) nextAnchorFieldId = anchor;
    } else if (d.fieldId !== undefined) {
      const [fieldRow] = await db
        .select({ id: fields.id, nameAr: fields.nameAr })
        .from(fields)
        .where(eq(fields.id, d.fieldId))
        .limit(1);
      if (!fieldRow) {
        return res.status(400).json({ error: 'التخصص المحدد غير موجود.' });
      }
      nextAnchorFieldId = fieldRow.id;
      if (!nextCustomFieldName) {
        nextCustomFieldName = fieldRow.nameAr;
      }
    }

    const nextSubjectId = d.subjectId !== undefined ? d.subjectId : existing.subjectId;
    const nextStageId = d.stageId !== undefined ? d.stageId : existing.stageId;
    const nextSystemId = d.systemId !== undefined ? d.systemId : existing.systemId;
    const nextGradeId = d.gradeId !== undefined ? d.gradeId : existing.gradeId;
    const nextDivisionId =
      d.divisionId !== undefined ? d.divisionId : existing.divisionId;
    const nextPathwayId =
      d.pathwayId !== undefined ? d.pathwayId : existing.pathwayId;

    const currErr = await validateCourseCurriculumIds({
      subjectId: nextSubjectId,
      stageId: nextStageId,
      systemId: nextSystemId,
      gradeId: nextGradeId,
      divisionId: nextDivisionId,
      pathwayId: nextPathwayId,
    });
    if (currErr) {
      return res.status(400).json({ error: currErr });
    }

    const nextStatus = d.status ?? existing.status;
    if (d.lessons !== undefined) {
      for (let i = 0; i < d.lessons.length; i += 1) {
        const check = validateCourseLessonInput(d.lessons[i], i);
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
      }
      if (nextStatus === 'PUBLISHED' && d.lessons.length === 0) {
        return res.status(400).json({
          error: 'يجب أن تحتوي الدورة المنشورة على درس واحد على الأقل.',
        });
      }
    } else if (nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      const currentLessons = await db
        .select({ id: courseLessons.id })
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId));
      if (currentLessons.length === 0) {
        return res.status(400).json({
          error: 'يجب إضافة درس واحد على الأقل قبل نشر الدورة.',
        });
      }
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

    const result = await db.transaction(async (tx) => {
      const [updatedCourse] = await tx
        .update(courses)
        .set({
          ...(d.title !== undefined ? { title: d.title.trim() } : {}),
          ...(d.subtitle !== undefined
            ? {
                subtitle:
                  d.subtitle.trim() ||
                  (d.description ?? existing.description).trim().slice(0, 140),
              }
            : {}),
          ...(d.description !== undefined
            ? { description: d.description.trim() }
            : {}),
          fieldId: nextAnchorFieldId,
          customFieldName: nextCustomFieldName,
          ...(d.targetAudience !== undefined
            ? {
                targetAudience: d.targetAudience
                  ? d.targetAudience.trim()
                  : null,
              }
            : {}),
          subjectId: nextSubjectId,
          stageId: nextStageId,
          systemId: nextSystemId,
          gradeId: nextGradeId,
          divisionId: nextDivisionId,
          pathwayId: nextPathwayId,
          ...(d.level !== undefined ? { level: d.level } : {}),
          ...(d.language !== undefined ? { language: d.language.trim() } : {}),
          ...(d.price !== undefined ? { price: d.price.toFixed(2) } : {}),
          ...(d.currency !== undefined
            ? { currency: d.currency.toUpperCase() }
            : {}),
          ...(d.maxStudents !== undefined
            ? { maxStudents: d.maxStudents }
            : {}),
          status: nextStatus,
          ...(d.enrollmentStatus !== undefined
            ? { enrollmentStatus: d.enrollmentStatus }
            : {}),
          thumbnailUrl: nextThumbnailUrl,
          coverImageKey: nextCoverImageKey,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, courseId))
        .returning();

      if (d.lessons !== undefined) {
        const existingLessonRows = await tx
          .select({ id: courseLessons.id })
          .from(courseLessons)
          .where(eq(courseLessons.courseId, courseId));
        const existingLessonIdSet = new Set(existingLessonRows.map((r) => r.id));

        const keptIds: number[] = [];
        for (let idx = 0; idx < d.lessons.length; idx += 1) {
          const item = d.lessons[idx];
          const sortOrder = idx + 1;
          if (item.id && existingLessonIdSet.has(item.id)) {
            keptIds.push(item.id);
            await tx
              .update(courseLessons)
              .set({
                moduleTitle: item.moduleTitle ? item.moduleTitle.trim() : null,
                title: item.title.trim(),
                content: item.content.trim(),
                durationMinutes: item.durationMinutes,
                sortOrder,
                isFreePreview: item.isFreePreview,
              })
              .where(
                and(
                  eq(courseLessons.id, item.id),
                  eq(courseLessons.courseId, courseId)
                )
              );
          } else {
            const [inserted] = await tx
              .insert(courseLessons)
              .values({
                courseId,
                moduleTitle: item.moduleTitle ? item.moduleTitle.trim() : null,
                title: item.title.trim(),
                content: item.content.trim(),
                durationMinutes: item.durationMinutes,
                sortOrder,
                isFreePreview: item.isFreePreview,
              })
              .returning({ id: courseLessons.id });
            keptIds.push(inserted.id);
          }
        }

        if (keptIds.length === 0) {
          await tx
            .delete(courseLessons)
            .where(eq(courseLessons.courseId, courseId));
        } else {
          await tx
            .delete(courseLessons)
            .where(
              and(
                eq(courseLessons.courseId, courseId),
                notInArray(courseLessons.id, keptIds)
              )
            );
        }
      }

      const lessonsRows = await tx
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId))
        .orderBy(asc(courseLessons.sortOrder));

      return { updatedCourse, lessonsRows };
    });

    if (oldThumbnailUrl && oldThumbnailUrl !== nextThumbnailUrl) {
      await deleteUploadedImageByUrl(oldThumbnailUrl);
    }

    const [anchorField] = await db
      .select({ nameAr: fields.nameAr })
      .from(fields)
      .where(eq(fields.id, result.updatedCourse.fieldId))
      .limit(1);

    res.json({
      course: {
        ...result.updatedCourse,
        fieldNameAr: resolveCourseFieldDisplay(
          result.updatedCourse.customFieldName,
          anchorField?.nameAr
        ),
      },
      lessons: result.lessonsRows,
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'تعذر تحديث الدورة.' });
  }
});

router.post(
  '/courses/:id/lessons',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.id);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        return res.status(400).json({ error: 'معرف الدورة غير صالح.' });
      }
      const [courseRow] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (!courseRow) {
        return res.status(404).json({ error: 'الدورة غير موجودة.' });
      }
      const allowed = await canUserManageCourse(req.authUser!, courseRow);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية إضافة دروس لهذه الدورة.' });
      }

      const parsed = courseLessonPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الدرس غير صالحة.',
        });
      }

      const existingLessons = await db
        .select({ sortOrder: courseLessons.sortOrder })
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId))
        .orderBy(asc(courseLessons.sortOrder));

      const nextSortOrder =
        existingLessons.length > 0
          ? existingLessons[existingLessons.length - 1].sortOrder + 1
          : 1;

      const d = parsed.data;
      const [createdLesson] = await db
        .insert(courseLessons)
        .values({
          courseId,
          moduleTitle: d.moduleTitle ? d.moduleTitle.trim() : null,
          title: d.title.trim(),
          content: d.content.trim(),
          durationMinutes: d.durationMinutes,
          sortOrder: nextSortOrder,
          isFreePreview: d.isFreePreview,
        })
        .returning();

      const lessons = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId))
        .orderBy(asc(courseLessons.sortOrder));

      res.status(201).json({ lesson: createdLesson, lessons });
    } catch (error) {
      console.error('Add course lesson error:', error);
      res.status(500).json({ error: 'تعذر إضافة الدرس.' });
    }
  }
);

router.patch(
  '/courses/:id/lessons/reorder',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.id);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        return res.status(400).json({ error: 'معرف الدورة غير صالح.' });
      }
      const [courseRow] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (!courseRow) {
        return res.status(404).json({ error: 'الدورة غير موجودة.' });
      }
      const allowed = await canUserManageCourse(req.authUser!, courseRow);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية إعادة ترتيب دروس هذه الدورة.' });
      }

      const schema = z.object({
        lessonIds: z.array(z.number().int().positive()).min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: 'قائمة معرفات الدروس لإعادة الترتيب غير صالحة.' });
      }

      const existingLessons = await db
        .select({ id: courseLessons.id })
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId));

      const existingIds = new Set(existingLessons.map((l) => l.id));
      const requestedIds = parsed.data.lessonIds;
      const requestedUnique = new Set(requestedIds);

      if (
        requestedIds.length !== existingLessons.length ||
        requestedUnique.size !== existingLessons.length ||
        requestedIds.some((id) => !existingIds.has(id))
      ) {
        return res.status(400).json({
          error: 'يجب أن تتطابق قائمة الترتيب مع جميع دروس هذه الدورة فقط.',
        });
      }

      await db.transaction(async (tx) => {
        for (let idx = 0; idx < requestedIds.length; idx += 1) {
          await tx
            .update(courseLessons)
            .set({ sortOrder: idx + 1 })
            .where(
              and(
                eq(courseLessons.id, requestedIds[idx]),
                eq(courseLessons.courseId, courseId)
              )
            );
        }
      });

      const lessons = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId))
        .orderBy(asc(courseLessons.sortOrder));

      res.json({ lessons });
    } catch (error) {
      console.error('Reorder course lessons error:', error);
      res.status(500).json({ error: 'تعذر إعادة ترتيب الدروس.' });
    }
  }
);

router.patch(
  '/courses/:id/lessons/:lessonId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.id);
      const lessonId = Number(req.params.lessonId);
      if (
        !Number.isInteger(courseId) ||
        courseId <= 0 ||
        !Number.isInteger(lessonId) ||
        lessonId <= 0
      ) {
        return res.status(400).json({ error: 'معرف الدورة أو الدرس غير صالح.' });
      }

      const [courseRow] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (!courseRow) {
        return res.status(404).json({ error: 'الدورة غير موجودة.' });
      }
      const allowed = await canUserManageCourse(req.authUser!, courseRow);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية تعديل دروس هذه الدورة.' });
      }

      const [existingLesson] = await db
        .select()
        .from(courseLessons)
        .where(
          and(
            eq(courseLessons.id, lessonId),
            eq(courseLessons.courseId, courseId)
          )
        )
        .limit(1);
      if (!existingLesson) {
        return res
          .status(404)
          .json({ error: 'الدرس غير موجود ضمن هذه الدورة.' });
      }

      const schema = z.object({
        moduleTitle: z.string().trim().max(140).nullable().optional(),
        title: z.string().trim().min(2).max(200).optional(),
        content: z.string().trim().min(5).max(8000).optional(),
        durationMinutes: z.number().int().min(1).max(600).optional(),
        isFreePreview: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات تعديل الدرس غير صالحة.',
        });
      }

      const d = parsed.data;
      const [updatedLesson] = await db
        .update(courseLessons)
        .set({
          ...(d.moduleTitle !== undefined
            ? { moduleTitle: d.moduleTitle ? d.moduleTitle.trim() : null }
            : {}),
          ...(d.title !== undefined ? { title: d.title.trim() } : {}),
          ...(d.content !== undefined ? { content: d.content.trim() } : {}),
          ...(d.durationMinutes !== undefined
            ? { durationMinutes: d.durationMinutes }
            : {}),
          ...(d.isFreePreview !== undefined
            ? { isFreePreview: d.isFreePreview }
            : {}),
        })
        .where(
          and(
            eq(courseLessons.id, lessonId),
            eq(courseLessons.courseId, courseId)
          )
        )
        .returning();

      const lessons = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId))
        .orderBy(asc(courseLessons.sortOrder));

      res.json({ lesson: updatedLesson, lessons });
    } catch (error) {
      console.error('Update course lesson error:', error);
      res.status(500).json({ error: 'تعذر تحديث الدرس.' });
    }
  }
);

router.delete(
  '/courses/:id/lessons/:lessonId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.id);
      const lessonId = Number(req.params.lessonId);
      if (
        !Number.isInteger(courseId) ||
        courseId <= 0 ||
        !Number.isInteger(lessonId) ||
        lessonId <= 0
      ) {
        return res.status(400).json({ error: 'معرف الدورة أو الدرس غير صالح.' });
      }

      const [courseRow] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (!courseRow) {
        return res.status(404).json({ error: 'الدورة غير موجودة.' });
      }
      const allowed = await canUserManageCourse(req.authUser!, courseRow);
      if (!allowed) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية حذف دروس هذه الدورة.' });
      }

      const existingLessons = await db
        .select()
        .from(courseLessons)
        .where(eq(courseLessons.courseId, courseId))
        .orderBy(asc(courseLessons.sortOrder));

      const target = existingLessons.find((l) => l.id === lessonId);
      if (!target) {
        return res
          .status(404)
          .json({ error: 'الدرس غير موجود ضمن هذه الدورة.' });
      }

      if (courseRow.status === 'PUBLISHED' && existingLessons.length <= 1) {
        return res.status(400).json({
          error:
            'لا يمكن حذف الدرس الوحيد في دورة منشورة. احفظها كمسودة أولاً أو أضف درساً بديلاً.',
        });
      }

      const remaining = await db.transaction(async (tx) => {
        await tx
          .delete(courseLessons)
          .where(
            and(
              eq(courseLessons.id, lessonId),
              eq(courseLessons.courseId, courseId)
            )
          );

        const left = existingLessons.filter((l) => l.id !== lessonId);
        for (let idx = 0; idx < left.length; idx += 1) {
          await tx
            .update(courseLessons)
            .set({ sortOrder: idx + 1 })
            .where(eq(courseLessons.id, left[idx].id));
        }

        return tx
          .select()
          .from(courseLessons)
          .where(eq(courseLessons.courseId, courseId))
          .orderBy(asc(courseLessons.sortOrder));
      });

      res.json({ deletedLessonId: lessonId, lessons: remaining });
    } catch (error) {
      console.error('Delete course lesson error:', error);
      res.status(500).json({ error: 'تعذر حذف الدرس.' });
    }
  }
);

router.post('/courses/:id/enroll', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = Number(req.params.id);
    const [courseRow] = await db
      .select({
        id: courses.id,
        title: courses.title,
        price: courses.price,
        status: courses.status,
        enrollmentStatus: courses.enrollmentStatus,
        maxStudents: courses.maxStudents,
        centerId: courses.centerId,
        instructorUserId: courses.instructorUserId,
        instructorStatus: users.accountStatus,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorUserId, users.id))
      .where(eq(courses.id, courseId))
      .limit(1);
    if (
      !courseRow ||
      courseRow.instructorStatus !== 'ACTIVE'
    ) {
      return res.status(404).json({ error: 'الدورة غير متاحة للتسجيل.' });
    }

    const existing = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentUserId, req.authUser!.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'أنت مسجل بالفعل في هذه الدورة.' });
    }

    const activeEnrList = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));

    const enrollCheck = canCourseAcceptNewEnrollment({
      status: courseRow.status,
      enrollmentStatus: courseRow.enrollmentStatus,
      maxStudents: courseRow.maxStudents,
      activeEnrolledCount: activeEnrList.length,
    });
    if (!enrollCheck.allowed) {
      return res.status(400).json({ error: enrollCheck.reason || 'التسجيل مغلق في هذه الدورة.' });
    }

    const lessonsList = await db
      .select({ id: courseLessons.id })
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId));

    const [commissionSetting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'commission_rate_percent'))
      .limit(1);
    const commissionRate = commissionSetting ? Number(commissionSetting.value) : 10;

    const result = await db.transaction(async (tx) => {
      const [enr] = await tx
        .insert(enrollments)
        .values({
          courseId,
          studentUserId: req.authUser!.id,
          status: 'ACTIVE',
        })
        .returning();

      const [prog] = await tx
        .insert(progress)
        .values({
          enrollmentId: enr.id,
          completedLessonsCount: 0,
          totalLessonsCount: lessonsList.length,
          completionPercent: 0,
        })
        .returning();

      if (courseRow.centerId) {
        const [studentUserRow] = await tx
          .select({ phone: users.phone })
          .from(users)
          .where(eq(users.id, req.authUser!.id))
          .limit(1);
        await tx
          .insert(centerStudents)
          .values({
            centerId: courseRow.centerId,
            studentUserId: req.authUser!.id,
            phone: studentUserRow?.phone || null,
            status: 'ACTIVE',
          })
          .onConflictDoNothing();
      }

      let paymentRecord = null;
      const priceNum = Number(courseRow.price);
      if (priceNum > 0) {
        const { gross, commission, net } = calculateCommissionAndNet(
          priceNum,
          commissionRate
        );
        const ref = `JSR-CRS-${Date.now()}-${enr.id}`;
        const [pay] = await tx
          .insert(payments)
          .values({
            payerUserId: req.authUser!.id,
            payeeUserId: courseRow.instructorUserId,
            entityType: 'COURSE_ENROLLMENT',
            entityId: enr.id,
            amount: gross.toFixed(2),
            commissionAmount: commission.toFixed(2),
            netAmount: net.toFixed(2),
            paymentMode: process.env.PAYMENT_PROVIDER_KEY
              ? 'GATEWAY_LIVE'
              : 'SANDBOX_PENDING',
            status: process.env.PAYMENT_PROVIDER_KEY
              ? 'PENDING'
              : 'PENDING_SETUP',
            paymentReference: ref,
          })
          .returning();
        paymentRecord = pay;

        await tx.insert(earnings).values({
          providerUserId: courseRow.instructorUserId,
          paymentId: pay.id,
          grossAmount: gross.toFixed(2),
          commissionAmount: commission.toFixed(2),
          netAmount: net.toFixed(2),
          status: 'PENDING',
        });
      }

      await tx.insert(notifications).values({
        userId: courseRow.instructorUserId,
        type: 'SYSTEM',
        title: 'تسجيل متعلّم جديد في دورتك',
        body: `التحق ${req.authUser!.fullName} بدورة "${courseRow.title}".`,
        linkUrl: `/courses/${courseRow.id}`,
      });

      return { enrollment: enr, progress: prog, payment: paymentRecord };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'تعذر إتمام التسجيل في الدورة.' });
  }
});

router.post(
  '/courses/:id/lessons/:lessonId/complete',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const courseId = Number(req.params.id);
      const lessonId = Number(req.params.lessonId);

      const [enr] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            eq(enrollments.studentUserId, req.authUser!.id)
          )
        )
        .limit(1);

      if (!enr) {
        return res
          .status(403)
          .json({ error: 'يجب التسجيل في الدورة أولاً لإتمام الدروس.' });
      }

      const [lessonRow] = await db
        .select()
        .from(courseLessons)
        .where(
          and(
            eq(courseLessons.id, lessonId),
            eq(courseLessons.courseId, courseId)
          )
        )
        .limit(1);
      if (!lessonRow) {
        return res.status(404).json({ error: 'الدرس غير موجود.' });
      }

      const updatedProgress = await db.transaction(async (tx) => {
        await tx
          .insert(lessonProgress)
          .values({
            enrollmentId: enr.id,
            lessonId,
            isCompleted: true,
            completedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [lessonProgress.enrollmentId, lessonProgress.lessonId],
            set: { isCompleted: true, completedAt: new Date() },
          });

        const allLessons = await tx
          .select({ id: courseLessons.id })
          .from(courseLessons)
          .where(eq(courseLessons.courseId, courseId));

        const completedRows = await tx
          .select({ id: lessonProgress.id })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.enrollmentId, enr.id),
              eq(lessonProgress.isCompleted, true)
            )
          );

        const percent = calculateCompletionPercent(
          completedRows.length,
          allLessons.length
        );

        const [prog] = await tx
          .update(progress)
          .set({
            completedLessonsCount: completedRows.length,
            totalLessonsCount: allLessons.length,
            completionPercent: percent,
            lastAccessedAt: new Date(),
          })
          .where(eq(progress.enrollmentId, enr.id))
          .returning();

        if (percent === 100 && enr.status !== 'COMPLETED') {
          await tx
            .update(enrollments)
            .set({ status: 'COMPLETED', completedAt: new Date() })
            .where(eq(enrollments.id, enr.id));

          const [courseInfo] = await tx
            .select({ title: courses.title })
            .from(courses)
            .where(eq(courses.id, courseId))
            .limit(1);

          await tx
            .insert(certificates)
            .values({
              userId: req.authUser!.id,
              courseId,
              title: `شهادة إتمام: ${courseInfo?.title || 'دورة تدريبية'}`,
              issuerName: 'منصة جسور | JUSOOR',
              credentialCode: `JSR-CERT-${Date.now()}-${enr.id}`,
            })
            .onConflictDoNothing();
        }

        return prog;
      });

      res.json({ progress: updatedProgress });
    } catch (error) {
      console.error('Complete lesson error:', error);
      res.status(500).json({ error: 'تعذر تحديث تقدم الدرس.' });
    }
  }
);

router.post(
  '/quizzes/:quizId/attempt',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const quizId = Number(req.params.quizId);
      const schema = z.object({
        answers: z
          .array(
            z.object({
              questionId: z.number().int().positive(),
              selectedAnswerId: z.number().int().positive(),
            })
          )
          .min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'يرجى الإجابة على الأسئلة أولاً.' });
      }

      const [quizRow] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, quizId))
        .limit(1);
      if (!quizRow) {
        return res.status(404).json({ error: 'الاختبار غير موجود.' });
      }

      const [enr] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, quizRow.courseId),
            eq(enrollments.studentUserId, req.authUser!.id)
          )
        )
        .limit(1);

      if (!enr) {
        return res
          .status(403)
          .json({ error: 'الاختبار متاح فقط للمسجلين في الدورة.' });
      }

      const qRows = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizId));

      const questionInputs = await Promise.all(
        qRows.map(async (q) => {
          const [correctAns] = await db
            .select()
            .from(quizAnswers)
            .where(
              and(
                eq(quizAnswers.questionId, q.id),
                eq(quizAnswers.isCorrect, true)
              )
            )
            .limit(1);
          return {
            id: q.id,
            points: q.points,
            correctAnswerId: correctAns?.id ?? -1,
          };
        })
      );

      const graded = gradeQuizAttempt(
        questionInputs,
        parsed.data.answers,
        quizRow.passingScore
      );

      const attempt = await db.transaction(async (tx) => {
        const [att] = await tx
          .insert(quizAttempts)
          .values({
            quizId,
            studentUserId: req.authUser!.id,
            score: graded.score,
            maxScore: graded.maxScore,
            passed: graded.passed,
          })
          .returning();

        if (graded.gradedItems.length > 0) {
          await tx.insert(quizAttemptAnswers).values(
            graded.gradedItems.map((item) => ({
              attemptId: att.id,
              questionId: item.questionId,
              selectedAnswerId: item.selectedAnswerId,
              isCorrect: item.isCorrect,
            }))
          );
        }
        return att;
      });

      res.status(201).json({
        attempt,
        percentage: graded.percentage,
        passed: graded.passed,
      });
    } catch (error) {
      console.error('Quiz attempt error:', error);
      res.status(500).json({ error: 'تعذر تصحيح الاختبار.' });
    }
  }
);

router.post(
  '/assignments/:assignmentId/submit',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const schema = z.object({
        submissionText: z.string().min(10, 'يرجى كتابة الحل أو الملاحظات بوضوح.'),
        attachmentUrl: z.string().url().optional().or(z.literal('')),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات التسليم غير صالحة.',
        });
      }

      const [assignRow] = await db
        .select()
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);
      if (!assignRow) {
        return res.status(404).json({ error: 'التكليف غير موجود.' });
      }

      const [enr] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, assignRow.courseId),
            eq(enrollments.studentUserId, req.authUser!.id)
          )
        )
        .limit(1);
      if (!enr) {
        return res
          .status(403)
          .json({ error: 'يجب التسجيل في الدورة لتسليم التكليف.' });
      }

      const [sub] = await db
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          studentUserId: req.authUser!.id,
          submissionText: parsed.data.submissionText.trim(),
          attachmentUrl: parsed.data.attachmentUrl || null,
          status: 'SUBMITTED',
        })
        .returning();

      res.status(201).json({ submission: sub });
    } catch (error) {
      console.error('Assignment submit error:', error);
      res.status(500).json({ error: 'تعذر تسليم التكليف.' });
    }
  }
);

router.post('/courses/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = Number(req.params.id);
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(4, 'يرجى كتابة تقييم واضح.'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'التقييم غير صالح.' });
    }

    const [courseRow] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!courseRow) {
      return res.status(404).json({ error: 'الدورة غير موجودة.' });
    }

    const [rev] = await db
      .insert(reviews)
      .values({
        authorUserId: req.authUser!.id,
        targetUserId: courseRow.instructorUserId,
        courseId,
        rating: parsed.data.rating,
        comment: parsed.data.comment.trim(),
      })
      .returning();

    res.status(201).json({ review: rev });
  } catch (error) {
    console.error('Course review error:', error);
    res.status(500).json({ error: 'تعذر إرسال التقييم.' });
  }
});

router.get('/study-groups', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const groups = await db
      .select({
        id: studyGroups.id,
        name: studyGroups.name,
        description: studyGroups.description,
        maxMembers: studyGroups.maxMembers,
        courseId: studyGroups.courseId,
        fieldId: studyGroups.fieldId,
        creatorName: users.fullName,
        createdAt: studyGroups.createdAt,
      })
      .from(studyGroups)
      .innerJoin(users, eq(studyGroups.creatorUserId, users.id))
      .orderBy(desc(studyGroups.createdAt));

    const enriched = await Promise.all(
      groups.map(async (g) => {
        const members = await db
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, g.id));
        const joined = req.authUser
          ? members.some((m) => m.userId === req.authUser!.id)
          : false;
        return { ...g, membersCount: members.length, joined };
      })
    );

    res.json({ studyGroups: enriched });
  } catch (error) {
    console.error('Study groups error:', error);
    res.status(500).json({ error: 'تعذر جلب مجموعات الدراسة.' });
  }
});

router.post('/study-groups/:id/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const groupId = Number(req.params.id);
    const [group] = await db
      .select()
      .from(studyGroups)
      .where(eq(studyGroups.id, groupId))
      .limit(1);
    if (!group) {
      return res.status(404).json({ error: 'المجموعة غير موجودة.' });
    }
    await db
      .insert(groupMembers)
      .values({ groupId, userId: req.authUser!.id, role: 'MEMBER' })
      .onConflictDoNothing();
    res.json({ joined: true });
  } catch (error) {
    console.error('Join study group error:', error);
    res.status(500).json({ error: 'تعذر الانضمام إلى المجموعة.' });
  }
});

export default router;
