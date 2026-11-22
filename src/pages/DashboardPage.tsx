import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Briefcase,
  Calendar,
  MessageSquare,
  UserCheck,
  Shield,
  Award,
  LogOut,
  Bell,
  Video,
  MapPin,
  XCircle,
} from 'lucide-react';
import {
  apiFetch,
  ROLE_LABELS_AR,
  TASK_STATUS_LABELS_AR,
  SESSION_TYPE_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  formatSessionDateRange,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TeacherSessionManager } from '../components/TeacherSessionManager';

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
    deliveryMode: 'ONLINE' | 'IN_PERSON';
    location: string | null;
    meetingUrl: string | null;
    sessionStatus: string;
    enrollmentStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
    teacherName: string;
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
  recommendedOpportunities: Array<{
    id: number;
    title: string;
    subtitle: string;
    price: string;
  }>;
}

export function DashboardPage() {
  const { user, openAuthModal, logout } = useAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          لوحة التحكم الشخصية
        </h1>
        <p className="text-sm text-slate-600">
          يرجى تسجيل الدخول للوصول إلى دوراتك ومهامك وحجوزاتك ورسائلك.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          تسجيل الدخول الآن
        </button>
      </div>
    );
  }

  const isAdmin = user.roles.includes('ADMIN');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Workspace Header + Quick Links */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            {user.roles.map((r) => ROLE_LABELS_AR[r] || r).join(' · ')}
            {user.isDemo && ' · حساب عرض تجريبي'}
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            مرحباً، {user.fullName}
          </h1>
          <p className="text-xs text-slate-600">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/messages"
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4 text-teal-700" />
            <span>الرسائل ({data?.conversationsCount ?? 0})</span>
          </Link>
          <Link
            to="/profile"
            className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4 text-teal-700" />
            <span>الملف المهني والسيرة الذاتية</span>
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              <span>إدارة المنصة</span>
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs sm:text-sm text-teal-900">
          {actionMsg}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="text-xs text-slate-500">الدورات المسجلة</div>
              <div className="font-mono-num text-2xl font-extrabold text-slate-900">
                {data.enrollments.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="text-xs text-slate-500">المهام والعروض</div>
              <div className="font-mono-num text-2xl font-extrabold text-slate-900">
                {data.tasks.length} / {data.receivedOffers.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="text-xs text-slate-500">الجلسات الفردية والجماعية</div>
              <div className="font-mono-num text-2xl font-extrabold text-slate-900">
                {isProvider
                  ? data.teachingSessionsSummary?.totalSessions ?? 0
                  : confirmedUpcomingLessons.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <div className="text-xs text-slate-500">
                {isProvider ? 'صافي الأرباح المسجلة' : 'الشهادات المكتسبة'}
              </div>
              <div className="font-mono-num text-2xl font-extrabold text-teal-700">
                {isProvider
                  ? `$${data.providerStats.totalNetEarnings}`
                  : data.certificates.length}
              </div>
            </div>
          </div>

          {/* Teacher Session Manager (for teachers/mentors/experts/admins) */}
          {(isProvider || isAdmin) && (
            <TeacherSessionManager onChanged={loadDashboard} />
          )}

          {/* Student Individual & Group Session Bookings */}
          <div
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            data-testid="student-lesson-enrollments"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-700" />
                <span>جلساتي الفردية والجماعية ({lessonEnrollments.length})</span>
              </h2>
              <Link
                to="/providers"
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                تصفح الجلسات المتاحة للحجز
              </Link>
            </div>

            {lessonEnrollments.length === 0 ? (
              <p className="text-sm text-slate-500">
                لم ترسل طلبات حجز لجلسات فردية أو جماعية بعد.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {lessonEnrollments.map((item) => {
                  const canCancel =
                    (item.enrollmentStatus === 'PENDING' ||
                      item.enrollmentStatus === 'ACCEPTED') &&
                    item.sessionStatus !== 'CANCELLED' &&
                    item.sessionStatus !== 'COMPLETED' &&
                    Date.now() < new Date(item.startTime).getTime();

                  return (
                    <div
                      key={item.enrollmentId}
                      className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-900">
                            {SESSION_TYPE_LABELS_AR[item.sessionType] ||
                              item.sessionType}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              item.enrollmentStatus === 'ACCEPTED'
                                ? 'text-emerald-700'
                                : item.enrollmentStatus === 'PENDING'
                                ? 'text-amber-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {ENROLLMENT_STATUS_LABELS_AR[item.enrollmentStatus] ||
                              item.enrollmentStatus}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-slate-900">
                          {item.title}
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                          <span>المدرّب: {item.teacherName}</span>
                          <span className="font-mono-num">
                            {formatSessionDateRange(item.startTime, item.endTime)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            {item.deliveryMode === 'ONLINE' ? (
                              <Video className="w-3.5 h-3.5 text-teal-700" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-teal-700" />
                            )}
                            {item.deliveryMode === 'ONLINE'
                              ? 'عن بُعد'
                              : item.location || 'حضوري'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {item.enrollmentStatus === 'ACCEPTED' &&
                          item.meetingUrl && (
                            <a
                              href={item.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
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
                            className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Enrolled Courses & Progress */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-700" />
                  <span>دوراتي وتقدم التعلّم</span>
                </h2>
                <Link
                  to="/courses"
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  استكشف المزيد
                </Link>
              </div>
              {data.enrollments.length === 0 ? (
                <p className="text-sm text-slate-500">
                  لم تسجل في أي دورة بعد.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.enrollments.map((enr) => (
                    <Link
                      key={enr.enrollmentId}
                      to={`/courses/${enr.courseId}`}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-lg"
                    >
                      <span className="text-sm font-semibold text-slate-900">
                        {enr.courseTitle}
                      </span>
                      <span className="text-xs font-mono-num text-teal-700 font-bold shrink-0">
                        {enr.completionPercent ?? 0}%
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* My Published Tasks */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-700" />
                    <span>مهامي التعليمية</span>
                  </h3>
                  <Link
                    to="/tasks"
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    سوق المهام
                  </Link>
                </div>
                {data.tasks.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    لم تنشر مهام تعليمية بعد.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.tasks.map((t) => (
                      <Link
                        key={t.id}
                        to={`/tasks/${t.id}`}
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-lg"
                      >
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {t.title}
                        </span>
                        <span className="text-xs text-teal-700 shrink-0">
                          {TASK_STATUS_LABELS_AR[t.status] || t.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notifications, Bookings & Certificates */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-teal-700" />
                  <span>أحدث الإشعارات</span>
                </h2>
                {data.notifications.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد إشعارات.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.notifications.slice(0, 5).map((n) => (
                      <div key={n.id} className="py-2.5 space-y-0.5">
                        <div className="text-xs font-bold text-slate-900">
                          {n.title}
                        </div>
                        <p className="text-xs text-slate-600">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <span>مواعيد الاستشارات المباشرة</span>
                </h2>
                {data.bookings.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد حجوزات استشارات.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {data.bookings.slice(0, 4).map((b) => (
                      <div key={b.id} className="py-2 flex justify-between gap-2">
                        <span className="font-medium text-slate-800 truncate">
                          {b.topic}
                        </span>
                        <span className="font-mono-num text-slate-500 shrink-0">
                          {b.scheduledStart}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {data.certificates.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
                  <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-teal-700" />
                    <span>الشهادات</span>
                  </h2>
                  {data.certificates.map((c) => (
                    <div
                      key={c.id}
                      className="text-xs text-slate-700 flex justify-between gap-2 py-1"
                    >
                      <span className="truncate">{c.title}</span>
                      <span className="font-mono-num text-slate-500">
                        {c.credentialCode}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
