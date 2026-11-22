import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, X, BookOpen } from 'lucide-react';
import { apiFetch, LEVEL_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';

interface CourseItem {
  id: number;
  title: string;
  subtitle: string;
  level: string;
  price: string;
  status: string;
  thumbnailUrl: string | null;
  instructorId: number;
  instructorName: string;
  fieldNameAr: string;
  centerName: string | null;
  lessonsCount: number;
  enrollmentsCount: number;
  ratingAvg: number;
}

export function CoursesPage() {
  const { user, taxonomy, openAuthModal } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [level, setLevel] = useState('');
  const [priceType, setPriceType] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create Course form state
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newFieldId, setNewFieldId] = useState('');
  const [newLevel, setNewLevel] = useState('BEGINNER');
  const [newPrice, setNewPrice] = useState('0');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canCreateCourse =
    user &&
    user.roles.some((r) =>
      ['TEACHER', 'MENTOR', 'EXPERT', 'CENTER_OWNER', 'CENTER_STAFF', 'ADMIN'].includes(r)
    );

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (fieldId) params.set('fieldId', fieldId);
      if (level) params.set('level', level);
      if (priceType) params.set('priceType', priceType);
      const res = await apiFetch<{ courses: CourseItem[] }>(
        `/api/courses?${params.toString()}`
      );
      setCourses(res.courses);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [q, fieldId, level, priceType]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/courses', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          subtitle: newSubtitle,
          description: newDesc,
          fieldId: Number(newFieldId || taxonomy?.fields[0]?.id || 1),
          level: newLevel,
          price: Number(newPrice || 0),
          status: 'PUBLISHED',
          lessons: [
            {
              title: lessonTitle,
              content: lessonContent,
              durationMinutes: 25,
              isFreePreview: true,
            },
          ],
        }),
      });
      setShowCreate(false);
      setNewTitle('');
      setNewSubtitle('');
      setNewDesc('');
      setLessonTitle('');
      setLessonContent('');
      await loadCourses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر إنشاء الدورة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            سوق الدورات التدريبية
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            ابحث حسب المجال أو المستوى أو السعر، وتابع تقدمك درساً بدرس.
          </p>
        </div>

        {canCreateCourse ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة دورة جديدة</span>
          </button>
        ) : (
          !user && (
            <button
              type="button"
              onClick={openAuthModal}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-800 text-sm font-semibold rounded-lg whitespace-nowrap cursor-pointer self-start"
            >
              سجّل الدخول للتسجيل بالدورات
            </button>
          )
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن دورة..."
            aria-label="ابحث عن دورة"
            className="w-full pr-9 pl-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>
        <select
          value={fieldId}
          onChange={(e) => setFieldId(e.target.value)}
          aria-label="تصفية حسب المجال"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
        >
          <option value="">كل المجالات</option>
          {taxonomy?.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nameAr}
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          aria-label="تصفية حسب المستوى"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
        >
          <option value="">كل المستويات</option>
          <option value="BEGINNER">مبتدئ</option>
          <option value="INTERMEDIATE">متوسط</option>
          <option value="ADVANCED">متقدم</option>
        </select>
        <select
          value={priceType}
          onChange={(e) => setPriceType(e.target.value)}
          aria-label="تصفية حسب السعر"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
        >
          <option value="">الكل (مجاني ومدفوع)</option>
          <option value="free">مجانية فقط</option>
          <option value="paid">مدفوعة فقط</option>
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse"
            />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="font-semibold text-slate-900">
            لا توجد دورات مطابقة لخيارات البحث الحالية
          </div>
          <p className="text-xs text-slate-500">
            جرّب إزالة الفلاتر أو البحث بكلمات أخرى.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <h2 className="font-display text-base font-bold text-slate-900 leading-snug">
                    <Link
                      to={`/courses/${course.id}`}
                      className="hover:text-teal-700"
                    >
                      {course.title}
                    </Link>
                  </h2>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {course.subtitle}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="text-slate-700 min-w-0 truncate">
                    <Link
                      to={`/instructors/${course.instructorId}`}
                      className="font-semibold text-teal-800 hover:underline"
                    >
                      {course.instructorName}
                    </Link>
                    {course.centerName && (
                      <span className="text-slate-500"> · {course.centerName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono-num font-bold text-slate-900">
                      {Number(course.price) === 0 ? 'مجانية' : `$${course.price}`}
                    </span>
                    <Link
                      to={`/courses/${course.id}`}
                      className="text-teal-700 font-semibold hover:underline"
                    >
                      التفاصيل
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-course-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2
                id="create-course-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                إنشاء دورة تدريبية جديدة
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="إغلاق"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  عنوان الدورة
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  عنوان فرعي مختصر
                </label>
                <input
                  type="text"
                  required
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  الوصف الكامل
                </label>
                <textarea
                  required
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المجال
                  </label>
                  <select
                    value={newFieldId}
                    onChange={(e) => setNewFieldId(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {taxonomy?.fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المستوى
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="BEGINNER">مبتدئ</option>
                    <option value="INTERMEDIATE">متوسط</option>
                    <option value="ADVANCED">متقدم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    السعر (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="text-xs font-semibold text-slate-800">
                  الدرس الأول في المنهج
                </div>
                <input
                  type="text"
                  required
                  placeholder="عنوان الدرس الأول"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="محتوى الدرس..."
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'جارٍ الحفظ...' : 'نشر الدورة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
