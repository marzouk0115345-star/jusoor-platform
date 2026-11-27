export type RoleCode =
  | 'STUDENT'
  | 'TEACHER'
  | 'MENTOR'
  | 'EXPERT'
  | 'CENTER_OWNER'
  | 'CENTER_STAFF'
  | 'ADMIN';

export type TaskStatus =
  | 'OPEN'
  | 'OFFERS_RECEIVED'
  | 'OFFER_ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ['OFFERS_RECEIVED', 'CANCELLED'],
  OFFERS_RECEIVED: ['OFFER_ACCEPTED', 'CANCELLED'],
  OFFER_ACCEPTED: ['IN_PROGRESS', 'CANCELLED', 'DISPUTED'],
  IN_PROGRESS: ['DELIVERED', 'CANCELLED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'IN_PROGRESS', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
};

export function canTransitionTaskStatus(
  fromStatus: string,
  toStatus: string
): boolean {
  const allowed = ALLOWED_TASK_TRANSITIONS[fromStatus as TaskStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus as TaskStatus);
}

export function calculateCompletionPercent(
  completedCount: number,
  totalCount: number
): number {
  if (totalCount <= 0) return 0;
  const clamped = Math.max(0, Math.min(completedCount, totalCount));
  return Math.round((clamped / totalCount) * 100);
}

export function calculateCommissionAndNet(
  grossAmount: number,
  commissionPercent: number
): { gross: number; commission: number; net: number } {
  const safeGross = Math.max(0, Number(grossAmount.toFixed(2)));
  const safeRate = Math.max(0, Math.min(50, commissionPercent));
  const commission = Number(((safeGross * safeRate) / 100).toFixed(2));
  const net = Number((safeGross - commission).toFixed(2));
  return { gross: safeGross, commission, net };
}

export interface QuizQuestionInput {
  id: number;
  points: number;
  correctAnswerId: number;
}

export interface QuizSubmissionItem {
  questionId: number;
  selectedAnswerId: number;
}

export function gradeQuizAttempt(
  questions: QuizQuestionInput[],
  submissions: QuizSubmissionItem[],
  passingScorePercent: number
): {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  gradedItems: Array<{
    questionId: number;
    selectedAnswerId: number;
    isCorrect: boolean;
  }>;
} {
  const answerByQuestion = new Map<number, number>();
  for (const s of submissions) {
    answerByQuestion.set(s.questionId, s.selectedAnswerId);
  }

  let score = 0;
  let maxScore = 0;
  const gradedItems: Array<{
    questionId: number;
    selectedAnswerId: number;
    isCorrect: boolean;
  }> = [];

  for (const q of questions) {
    maxScore += q.points;
    const selected = answerByQuestion.get(q.id);
    if (selected !== undefined) {
      const isCorrect = selected === q.correctAnswerId;
      if (isCorrect) score += q.points;
      gradedItems.push({
        questionId: q.id,
        selectedAnswerId: selected,
        isCorrect,
      });
    }
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return {
    score,
    maxScore,
    percentage,
    passed: percentage >= passingScorePercent,
    gradedItems,
  };
}

export function hasAnyRole(
  userRoles: string[],
  allowedRoles: RoleCode[]
): boolean {
  return allowedRoles.some((r) => userRoles.includes(r));
}

export function hasCenterPermission(
  memberRole: string,
  permissions: string[],
  requiredPermission: string
): boolean {
  if (memberRole === 'OWNER' || memberRole === 'MANAGER') return true;
  return permissions.includes(requiredPermission);
}

export interface DiagnosticSummary {
  recommendedSolutionType: 'MENTORSHIP' | 'COURSE' | 'TASK' | 'CONSULTATION';
  gapCategory: string;
}

export function classifyLearnerNeed(goalText: string): DiagnosticSummary {
  const lower = goalText.toLowerCase();
  const knowsBasicsButStuckOnRealProjects =
    (lower.includes('html') ||
      lower.includes('css') ||
      lower.includes('javascript') ||
      lower.includes('أساسيات') ||
      lower.includes('أعرف')) &&
    (lower.includes('مشاريع') ||
      lower.includes('شركات') ||
      lower.includes('حقيقي') ||
      lower.includes('project') ||
      lower.includes('company') ||
      lower.includes('لا أستطيع'));

  if (knowsBasicsButStuckOnRealProjects) {
    return {
      recommendedSolutionType: 'MENTORSHIP',
      gapCategory: 'APPLICATION_AND_PROJECT_GUIDANCE',
    };
  }

  if (
    lower.includes('واجب') ||
    lower.includes('تاسك') ||
    lower.includes('مساعدة محددة') ||
    lower.includes('شرح درس') ||
    lower.includes('assignment') ||
    lower.includes('normalization')
  ) {
    return {
      recommendedSolutionType: 'TASK',
      gapCategory: 'TARGETED_CONCEPT_OR_TASK_HELP',
    };
  }

  if (
    lower.includes('استشارة') ||
    lower.includes('مسار مهني') ||
    lower.includes('مراجعة') ||
    lower.includes('architect') ||
    lower.includes('consultation')
  ) {
    return {
      recommendedSolutionType: 'CONSULTATION',
      gapCategory: 'EXPERT_ARCHITECTURAL_OR_CAREER_REVIEW',
    };
  }

  return {
    recommendedSolutionType: 'COURSE',
    gapCategory: 'STRUCTURED_FOUNDATIONAL_LEARNING',
  };
}

export type SessionType = 'ONE_TO_ONE' | 'GROUP';
export type SessionStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
export type SessionEnrollmentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';
export type DeliveryMode = 'ONLINE' | 'IN_PERSON' | 'OFFLINE';
export type CanonicalDeliveryMode = 'ONLINE' | 'IN_PERSON';
export type IndividualSlotStatus =
  | 'AVAILABLE'
  | 'PENDING'
  | 'BOOKED'
  | 'UNAVAILABLE';

export function normalizeDeliveryMode(
  mode?: string | null
): CanonicalDeliveryMode {
  if (mode === 'IN_PERSON' || mode === 'OFFLINE') return 'IN_PERSON';
  return 'ONLINE';
}

export function isOfflineDeliveryMode(mode?: string | null): boolean {
  return mode === 'IN_PERSON' || mode === 'OFFLINE';
}

export interface OfflineAddressParts {
  governorate?: string | null;
  city?: string | null;
  district?: string | null;
  streetName?: string | null;
  buildingOrCenterName?: string | null;
  locationNotes?: string | null;
  location?: string | null;
}

export function formatOfflineAddress(parts: OfflineAddressParts): string {
  const structured = [
    parts.buildingOrCenterName?.trim(),
    parts.streetName?.trim(),
    parts.district?.trim(),
    parts.city?.trim(),
    parts.governorate?.trim(),
  ].filter((v): v is string => Boolean(v));
  if (structured.length > 0) {
    const base = structured.join('، ');
    return parts.locationNotes?.trim()
      ? `${base} — ${parts.locationNotes.trim()}`
      : base;
  }
  return parts.location?.trim() || '';
}

export function formatCurrencyPrice(
  price: number | string,
  currency: string = 'EGP',
  locale: 'ar' | 'en' = 'ar'
): string {
  const num = Number(price);
  if (!Number.isFinite(num) || num === 0) {
    return locale === 'ar' ? 'مجانية' : 'Free';
  }
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2);
  const code = (currency || 'EGP').toUpperCase();
  if (code === 'EGP') {
    return locale === 'ar' ? `${formatted} ج.م` : `${formatted} EGP`;
  }
  if (code === 'USD') {
    return `$${formatted}`;
  }
  return `${formatted} ${code}`;
}

function toTimestampMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function doTimeRangesOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string
): boolean {
  const aStart = toTimestampMs(startA);
  const aEnd = toTimestampMs(endA);
  const bStart = toTimestampMs(startB);
  const bEnd = toTimestampMs(endB);
  if (
    !Number.isFinite(aStart) ||
    !Number.isFinite(aEnd) ||
    !Number.isFinite(bStart) ||
    !Number.isFinite(bEnd)
  ) {
    return false;
  }
  return aStart < bEnd && aEnd > bStart;
}

export function calculateDurationMinutes(
  startTime: Date | string,
  endTime: Date | string
): number {
  const diffMs = toTimestampMs(endTime) - toTimestampMs(startTime);
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.round(diffMs / 60_000);
}

export function computeSessionAvailability(params: {
  sessionType: SessionType;
  capacity: number;
  acceptedCount: number;
  status: SessionStatus;
  startTime: Date | string;
  registrationDeadline?: Date | string | null;
  now?: Date | string;
}): {
  effectiveCapacity: number;
  acceptedCount: number;
  remainingSeats: number;
  isFull: boolean;
  isRegistrationOpen: boolean;
  nextStatus: SessionStatus;
} {
  const effectiveCapacity =
    params.sessionType === 'ONE_TO_ONE'
      ? 1
      : Math.max(1, Math.floor(params.capacity));
  const accepted = Math.max(0, Math.floor(params.acceptedCount));
  const remainingSeats = Math.max(0, effectiveCapacity - accepted);
  const isFull = remainingSeats === 0;

  if (params.status === 'CANCELLED' || params.status === 'COMPLETED') {
    return {
      effectiveCapacity,
      acceptedCount: accepted,
      remainingSeats: 0,
      isFull: true,
      isRegistrationOpen: false,
      nextStatus: params.status,
    };
  }

  const nowMs = params.now ? toTimestampMs(params.now) : Date.now();
  const startMs = toTimestampMs(params.startTime);
  const deadlineMs = params.registrationDeadline
    ? toTimestampMs(params.registrationDeadline)
    : startMs;

  const nextStatus: SessionStatus = isFull ? 'FULL' : 'OPEN';
  const beforeStart = nowMs < startMs;
  const beforeDeadline = nowMs <= deadlineMs;

  return {
    effectiveCapacity,
    acceptedCount: accepted,
    remainingSeats,
    isFull,
    isRegistrationOpen: !isFull && beforeStart && beforeDeadline,
    nextStatus,
  };
}

export function computeIndividualSlotStatus(params: {
  sessionType: SessionType;
  status: SessionStatus;
  acceptedCount: number;
  pendingCount: number;
  startTime: Date | string;
  registrationDeadline?: Date | string | null;
  now?: Date | string;
}): IndividualSlotStatus | null {
  if (params.sessionType !== 'ONE_TO_ONE') return null;
  if (params.status === 'CANCELLED' || params.status === 'COMPLETED') {
    return 'UNAVAILABLE';
  }
  const nowMs = params.now ? toTimestampMs(params.now) : Date.now();
  const startMs = toTimestampMs(params.startTime);
  const deadlineMs = params.registrationDeadline
    ? toTimestampMs(params.registrationDeadline)
    : startMs;

  if (params.acceptedCount >= 1 || params.status === 'FULL') {
    return 'BOOKED';
  }
  if (nowMs >= startMs || nowMs > deadlineMs) {
    return 'UNAVAILABLE';
  }
  if (params.pendingCount > 0) {
    return 'PENDING';
  }
  return 'AVAILABLE';
}

export function validateSessionSchedule(input: {
  sessionType: SessionType;
  startTime: Date | string;
  endTime: Date | string;
  capacity: number;
  minStudents?: number | null;
  registrationDeadline?: Date | string | null;
  deliveryMode: DeliveryMode;
  location?: string | null;
  governorate?: string | null;
  city?: string | null;
  district?: string | null;
  streetName?: string | null;
  buildingOrCenterName?: string | null;
  meetingUrl?: string | null;
  price: number;
  now?: Date | string;
}): string | null {
  const startMs = toTimestampMs(input.startTime);
  const endMs = toTimestampMs(input.endTime);
  const nowMs = input.now ? toTimestampMs(input.now) : Date.now();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 'تاريخ بداية ونهاية الجلسة غير صالح.';
  }
  if (endMs <= startMs) {
    return 'يجب أن يكون وقت نهاية الجلسة بعد وقت البداية.';
  }
  const durationMinutes = Math.round((endMs - startMs) / 60_000);
  if (durationMinutes < 15 || durationMinutes > 480) {
    return 'مدة الجلسة يجب أن تكون بين 15 دقيقة و 8 ساعات.';
  }
  if (startMs <= nowMs) {
    return 'يجب أن يكون موعد الجلسة في المستقبل.';
  }
  const maxSessionHorizonMs = 365 * 86_400_000;
  if (startMs - nowMs > maxSessionHorizonMs) {
    return 'لا يمكن جدولة جلسة تعليمية لأكثر من 365 يوماً مقدماً.';
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return 'السعر يجب أن يكون صفراً أو قيمة موجبة.';
  }

  if (input.sessionType === 'ONE_TO_ONE') {
    if (input.capacity !== 1) {
      return 'الجلسة الفردية تتسع لطالب واحد فقط.';
    }
  } else {
    if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 500) {
      return 'السعة القصوى للجلسة الجماعية يجب أن تكون بين 2 و 500 طالب.';
    }
    if (
      input.minStudents !== undefined &&
      input.minStudents !== null &&
      (input.minStudents < 1 || input.minStudents > input.capacity)
    ) {
      return 'الحد الأدنى للطلاب يجب أن يكون بين 1 والسعة القصوى.';
    }
  }

  if (input.registrationDeadline) {
    const deadlineMs = toTimestampMs(input.registrationDeadline);
    if (!Number.isFinite(deadlineMs)) {
      return 'آخر موعد للتسجيل غير صالح.';
    }
    if (deadlineMs > startMs) {
      return 'آخر موعد للتسجيل يجب أن يكون قبل أو عند وقت بدء الجلسة.';
    }
  }

  if (isOfflineDeliveryMode(input.deliveryMode)) {
    const resolvedLocation = formatOfflineAddress(input);
    if (!resolvedLocation) {
      return 'يرجى تحديد العنوان التفصيلي للجلسات الحضورية (الأوفلاين).';
    }
  }

  return null;
}

export function canCancelSessionEnrollment(params: {
  enrollmentStatus: SessionEnrollmentStatus;
  sessionStatus: SessionStatus;
  startTime: Date | string;
  now?: Date | string;
}): { allowed: boolean; reason?: string } {
  if (
    params.enrollmentStatus === 'CANCELLED' ||
    params.enrollmentStatus === 'REJECTED'
  ) {
    return { allowed: false, reason: 'هذا الطلب ملغى أو مرفوض بالفعل.' };
  }
  if (
    params.sessionStatus === 'CANCELLED' ||
    params.sessionStatus === 'COMPLETED'
  ) {
    return {
      allowed: false,
      reason: 'لا يمكن إلغاء التسجيل في جلسة ملغاة أو مكتملة.',
    };
  }
  const nowMs = params.now ? toTimestampMs(params.now) : Date.now();
  const startMs = toTimestampMs(params.startTime);
  if (nowMs >= startMs) {
    return {
      allowed: false,
      reason: 'لا يمكن إلغاء الحجز بعد بدء موعد الجلسة.',
    };
  }
  return { allowed: true };
}

export function canEditTeachingSession(params: {
  currentStatus: SessionStatus;
  acceptedCount: number;
  activeRequestsCount: number;
  nextCapacity: number;
  currentSessionType: SessionType;
  nextSessionType?: SessionType;
}): { allowed: boolean; reason?: string } {
  if (
    params.currentStatus === 'CANCELLED' ||
    params.currentStatus === 'COMPLETED'
  ) {
    return {
      allowed: false,
      reason: 'لا يمكن تعديل جلسة ملغاة أو مكتملة.',
    };
  }
  if (
    params.nextSessionType &&
    params.nextSessionType !== params.currentSessionType &&
    (params.acceptedCount > 0 || params.activeRequestsCount > 0)
  ) {
    return {
      allowed: false,
      reason: 'لا يمكن تغيير نوع الجلسة بعد وجود طلبات تسجيل.',
    };
  }
  if (params.nextCapacity < params.acceptedCount) {
    return {
      allowed: false,
      reason: `لا يمكن تقليل السعة عن عدد الطلاب المقبولين حالياً (${params.acceptedCount}).`,
    };
  }
  return { allowed: true };
}

export type EducationalSystemCode =
  | 'PRIMARY_GENERAL'
  | 'PREPARATORY_GENERAL'
  | 'GENERAL_SECONDARY'
  | 'EGYPTIAN_BACCALAUREATE';

export interface CurriculumContextCheckInput {
  systemCode: string;
  gradeNumber: number;
  divisionId?: number | null;
  pathwayId?: number | null;
  divisionBelongsToGrade?: boolean;
  pathwayBelongsToGrade?: boolean;
}

export function validateCurriculumContextCombination(
  input: CurriculumContextCheckInput
): { valid: boolean; reason?: string } {
  const hasDivision = input.divisionId !== undefined && input.divisionId !== null;
  const hasPathway = input.pathwayId !== undefined && input.pathwayId !== null;

  if (hasDivision && hasPathway) {
    return {
      valid: false,
      reason: 'لا يمكن الجمع بين شعبة الثانوية العامة ومسار البكالوريا المصرية في نفس السياق.',
    };
  }

  if (
    input.systemCode === 'PRIMARY_GENERAL' ||
    input.systemCode === 'PREPARATORY_GENERAL'
  ) {
    if (hasDivision || hasPathway) {
      return {
        valid: false,
        reason: 'المرحلتان الابتدائية والإعدادية لا تحتويان على شعب أو مسارات تخصصية.',
      };
    }
    return { valid: true };
  }

  if (input.systemCode === 'GENERAL_SECONDARY') {
    if (hasPathway) {
      return {
        valid: false,
        reason: 'مسارات البكالوريا المصرية لا تنطبق على نظام الثانوية العامة.',
      };
    }
    if (input.gradeNumber === 1) {
      if (hasDivision) {
        return {
          valid: false,
          reason: 'الصف الأول الثانوي العام مرحلة تأسيسية مشتركة بدون شعب.',
        };
      }
      return { valid: true };
    }
    if (input.gradeNumber === 2 || input.gradeNumber === 3) {
      if (!hasDivision) {
        return {
          valid: false,
          reason: 'يجب اختيار الشعبة المناسبة للصفين الثاني أو الثالث الثانوي العام.',
        };
      }
      if (input.divisionBelongsToGrade === false) {
        return {
          valid: false,
          reason: 'الشعبة المختارة لا تتبع هذا الصف الدراسي.',
        };
      }
      return { valid: true };
    }
  }

  if (input.systemCode === 'EGYPTIAN_BACCALAUREATE') {
    if (hasDivision) {
      return {
        valid: false,
        reason: 'شعب الثانوية العامة لا تنطبق على نظام البكالوريا المصرية.',
      };
    }
    if (input.gradeNumber === 1) {
      if (hasPathway) {
        return {
          valid: false,
          reason: 'الصف الأول في البكالوريا المصرية مرحلة تمهيدية مشتركة بدون مسارات.',
        };
      }
      return { valid: true };
    }
    if (input.gradeNumber === 2 || input.gradeNumber === 3) {
      if (!hasPathway) {
        return {
          valid: false,
          reason: 'يجب اختيار المسار التخصصي للصفين الثاني أو الثالث بالبكالوريا المصرية.',
        };
      }
      if (input.pathwayBelongsToGrade === false) {
        return {
          valid: false,
          reason: 'المسار المختار لا يتبع هذا الصف الدراسي.',
        };
      }
      return { valid: true };
    }
  }

  return { valid: true };
}

export function canAssignTeacherToCurriculumSubject(subject: {
  isActive: boolean;
  isAvailableForTeacherAssignment: boolean;
}): { allowed: boolean; reason?: string } {
  if (!subject.isActive) {
    return { allowed: false, reason: 'هذه المادة الدراسية غير مفعّلة في النسخة الحالية.' };
  }
  if (!subject.isAvailableForTeacherAssignment) {
    return {
      allowed: false,
      reason: 'هذه المادة أو النشاط غير متاح لتعيين معلّمين.',
    };
  }
  return { allowed: true };
}

export interface DiscoverableTeacherEntry {
  teacherId: number;
  fullName: string;
  jobTitle: string;
  bio: string;
  ratingAvg: number;
  reviewsCount: number;
  yearsExperience: number;
  effectivePrice: number;
  publishedCoursesCount: number;
  individualSessionsCount: number;
  groupSessionsCount: number;
  supportsOnline: boolean;
  supportsInPerson: boolean;
  languagesOffered: string[];
}

export function filterAndSortDiscoveredTeachers<T extends DiscoverableTeacherEntry>(
  teachers: T[],
  options: {
    q?: string;
    deliveryMode?: 'ONLINE' | 'IN_PERSON' | 'OFFLINE' | '';
    language?: string;
    hasSessionsOnly?: boolean;
    sort?: 'rating' | 'price_asc' | 'price_desc' | 'experience' | 'sessions';
  }
): T[] {
  const q = (options.q || '').trim().toLowerCase();
  const lang = (options.language || '').trim().toLowerCase();

  const filtered = teachers.filter((t) => {
    if (q) {
      const hay = `${t.fullName} ${t.jobTitle} ${t.bio}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (options.deliveryMode === 'ONLINE' && !t.supportsOnline) return false;
    if (isOfflineDeliveryMode(options.deliveryMode) && !t.supportsInPerson) return false;
    if (
      lang &&
      !t.languagesOffered.some((l) => l.toLowerCase() === lang)
    ) {
      return false;
    }
    if (
      options.hasSessionsOnly &&
      t.individualSessionsCount + t.groupSessionsCount === 0
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered];
  switch (options.sort) {
    case 'price_asc':
      sorted.sort((a, b) => a.effectivePrice - b.effectivePrice || b.ratingAvg - a.ratingAvg);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.effectivePrice - a.effectivePrice || b.ratingAvg - a.ratingAvg);
      break;
    case 'experience':
      sorted.sort((a, b) => b.yearsExperience - a.yearsExperience || b.ratingAvg - a.ratingAvg);
      break;
    case 'sessions':
      sorted.sort(
        (a, b) =>
          b.individualSessionsCount +
            b.groupSessionsCount -
            (a.individualSessionsCount + a.groupSessionsCount) ||
          b.ratingAvg - a.ratingAvg
      );
      break;
    case 'rating':
    default:
      sorted.sort(
        (a, b) =>
          b.ratingAvg - a.ratingAvg ||
          b.reviewsCount - a.reviewsCount ||
          b.individualSessionsCount + b.groupSessionsCount - (a.individualSessionsCount + a.groupSessionsCount)
      );
      break;
  }

  return sorted;
}

export function isValidCalendarDate(ymd: string): boolean {
  const trimmed = (ymd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [yStr, mStr, dStr] = trimmed.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function validateTaskDeadline(
  deadline: string,
  now?: Date | string
): string | null {
  const trimmed = (deadline || '').trim();
  if (!isValidCalendarDate(trimmed)) {
    return 'صيغة الموعد النهائي غير صالحة (المطلوب YYYY-MM-DD).';
  }
  const [y, m, d] = trimmed.split('-').map(Number);
  const deadlineUtcMs = Date.UTC(y, m - 1, d);
  const nowDate = now ? new Date(now) : new Date();
  const todayStartMs = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );

  if (deadlineUtcMs < todayStartMs) {
    return 'الموعد النهائي لا يمكن أن يكون في الماضي.';
  }

  const maxHorizonMs = 365 * 86_400_000;
  if (deadlineUtcMs - todayStartMs > maxHorizonMs) {
    return 'الموعد النهائي يجب أن يكون خلال 365 يوماً من اليوم كحد أقصى.';
  }
  return null;
}

export function validateAvailabilitySlot(
  slotDate: string,
  startTime: string,
  endTime: string,
  now?: Date | string
): string | null {
  const trimmedDate = (slotDate || '').trim();
  if (!isValidCalendarDate(trimmedDate)) {
    return 'تاريخ الموعد غير صالح (المطلوب YYYY-MM-DD).';
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return 'صيغة الوقت HH:mm مطلوبة.';
  }
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (sh > 23 || sm > 59 || eh > 23 || em > 59) {
    return 'وقت البداية أو النهاية غير صالح.';
  }
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) {
    return 'يجب أن يكون وقت نهاية الموعد بعد وقت البداية.';
  }

  const slotStartMs = new Date(`${trimmedDate}T${startTime}:00Z`).getTime();
  const nowMs = now ? toTimestampMs(now) : Date.now();
  if (!Number.isFinite(slotStartMs) || slotStartMs <= nowMs) {
    return 'يجب أن يكون موعد التفرغ في المستقبل.';
  }

  const maxHorizonMs = 180 * 86_400_000;
  if (slotStartMs - nowMs > maxHorizonMs) {
    return 'لا يمكن جدولة موعد تفرغ لأكثر من 180 يوماً مقدماً.';
  }
  return null;
}

export function mapBookingStatusToSessionStatus(
  bookingStatus: string
): 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' {
  if (bookingStatus === 'COMPLETED') return 'COMPLETED';
  if (bookingStatus === 'CANCELLED') return 'CANCELLED';
  return 'SCHEDULED';
}

export type RecordOrigin = 'REAL' | 'DEMO' | 'QA_TEST';

export function classifyRecordOrigin(
  email?: string | null,
  isDemo?: boolean | null
): RecordOrigin {
  const normalized = (email || '').trim().toLowerCase();
  if (normalized.startsWith('qa.') && normalized.endsWith('@jusoor.test')) {
    return 'QA_TEST';
  }
  if (isDemo) {
    return 'DEMO';
  }
  return 'REAL';
}

export const MAX_COURSE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_COURSE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function validateCourseImageMeta(input: {
  mimeType?: string | null;
  sizeBytes?: number | null;
  fileName?: string | null;
}): { valid: boolean; error?: string } {
  const mime = (input.mimeType || '').trim().toLowerCase();
  const name = (input.fileName || '').trim().toLowerCase();
  const hasAllowedExt =
    !name ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp');

  if (!ALLOWED_COURSE_IMAGE_MIMES.has(mime) || !hasAllowedExt) {
    return {
      valid: false,
      error: 'صيغة الصورة غير مدعومة. الصيغ المسموحة فقط: JPEG، JPG، PNG، WebP.',
    };
  }

  const size = Number(input.sizeBytes ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, error: 'ملف الصورة فارغ أو غير صالح.' };
  }
  if (size > MAX_COURSE_IMAGE_BYTES) {
    return {
      valid: false,
      error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).',
    };
  }

  return { valid: true };
}

export function detectImageFormatFromBytes(
  bytes: Uint8Array
): 'jpg' | 'png' | 'webp' | null {
  if (!bytes || bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF....WEBP
  const isRiff =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  const isWebp =
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isRiff && isWebp) {
    return 'webp';
  }

  return null;
}

export type CenterPermissionKey =
  | 'MANAGE_CENTER'
  | 'MANAGE_STAFF'
  | 'MANAGE_STUDENTS'
  | 'MANAGE_COURSES'
  | 'MANAGE_SETTINGS'
  | 'VIEW_REPORTS'
  | 'VIEW_ENROLLMENTS';

export function canManageCenterResource(params: {
  isAdmin: boolean;
  ownerUserId: number;
  callerUserId: number;
  membership?: {
    memberRole: string;
    status: string;
    permissionsJson: string[];
  } | null;
  requiredPermission: CenterPermissionKey;
}): boolean {
  if (params.isAdmin) return true;
  if (params.ownerUserId === params.callerUserId) return true;
  if (!params.membership || params.membership.status !== 'ACTIVE') return false;
  if (params.membership.memberRole === 'OWNER') return true;
  if (params.membership.memberRole === 'MANAGER') {
    return params.requiredPermission !== 'MANAGE_CENTER';
  }
  return params.membership.permissionsJson.includes(params.requiredPermission);
}

export function canCourseAcceptNewEnrollment(params: {
  status: string;
  enrollmentStatus?: string | null;
  maxStudents?: number | null;
  activeEnrolledCount: number;
}): { allowed: boolean; reason?: string } {
  if (params.status !== 'PUBLISHED') {
    return { allowed: false, reason: 'الدورة غير متاحة للتسجيل حالياً.' };
  }
  if (params.enrollmentStatus === 'PAUSED') {
    return { allowed: false, reason: 'تم إيقاف التسجيل في هذه الدورة مؤقتاً.' };
  }
  if (params.enrollmentStatus === 'CLOSED') {
    return { allowed: false, reason: 'تم إغلاق التسجيل في هذه الدورة.' };
  }
  if (
    params.maxStudents !== null &&
    params.maxStudents !== undefined &&
    params.maxStudents > 0 &&
    params.activeEnrolledCount >= params.maxStudents
  ) {
    return { allowed: false, reason: 'اكتمل الحد الأقصى للطلاب في هذه الدورة.' };
  }
  return { allowed: true };
}

export const DEFAULT_CENTER_WORKING_HOURS = [
  { dayOfWeek: 0, isOpen: true, openTime: '09:00', closeTime: '21:00', note: '' },
  { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '21:00', note: '' },
  { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '21:00', note: '' },
  { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '21:00', note: '' },
  { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '21:00', note: '' },
  { dayOfWeek: 5, isOpen: false, openTime: '14:00', closeTime: '20:00', note: 'عطلة أسبوعية' },
  { dayOfWeek: 6, isOpen: true, openTime: '10:00', closeTime: '20:00', note: '' },
];

export const DEFAULT_CENTER_BOOKING_POLICIES = {
  allowStudentBookings: true,
  requireApproval: true,
  minBookingNoticeHours: 12,
  allowCancellation: true,
  minCancellationNoticeHours: 24,
  maxReschedulesPerBooking: 2,
  policySummary: 'يُسمح بإلغاء أو تعديل الحجز قبل الموعد بـ 24 ساعة على الأقل.',
};

export const DEFAULT_CENTER_NOTIFICATION_SETTINGS = {
  notifyNewStudentRegistration: true,
  notifyNewCourseEnrollment: true,
  notifyBookingRequests: true,
  notifyCancellations: true,
  notifyPaymentUpdates: true,
  notifyStaffActivities: false,
};

export type CenterVerificationStatus =
  | 'VERIFIED'
  | 'PENDING'
  | 'REJECTED'
  | 'UNVERIFIED';

export const CENTER_VERIFICATION_LABELS_AR: Record<CenterVerificationStatus, string> = {
  VERIFIED: 'مركز موثوق',
  PENDING: 'قيد المراجعة',
  REJECTED: 'مرفوض التوثيق',
  UNVERIFIED: 'غير موثّق',
};

export function getCenterVerificationLabelAr(status?: string | null): string {
  const normalized = (status || '').trim().toUpperCase() as CenterVerificationStatus;
  return CENTER_VERIFICATION_LABELS_AR[normalized] || CENTER_VERIFICATION_LABELS_AR.PENDING;
}

export interface CenterAddressInput {
  governorate?: string | null;
  city?: string | null;
  street?: string | null;
  buildingDetails?: string | null;
  address?: string | null;
  country?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export function formatCenterFullAddress(
  input: CenterAddressInput,
  options?: { includeCountry?: boolean }
): string {
  const rawParts = [
    input.buildingDetails?.trim(),
    input.street?.trim(),
    input.address?.trim(),
    input.city?.trim(),
    input.governorate?.trim(),
    options?.includeCountry ? input.country?.trim() : undefined,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  const deduped: string[] = [];
  for (const part of rawParts) {
    const normalizedPart = part.toLowerCase();
    const alreadyCovered = deduped.some(
      (existing) =>
        existing.toLowerCase() === normalizedPart ||
        existing.toLowerCase().includes(normalizedPart)
    );
    if (!alreadyCovered) {
      deduped.push(part);
    }
  }
  return deduped.join('، ');
}

export function validateCoordinates(
  latInput: number | string | null | undefined,
  lngInput: number | string | null | undefined
): {
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  error?: string;
} {
  const latBlank =
    latInput === null ||
    latInput === undefined ||
    (typeof latInput === 'string' && latInput.trim() === '');
  const lngBlank =
    lngInput === null ||
    lngInput === undefined ||
    (typeof lngInput === 'string' && lngInput.trim() === '');

  if (latBlank && lngBlank) {
    return { valid: true, latitude: null, longitude: null };
  }
  if (latBlank !== lngBlank) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      error: 'يجب إدخال خط العرض وخط الطول معاً أو تركهما فارغين.',
    };
  }

  const lat = Number(latInput);
  const lng = Number(lngInput);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      error: 'قيمة خط العرض (Latitude) يجب أن تكون بين -90 و 90.',
    };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return {
      valid: false,
      latitude: null,
      longitude: null,
      error: 'قيمة خط الطول (Longitude) يجب أن تكون بين -180 و 180.',
    };
  }
  return {
    valid: true,
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lng.toFixed(7)),
  };
}

export function parseCoordinatesFromMapsInput(
  rawInput: string
): { latitude: number; longitude: number } | null {
  const raw = (rawInput || '').trim();
  if (!raw) return null;

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /^\s*(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)\s*$/,
  ];

  for (const regex of patterns) {
    const match = raw.match(regex);
    if (match) {
      const checked = validateCoordinates(match[1], match[2]);
      if (checked.valid && checked.latitude !== null && checked.longitude !== null) {
        return { latitude: checked.latitude, longitude: checked.longitude };
      }
    }
  }
  return null;
}

export function buildGoogleMapsSearchUrl(input: CenterAddressInput): string | null {
  const checked = validateCoordinates(input.latitude, input.longitude);
  if (checked.valid && checked.latitude !== null && checked.longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${checked.latitude},${checked.longitude}`;
  }
  const fullAddress = formatCenterFullAddress(input, { includeCountry: true });
  if (!fullAddress) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

export function isPublicCenterCourseVisible(status?: string | null): boolean {
  return (status || '').trim().toUpperCase() === 'PUBLISHED';
}

export function isPublicCenterMemberVisible(
  memberStatus?: string | null,
  userAccountStatus?: string | null
): boolean {
  const memberActive = (memberStatus || '').trim().toUpperCase() === 'ACTIVE';
  const accountActive = (userAccountStatus ?? 'ACTIVE').trim().toUpperCase() === 'ACTIVE';
  return memberActive && accountActive;
}

export function resolveCourseFieldDisplay(
  customFieldName?: string | null,
  taxonomyFieldNameAr?: string | null
): string {
  const custom = (customFieldName || '').trim();
  if (custom.length > 0) return custom;
  const taxonomy = (taxonomyFieldNameAr || '').trim();
  if (taxonomy.length > 0) return taxonomy;
  return 'عام';
}

export function validateManualCourseField(fieldText?: string | null): {
  valid: boolean;
  value: string;
  error?: string;
} {
  const value = (fieldText || '').replace(/\s+/g, ' ').trim();
  if (!value) {
    return {
      valid: false,
      value: '',
      error: 'يرجى إدخال المجال أو التخصص التعليمي للدورة يدوياً.',
    };
  }
  if (value.length < 2) {
    return {
      valid: false,
      value,
      error: 'يجب أن لا يقل اسم المجال أو التخصص عن حرفين.',
    };
  }
  if (value.length > 100) {
    return {
      valid: false,
      value,
      error: 'اسم المجال أو التخصص يجب أن لا يتجاوز 100 حرف.',
    };
  }
  return { valid: true, value };
}

const ARABIC_LESSON_ORDINALS = [
  'الدرس الأول',
  'الدرس الثاني',
  'الدرس الثالث',
  'الدرس الرابع',
  'الدرس الخامس',
  'الدرس السادس',
  'الدرس السابع',
  'الدرس الثامن',
  'الدرس التاسع',
  'الدرس العاشر',
];

export function formatArabicLessonOrdinal(indexZeroBased: number): string {
  const idx = Math.max(0, Math.floor(indexZeroBased));
  if (idx < ARABIC_LESSON_ORDINALS.length) {
    return ARABIC_LESSON_ORDINALS[idx];
  }
  return `الدرس ${idx + 1}`;
}

export function normalizeCourseLessonsOrder<T extends { sortOrder?: number }>(
  lessons: T[]
): Array<T & { sortOrder: number }> {
  return lessons.map((lesson, idx) => ({
    ...lesson,
    sortOrder: idx + 1,
  }));
}

export function reorderCourseLessons<T extends { sortOrder?: number }>(
  lessons: T[],
  fromIndex: number,
  toIndex: number
): Array<T & { sortOrder: number }> {
  const copy = [...lessons];
  if (
    fromIndex < 0 ||
    fromIndex >= copy.length ||
    toIndex < 0 ||
    toIndex >= copy.length ||
    fromIndex === toIndex
  ) {
    return normalizeCourseLessonsOrder(copy);
  }
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return normalizeCourseLessonsOrder(copy);
}

export function validateCourseLessonInput(
  lesson: {
    title?: string | null;
    content?: string | null;
    durationMinutes?: number | null;
  },
  indexZeroBased?: number
): { valid: boolean; error?: string } {
  const label =
    indexZeroBased !== undefined
      ? formatArabicLessonOrdinal(indexZeroBased)
      : 'الدرس';
  const title = (lesson.title || '').trim();
  const content = (lesson.content || '').trim();
  const duration =
    lesson.durationMinutes === undefined || lesson.durationMinutes === null
      ? 15
      : Number(lesson.durationMinutes);

  if (title.length < 2) {
    return {
      valid: false,
      error: `${label}: يرجى إدخال عنوان واضح للدرس (حرفان على الأقل).`,
    };
  }
  if (content.length < 5) {
    return {
      valid: false,
      error: `${label}: يرجى كتابة محتوى الدرس (5 أحرف على الأقل).`,
    };
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 600) {
    return {
      valid: false,
      error: `${label}: مدة الدرس يجب أن تكون بين 1 و 600 دقيقة.`,
    };
  }
  return { valid: true };
}

export function validateCoursePublishReadiness(params: {
  title?: string | null;
  description?: string | null;
  customFieldName?: string | null;
  lessons: Array<{
    title?: string | null;
    content?: string | null;
    durationMinutes?: number | null;
  }>;
  status?: string | null;
}): {
  valid: boolean;
  errors: Record<string, string>;
  lessonErrors: Record<number, string>;
} {
  const errors: Record<string, string> = {};
  const lessonErrors: Record<number, string> = {};

  const title = (params.title || '').trim();
  if (title.length < 3) {
    errors.title = 'عنوان الدورة مطلوب (3 أحرف على الأقل).';
  }

  const description = (params.description || '').trim();
  if (description.length < 10) {
    errors.description = 'وصف الدورة مطلوب (10 أحرف على الأقل).';
  }

  const fieldCheck = validateManualCourseField(params.customFieldName);
  if (!fieldCheck.valid && fieldCheck.error) {
    errors.customFieldName = fieldCheck.error;
  }

  const isPublishing = (params.status || 'DRAFT').toUpperCase() === 'PUBLISHED';
  if (isPublishing && params.lessons.length === 0) {
    errors.lessons = 'يجب إضافة درس واحد على الأقل قبل نشر الدورة.';
  }

  params.lessons.forEach((lesson, idx) => {
    const check = validateCourseLessonInput(lesson, idx);
    if (!check.valid && check.error) {
      lessonErrors[idx] = check.error;
    }
  });

  if (Object.keys(lessonErrors).length > 0 && !errors.lessons) {
    errors.lessons = 'يرجى استكمال بيانات الدروس المطلوبة (العنوان والمحتوى).';
  }

  return {
    valid:
      Object.keys(errors).length === 0 &&
      Object.keys(lessonErrors).length === 0,
    errors,
    lessonErrors,
  };
}


