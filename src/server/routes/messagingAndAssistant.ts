import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, inArray, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  conversations,
  conversationMembers,
  messages,
  notifications,
  users,
  courses,
  enrollments,
  progress,
  educationalTasks,
  taskOffers,
  bookings,
  payments,
  earnings,
  certificates,
  learningRoadmaps,
  roadmapSteps,
  aiRecommendations,
  providerProfiles,
  reports,
  userSkills,
  skills,
  teachingSessions,
  sessionEnrollments,
} from '../../db/schema.ts';
import { requireAuth, type AuthRequest } from '../auth.ts';
import {
  getAiConfigurationStatus,
  generateLearningDiagnosis,
} from '../ai.ts';

const router = Router();

router.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;

    const [
      myEnrollments,
      myTasks,
      myBookings,
      myNotifications,
      myCerts,
      myCourses,
      myOffers,
      myEarnings,
      myConvMemberships,
    ] = await Promise.all([
      db
        .select({
          enrollmentId: enrollments.id,
          courseId: courses.id,
          courseTitle: courses.title,
          thumbnailUrl: courses.thumbnailUrl,
          status: enrollments.status,
          completionPercent: progress.completionPercent,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .leftJoin(progress, eq(progress.enrollmentId, enrollments.id))
        .where(eq(enrollments.studentUserId, uid))
        .orderBy(desc(enrollments.enrolledAt)),
      db
        .select()
        .from(educationalTasks)
        .where(eq(educationalTasks.studentUserId, uid))
        .orderBy(desc(educationalTasks.createdAt)),
      db
        .select()
        .from(bookings)
        .where(
          or(eq(bookings.studentUserId, uid), eq(bookings.providerUserId, uid))
        )
        .orderBy(desc(bookings.createdAt)),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, uid))
        .orderBy(desc(notifications.createdAt))
        .limit(10),
      db.select().from(certificates).where(eq(certificates.userId, uid)),
      db
        .select()
        .from(courses)
        .where(eq(courses.instructorUserId, uid))
        .orderBy(desc(courses.createdAt)),
      db
        .select()
        .from(taskOffers)
        .where(eq(taskOffers.teacherUserId, uid))
        .orderBy(desc(taskOffers.createdAt)),
      db
        .select()
        .from(earnings)
        .where(eq(earnings.providerUserId, uid))
        .orderBy(desc(earnings.createdAt)),
      db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(eq(conversationMembers.userId, uid)),
    ]);

    const taskIds = myTasks.map((t) => t.id);
    const receivedOffers =
      taskIds.length > 0
        ? await db
            .select({
              id: taskOffers.id,
              taskId: taskOffers.taskId,
              teacherName: users.fullName,
              proposedPrice: taskOffers.proposedPrice,
              status: taskOffers.status,
            })
            .from(taskOffers)
            .innerJoin(users, eq(taskOffers.teacherUserId, users.id))
            .where(inArray(taskOffers.taskId, taskIds))
        : [];

    const totalEarningsNet = myEarnings.reduce(
      (sum, e) => sum + Number(e.netAmount),
      0
    );

    const recommendedCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        subtitle: courses.subtitle,
        price: courses.price,
      })
      .from(courses)
      .where(eq(courses.status, 'PUBLISHED'))
      .limit(3);

    const [myLessonEnrollmentsRaw, myTeachingSessions] = await Promise.all([
      db
        .select({
          enrollmentId: sessionEnrollments.id,
          sessionId: teachingSessions.id,
          title: teachingSessions.title,
          sessionType: teachingSessions.sessionType,
          startTime: teachingSessions.startTime,
          endTime: teachingSessions.endTime,
          deliveryMode: teachingSessions.deliveryMode,
          location: teachingSessions.location,
          meetingUrl: teachingSessions.meetingUrl,
          sessionStatus: teachingSessions.status,
          enrollmentStatus: sessionEnrollments.status,
          teacherName: users.fullName,
        })
        .from(sessionEnrollments)
        .innerJoin(
          teachingSessions,
          eq(sessionEnrollments.sessionId, teachingSessions.id)
        )
        .innerJoin(users, eq(teachingSessions.teacherUserId, users.id))
        .where(eq(sessionEnrollments.studentUserId, uid))
        .orderBy(desc(sessionEnrollments.requestedAt)),
      db
        .select({ id: teachingSessions.id, status: teachingSessions.status })
        .from(teachingSessions)
        .where(eq(teachingSessions.teacherUserId, uid)),
    ]);

    const myLessonEnrollments = myLessonEnrollmentsRaw.map((row) => {
      const canSeeDetails =
        row.enrollmentStatus === 'ACCEPTED' && row.sessionStatus !== 'CANCELLED';
      return {
        ...row,
        location:
          row.deliveryMode === 'IN_PERSON' && canSeeDetails ? row.location : null,
        meetingUrl: canSeeDetails ? row.meetingUrl : null,
      };
    });

    const teacherSessIds = myTeachingSessions.map((s) => s.id);
    const teacherPendingRequestsCount =
      teacherSessIds.length > 0
        ? (
            await db
              .select({ id: sessionEnrollments.id })
              .from(sessionEnrollments)
              .where(
                and(
                  inArray(sessionEnrollments.sessionId, teacherSessIds),
                  eq(sessionEnrollments.status, 'PENDING')
                )
              )
          ).length
        : 0;

    res.json({
      enrollments: myEnrollments,
      tasks: myTasks,
      receivedOffers,
      bookings: myBookings,
      lessonEnrollments: myLessonEnrollments,
      teachingSessionsSummary: {
        totalSessions: myTeachingSessions.length,
        pendingRequests: teacherPendingRequestsCount,
      },
      notifications: myNotifications,
      certificates: myCerts,
      conversationsCount: myConvMemberships.length,
      providerStats: {
        coursesCount: myCourses.length,
        offersSubmittedCount: myOffers.length,
        totalNetEarnings: Number(totalEarningsNet.toFixed(2)),
      },
      recommendedOpportunities: recommendedCourses,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'تعذر تحميل لوحة التحكم.' });
  }
});

router.get('/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;
    const memberships = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, uid));

    const convIds = memberships.map((m) => m.conversationId);
    if (convIds.length === 0) {
      return res.json({ conversations: [] });
    }

    const convRows = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds))
      .orderBy(desc(conversations.updatedAt));

    const enriched = await Promise.all(
      convRows.map(async (c) => {
        const [members, lastMsgs] = await Promise.all([
          db
            .select({ userId: users.id, fullName: users.fullName })
            .from(conversationMembers)
            .innerJoin(users, eq(conversationMembers.userId, users.id))
            .where(eq(conversationMembers.conversationId, c.id)),
          db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, c.id))
            .orderBy(desc(messages.createdAt))
            .limit(1),
        ]);
        return {
          ...c,
          members,
          lastMessage: lastMsgs[0] || null,
        };
      })
    );

    res.json({ conversations: enriched });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'تعذر جلب المحادثات.' });
  }
});

router.post('/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      recipientUserId: z.number().int().positive(),
      subject: z.string().min(2).max(200),
      initialMessage: z.string().min(1).max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المحادثة غير مكتملة.' });
    }

    if (parsed.data.recipientUserId === req.authUser!.id) {
      return res.status(400).json({ error: 'لا يمكنك بدء محادثة مع نفسك.' });
    }

    const [recipient] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.recipientUserId))
      .limit(1);
    if (!recipient) {
      return res.status(404).json({ error: 'المستلم غير موجود.' });
    }

    const created = await db.transaction(async (tx) => {
      const [conv] = await tx
        .insert(conversations)
        .values({ subject: parsed.data.subject.trim() })
        .returning();

      await tx.insert(conversationMembers).values([
        { conversationId: conv.id, userId: req.authUser!.id },
        { conversationId: conv.id, userId: parsed.data.recipientUserId },
      ]);

      await tx.insert(messages).values({
        conversationId: conv.id,
        senderUserId: req.authUser!.id,
        body: parsed.data.initialMessage.trim(),
      });

      await tx.insert(notifications).values({
        userId: parsed.data.recipientUserId,
        type: 'MESSAGE',
        title: 'رسالة جديدة',
        body: `أرسل لك ${req.authUser!.fullName} رسالة: ${parsed.data.subject}`,
        linkUrl: '/messages',
      });

      return conv;
    });

    res.status(201).json({ conversation: created });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'تعذر بدء المحادثة.' });
  }
});

router.get(
  '/conversations/:id/messages',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const convId = Number(req.params.id);
      const [member] = await db
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, convId),
            eq(conversationMembers.userId, req.authUser!.id)
          )
        )
        .limit(1);

      if (!member) {
        return res
          .status(403)
          .json({ error: 'ممنوع: لا يمكنك الوصول إلى محادثة لست عضواً فيها.' });
      }

      const msgRows = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderUserId: messages.senderUserId,
          senderName: users.fullName,
          body: messages.body,
          isRead: messages.isRead,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderUserId, users.id))
        .where(eq(messages.conversationId, convId))
        .orderBy(asc(messages.createdAt));

      res.json({ messages: msgRows });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'تعذر جلب الرسائل.' });
    }
  }
);

router.post(
  '/conversations/:id/messages',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const convId = Number(req.params.id);
      const schema = z.object({ body: z.string().min(1, 'الرسالة فارغة').max(2000) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'نص الرسالة مطلوب.' });
      }

      const [member] = await db
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, convId),
            eq(conversationMembers.userId, req.authUser!.id)
          )
        )
        .limit(1);

      if (!member) {
        return res
          .status(403)
          .json({ error: 'ممنوع: لست عضواً في هذه المحادثة.' });
      }

      const msg = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(messages)
          .values({
            conversationId: convId,
            senderUserId: req.authUser!.id,
            body: parsed.data.body.trim(),
          })
          .returning();

        await tx
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, convId));

        const otherMembers = await tx
          .select()
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, convId));
        for (const m of otherMembers) {
          if (m.userId !== req.authUser!.id) {
            await tx.insert(notifications).values({
              userId: m.userId,
              type: 'MESSAGE',
              title: `رسالة جديدة من ${req.authUser!.fullName}`,
              body: parsed.data.body.trim().slice(0, 100),
              linkUrl: '/messages',
            });
          }
        }

        return created;
      });

      res.status(201).json({ message: msg });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'تعذر إرسال الرسالة.' });
    }
  }
);

router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.authUser!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json({ notifications: list });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'تعذر جلب الإشعارات.' });
  }
});

router.patch(
  '/notifications/:id/read',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, req.authUser!.id)
          )
        );
      res.json({ updated: true });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ error: 'تعذر تحديث الإشعار.' });
    }
  }
);

router.get('/payments/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;
    const [myPayments, myEarnings] = await Promise.all([
      db
        .select()
        .from(payments)
        .where(
          or(eq(payments.payerUserId, uid), eq(payments.payeeUserId, uid))
        )
        .orderBy(desc(payments.createdAt)),
      db
        .select()
        .from(earnings)
        .where(eq(earnings.providerUserId, uid))
        .orderBy(desc(earnings.createdAt)),
    ]);

    res.json({
      gatewayConfigured: Boolean(process.env.PAYMENT_PROVIDER_KEY?.trim()),
      mode: process.env.PAYMENT_PROVIDER_KEY?.trim()
        ? 'GATEWAY_LIVE'
        : 'SANDBOX_PENDING',
      payments: myPayments,
      earnings: myEarnings,
    });
  } catch (error) {
    console.error('Payments me error:', error);
    res.status(500).json({ error: 'تعذر جلب السجل المالي.' });
  }
});

router.post('/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      targetType: z.enum(['COURSE', 'TASK', 'USER', 'REVIEW']),
      targetId: z.number().int().positive(),
      reason: z.string().min(3).max(200),
      details: z.string().min(5).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات البلاغ غير مكتملة.' });
    }

    const [created] = await db
      .insert(reports)
      .values({
        reporterUserId: req.authUser!.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reason: parsed.data.reason.trim(),
        details: parsed.data.details.trim(),
        status: 'OPEN',
      })
      .returning();

    res.status(201).json({ report: created });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'تعذر إرسال البلاغ.' });
  }
});

router.get('/assistant/status', (_req, res) => {
  res.json(getAiConfigurationStatus());
});

router.get('/assistant/roadmaps', requireAuth, async (req: AuthRequest, res) => {
  try {
    const roadmaps = await db
      .select()
      .from(learningRoadmaps)
      .where(eq(learningRoadmaps.userId, req.authUser!.id))
      .orderBy(desc(learningRoadmaps.createdAt));

    const enriched = await Promise.all(
      roadmaps.map(async (r) => {
        const [steps, recs] = await Promise.all([
          db
            .select()
            .from(roadmapSteps)
            .where(eq(roadmapSteps.roadmapId, r.id))
            .orderBy(asc(roadmapSteps.stepOrder)),
          db
            .select()
            .from(aiRecommendations)
            .where(eq(aiRecommendations.roadmapId, r.id)),
        ]);
        return { ...r, steps, recommendations: recs };
      })
    );

    res.json({ roadmaps: enriched });
  } catch (error) {
    console.error('Roadmaps fetch error:', error);
    res.status(500).json({ error: 'تعذر جلب مسارات التعلم.' });
  }
});

router.post('/assistant/analyze', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      goal: z.string().min(10, 'يرجى وصف هدفك التعليمي أو المهني بوضوح'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'يرجى إدخال وصف الهدف.',
      });
    }

    const status = getAiConfigurationStatus();
    if (!status.configured) {
      return res.status(503).json({
        configured: false,
        code: 'AI_PROVIDER_NOT_CONFIGURED',
        error:
          'المستشار الذكي عبر Gemini غير مفعّل بعد لأن مفتاح GEMINI_API_KEY غير مضبوط في بيئة الخادم. تم تجهيز البنية المعمارية بالكامل؛ أضف المفتاح في Settings > Secrets لتفعيل التشخيص الذكي الحقيقي.',
      });
    }

    const [mySkills, publishedCourses, verifiedProviders] = await Promise.all([
      db
        .select({ nameAr: skills.nameAr })
        .from(userSkills)
        .innerJoin(skills, eq(userSkills.skillId, skills.id))
        .where(eq(userSkills.userId, req.authUser!.id)),
      db
        .select({ id: courses.id, title: courses.title, level: courses.level })
        .from(courses)
        .where(eq(courses.status, 'PUBLISHED'))
        .limit(6),
      db
        .select({
          id: users.id,
          name: users.fullName,
          type: providerProfiles.providerType,
          headline: providerProfiles.headline,
        })
        .from(providerProfiles)
        .innerJoin(users, eq(providerProfiles.userId, users.id))
        .limit(6),
    ]);

    const analysis = await generateLearningDiagnosis({
      learnerGoal: parsed.data.goal,
      currentSkills: mySkills.map((s) => s.nameAr),
      availableCourses: publishedCourses,
      availableProviders: verifiedProviders,
    });

    const saved = await db.transaction(async (tx) => {
      const [roadmap] = await tx
        .insert(learningRoadmaps)
        .values({
          userId: req.authUser!.id,
          title: analysis.roadmapTitle,
          diagnosedGap: analysis.diagnosedGap,
          recommendedSolutionType: analysis.recommendedSolutionType,
          aiModelUsed: analysis.model,
          isAiGenerated: true,
        })
        .returning();

      if (analysis.steps.length > 0) {
        await tx.insert(roadmapSteps).values(
          analysis.steps.map((s, idx) => ({
            roadmapId: roadmap.id,
            stepOrder: idx + 1,
            title: s.title,
            description: s.description,
            actionType: s.actionType || 'MENTORSHIP',
          }))
        );
      }

      const topCourse = publishedCourses[0];
      const topProvider = verifiedProviders[0];
      if (topCourse || topProvider) {
        await tx.insert(aiRecommendations).values({
          userId: req.authUser!.id,
          roadmapId: roadmap.id,
          targetType:
            analysis.recommendedSolutionType === 'COURSE'
              ? 'COURSE'
              : 'PROVIDER',
          recommendedCourseId: topCourse?.id ?? null,
          recommendedProviderUserId: topProvider?.id ?? null,
          rationale: analysis.explanation,
          isConfiguredRealAi: true,
        });
      }

      return roadmap;
    });

    res.status(201).json({
      configured: true,
      analysis,
      roadmap: saved,
    });
  } catch (error) {
    console.error('AI analyze error:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'تعذر إتمام التحليل الذكي حالياً.',
    });
  }
});

export default router;
