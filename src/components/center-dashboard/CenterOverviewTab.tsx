import { Link } from 'react-router-dom';
import {
  COURSE_ENROLLMENT_STATUS_LABELS_AR,
  COURSE_STATUS_LABELS_AR,
  type CenterOverviewResponse,
} from '../../lib/api';
import { SafeImage } from '../SafeImage';
import { StatCard } from '../ui/StatCard';

export type CenterDashboardTabKey =
  | 'overview'
  | 'teachers'
  | 'students'
  | 'courses'
  | 'settings';

interface CenterOverviewTabProps {
  overview: CenterOverviewResponse;
  onNavigateTab: (tab: CenterDashboardTabKey) => void;
}

export function CenterOverviewTab({
  overview,
  onNavigateTab,
}: CenterOverviewTabProps) {
  const { stats, recentEnrollments, recentCourses, branches, teachersPreview } =
    overview;

  return (
    <div className="space-y-5">
      {/* KPI Grid */}
      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-4">
          <StatCard
            icon="bi-person-workspace"
            accent="teal"
            label="المعلّمون النشطون"
            value={stats.activeTeachersCount}
            sublabel={
              stats.inactiveTeachersCount > 0
                ? `${stats.inactiveTeachersCount} غير نشط`
                : 'كامل الكادر نشط'
            }
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <StatCard
            icon="bi-people"
            accent="blue"
            label="الطلاب المسجّلون"
            value={stats.studentsCount}
            sublabel={`${stats.totalEnrollments} اشتراك دورة`}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <StatCard
            icon="bi-journal-bookmark"
            accent="navy"
            label="دورات المركز"
            value={stats.coursesCount}
            sublabel={`${stats.publishedCoursesCount} منشورة`}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <StatCard
            icon="bi-building"
            accent="blue"
            label="الفروع والقاعات"
            value={`${stats.activeBranchesCount} / ${stats.activeRoomsCount}`}
            sublabel="فرع نشط / قاعة مفعّلة"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <StatCard
            icon="bi-calendar-check"
            accent="teal"
            label="معدل الحضور"
            value={`${stats.attendanceRate}%`}
            sublabel="في سجلات المركز"
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-4">
          <StatCard
            icon="bi-cash-stack"
            accent="amber"
            label="المدفوعات المحصّلة"
            value={stats.totalCollectedPayments.toFixed(0)}
            sublabel="إجمالي سجلات الطلاب"
          />
        </div>
      </div>

      {/* Quick Actions Bar */}
      <section className="jusoor-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#102A43] m-0">
              إجراءات سريعة لإدارة المركز
            </h2>
            <p className="text-xs text-[#64748B] m-0 mt-1">
              انتقل مباشرة لإضافة معلّم جديد أو تسجيل طالب أو إطلاق دورة جديدة بغلاف احترافي.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('teachers')}
              className="btn-jusoor-outline px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <i className="bi bi-person-plus text-[#0F766E]" aria-hidden="true" />
              <span>إدارة المعلّمين</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('students')}
              className="btn-jusoor-outline px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <i className="bi bi-person-check text-[#247BA0]" aria-hidden="true" />
              <span>تسجيل وإدارة الطلاب</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('courses')}
              className="btn-jusoor-primary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <i className="bi bi-plus-circle" aria-hidden="true" />
              <span>إنشاء وإدارة الدورات</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="btn-jusoor-navy px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <i className="bi bi-sliders" aria-hidden="true" />
              <span>إعدادات المركز</span>
            </button>
          </div>
        </div>
      </section>

      <div className="row g-4">
        {/* Recent Courses */}
        <div className="col-12 col-lg-7">
          <div className="jusoor-card p-4 sm:p-5 h-full space-y-3.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EDF2F7]">
              <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                أحدث دورات المركز
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('courses')}
                className="text-xs font-bold text-[#247BA0] hover:underline cursor-pointer"
              >
                عرض الكل
              </button>
            </div>
            {recentCourses.length === 0 ? (
              <p className="text-xs text-[#64748B] m-0 py-4">
                لا توجد دورات مسجلة للمركز حتى الآن. ابدأ بإنشاء أول دورة من تبويب الدورات.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCourses.map((c) => (
                  <div
                    key={c.id}
                    className="jusoor-subcard p-3 flex items-center gap-3"
                  >
                    <div className="w-20 h-14 rounded-lg overflow-hidden border border-[#DCE5F0] bg-[#EEF4FA] shrink-0">
                      <SafeImage
                        src={c.thumbnailUrl}
                        alt={c.title}
                        fallbackTitle={c.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/courses/${c.id}`}
                        className="text-sm font-bold text-[#102A43] hover:text-[#247BA0] block truncate"
                      >
                        {c.title}
                      </Link>
                      <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-2 mt-0.5">
                        <span>المعلّم: {c.instructorName}</span>
                        <span>·</span>
                        <span>{COURSE_STATUS_LABELS_AR[c.status] || c.status}</span>
                        <span>·</span>
                        <span>
                          {COURSE_ENROLLMENT_STATUS_LABELS_AR[c.enrollmentStatus] ||
                            c.enrollmentStatus}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#0F766E] shrink-0">
                      {Number(c.price) === 0 ? 'مجانية' : c.price}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Enrollments & Branches */}
        <div className="col-12 col-lg-5 space-y-4">
          <div className="jusoor-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EDF2F7]">
              <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                أحدث اشتراكات الطلاب
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('students')}
                className="text-xs font-bold text-[#247BA0] hover:underline cursor-pointer"
              >
                سجل الطلاب
              </button>
            </div>
            {recentEnrollments.length === 0 ? (
              <p className="text-xs text-[#64748B] m-0 py-2">
                لا توجد اشتراكات دورات حديثة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {recentEnrollments.map((enr) => (
                  <div
                    key={enr.id}
                    className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#F1F5F9] last:border-none"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#102A43] truncate">
                        {enr.studentName}
                      </div>
                      <div className="text-[#64748B] truncate">{enr.courseTitle}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#0F766E] shrink-0">
                      {enr.status === 'COMPLETED' ? 'مكتمل' : 'نشط'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="jusoor-card p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EDF2F7]">
              <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                فروع المركز ({branches.length}) وكادر التدريس ({teachersPreview.length})
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="text-xs font-bold text-[#247BA0] hover:underline cursor-pointer"
              >
                إدارة الفروع
              </button>
            </div>
            {branches.length === 0 ? (
              <p className="text-xs text-[#64748B] m-0">
                لم يتم إضافة فروع بعد. يمكنك إضافة الفروع والقاعات من الإعدادات.
              </p>
            ) : (
              <div className="space-y-2">
                {branches.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="jusoor-subcard px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#102A43] truncate">
                        {b.name} {b.isMain ? '· (رئيسي)' : ''}
                      </div>
                      <div className="text-[#64748B] truncate">
                        {b.city} — {b.address}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        b.isActive ? 'text-[#0F766E]' : 'text-[#64748B]'
                      }`}
                    >
                      {b.isActive ? 'مفعّل' : 'متوقف'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
