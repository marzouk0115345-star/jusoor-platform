import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  baccalaureatePathways,
  centerMembers,
  centers,
  educationalGrades,
  educationalSystems,
  fields,
  secondaryDivisions,
  subjects,
} from '../db/schema.ts';
import {
  canManageCenterResource,
  validateCurriculumContextCombination,
} from '../lib/domain.ts';

export async function canUserManageCourse(
  authUser: { id: number; roles: string[] },
  course: { instructorUserId: number; centerId: number | null }
): Promise<boolean> {
  if (course.instructorUserId === authUser.id) return true;
  if (authUser.roles.includes('ADMIN')) return true;

  if (course.centerId) {
    const [[centerRow], [membership]] = await Promise.all([
      db
        .select({ ownerUserId: centers.ownerUserId })
        .from(centers)
        .where(eq(centers.id, course.centerId))
        .limit(1),
      db
        .select()
        .from(centerMembers)
        .where(
          and(
            eq(centerMembers.centerId, course.centerId),
            eq(centerMembers.userId, authUser.id)
          )
        )
        .limit(1),
    ]);

    if (centerRow) {
      return canManageCenterResource({
        isAdmin: authUser.roles.includes('ADMIN'),
        ownerUserId: centerRow.ownerUserId,
        callerUserId: authUser.id,
        membership: membership
          ? {
              memberRole: membership.memberRole,
              status: membership.status,
              permissionsJson: membership.permissionsJson,
            }
          : null,
        requiredPermission: 'MANAGE_COURSES',
      });
    }
  }

  return false;
}

export async function validateCourseCurriculumIds(input: {
  subjectId?: number | null;
  stageId?: number | null;
  systemId?: number | null;
  gradeId?: number | null;
  divisionId?: number | null;
  pathwayId?: number | null;
}): Promise<string | null> {
  if (input.subjectId) {
    const [subj] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, input.subjectId))
      .limit(1);
    if (!subj) {
      return 'المادة الدراسية المختارة غير موجودة.';
    }
  }

  if (!input.systemId && !input.gradeId && !input.divisionId && !input.pathwayId) {
    return null;
  }

  if (!input.systemId || !input.gradeId) {
    if (input.divisionId || input.pathwayId) {
      return 'يرجى تحديد النظام والصف الدراسي مع الشعبة أو المسار.';
    }
    if (input.gradeId && !input.systemId) {
      return 'يرجى تحديد النظام التعليمي مع الصف الدراسي.';
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

  if (input.stageId && grade.stageId !== input.stageId) {
    return 'الصف الدراسي المختار لا يتبع المرحلة التعليمية المحددة.';
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

export async function resolveAnchorFieldId(params: {
  customFieldName?: string | null;
  explicitFieldId?: number | null;
}): Promise<number | null> {
  if (params.explicitFieldId) {
    const [explicit] = await db
      .select({ id: fields.id })
      .from(fields)
      .where(eq(fields.id, params.explicitFieldId))
      .limit(1);
    if (explicit) return explicit.id;
  }

  const allFields = await db
    .select({
      id: fields.id,
      slug: fields.slug,
      nameAr: fields.nameAr,
      nameEn: fields.nameEn,
    })
    .from(fields)
    .orderBy(asc(fields.id));

  if (allFields.length === 0) return null;

  const customLower = (params.customFieldName || '').trim().toLowerCase();
  if (customLower) {
    const exactMatch = allFields.find(
      (f) =>
        f.nameAr.trim().toLowerCase() === customLower ||
        f.nameEn.trim().toLowerCase() === customLower
    );
    if (exactMatch) return exactMatch.id;
  }

  const generalMatch = allFields.find(
    (f) =>
      f.slug.toLowerCase().includes('general') ||
      f.nameAr.includes('عام') ||
      f.nameEn.toLowerCase().includes('general')
  );
  return generalMatch ? generalMatch.id : allFields[0].id;
}
