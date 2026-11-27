import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { CourseCard, type CourseCardData } from '../components/ui/CourseCard';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { CourseEditorModal } from '../components/courses/CourseEditorModal';

interface CourseItem extends CourseCardData {
  status: string;
  enrollmentsCount: number;
}

export function CoursesPage() {
  const { user, taxonomy, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [fieldId, setFieldId] = useState('');
  const [level, setLevel] = useState('');
  const [priceType, setPriceType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const canCreateCourse =
    user &&
    user.roles.some((r) =>
      [
        'TEACHER',
        'MENTOR',
        'EXPERT',
        'CENTER_OWNER',
        'CENTER_STAFF',
        'ADMIN',
      ].includes(r)
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

  const handleQueryChange = (val: string) => {
    setQ(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div>
      <PageHeader
        kicker={isAr ? 'مكتبة الدورات التطبيقية' : 'Applied Courses Marketplace'}
        title={isAr ? 'سوق الدورات التدريبية' : 'Courses Marketplace'}
        subtitle={
          isAr
            ? 'ابحث حسب المجال أو المستوى أو السعر، وتابع تقدمك درساً بدرس مع اختبارات وتكليفات عملية.'
            : 'Filter by field, difficulty, or pricing, and track your lesson-by-lesson progress.'
        }
        actions={
          canCreateCourse ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              data-testid="courses-page-create-btn"
              className="btn-jusoor-primary px-4 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              <span>{isAr ? 'إضافة دورة جديدة' : 'Create Course'}</span>
            </button>
          ) : !user ? (
            <button
              type="button"
              onClick={openAuthModal}
              className="btn-jusoor-outline px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap cursor-pointer"
            >
              {isAr ? 'سجّل الدخول للتسجيل بالدورات' : 'Sign In to Enroll'}
            </button>
          ) : null
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
        {createMsg && (
          <div className="space-y-2">
            <StateBanner
              variant="success"
              message={createMsg}
              onDismiss={() => setCreateMsg(null)}
            />
            <div className="flex justify-end">
              <Link
                to="/dashboard"
                className="text-xs font-bold text-[#0F766E] hover:underline"
              >
                إدارة دوراتي في لوحة التحكم
              </Link>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div className="jusoor-card p-3 p-sm-4">
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="relative">
                <i
                  className="bi bi-search text-[#64748B] text-sm absolute start-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ابحث بعنوان الدورة أو المجال...'
                      : 'Search courses or fields...'
                  }
                  aria-label={
                    isAr ? 'ابحث بعنوان الدورة أو المجال' : 'Search courses'
                  }
                  className="jusoor-input w-full ps-9 pe-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                aria-label={isAr ? 'تصفية حسب المجال' : 'Filter by field'}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="">{isAr ? 'كل المجالات' : 'All Fields'}</option>
                {taxonomy?.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                aria-label={isAr ? 'تصفية حسب المستوى' : 'Filter by level'}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="">{isAr ? 'كل المستويات' : 'All Levels'}</option>
                <option value="BEGINNER">{isAr ? 'مبتدئ' : 'Beginner'}</option>
                <option value="INTERMEDIATE">
                  {isAr ? 'متوسط' : 'Intermediate'}
                </option>
                <option value="ADVANCED">{isAr ? 'متقدم' : 'Advanced'}</option>
              </select>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value)}
                aria-label={isAr ? 'تصفية حسب السعر' : 'Filter by price'}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="">
                  {isAr ? 'الكل (مجاني ومدفوع)' : 'All Pricing'}
                </option>
                <option value="free">{isAr ? 'مجانية فقط' : 'Free Only'}</option>
                <option value="paid">{isAr ? 'مدفوعة فقط' : 'Paid Only'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <LoadingSkeleton variant="cards" count={6} />
        ) : courses.length === 0 ? (
          <EmptyState
            icon="bi-book"
            title={
              isAr
                ? 'لا توجد دورات مطابقة لخيارات البحث الحالية'
                : 'No courses match your filters'
            }
            description={
              isAr
                ? 'جرّب إزالة الفلاتر أو البحث بكلمات أخرى.'
                : 'Try adjusting your search or clearing filters.'
            }
            action={
              (q || fieldId || level || priceType) && (
                <button
                  type="button"
                  onClick={() => {
                    handleQueryChange('');
                    setFieldId('');
                    setLevel('');
                    setPriceType('');
                  }}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
                >
                  {isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                </button>
              )
            }
          />
        ) : (
          <div className="row g-3 g-md-4">
            {courses.map((course) => (
              <div key={course.id} className="col-12 col-md-6 col-lg-4">
                <CourseCard course={course} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unified Course Editor Modal */}
      <CourseEditorModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={async (savedCourse) => {
          setCreateMsg(
            savedCourse.status === 'PUBLISHED'
              ? `تم نشر الدورة "${savedCourse.title}" بنجاح وهي متاحة الآن في سوق الدورات.`
              : `تم حفظ الدورة "${savedCourse.title}" كمسودة. يمكنك استكمالها أو نشرها لاحقاً من لوحة التحكم.`
          );
          await loadCourses();
        }}
      />
    </div>
  );
}
