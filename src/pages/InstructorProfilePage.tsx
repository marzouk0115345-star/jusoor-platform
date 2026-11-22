import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  GraduationCap,
  Star,
  UserCheck,
  Briefcase,
} from 'lucide-react';
import { apiFetch, LANGUAGE_OF_INSTRUCTION_LABELS, LEVEL_LABELS_AR } from '../lib/api';
import { SafeImage } from '../components/SafeImage';
import { TeacherSessionsBookingSection } from '../components/TeacherSessionsBookingSection';
import { useAuth } from '../context/AuthContext';

interface InstructorPublicResponse {
  instructor: {
    id: number;
    fullName: string;
    avatarUrl: string | null;
    providerType: string;
    headline: string;
    jobTitle: string;
    bio: string;
    qualifications: string | null;
    yearsExperience: number | null;
    verificationStatus: string;
    ratingAvg: string;
    reviewsCount: number;
    fields: string[];
    centerAffiliations: Array<{
      centerId: number;
      centerName: string;
      jobTitle: string;
      memberRole: string;
    }>;
    teachingAssignments?: Array<{
      id: number;
      curriculumSubjectId: number;
      subjectId: number;
      subjectNameAr: string;
      subjectNameEn: string;
      gradeId: number;
      gradeNameAr: string;
      gradeNameEn: string;
      systemId: number;
      systemNameAr: string;
      systemNameEn: string;
      divisionNameAr: string | null;
      divisionNameEn: string | null;
      pathwayNameAr: string | null;
      pathwayNameEn: string | null;
      languagesOffered: string[];
      religiousVariant: string | null;
      hourlyRate: string | null;
      currency: string;
      supportsOnline: boolean;
      supportsInPerson: boolean;
    }>;
  };
  courses: Array<{
    id: number;
    title: string;
    subtitle: string;
    level: string;
    price: string;
    currency: string;
    thumbnailUrl: string | null;
    fieldNameAr: string;
    lessonsCount: number;
    ratingAvg: number | null;
    reviewsCount: number;
    centerName: string | null;
  }>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'م';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  TEACHER: 'معلّم / مدرّس',
  MENTOR: 'مرشد مهني',
  EXPERT: 'خبير ومستشار',
};

export function InstructorProfilePage() {
  const { instructorId } = useParams();
  const { locale } = useAuth();
  const isAr = locale === 'ar';
  const [data, setData] = useState<InstructorPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstructor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<InstructorPublicResponse>(
        `/api/instructors/${instructorId}`
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحميل الملف العام للمدرّب.'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    loadInstructor();
  }, [loadInstructor]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-52 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <UserCheck className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-slate-900">
          الملف الشخصي غير متاح
        </h1>
        <p className="text-sm text-slate-600">
          {error || 'لم يتم العثور على هذا المدرّب أو لم يعد ملفه العام منشوراً.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/courses"
            className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg"
          >
            تصفح الدورات
          </Link>
          <Link
            to="/providers"
            className="px-5 py-2.5 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg"
          >
            دليل المعلّمين والخبراء
          </Link>
        </div>
      </div>
    );
  }

  const { instructor, courses } = data;
  const showHeadlineSeparately =
    instructor.headline &&
    instructor.headline.trim() !== instructor.jobTitle.trim();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="مسار التنقل" className="text-xs text-slate-500 flex items-center gap-2">
        <Link to="/" className="hover:text-teal-700">
          الرئيسية
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/providers" className="hover:text-teal-700">
          المعلّمون والخبراء
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-800 font-medium">{instructor.fullName}</span>
      </nav>

      {/* Instructor Profile Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            {instructor.avatarUrl ? (
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                <SafeImage
                  src={instructor.avatarUrl}
                  alt={instructor.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-display text-2xl font-extrabold shrink-0"
                aria-hidden="true"
              >
                {getInitials(instructor.fullName)}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {PROVIDER_TYPE_LABELS[instructor.providerType] || 'مدرّب'}
                </span>
                {instructor.verificationStatus === 'VERIFIED' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-teal-800 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                      <span>حساب موثّق</span>
                    </span>
                  </>
                )}
              </div>

              <h1
                className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900"
                dir="auto"
              >
                {instructor.fullName}
              </h1>

              <div
                className="text-sm font-semibold text-teal-800 flex items-center gap-2"
                dir="auto"
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span>{instructor.jobTitle}</span>
              </div>

              {showHeadlineSeparately && (
                <p className="text-xs text-slate-600" dir="auto">
                  {instructor.headline}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center min-w-[110px]">
              <div className="text-xs text-slate-500">التقييم العام</div>
              <div className="mt-1 flex items-center justify-center gap-1 font-mono-num text-base font-bold text-slate-900">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{instructor.ratingAvg}</span>
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                ({instructor.reviewsCount} تقييم)
              </div>
            </div>

            {instructor.yearsExperience !== null && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center min-w-[110px]">
                <div className="text-xs text-slate-500">سنوات الخبرة</div>
                <div className="mt-1 font-mono-num text-base font-bold text-slate-900">
                  {instructor.yearsExperience}+
                </div>
                <div className="text-[11px] text-slate-500">سنة</div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center min-w-[110px]">
              <div className="text-xs text-slate-500">الدورات المنشورة</div>
              <div className="mt-1 font-mono-num text-base font-bold text-slate-900">
                {courses.length}
              </div>
              <div className="text-[11px] text-slate-500">دورة</div>
            </div>
          </div>
        </div>

        {/* Expertise, Qualifications & Center Affiliations */}
        {(instructor.qualifications ||
          instructor.fields.length > 0 ||
          instructor.centerAffiliations.length > 0) && (
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
            {instructor.qualifications && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-teal-700" />
                  <span>المؤهلات العلمية</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed" dir="auto">
                  {instructor.qualifications}
                </p>
              </div>
            )}

            {instructor.fields.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-teal-700" />
                  <span>مجالات التدريس</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {instructor.fields.map((field) => (
                    <span
                      key={field}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {instructor.centerAffiliations.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-teal-700" />
                  <span>الانتماء للمراكز التعليمية</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {instructor.centerAffiliations.map((aff) => (
                    <div
                      key={`${aff.centerId}-${aff.jobTitle}`}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <Link
                        to="/centers"
                        className="font-semibold text-teal-700 hover:underline"
                      >
                        {aff.centerName}
                      </Link>
                      {aff.jobTitle && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span dir="auto">{aff.jobTitle}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* About Me / Professional Biography */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-slate-900">
            نبذة عني — About Me
          </h2>
        </div>
        {instructor.bio && instructor.bio.trim().length > 0 ? (
          <p
            className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line max-w-4xl"
            dir="auto"
          >
            {instructor.bio}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            لم يضف هذا المدرّب نبذة تعريفية بعد.
          </p>
        )}
      </section>

      {/* Curriculum Teaching Assignments */}
      {instructor.teachingAssignments && instructor.teachingAssignments.length > 0 && (
        <section
          className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4"
          data-testid="instructor-teaching-assignments"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                {isAr
                  ? 'المواد والصفوف الدراسية التي يدرّسها المعلّم'
                  : 'Assigned Curriculum Subjects & Grades'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isAr
                  ? 'التعليم العام المصري — يمكنك تصفح المراحل التعليمية لاكتشاف المواعيد المتاحة.'
                  : 'Egyptian General Education curriculum subjects & grades taught.'}
              </p>
            </div>
            <Link
              to="/educational-stages"
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              {isAr ? 'استعراض المراحل التعليمية' : 'Browse Educational Stages'}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {instructor.teachingAssignments.map((ta) => {
              const langs = (ta.languagesOffered || [])
                .map((l) =>
                  isAr
                    ? LANGUAGE_OF_INSTRUCTION_LABELS[l]?.ar || l
                    : LANGUAGE_OF_INSTRUCTION_LABELS[l]?.en || l
                )
                .join(' / ');
              return (
                <div
                  key={ta.id}
                  className="border border-slate-200 rounded-xl p-4 space-y-1.5 bg-slate-50/50"
                >
                  <div className="text-sm font-bold text-slate-900">
                    {isAr ? ta.subjectNameAr : ta.subjectNameEn}
                  </div>
                  <div className="text-xs text-teal-800 font-medium">
                    {isAr ? ta.systemNameAr : ta.systemNameEn} ·{' '}
                    {isAr ? ta.gradeNameAr : ta.gradeNameEn}
                  </div>
                  {(ta.divisionNameAr || ta.pathwayNameAr) && (
                    <div className="text-xs text-slate-600">
                      {isAr
                        ? ta.divisionNameAr || ta.pathwayNameAr
                        : ta.divisionNameEn || ta.pathwayNameEn}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 pt-1">
                    {langs && `${isAr ? 'اللغات:' : 'Lang:'} ${langs}`}
                    {ta.hourlyRate && ` · $${ta.hourlyRate}`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Live Individual & Group Sessions by This Instructor */}
      <TeacherSessionsBookingSection
        teacherId={instructor.id}
        showTeacherName={false}
        title={isAr ? 'الجلسات الفردية والجماعية مع المدرّب' : '1:1 & Group Sessions'}
        subtitle={
          isAr
            ? 'اختر موعداً فردياً (1:1) أو انضم إلى جلسة جماعية تفاعلية مع هذا المدرّب.'
            : 'Choose a 1:1 slot or join a group session with this instructor.'
        }
      />

      {/* Courses by This Instructor */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              الدورات التي يقدمها هذا المدرس
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Courses by This Instructor ({courses.length})
            </p>
          </div>
          <Link
            to="/providers"
            className="text-sm font-semibold text-teal-700 hover:underline"
          >
            حجز جلسة مباشرة مع المدرّب
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="font-semibold text-slate-900">
              لم ينشر هذا المدرّب أي دورات بعد
            </div>
            <p className="text-xs text-slate-500">
              This instructor has not published any courses yet.
            </p>
            <div className="pt-2">
              <Link
                to="/courses"
                className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                استعراض جميع الدورات المتاحة
              </Link>
            </div>
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
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
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
                    {course.centerName && (
                      <div className="text-[11px] text-slate-500">
                        المركز: {course.centerName}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num font-bold text-slate-900">
                        {Number(course.price) === 0 ? 'مجانية' : `$${course.price}`}
                      </span>
                      {course.ratingAvg !== null && (
                        <span className="flex items-center gap-1 text-amber-600 font-mono-num">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          {course.ratingAvg}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/courses/${course.id}`}
                      className="font-semibold text-teal-700 hover:underline"
                    >
                      عرض تفاصيل الدورة
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
