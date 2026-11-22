// In-memory Bearer token holder (never stored in localStorage/sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { error: text || 'استجابة غير متوقعة من الخادم' };
  }

  if (!res.ok) {
    const errMsg =
      (typeof data.error === 'string' && data.error) ||
      `فشل الطلب برمز ${res.status}`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const ROLE_LABELS_AR: Record<string, string> = {
  STUDENT: 'طالب / متعلّم',
  TEACHER: 'معلّم / مدرّب',
  MENTOR: 'مرشد مهني',
  EXPERT: 'خبير / مستشار',
  CENTER_OWNER: 'مالك مركز تعليمي',
  CENTER_STAFF: 'موظف مركز',
  ADMIN: 'مدير المنصة',
};

export const TASK_STATUS_LABELS_AR: Record<string, string> = {
  OPEN: 'مفتوحة للعروض',
  OFFERS_RECEIVED: 'تم استلام عروض',
  OFFER_ACCEPTED: 'تم قبول عرض',
  IN_PROGRESS: 'قيد التنفيذ',
  DELIVERED: 'تم التسليم',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
  DISPUTED: 'قيد المراجعة',
};

export const BOOKING_STATUS_LABELS_AR: Record<string, string> = {
  PENDING: 'بانتظار التأكيد',
  CONFIRMED: 'مؤكد',
  RESCHEDULED: 'أعيدت جدولته',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
};

export const LEVEL_LABELS_AR: Record<string, string> = {
  BEGINNER: 'مبتدئ',
  INTERMEDIATE: 'متوسط',
  ADVANCED: 'متقدم',
};

export const SERVICE_TYPE_LABELS_AR: Record<string, string> = {
  PRIVATE_LESSON: 'درس خصوصي',
  MENTORSHIP: 'إرشاد مهني عملي',
  CONSULTATION: 'استشارة خبير',
};

export const SESSION_TYPE_LABELS_AR: Record<string, string> = {
  ONE_TO_ONE: 'جلسة فردية (1:1)',
  GROUP: 'جلسة جماعية',
};

export const SESSION_STATUS_LABELS_AR: Record<string, string> = {
  OPEN: 'متاحة للتسجيل',
  FULL: 'مكتملة المقاعد',
  CANCELLED: 'ملغاة',
  COMPLETED: 'مكتملة',
};

export const ENROLLMENT_STATUS_LABELS_AR: Record<string, string> = {
  PENDING: 'بانتظار موافقة المدرّب',
  ACCEPTED: 'مقبول ومؤكد',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغى',
};

export const DELIVERY_MODE_LABELS_AR: Record<string, string> = {
  ONLINE: 'عن بُعد (أونلاين)',
  IN_PERSON: 'حضوري',
};

export const WEEKDAY_LABELS_AR: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export interface TeachingSessionItem {
  id: number;
  teacherUserId: number;
  teacherName: string;
  teacherAvatarUrl: string | null;
  teacherHeadline: string;
  teacherVerificationStatus: string;
  subjectId: number | null;
  subjectNameAr: string | null;
  subjectNameEn: string | null;
  curriculumSubjectId?: number | null;
  gradeId?: number | null;
  gradeNameAr?: string | null;
  gradeNameEn?: string | null;
  systemNameAr?: string | null;
  systemNameEn?: string | null;
  fieldId: number | null;
  fieldNameAr: string | null;
  stageId: number | null;
  stageNameAr: string | null;
  sessionType: 'ONE_TO_ONE' | 'GROUP';
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  minStudents: number | null;
  acceptedCount: number;
  pendingCount?: number;
  remainingSeats: number;
  isFull: boolean;
  isRegistrationOpen: boolean;
  price: string;
  currency: string;
  deliveryMode: 'ONLINE' | 'IN_PERSON';
  location: string | null;
  meetingUrl: string | null;
  registrationDeadline: string | null;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  myEnrollment: {
    id: number;
    sessionId: number;
    studentUserId: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
    notes: string | null;
    requestedAt: string;
    respondedAt: string | null;
    cancelledAt: string | null;
  } | null;
}

export interface StudentSessionEnrollmentItem {
  id: number;
  sessionId: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  notes: string | null;
  requestedAt: string;
  respondedAt: string | null;
  cancelledAt: string | null;
  session: TeachingSessionItem;
}

export interface AcademicYearItem {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  isActive: boolean;
}

export interface CurriculumVersionItem {
  id: number;
  academicYearId: number;
  versionCode: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  copiedFromVersionId: number | null;
  isActive: boolean;
  isPublished: boolean;
}

export interface CurriculumStageItem {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CurriculumSystemItem {
  id: number;
  stageId: number;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CurriculumGradeItem {
  id: number;
  stageId: number;
  systemId: number;
  gradeNumber: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CurriculumDivisionItem {
  id: number;
  systemId: number;
  gradeId: number;
  code: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CurriculumPathwayItem {
  id: number;
  systemId: number;
  gradeId: number;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CurriculumOverviewResponse {
  academicYears: AcademicYearItem[];
  activeAcademicYear: AcademicYearItem | null;
  versions: CurriculumVersionItem[];
  activeVersion: CurriculumVersionItem | null;
  stages: CurriculumStageItem[];
  systems: CurriculumSystemItem[];
  grades: CurriculumGradeItem[];
  divisions: CurriculumDivisionItem[];
  pathways: CurriculumPathwayItem[];
}

export interface CurriculumSubjectItem {
  id: number;
  curriculumVersionId: number;
  academicYearId: number;
  stageId: number;
  systemId: number;
  gradeId: number;
  divisionId: number | null;
  pathwayId: number | null;
  subjectId: number;
  subjectSlug: string;
  subjectNameAr: string;
  subjectNameEn: string;
  fieldId: number;
  fieldNameAr: string;
  fieldNameEn: string;
  subjectType: string;
  isCompulsory: boolean;
  isElective: boolean;
  isSpecialization: boolean;
  isIncludedInTotal: boolean;
  isPassFail: boolean;
  isNonTotal: boolean;
  isActivity: boolean;
  passThresholdPercent: number | null;
  electiveGroupCode: string | null;
  defaultLanguageOfInstruction: string;
  languagesOfInstruction: string[];
  curriculumVariants: string[];
  notesAr: string | null;
  notesEn: string | null;
  isAvailableForTeacherAssignment: boolean;
  sortOrder: number;
  activeTeachersCount: number;
  sessionsCount: number;
}

export interface DiscoveredTeacherSessionItem {
  id: number;
  teacherUserId: number;
  sessionType: 'ONE_TO_ONE' | 'GROUP';
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  capacity: number;
  acceptedCount: number;
  remainingSeats: number;
  isFull: boolean;
  isRegistrationOpen: boolean;
  price: string;
  currency: string;
  deliveryMode: 'ONLINE' | 'IN_PERSON';
  location: string | null;
  meetingUrl: string | null;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  curriculumSubjectId: number | null;
  gradeId: number | null;
  myEnrollment: {
    id: number;
    sessionId: number;
    studentUserId: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  } | null;
}

export interface DiscoveredTeacherItem {
  teacherId: number;
  assignmentId: number;
  fullName: string;
  avatarUrl: string | null;
  providerType: string;
  jobTitle: string;
  headline: string;
  bio: string;
  qualifications: string | null;
  yearsExperience: number;
  verificationStatus: string;
  ratingAvg: number;
  reviewsCount: number;
  effectivePrice: number;
  currency: string;
  supportsOnline: boolean;
  supportsInPerson: boolean;
  languagesOffered: string[];
  religiousVariant: string | null;
  assignmentNotes: string | null;
  publishedCoursesCount: number;
  individualSessionsCount: number;
  groupSessionsCount: number;
  sessions: DiscoveredTeacherSessionItem[];
  teachingAssignmentsSummary: Array<{
    curriculumSubjectId: number;
    subjectNameAr: string;
    subjectNameEn: string;
    gradeNameAr: string;
    gradeNameEn: string;
    systemNameAr: string;
    systemNameEn: string;
    divisionNameAr: string | null;
    pathwayNameAr: string | null;
  }>;
}

export interface TeacherTeachingAssignmentItem {
  id: number;
  curriculumSubjectId: number;
  subjectId: number;
  gradeId: number;
  systemId: number;
  divisionId: number | null;
  pathwayId: number | null;
  languagesOffered: string[];
  religiousVariant: string | null;
  hourlyRate: string | null;
  currency: string;
  supportsOnline: boolean;
  supportsInPerson: boolean;
  notes: string | null;
  isActive: boolean;
  subjectNameAr: string;
  subjectNameEn: string;
  gradeNameAr: string;
  gradeNameEn: string;
  systemNameAr: string;
  systemNameEn: string;
  stageNameAr: string;
  stageNameEn: string;
  divisionNameAr: string | null;
  divisionNameEn: string | null;
  pathwayNameAr: string | null;
  pathwayNameEn: string | null;
}

export const LANGUAGE_OF_INSTRUCTION_LABELS: Record<
  string,
  { ar: string; en: string }
> = {
  ar: { ar: 'العربية', en: 'Arabic' },
  en: { ar: 'الإنجليزية', en: 'English' },
  fr: { ar: 'الفرنسية', en: 'French' },
  de: { ar: 'الألمانية', en: 'German' },
  es: { ar: 'الإسبانية', en: 'Spanish' },
  it: { ar: 'الإيطالية', en: 'Italian' },
  zh: { ar: 'الصينية', en: 'Chinese' },
};

export function formatSessionDateRange(
  startIso: string,
  endIso: string,
  locale: 'ar' | 'en' = 'ar'
): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const dateStr = s.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const startTimeStr = s.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeStr = e.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} · ${startTimeStr} - ${endTimeStr}`;
}


