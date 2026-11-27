import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  apiFetch,
  TASK_STATUS_LABELS_AR,
  SESSION_TYPE_LABELS_AR,
  DELIVERY_MODE_LABELS_AR,
  formatSessionDateRange,
  formatCurrencyPrice,
  isOfflineDeliveryMode,
  type CurriculumOverviewResponse,
  type TeachingSessionItem,
  type TeachingSessionsPagedResponse,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { CourseCard, type CourseCardData } from '../components/ui/CourseCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface TaskSummary {
  id: number;
  title: string;
  fieldNameAr: string;
  categoryNameAr: string;
  budget: string;
  expectedDuration: string;
  status: string;
  offersCount: number;
  studentName: string;
}

interface ProviderSummary {
  userId: number;
  fullName: string;
  providerType: string;
  headline: string;
  jobTitle?: string | null;
  ratingAvg: string;
  reviewsCount: number;
  hourlyRate: string;
  currency?: string;
  verificationStatus: string;
  openSessionsCount?: number;
}

const PROVIDER_TYPE_AR: Record<string, string> = {
  TEACHER: 'معلّم',
  MENTOR: 'مرشد مهني',
  EXPERT: 'خبير ومستشار',
};

export function HomePage() {
  const { locale, openAuthModal, user } = useAuth();
  const isAr = locale === 'ar';
  const navigate = useNavigate();

  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [sessions, setSessions] = useState<TeachingSessionItem[]>([]);
  const [overview, setOverview] = useState<CurriculumOverviewResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchTarget, setSearchTarget] = useState<'courses' | 'providers'>(
    'courses'
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ courses: CourseCardData[] }>('/api/courses').catch(() => ({
        courses: [],
      })),
      apiFetch<{ tasks: TaskSummary[] }>('/api/tasks').catch(() => ({
        tasks: [],
      })),
      apiFetch<{ providers: ProviderSummary[] }>('/api/providers').catch(() => ({
        providers: [],
      })),
      apiFetch<TeachingSessionsPagedResponse>(
        '/api/teaching-sessions?limit=6'
      ).catch(() => ({ sessions: [], total: 0, page: 1, totalPages: 0 })),
      apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview').catch(
        () => null
      ),
    ])
      .then(([cRes, tRes, pRes, sRes, ovRes]) => {
        if (!active) return;
        setCourses(cRes.courses.slice(0, 3));
        setTasks(tRes.tasks.slice(0, 3));
        setProviders(pRes.providers.slice(0, 4));
        setSessions(sRes.sessions.slice(0, 6));
        setOverview(ovRes);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchTerm.trim();
    const targetPath = searchTarget === 'courses' ? '/courses' : '/providers';
    navigate(
      trimmed ? `${targetPath}?q=${encodeURIComponent(trimmed)}` : targetPath
    );
  };

  return (
    <div>
      {/* 1. Hero Section */}
      <section className="jusoor-hero-section">
        <div className="container-xxl px-3 px-sm-4 py-5">
          <div className="row g-4 g-lg-5 align-items-center">
            <div className="col-12 col-lg-6 space-y-4">
              <div className="text-xs font-bold text-[#0F766E] flex items-center gap-2">
                <i className="bi bi-compass" aria-hidden="true" />
                <span>
                  {isAr
                    ? 'جسور تربطك بالتعلّم والفرص · من المعرفة إلى الفرص'
                    : 'JUSOOR Education Marketplace · From Knowledge to Opportunity'}
                </span>
              </div>

              <h1
                className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#102A43] leading-tight m-0"
                style={{ textWrap: 'balance' }}
              >
                {isAr
                  ? 'لا نبيعك دورة جديدة دائماً؛ نشخّص عائقك الحقيقي ونصلك بالحل الأنسب.'
                  : 'Connect with verified teachers, Egyptian curricula, and practical mentorship.'}
              </h1>

              <p className="text-sm sm:text-base text-[#64748B] leading-relaxed m-0 max-w-xl">
                {isAr
                  ? 'منصة جسور تجمع طلاب المراحل التعليمية المصرية بالمعلمين المتخصصين، الدورات التطبيقية، سوق المهام التعليمية، والمراكز المعتمدة في مكان واحد.'
                  : 'Explore Egyptian General Education stages, book 1:1 or group sessions, post learning tasks, and learn with accredited centers.'}
              </p>

              {/* Integrated Hero Search */}
              <form
                onSubmit={handleHeroSearch}
                className="jusoor-card p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl"
              >
                <div className="relative flex-1">
                  <i
                    className="bi bi-search text-[#64748B] text-sm absolute start-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                      isAr
                        ? 'ابحث عن دورة، مادة دراسية، أو معلّم...'
                        : 'Search courses, subjects, or teachers...'
                    }
                    aria-label={isAr ? 'بحث في المنصة' : 'Search platform'}
                    className="w-full ps-9 pe-3 py-2 text-sm border-0 bg-transparent text-[#172B4D] focus:outline-none"
                  />
                </div>
                <select
                  value={searchTarget}
                  onChange={(e) =>
                    setSearchTarget(e.target.value as 'courses' | 'providers')
                  }
                  aria-label={isAr ? 'نطاق البحث' : 'Search target'}
                  className="jusoor-select px-3 py-2 text-xs font-semibold"
                >
                  <option value="courses">{isAr ? 'الدورات' : 'Courses'}</option>
                  <option value="providers">
                    {isAr ? 'المعلّمون' : 'Teachers'}
                  </option>
                </select>
                <button
                  type="submit"
                  className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'بحث' : 'Search'}
                </button>
              </form>

              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 pt-1">
                <Link
                  to="/educational-stages"
                  className="btn-jusoor-navy px-5 py-2.5 text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="bi bi-mortarboard" aria-hidden="true" />
                  <span>
                    {isAr ? 'استكشف المراحل والمناهج' : 'Explore Stages'}
                  </span>
                </Link>
                <Link
                  to="/tasks"
                  className="btn-jusoor-outline px-5 py-2.5 text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="bi bi-briefcase" aria-hidden="true" />
                  <span>
                    {isAr ? 'انشر مهمة تعليمية' : 'Post Learning Task'}
                  </span>
                </Link>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="jusoor-card overflow-hidden aspect-[4/3] lg:aspect-[16/11]">
                <SafeImage
                  src="/src/assets/images/hero_jusoor_learning_1795328020437.jpg"
                  alt="بيئة تعلّم وإرشاد تفاعلية في منصة جسور"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Pillar Capability Strip */}
          <div className="row g-3 mt-4 pt-4 border-t border-[#DCE5F0]">
            {[
              {
                icon: 'bi-layers',
                title: isAr ? 'المراحل والمناهج المصرية' : 'Egyptian Stages',
                desc: isAr
                  ? 'ابتدائي، إعدادي، ثانوي عام، وبكالوريا مصرية حسب كل صف وشعبة.'
                  : 'Primary, Preparatory, General Secondary, and Egyptian Baccalaureate.',
              },
              {
                icon: 'bi-calendar2-check',
                title: isAr ? 'حجز جلسات 1:1 وجماعية' : '1:1 & Group Booking',
                desc: isAr
                  ? 'مواعيد فردية وجماعية أونلاين وحضورية بمقاعد محدثة لحظياً.'
                  : 'Online and in-person slots with real-time seat tracking.',
              },
              {
                icon: 'bi-briefcase',
                title: isAr ? 'سوق المهام التعليمية' : 'Learning Tasks Market',
                desc: isAr
                  ? 'اشرح ما تعثّرت فيه وقارن عروض المعلّمين بشفافية حتى التسليم.'
                  : 'Post your hurdle and compare transparent teacher proposals.',
              },
              {
                icon: 'bi-building-check',
                title: isAr ? 'مراكز ودورات تطبيقية' : 'Centers & Courses',
                desc: isAr
                  ? 'أكاديميات معتمدة، دورات منظمة باختبارات، وجواز مهارات رقمي.'
                  : 'Accredited centers, structured courses, quizzes, and certificates.',
              },
            ].map((item) => (
              <div key={item.title} className="col-12 col-sm-6 col-lg-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#102A43]">
                    <i
                      className={`bi ${item.icon} text-[#0F766E]`}
                      aria-hidden="true"
                    />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed m-0">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Egyptian Educational Stages Preview */}
      {overview && overview.stages.length > 0 && (
        <section className="container-xxl px-3 px-sm-4 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
                {isAr
                  ? 'المراحل والأنظمة التعليمية المصرية'
                  : 'Egyptian Educational Stages & Systems'}
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
                {isAr
                  ? 'اختر مرحلتك للوصول المباشر إلى المواد الرسمية والمعلّمين المتخصصين.'
                  : 'Select your stage to browse official curriculum subjects and assigned teachers.'}
              </p>
            </div>
            <Link
              to="/educational-stages"
              className="text-xs sm:text-sm font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>{isAr ? 'استعراض جميع الصفوف' : 'Explore All Grades'}</span>
              <i
                className={`bi ${isAr ? 'bi-arrow-left' : 'bi-arrow-right'}`}
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="row g-3 g-md-4">
            {overview.stages.map((stage) => {
              const stageSystems = overview.systems.filter(
                (s) => s.stageId === stage.id
              );
              const stageGrades = overview.grades.filter(
                (g) => g.stageId === stage.id
              );
              return (
                <div key={stage.id} className="col-12 col-md-4">
                  <Link
                    to="/educational-stages"
                    className="jusoor-card jusoor-card-interactive p-4 sm:p-5 h-full flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-[#0F766E] font-semibold">
                        <span>
                          {stageSystems
                            .map((s) => (isAr ? s.nameAr : s.nameEn))
                            .join(' · ')}
                        </span>
                        <i
                          className="bi bi-mortarboard-fill text-base"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                        {isAr ? stage.nameAr : stage.nameEn}
                      </h3>
                      <p className="text-xs text-[#64748B] m-0 leading-relaxed">
                        {stageGrades
                          .slice(0, 6)
                          .map((g) => (isAr ? g.nameAr : g.nameEn))
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between text-xs font-semibold text-[#247BA0]">
                      <span className="tabular-nums">
                        {stageGrades.length}{' '}
                        {isAr ? 'صفوف دراسية' : 'grade levels'}
                      </span>
                      <span>{isAr ? 'تصفح المواد' : 'Browse Subjects'}</span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Live Available Sessions */}
      {sessions.length > 0 && (
        <section className="container-xxl px-3 px-sm-4 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
                {isAr
                  ? 'جلسات فردية وجماعية متاحة للحجز'
                  : 'Upcoming 1:1 & Group Sessions'}
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
                {isAr
                  ? 'مواعيد مفتوحة للحجز المباشر أونلاين وحضوري عبر المنصة.'
                  : 'Live upcoming individual and group sessions open for enrollment.'}
              </p>
            </div>
            <Link
              to="/providers"
              className="text-xs sm:text-sm font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>{isAr ? 'كل الجلسات المتاحة' : 'All Sessions'}</span>
              <i
                className={`bi ${isAr ? 'bi-arrow-left' : 'bi-arrow-right'}`}
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="row g-3 g-md-4">
            {sessions.map((s) => {
              const isOffline = isOfflineDeliveryMode(s.deliveryMode);
              return (
                <div key={s.id} className="col-12 col-md-6 col-lg-4">
                  <div className="jusoor-card jusoor-card-interactive p-4 h-full flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#247BA0]">
                          {SESSION_TYPE_LABELS_AR[s.sessionType]} ·{' '}
                          {DELIVERY_MODE_LABELS_AR[s.deliveryMode]}
                        </span>
                        <span className="font-mono-num font-bold text-[#102A43]">
                          {formatCurrencyPrice(
                            s.price,
                            s.currency,
                            isAr ? 'ar' : 'en'
                          )}
                        </span>
                      </div>

                      <h3 className="font-display text-base font-bold text-[#102A43] leading-snug m-0 line-clamp-2">
                        {s.title}
                      </h3>

                      {(s.subjectNameAr || s.gradeNameAr) && (
                        <div className="text-xs text-[#0F766E] font-medium">
                          {[s.subjectNameAr, s.gradeNameAr]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}

                      <div className="text-xs text-[#64748B] space-y-1 pt-1">
                        <div className="font-mono-num flex items-center gap-1.5">
                          <i className="bi bi-clock text-[#0F766E]" aria-hidden="true" />
                          <span>{formatSessionDateRange(s.startTime, s.endTime)}</span>
                        </div>
                        {isOffline && s.location && (
                          <div className="flex items-center gap-1.5 truncate">
                            <i className="bi bi-geo-alt text-[#0F766E]" aria-hidden="true" />
                            <span className="truncate">{s.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between gap-2 text-xs">
                      <Link
                        to={`/instructors/${s.teacherUserId}`}
                        className="font-semibold text-[#102A43] hover:text-[#247BA0] truncate"
                      >
                        {s.teacherName}
                      </Link>
                      <Link
                        to={`/instructors/${s.teacherUserId}`}
                        className="font-bold text-[#0F766E] hover:underline whitespace-nowrap shrink-0"
                      >
                        {isAr
                          ? `متبقي ${s.remainingSeats} مقاعد`
                          : `${s.remainingSeats} left`}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Featured Teachers & Mentors */}
      {providers.length > 0 && (
        <section className="container-xxl px-3 px-sm-4 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
                {isAr
                  ? 'نخبة المعلّمين والمرشدين المعتمدين'
                  : 'Featured Teachers & Mentors'}
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
                {isAr
                  ? 'اطّلع على التخصصات والتقييمات وساعات التفرغ واحجز مباشرة.'
                  : 'Browse specializations, ratings, and open sessions.'}
              </p>
            </div>
            <Link
              to="/providers"
              className="text-xs sm:text-sm font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>{isAr ? 'دليل المعلّمين' : 'Browse Directory'}</span>
              <i
                className={`bi ${isAr ? 'bi-arrow-left' : 'bi-arrow-right'}`}
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="row g-3 g-md-4">
            {providers.map((p) => (
              <div key={p.userId} className="col-12 col-sm-6 col-lg-3">
                <Link
                  to={`/instructors/${p.userId}`}
                  className="jusoor-card jusoor-card-interactive p-4 h-full flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#247BA0] font-semibold">
                        {PROVIDER_TYPE_AR[p.providerType] || p.providerType}
                      </span>
                      <span className="font-mono-num text-[#B45309] font-bold inline-flex items-center gap-1">
                        <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                        {p.ratingAvg}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                      {p.fullName}
                    </h3>
                    <p className="text-xs text-[#64748B] line-clamp-2 m-0">
                      {p.jobTitle || p.headline}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#EDF2F7] flex items-center justify-between text-xs">
                    <span className="font-mono-num font-bold text-[#102A43]">
                      {formatCurrencyPrice(
                        p.hourlyRate,
                        p.currency || 'USD',
                        isAr ? 'ar' : 'en'
                      )}
                    </span>
                    <span className="text-[#0F766E] font-semibold">
                      {isAr ? 'عرض الملف' : 'View Profile'}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Featured Courses */}
      <section className="container-xxl px-3 px-sm-4 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
              {isAr ? 'دورات تطبيقية مختارة' : 'Featured Courses'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
              {isAr
                ? 'مناهج متدرجة مع دروس مسجلة، اختبارات، وتكليفات عملية.'
                : 'Structured curricula with video lessons, quizzes, and assignments.'}
            </p>
          </div>
          <Link
            to="/courses"
            className="text-xs sm:text-sm font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>{isAr ? 'تصفح كل الدورات' : 'Browse All Courses'}</span>
            <i
              className={`bi ${isAr ? 'bi-arrow-left' : 'bi-arrow-right'}`}
              aria-hidden="true"
            />
          </Link>
        </div>

        {loading ? (
          <LoadingSkeleton variant="cards" count={3} />
        ) : (
          <div className="row g-3 g-md-4">
            {courses.map((course) => (
              <div key={course.id} className="col-12 col-md-4">
                <CourseCard course={course} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. Open Educational Tasks Preview */}
      <section className="container-xxl px-3 px-sm-4 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
              {isAr
                ? 'أحدث المهام التعليمية المفتوحة'
                : 'Open Learning Tasks'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
              {isAr
                ? 'مهام منشورة من متعلّمين يبحثون عن شرح محدد أو توجيه عملي.'
                : 'Live learning hurdles posted by students seeking targeted guidance.'}
            </p>
          </div>
          <Link
            to="/tasks"
            className="text-xs sm:text-sm font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>{isAr ? 'كل المهام' : 'All Tasks'}</span>
            <i
              className={`bi ${isAr ? 'bi-arrow-left' : 'bi-arrow-right'}`}
              aria-hidden="true"
            />
          </Link>
        </div>

        {loading ? (
          <LoadingSkeleton variant="cards" count={3} />
        ) : (
          <div className="row g-3 g-md-4">
            {tasks.map((task) => (
              <div key={task.id} className="col-12 col-md-4">
                <Link
                  to={`/tasks/${task.id}`}
                  className="jusoor-card jusoor-card-interactive p-4 sm:p-5 h-full flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="text-xs text-[#64748B] flex items-center gap-1.5">
                      <span>{task.fieldNameAr}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#0F766E] font-semibold">
                        {TASK_STATUS_LABELS_AR[task.status] || task.status}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#102A43] leading-snug line-clamp-2 m-0">
                      {task.title}
                    </h3>
                    <p className="text-xs text-[#64748B] m-0">
                      {isAr ? 'بواسطة' : 'By'} {task.studentName} ·{' '}
                      {task.expectedDuration}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-[#EDF2F7] flex items-center justify-between text-xs">
                    <span className="font-mono-num font-bold text-[#102A43]">
                      ${task.budget}
                    </span>
                    <span className="text-[#247BA0] font-semibold tabular-nums">
                      {task.offersCount} {isAr ? 'عروض مقدّمة' : 'offers'}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. How JUSOOR Works (01-04) + Bottom CTA Band */}
      <section className="container-xxl px-3 px-sm-4 pb-5 space-y-5">
        <div className="jusoor-card p-4 sm:p-5">
          <div className="mb-4">
            <div className="text-xs font-bold text-[#0F766E]">
              {isAr ? 'كيف تعمل المنصة؟' : 'How JUSOOR Works'}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0 mt-1">
              {isAr
                ? 'أربع خطوات واضحة من التشخيص إلى الإتقان'
                : 'Four clear steps from diagnosis to mastery'}
            </h2>
          </div>
          <div className="row g-3 g-md-4">
            {[
              {
                num: '01',
                title: isAr ? 'حدّد مرحلتك أو هدفك' : 'Pick Stage or Goal',
                desc: isAr
                  ? 'اختر الصف الدراسي والمادة، أو صف العائق التعليمي الذي تواجهه.'
                  : 'Select your grade & subject, or describe your specific hurdle.',
              },
              {
                num: '02',
                title: isAr ? 'قارن المعلّمين والعروض' : 'Compare Options',
                desc: isAr
                  ? 'اطّلع على تقييمات المدرّبين ولغات الشرح والمواعيد والأسعار.'
                  : 'Review verified teachers, languages, schedules, and transparent rates.',
              },
              {
                num: '03',
                title: isAr ? 'احجز وتفاعل مباشرة' : 'Book & Learn Live',
                desc: isAr
                  ? 'احضر جلسات فردية 1:1 أو جماعية أونلاين وحضوري وتواصل مع المعلّم.'
                  : 'Attend 1:1 or group sessions online or in-person with live messaging.',
              },
              {
                num: '04',
                title: isAr ? 'تابع التقدّم والشهادات' : 'Track Progress',
                desc: isAr
                  ? 'أكمل الاختبارات والتكليفات واحفظ إنجازاتك في ملفك المهني.'
                  : 'Complete quizzes and assignments to build your verified profile.',
              },
            ].map((step) => (
              <div key={step.num} className="col-12 col-sm-6 col-lg-3">
                <div className="jusoor-subcard p-4 h-full space-y-2">
                  <div className="font-mono-num text-lg font-extrabold text-[#20B8A6]">
                    {step.num}
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#102A43] m-0">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed m-0">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="jusoor-cta-band p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-bold text-[#20B8A6]">
              {isAr ? 'ابدأ رحلتك اليوم' : 'Start Learning Today'}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white m-0">
              {isAr
                ? 'هل تحتاج خطة مذاكرة مخصصة أو ترغب في التدريس على جسور؟'
                : 'Ready to get a custom study roadmap or teach on JUSOOR?'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 m-0 leading-relaxed">
              {isAr
                ? 'استعن بالمستشار الذكي لتشخيص احتياجك، أو سجّل كطالب أو معلّم وابدأ فوراً.'
                : 'Use the Smart Advisor to diagnose your learning needs or create your account in seconds.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/assistant"
              className="btn-jusoor-accent px-5 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap"
            >
              <i className="bi bi-stars" aria-hidden="true" />
              <span>{isAr ? 'افحص مسارك الآن' : 'Smart Advisor'}</span>
            </Link>
            {!user && (
              <button
                type="button"
                onClick={openAuthModal}
                className="px-5 py-2.5 rounded-lg border border-white/30 text-white hover:bg-white/10 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                {isAr ? 'إنشاء حساب مجاني' : 'Create Free Account'}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
