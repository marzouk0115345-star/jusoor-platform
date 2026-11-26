import { eq, and, ne, isNull, asc } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  teachingSessions,
  teacherTeachingAssignments,
  curriculumSubjects,
  subjects,
  educationalStages,
  educationalSystems,
  educationalGrades,
  secondaryDivisions,
  baccalaureatePathways,
  users,
} from '../db/schema.ts';
import { formatOfflineAddress, doTimeRangesOverlap } from '../lib/domain.ts';

interface DemoLocationSpec {
  governorate: string;
  city: string;
  district: string;
  streetName: string;
  buildingOrCenterName: string;
  locationNotes: string;
}

const EGYPTIAN_DEMO_LOCATIONS: DemoLocationSpec[] = [
  {
    governorate: 'القاهرة',
    city: 'القاهرة',
    district: 'مدينة نصر',
    streetName: 'شارع مصطفى النحاس',
    buildingOrCenterName: 'مركز النور التعليمي — قاعة 3',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار — الدور الثاني',
  },
  {
    governorate: 'الجيزة',
    city: 'الجيزة',
    district: 'الدقي',
    streetName: 'شارع التحرير',
    buildingOrCenterName: 'أكاديمية الدقي التعليمية — قاعة ب',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار — بجوار محطة المترو',
  },
  {
    governorate: 'القاهرة',
    city: 'القاهرة',
    district: 'مصر الجديدة',
    streetName: 'شارع الميرغني',
    buildingOrCenterName: 'بيت العلم التعليمي — الدور الأول',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'القاهرة',
    city: 'القاهرة',
    district: 'المعادي',
    streetName: 'شارع 9',
    buildingOrCenterName: 'مركز المستقبل الأكاديمي — قاعة 1',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار — قرب ميدان الحرية',
  },
  {
    governorate: 'الجيزة',
    city: 'الشيخ زايد',
    district: 'الحي الأول',
    streetName: 'المحور المركزي',
    buildingOrCenterName: 'سنتر الأفق للتدريب — مبنى C',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'الإسكندرية',
    city: 'الإسكندرية',
    district: 'سموحة',
    streetName: 'شارع فوزي معاذ',
    buildingOrCenterName: 'مركز الإسكندرية للتطوير التعليمي',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار — الدور الثالث',
  },
  {
    governorate: 'الدقهلية',
    city: 'المنصورة',
    district: 'حي الجامعة',
    streetName: 'شارع الجمهورية',
    buildingOrCenterName: 'سنتر المنصورة التخصصي — قاعة 2',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'الغربية',
    city: 'طنطا',
    district: 'حي الاستاد',
    streetName: 'شارع البحر',
    buildingOrCenterName: 'مركز الدلتا التعليمي — الدور الثاني',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'الشرقية',
    city: 'الزقازيق',
    district: 'القومية',
    streetName: 'شارع طلبة عويضة',
    buildingOrCenterName: 'أكاديمية الشرقية التعليمية',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'أسيوط',
    city: 'أسيوط',
    district: 'وسط البلد',
    streetName: 'شارع الجمهورية',
    buildingOrCenterName: 'مركز الصعيد للتدريب والدراسة',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'القليوبية',
    city: 'بنها',
    district: 'الأهرام',
    streetName: 'شارع فريد ندا',
    buildingOrCenterName: 'سنتر بنها الأكاديمي — قاعة 4',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
  {
    governorate: 'المنوفية',
    city: 'شبين الكوم',
    district: 'البر الشرقي',
    streetName: 'شارع جمال عبد الناصر',
    buildingOrCenterName: 'مركز المنوفية التعليمي',
    locationNotes: 'موقع عرض تجريبي لأغراض العرض والاختبار',
  },
];

const ONLINE_GROUP_TEMPLATES = [
  (subj: string, grade: string) => ({
    title: `مجموعة شرح تفاعلية: أساسيات ${subj} — ${grade}`,
    description: `جلسة جماعية مباشرة عبر الإنترنت لشرح المفاهيم الأساسية في ${subj} لطلاب ${grade} مع أمثلة تطبيقية ومناقشة تفاعلية.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة تطبيق وحل تدريبات: ${subj} — ${grade}`,
    description: `ورشة حل تمارين ومسائل متدرجة الصعوبة في ${subj} (${grade}) بمشاركة جماعية وتصحيح فوري.`,
  }),
  (subj: string, grade: string) => ({
    title: `مراجعة شاملة للوحدات الأساسية في ${subj} — ${grade}`,
    description: `تجميع وتلخيص لأهم نقاط المنهج في ${subj} لصف ${grade} مع خرائط ذهنية وأسئلة تقويمية.`,
  }),
  (subj: string, grade: string) => ({
    title: `ورشة حل نماذج امتحانات ${subj} — ${grade}`,
    description: `التدريب العملي على نماذج الاختبارات الرسمية في ${subj} (${grade}) وتوضيح طرق توزيع الدرجات.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة دعم وتقوية أونلاين: ${subj} — ${grade}`,
    description: `متابعة جماعية منظمة لتثبيت المهارات الأساسية في ${subj} لطلاب ${grade} والإجابة عن استفساراتهم.`,
  }),
  (subj: string, grade: string) => ({
    title: `جلسة معالجة النقاط الصعبة في ${subj} — ${grade}`,
    description: `تركيز مكثف على الأجزاء الأكثر صعوبة وتكراراً في اختبارات ${subj} لصف ${grade}.`,
  }),
  (subj: string, grade: string) => ({
    title: `مراجعة تقييمية واستعداد للاختبار: ${subj} — ${grade}`,
    description: `مراجعة ختامية وحل اختبار تجريبي مشترك في ${subj} (${grade}) لتعزيز الثقة قبل التقييم.`,
  }),
];

const ONLINE_1ON1_TEMPLATES = [
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): شرح مخصص في ${subj} — ${grade}`,
    description: `جلسة فردية أونلاين مخصصة لطالب واحد للتركيز على احتياجاته في ${subj} (${grade}) وفق وتيرته الخاصة.`,
  }),
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): متابعة مستوى وحل واجبات ${subj}`,
    description: `لقاء فردي مباشر لمراجعة الواجبات وفهم الدروس غير الواضحة في ${subj} لصف ${grade}.`,
  }),
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): معالجة نقاط الضعف في ${subj}`,
    description: `تشخيص فردي لمستوى الطالب في ${subj} (${grade}) وبناء خطة شرح مبسطة لتجاوز الصعوبات.`,
  }),
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): تدريب مكثف على مسائل ${subj}`,
    description: `حل تدريبات متقدمة وتوجيه خطوة بخطوة لطالب واحد في ${subj} (${grade}).`,
  }),
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): مراجعة وحدة دراسية في ${subj}`,
    description: `مراجعة مركزة لوحدة كاملة من منهج ${subj} لصف ${grade} مع اختبار شفهي وتحريري قصير.`,
  }),
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): تحضير لاختبار الشهر في ${subj}`,
    description: `استعداد فردي مخصص لاختبار الشهر في ${subj} (${grade}) وتدريب على إدارة الوقت.`,
  }),
  (subj: string, grade: string) => ({
    title: `موعد فردي (1:1): جلسة دعم وتوجيه في ${subj} — ${grade}`,
    description: `موعد فردي مرن للإجابة عن جميع تساؤلات الطالب وتبسيط مفاهيم ${subj} (${grade}).`,
  }),
];

const OFFLINE_GROUP_TEMPLATES = [
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: تأسيس عملي في ${subj} — ${grade}`,
    description: `جلسة حضورية (أوفلاين) في القاعة لشرح أساسيات ${subj} لطلاب ${grade} مع متابعة مباشرة وتطبيق ورقي.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: حل تطبيقات وأنشطة ${subj} — ${grade}`,
    description: `لقاء حضوري تفاعلي لحل أوراق العمل والتدريبات الصفية في ${subj} (${grade}) بإشراف مباشر من المعلّم.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: ورشة مراجعة دورية — ${subj} (${grade})`,
    description: `مراجعة حضورية منظمة لما سبق دراسته في ${subj} لصف ${grade} مع تصحيح فوري للتمارين.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: تدريب على أسئلة الامتحانات — ${subj}`,
    description: `تدريب حضوري على أنماط الأسئلة المقالية والموضوعية في ${subj} (${grade}) في مجموعات محدودة العدد.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: مناقشة وتقوية — ${subj} (${grade})`,
    description: `جلسة تقوية حضورية وجهاً لوجه لتبسيط الدروس الصعبة في ${subj} لطلاب ${grade}.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: حل نماذج استرشادية — ${subj} (${grade})`,
    description: `تطبيق عملي حضوري على نماذج الوزارة الاسترشادية في ${subj} (${grade}) وتقييم الأداء.`,
  }),
  (subj: string, grade: string) => ({
    title: `مجموعة حضورية: مراجعة نهائية شاملة — ${subj} (${grade})`,
    description: `مراجعة حضورية مكثفة تغطي كامل محاور ${subj} لصف ${grade} قبل التقييمات النهائية.`,
  }),
];

function computeStageEgpPrices(stageSlug: string, variantIndex: number) {
  if (stageSlug === 'primary') {
    return {
      onlineGroup: 80 + (variantIndex % 4) * 10, // 80..110 EGP
      online1on1: 150 + (variantIndex % 4) * 15, // 150..195 EGP
      offlineGroup: 100 + (variantIndex % 4) * 10, // 100..130 EGP
    };
  }
  if (stageSlug === 'preparatory') {
    return {
      onlineGroup: 105 + (variantIndex % 4) * 10, // 105..135 EGP
      online1on1: 195 + (variantIndex % 4) * 15, // 195..240 EGP
      offlineGroup: 125 + (variantIndex % 4) * 10, // 125..155 EGP
    };
  }
  return {
    onlineGroup: 135 + (variantIndex % 4) * 15, // 135..180 EGP
    online1on1: 240 + (variantIndex % 4) * 25, // 240..315 EGP
    offlineGroup: 160 + (variantIndex % 4) * 15, // 160..205 EGP
  };
}

export interface AssignmentSessionAuditRow {
  assignmentId: number;
  teacherUserId: number;
  teacherName: string;
  curriculumSubjectId: number;
  subjectNameAr: string;
  gradeNameAr: string;
  systemNameAr: string;
  divisionNameAr: string | null;
  pathwayNameAr: string | null;
  onlineGroupCount: number;
  onlineOneToOneCount: number;
  offlineGroupCount: number;
  status: 'COMPLETE' | 'INCOMPLETE';
}

export interface TeacherSessionsSeedResult {
  assignmentsProcessed: number;
  insertedSessionsCount: number;
  adoptedLegacySessionsCount: number;
  overlapConflictsDetected: number;
  totalAssignmentSessionsAfter: number;
  completeAssignmentsCount: number;
  incompleteAssignmentsCount: number;
  auditSample: AssignmentSessionAuditRow[];
}

export async function ensureAllTeacherAssignmentSessionsSeeded(opts?: {
  includeAuditDetails?: boolean;
}): Promise<TeacherSessionsSeedResult> {
  // 1. Backfill systemId, divisionId, pathwayId on any existing curriculum-linked sessions missing them
  const existingUnlinkedContext = await db
    .select({
      id: teachingSessions.id,
      curriculumSubjectId: teachingSessions.curriculumSubjectId,
    })
    .from(teachingSessions)
    .where(isNull(teachingSessions.systemId));

  if (existingUnlinkedContext.length > 0) {
    const csRows = await db
      .select({
        id: curriculumSubjects.id,
        systemId: curriculumSubjects.systemId,
        divisionId: curriculumSubjects.divisionId,
        pathwayId: curriculumSubjects.pathwayId,
        stageId: curriculumSubjects.stageId,
        gradeId: curriculumSubjects.gradeId,
        subjectId: curriculumSubjects.subjectId,
      })
      .from(curriculumSubjects);
    const csMap = new Map(csRows.map((c) => [c.id, c]));

    for (const row of existingUnlinkedContext) {
      if (!row.curriculumSubjectId) continue;
      const cs = csMap.get(row.curriculumSubjectId);
      if (!cs) continue;
      await db
        .update(teachingSessions)
        .set({
          systemId: cs.systemId,
          divisionId: cs.divisionId,
          pathwayId: cs.pathwayId,
          stageId: cs.stageId,
          gradeId: cs.gradeId,
          subjectId: cs.subjectId,
        })
        .where(eq(teachingSessions.id, row.id));
    }
  }

  // 2. Load all active teaching assignments for active teachers
  const assignments = await db
    .select({
      assignmentId: teacherTeachingAssignments.id,
      teacherUserId: teacherTeachingAssignments.teacherUserId,
      teacherName: users.fullName,
      curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
      subjectId: teacherTeachingAssignments.subjectId,
      gradeId: teacherTeachingAssignments.gradeId,
      systemId: teacherTeachingAssignments.systemId,
      divisionId: teacherTeachingAssignments.divisionId,
      pathwayId: teacherTeachingAssignments.pathwayId,
      stageId: curriculumSubjects.stageId,
      stageSlug: educationalStages.slug,
      systemNameAr: educationalSystems.nameAr,
      gradeNameAr: educationalGrades.nameAr,
      subjectNameAr: subjects.nameAr,
      divisionNameAr: secondaryDivisions.nameAr,
      pathwayNameAr: baccalaureatePathways.nameAr,
    })
    .from(teacherTeachingAssignments)
    .innerJoin(users, eq(teacherTeachingAssignments.teacherUserId, users.id))
    .innerJoin(
      curriculumSubjects,
      eq(teacherTeachingAssignments.curriculumSubjectId, curriculumSubjects.id)
    )
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
      eq(curriculumSubjects.stageId, educationalStages.id)
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
        eq(teacherTeachingAssignments.isActive, true),
        eq(users.accountStatus, 'ACTIVE')
      )
    )
    .orderBy(asc(teacherTeachingAssignments.teacherUserId), asc(teacherTeachingAssignments.id));

  // 3. Load all existing non-cancelled sessions once
  const allExistingSessions = await db
    .select({
      id: teachingSessions.id,
      teacherUserId: teachingSessions.teacherUserId,
      curriculumSubjectId: teachingSessions.curriculumSubjectId,
      sessionType: teachingSessions.sessionType,
      deliveryMode: teachingSessions.deliveryMode,
      startTime: teachingSessions.startTime,
      endTime: teachingSessions.endTime,
      seedKey: teachingSessions.seedKey,
      isDemo: teachingSessions.isDemo,
      status: teachingSessions.status,
    })
    .from(teachingSessions)
    .where(ne(teachingSessions.status, 'CANCELLED'));

  // Index existing intervals per teacher so we NEVER create overlapping slots
  const teacherIntervals = new Map<
    number,
    Array<{ start: Date; end: Date }>
  >();
  const existingSeedKeys = new Set<string>();
  const legacyUnkeyedDemoByTeacherCs = new Map<
    string,
    Array<{
      id: number;
      sessionType: string;
      deliveryMode: string;
      seedKey: string | null;
    }>
  >();

  for (const s of allExistingSessions) {
    const arr = teacherIntervals.get(s.teacherUserId) || [];
    arr.push({ start: new Date(s.startTime), end: new Date(s.endTime) });
    teacherIntervals.set(s.teacherUserId, arr);

    if (s.seedKey) {
      existingSeedKeys.add(s.seedKey);
    } else if (s.isDemo && s.curriculumSubjectId) {
      const k = `${s.teacherUserId}:${s.curriculumSubjectId}:${s.sessionType}:${s.deliveryMode}`;
      const list = legacyUnkeyedDemoByTeacherCs.get(k) || [];
      list.push(s);
      legacyUnkeyedDemoByTeacherCs.set(k, list);
    }
  }

  // Adopt any legacy unkeyed demo sessions into the deterministic seedKey slots
  let adoptedLegacySessionsCount = 0;
  for (const a of assignments) {
    const kinds: Array<{
      kind: 'online-group' | 'online-1on1' | 'offline-group';
      sessionType: 'GROUP' | 'ONE_TO_ONE';
      deliveryMode: 'ONLINE' | 'IN_PERSON';
    }> = [
      { kind: 'online-group', sessionType: 'GROUP', deliveryMode: 'ONLINE' },
      { kind: 'online-1on1', sessionType: 'ONE_TO_ONE', deliveryMode: 'ONLINE' },
      { kind: 'offline-group', sessionType: 'GROUP', deliveryMode: 'IN_PERSON' },
    ];

    for (const cfg of kinds) {
      const legacyKey = `${a.teacherUserId}:${a.curriculumSubjectId}:${cfg.sessionType}:${cfg.deliveryMode}`;
      const legacyRows = legacyUnkeyedDemoByTeacherCs.get(legacyKey) || [];
      let idx = 1;
      for (const leg of legacyRows) {
        while (
          idx <= 7 &&
          existingSeedKeys.has(`demo-sess-a${a.assignmentId}-${cfg.kind}-${idx}`)
        ) {
          idx += 1;
        }
        if (idx > 7) break;
        const targetSeedKey = `demo-sess-a${a.assignmentId}-${cfg.kind}-${idx}`;
        const prices = computeStageEgpPrices(a.stageSlug, idx);
        const targetPrice =
          cfg.kind === 'online-group'
            ? prices.onlineGroup
            : cfg.kind === 'online-1on1'
            ? prices.online1on1
            : prices.offlineGroup;
        await db
          .update(teachingSessions)
          .set({
            seedKey: targetSeedKey,
            systemId: a.systemId,
            divisionId: a.divisionId,
            pathwayId: a.pathwayId,
            stageId: a.stageId,
            gradeId: a.gradeId,
            subjectId: a.subjectId,
            currency: 'EGP',
            price: targetPrice.toFixed(2),
          })
          .where(eq(teachingSessions.id, leg.id));
        existingSeedKeys.add(targetSeedKey);
        adoptedLegacySessionsCount += 1;
        idx += 1;
      }
    }
  }

  // 4. Deterministic non-overlapping future slot allocator per teacher
  // 4 daily slots (Cairo time 10:00, 13:00, 16:00, 19:00 -> UTC 08:00, 11:00, 14:00, 17:00)
  const DAILY_SLOT_HOURS_UTC = [8, 11, 14, 17];
  const baseDayMs = (() => {
    const now = new Date();
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );
    return d.getTime();
  })();

  const teacherCursor = new Map<number, number>(); // flat slot index per teacher

  function allocateNextSlot(
    teacherUserId: number,
    durationMinutes: number
  ): { startTime: Date; endTime: Date } {
    let cursor =
      teacherCursor.get(teacherUserId) ??
      (teacherUserId % 3); // slight stagger across teachers
    const intervals = teacherIntervals.get(teacherUserId) || [];

    // Search forward until a non-overlapping slot is found
    for (let guard = 0; guard < 2000; guard++) {
      const dayOffset = Math.floor(cursor / DAILY_SLOT_HOURS_UTC.length);
      const hourUtc = DAILY_SLOT_HOURS_UTC[cursor % DAILY_SLOT_HOURS_UTC.length];
      cursor += 1;

      const start = new Date(baseDayMs + dayOffset * 86_400_000);
      start.setUTCHours(hourUtc, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);

      const overlaps = intervals.some((iv) =>
        doTimeRangesOverlap(start, end, iv.start, iv.end)
      );
      if (!overlaps) {
        intervals.push({ start, end });
        teacherIntervals.set(teacherUserId, intervals);
        teacherCursor.set(teacherUserId, cursor);
        return { startTime: start, endTime: end };
      }
    }
    throw new Error(`Could not allocate non-overlapping slot for teacher ${teacherUserId}`);
  }

  // 5. Generate missing demo sessions for each active assignment (7 + 7 + 7 = 21)
  const toInsert: Array<typeof teachingSessions.$inferInsert> = [];

  for (const a of assignments) {
    const contextSuffix = a.divisionNameAr
      ? ` (${a.divisionNameAr})`
      : a.pathwayNameAr
      ? ` (${a.pathwayNameAr})`
      : '';
    const gradeLabel = `${a.gradeNameAr}${contextSuffix}`;

    // A. 7 Online Group Sessions
    for (let i = 1; i <= 7; i++) {
      const seedKey = `demo-sess-a${a.assignmentId}-online-group-${i}`;
      if (existingSeedKeys.has(seedKey)) continue;

      const durationMinutes = i % 2 === 0 ? 90 : 75;
      const { startTime, endTime } = allocateNextSlot(a.teacherUserId, durationMinutes);
      const registrationDeadline = new Date(startTime.getTime() - 6 * 3_600_000);
      const tpl = ONLINE_GROUP_TEMPLATES[i - 1](a.subjectNameAr, gradeLabel);
      const prices = computeStageEgpPrices(a.stageSlug, a.assignmentId + i);
      const capacity = 10 + ((a.assignmentId + i) % 3) * 4; // 10, 14, or 18

      toInsert.push({
        teacherUserId: a.teacherUserId,
        subjectId: a.subjectId,
        curriculumSubjectId: a.curriculumSubjectId,
        systemId: a.systemId,
        gradeId: a.gradeId,
        stageId: a.stageId,
        divisionId: a.divisionId,
        pathwayId: a.pathwayId,
        sessionType: 'GROUP',
        title: tpl.title,
        description: tpl.description,
        startTime,
        endTime,
        durationMinutes,
        capacity,
        minStudents: 3,
        price: prices.onlineGroup.toFixed(2),
        currency: 'EGP',
        deliveryMode: 'ONLINE',
        location: null,
        governorate: null,
        city: null,
        district: null,
        streetName: null,
        buildingOrCenterName: null,
        locationNotes: null,
        isDemoLocation: false,
        meetingUrl: `https://meet.jusoor.example/grp-${a.assignmentId}-${i}`,
        registrationDeadline,
        status: 'OPEN',
        seedKey,
        isDemo: true,
      });
      existingSeedKeys.add(seedKey);
    }

    // B. 7 Online Individual (1:1) Slots
    for (let i = 1; i <= 7; i++) {
      const seedKey = `demo-sess-a${a.assignmentId}-online-1on1-${i}`;
      if (existingSeedKeys.has(seedKey)) continue;

      const durationMinutes = i % 3 === 0 ? 45 : 60;
      const { startTime, endTime } = allocateNextSlot(a.teacherUserId, durationMinutes);
      const registrationDeadline = new Date(startTime.getTime() - 3 * 3_600_000);
      const tpl = ONLINE_1ON1_TEMPLATES[i - 1](a.subjectNameAr, gradeLabel);
      const prices = computeStageEgpPrices(a.stageSlug, a.assignmentId + i);

      toInsert.push({
        teacherUserId: a.teacherUserId,
        subjectId: a.subjectId,
        curriculumSubjectId: a.curriculumSubjectId,
        systemId: a.systemId,
        gradeId: a.gradeId,
        stageId: a.stageId,
        divisionId: a.divisionId,
        pathwayId: a.pathwayId,
        sessionType: 'ONE_TO_ONE',
        title: tpl.title,
        description: tpl.description,
        startTime,
        endTime,
        durationMinutes,
        capacity: 1,
        minStudents: null,
        price: prices.online1on1.toFixed(2),
        currency: 'EGP',
        deliveryMode: 'ONLINE',
        location: null,
        governorate: null,
        city: null,
        district: null,
        streetName: null,
        buildingOrCenterName: null,
        locationNotes: null,
        isDemoLocation: false,
        meetingUrl: `https://meet.jusoor.example/1on1-${a.assignmentId}-${i}`,
        registrationDeadline,
        status: 'OPEN',
        seedKey,
        isDemo: true,
      });
      existingSeedKeys.add(seedKey);
    }

    // C. 7 Offline Group Sessions with complete fictional Egyptian demo addresses
    for (let i = 1; i <= 7; i++) {
      const seedKey = `demo-sess-a${a.assignmentId}-offline-group-${i}`;
      if (existingSeedKeys.has(seedKey)) continue;

      const durationMinutes = 90;
      const { startTime, endTime } = allocateNextSlot(a.teacherUserId, durationMinutes);
      const registrationDeadline = new Date(startTime.getTime() - 6 * 3_600_000);
      const tpl = OFFLINE_GROUP_TEMPLATES[i - 1](a.subjectNameAr, gradeLabel);
      const prices = computeStageEgpPrices(a.stageSlug, a.assignmentId + i);
      const capacity = 8 + ((a.assignmentId + i) % 3) * 4; // 8, 12, or 16
      const loc =
        EGYPTIAN_DEMO_LOCATIONS[
          (a.teacherUserId + i - 1) % EGYPTIAN_DEMO_LOCATIONS.length
        ];
      const fullLocation = formatOfflineAddress(loc);

      toInsert.push({
        teacherUserId: a.teacherUserId,
        subjectId: a.subjectId,
        curriculumSubjectId: a.curriculumSubjectId,
        systemId: a.systemId,
        gradeId: a.gradeId,
        stageId: a.stageId,
        divisionId: a.divisionId,
        pathwayId: a.pathwayId,
        sessionType: 'GROUP',
        title: tpl.title,
        description: tpl.description,
        startTime,
        endTime,
        durationMinutes,
        capacity,
        minStudents: 3,
        price: prices.offlineGroup.toFixed(2),
        currency: 'EGP',
        deliveryMode: 'IN_PERSON',
        location: fullLocation,
        governorate: loc.governorate,
        city: loc.city,
        district: loc.district,
        streetName: loc.streetName,
        buildingOrCenterName: loc.buildingOrCenterName,
        locationNotes: loc.locationNotes,
        isDemoLocation: true,
        meetingUrl: null,
        registrationDeadline,
        status: 'OPEN',
        seedKey,
        isDemo: true,
      });
      existingSeedKeys.add(seedKey);
    }
  }

  // 6. Batch insert in chunks of 350 rows (sequential awaits, idempotent via onConflictDoNothing)
  let insertedSessionsCount = 0;
  const CHUNK_SIZE = 350;
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const inserted = await db
      .insert(teachingSessions)
      .values(chunk)
      .onConflictDoNothing({ target: teachingSessions.seedKey })
      .returning({ id: teachingSessions.id });
    insertedSessionsCount += inserted.length;
  }

  // 7. Verify per-assignment counts & teacher overlap check
  const finalSessions = await db
    .select({
      id: teachingSessions.id,
      teacherUserId: teachingSessions.teacherUserId,
      curriculumSubjectId: teachingSessions.curriculumSubjectId,
      sessionType: teachingSessions.sessionType,
      deliveryMode: teachingSessions.deliveryMode,
      startTime: teachingSessions.startTime,
      endTime: teachingSessions.endTime,
      status: teachingSessions.status,
      seedKey: teachingSessions.seedKey,
    })
    .from(teachingSessions)
    .where(ne(teachingSessions.status, 'CANCELLED'));

  // Count per (teacherUserId, curriculumSubjectId)
  const countsMap = new Map<
    string,
    { onlineGroup: number; online1on1: number; offlineGroup: number }
  >();
  const byTeacher = new Map<
    number,
    Array<{ id: number; startTime: Date; endTime: Date }>
  >();

  let totalAssignmentSessionsAfter = 0;
  for (const s of finalSessions) {
    const list = byTeacher.get(s.teacherUserId) || [];
    list.push({ id: s.id, startTime: new Date(s.startTime), endTime: new Date(s.endTime) });
    byTeacher.set(s.teacherUserId, list);

    if (s.curriculumSubjectId !== null && s.seedKey?.startsWith('demo-sess-a')) {
      totalAssignmentSessionsAfter += 1;
      const key = `${s.teacherUserId}:${s.curriculumSubjectId}`;
      const c = countsMap.get(key) || {
        onlineGroup: 0,
        online1on1: 0,
        offlineGroup: 0,
      };
      if (s.sessionType === 'GROUP' && s.deliveryMode === 'ONLINE') c.onlineGroup += 1;
      else if (s.sessionType === 'ONE_TO_ONE' && s.deliveryMode === 'ONLINE') c.online1on1 += 1;
      else if (s.sessionType === 'GROUP' && s.deliveryMode === 'IN_PERSON') c.offlineGroup += 1;
      countsMap.set(key, c);
    }
  }

  let overlapConflictsDetected = 0;
  for (const list of byTeacher.values()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 1; i < list.length; i++) {
      if (list[i].startTime.getTime() < list[i - 1].endTime.getTime()) {
        overlapConflictsDetected += 1;
      }
    }
  }

  let completeAssignmentsCount = 0;
  let incompleteAssignmentsCount = 0;
  const auditRows: AssignmentSessionAuditRow[] = [];

  for (const a of assignments) {
    const key = `${a.teacherUserId}:${a.curriculumSubjectId}`;
    const c = countsMap.get(key) || {
      onlineGroup: 0,
      online1on1: 0,
      offlineGroup: 0,
    };
    const isComplete =
      c.onlineGroup === 7 && c.online1on1 === 7 && c.offlineGroup === 7;
    if (isComplete) completeAssignmentsCount += 1;
    else incompleteAssignmentsCount += 1;

    if (opts?.includeAuditDetails || !isComplete || auditRows.length < 15) {
      auditRows.push({
        assignmentId: a.assignmentId,
        teacherUserId: a.teacherUserId,
        teacherName: a.teacherName,
        curriculumSubjectId: a.curriculumSubjectId,
        subjectNameAr: a.subjectNameAr,
        gradeNameAr: a.gradeNameAr,
        systemNameAr: a.systemNameAr,
        divisionNameAr: a.divisionNameAr,
        pathwayNameAr: a.pathwayNameAr,
        onlineGroupCount: c.onlineGroup,
        onlineOneToOneCount: c.online1on1,
        offlineGroupCount: c.offlineGroup,
        status: isComplete ? 'COMPLETE' : 'INCOMPLETE',
      });
    }
  }

  return {
    assignmentsProcessed: assignments.length,
    insertedSessionsCount,
    adoptedLegacySessionsCount,
    overlapConflictsDetected,
    totalAssignmentSessionsAfter,
    completeAssignmentsCount,
    incompleteAssignmentsCount,
    auditSample: auditRows,
  };
}
