import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  educationalTasks,
  taskCategories,
  taskOffers,
  taskAttachments,
  taskDeliverables,
  taskStatusHistory,
  users,
  fields,
  providerProfiles,
  conversations,
  conversationMembers,
  notifications,
  payments,
  earnings,
  reviews,
  skillPassports,
  platformSettings,
} from '../../db/schema.ts';
import {
  requireAuth,
  optionalAuth,
  requireRole,
  type AuthRequest,
} from '../auth.ts';
import {
  canTransitionTaskStatus,
  calculateCommissionAndNet,
} from '../../lib/domain.ts';

const router = Router();

router.get('/tasks', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const statusFilter =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    const fieldId = req.query.fieldId ? Number(req.query.fieldId) : undefined;
    const categoryId = req.query.categoryId
      ? Number(req.query.categoryId)
      : undefined;
    const mine = req.query.mine === 'true';

    const rows = await db
      .select({
        id: educationalTasks.id,
        studentUserId: educationalTasks.studentUserId,
        studentName: users.fullName,
        categoryId: educationalTasks.categoryId,
        categoryNameAr: taskCategories.nameAr,
        fieldId: educationalTasks.fieldId,
        fieldNameAr: fields.nameAr,
        stageId: educationalTasks.stageId,
        title: educationalTasks.title,
        description: educationalTasks.description,
        requiredSkills: educationalTasks.requiredSkills,
        budget: educationalTasks.budget,
        currency: educationalTasks.currency,
        expectedDuration: educationalTasks.expectedDuration,
        preferredMethod: educationalTasks.preferredMethod,
        deadline: educationalTasks.deadline,
        status: educationalTasks.status,
        acceptedOfferId: educationalTasks.acceptedOfferId,
        isDemo: educationalTasks.isDemo,
        createdAt: educationalTasks.createdAt,
      })
      .from(educationalTasks)
      .innerJoin(users, eq(educationalTasks.studentUserId, users.id))
      .innerJoin(
        taskCategories,
        eq(educationalTasks.categoryId, taskCategories.id)
      )
      .innerJoin(fields, eq(educationalTasks.fieldId, fields.id))
      .where(
        q
          ? or(
              ilike(educationalTasks.title, `%${q}%`),
              ilike(educationalTasks.description, `%${q}%`)
            )
          : undefined
      )
      .orderBy(desc(educationalTasks.createdAt));

    const filtered = rows.filter((t) => {
      if (mine && req.authUser && t.studentUserId !== req.authUser.id) {
        return false;
      }
      if (statusFilter && t.status !== statusFilter) return false;
      if (fieldId && t.fieldId !== fieldId) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      return true;
    });

    const enriched = await Promise.all(
      filtered.map(async (t) => {
        const offers = await db
          .select({ id: taskOffers.id })
          .from(taskOffers)
          .where(eq(taskOffers.taskId, t.id));
        return { ...t, offersCount: offers.length };
      })
    );

    res.json({ tasks: enriched });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'تعذر جلب المهام التعليمية.' });
  }
});

router.get('/tasks/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({ error: 'معرف المهمة غير صالح.' });
    }

    const [taskRow] = await db
      .select({
        id: educationalTasks.id,
        studentUserId: educationalTasks.studentUserId,
        studentName: users.fullName,
        categoryId: educationalTasks.categoryId,
        categoryNameAr: taskCategories.nameAr,
        fieldId: educationalTasks.fieldId,
        fieldNameAr: fields.nameAr,
        title: educationalTasks.title,
        description: educationalTasks.description,
        requiredSkills: educationalTasks.requiredSkills,
        budget: educationalTasks.budget,
        currency: educationalTasks.currency,
        expectedDuration: educationalTasks.expectedDuration,
        preferredMethod: educationalTasks.preferredMethod,
        deadline: educationalTasks.deadline,
        status: educationalTasks.status,
        acceptedOfferId: educationalTasks.acceptedOfferId,
        isDemo: educationalTasks.isDemo,
        createdAt: educationalTasks.createdAt,
      })
      .from(educationalTasks)
      .innerJoin(users, eq(educationalTasks.studentUserId, users.id))
      .innerJoin(
        taskCategories,
        eq(educationalTasks.categoryId, taskCategories.id)
      )
      .innerJoin(fields, eq(educationalTasks.fieldId, fields.id))
      .where(eq(educationalTasks.id, taskId))
      .limit(1);

    if (!taskRow) {
      return res.status(404).json({ error: 'المهمة التعليمية غير موجودة.' });
    }

    const offersRows = await db
      .select({
        id: taskOffers.id,
        taskId: taskOffers.taskId,
        teacherUserId: taskOffers.teacherUserId,
        teacherName: users.fullName,
        proposal: taskOffers.proposal,
        proposedPrice: taskOffers.proposedPrice,
        expectedDuration: taskOffers.expectedDuration,
        deliveryMethod: taskOffers.deliveryMethod,
        additionalNotes: taskOffers.additionalNotes,
        status: taskOffers.status,
        createdAt: taskOffers.createdAt,
        providerHeadline: providerProfiles.headline,
        providerRating: providerProfiles.ratingAvg,
        providerVerified: providerProfiles.verificationStatus,
      })
      .from(taskOffers)
      .innerJoin(users, eq(taskOffers.teacherUserId, users.id))
      .leftJoin(
        providerProfiles,
        eq(providerProfiles.userId, taskOffers.teacherUserId)
      )
      .where(eq(taskOffers.taskId, taskId))
      .orderBy(asc(taskOffers.createdAt));

    const attachments = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId));

    const deliverables = await db
      .select({
        id: taskDeliverables.id,
        summary: taskDeliverables.summary,
        deliverableUrl: taskDeliverables.deliverableUrl,
        submittedByName: users.fullName,
        createdAt: taskDeliverables.createdAt,
      })
      .from(taskDeliverables)
      .innerJoin(users, eq(taskDeliverables.submittedByUserId, users.id))
      .where(eq(taskDeliverables.taskId, taskId))
      .orderBy(desc(taskDeliverables.createdAt));

    const history = await db
      .select({
        id: taskStatusHistory.id,
        fromStatus: taskStatusHistory.fromStatus,
        toStatus: taskStatusHistory.toStatus,
        note: taskStatusHistory.note,
        changedByName: users.fullName,
        createdAt: taskStatusHistory.createdAt,
      })
      .from(taskStatusHistory)
      .innerJoin(users, eq(taskStatusHistory.changedByUserId, users.id))
      .where(eq(taskStatusHistory.taskId, taskId))
      .orderBy(asc(taskStatusHistory.createdAt));

    res.json({
      task: taskRow,
      offers: offersRows,
      attachments,
      deliverables,
      history,
    });
  } catch (error) {
    console.error('Get task detail error:', error);
    res.status(500).json({ error: 'تعذر جلب تفاصيل المهمة.' });
  }
});

router.post('/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      title: z.string().min(5, 'عنوان المهمة يجب أن يكون واضحاً'),
      description: z.string().min(15, 'يرجى كتابة وصف مفصل لما تحتاج تعلمه'),
      categoryId: z.number().int().positive(),
      fieldId: z.number().int().positive(),
      subjectId: z.number().int().positive().nullable().optional(),
      stageId: z.number().int().positive().nullable().optional(),
      requiredSkills: z.string().max(300).default(''),
      budget: z.number().min(5, 'الميزانية يجب أن تكون 5 دولار على الأقل').max(10000),
      expectedDuration: z.string().min(2, 'المدة المتوقعة مطلوبة'),
      preferredMethod: z.enum(['ONLINE', 'HYBRID', 'IN_PERSON']).default('ONLINE'),
      deadline: z.string().min(4, 'الموعد النهائي مطلوب'),
      attachmentName: z.string().optional(),
      attachmentUrl: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'بيانات المهمة غير مكتملة.',
      });
    }

    const d = parsed.data;
    const createdTask = await db.transaction(async (tx) => {
      const [taskRow] = await tx
        .insert(educationalTasks)
        .values({
          studentUserId: req.authUser!.id,
          categoryId: d.categoryId,
          fieldId: d.fieldId,
          subjectId: d.subjectId ?? null,
          stageId: d.stageId ?? null,
          title: d.title.trim(),
          description: d.description.trim(),
          requiredSkills: d.requiredSkills.trim(),
          budget: d.budget.toFixed(2),
          expectedDuration: d.expectedDuration.trim(),
          preferredMethod: d.preferredMethod,
          deadline: d.deadline.trim(),
          status: 'OPEN',
          isDemo: false,
        })
        .returning();

      if (d.attachmentName && d.attachmentUrl) {
        await tx.insert(taskAttachments).values({
          taskId: taskRow.id,
          fileName: d.attachmentName,
          fileUrl: d.attachmentUrl,
        });
      }

      await tx.insert(taskStatusHistory).values({
        taskId: taskRow.id,
        changedByUserId: req.authUser!.id,
        fromStatus: 'DRAFT',
        toStatus: 'OPEN',
        note: 'تم نشر المهمة التعليمية في سوق جسور',
      });

      return taskRow;
    });

    res.status(201).json({ task: createdTask });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'تعذر نشر المهمة التعليمية.' });
  }
});

router.post(
  '/tasks/:id/offers',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.id);
      const schema = z.object({
        proposal: z.string().min(15, 'تفاصيل العرض وخطة الشرح مطلوبة'),
        proposedPrice: z.number().min(5).max(10000),
        expectedDuration: z.string().min(2),
        deliveryMethod: z.enum(['ONLINE', 'HYBRID', 'IN_PERSON']).default('ONLINE'),
        additionalNotes: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات العرض غير صالحة.',
        });
      }

      const [taskRow] = await db
        .select()
        .from(educationalTasks)
        .where(eq(educationalTasks.id, taskId))
        .limit(1);
      if (!taskRow) {
        return res.status(404).json({ error: 'المهمة غير موجودة.' });
      }
      if (taskRow.studentUserId === req.authUser!.id) {
        return res
          .status(400)
          .json({ error: 'لا يمكنك تقديم عرض على مهمتك الخاصة.' });
      }
      if (taskRow.status !== 'OPEN' && taskRow.status !== 'OFFERS_RECEIVED') {
        return res
          .status(409)
          .json({ error: 'هذه المهمة لم تعد تستقبل عروضاً جديدة.' });
      }

      const existingOffer = await db
        .select({ id: taskOffers.id })
        .from(taskOffers)
        .where(
          and(
            eq(taskOffers.taskId, taskId),
            eq(taskOffers.teacherUserId, req.authUser!.id)
          )
        )
        .limit(1);

      if (existingOffer.length > 0) {
        return res
          .status(409)
          .json({ error: 'لقد قمت بتقديم عرض مسبقاً على هذه المهمة.' });
      }

      const d = parsed.data;
      const offer = await db.transaction(async (tx) => {
        const [newOffer] = await tx
          .insert(taskOffers)
          .values({
            taskId,
            teacherUserId: req.authUser!.id,
            proposal: d.proposal.trim(),
            proposedPrice: d.proposedPrice.toFixed(2),
            expectedDuration: d.expectedDuration.trim(),
            deliveryMethod: d.deliveryMethod,
            additionalNotes: d.additionalNotes?.trim() || null,
            status: 'PENDING',
          })
          .returning();

        const previousStatus = taskRow.status;
        if (taskRow.status === 'OPEN') {
          await tx
            .update(educationalTasks)
            .set({ status: 'OFFERS_RECEIVED', updatedAt: new Date() })
            .where(eq(educationalTasks.id, taskId));
        }

        await tx.insert(taskStatusHistory).values({
          taskId,
          offerId: newOffer.id,
          changedByUserId: req.authUser!.id,
          fromStatus: previousStatus,
          toStatus: 'OFFERS_RECEIVED',
          note: `تم تقديم عرض من ${req.authUser!.fullName}`,
        });

        await tx.insert(notifications).values({
          userId: taskRow.studentUserId,
          type: 'TASK_OFFER',
          title: 'عرض جديد على مهمتك التعليمية',
          body: `قدّم ${req.authUser!.fullName} عرضاً بقيمة ${d.proposedPrice} دولار لمهمة "${taskRow.title}".`,
          linkUrl: `/tasks/${taskId}`,
        });

        return newOffer;
      });

      res.status(201).json({ offer });
    } catch (error) {
      console.error('Submit offer error:', error);
      res.status(500).json({ error: 'تعذر تقديم العرض.' });
    }
  }
);

router.post(
  '/tasks/:id/accept-offer/:offerId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.id);
      const offerId = Number(req.params.offerId);

      const [taskRow] = await db
        .select()
        .from(educationalTasks)
        .where(eq(educationalTasks.id, taskId))
        .limit(1);

      if (!taskRow) {
        return res.status(404).json({ error: 'المهمة غير موجودة.' });
      }
      if (taskRow.studentUserId !== req.authUser!.id) {
        return res
          .status(403)
          .json({ error: 'فقط صاحب المهمة يمكنه قبول العرض.' });
      }
      if (
        taskRow.acceptedOfferId !== null ||
        (taskRow.status !== 'OPEN' && taskRow.status !== 'OFFERS_RECEIVED')
      ) {
        return res.status(409).json({
          error: 'تم قبول عرض مسبقاً لهذه المهمة ولا يمكن قبول أكثر من عرض.',
        });
      }

      const [offerRow] = await db
        .select()
        .from(taskOffers)
        .where(and(eq(taskOffers.id, offerId), eq(taskOffers.taskId, taskId)))
        .limit(1);

      if (!offerRow || offerRow.status !== 'PENDING') {
        return res.status(404).json({ error: 'العرض غير متاح للقبول.' });
      }

      const [commissionSetting] = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'commission_rate_percent'))
        .limit(1);
      const commissionRate = commissionSetting
        ? Number(commissionSetting.value)
        : 10;

      const result = await db.transaction(async (tx) => {
        // Atomic guard preventing concurrent double acceptance
        const updatedTasks = await tx
          .update(educationalTasks)
          .set({
            status: 'OFFER_ACCEPTED',
            acceptedOfferId: offerId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(educationalTasks.id, taskId),
              or(
                eq(educationalTasks.status, 'OPEN'),
                eq(educationalTasks.status, 'OFFERS_RECEIVED')
              )
            )
          )
          .returning();

        if (updatedTasks.length === 0) {
          throw new Error('CONFLICT_ALREADY_ACCEPTED');
        }

        await tx
          .update(taskOffers)
          .set({ status: 'ACCEPTED', updatedAt: new Date() })
          .where(eq(taskOffers.id, offerId));

        // Reject all competing pending offers
        const allOffers = await tx
          .select()
          .from(taskOffers)
          .where(eq(taskOffers.taskId, taskId));
        for (const o of allOffers) {
          if (o.id !== offerId && o.status === 'PENDING') {
            await tx
              .update(taskOffers)
              .set({ status: 'REJECTED', updatedAt: new Date() })
              .where(eq(taskOffers.id, o.id));
          }
        }

        await tx.insert(taskStatusHistory).values({
          taskId,
          offerId,
          changedByUserId: req.authUser!.id,
          fromStatus: taskRow.status,
          toStatus: 'OFFER_ACCEPTED',
          note: 'تم قبول العرض وإغلاق باقي العروض تلقائياً',
        });

        const { gross, commission, net } = calculateCommissionAndNet(
          Number(offerRow.proposedPrice),
          commissionRate
        );

        const [pay] = await tx
          .insert(payments)
          .values({
            payerUserId: taskRow.studentUserId,
            payeeUserId: offerRow.teacherUserId,
            entityType: 'TASK_OFFER',
            entityId: offerId,
            amount: gross.toFixed(2),
            commissionAmount: commission.toFixed(2),
            netAmount: net.toFixed(2),
            paymentMode: process.env.PAYMENT_PROVIDER_KEY
              ? 'GATEWAY_LIVE'
              : 'SANDBOX_PENDING',
            status: process.env.PAYMENT_PROVIDER_KEY
              ? 'HELD'
              : 'PENDING_SETUP',
            paymentReference: `JSR-TSK-${Date.now()}-${offerId}`,
          })
          .returning();

        await tx.insert(earnings).values({
          providerUserId: offerRow.teacherUserId,
          paymentId: pay.id,
          grossAmount: gross.toFixed(2),
          commissionAmount: commission.toFixed(2),
          netAmount: net.toFixed(2),
          status: 'PENDING',
        });

        // Open direct conversation between student and teacher
        const [conv] = await tx
          .insert(conversations)
          .values({
            subject: `مهمة: ${taskRow.title}`,
            taskId,
          })
          .returning();

        await tx.insert(conversationMembers).values([
          { conversationId: conv.id, userId: taskRow.studentUserId },
          { conversationId: conv.id, userId: offerRow.teacherUserId },
        ]);

        await tx.insert(notifications).values({
          userId: offerRow.teacherUserId,
          type: 'OFFER_ACCEPTED',
          title: 'تم قبول عرضك التعليمي!',
          body: `قبل ${req.authUser!.fullName} عرضك على مهمة "${taskRow.title}". يمكنك البدء بالتنفيذ والتواصل الآن.`,
          linkUrl: `/tasks/${taskId}`,
        });

        return updatedTasks[0];
      });

      res.json({ task: result });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === 'CONFLICT_ALREADY_ACCEPTED'
      ) {
        return res
          .status(409)
          .json({ error: 'تم قبول عرض مسبقاً لهذه المهمة.' });
      }
      console.error('Accept offer error:', error);
      res.status(500).json({ error: 'تعذر قبول العرض.' });
    }
  }
);

router.post(
  '/tasks/:id/status',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const taskId = Number(req.params.id);
      const schema = z.object({
        toStatus: z.enum([
          'IN_PROGRESS',
          'DELIVERED',
          'COMPLETED',
          'CANCELLED',
          'DISPUTED',
        ]),
        note: z.string().max(500).optional(),
        deliverableSummary: z.string().max(2000).optional(),
        deliverableUrl: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'طلب تحديث الحالة غير صالح.' });
      }

      const [taskRow] = await db
        .select()
        .from(educationalTasks)
        .where(eq(educationalTasks.id, taskId))
        .limit(1);
      if (!taskRow) {
        return res.status(404).json({ error: 'المهمة غير موجودة.' });
      }

      let acceptedTeacherId: number | null = null;
      if (taskRow.acceptedOfferId) {
        const [accOffer] = await db
          .select()
          .from(taskOffers)
          .where(eq(taskOffers.id, taskRow.acceptedOfferId))
          .limit(1);
        acceptedTeacherId = accOffer?.teacherUserId ?? null;
      }

      const isStudent = taskRow.studentUserId === req.authUser!.id;
      const isTeacher = acceptedTeacherId === req.authUser!.id;
      const isAdmin = req.authUser!.roles.includes('ADMIN');

      if (!isStudent && !isTeacher && !isAdmin) {
        return res
          .status(403)
          .json({ error: 'غير مصرح بتغيير حالة هذه المهمة.' });
      }

      const { toStatus, note, deliverableSummary, deliverableUrl } = parsed.data;
      if (!canTransitionTaskStatus(taskRow.status, toStatus)) {
        return res.status(400).json({
          error: `لا يمكن الانتقال من الحالة ${taskRow.status} إلى ${toStatus}.`,
        });
      }

      if (toStatus === 'DELIVERED' && !isTeacher && !isAdmin) {
        return res
          .status(403)
          .json({ error: 'فقط المعلّم المعيّن يمكنه تسليم المخرجات.' });
      }
      if (toStatus === 'COMPLETED' && !isStudent && !isAdmin) {
        return res
          .status(403)
          .json({ error: 'فقط الطالب صاحب المهمة يمكنه تأكيد الإتمام.' });
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(educationalTasks)
          .set({ status: toStatus, updatedAt: new Date() })
          .where(eq(educationalTasks.id, taskId))
          .returning();

        if (toStatus === 'DELIVERED' && deliverableSummary) {
          await tx.insert(taskDeliverables).values({
            taskId,
            submittedByUserId: req.authUser!.id,
            summary: deliverableSummary.trim(),
            deliverableUrl: deliverableUrl?.trim() || null,
          });
        }

        if (toStatus === 'COMPLETED') {
          const [passport] = await tx
            .select()
            .from(skillPassports)
            .where(eq(skillPassports.userId, taskRow.studentUserId))
            .limit(1);
          if (passport) {
            await tx
              .update(skillPassports)
              .set({
                completedTasksCount: passport.completedTasksCount + 1,
                updatedAt: new Date(),
              })
              .where(eq(skillPassports.id, passport.id));
          }
        }

        const statusLabelsAr: Record<string, string> = {
          OPEN: 'مفتوحة',
          OFFERS_RECEIVED: 'استلام العروض',
          OFFER_ACCEPTED: 'تم قبول عرض',
          IN_PROGRESS: 'قيد التنفيذ',
          DELIVERED: 'تم التسليم للمراجعة',
          COMPLETED: 'مكتملة',
          CANCELLED: 'ملغاة',
          DISPUTED: 'تحت المراجعة',
        };
        const toStatusAr = statusLabelsAr[toStatus] || toStatus;

        await tx.insert(taskStatusHistory).values({
          taskId,
          offerId: taskRow.acceptedOfferId,
          changedByUserId: req.authUser!.id,
          fromStatus: taskRow.status,
          toStatus,
          note: note?.trim() || `تحديث الحالة إلى ${toStatusAr}`,
        });

        const notifyUserId = isStudent ? acceptedTeacherId : taskRow.studentUserId;
        if (notifyUserId) {
          await tx.insert(notifications).values({
            userId: notifyUserId,
            type: 'SYSTEM',
            title: 'تحديث حالة المهمة التعليمية',
            body: `تغيرت حالة مهمة "${taskRow.title}" إلى ${toStatusAr}.`,
            linkUrl: `/tasks/${taskId}`,
          });
        }

        return row;
      });

      res.json({ task: updated });
    } catch (error) {
      console.error('Task status update error:', error);
      res.status(500).json({ error: 'تعذر تحديث حالة المهمة.' });
    }
  }
);

router.post('/tasks/:id/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const taskId = Number(req.params.id);
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(4),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'التقييم غير صالح.' });
    }

    const [taskRow] = await db
      .select()
      .from(educationalTasks)
      .where(eq(educationalTasks.id, taskId))
      .limit(1);

    if (
      !taskRow ||
      taskRow.studentUserId !== req.authUser!.id ||
      taskRow.status !== 'COMPLETED' ||
      !taskRow.acceptedOfferId
    ) {
      return res
        .status(400)
        .json({ error: 'يمكن التقييم فقط بعد اكتمال المهمة من قبل صاحبها.' });
    }

    const [offer] = await db
      .select()
      .from(taskOffers)
      .where(eq(taskOffers.id, taskRow.acceptedOfferId))
      .limit(1);

    if (!offer) {
      return res.status(404).json({ error: 'العرض المقبول غير موجود.' });
    }

    const [rev] = await db
      .insert(reviews)
      .values({
        authorUserId: req.authUser!.id,
        targetUserId: offer.teacherUserId,
        taskId,
        rating: parsed.data.rating,
        comment: parsed.data.comment.trim(),
      })
      .returning();

    const allRevs = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(eq(reviews.targetUserId, offer.teacherUserId));
    const avg =
      allRevs.reduce((acc, r) => acc + r.rating, 0) / Math.max(1, allRevs.length);

    await db
      .update(providerProfiles)
      .set({
        ratingAvg: avg.toFixed(2),
        reviewsCount: allRevs.length,
      })
      .where(eq(providerProfiles.userId, offer.teacherUserId));

    res.status(201).json({ review: rev });
  } catch (error) {
    console.error('Task review error:', error);
    res.status(500).json({ error: 'تعذر حفظ التقييم.' });
  }
});

export default router;
