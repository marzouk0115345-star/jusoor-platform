import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  centers,
  centerBranches,
  centerMembers,
  centerTeacherAssignments,
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
import {
  buildGoogleMapsSearchUrl,
  DEFAULT_CENTER_WORKING_HOURS,
  formatCenterFullAddress,
  getCenterVerificationLabelAr,
  hasCenterPermission,
  isPublicCenterCourseVisible,
  isPublicCenterMemberVisible,
  resolveCourseFieldDisplay,
} from '../../lib/domain.ts';

const router = Router();

router.get('/centers', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const centerRows = await db
      .select({
        id: centers.id,
        name: centers.name,
        slug: centers.slug,
        description: centers.description,
        governorate: centers.governorate,
        city: centers.city,
        country: centers.country,
        street: centers.street,
        buildingDetails: centers.buildingDetails,
        address: centers.address,
        latitude: centers.latitude,
        longitude: centers.longitude,
        phone: centers.phone,
        secondaryPhone: centers.secondaryPhone,
        website: centers.website,
        bannerUrl: centers.bannerUrl,
        logoUrl: centers.logoUrl,
        verificationStatus: centers.verificationStatus,
        ownerUserId: centers.ownerUserId,
        ownerName: users.fullName,
        ownerStatus: users.accountStatus,
        createdAt: centers.createdAt,
      })
      .from(centers)
      .innerJoin(users, eq(centers.ownerUserId, users.id))
      .orderBy(desc(centers.createdAt));

    const callerId = req.authUser?.id;
    const visibleCenters = centerRows.filter(
      (c) => c.ownerStatus === 'ACTIVE' || (callerId && c.ownerUserId === callerId)
    );

    const enriched = await Promise.all(
      visibleCenters.map(async (c) => {
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
            .where(
              and(
                eq(centerMembers.centerId, c.id),
                eq(centerMembers.status, 'ACTIVE'),
                eq(users.accountStatus, 'ACTIVE')
              )
            ),
          db
            .select({
              id: courses.id,
              title: courses.title,
              price: courses.price,
              status: courses.status,
              level: courses.level,
            })
            .from(courses)
            .innerJoin(users, eq(courses.instructorUserId, users.id))
            .where(
              and(
                eq(courses.centerId, c.id),
                eq(users.accountStatus, 'ACTIVE')
              )
            ),
        ]);

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
          (crs) => isPublicCenterCourseVisible(crs.status) || canManageThisCenter
        );

        let totalEnrollments = 0;
        for (const crs of publishedCourses) {
          const enr = await db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(eq(enrollments.courseId, crs.id));
          totalEnrollments += enr.length;
        }

        const latitude =
          c.latitude !== null && c.latitude !== undefined
            ? Number(c.latitude)
            : null;
        const longitude =
          c.longitude !== null && c.longitude !== undefined
            ? Number(c.longitude)
            : null;

        const fullAddress = formatCenterFullAddress({
          governorate: c.governorate,
          city: c.city,
          street: c.street,
          buildingDetails: c.buildingDetails,
          address: c.address,
          country: c.country,
        });
        const googleMapsUrl = buildGoogleMapsSearchUrl({
          governorate: c.governorate,
          city: c.city,
          street: c.street,
          buildingDetails: c.buildingDetails,
          address: c.address,
          country: c.country,
          latitude,
          longitude,
        });

        return {
          ...c,
          latitude,
          longitude,
          fullAddress,
          googleMapsUrl,
          verificationLabelAr: getCenterVerificationLabelAr(c.verificationStatus),
          canManage: canManageThisCenter,
          members,
          courses: publishedCourses,
          stats: {
            membersCount: members.length,
            coursesCount: publishedCourses.filter((crs) =>
              isPublicCenterCourseVisible(crs.status)
            ).length,
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

router.get('/centers/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const centerId = Number(req.params.id);
    if (!Number.isInteger(centerId) || centerId <= 0) {
      return res.status(400).json({ error: 'معرف المركز غير صالح.' });
    }

    const [centerRow] = await db
      .select({
        id: centers.id,
        name: centers.name,
        slug: centers.slug,
        description: centers.description,
        governorate: centers.governorate,
        city: centers.city,
        country: centers.country,
        street: centers.street,
        buildingDetails: centers.buildingDetails,
        address: centers.address,
        latitude: centers.latitude,
        longitude: centers.longitude,
        phone: centers.phone,
        secondaryPhone: centers.secondaryPhone,
        website: centers.website,
        bannerUrl: centers.bannerUrl,
        logoUrl: centers.logoUrl,
        verificationStatus: centers.verificationStatus,
        workingHoursJson: centers.workingHoursJson,
        ownerUserId: centers.ownerUserId,
        ownerStatus: users.accountStatus,
        createdAt: centers.createdAt,
      })
      .from(centers)
      .innerJoin(users, eq(centers.ownerUserId, users.id))
      .where(eq(centers.id, centerId))
      .limit(1);

    if (!centerRow) {
      return res.status(404).json({ error: 'المركز التعليمي غير موجود.' });
    }

    const callerId = req.authUser?.id;
    const isAdmin = req.authUser?.roles.includes('ADMIN') ?? false;
    const isOwner = callerId === centerRow.ownerUserId;

    const [
      rawBranches,
      rawMembers,
      rawCenterAssignments,
      rawPublishedCourses,
    ] = await Promise.all([
      db
        .select({
          id: centerBranches.id,
          name: centerBranches.name,
          city: centerBranches.city,
          address: centerBranches.address,
          phone: centerBranches.phone,
          isMain: centerBranches.isMain,
        })
        .from(centerBranches)
        .where(
          and(
            eq(centerBranches.centerId, centerId),
            eq(centerBranches.isActive, true)
          )
        )
        .orderBy(desc(centerBranches.isMain), asc(centerBranches.id)),
      db
        .select({
          memberId: centerMembers.id,
          userId: centerMembers.userId,
          memberRole: centerMembers.memberRole,
          jobTitle: centerMembers.jobTitle,
          permissionsJson: centerMembers.permissionsJson,
          memberStatus: centerMembers.status,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          accountStatus: users.accountStatus,
          providerProfileId: providerProfiles.id,
          headline: providerProfiles.headline,
          bio: providerProfiles.bio,
          yearsExperience: providerProfiles.yearsExperience,
          providerVerification: providerProfiles.verificationStatus,
          ratingAvg: providerProfiles.ratingAvg,
          reviewsCount: providerProfiles.reviewsCount,
        })
        .from(centerMembers)
        .innerJoin(users, eq(centerMembers.userId, users.id))
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .where(eq(centerMembers.centerId, centerId))
        .orderBy(asc(centerMembers.id)),
      db
        .select({
          teacherUserId: centerTeacherAssignments.teacherUserId,
          subjectId: centerTeacherAssignments.subjectId,
          subjectNameAr: subjects.nameAr,
          stageId: centerTeacherAssignments.stageId,
          stageNameAr: educationalStages.nameAr,
          gradeId: centerTeacherAssignments.gradeId,
          gradeNameAr: educationalGrades.nameAr,
        })
        .from(centerTeacherAssignments)
        .innerJoin(subjects, eq(centerTeacherAssignments.subjectId, subjects.id))
        .innerJoin(
          educationalStages,
          eq(centerTeacherAssignments.stageId, educationalStages.id)
        )
        .leftJoin(
          educationalGrades,
          eq(centerTeacherAssignments.gradeId, educationalGrades.id)
        )
        .where(
          and(
            eq(centerTeacherAssignments.centerId, centerId),
            eq(centerTeacherAssignments.isActive, true)
          )
        ),
      db
        .select({
          id: courses.id,
          title: courses.title,
          subtitle: courses.subtitle,
          level: courses.level,
          price: courses.price,
          currency: courses.currency,
          thumbnailUrl: courses.thumbnailUrl,
          status: courses.status,
          enrollmentStatus: courses.enrollmentStatus,
          maxStudents: courses.maxStudents,
          instructorId: courses.instructorUserId,
          instructorName: users.fullName,
          instructorAvatarUrl: users.avatarUrl,
          instructorAccountStatus: users.accountStatus,
          customFieldName: courses.customFieldName,
          targetAudience: courses.targetAudience,
          fieldNameAr: fields.nameAr,
          subjectId: courses.subjectId,
          subjectNameAr: subjects.nameAr,
          stageId: courses.stageId,
          stageNameAr: educationalStages.nameAr,
          gradeId: courses.gradeId,
          gradeNameAr: educationalGrades.nameAr,
          divisionNameAr: secondaryDivisions.nameAr,
          pathwayNameAr: baccalaureatePathways.nameAr,
          createdAt: courses.createdAt,
        })
        .from(courses)
        .innerJoin(users, eq(courses.instructorUserId, users.id))
        .innerJoin(fields, eq(courses.fieldId, fields.id))
        .leftJoin(subjects, eq(courses.subjectId, subjects.id))
        .leftJoin(educationalStages, eq(courses.stageId, educationalStages.id))
        .leftJoin(educationalGrades, eq(courses.gradeId, educationalGrades.id))
        .leftJoin(secondaryDivisions, eq(courses.divisionId, secondaryDivisions.id))
        .leftJoin(
          baccalaureatePathways,
          eq(courses.pathwayId, baccalaureatePathways.id)
        )
        .where(
          and(
            eq(courses.centerId, centerId),
            eq(courses.status, 'PUBLISHED')
          )
        )
        .orderBy(desc(courses.createdAt)),
    ]);

    const callerMembership = callerId
      ? rawMembers.find((m) => m.userId === callerId)
      : undefined;
    const canManage =
      isAdmin ||
      isOwner ||
      Boolean(
        callerMembership &&
          callerMembership.memberStatus === 'ACTIVE' &&
          hasCenterPermission(
            callerMembership.memberRole,
            callerMembership.permissionsJson,
            'MANAGE_SETTINGS'
          )
      );

    if (centerRow.ownerStatus !== 'ACTIVE' && !canManage) {
      return res.status(404).json({ error: 'المركز التعليمي غير متاح حالياً.' });
    }

    const activeMembers = rawMembers.filter((m) =>
      isPublicCenterMemberVisible(m.memberStatus, m.accountStatus)
    );
    const activeMemberUserIds = activeMembers.map((m) => m.userId);

    const activePublishedCourses = rawPublishedCourses.filter(
      (c) => isPublicCenterCourseVisible(c.status) && c.instructorAccountStatus === 'ACTIVE'
    );
    const publishedCourseIds = activePublishedCourses.map((c) => c.id);
    const publishedCourseInstructorIds = new Set(
      activePublishedCourses.map((c) => c.instructorId)
    );
    const centerAssignedInstructorIds = new Set(
      rawCenterAssignments.map((a) => a.teacherUserId)
    );

    const [memberRoleRows, generalTeacherAssignments, courseLessonsRows, courseReviewsRows, courseEnrollmentsRows] =
      await Promise.all([
        activeMemberUserIds.length > 0
          ? db
              .select({ userId: userRoles.userId, code: roles.code })
              .from(userRoles)
              .innerJoin(roles, eq(userRoles.roleId, roles.id))
              .where(inArray(userRoles.userId, activeMemberUserIds))
          : Promise.resolve([]),
        activeMemberUserIds.length > 0
          ? db
              .select({
                teacherUserId: teacherTeachingAssignments.teacherUserId,
                subjectId: teacherTeachingAssignments.subjectId,
                subjectNameAr: subjects.nameAr,
                stageId: educationalGrades.stageId,
                stageNameAr: educationalStages.nameAr,
                gradeId: teacherTeachingAssignments.gradeId,
                gradeNameAr: educationalGrades.nameAr,
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
              .where(
                and(
                  inArray(teacherTeachingAssignments.teacherUserId, activeMemberUserIds),
                  eq(teacherTeachingAssignments.isActive, true)
                )
              )
          : Promise.resolve([]),
        publishedCourseIds.length > 0
          ? db
              .select({ courseId: courseLessons.courseId })
              .from(courseLessons)
              .where(inArray(courseLessons.courseId, publishedCourseIds))
          : Promise.resolve([]),
        publishedCourseIds.length > 0
          ? db
              .select({ courseId: reviews.courseId, rating: reviews.rating })
              .from(reviews)
              .where(inArray(reviews.courseId, publishedCourseIds))
          : Promise.resolve([]),
        publishedCourseIds.length > 0
          ? db
              .select({
                courseId: enrollments.courseId,
                status: enrollments.status,
              })
              .from(enrollments)
              .where(inArray(enrollments.courseId, publishedCourseIds))
          : Promise.resolve([]),
      ]);

    const rolesByUser = new Map<number, Set<string>>();
    for (const r of memberRoleRows) {
      const set = rolesByUser.get(r.userId) || new Set<string>();
      set.add(r.code);
      rolesByUser.set(r.userId, set);
    }

    const lessonsCountByCourse = new Map<number, number>();
    for (const l of courseLessonsRows) {
      lessonsCountByCourse.set(l.courseId, (lessonsCountByCourse.get(l.courseId) || 0) + 1);
    }

    const reviewsByCourse = new Map<number, number[]>();
    for (const r of courseReviewsRows) {
      if (!r.courseId) continue;
      const list = reviewsByCourse.get(r.courseId) || [];
      list.push(r.rating);
      reviewsByCourse.set(r.courseId, list);
    }

    const enrollmentsCountByCourse = new Map<number, number>();
    let totalEnrollments = 0;
    for (const e of courseEnrollmentsRows) {
      if (e.status === 'CANCELLED') continue;
      enrollmentsCountByCourse.set(
        e.courseId,
        (enrollmentsCountByCourse.get(e.courseId) || 0) + 1
      );
      totalEnrollments += 1;
    }

    const publicCourses = activePublishedCourses.map((c) => {
      const ratings = reviewsByCourse.get(c.id) || [];
      const ratingAvg =
        ratings.length > 0
          ? Number(
              (ratings.reduce((sum, val) => sum + val, 0) / ratings.length).toFixed(1)
            )
          : null;
      const enrollmentsCount = enrollmentsCountByCourse.get(c.id) || 0;
      const isEnrollmentAvailable =
        c.enrollmentStatus !== 'PAUSED' &&
        c.enrollmentStatus !== 'CLOSED' &&
        (!c.maxStudents || enrollmentsCount < c.maxStudents);

      return {
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        level: c.level,
        price: c.price,
        currency: c.currency,
        thumbnailUrl: c.thumbnailUrl,
        instructorId: c.instructorId,
        instructorName: c.instructorName,
        instructorAvatarUrl: c.instructorAvatarUrl,
        customFieldName: c.customFieldName,
        targetAudience: c.targetAudience || null,
        fieldNameAr: resolveCourseFieldDisplay(c.customFieldName, c.fieldNameAr),
        subjectNameAr: c.subjectNameAr || null,
        stageNameAr: c.stageNameAr || null,
        gradeNameAr: c.gradeNameAr || null,
        divisionNameAr: c.divisionNameAr || null,
        pathwayNameAr: c.pathwayNameAr || null,
        centerName: centerRow.name,
        lessonsCount: lessonsCountByCourse.get(c.id) || 0,
        enrollmentsCount,
        maxStudents: c.maxStudents ?? null,
        enrollmentStatus: c.enrollmentStatus,
        isEnrollmentAvailable,
        ratingAvg,
        reviewsCount: ratings.length,
      };
    });

    const centerCoursesCountByTeacher = new Map<number, number>();
    for (const crs of publicCourses) {
      centerCoursesCountByTeacher.set(
        crs.instructorId,
        (centerCoursesCountByTeacher.get(crs.instructorId) || 0) + 1
      );
    }

    const activeTeacherMembers = activeMembers.filter((m) => {
      const uRoles = rolesByUser.get(m.userId) || new Set<string>();
      return (
        m.memberRole === 'INSTRUCTOR' ||
        uRoles.has('TEACHER') ||
        uRoles.has('MENTOR') ||
        uRoles.has('EXPERT') ||
        Boolean(m.providerProfileId) ||
        centerAssignedInstructorIds.has(m.userId) ||
        publishedCourseInstructorIds.has(m.userId)
      );
    });

    const publicTeachers = activeTeacherMembers.map((m) => {
      const centerAssigns = rawCenterAssignments.filter(
        (a) => a.teacherUserId === m.userId
      );
      const fallbackAssigns =
        centerAssigns.length > 0
          ? []
          : generalTeacherAssignments.filter((a) => a.teacherUserId === m.userId);
      const effectiveAssigns =
        centerAssigns.length > 0 ? centerAssigns : fallbackAssigns;

      const subjectsMap = new Map<number, string>();
      const stagesMap = new Map<number, string>();
      const gradesMap = new Map<number, string>();

      for (const a of effectiveAssigns) {
        if (a.subjectId && a.subjectNameAr) subjectsMap.set(a.subjectId, a.subjectNameAr);
        if (a.stageId && a.stageNameAr) stagesMap.set(a.stageId, a.stageNameAr);
        if (a.gradeId && a.gradeNameAr) gradesMap.set(a.gradeId, a.gradeNameAr);
      }

      for (const crs of activePublishedCourses) {
        if (crs.instructorId !== m.userId) continue;
        if (crs.subjectId && crs.subjectNameAr) {
          subjectsMap.set(crs.subjectId, crs.subjectNameAr);
        }
        if (crs.stageId && crs.stageNameAr) {
          stagesMap.set(crs.stageId, crs.stageNameAr);
        }
        if (crs.gradeId && crs.gradeNameAr) {
          gradesMap.set(crs.gradeId, crs.gradeNameAr);
        }
      }

      const specialization =
        m.jobTitle?.trim() ||
        m.headline?.trim() ||
        'معلّم بالمركز';

      const bioPreview = (m.bio || m.headline || '').trim();

      return {
        memberId: m.memberId,
        userId: m.userId,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
        memberRole: m.memberRole,
        jobTitle: specialization,
        headline: m.headline || specialization,
        bio: bioPreview,
        yearsExperience: m.yearsExperience ?? null,
        verificationStatus: m.providerVerification || 'PENDING',
        ratingAvg: m.ratingAvg ? Number(m.ratingAvg) : 0,
        reviewsCount: m.reviewsCount ?? 0,
        centerCoursesCount: centerCoursesCountByTeacher.get(m.userId) || 0,
        subjects: Array.from(subjectsMap.entries()).map(([id, nameAr]) => ({
          id,
          nameAr,
        })),
        stages: Array.from(stagesMap.entries()).map(([id, nameAr]) => ({
          id,
          nameAr,
        })),
        grades: Array.from(gradesMap.entries()).map(([id, nameAr]) => ({
          id,
          nameAr,
        })),
      };
    });

    const latitude =
      centerRow.latitude !== null && centerRow.latitude !== undefined
        ? Number(centerRow.latitude)
        : null;
    const longitude =
      centerRow.longitude !== null && centerRow.longitude !== undefined
        ? Number(centerRow.longitude)
        : null;

    const fullAddress = formatCenterFullAddress({
      governorate: centerRow.governorate,
      city: centerRow.city,
      street: centerRow.street,
      buildingDetails: centerRow.buildingDetails,
      address: centerRow.address,
      country: centerRow.country,
    });
    const googleMapsUrl = buildGoogleMapsSearchUrl({
      governorate: centerRow.governorate,
      city: centerRow.city,
      street: centerRow.street,
      buildingDetails: centerRow.buildingDetails,
      address: centerRow.address,
      country: centerRow.country,
      latitude,
      longitude,
    });

    const workingHours =
      centerRow.workingHoursJson && centerRow.workingHoursJson.length === 7
        ? centerRow.workingHoursJson
        : DEFAULT_CENTER_WORKING_HOURS;

    res.json({
      center: {
        id: centerRow.id,
        name: centerRow.name,
        slug: centerRow.slug,
        description: centerRow.description,
        governorate: centerRow.governorate,
        city: centerRow.city,
        country: centerRow.country,
        street: centerRow.street,
        buildingDetails: centerRow.buildingDetails,
        address: centerRow.address,
        fullAddress,
        googleMapsUrl,
        latitude,
        longitude,
        phone: centerRow.phone,
        secondaryPhone: centerRow.secondaryPhone,
        website: centerRow.website,
        bannerUrl: centerRow.bannerUrl,
        logoUrl: centerRow.logoUrl,
        verificationStatus: centerRow.verificationStatus,
        verificationLabelAr: getCenterVerificationLabelAr(centerRow.verificationStatus),
        workingHoursJson: workingHours,
        createdAt: centerRow.createdAt,
        canManage,
        stats: {
          teachersCount: publicTeachers.length,
          activeMembersCount: activeMembers.length,
          coursesCount: publicCourses.length,
          totalEnrollments,
          branchesCount: rawBranches.length,
        },
      },
      branches: rawBranches,
      teachers: publicTeachers,
      courses: publicCourses,
    });
  } catch (error) {
    console.error('Public center profile error:', error);
    res.status(500).json({ error: 'تعذر جلب الملف العام للمركز التعليمي.' });
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
      if (targetUser.accountStatus !== 'ACTIVE') {
        return res
          .status(400)
          .json({ error: 'لا يمكن إضافة حساب موقوف إلى فريق المركز.' });
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
            customFieldName: courses.customFieldName,
            targetAudience: courses.targetAudience,
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
          .orderBy(desc(courses.createdAt))
          .then((list) =>
            list.map((item) => ({
              ...item,
              fieldNameAr: resolveCourseFieldDisplay(item.customFieldName, item.fieldNameAr),
            }))
          ),
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
