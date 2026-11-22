import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  roles,
  userRoles,
  providerProfiles,
  centers,
  courses,
  educationalTasks,
  bookings,
  payments,
  reports,
  verifications,
  fields,
  educationalStages,
  subjects,
  skills,
  taskCategories,
  platformSettings,
} from '../../db/schema.ts';
import { requireAuth, requireRole, type AuthRequest } from '../auth.ts';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/admin/overview', async (_req, res) => {
  try {
    const [
      allUsers,
      allCourses,
      allTasks,
      allBookings,
      allPayments,
      allReports,
      allVerifications,
      allCenters,
      settings,
    ] = await Promise.all([
      db.select({ id: users.id, isDemo: users.isDemo }).from(users),
      db.select({ id: courses.id, status: courses.status }).from(courses),
      db.select({ id: educationalTasks.id, status: educationalTasks.status }).from(educationalTasks),
      db.select({ id: bookings.id, status: bookings.status }).from(bookings),
      db.select().from(payments).orderBy(desc(payments.createdAt)),
      db.select().from(reports).orderBy(desc(reports.createdAt)),
      db.select().from(verifications).orderBy(desc(verifications.createdAt)),
      db.select().from(centers).orderBy(desc(centers.createdAt)),
      db.select().from(platformSettings),
    ]);

    const totalVolume = allPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalCommission = allPayments.reduce(
      (s, p) => s + Number(p.commissionAmount),
      0
    );

    res.json({
      stats: {
        usersCount: allUsers.length,
        realUsersCount: allUsers.filter((u) => !u.isDemo).length,
        coursesCount: allCourses.length,
        publishedCoursesCount: allCourses.filter((c) => c.status === 'PUBLISHED')
          .length,
        tasksCount: allTasks.length,
        openTasksCount: allTasks.filter(
          (t) => t.status === 'OPEN' || t.status === 'OFFERS_RECEIVED'
        ).length,
        bookingsCount: allBookings.length,
        centersCount: allCenters.length,
        openReportsCount: allReports.filter((r) => r.status === 'OPEN').length,
        pendingVerificationsCount: allVerifications.filter(
          (v) => v.status === 'PENDING'
        ).length,
        totalVolume: Number(totalVolume.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
      },
      settings,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'تعذر تحميل إحصائيات الإدارة.' });
  }
});

router.get('/admin/users', async (_req, res) => {
  try {
    const userRows = await db.select().from(users).orderBy(desc(users.createdAt));
    const roleAssignments = await db
      .select({
        userId: userRoles.userId,
        code: roles.code,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id));

    const map = new Map<number, string[]>();
    for (const ra of roleAssignments) {
      const list = map.get(ra.userId) || [];
      list.push(ra.code);
      map.set(ra.userId, list);
    }

    res.json({
      users: userRows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        accountStatus: u.accountStatus,
        emailVerified: u.emailVerified,
        isDemo: u.isDemo,
        createdAt: u.createdAt,
        roles: map.get(u.id) || [],
      })),
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'تعذر جلب المستخدمين.' });
  }
});

router.patch('/admin/users/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ accountStatus: z.enum(['ACTIVE', 'SUSPENDED']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الحالة غير صالحة.' });
    }
    const [updated] = await db
      .update(users)
      .set({ accountStatus: parsed.data.accountStatus, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    res.json({ user: updated });
  } catch (error) {
    console.error('Admin user status error:', error);
    res.status(500).json({ error: 'تعذر تحديث حالة المستخدم.' });
  }
});

router.put('/admin/users/:id/roles', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      roleCodes: z.array(
        z.enum([
          'STUDENT',
          'TEACHER',
          'MENTOR',
          'EXPERT',
          'CENTER_OWNER',
          'CENTER_STAFF',
          'ADMIN',
        ])
      ).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الأدوار المحددة غير صالحة.' });
    }

    await db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      for (const code of parsed.data.roleCodes) {
        const [r] = await tx
          .select()
          .from(roles)
          .where(eq(roles.code, code))
          .limit(1);
        if (r) {
          await tx.insert(userRoles).values({ userId: id, roleId: r.id });
        }
      }
    });

    res.json({ updated: true });
  } catch (error) {
    console.error('Admin user roles error:', error);
    res.status(500).json({ error: 'تعذر تحديث أدوار المستخدم.' });
  }
});

router.get('/admin/moderation', async (_req, res) => {
  try {
    const [providersList, centersList, reportsList, paymentsList, coursesList, tasksList] =
      await Promise.all([
        db
          .select({
            userId: providerProfiles.userId,
            fullName: users.fullName,
            email: users.email,
            providerType: providerProfiles.providerType,
            headline: providerProfiles.headline,
            verificationStatus: providerProfiles.verificationStatus,
          })
          .from(providerProfiles)
          .innerJoin(users, eq(providerProfiles.userId, users.id)),
        db.select().from(centers).orderBy(desc(centers.createdAt)),
        db.select().from(reports).orderBy(desc(reports.createdAt)),
        db.select().from(payments).orderBy(desc(payments.createdAt)),
        db.select().from(courses).orderBy(desc(courses.createdAt)),
        db.select().from(educationalTasks).orderBy(desc(educationalTasks.createdAt)),
      ]);

    res.json({
      providers: providersList,
      centers: centersList,
      reports: reportsList,
      payments: paymentsList,
      courses: coursesList,
      tasks: tasksList,
    });
  } catch (error) {
    console.error('Admin moderation error:', error);
    res.status(500).json({ error: 'تعذر جلب بيانات المراجعة.' });
  }
});

router.patch('/admin/providers/:userId/verify', async (req: AuthRequest, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    const schema = z.object({
      status: z.enum(['VERIFIED', 'REJECTED', 'PENDING']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'حالة التوثيق غير صالحة.' });
    }

    const [updated] = await db
      .update(providerProfiles)
      .set({ verificationStatus: parsed.data.status })
      .where(eq(providerProfiles.userId, targetUserId))
      .returning();

    res.json({ provider: updated });
  } catch (error) {
    console.error('Verify provider error:', error);
    res.status(500).json({ error: 'تعذر تحديث توثيق مقدّم الخدمة.' });
  }
});

router.patch('/admin/centers/:id/verify', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({ status: z.enum(['VERIFIED', 'REJECTED', 'PENDING']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الحالة غير صالحة.' });
    }
    const [updated] = await db
      .update(centers)
      .set({ verificationStatus: parsed.data.status })
      .where(eq(centers.id, id))
      .returning();
    res.json({ center: updated });
  } catch (error) {
    console.error('Verify center error:', error);
    res.status(500).json({ error: 'تعذر تحديث توثيق المركز.' });
  }
});

router.patch('/admin/reports/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
      resolutionNote: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المراجعة غير صالحة.' });
    }

    const [updated] = await db
      .update(reports)
      .set({
        status: parsed.data.status,
        resolutionNote: parsed.data.resolutionNote?.trim() || null,
        resolvedByUserId: req.authUser!.id,
        resolvedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    res.json({ report: updated });
  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({ error: 'تعذر تحديث البلاغ.' });
  }
});

router.post('/admin/taxonomy/fields', async (req, res) => {
  try {
    const schema = z.object({
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      descriptionAr: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'اسم المجال بالعربية والإنجليزية مطلوب.' });
    }

    const slug = `${parsed.data.nameEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;

    const [created] = await db
      .insert(fields)
      .values({
        slug,
        nameAr: parsed.data.nameAr.trim(),
        nameEn: parsed.data.nameEn.trim(),
        descriptionAr: parsed.data.descriptionAr?.trim() || null,
      })
      .returning();

    res.status(201).json({ field: created });
  } catch (error) {
    console.error('Add field error:', error);
    res.status(500).json({ error: 'تعذر إضافة المجال التعليمي.' });
  }
});

router.post('/admin/taxonomy/stages', async (req, res) => {
  try {
    const schema = z.object({
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      sortOrder: z.number().int().default(10),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المرحلة غير مكتملة.' });
    }
    const slug = `stage-${Date.now()}`;
    const [created] = await db
      .insert(educationalStages)
      .values({
        slug,
        nameAr: parsed.data.nameAr.trim(),
        nameEn: parsed.data.nameEn.trim(),
        sortOrder: parsed.data.sortOrder,
      })
      .returning();
    res.status(201).json({ stage: created });
  } catch (error) {
    console.error('Add stage error:', error);
    res.status(500).json({ error: 'تعذر إضافة المرحلة التعليمية.' });
  }
});

router.post('/admin/taxonomy/skills', async (req, res) => {
  try {
    const schema = z.object({
      fieldId: z.number().int().positive(),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المهارة غير مكتملة.' });
    }
    const [created] = await db
      .insert(skills)
      .values({
        fieldId: parsed.data.fieldId,
        slug: `skill-${Date.now()}`,
        nameAr: parsed.data.nameAr.trim(),
        nameEn: parsed.data.nameEn.trim(),
      })
      .returning();
    res.status(201).json({ skill: created });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ error: 'تعذر إضافة المهارة.' });
  }
});

router.post('/admin/taxonomy/subjects', async (req, res) => {
  try {
    const schema = z.object({
      fieldId: z.number().int().positive(),
      stageId: z.number().int().positive().nullable().optional(),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المادة غير مكتملة.' });
    }
    const [created] = await db
      .insert(subjects)
      .values({
        fieldId: parsed.data.fieldId,
        stageId: parsed.data.stageId ?? null,
        slug: `subject-${Date.now()}`,
        nameAr: parsed.data.nameAr.trim(),
        nameEn: parsed.data.nameEn.trim(),
      })
      .returning();
    res.status(201).json({ subject: created });
  } catch (error) {
    console.error('Add subject error:', error);
    res.status(500).json({ error: 'تعذر إضافة المادة.' });
  }
});

router.post('/admin/taxonomy/categories', async (req, res) => {
  try {
    const schema = z.object({
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      descriptionAr: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات التصنيف غير مكتملة.' });
    }
    const [created] = await db
      .insert(taskCategories)
      .values({
        slug: `cat-${Date.now()}`,
        nameAr: parsed.data.nameAr.trim(),
        nameEn: parsed.data.nameEn.trim(),
        descriptionAr: parsed.data.descriptionAr?.trim() || null,
      })
      .returning();
    res.status(201).json({ category: created });
  } catch (error) {
    console.error('Add category error:', error);
    res.status(500).json({ error: 'تعذر إضافة التصنيف.' });
  }
});

router.patch('/admin/payments/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['PENDING_SETUP', 'PENDING', 'HELD', 'RELEASED', 'REFUNDED']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الحالة المالية غير صالحة.' });
    }
    const [updated] = await db
      .update(payments)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    res.json({ payment: updated });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'تعذر تحديث حالة المعاملة.' });
  }
});

router.put('/admin/settings', async (req, res) => {
  try {
    const schema = z.object({
      key: z.string().min(2),
      value: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الإعداد غير صالح.' });
    }
    const [updated] = await db
      .insert(platformSettings)
      .values({
        key: parsed.data.key,
        value: parsed.data.value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: parsed.data.value, updatedAt: new Date() },
      })
      .returning();
    res.json({ setting: updated });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'تعذر حفظ الإعداد.' });
  }
});

export default router;
