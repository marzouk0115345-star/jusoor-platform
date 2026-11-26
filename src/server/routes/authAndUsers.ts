import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { eq, asc, and, notLike } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  roles,
  userRoles,
  educationalStages,
  fields,
  subjects,
  skills,
  taskCategories,
  studentProfiles,
  providerProfiles,
  centers,
  centerMembers,
  notifications,
} from '../../db/schema.ts';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  requireAuth,
  loadUserWithRolesById,
  type AuthRequest,
} from '../auth.ts';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  fullName: z.string().min(2, 'الاسم الكامل مطلوب'),
  primaryRole: z
    .enum(['STUDENT', 'TEACHER', 'MENTOR', 'EXPERT', 'CENTER_OWNER'])
    .default('STUDENT'),
  stageId: z.number().int().positive().optional(),
  headline: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

router.get('/taxonomy', async (_req, res) => {
  try {
    const [stageList, fieldList, subjectList, skillList, categoryList, roleList] =
      await Promise.all([
        db
          .select()
          .from(educationalStages)
          .where(eq(educationalStages.isActive, true))
          .orderBy(asc(educationalStages.sortOrder)),
        db.select().from(fields).where(eq(fields.isActive, true)).orderBy(asc(fields.id)),
        db.select().from(subjects).where(eq(subjects.isActive, true)).orderBy(asc(subjects.id)),
        db.select().from(skills).orderBy(asc(skills.id)),
        db.select().from(taskCategories).orderBy(asc(taskCategories.id)),
        db.select().from(roles).orderBy(asc(roles.id)),
      ]);

    res.json({
      stages: stageList,
      fields: fieldList,
      subjects: subjectList,
      skills: skillList,
      taskCategories: categoryList,
      roles: roleList,
    });
  } catch (error) {
    console.error('Taxonomy fetch error:', error);
    res.status(500).json({ error: 'تعذر تحميل التصنيفات التعليمية.' });
  }
});

router.get('/auth/demo-accounts', async (_req, res) => {
  try {
    const demoUsers = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
      })
      .from(users)
      .where(
        and(
          eq(users.isDemo, true),
          notLike(users.email, '%@teachers.demo.jusoor.edu')
        )
      )
      .orderBy(asc(users.id));

    const enriched = await Promise.all(
      demoUsers.map(async (u) => {
        const full = await loadUserWithRolesById(u.id);
        return {
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          roles: full?.roles ?? [],
        };
      })
    );

    res.json({ demoAccounts: enriched });
  } catch (error) {
    console.error('Demo accounts error:', error);
    res.status(500).json({ error: 'تعذر جلب حسابات العرض.' });
  }
});

router.post('/auth/demo-login', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بريد إلكتروني غير صالح.' });
    }

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (!userRow || !userRow.isDemo) {
      return res.status(403).json({
        error: 'الدخول السريع متاح فقط لحسابات العرض التجريبية المعتمدة.',
      });
    }

    const fullUser = await loadUserWithRolesById(userRow.id);
    if (!fullUser) {
      return res.status(403).json({ error: 'الحساب موقوف أو غير نشط.' });
    }

    const token = signSessionToken(fullUser.id, fullUser.email);
    res.json({ token, user: fullUser });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'تعذر تسجيل الدخول التجريبي.' });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'بيانات التسجيل غير مكتملة.',
      });
    }
    const { email, password, fullName, primaryRole, stageId, headline } =
      parsed.data;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: 'هذا البريد الإلكتروني مسجل مسبقاً.' });
    }

    const passwordHash = hashPassword(password);

    const createdUserId = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          fullName: fullName.trim(),
          emailVerified: false,
          accountStatus: 'ACTIVE',
          isDemo: false,
        })
        .returning();

      const [roleRow] = await tx
        .select()
        .from(roles)
        .where(eq(roles.code, primaryRole))
        .limit(1);

      if (roleRow) {
        await tx
          .insert(userRoles)
          .values({ userId: newUser.id, roleId: roleRow.id });
      }

      if (primaryRole === 'STUDENT') {
        await tx.insert(studentProfiles).values({
          userId: newUser.id,
          stageId: stageId ?? null,
          learningGoal: 'بناء مسار تعلّم واضح وتطوير المهارات العملية',
        });
      } else if (
        primaryRole === 'TEACHER' ||
        primaryRole === 'MENTOR' ||
        primaryRole === 'EXPERT'
      ) {
        await tx.insert(providerProfiles).values({
          userId: newUser.id,
          providerType: primaryRole,
          headline: headline?.trim() || 'مقدّم خدمات تعليمية في منصة جسور',
          bio: 'ملف تعريفي جديد في منصة جسور.',
          verificationStatus: 'PENDING',
        });
      }

      return newUser.id;
    });

    const fullUser = await loadUserWithRolesById(createdUserId);
    if (!fullUser) {
      return res.status(500).json({ error: 'فشل تحميل بيانات الحساب الجديد.' });
    }
    const token = signSessionToken(fullUser.id, fullUser.email);
    res.status(201).json({ token, user: fullUser });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب.' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'بيانات الدخول غير صالحة.',
      });
    }

    const emailLower = parsed.data.email.toLowerCase();
    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (!userRow || !userRow.passwordHash) {
      return res
        .status(401)
        .json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    if (userRow.accountStatus === 'SUSPENDED') {
      return res
        .status(403)
        .json({ error: 'تم إيقاف هذا الحساب. تواصل مع إدارة المنصة.' });
    }

    const valid = verifyPassword(parsed.data.password, userRow.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    const fullUser = await loadUserWithRolesById(userRow.id);
    if (!fullUser) {
      return res.status(401).json({ error: 'تعذر التحقق من الحساب.' });
    }
    const token = signSessionToken(fullUser.id, fullUser.email);
    res.json({ token, user: fullUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'تعذر تسجيل الدخول.' });
  }
});

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
    }

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);

    if (userRow && !userRow.isDemo && userRow.passwordHash) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      await db
        .update(users)
        .set({
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
        })
        .where(eq(users.id, userRow.id));
    }

    res.json({
      message:
        'إذا كان البريد مسجلاً بكلمة مرور، فسيتم إرسال تعليمات الاستعادة عبر مزود البريد عند تفعيله.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'تعذر معالجة طلب استعادة كلمة المرور.' });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(10),
      newPassword: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الرمز أو كلمة المرور غير صالحة.' });
    }
    const tokenHash = crypto
      .createHash('sha256')
      .update(parsed.data.token)
      .digest('hex');

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.resetTokenHash, tokenHash))
      .limit(1);

    if (
      !userRow ||
      !userRow.resetTokenExpiresAt ||
      userRow.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      return res
        .status(400)
        .json({ error: 'رمز الاستعادة غير صالح أو منتهي الصلاحية.' });
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(parsed.data.newPassword),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRow.id));

    res.json({ message: 'تم تحديث كلمة المرور بنجاح.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'تعذر إعادة تعيين كلمة المرور.' });
  }
});

router.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const u = req.authUser!;
    const [studentProfile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, u.id))
      .limit(1);
    const [providerProfile] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, u.id))
      .limit(1);
    const memberships = await db
      .select({
        id: centerMembers.id,
        centerId: centerMembers.centerId,
        centerName: centers.name,
        memberRole: centerMembers.memberRole,
        jobTitle: centerMembers.jobTitle,
        permissionsJson: centerMembers.permissionsJson,
      })
      .from(centerMembers)
      .innerJoin(centers, eq(centerMembers.centerId, centers.id))
      .where(eq(centerMembers.userId, u.id));
    const unreadNotifs = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, u.id));

    res.json({
      user: u,
      studentProfile: studentProfile || null,
      providerProfile: providerProfile || null,
      centerMemberships: memberships,
      unreadNotificationsCount: unreadNotifs.length,
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'تعذر جلب الملف الشخصي.' });
  }
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      fullName: z.string().min(2).max(120).optional(),
      phone: z.string().max(40).optional(),
      locale: z.enum(['ar', 'en']).optional(),
      learningGoal: z.string().max(500).optional(),
      careerInterest: z.string().max(200).optional(),
      stageId: z.number().int().positive().nullable().optional(),
      headline: z.string().max(200).optional(),
      bio: z.string().max(3000).optional(),
      qualifications: z.string().max(300).optional(),
      yearsExperience: z.number().int().min(0).max(70).optional(),
      hourlyRate: z.number().min(0).max(5000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات الملف الشخصي غير صالحة.' });
    }

    const u = req.authUser!;
    const data = parsed.data;

    await db.transaction(async (tx) => {
      if (data.fullName || data.phone !== undefined || data.locale) {
        await tx
          .update(users)
          .set({
            ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.locale ? { locale: data.locale } : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, u.id));
      }

      if (
        data.learningGoal !== undefined ||
        data.careerInterest !== undefined ||
        data.stageId !== undefined
      ) {
        const existingSp = await tx
          .select()
          .from(studentProfiles)
          .where(eq(studentProfiles.userId, u.id))
          .limit(1);
        if (existingSp.length > 0) {
          await tx
            .update(studentProfiles)
            .set({
              ...(data.learningGoal !== undefined
                ? { learningGoal: data.learningGoal }
                : {}),
              ...(data.careerInterest !== undefined
                ? { careerInterest: data.careerInterest }
                : {}),
              ...(data.stageId !== undefined ? { stageId: data.stageId } : {}),
            })
            .where(eq(studentProfiles.userId, u.id));
        } else {
          await tx.insert(studentProfiles).values({
            userId: u.id,
            learningGoal: data.learningGoal || null,
            careerInterest: data.careerInterest || null,
            stageId: data.stageId ?? null,
          });
        }
      }

      if (
        data.headline !== undefined ||
        data.bio !== undefined ||
        data.qualifications !== undefined ||
        data.yearsExperience !== undefined ||
        data.hourlyRate !== undefined
      ) {
        const existingPp = await tx
          .select()
          .from(providerProfiles)
          .where(eq(providerProfiles.userId, u.id))
          .limit(1);
        if (existingPp.length > 0) {
          await tx
            .update(providerProfiles)
            .set({
              ...(data.headline !== undefined
                ? { headline: data.headline.trim() }
                : {}),
              ...(data.bio !== undefined ? { bio: data.bio.trim() } : {}),
              ...(data.qualifications !== undefined
                ? { qualifications: data.qualifications.trim() }
                : {}),
              ...(data.yearsExperience !== undefined
                ? { yearsExperience: data.yearsExperience }
                : {}),
              ...(data.hourlyRate !== undefined
                ? { hourlyRate: data.hourlyRate.toFixed(2) }
                : {}),
            })
            .where(eq(providerProfiles.userId, u.id));
        } else {
          const defaultType = u.roles.includes('MENTOR')
            ? 'MENTOR'
            : u.roles.includes('EXPERT')
            ? 'EXPERT'
            : 'TEACHER';
          await tx.insert(providerProfiles).values({
            userId: u.id,
            providerType: defaultType,
            headline: data.headline?.trim() || 'مدرّب ومقدّم خدمات تعليمية',
            bio: data.bio?.trim() || '',
            qualifications: data.qualifications?.trim() || null,
            yearsExperience: data.yearsExperience ?? 1,
            hourlyRate:
              data.hourlyRate !== undefined ? data.hourlyRate.toFixed(2) : '25.00',
            verificationStatus: 'PENDING',
          });
        }
      }
    });

    const updated = await loadUserWithRolesById(u.id);
    res.json({ user: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'تعذر تحديث الملف الشخصي.' });
  }
});

export default router;
