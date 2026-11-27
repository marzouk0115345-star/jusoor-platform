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

export {
  formatCurrencyPrice,
  formatOfflineAddress,
  isOfflineDeliveryMode,
  CENTER_VERIFICATION_LABELS_AR,
  getCenterVerificationLabelAr,
  formatCenterFullAddress,
  buildGoogleMapsSearchUrl,
  parseCoordinatesFromMapsInput,
  validateCoordinates,
  resolveCourseFieldDisplay,
  validateManualCourseField,
  formatArabicLessonOrdinal,
  normalizeCourseLessonsOrder,
  reorderCourseLessons,
  validateCourseLessonInput,
  validateCoursePublishReadiness,
  type IndividualSlotStatus,
} from './domain';

export const DELIVERY_MODE_LABELS_AR: Record<string, string> = {
  ONLINE: 'عن بُعد (أونلاين)',
  IN_PERSON: 'حضوري (أوفلاين)',
  OFFLINE: 'حضوري (أوفلاين)',
};

export const INDIVIDUAL_SLOT_STATUS_LABELS_AR: Record<string, string> = {
  AVAILABLE: 'متاحة للحجز',
  PENDING: 'قيد المراجعة',
  BOOKED: 'محجوزة',
  UNAVAILABLE: 'غير متاحة',
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
  systemId?: number | null;
  systemNameAr?: string | null;
  systemNameEn?: string | null;
  gradeId?: number | null;
  gradeNameAr?: string | null;
  gradeNameEn?: string | null;
  divisionId?: number | null;
  divisionNameAr?: string | null;
  divisionNameEn?: string | null;
  pathwayId?: number | null;
  pathwayNameAr?: string | null;
  pathwayNameEn?: string | null;
  fieldId: number | null;
  fieldNameAr: string | null;
  stageId: number | null;
  stageNameAr: string | null;
  stageNameEn?: string | null;
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
  hasPendingRequests?: boolean;
  slotStatus?: 'AVAILABLE' | 'PENDING' | 'BOOKED' | 'UNAVAILABLE' | null;
  remainingSeats: number;
  isFull: boolean;
  isRegistrationOpen: boolean;
  price: string;
  currency: string;
  deliveryMode: 'ONLINE' | 'IN_PERSON';
  location: string | null;
  governorate?: string | null;
  city?: string | null;
  district?: string | null;
  streetName?: string | null;
  buildingOrCenterName?: string | null;
  locationNotes?: string | null;
  isDemoLocation?: boolean;
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

export interface TeachingSessionsPagedResponse {
  sessions: TeachingSessionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TeacherSessionCounts {
  all: number;
  onlineGroup: number;
  onlineOneToOne: number;
  offlineGroup: number;
  upcoming: number;
  completed: number;
  cancelled: number;
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
  pendingCount?: number;
  remainingSeats: number;
  isFull: boolean;
  isRegistrationOpen: boolean;
  slotStatus?: 'AVAILABLE' | 'PENDING' | 'BOOKED' | 'UNAVAILABLE' | null;
  price: string;
  currency: string;
  deliveryMode: 'ONLINE' | 'IN_PERSON';
  location: string | null;
  governorate?: string | null;
  city?: string | null;
  district?: string | null;
  streetName?: string | null;
  buildingOrCenterName?: string | null;
  locationNotes?: string | null;
  isDemoLocation?: boolean;
  meetingUrl: string | null;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  curriculumSubjectId: number | null;
  gradeId: number | null;
  systemId?: number | null;
  divisionId?: number | null;
  pathwayId?: number | null;
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
  onlineGroupSessionsCount?: number;
  onlineIndividualSlotsCount?: number;
  offlineGroupSessionsCount?: number;
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

export function uploadCenterImageWithProgress(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{
  thumbnailUrl?: string;
  coverImageKey?: string;
  logoUrl?: string;
  frontImageUrl?: string;
  bannerUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    if (inMemoryToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${inMemoryToken}`);
    }
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = xhr.responseText
          ? (JSON.parse(xhr.responseText) as Record<string, unknown>)
          : {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve(
          data as {
            thumbnailUrl?: string;
            coverImageKey?: string;
            logoUrl?: string;
            frontImageUrl?: string;
            bannerUrl?: string;
            mimeType?: string;
            sizeBytes?: number;
          }
        );
      } else {
        reject(
          new Error(
            (typeof data.error === 'string' && data.error) ||
              `تعذر رفع الصورة (رمز ${xhr.status}).`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error('حدث خطأ في الشبكة أثناء رفع الصورة.'));
    };

    xhr.send(file);
  });
}

export const EMPLOYMENT_TYPE_LABELS_AR: Record<string, string> = {
  FULL_TIME: 'دوام كامل',
  PART_TIME: 'دوام جزئي',
  CONTRACT: 'تعاقد فصلي',
  FREELANCE: 'مستقل / بالساعة',
};

export const COURSE_STATUS_LABELS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  PUBLISHED: 'منشورة',
  PAUSED: 'متوقفة مؤقتاً',
  CLOSED: 'مغلقة',
  ARCHIVED: 'مؤرشفة',
};

export const COURSE_ENROLLMENT_STATUS_LABELS_AR: Record<string, string> = {
  OPEN: 'مفتوح للتسجيل',
  PAUSED: 'التسجيل متوقف مؤقتاً',
  CLOSED: 'التسجيل مغلق',
};

export const ATTENDANCE_STATUS_LABELS_AR: Record<string, string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غائب',
  LATE: 'متأخر',
  EXCUSED: 'غياب بعذر',
};

export const PAYMENT_STATUS_LABELS_AR: Record<string, string> = {
  PAID: 'مدفوعة',
  PENDING: 'معلّقة',
  PARTIAL: 'مدفوعة جزئياً',
  OVERDUE: 'متأخرة',
  REFUNDED: 'مستردة',
};

export const PAYMENT_METHOD_LABELS_AR: Record<string, string> = {
  CASH: 'نقدي بالمركز',
  CARD: 'بطاقة بنكية',
  TRANSFER: 'تحويل بنكي',
  WALLET: 'محفظة إلكترونية',
};

export interface CenterWorkingHourItem {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  note?: string;
}

export interface CenterBookingPolicies {
  allowStudentBookings: boolean;
  requireApproval: boolean;
  minBookingNoticeHours: number;
  allowCancellation: boolean;
  minCancellationNoticeHours: number;
  maxReschedulesPerBooking: number;
  policySummary: string;
}

export interface CenterNotificationSettings {
  notifyNewStudentRegistration: boolean;
  notifyNewCourseEnrollment: boolean;
  notifyBookingRequests: boolean;
  notifyCancellations: boolean;
  notifyPaymentUpdates: boolean;
  notifyStaffActivities: boolean;
}

export interface CenterDashboardCenterItem {
  id: number;
  ownerUserId: number;
  name: string;
  slug: string;
  description: string;
  governorate?: string | null;
  city: string;
  country: string;
  street?: string | null;
  buildingDetails?: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone: string | null;
  secondaryPhone: string | null;
  website: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  verificationStatus: string;
  workingHoursJson: CenterWorkingHourItem[];
  bookingPoliciesJson: CenterBookingPolicies;
  notificationSettingsJson: CenterNotificationSettings;
  callerRole?: string;
  callerPermissions?: string[];
  isOwner?: boolean;
}

export interface CenterOverviewResponse {
  center: CenterDashboardCenterItem;
  isOwner: boolean;
  stats: {
    activeTeachersCount: number;
    inactiveTeachersCount: number;
    totalStaffCount: number;
    studentsCount: number;
    coursesCount: number;
    publishedCoursesCount: number;
    totalEnrollments: number;
    branchesCount: number;
    activeBranchesCount: number;
    roomsCount: number;
    activeRoomsCount: number;
    attendanceRate: number;
    totalCollectedPayments: number;
  };
  recentEnrollments: Array<{
    id: number;
    courseId: number;
    studentUserId: number;
    status: string;
    enrolledAt: string;
    studentName: string;
    courseTitle: string;
  }>;
  recentCourses: Array<{
    id: number;
    title: string;
    status: string;
    enrollmentStatus: string;
    price: string;
    thumbnailUrl: string | null;
    instructorName: string;
    createdAt: string;
  }>;
  branches: CenterBranchItem[];
  teachersPreview: Array<{
    id: number;
    userId: number;
    memberRole: string;
    status: string;
    fullName: string;
    jobTitle: string;
  }>;
}

export interface CenterTeacherAssignmentItem {
  id: number;
  memberId: number;
  teacherUserId: number;
  subjectId: number;
  subjectNameAr: string;
  stageId: number;
  stageNameAr: string;
  systemId: number | null;
  systemNameAr: string | null;
  gradeId: number | null;
  gradeNameAr: string | null;
  divisionId: number | null;
  divisionNameAr: string | null;
  pathwayId: number | null;
  pathwayNameAr: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface CenterTeacherItem {
  id: number;
  centerId: number;
  userId: number;
  memberRole: string;
  jobTitle: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE';
  permissionsJson: string[];
  status: 'ACTIVE' | 'INACTIVE';
  notes: string | null;
  joinedAt: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountStatus: string;
  headline: string | null;
  yearsExperience: number | null;
  ratingAvg: string | null;
  coursesCount: number;
  studentsCount: number;
  courses: Array<{
    id: number;
    title: string;
    instructorUserId: number;
    status: string;
  }>;
  assignments: CenterTeacherAssignmentItem[];
}

export interface CenterStudentListItem {
  centerStudentId: number | null;
  studentUserId: number;
  fullName: string;
  email: string;
  phone: string;
  stageId: number | null;
  stageNameAr: string | null;
  gradeId: number | null;
  gradeNameAr: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: string;
  enrolledCourses: Array<{
    enrollmentId: number;
    courseId: number;
    courseTitle: string;
    status: string;
    completionPercent: number;
  }>;
  assignedTeachers: Array<{ id: number; fullName: string }>;
  attendanceSummary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  paymentsSummary: {
    totalPaid: number;
    totalPending: number;
    recordsCount: number;
    lastStatus: string | null;
  };
}

export interface CenterStudentDetailResponse {
  student: {
    studentUserId: number;
    fullName: string;
    email: string;
    phone: string;
    stageId: number | null;
    stageNameAr: string | null;
    gradeId: number | null;
    gradeNameAr: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    notes: string | null;
    status: string;
    joinedAt: string;
  };
  enrollments: Array<{
    enrollmentId: number;
    courseId: number;
    status: string;
    enrolledAt: string;
    completedAt: string | null;
    completionPercent: number | null;
    completedLessonsCount: number | null;
    totalLessonsCount: number | null;
    courseTitle: string;
    instructorName: string;
  }>;
  attendance: Array<{
    id: number;
    courseId: number | null;
    courseTitle: string | null;
    attendanceDate: string;
    status: string;
    notes: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: number;
    courseId: number | null;
    courseTitle: string | null;
    amount: string;
    currency: string;
    status: string;
    paymentMethod: string;
    referenceCode: string | null;
    notes: string | null;
    paidAt: string;
    createdAt: string;
  }>;
  platformPayments: Array<{
    id: number;
    entityId: number;
    amount: string;
    currency: string;
    status: string;
    paymentReference: string;
    createdAt: string;
  }>;
}

export interface ProviderCourseLessonItem {
  id?: number;
  moduleTitle?: string | null;
  title: string;
  content: string;
  durationMinutes: number;
  sortOrder?: number;
  isFreePreview: boolean;
}

export interface ProviderCourseItem {
  id: number;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  customFieldName?: string | null;
  fieldNameAr: string;
  targetAudience?: string | null;
  fieldId: number;
  subjectId: number | null;
  subjectNameAr?: string | null;
  stageId: number | null;
  stageNameAr?: string | null;
  systemId: number | null;
  gradeId: number | null;
  gradeNameAr?: string | null;
  divisionId: number | null;
  pathwayId: number | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language: string;
  price: string;
  currency: string;
  maxStudents: number | null;
  enrollmentStatus: 'OPEN' | 'PAUSED' | 'CLOSED';
  thumbnailUrl: string | null;
  coverImageKey: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
  centerId?: number | null;
  instructorId?: number;
  instructorName?: string;
  createdAt: string;
  updatedAt: string;
  lessons: ProviderCourseLessonItem[];
  lessonsCount: number;
  totalMinutes?: number;
  enrollmentsCount: number;
}

export interface CenterCourseLessonInput {
  id?: number;
  moduleTitle?: string | null;
  title: string;
  content: string;
  durationMinutes: number;
  sortOrder?: number;
  isFreePreview: boolean;
}

export interface CenterCourseItem {
  id: number;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  instructorUserId: number;
  instructorName: string;
  fieldId: number;
  customFieldName?: string | null;
  fieldNameAr: string;
  targetAudience?: string | null;
  subjectId: number | null;
  subjectNameAr: string | null;
  stageId: number | null;
  stageNameAr: string | null;
  systemId: number | null;
  gradeId: number | null;
  gradeNameAr: string | null;
  divisionId: number | null;
  pathwayId: number | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language: string;
  price: string;
  currency: string;
  maxStudents: number | null;
  enrollmentStatus: 'OPEN' | 'PAUSED' | 'CLOSED';
  thumbnailUrl: string | null;
  coverImageKey: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  lessons: CenterCourseLessonInput[];
  lessonsCount: number;
  enrollmentsCount: number;
  ratingAvg: number | null;
  reviewsCount: number;
  reviews: Array<{
    id: number;
    rating: number;
    comment: string;
    authorName: string;
    createdAt: string;
  }>;
}

export interface CenterBranchItem {
  id: number;
  centerId: number;
  name: string;
  city: string;
  address: string;
  phone: string | null;
  isMain: boolean;
  isActive: boolean;
}

export interface CenterRoomItem {
  id: number;
  centerId: number;
  branchId: number;
  branchName: string;
  name: string;
  roomNumber: string;
  capacity: number;
  equipmentNotes: string | null;
  isActive: boolean;
}

export interface CenterSettingsResponse {
  center: CenterDashboardCenterItem;
  isOwner: boolean;
  branches: CenterBranchItem[];
  rooms: CenterRoomItem[];
  staff: Array<{
    id: number;
    userId: number;
    fullName: string;
    email: string;
    memberRole: string;
    jobTitle: string;
    status: string;
    permissionsJson: string[];
  }>;
}

export interface PublicCenterTeacherItem {
  memberId: number;
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  memberRole: string;
  jobTitle: string;
  headline: string;
  bio: string;
  yearsExperience: number | null;
  verificationStatus: string;
  ratingAvg: number;
  reviewsCount: number;
  centerCoursesCount: number;
  subjects: Array<{ id: number; nameAr: string }>;
  stages: Array<{ id: number; nameAr: string }>;
  grades: Array<{ id: number; nameAr: string }>;
}

export interface PublicCenterCourseItem {
  id: number;
  title: string;
  subtitle: string;
  level: string;
  price: string;
  currency: string;
  thumbnailUrl: string | null;
  instructorId: number;
  instructorName: string;
  instructorAvatarUrl: string | null;
  fieldNameAr: string;
  subjectNameAr: string | null;
  stageNameAr: string | null;
  gradeNameAr: string | null;
  divisionNameAr: string | null;
  pathwayNameAr: string | null;
  centerName: string;
  lessonsCount: number;
  enrollmentsCount: number;
  maxStudents: number | null;
  enrollmentStatus: string;
  isEnrollmentAvailable: boolean;
  ratingAvg: number | null;
  reviewsCount: number;
}

export interface PublicCenterProfileResponse {
  center: {
    id: number;
    name: string;
    slug: string;
    description: string;
    governorate: string | null;
    city: string;
    country: string;
    street: string | null;
    buildingDetails: string | null;
    address: string | null;
    fullAddress: string;
    googleMapsUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    secondaryPhone: string | null;
    website: string | null;
    bannerUrl: string | null;
    logoUrl: string | null;
    verificationStatus: string;
    verificationLabelAr: string;
    workingHoursJson: CenterWorkingHourItem[];
    createdAt: string;
    canManage: boolean;
    stats: {
      teachersCount: number;
      activeMembersCount: number;
      coursesCount: number;
      totalEnrollments: number;
      branchesCount: number;
    };
  };
  branches: Array<{
    id: number;
    name: string;
    city: string;
    address: string;
    phone: string | null;
    isMain: boolean;
  }>;
  teachers: PublicCenterTeacherItem[];
  courses: PublicCenterCourseItem[];
}




