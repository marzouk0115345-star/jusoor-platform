import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  centers,
  centerMembers,
  courses,
  courseLessons,
  enrollments,
  fields,
  providerProfiles,
  reviews,
  roles,
  userRoles,
  users,
  cvs,
  portfolios,
  userSkills,
  skills,
  certificates,
  skillPassports,
  teacherTeachingAssignments,
  subjects,
  educationalGrades,
  educationalStages,
  educationalSystems,
  secondaryDivisions,
  baccalaureatePathways,
} from '../../db/schema.ts';
import {
  requireAuth,
  optionalAuth,
  type AuthRequest,
} from '../auth.ts';
import { hasCenterPermission } from '../../lib/domain.ts';

const router = Router();

router.get('/centers', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const centerRows = await db
      .select({
        id: centers.id,
        name: centers.name,
        slug: centers.slug,
        description: centers.description,
        city: centers.city,
        country: centers.country,
        website: centers.website,
        bannerUrl: centers.bannerUrl,
        verificationStatus: centers.verificationStatus,
        ownerUserId: centers.ownerUserId,
        ownerName: users.fullName,
        createdAt: centers.createdAt,
      })
      .from(centers)
      .innerJoin(users, eq(centers.ownerUserId, users.id))
      .orderBy(desc(centers.createdAt));

    const enriched = await Promise.all(
      centerRows.map(async (c) => {
        const [rawMembers, centerCourses] = await Promise.all([
          db
            .select({
              id: centerMembers.id,
              userId: centerMembers.userId,
              memberRole: centerMembers.memberRole,
              jobTitle: centerMembers.jobTitle,
              permissionsJson: centerMembers.permissionsJson,
              fullName: users.fullName,
              email: users.email,
              providerProfileId: providerProfiles.id,
            })
            .from(centerMembers)
            .innerJoin(users, eq(centerMembers.userId, users.id))
            .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
            .where(eq(centerMembers.centerId, c.id)),
          db
            .select({
              id: courses.id,
              title: courses.title,
              price: courses.price,
              status: courses.status,
              level: courses.level,
            })
            .from(courses)
            .where(eq(courses.centerId, c.id)),
        ]);

        const callerId = req.authUser?.id;
        const isAdmin = req.authUser?.roles.includes('ADMIN') ?? false;
        const callerMember = callerId
          ? rawMembers.find((m) => m.userId === callerId)
          : undefined;
        const canManageThisCenter =
          isAdmin ||
          c.ownerUserId === callerId ||
          Boolean(
            callerMember &&
              hasCenterPermission(
                callerMember.memberRole,
                callerMember.permissionsJson,
                'MANAGE_STAFF'
              )
          );

        const members = rawMembers.map((m) => ({
          id: m.id,
          userId: m.userId,
          memberRole: m.memberRole,
          jobTitle: m.jobTitle,
          permissionsJson: canManageThisCenter ? m.permissionsJson : [],
          fullName: m.fullName,
          ...(canManageThisCenter ? { email: m.email } : {}),
          hasInstructorProfile:
            m.memberRole === 'INSTRUCTOR' || Boolean(m.providerProfileId),
        }));

        const publishedCourses = centerCourses.filter(
          (crs) => crs.status === 'PUBLISHED' || canManageThisCenter
        );

        let totalEnrollments = 0;
        for (const crs of publishedCourses) {
          const enr = await db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(eq(enrollments.courseId, crs.id));
          totalEnrollments += enr.length;
        }

        return {
          ...c,
          canManage: canManageThisCenter,
          members,
          courses: publishedCourses,
          stats: {
            membersCount: members.length,
            coursesCount: publishedCourses.length,
            totalEnrollments,
          },
        };
      })
    );

    res.json({ centers: enriched });
  } catch (error) {
    console.error('List centers error:', error);
    res.status(500).json({ error: 'تعذر جلب المراكز التعليمية.' });
  }
});

router.post(
  '/centers',
  requireAuth,
  async (req: AuthRequest, res) => {
    if (
      !req.authUser!.roles.includes('CENTER_OWNER') &&
      !req.authUser!.roles.includes('ADMIN')
    ) {
      return res.status(403).json({ error: 'غير مصرح بإنشاء مركز تعليمي.' });
    }
    try {
      const schema = z.object({
        name: z.string().min(3, 'اسم المركز مطلوب'),
        description: z.string().min(10, 'وصف المركز مطلوب'),
        city: z.string().min(2, 'المدينة مطلوبة'),
        country: z.string().min(2, 'الدولة مطلوبة'),
        website: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات المركز غير صالحة.',
        });
      }

      const d = parsed.data;
      const slug = `center-${Date.now()}`;
      const created = await db.transaction(async (tx) => {
        const [center] = await tx
          .insert(centers)
          .values({
            ownerUserId: req.authUser!.id,
            name: d.name.trim(),
            slug,
            description: d.description.trim(),
            city: d.city.trim(),
            country: d.country.trim(),
            website: d.website?.trim() || null,
            bannerUrl: '/src/assets/images/center_academy_hub_1795328020183.jpg',
            verificationStatus: 'PENDING',
          })
          .returning();

        await tx.insert(centerMembers).values({
          centerId: center.id,
          userId: req.authUser!.id,
          memberRole: 'OWNER',
          jobTitle: 'مؤسس ومدير المركز',
          permissionsJson: [
            'MANAGE_CENTER',
            'MANAGE_STAFF',
            'MANAGE_COURSES',
            'VIEW_REPORTS',
          ],
        });

        return center;
      });

      res.status(201).json({ center: created });
    } catch (error) {
      console.error('Create center error:', error);
      res.status(500).json({ error: 'تعذر إنشاء المركز التعليمي.' });
    }
  }
);

router.post(
  '/centers/:id/members',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.id);
      if (!Number.isInteger(centerId) || centerId <= 0) {
        return res.status(400).json({ error: 'معرف المركز غير صالح.' });
      }
      const schema = z.object({
        email: z.string().trim().email('البريد الإلكتروني غير صالح'),
        memberRole: z.enum(['MANAGER', 'INSTRUCTOR', 'STAFF']),
        jobTitle: z
          .string()
          .trim()
          .min(2, 'المسمى الوظيفي أو التخصص مطلوب (حرفان على الأقل)')
          .max(140, 'المسمى الوظيفي طويل جداً'),
        permissions: z.array(z.string()).default(['VIEW_ENROLLMENTS']),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات العضو غير صالحة.',
        });
      }

      const [centerRow] = await db
        .select({ id: centers.id, ownerUserId: centers.ownerUserId })
        .from(centers)
        .where(eq(centers.id, centerId))
        .limit(1);
      if (!centerRow) {
        return res.status(404).json({ error: 'المركز التعليمي غير موجود.' });
      }

      const [membership] = await db
        .select()
        .from(centerMembers)
        .where(
          and(
            eq(centerMembers.centerId, centerId),
            eq(centerMembers.userId, req.authUser!.id)
          )
        )
        .limit(1);

      const isAdmin = req.authUser!.roles.includes('ADMIN');
      const isOwner = centerRow.ownerUserId === req.authUser!.id;
      if (
        !isAdmin &&
        !isOwner &&
        (!membership ||
          !hasCenterPermission(
            membership.memberRole,
            membership.permissionsJson,
            'MANAGE_STAFF'
          ))
      ) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية إدارة فريق هذا المركز.' });
      }

      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, parsed.data.email.toLowerCase()))
        .limit(1);
      if (!targetUser) {
        return res
          .status(404)
          .json({ error: 'لم يتم العثور على مستخدم بهذا البريد الإلكتروني.' });
      }

      const [member] = await db
        .insert(centerMembers)
        .values({
          centerId,
          userId: targetUser.id,
          memberRole: parsed.data.memberRole,
          jobTitle: parsed.data.jobTitle,
          permissionsJson: parsed.data.permissions,
        })
        .onConflictDoUpdate({
          target: [centerMembers.centerId, centerMembers.userId],
          set: {
            memberRole: parsed.data.memberRole,
            jobTitle: parsed.data.jobTitle,
            permissionsJson: parsed.data.permissions,
          },
        })
        .returning();

      res.status(201).json({ member });
    } catch (error) {
      console.error('Add center member error:', error);
      res.status(500).json({ error: 'تعذر إضافة العضو للمركز.' });
    }
  }
);

router.patch(
  '/centers/:id/members/:memberId',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const centerId = Number(req.params.id);
      const memberId = Number(req.params.memberId);
      if (
        !Number.isInteger(centerId) ||
        centerId <= 0 ||
        !Number.isInteger(memberId) ||
        memberId <= 0
      ) {
        return res.status(400).json({ error: 'معرف المركز أو العضو غير صالح.' });
      }

      const schema = z.object({
        jobTitle: z
          .string()
          .trim()
          .min(2, 'المسمى الوظيفي أو التخصص مطلوب (حرفان على الأقل)')
          .max(140, 'المسمى الوظيفي طويل جداً'),
        memberRole: z.enum(['MANAGER', 'INSTRUCTOR', 'STAFF']).optional(),
        permissions: z.array(z.string()).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات التحديث غير صالحة.',
        });
      }

      const [centerRow] = await db
        .select({ id: centers.id, ownerUserId: centers.ownerUserId })
        .from(centers)
        .where(eq(centers.id, centerId))
        .limit(1);
      if (!centerRow) {
        return res.status(404).json({ error: 'المركز التعليمي غير موجود.' });
      }

      const [callerMembership] = await db
        .select()
        .from(centerMembers)
        .where(
          and(
            eq(centerMembers.centerId, centerId),
            eq(centerMembers.userId, req.authUser!.id)
          )
        )
        .limit(1);

      const isAdmin = req.authUser!.roles.includes('ADMIN');
      const isOwner = centerRow.ownerUserId === req.authUser!.id;
      if (
        !isAdmin &&
        !isOwner &&
        (!callerMembership ||
          !hasCenterPermission(
            callerMembership.memberRole,
            callerMembership.permissionsJson,
            'MANAGE_STAFF'
          ))
      ) {
        return res
          .status(403)
          .json({ error: 'لا تملك صلاحية تعديل أعضاء هذا المركز.' });
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
        return res
          .status(404)
          .json({ error: 'العضو غير موجود ضمن فريق هذا المركز.' });
      }

      const nextRole =
        targetMember.memberRole === 'OWNER'
          ? 'OWNER'
          : parsed.data.memberRole || targetMember.memberRole;

      const [updated] = await db
        .update(centerMembers)
        .set({
          jobTitle: parsed.data.jobTitle,
          memberRole: nextRole,
          ...(parsed.data.permissions
            ? { permissionsJson: parsed.data.permissions }
            : {}),
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
      console.error('Update center member error:', error);
      res.status(500).json({ error: 'تعذر تحديث بيانات العضو.' });
    }
  }
);

router.get('/instructors/:instructorId', optionalAuth, async (req, res) => {
  try {
    const instructorId = Number(req.params.instructorId);
    if (!Number.isInteger(instructorId) || instructorId <= 0) {
      return res.status(400).json({ error: 'معرف المدرّب غير صالح.' });
    }

    const [userRow] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.id, instructorId))
      .limit(1);

    if (!userRow || userRow.accountStatus !== 'ACTIVE') {
      return res.status(404).json({ error: 'المدرّب غير موجود.' });
    }

    const [[profileRow], roleRows, affiliations, publishedCoursesRaw, teachingAssignmentRows] =
      await Promise.all([
        db
          .select({
            providerType: providerProfiles.providerType,
            headline: providerProfiles.headline,
            bio: providerProfiles.bio,
            qualifications: providerProfiles.qualifications,
            yearsExperience: providerProfiles.yearsExperience,
            verificationStatus: providerProfiles.verificationStatus,
            ratingAvg: providerProfiles.ratingAvg,
            reviewsCount: providerProfiles.reviewsCount,
          })
          .from(providerProfiles)
          .where(eq(providerProfiles.userId, instructorId))
          .limit(1),
        db
          .select({ code: roles.code })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, instructorId)),
        db
          .select({
            centerId: centers.id,
            centerName: centers.name,
            jobTitle: centerMembers.jobTitle,
            memberRole: centerMembers.memberRole,
            status: centerMembers.status,
          })
          .from(centerMembers)
          .innerJoin(centers, eq(centerMembers.centerId, centers.id))
          .where(eq(centerMembers.userId, instructorId))
          .orderBy(asc(centerMembers.id)),
        db
          .select({
            id: courses.id,
            title: courses.title,
            subtitle: courses.subtitle,
            level: courses.level,
            price: courses.price,
            currency: courses.currency,
            thumbnailUrl: courses.thumbnailUrl,
            fieldNameAr: fields.nameAr,
            centerId: courses.centerId,
          })
          .from(courses)
          .innerJoin(fields, eq(courses.fieldId, fields.id))
          .where(
            and(
              eq(courses.instructorUserId, instructorId),
              eq(courses.status, 'PUBLISHED')
            )
          )
          .orderBy(desc(courses.createdAt)),
        db
          .select({
            id: teacherTeachingAssignments.id,
            curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
            subjectId: teacherTeachingAssignments.subjectId,
            subjectNameAr: subjects.nameAr,
            subjectNameEn: subjects.nameEn,
            stageId: educationalGrades.stageId,
            stageNameAr: educationalStages.nameAr,
            stageNameEn: educationalStages.nameEn,
            gradeId: teacherTeachingAssignments.gradeId,
            gradeNameAr: educationalGrades.nameAr,
            gradeNameEn: educationalGrades.nameEn,
            systemId: teacherTeachingAssignments.systemId,
            systemNameAr: educationalSystems.nameAr,
            systemNameEn: educationalSystems.nameEn,
            divisionId: teacherTeachingAssignments.divisionId,
            divisionNameAr: secondaryDivisions.nameAr,
            divisionNameEn: secondaryDivisions.nameEn,
            pathwayId: teacherTeachingAssignments.pathwayId,
            pathwayNameAr: baccalaureatePathways.nameAr,
            pathwayNameEn: baccalaureatePathways.nameEn,
            languagesOffered: teacherTeachingAssignments.languagesOfferedJson,
            religiousVariant: teacherTeachingAssignments.religiousVariant,
            hourlyRate: teacherTeachingAssignments.hourlyRate,
            currency: teacherTeachingAssignments.currency,
            supportsOnline: teacherTeachingAssignments.supportsOnline,
            supportsInPerson: teacherTeachingAssignments.supportsInPerson,
          })
          .from(teacherTeachingAssignments)
          .innerJoin(subjects, eq(teacherTeachingAssignments.subjectId, subjects.id))
          .innerJoin(
            educationalGrades,
            eq(teacherTeachingAssignments.gradeId, educationalGrades.id)
          )
          .innerJoin(
            educationalStages,
            eq(educationalGrades.stageId, educationalStages.id)
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
              eq(teacherTeachingAssignments.teacherUserId, instructorId),
              eq(teacherTeachingAssignments.isActive, true)
            )
          )
          .orderBy(asc(educationalGrades.sortOrder), asc(subjects.nameAr)),
      ]);

    const roleCodes = roleRows.map((r) => r.code);
    const activeAffiliations = affiliations
      .filter((a) => a.status === 'ACTIVE')
      .map((a) => ({
        centerId: a.centerId,
        centerName: a.centerName,
        jobTitle: a.jobTitle,
        memberRole: a.memberRole,
      }));

    const isInstructorEligible =
      Boolean(profileRow) ||
      roleCodes.some((r) => ['TEACHER', 'MENTOR', 'EXPERT'].includes(r)) ||
      activeAffiliations.some((a) => a.memberRole === 'INSTRUCTOR') ||
      publishedCoursesRaw.length > 0 ||
      teachingAssignmentRows.length > 0;

    if (!isInstructorEligible) {
      return res.status(404).json({ error: 'الملف العام غير متاح لهذا الحساب.' });
    }

    const enrichedCourses = await Promise.all(
      publishedCoursesRaw.map(async (c) => {
        const [lessonsList, reviewsList, centerRow] = await Promise.all([
          db
            .select({ id: courseLessons.id })
            .from(courseLessons)
            .where(eq(courseLessons.courseId, c.id)),
          db
            .select({ rating: reviews.rating })
            .from(reviews)
            .where(eq(reviews.courseId, c.id)),
          c.centerId
            ? db
                .select({ name: centers.name })
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
            : null;

        return {
          id: c.id,
          title: c.title,
          subtitle: c.subtitle,
          level: c.level,
          price: c.price,
          currency: c.currency,
          thumbnailUrl: c.thumbnailUrl,
          fieldNameAr: c.fieldNameAr,
          lessonsCount: lessonsList.length,
          ratingAvg: avgRating,
          reviewsCount: reviewsList.length,
          centerName: centerRow[0]?.name || null,
        };
      })
    );

    const primaryJobTitle =
      activeAffiliations.find((a) => a.jobTitle.trim().length > 0)?.jobTitle ||
      profileRow?.headline ||
      'مدرّب ومقدّم خدمات تعليمية';

    const expertiseFields = Array.from(
      new Set(enrichedCourses.map((c) => c.fieldNameAr))
    );

    res.json({
      instructor: {
        id: userRow.id,
        fullName: userRow.fullName,
        avatarUrl: userRow.avatarUrl,
        providerType: profileRow?.providerType || 'TEACHER',
        headline: profileRow?.headline || primaryJobTitle,
        jobTitle: primaryJobTitle,
        bio: profileRow?.bio || '',
        qualifications: profileRow?.qualifications || null,
        yearsExperience: profileRow?.yearsExperience ?? null,
        verificationStatus: profileRow?.verificationStatus || 'PENDING',
        ratingAvg: profileRow?.ratingAvg || '0.00',
        reviewsCount: profileRow?.reviewsCount ?? 0,
        fields: expertiseFields,
        centerAffiliations: activeAffiliations,
        teachingAssignments: teachingAssignmentRows,
      },
      courses: enrichedCourses,
    });
  } catch (error) {
    console.error('Public instructor profile error:', error);
    res.status(500).json({ error: 'تعذر جلب الملف العام للمدرّب.' });
  }
});

async function handleInstructorBioUpdate(req: AuthRequest, res: any) {
  try {
    const uid = req.authUser!.id;
    const schema = z.object({
      bio: z
        .string()
        .trim()
        .max(3000, 'النبذة التعريفية طويلة جداً (الحد الأقصى 3000 حرف)'),
      headline: z.string().trim().max(200).optional(),
      qualifications: z.string().trim().max(300).optional(),
      yearsExperience: z.number().int().min(0).max(70).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'بيانات النبذة غير صالحة.',
      });
    }

    const [existingPp] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, uid))
      .limit(1);

    const [instructorMembership] = await db
      .select({ id: centerMembers.id })
      .from(centerMembers)
      .where(
        and(
          eq(centerMembers.userId, uid),
          eq(centerMembers.memberRole, 'INSTRUCTOR')
        )
      )
      .limit(1);

    const canEditBio =
      Boolean(existingPp) ||
      Boolean(instructorMembership) ||
      req.authUser!.roles.some((r) =>
        ['TEACHER', 'MENTOR', 'EXPERT', 'CENTER_OWNER', 'CENTER_STAFF', 'ADMIN'].includes(
          r
        )
      );

    if (!canEditBio) {
      return res
        .status(403)
        .json({ error: 'تحديث السيرة الذاتية متاح للمدرّبين ومقدّمي الخدمات فقط.' });
    }

    const defaultType = req.authUser!.roles.includes('MENTOR')
      ? 'MENTOR'
      : req.authUser!.roles.includes('EXPERT')
      ? 'EXPERT'
      : 'TEACHER';

    const [saved] = existingPp
      ? await db
          .update(providerProfiles)
          .set({
            bio: parsed.data.bio,
            ...(parsed.data.headline !== undefined
              ? { headline: parsed.data.headline || existingPp.headline }
              : {}),
            ...(parsed.data.qualifications !== undefined
              ? { qualifications: parsed.data.qualifications || null }
              : {}),
            ...(parsed.data.yearsExperience !== undefined
              ? { yearsExperience: parsed.data.yearsExperience }
              : {}),
          })
          .where(eq(providerProfiles.userId, uid))
          .returning()
      : await db
          .insert(providerProfiles)
          .values({
            userId: uid,
            providerType: defaultType,
            headline: parsed.data.headline || 'مدرّب ومقدّم خدمات تعليمية',
            bio: parsed.data.bio,
            qualifications: parsed.data.qualifications || null,
            yearsExperience: parsed.data.yearsExperience ?? 1,
            verificationStatus: 'PENDING',
          })
          .returning();

    res.json({ profile: saved });
  } catch (error) {
    console.error('Update instructor bio error:', error);
    res.status(500).json({ error: 'تعذر حفظ النبذة التعريفية.' });
  }
}

router.put('/instructors/me/bio', requireAuth, handleInstructorBioUpdate);

router.patch(
  '/instructors/:instructorId/bio',
  requireAuth,
  async (req: AuthRequest, res) => {
    const targetId = Number(req.params.instructorId);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'معرف المدرّب غير صالح.' });
    }
    if (targetId !== req.authUser!.id) {
      return res
        .status(403)
        .json({ error: 'لا يمكنك تعديل السيرة الذاتية لمدرّب آخر.' });
    }
    return handleInstructorBioUpdate(req, res);
  }
);

router.get('/prof-dev/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;
    const [[cv], portfolioItems, mySkills, myCerts, [passport]] =
      await Promise.all([
        db.select().from(cvs).where(eq(cvs.userId, uid)).limit(1),
        db
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, uid))
          .orderBy(desc(portfolios.createdAt)),
        db
          .select({
            id: userSkills.id,
            skillId: skills.id,
            nameAr: skills.nameAr,
            nameEn: skills.nameEn,
            proficiencyLevel: userSkills.proficiencyLevel,
            verifiedByPassport: userSkills.verifiedByPassport,
          })
          .from(userSkills)
          .innerJoin(skills, eq(userSkills.skillId, skills.id))
          .where(eq(userSkills.userId, uid)),
        db
          .select()
          .from(certificates)
          .where(eq(certificates.userId, uid))
          .orderBy(desc(certificates.issuedAt)),
        db
          .select()
          .from(skillPassports)
          .where(eq(skillPassports.userId, uid))
          .limit(1),
      ]);

    res.json({
      cv: cv || null,
      portfolios: portfolioItems,
      skills: mySkills,
      certificates: myCerts,
      skillPassport: passport || null,
    });
  } catch (error) {
    console.error('Prof dev fetch error:', error);
    res.status(500).json({ error: 'تعذر جلب بيانات التطوير المهني.' });
  }
});

router.put('/prof-dev/cv', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      headline: z.string().min(3, 'المسمى المهني مطلوب'),
      summary: z.string().min(10, 'الملخص المهني مطلوب'),
      educationJson: z
        .array(
          z.object({
            institution: z.string(),
            degree: z.string(),
            year: z.string(),
          })
        )
        .default([]),
      experienceJson: z
        .array(
          z.object({
            role: z.string(),
            organization: z.string(),
            period: z.string(),
            highlights: z.string(),
          })
        )
        .default([]),
      languagesJson: z.array(z.string()).default(['العربية']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات السيرة الذاتية غير صالحة.' });
    }

    const d = parsed.data;
    const [saved] = await db
      .insert(cvs)
      .values({
        userId: req.authUser!.id,
        headline: d.headline.trim(),
        summary: d.summary.trim(),
        educationJson: d.educationJson,
        experienceJson: d.experienceJson,
        languagesJson: d.languagesJson,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cvs.userId,
        set: {
          headline: d.headline.trim(),
          summary: d.summary.trim(),
          educationJson: d.educationJson,
          experienceJson: d.experienceJson,
          languagesJson: d.languagesJson,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ cv: saved });
  } catch (error) {
    console.error('Save CV error:', error);
    res.status(500).json({ error: 'تعذر حفظ السيرة الذاتية.' });
  }
});

router.post('/prof-dev/portfolio', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      title: z.string().min(3),
      description: z.string().min(10),
      projectUrl: z.string().optional(),
      skillsSummary: z.string().optional(),
      completedAt: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المشروع غير مكتملة.' });
    }

    const [item] = await db
      .insert(portfolios)
      .values({
        userId: req.authUser!.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        projectUrl: parsed.data.projectUrl?.trim() || null,
        skillsSummary: parsed.data.skillsSummary?.trim() || null,
        completedAt: parsed.data.completedAt?.trim() || '2026',
        imageUrl: '/src/assets/images/course_uiux_design_1795328020176.jpg',
      })
      .returning();

    res.status(201).json({ item });
  } catch (error) {
    console.error('Add portfolio error:', error);
    res.status(500).json({ error: 'تعذر إضافة العمل إلى المعرض.' });
  }
});

router.delete(
  '/prof-dev/portfolio/:id',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const deleted = await db
        .delete(portfolios)
        .where(
          and(eq(portfolios.id, id), eq(portfolios.userId, req.authUser!.id))
        )
        .returning();
      if (deleted.length === 0) {
        return res
          .status(404)
          .json({ error: 'العنصر غير موجود أو لا تملك صلاحية حذفه.' });
      }
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete portfolio error:', error);
      res.status(500).json({ error: 'تعذر حذف العمل.' });
    }
  }
);

router.post('/prof-dev/skills', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      skillId: z.number().int().positive(),
      proficiencyLevel: z.enum([
        'BEGINNER',
        'INTERMEDIATE',
        'ADVANCED',
        'EXPERT',
      ]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات المهارة غير صالحة.' });
    }

    const [saved] = await db
      .insert(userSkills)
      .values({
        userId: req.authUser!.id,
        skillId: parsed.data.skillId,
        proficiencyLevel: parsed.data.proficiencyLevel,
      })
      .onConflictDoUpdate({
        target: [userSkills.userId, userSkills.skillId],
        set: { proficiencyLevel: parsed.data.proficiencyLevel },
      })
      .returning();

    res.status(201).json({ skill: saved });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ error: 'تعذر حفظ المهارة.' });
  }
});

export default router;
