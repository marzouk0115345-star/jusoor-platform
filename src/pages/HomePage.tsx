import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Briefcase, Compass, Building2, CheckCircle2 } from 'lucide-react';
import { apiFetch, LEVEL_LABELS_AR, TASK_STATUS_LABELS_AR } from '../lib/api';
import { SafeImage } from '../components/SafeImage';

interface CourseSummary {
  id: number;
  title: string;
  subtitle: string;
  level: string;
  price: string;
  thumbnailUrl: string | null;
  instructorId: number;
  instructorName: string;
  fieldNameAr: string;
  lessonsCount: number;
  ratingAvg: number;
}

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

export function HomePage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ courses: CourseSummary[] }>('/api/courses'),
      apiFetch<{ tasks: TaskSummary[] }>('/api/tasks'),
    ])
      .then(([cRes, tRes]) => {
        setCourses(cRes.courses.slice(0, 3));
        setTasks(tRes.tasks.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero Split */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="text-xs font-semibold text-teal-800">
                جسور تربطك بالتعلّم والفرص · من المعرفة إلى الفرص
              </div>
              <h1
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight"
                style={{ textWrap: 'balance' }}
              >
                لا نبيعك دورة جديدة دائماً؛ نشخّص عائقك الحقيقي ونصلك بالحل الأنسب.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                منصة جسور تجمع المتعلّمين بالمعلّمين والمرشدين والخبراء والمراكز التعليمية. تعلّم عبر الدورات التطبيقية، أو انشر مهمة تعليمية واستقبل عروض المعلّمين، أو احجز جلسة إرشاد عملي لمشاريع سوق العمل.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/tasks"
                  className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  انشر مهمة تعليمية الآن
                </Link>
                <Link
                  to="/courses"
                  className="px-6 py-3 bg-white border border-slate-300 hover:border-slate-400 text-slate-900 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  تصفح الدورات التدريبية
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-200">
                <SafeImage
                  src="/src/assets/images/hero_jusoor_learning_1795328020437.jpg"
                  alt="بيئة تعلّم وإرشاد تفاعلية في منصة جسور"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-column Strip Below Hero Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-10 border-t border-slate-200">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Briefcase className="w-4 h-4 text-teal-700 shrink-0" />
                <span>سوق المهام التعليمية</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                اشرح ما تعثّرت فيه، وقارن عروض المعلّمين بشفافية كاملة حتى التسليم.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Compass className="w-4 h-4 text-teal-700 shrink-0" />
                <span>إرشاد عملي ومشاريع حقيقية</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                جلسات تطبيقية تربط أساسياتك النظرية ببيئة عمل الشركات والفرق الهندسية.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <BookOpen className="w-4 h-4 text-teal-700 shrink-0" />
                <span>دورات واختبارات تقييمية</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                مسارات منظمة مع متابعة تقدم الدروس، التكليفات، والشهادات الموثّقة.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                <span>مراكز تدريب وملف مهني</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                أكاديميات معتمدة، منشئ سيرة ذاتية، ومعرض أعمال وجواز مهارات رقمي.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligent Solution Comparison Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-semibold text-teal-700">
              التشخيص الذكي للاحتياج الفعلي
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              تعرف HTML و CSS و JavaScript لكنك لا تستطيع العمل على مشاريع شركات؟
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              لن نقترح عليك دورة مبتدئين مكررة. في جسور نوجّهك إلى جلسة إرشاد عملي مع مرشد تقني أو مهمة مراجعة كود وبناء مشروع تطبيقي يحاكي بيئة العمل الفعلية.
            </p>
          </div>
          <Link
            to="/assistant"
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>افحص مسارك مع المستشار الذكي</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Open Educational Tasks Marketplace Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              أحدث المهام التعليمية المفتوحة
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              مهام منشورة من متعلّمين يبحثون عن شرح محدد أو توجيه عملي
            </p>
          </div>
          <Link
            to="/tasks"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 whitespace-nowrap"
          >
            <span>كل المهام</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-slate-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tasks.map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="bg-white border border-slate-200 hover:border-teal-600 rounded-xl p-5 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span>{task.fieldNameAr}</span>
                    <span aria-hidden="true">·</span>
                    <span>{TASK_STATUS_LABELS_AR[task.status] || task.status}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 leading-snug line-clamp-2">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-600">
                    بواسطة {task.studentName} · {task.expectedDuration}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono-num font-bold text-slate-900">
                    ${task.budget}
                  </span>
                  <span className="text-teal-700 font-medium tabular-nums">
                    {task.offersCount} عروض مقدّمة
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured Courses */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              دورات تطبيقية مختارة
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              مناهج متدرجة مع دروس مسجلة، اختبارات، وتكليفات عملية
            </p>
          </div>
          <Link
            to="/courses"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 whitespace-nowrap"
          >
            <span>تصفح الكل</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((course) => (
            <article
              key={course.id}
              className="bg-white border border-slate-200 hover:border-teal-600 rounded-xl overflow-hidden transition-colors flex flex-col"
            >
              <Link
                to={`/courses/${course.id}`}
                className="block aspect-[4/3] bg-slate-100"
              >
                <SafeImage
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fallbackTitle={course.title}
                  className="w-full h-full object-cover"
                />
              </Link>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span>{course.fieldNameAr}</span>
                    <span aria-hidden="true">·</span>
                    <span>{LEVEL_LABELS_AR[course.level] || course.level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{course.lessonsCount} دروس</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                    <Link
                      to={`/courses/${course.id}`}
                      className="hover:text-teal-700"
                    >
                      {course.title}
                    </Link>
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {course.subtitle}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link
                    to={`/instructors/${course.instructorId}`}
                    className="text-teal-800 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                    <span>{course.instructorName}</span>
                  </Link>
                  <span className="font-mono-num font-bold text-slate-900">
                    {Number(course.price) === 0 ? 'مجانية' : `$${course.price}`}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
