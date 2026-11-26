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

