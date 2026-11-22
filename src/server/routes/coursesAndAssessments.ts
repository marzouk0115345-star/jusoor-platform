import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  courses,
  courseLessons,
  enrollments,
  progress,
  lessonProgress,
  users,
  fields,
  educationalStages,
  centers,
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
  gradeQuizAttempt,
} from '../../lib/domain.ts';

const router = Router();

router.get('/courses', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
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
        level: courses.level,
        language: courses.language,
        price: courses.price,
        currency: courses.currency,
        thumbnailUrl: courses.thumbnailUrl,
        status: courses.status,
        isDemo: courses.isDemo,
        createdAt: courses.createdAt,
        instructorId: users.id,
        instructorName: users.fullName,
        fieldId: fields.id,
        fieldNameAr: fields.nameAr,
        stageId: courses.stageId,
        centerId: courses.centerId,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorUserId, users.id))
      .innerJoin(fields, eq(courses.fieldId, fields.id))
      .where(
        q
          ? or(ilike(courses.title, `%${q}%`), ilike(courses.subtitle, `%${q}%`))
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
      } else if (c.status !== 'PUBLISHED') {
        const isOwnerOrAdmin =
          req.authUser &&
          (c.instructorId === req.authUser.id ||
            req.authUser.roles.includes('ADMIN'));
        if (!isOwnerOrAdmin) return false;
      }
      if (fieldId && c.fieldId !== fieldId) return false;
      if (stageId && c.stageId !== stageId) return false;
      if (level && c.level !== level) return false;
      if (priceType === 'free' && Number(c.price) > 0) return false;
      if (priceType === 'paid' && Number(c.price) === 0) return false;
      return true;
    });

    const enriched = await Promise.all(
      filtered.map(async (c) => {
        const [lessonsList, enrollmentsList, reviewsList, centerRow] =
          await Promise.all([
            db
              .select({ id: courseLessons.id, durationMinutes: courseLessons.durationMinutes })
              .from(courseLessons)
              .where(eq(courseLessons.courseId, c.id)),
            db
              .select({ id: enrollments.id })
              .from(enrollments)
              .where(eq(enrollments.courseId, c.id)),
            db
              .select({ rating: reviews.rating })
              .from(reviews)
              .where(eq(reviews.courseId, c.id)),
            c.centerId
              ? db
                  .select({ id: centers.id, name: centers.name })
                  .from(centers)
                  .where(eq(centers.id, c.centerId))
                  .limit(1)
              : Promise.resolve([]),
          ]);

        const avgRating =
          reviewsList.length > 0
            ? Number(
                (
                  reviewsList.reduce((acc, r) => acc + r.rating, 0) /
                  reviewsList.length
                ).toFixed(1)
              )
            : 4.8;

        return {
          ...c,
          lessonsCount: lessonsList.length,
          totalMinutes: lessonsList.reduce(
            (sum, l) => sum + l.durationMinutes,
            0
          ),
          enrollmentsCount: enrollmentsList.length,
          ratingAvg: avgRating,
          reviewsCount: reviewsList.length,
          centerName: centerRow[0]?.name || null,
        };
      })
    );

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
        level: courses.level,
        language: courses.language,
        price: courses.price,
        currency: courses.currency,
        thumbnailUrl: courses.thumbnailUrl,
        status: courses.status,
        isDemo: courses.isDemo,
        createdAt: courses.createdAt,
        instructorId: users.id,
        instructorName: users.fullName,
        fieldId: fields.id,
        fieldNameAr: fields.nameAr,
        subjectId: courses.subjectId,
        stageId: courses.stageId,
        centerId: courses.centerId,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorUserId, users.id))
      .innerJoin(fields, eq(courses.fieldId, fields.id))
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!courseRow) {
      return res.status(404).json({ error: 'الدورة غير موجودة.' });
    }

    const isInstructorOrAdmin = Boolean(
      req.authUser &&
        (courseRow.instructorId === req.authUser.id ||
          req.authUser.roles.includes('ADMIN'))
    );

    if (courseRow.status !== 'PUBLISHED' && !isInstructorOrAdmin) {
      return res.status(403).json({ error: 'هذه الدورة غير منشورة حالياً.' });
    }

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

    const canAccessFullLessons = Boolean(enrollmentRow) || isInstructorOrAdmin;

    const rawLessons = await db
      .select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(asc(courseLessons.sortOrder));

    const safeLessons = rawLessons.map((l) => ({
      id: l.id,
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

    res.json({
      course: courseRow,
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

router.post(
  '/courses',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'CENTER_OWNER', 'CENTER_STAFF', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        title: z.string().min(4, 'عنوان الدورة مطلوب'),
        subtitle: z.string().min(4, 'الوصف المختصر مطلوب'),
        description: z.string().min(10, 'وصف الدورة التفصيلي مطلوب'),
        fieldId: z.number().int().positive(),
        stageId: z.number().int().positive().nullable().optional(),
        centerId: z.number().int().positive().nullable().optional(),
        level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).default('BEGINNER'),
        price: z.number().min(0).max(5000).default(0),
        status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
        lessons: z
          .array(
            z.object({
              title: z.string().min(3),
              content: z.string().min(5),
              durationMinutes: z.number().int().min(5).max(300).default(20),
              isFreePreview: z.boolean().default(false),
            })
          )
          .min(1, 'يجب إضافة درس واحد على الأقل'),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الدورة غير مكتملة.',
        });
      }

      const d = parsed.data;
      const slug = `course-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const created = await db.transaction(async (tx) => {
        const [courseRow] = await tx
          .insert(courses)
          .values({
            instructorUserId: req.authUser!.id,
            centerId: d.centerId ?? null,
            fieldId: d.fieldId,
            stageId: d.stageId ?? null,
            title: d.title.trim(),
            slug,
            subtitle: d.subtitle.trim(),
            description: d.description.trim(),
            level: d.level,
            price: d.price.toFixed(2),
            status: d.status,
            thumbnailUrl: '/src/assets/images/course_web_engineering_1795328020586.jpg',
            isDemo: false,
          })
          .returning();

        await tx.insert(courseLessons).values(
          d.lessons.map((l, idx) => ({
            courseId: courseRow.id,
            title: l.title.trim(),
            content: l.content.trim(),
            durationMinutes: l.durationMinutes,
            sortOrder: idx + 1,
            isFreePreview: l.isFreePreview,
          }))
        );

        return courseRow;
      });

      res.status(201).json({ course: created });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ error: 'تعذر إنشاء الدورة.' });
    }
  }
);

router.patch('/courses/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'الدورة غير موجودة.' });
    }
    const isAllowed =
      existing.instructorUserId === req.authUser!.id ||
      req.authUser!.roles.includes('ADMIN');
    if (!isAllowed) {
      return res
        .status(403)
        .json({ error: 'لا تملك صلاحية تعديل هذه الدورة.' });
    }

    const schema = z.object({
      title: z.string().min(4).optional(),
      subtitle: z.string().min(4).optional(),
      description: z.string().min(10).optional(),
      price: z.number().min(0).max(5000).optional(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات التحديث غير صالحة.' });
    }

    const [updated] = await db
      .update(courses)
      .set({
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.subtitle ? { subtitle: parsed.data.subtitle } : {}),
        ...(parsed.data.description
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.price !== undefined
          ? { price: parsed.data.price.toFixed(2) }
          : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId))
      .returning();

    res.json({ course: updated });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'تعذر تحديث الدورة.' });
  }
});

router.post('/courses/:id/enroll', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = Number(req.params.id);
    const [courseRow] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!courseRow || courseRow.status !== 'PUBLISHED') {
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
