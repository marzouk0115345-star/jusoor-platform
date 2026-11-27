import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFetch,
  ROLE_LABELS_AR,
  TASK_STATUS_LABELS_AR,
  SESSION_TYPE_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  DELIVERY_MODE_LABELS_AR,
  COURSE_STATUS_LABELS_AR,
  LEVEL_LABELS_AR,
  formatSessionDateRange,
  formatCurrencyPrice,
  isOfflineDeliveryMode,
  type ProviderCourseItem,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TeacherSessionManager } from '../components/TeacherSessionManager';
import { SafeImage } from '../components/SafeImage';
import { CourseEditorModal } from '../components/courses/CourseEditorModal';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface DashboardPayload {
  enrollments: Array<{
    enrollmentId: number;
    courseId: number;
    courseTitle: string;
    status: string;
    completionPercent: number | null;
  }>;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    budget: string;
  }>;
  receivedOffers: Array<{
    id: number;
    taskId: number;
    teacherName: string;
    proposedPrice: string;
    status: string;
  }>;
  bookings: Array<{
    id: number;
    topic: string;
    scheduledStart: string;
    status: string;
  }>;
  lessonEnrollments: Array<{
    enrollmentId: number;
    sessionId: number;
    title: string;
    sessionType: 'ONE_TO_ONE' | 'GROUP';
    startTime: string;
    endTime: string;
    durationMinutes?: number;
    price?: string;
    currency?: string;
    deliveryMode: 'ONLINE' | 'IN_PERSON';
    location: string | null;
    isDemoLocation?: boolean;
    meetingUrl: string | null;
    sessionStatus: string;
    enrollmentStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
    notes?: string | null;
    teacherUserId?: number;
    teacherName: string;
    subjectNameAr?: string | null;
    gradeNameAr?: string | null;
    systemNameAr?: string | null;
  }>;
  teachingSessionsSummary?: {
    totalSessions: number;
    pendingRequests: number;
  };
  notifications: Array<{
    id: number;
    title: string;
    body: string;
    isRead: boolean;
    linkUrl: string | null;
  }>;
  certificates: Array<{
    id: number;
    title: string;
    credentialCode: string;
  }>;
  conversationsCount: number;
  providerStats: {
    coursesCount: number;
    offersSubmittedCount: number;
    totalNetEarnings: number;
  };
  providerCourses?: ProviderCourseItem[];
  recommendedOpportunities: Array<{
    id: number;
    title: string;
    subtitle: string;
    price: string;
    currency?: string;
    thumbnailUrl?: string | null;
    fieldNameAr?: string;
    instructorName?: string;
  }>;
}

type DashboardSection =
  | 'overview'
  | 'manage-courses'
  | 'my-sessions'
  | 'manage-sessions'
  | 'courses-tasks'
  | 'consultations'
  | 'notifications';

export function DashboardPage() {
  const { user, openAuthModal, logout, locale } = useAuth();
  const isAr = locale === 'ar';
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<ProviderCourseItem | null>(
    null
  );
  const [courseStatusFilter, setCourseStatusFilter] = useState<
    'ALL' | 'PUBLISHED' | 'DRAFT'
  >('ALL');
  const [togglingCourseId, setTogglingCourseId] = useState<number | null>(null);
  const [lessonFilter, setLessonFilter] = useState<
    | 'ALL'
    | 'INDIVIDUAL'
    | 'ACCEPTED_1ON1'
    | 'PENDING'
    | 'REJECTED'
    | 'ONLINE_GROUP'
    | 'OFFLINE_GROUP'
    | 'UPCOMING'
    | 'COMPLETED'
    | 'CANCELLED'
  >('ALL');

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch<DashboardPayload>('/api/dashboard');
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleCancelLessonEnrollment = async (enrollmentId: number) => {
    setActionMsg(null);
    try {
      await apiFetch(`/api/session-enrollments/${enrollmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setActionMsg('تم إلغاء طلب الجلسة وتحديث المقاعد.');
      await loadDashboard();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'تعذر إلغاء الحجز.');
    }
  };

  const handleQuickToggleCourseStatus = async (
    course: ProviderCourseItem,
    nextStatus: 'PUBLISHED' | 'DRAFT'
  ) => {
    setActionMsg(null);
    setTogglingCourseId(course.id);
    try {
      await apiFetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setActionMsg(
        nextStatus === 'PUBLISHED'
          ? `تم نشر الدورة "${course.title}" وأصبحت متاحة في سوق الدورات.`
          : `تم تحويل الدورة "${course.title}" إلى مسودة.`
      );
      await loadDashboard();
    } catch (err) {
      setActionMsg(
        err instanceof Error ? err.message : 'تعذر تحديث حالة نشر الدورة.'
      );
    } finally {
      setTogglingCourseId(null);
    }
  };

  if (!user) {
    return (
      <div>
        <PageHeader
          title={isAr ? 'لوحة التحكم الشخصية' : 'Personal Workspace'}
          subtitle={
            isAr
              ? 'يرجى تسجيل الدخول للوصول إلى دوراتك ومهامك وحجوزاتك ورسائلك.'
              : 'Sign in to access your courses, tasks, session bookings, and messages.'
          }
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-speedometer2"
            title={isAr ? 'مساحة العمل تتطلب تسجيل الدخول' : 'Sign in required'}
            description={
              isAr
                ? 'سجّل الدخول بحسابك أو جرّب أحد حسابات العرض الفورية لمتابعة الجلسات والدورات.'
                : 'Sign in with your account or switch to a demo persona to explore the workspace.'
            }
            action={
              <button
                type="button"
                onClick={openAuthModal}
                className="btn-jusoor-primary px-5 py-2.5 text-sm cursor-pointer"
              >
                {isAr ? 'تسجيل الدخول الآن' : 'Sign In Now'}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const isAdmin = user.roles.includes('ADMIN');
  const isCenterManager = user.roles.some((r) =>
    ['CENTER_OWNER', 'CENTER_STAFF', 'ADMIN'].includes(r)
  );
  const isProvider = user.roles.some((r) =>
    ['TEACHER', 'MENTOR', 'EXPERT'].includes(r)
  );

  const lessonEnrollments = data?.lessonEnrollments ?? [];
  const confirmedUpcomingLessons = lessonEnrollments.filter(
    (l) =>
      l.enrollmentStatus === 'ACCEPTED' &&
      l.sessionStatus !== 'CANCELLED' &&
      l.sessionStatus !== 'COMPLETED'
  );
  const filteredLessonEnrollments = lessonEnrollments.filter((l) => {
    const nowMs = Date.now();
    const isOffline = isOfflineDeliveryMode(l.deliveryMode);
    switch (lessonFilter) {
      case 'INDIVIDUAL':
        return l.sessionType === 'ONE_TO_ONE';
      case 'ACCEPTED_1ON1':
        return l.sessionType === 'ONE_TO_ONE' && l.enrollmentStatus === 'ACCEPTED';
      case 'PENDING':
        return l.enrollmentStatus === 'PENDING';
      case 'REJECTED':
        return l.enrollmentStatus === 'REJECTED';
      case 'ONLINE_GROUP':
        return l.sessionType === 'GROUP' && !isOffline;
      case 'OFFLINE_GROUP':
        return l.sessionType === 'GROUP' && isOffline;
      case 'UPCOMING':
        return (
          l.sessionStatus !== 'CANCELLED' &&
          l.sessionStatus !== 'COMPLETED' &&
          l.enrollmentStatus !== 'REJECTED' &&
          l.enrollmentStatus !== 'CANCELLED' &&
          new Date(l.endTime).getTime() >= nowMs
        );
      case 'COMPLETED':
        return l.sessionStatus === 'COMPLETED';
      case 'CANCELLED':
        return (
          l.sessionStatus === 'CANCELLED' || l.enrollmentStatus === 'CANCELLED'
        );
      case 'ALL':
      default:
        return true;
    }
  });

  const providerCourses = data?.providerCourses ?? [];
  const filteredProviderCourses = providerCourses.filter((c) => {
    if (courseStatusFilter === 'ALL') return true;
    return c.status === courseStatusFilter;
  });

  const navItems: Array<{
    key: DashboardSection;
    label: string;
    icon: string;
    badge?: number;
  }> = [
    { key: 'overview', label: isAr ? 'نظرة عامة' : 'Overview', icon: 'bi-grid' },
    ...(isProvider || isAdmin
      ? [
          {
            key: 'manage-courses' as const,
            label: isAr ? 'إدارة دوراتي' : 'My Courses',
            icon: 'bi-journal-plus',
            badge: providerCourses.length,
          },
          {
            key: 'manage-sessions' as const,
            label: isAr ? 'إدارة الجلسات' : 'Manage Sessions',
            icon: 'bi-easel',
            badge: data?.teachingSessionsSummary?.pendingRequests ?? 0,
          },
        ]
      : []),
    {
      key: 'my-sessions',
      label: isAr ? 'جلساتي الفردية والجماعية' : 'My Sessions',
      icon: 'bi-calendar-event',
      badge: lessonEnrollments.length,
    },
    {
      key: 'courses-tasks',
      label: isAr ? 'الدورات والمهام' : 'Courses & Tasks',
      icon: 'bi-journal-bookmark',
      badge: (data?.enrollments.length ?? 0) + (data?.tasks.length ?? 0),
    },
    {
      key: 'consultations',
      label: isAr ? 'الاستشارات والشهادات' : 'Consultations & Certs',
      icon: 'bi-award',
    },
    {
      key: 'notifications',
      label: isAr ? 'الإشعارات' : 'Notifications',
      icon: 'bi-bell',
      badge: data?.notifications.filter((n) => !n.isRead).length ?? 0,
    },
  ];

  const showManageCourses =
    (isProvider || isAdmin) &&
    (activeSection === 'overview' || activeSection === 'manage-courses');
  const showMySessions =
    activeSection === 'overview' || activeSection === 'my-sessions';
  const showManageSessions =
    (isProvider || isAdmin) &&
    (activeSection === 'overview' || activeSection === 'manage-sessions');
  const showCoursesTasks =
    activeSection === 'overview' || activeSection === 'courses-tasks';
  const showConsultations =
    activeSection === 'overview' || activeSection === 'consultations';
  const showNotifications =
    activeSection === 'overview' || activeSection === 'notifications';

  return (
    <div>
      <PageHeader
        kicker={`${user.roles.map((r) => ROLE_LABELS_AR[r] || r).join(' · ')}${
          user.isDemo ? (isAr ? ' · حساب عرض تجريبي' : ' · Demo Account') : ''
        }`}
        title={isAr ? `مرحباً، ${user.fullName}` : `Welcome, ${user.fullName}`}
        subtitle={user.email}
        actions={
          <>
            <Link
              to="/messages"
              className="btn-jusoor-outline px-3 py-2 text-xs inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <i className="bi bi-chat-dots text-[#247BA0]" aria-hidden="true" />
              <span>
                {isAr ? 'الرسائل' : 'Messages'} ({data?.conversationsCount ?? 0})
              </span>
            </Link>
            <Link
              to="/profile"
              className="btn-jusoor-outline px-3 py-2 text-xs inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <i className="bi bi-person-vcard text-[#0F766E]" aria-hidden="true" />
              <span>{isAr ? 'الملف المهني والسيرة' : 'Profile & CV'}</span>
            </Link>
            {isCenterManager && (
              <Link
                to="/center-dashboard"
                className="btn-jusoor-primary px-3 py-2 text-xs inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="bi bi-building-gear" aria-hidden="true" />
                <span>{isAr ? 'لوحة إدارة المركز' : 'Center Dashboard'}</span>
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="btn-jusoor-navy px-3 py-2 text-xs inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="bi bi-shield-lock" aria-hidden="true" />
                <span>{isAr ? 'إدارة المنصة' : 'Admin'}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 border border-[#FECACA] text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FEE2E2] rounded-[0.625rem] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
            </button>
          </>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-4">
        {actionMsg && (
          <StateBanner
            variant="info"
            message={actionMsg}
            onDismiss={() => setActionMsg(null)}
          />
        )}

        {/* Mobile Horizontal Tab Switcher */}
        <div className="d-lg-none jusoor-tabs flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveSection(item.key)}
              className={`jusoor-tab-btn px-3 py-1.5 text-xs whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                activeSection === item.key ? 'is-active' : ''
              }`}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="font-mono-num text-[11px] opacity-80">
                  ({item.badge})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="row g-4">
          {/* Desktop Sidebar */}
          <aside className="d-none d-lg-block col-lg-3">
            <div className="jusoor-card p-3 space-y-1 sticky top-20">
              <div className="px-2.5 py-1.5 text-[11px] font-bold text-[#64748B]">
                {isAr ? 'أقسام لوحة التحكم' : 'Workspace Sections'}
              </div>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`jusoor-sidebar-nav-btn ${
                    activeSection === item.key ? 'is-active' : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0 truncate">
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="font-mono-num text-[11px] opacity-80 shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* Workspace Main Column */}
          <div className="col-12 col-lg-9 space-y-5">
            {loading && !data ? (
              <LoadingSkeleton variant="kpis" count={4} />
            ) : data ? (
              <>
                {/* KPI Strip */}
                {activeSection === 'overview' && (
                  <div className="row g-3">
                    <div className="col-6 col-xl-3">
                      <StatCard
                        label={isAr ? 'الدورات المسجلة' : 'Enrolled Courses'}
                        value={data.enrollments.length}
                        icon="bi-journal-bookmark"
                        accent="navy"
                      />
                    </div>
                    <div className="col-6 col-xl-3">
                      <StatCard
                        label={isAr ? 'المهام والعروض' : 'Tasks & Offers'}
                        value={`${data.tasks.length} / ${data.receivedOffers.length}`}
                        icon="bi-briefcase"
                        accent="blue"
                      />
                    </div>
                    <div className="col-6 col-xl-3">
                      <StatCard
                        label={isAr ? 'الجلسات المباشرة' : 'Live Sessions'}
                        value={
                          isProvider
                            ? data.teachingSessionsSummary?.totalSessions ?? 0
                            : confirmedUpcomingLessons.length
                        }
                        icon="bi-calendar-check"
                        accent="teal"
                      />
                    </div>
                    <div className="col-6 col-xl-3">
                      <StatCard
                        label={
                          isProvider
                            ? isAr
                              ? 'صافي الأرباح المسجلة'
                              : 'Net Earnings'
                            : isAr
                            ? 'الشهادات المكتسبة'
                            : 'Certificates'
                        }
                        value={
                          isProvider
                            ? `$${data.providerStats.totalNetEarnings}`
                            : data.certificates.length
                        }
                        icon={isProvider ? 'bi-wallet2' : 'bi-award'}
                        accent="amber"
                      />
                    </div>
                  </div>
                )}

                {/* Provider Courses Management (Teachers, Mentors, Experts, Admins) */}
                {showManageCourses && (
                  <section
                    className="jusoor-card p-4 p-sm-5 space-y-4"
                    data-testid="provider-courses-manager"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                          <i
                            className="bi bi-journal-richtext text-[#0F766E]"
                            aria-hidden="true"
                          />
                          <span>
                            إدارة دوراتي التدريبية ({providerCourses.length})
                          </span>
                        </h2>
                        <p className="text-xs text-[#64748B] m-0 mt-0.5">
                          أنشئ دوراتك مع رفع الغلاف المخصص، وتحديد المجال يدوياً، وإضافة وإعادة ترتيب الدروس أو حفظها كمسودات.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingCourse(null);
                          setCourseModalOpen(true);
                        }}
                        data-testid="dashboard-create-course-btn"
                        className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="bi bi-plus-lg" aria-hidden="true" />
                        <span>إنشاء دورة جديدة</span>
                      </button>
                    </div>

                    {providerCourses.length > 0 && (
                      <div className="jusoor-tabs flex flex-wrap items-center gap-1">
                        {[
                          {
                            code: 'ALL' as const,
                            label: `الكل (${providerCourses.length})`,
                          },
                          {
                            code: 'PUBLISHED' as const,
                            label: `منشورة (${
                              providerCourses.filter(
                                (c) => c.status === 'PUBLISHED'
                              ).length
                            })`,
                          },
                          {
                            code: 'DRAFT' as const,
                            label: `مسودات (${
                              providerCourses.filter((c) => c.status === 'DRAFT')
                                .length
                            })`,
                          },
                        ].map((tab) => (
                          <button
                            key={tab.code}
                            type="button"
                            onClick={() => setCourseStatusFilter(tab.code)}
                            className={`jusoor-tab-btn px-3 py-1 text-xs cursor-pointer ${
                              courseStatusFilter === tab.code ? 'is-active' : ''
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {providerCourses.length === 0 ? (
                      <EmptyState
                        icon="bi-journal-plus"
                        title="لم تنشئ أي دورة تدريبية بعد"
                        description="ابدأ ببناء دورتك الأولى مع صورة غلاف مخصصة ومجال تعليمي ودروس متكاملة."
                        action={
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCourse(null);
                              setCourseModalOpen(true);
                            }}
                            className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
                          >
                            + إنشاء أول دورة
                          </button>
                        }
                      />
                    ) : filteredProviderCourses.length === 0 ? (
                      <p className="text-xs text-[#64748B] py-3 text-center m-0">
                        لا توجد دورات في هذا التصنيف حالياً.
                      </p>
                    ) : (
                      <div className="row g-3">
                        {filteredProviderCourses.map((course) => (
                          <div key={course.id} className="col-12 col-md-6">
                            <article
                              data-testid={`provider-course-card-${course.id}`}
                              className="jusoor-subcard p-3.5 h-full flex flex-col justify-between gap-3 bg-white"
                            >
                              <div className="flex gap-3 items-start">
                                <div className="w-24 aspect-[16/10] rounded-lg overflow-hidden border border-[#DCE5F0] bg-[#EEF4FA] shrink-0">
                                  <SafeImage
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    fallbackTitle={course.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span
                                      className={`px-2 py-0.5 rounded font-bold ${
                                        course.status === 'PUBLISHED'
                                          ? 'bg-[#E8F8F5] text-[#0F766E]'
                                          : 'bg-[#FFFBEB] text-[#B45309]'
                                      }`}
                                    >
                                      {COURSE_STATUS_LABELS_AR[course.status] ||
                                        course.status}
                                    </span>
                                    <span className="font-semibold text-[#247BA0] truncate">
                                      {course.fieldNameAr}
                                    </span>
                                  </div>
                                  <h3 className="font-display text-sm font-bold text-[#102A43] m-0 line-clamp-2">
                                    {course.title}
                                  </h3>
                                  <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-2">
                                    <span>
                                      {LEVEL_LABELS_AR[course.level] ||
                                        course.level}
                                    </span>
                                    <span>·</span>
                                    <span className="font-mono-num">
                                      {course.lessonsCount} دروس
                                    </span>
                                    <span>·</span>
                                    <span className="font-mono-num">
                                      {course.enrollmentsCount} مسجّل
                                    </span>
                                    <span>·</span>
                                    <span className="font-mono-num font-bold text-[#102A43]">
                                      {formatCurrencyPrice(
                                        course.price,
                                        course.currency || 'EGP'
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EDF2F7]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCourse(course);
                                    setCourseModalOpen(true);
                                  }}
                                  data-testid={`edit-provider-course-${course.id}`}
                                  className="btn-jusoor-primary px-3 py-1.5 text-xs cursor-pointer"
                                >
                                  تعديل الدورة والدروس
                                </button>

                                {course.status !== 'PUBLISHED' ? (
                                  <button
                                    type="button"
                                    disabled={togglingCourseId === course.id}
                                    onClick={() =>
                                      void handleQuickToggleCourseStatus(
                                        course,
                                        'PUBLISHED'
                                      )
                                    }
                                    className="btn-jusoor-outline px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                                  >
                                    {togglingCourseId === course.id
                                      ? 'جارٍ النشر...'
                                      : 'نشر الآن'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={togglingCourseId === course.id}
                                    onClick={() =>
                                      void handleQuickToggleCourseStatus(
                                        course,
                                        'DRAFT'
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-[#DCE5F0] text-[#64748B] hover:bg-[#F8FBFF] text-xs font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    إرجاع لمسودة
                                  </button>
                                )}

                                <Link
                                  to={`/courses/${course.id}`}
                                  className="btn-jusoor-outline px-3 py-1.5 text-xs ms-auto"
                                >
                                  معاينة
                                </Link>
                              </div>
                            </article>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Teacher Session Manager */}
                {showManageSessions && (
                  <TeacherSessionManager onChanged={loadDashboard} />
                )}

                {/* Student Individual & Group Session Bookings */}
                {showMySessions && (
                  <section
                    className="jusoor-card p-4 p-sm-5 space-y-4"
                    data-testid="student-lesson-enrollments"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                        <i className="bi bi-calendar-event text-[#247BA0]" aria-hidden="true" />
                        <span>
                          جلساتي الفردية والجماعية ({lessonEnrollments.length})
                        </span>
                      </h2>
                      <Link
                        to="/providers"
                        className="text-xs font-semibold text-[#0F766E] hover:underline"
                      >
                        تصفح الجلسات المتاحة للحجز
                      </Link>
                    </div>

                    {lessonEnrollments.length > 0 && (
                      <div
                        className="jusoor-tabs flex flex-wrap items-center gap-1"
                        role="tablist"
                        aria-label="تصفية جلساتي"
                      >
                        {[
                          { code: 'ALL' as const, label: 'الكل' },
                          { code: 'INDIVIDUAL' as const, label: 'طلبات فردية' },
                          { code: 'ACCEPTED_1ON1' as const, label: 'فردية مقبولة' },
                          { code: 'PENDING' as const, label: 'قيد الانتظار' },
                          { code: 'REJECTED' as const, label: 'مرفوضة' },
                          { code: 'ONLINE_GROUP' as const, label: 'مجموعات أونلاين' },
                          { code: 'OFFLINE_GROUP' as const, label: 'مجموعات أوفلاين' },
                          { code: 'UPCOMING' as const, label: 'القادمة' },
                          { code: 'COMPLETED' as const, label: 'المكتملة' },
                          { code: 'CANCELLED' as const, label: 'الملغاة' },
                        ].map((f) => (
                          <button
                            key={f.code}
                            type="button"
                            role="tab"
                            aria-selected={lessonFilter === f.code}
                            onClick={() => setLessonFilter(f.code)}
                            className={`jusoor-tab-btn px-2.5 py-1 text-xs whitespace-nowrap cursor-pointer ${
                              lessonFilter === f.code ? 'is-active' : ''
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {lessonEnrollments.length === 0 ? (
                      <p className="text-sm text-[#64748B] m-0">
                        لم ترسل طلبات حجز لجلسات فردية أو جماعية بعد.
                      </p>
                    ) : filteredLessonEnrollments.length === 0 ? (
                      <p className="text-sm text-[#64748B] py-4 text-center m-0">
                        لا توجد جلسات ضمن هذا التصنيف.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#EDF2F7]">
                        {filteredLessonEnrollments.map((item) => {
                          const canCancel =
                            (item.enrollmentStatus === 'PENDING' ||
                              item.enrollmentStatus === 'ACCEPTED') &&
                            item.sessionStatus !== 'CANCELLED' &&
                            item.sessionStatus !== 'COMPLETED' &&
                            Date.now() < new Date(item.startTime).getTime();
                          const isOffline = isOfflineDeliveryMode(item.deliveryMode);

                          return (
                            <div
                              key={item.enrollmentId}
                              data-testid={`student-lesson-row-${item.enrollmentId}`}
                              className="py-3.5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                            >
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-bold text-[#102A43]">
                                    {SESSION_TYPE_LABELS_AR[item.sessionType] ||
                                      item.sessionType}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`font-bold ${
                                      item.enrollmentStatus === 'ACCEPTED'
                                        ? 'text-[#0F766E]'
                                        : item.enrollmentStatus === 'PENDING'
                                        ? 'text-[#B45309]'
                                        : 'text-[#64748B]'
                                    }`}
                                  >
                                    {ENROLLMENT_STATUS_LABELS_AR[item.enrollmentStatus] ||
                                      item.enrollmentStatus}
                                  </span>
                                  {(item.subjectNameAr || item.gradeNameAr) && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-[#247BA0] font-semibold">
                                        {[
                                          item.subjectNameAr,
                                          item.gradeNameAr,
                                          item.systemNameAr,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </span>
                                    </>
                                  )}
                                  {item.price !== undefined && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono-num font-bold text-[#102A43]">
                                        {formatCurrencyPrice(
                                          item.price,
                                          item.currency || 'EGP'
                                        )}
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="text-sm font-bold text-[#102A43]">
                                  {item.title}
                                </div>

                                <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-3">
                                  <span>
                                    المعلّم:{' '}
                                    {item.teacherUserId ? (
                                      <Link
                                        to={`/instructors/${item.teacherUserId}`}
                                        className="font-semibold text-[#0F766E] hover:underline"
                                      >
                                        {item.teacherName}
                                      </Link>
                                    ) : (
                                      item.teacherName
                                    )}
                                  </span>
                                  <span className="font-mono-num">
                                    {formatSessionDateRange(item.startTime, item.endTime)}
                                    {item.durationMinutes
                                      ? ` (${item.durationMinutes} د)`
                                      : ''}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <i
                                      className={`bi ${
                                        !isOffline
                                          ? 'bi-camera-video text-[#247BA0]'
                                          : 'bi-geo-alt text-[#0F766E]'
                                      }`}
                                      aria-hidden="true"
                                    />
                                    {DELIVERY_MODE_LABELS_AR[item.deliveryMode] ||
                                      item.deliveryMode}
                                  </span>
                                </div>

                                {isOffline && item.location && (
                                  <div className="text-xs text-[#172B4D] font-medium flex items-center gap-1">
                                    <i
                                      className="bi bi-geo-alt-fill text-[#0F766E] shrink-0"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      العنوان: {item.location}
                                      {item.isDemoLocation &&
                                      !item.location.includes('موقع عرض تجريبي')
                                        ? ' (موقع عرض تجريبي)'
                                        : ''}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {item.enrollmentStatus === 'ACCEPTED' &&
                                  !isOffline &&
                                  item.meetingUrl && (
                                    <a
                                      href={item.meetingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-jusoor-primary px-3 py-1.5 text-xs"
                                    >
                                      دخول الجلسة
                                    </a>
                                  )}
                                {canCancel && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCancelLessonEnrollment(item.enrollmentId)
                                    }
                                    className="px-3 py-1.5 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2] text-xs font-semibold rounded-[0.625rem] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="bi bi-x-circle" aria-hidden="true" />
                                    <span>إلغاء</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* Courses, Tasks, Notifications, Bookings, Certificates */}
                {(showCoursesTasks || showConsultations || showNotifications) && (
                  <div className="row g-4">
                    {showCoursesTasks && (
                      <div
                        className={
                          activeSection === 'courses-tasks'
                            ? 'col-12'
                            : 'col-12 col-xl-7'
                        }
                      >
                        <div className="jusoor-card p-4 p-sm-5 space-y-4 h-full">
                          <div className="flex items-center justify-between">
                            <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                              <i className="bi bi-journal-bookmark text-[#247BA0]" aria-hidden="true" />
                              <span>دوراتي وتقدم التعلّم</span>
                            </h2>
                            <Link
                              to="/courses"
                              className="text-xs font-semibold text-[#0F766E] hover:underline"
                            >
                              استكشف المزيد
                            </Link>
                          </div>

                          {data.enrollments.length === 0 ? (
                            <p className="text-sm text-[#64748B] m-0">
                              لم تسجل في أي دورة بعد.
                            </p>
                          ) : (
                            <div className="divide-y divide-[#EDF2F7]">
                              {data.enrollments.map((enr) => (
                                <Link
                                  key={enr.enrollmentId}
                                  to={`/courses/${enr.courseId}`}
                                  className="py-3 flex items-center justify-between gap-4 hover:bg-[#F5F8FC] px-2 rounded-lg transition-colors"
                                >
                                  <span className="text-sm font-semibold text-[#102A43]">
                                    {enr.courseTitle}
                                  </span>
                                  <span className="text-xs font-mono-num text-[#0F766E] font-bold shrink-0">
                                    {enr.completionPercent ?? 0}%
                                  </span>
                                </Link>
                              ))}
                            </div>
                          )}

                          <div className="pt-4 border-t border-[#DCE5F0] space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="font-display text-base font-bold text-[#102A43] flex items-center gap-2 m-0">
                                <i className="bi bi-briefcase text-[#247BA0]" aria-hidden="true" />
                                <span>مهامي التعليمية</span>
                              </h3>
                              <Link
                                to="/tasks"
                                className="text-xs font-semibold text-[#0F766E] hover:underline"
                              >
                                سوق المهام
                              </Link>
                            </div>
                            {data.tasks.length === 0 ? (
                              <p className="text-xs text-[#64748B] m-0">
                                لم تنشر مهام تعليمية بعد.
                              </p>
                            ) : (
                              <div className="divide-y divide-[#EDF2F7]">
                                {data.tasks.map((t) => (
                                  <Link
                                    key={t.id}
                                    to={`/tasks/${t.id}`}
                                    className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#F5F8FC] px-2 rounded-lg transition-colors"
                                  >
                                    <span className="text-xs font-semibold text-[#172B4D] truncate">
                                      {t.title}
                                    </span>
                                    <span className="text-xs font-semibold text-[#0F766E] shrink-0">
                                      {TASK_STATUS_LABELS_AR[t.status] || t.status}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {(showNotifications || showConsultations) && (
                      <div
                        className={
                          activeSection === 'notifications' ||
                          activeSection === 'consultations'
                            ? 'col-12 space-y-4'
                            : 'col-12 col-xl-5 space-y-4'
                        }
                      >
                        {showNotifications && (
                          <div className="jusoor-card p-4 p-sm-5 space-y-3">
                            <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                              <i className="bi bi-bell text-[#247BA0]" aria-hidden="true" />
                              <span>أحدث الإشعارات</span>
                            </h2>
                            {data.notifications.length === 0 ? (
                              <p className="text-xs text-[#64748B] m-0">
                                لا توجد إشعارات.
                              </p>
                            ) : (
                              <div className="divide-y divide-[#EDF2F7]">
                                {data.notifications.slice(0, 5).map((n) => (
                                  <div key={n.id} className="py-2.5 space-y-0.5">
                                    <div className="text-xs font-bold text-[#102A43]">
                                      {n.title}
                                    </div>
                                    <p className="text-xs text-[#64748B] m-0">
                                      {n.body}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {showConsultations && (
                          <>
                            <div className="jusoor-card p-4 p-sm-5 space-y-3">
                              <h2 className="font-display text-base font-bold text-[#102A43] flex items-center gap-2 m-0">
                                <i className="bi bi-calendar3 text-[#247BA0]" aria-hidden="true" />
                                <span>مواعيد الاستشارات المباشرة</span>
                              </h2>
                              {data.bookings.length === 0 ? (
                                <p className="text-xs text-[#64748B] m-0">
                                  لا توجد حجوزات استشارات.
                                </p>
                              ) : (
                                <div className="divide-y divide-[#EDF2F7] text-xs">
                                  {data.bookings.slice(0, 4).map((b) => (
                                    <div
                                      key={b.id}
                                      className="py-2 flex justify-between gap-2"
                                    >
                                      <span className="font-medium text-[#172B4D] truncate">
                                        {b.topic}
                                      </span>
                                      <span className="font-mono-num text-[#64748B] shrink-0">
                                        {b.scheduledStart}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {data.certificates.length > 0 && (
                              <div className="jusoor-card p-4 p-sm-5 space-y-2">
                                <h2 className="font-display text-base font-bold text-[#102A43] flex items-center gap-2 m-0">
                                  <i className="bi bi-award text-[#0F766E]" aria-hidden="true" />
                                  <span>الشهادات</span>
                                </h2>
                                {data.certificates.map((c) => (
                                  <div
                                    key={c.id}
                                    className="text-xs text-[#172B4D] flex justify-between gap-2 py-1"
                                  >
                                    <span className="truncate">{c.title}</span>
                                    <span className="font-mono-num text-[#64748B]">
                                      {c.credentialCode}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <CourseEditorModal
        open={courseModalOpen}
        initialCourse={editingCourse}
        onClose={() => {
          setCourseModalOpen(false);
          setEditingCourse(null);
        }}
        onSaved={async (savedCourse) => {
          setActionMsg(
            savedCourse.status === 'PUBLISHED'
              ? `تم حفظ ونشر الدورة "${savedCourse.title}" بنجاح.`
              : `تم حفظ الدورة "${savedCourse.title}" كمسودة.`
          );
          await loadDashboard();
        }}
      />
    </div>
  );
}
