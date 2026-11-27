import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  apiFetch,
  LANGUAGE_OF_INSTRUCTION_LABELS,
  formatCurrencyPrice,
} from '../lib/api';
import { SafeImage } from '../components/SafeImage';
import { TeacherSessionsBookingSection } from '../components/TeacherSessionsBookingSection';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { CourseCard } from '../components/ui/CourseCard';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

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
      divisionId?: number | null;
      divisionNameAr: string | null;
      divisionNameEn: string | null;
      pathwayId?: number | null;
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
  const [selectedCurriculumSubjectId, setSelectedCurriculumSubjectId] = useState<
    number | null
  >(null);

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
      <div className="container-xxl px-3 px-sm-4 py-5 space-y-5">
        <LoadingSkeleton variant="detail" count={1} />
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader
          title={isAr ? 'الملف الشخصي غير متاح' : 'Profile Not Available'}
          breadcrumbs={[
            { label: isAr ? 'الرئيسية' : 'Home', to: '/' },
            { label: isAr ? 'المعلّمون والخبراء' : 'Providers', to: '/providers' },
            { label: isAr ? 'غير متاح' : 'Unavailable' },
          ]}
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-person-x"
            title={isAr ? 'الملف الشخصي غير متاح' : 'Instructor profile unavailable'}
            description={
              error ||
              (isAr
                ? 'لم يتم العثور على هذا المدرّب أو لم يعد ملفه العام منشوراً.'
                : 'This instructor profile could not be found or is no longer public.')
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/providers"
                  className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm"
                >
                  {isAr ? 'دليل المعلّمين والخبراء' : 'Browse Providers'}
                </Link>
                <Link
                  to="/courses"
                  className="btn-jusoor-outline px-4 py-2 text-xs sm:text-sm"
                >
                  {isAr ? 'تصفح الدورات' : 'Browse Courses'}
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const { instructor, courses } = data;
  const showHeadlineSeparately =
    instructor.headline &&
    instructor.headline.trim() !== instructor.jobTitle.trim();

  return (
    <div>
      <PageHeader
        kicker={PROVIDER_TYPE_LABELS[instructor.providerType] || (isAr ? 'مدرّب' : 'Instructor')}
        title={instructor.fullName}
        subtitle={instructor.jobTitle}
        breadcrumbs={[
          { label: isAr ? 'الرئيسية' : 'Home', to: '/' },
          { label: isAr ? 'المعلّمون والخبراء' : 'Providers', to: '/providers' },
          { label: instructor.fullName },
        ]}
        actions={
          <Link
            to="/educational-stages"
            className="btn-jusoor-outline px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap"
          >
            <i className="bi bi-layers" aria-hidden="true" />
            <span>{isAr ? 'المراحل والمناهج' : 'Educational Stages'}</span>
          </Link>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-6">
        {/* Profile Overview Card + KPI Row */}
        <section className="jusoor-card p-4 p-sm-5 space-y-5">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-lg-7">
              <div className="flex items-start gap-4">
                {instructor.avatarUrl ? (
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[#DCE5F0] shrink-0 bg-[#EEF4FA]">
                    <SafeImage
                      src={instructor.avatarUrl}
                      alt={instructor.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl bg-[#E8F8F5] border border-[#99E2D8] text-[#0F766E] flex items-center justify-center font-display text-2xl font-extrabold shrink-0"
                    aria-hidden="true"
                  >
                    {getInitials(instructor.fullName)}
                  </div>
                )}

                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span>
                      {PROVIDER_TYPE_LABELS[instructor.providerType] || 'مدرّب'}
                    </span>
                    {instructor.verificationStatus === 'VERIFIED' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[#0F766E] font-semibold">
                          <i className="bi bi-patch-check-fill text-[#20B8A6]" aria-hidden="true" />
                          <span>{isAr ? 'حساب موثّق' : 'Verified'}</span>
                        </span>
                      </>
                    )}
                  </div>

                  <div
                    className="text-sm font-bold text-[#102A43] flex items-center gap-2"
                    dir="auto"
                  >
                    <i className="bi bi-briefcase text-[#247BA0]" aria-hidden="true" />
                    <span>{instructor.jobTitle}</span>
                  </div>

                  {showHeadlineSeparately && (
                    <p className="text-xs text-[#64748B] m-0" dir="auto">
                      {instructor.headline}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="row g-2.5">
                <div className="col-6 col-sm-4">
                  <StatCard
                    label={isAr ? 'التقييم العام' : 'Rating'}
                    value={instructor.ratingAvg}
                    sublabel={`(${instructor.reviewsCount} ${isAr ? 'تقييم' : 'reviews'})`}
                    icon="bi-star-fill"
                    accent="amber"
                  />
                </div>
                {instructor.yearsExperience !== null && (
                  <div className="col-6 col-sm-4">
                    <StatCard
                      label={isAr ? 'سنوات الخبرة' : 'Experience'}
                      value={`${instructor.yearsExperience}+`}
                      sublabel={isAr ? 'سنة' : 'yrs'}
                      icon="bi-award"
                      accent="blue"
                    />
                  </div>
                )}
                <div className={instructor.yearsExperience !== null ? 'col-12 col-sm-4' : 'col-6 col-sm-4'}>
                  <StatCard
                    label={isAr ? 'الدورات' : 'Courses'}
                    value={courses.length}
                    sublabel={isAr ? 'دورة منشورة' : 'published'}
                    icon="bi-journal-bookmark"
                    accent="teal"
                  />
                </div>
              </div>
            </div>
          </div>

          {(instructor.qualifications ||
            instructor.fields.length > 0 ||
            instructor.centerAffiliations.length > 0) && (
            <div className="pt-4 border-t border-[#DCE5F0]">
              <div className="row g-4">
                {instructor.qualifications && (
                  <div className="col-12 col-md-4 space-y-1.5">
                    <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5">
                      <i className="bi bi-mortarboard text-[#247BA0]" aria-hidden="true" />
                      <span>{isAr ? 'المؤهلات العلمية' : 'Qualifications'}</span>
                    </div>
                    <p className="text-sm text-[#172B4D] leading-relaxed m-0" dir="auto">
                      {instructor.qualifications}
                    </p>
                  </div>
                )}

                {instructor.fields.length > 0 && (
                  <div className="col-12 col-md-4 space-y-1.5">
                    <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5">
                      <i className="bi bi-bookmark-check text-[#247BA0]" aria-hidden="true" />
                      <span>{isAr ? 'مجالات التدريس' : 'Teaching Fields'}</span>
                    </div>
                    <div className="text-xs text-[#172B4D] leading-relaxed">
                      {instructor.fields.join(' · ')}
                    </div>
                  </div>
                )}

                {instructor.centerAffiliations.length > 0 && (
                  <div className="col-12 col-md-4 space-y-1.5">
                    <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5">
                      <i className="bi bi-building text-[#247BA0]" aria-hidden="true" />
                      <span>{isAr ? 'الانتماء للمراكز التعليمية' : 'Center Affiliations'}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-[#64748B]">
                      {instructor.centerAffiliations.map((aff) => (
                        <div
                          key={`${aff.centerId}-${aff.jobTitle}`}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <Link
                            to="/centers"
                            className="font-semibold text-[#0F766E] hover:underline"
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
            </div>
          )}
        </section>

        {/* About Me */}
        <section className="jusoor-card p-4 p-sm-5 space-y-2.5">
          <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
            {isAr ? 'نبذة عن المعلّم' : 'About the Instructor'}
          </h2>
          {instructor.bio && instructor.bio.trim().length > 0 ? (
            <p
              className="text-sm sm:text-base text-[#172B4D] leading-relaxed whitespace-pre-line max-w-4xl m-0"
              dir="auto"
            >
              {instructor.bio}
            </p>
          ) : (
            <p className="text-sm text-[#64748B] m-0">
              {isAr ? 'لم يضف هذا المدرّب نبذة تعريفية بعد.' : 'No biography provided yet.'}
            </p>
          )}
        </section>

        {/* Curriculum Teaching Assignments */}
        {instructor.teachingAssignments && instructor.teachingAssignments.length > 0 && (
          <section
            className="jusoor-card p-4 p-sm-5 space-y-4"
            data-testid="instructor-teaching-assignments"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                  {isAr
                    ? 'المواد والصفوف الدراسية التي يدرّسها المعلّم'
                    : 'Assigned Curriculum Subjects & Grades'}
                </h2>
                <p className="text-xs text-[#64748B] mt-1 mb-0">
                  {isAr
                    ? 'اختر أي مادة وصف لعرض الجلسات الفردية والجماعية المخصصة لها مباشرة.'
                    : 'Select any subject & grade below to filter the sessions offered for it.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {selectedCurriculumSubjectId !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedCurriculumSubjectId(null)}
                    className="btn-jusoor-outline px-3 py-1.5 text-xs cursor-pointer"
                  >
                    {isAr ? 'عرض جميع المواد' : 'Show All Subjects'}
                  </button>
                )}
                <Link
                  to="/educational-stages"
                  className="text-xs font-semibold text-[#0F766E] hover:underline"
                >
                  {isAr ? 'استعراض المراحل التعليمية' : 'Browse Educational Stages'}
                </Link>
              </div>
            </div>

            <div className="row g-3">
              {instructor.teachingAssignments.map((ta) => {
                const isSelected =
                  selectedCurriculumSubjectId === ta.curriculumSubjectId;
                const langs = (ta.languagesOffered || [])
                  .map((l) =>
                    isAr
                      ? LANGUAGE_OF_INSTRUCTION_LABELS[l]?.ar || l
                      : LANGUAGE_OF_INSTRUCTION_LABELS[l]?.en || l
                  )
                  .join(' / ');
                return (
                  <div key={ta.id} className="col-12 col-md-6 col-lg-4">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCurriculumSubjectId(
                          isSelected ? null : ta.curriculumSubjectId
                        )
                      }
                      aria-pressed={isSelected}
                      className={`w-full h-full text-start border rounded-xl p-3.5 space-y-1.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#0F766E] bg-[#E8F8F5]'
                          : 'border-[#DCE5F0] bg-[#F5F8FC] hover:border-[#247BA0]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#102A43]">
                          {isAr ? ta.subjectNameAr : ta.subjectNameEn}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] font-bold text-[#0F766E]">
                            {isAr ? 'محدّد' : 'Selected'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#247BA0] font-semibold">
                        {isAr ? ta.systemNameAr : ta.systemNameEn} ·{' '}
                        {isAr ? ta.gradeNameAr : ta.gradeNameEn}
                      </div>
                      {(ta.divisionNameAr || ta.pathwayNameAr) && (
                        <div className="text-xs text-[#64748B]">
                          {isAr
                            ? ta.divisionNameAr || ta.pathwayNameAr
                            : ta.divisionNameEn || ta.pathwayNameEn}
                        </div>
                      )}
                      <div className="text-[11px] text-[#64748B] pt-1 font-mono-num">
                        {langs && `${isAr ? 'اللغات:' : 'Lang:'} ${langs}`}
                        {ta.hourlyRate &&
                          ` · ${formatCurrencyPrice(
                            ta.hourlyRate,
                            ta.currency || 'EGP',
                            isAr ? 'ar' : 'en'
                          )}`}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Live Individual & Group Sessions */}
        <TeacherSessionsBookingSection
          teacherId={instructor.id}
          curriculumSubjectId={selectedCurriculumSubjectId}
          teacherAssignments={instructor.teachingAssignments}
          onSelectCurriculumContext={setSelectedCurriculumSubjectId}
          showTeacherName={false}
          title={isAr ? 'الجلسات الفردية والجماعية مع المدرّب' : '1:1 & Group Sessions'}
          subtitle={
            isAr
              ? 'اختر موعداً فردياً (1:1) أو انضم إلى جلسة جماعية أونلاين أو أوفلاين مع هذا المدرّب.'
              : 'Choose a 1:1 slot or join an online or offline group session with this instructor.'
          }
        />

        {/* Courses by This Instructor */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-[#102A43] m-0">
                {isAr
                  ? `الدورات التي يقدمها هذا المدرس (${courses.length})`
                  : `Courses by This Instructor (${courses.length})`}
              </h2>
            </div>
            <Link
              to="/providers"
              className="text-xs sm:text-sm font-semibold text-[#0F766E] hover:underline"
            >
              {isAr ? 'دليل المعلّمين والخبراء' : 'Browse All Instructors'}
            </Link>
          </div>

          {courses.length === 0 ? (
            <EmptyState
              icon="bi-journal-bookmark"
              title={isAr ? 'لم ينشر هذا المدرّب أي دورات بعد' : 'No published courses yet'}
              description={
                isAr
                  ? 'يمكنك حجز جلسة مباشرة مع المدرّب أعلاه أو تصفح الدورات المتاحة على المنصة.'
                  : 'You can book a direct session above or browse other platform courses.'
              }
              action={
                <Link
                  to="/courses"
                  className="btn-jusoor-navy px-4 py-2 text-xs"
                >
                  {isAr ? 'استعراض جميع الدورات' : 'Browse All Courses'}
                </Link>
              }
            />
          ) : (
            <div className="row g-3 g-md-4">
              {courses.map((course) => (
                <div key={course.id} className="col-12 col-md-6 col-lg-4">
                  <CourseCard
                    course={{
                      id: course.id,
                      title: course.title,
                      subtitle: course.subtitle,
                      level: course.level,
                      price: course.price,
                      thumbnailUrl: course.thumbnailUrl,
                      instructorId: instructor.id,
                      instructorName: instructor.fullName,
                      fieldNameAr: course.fieldNameAr,
                      centerName: course.centerName,
                      lessonsCount: course.lessonsCount,
                      ratingAvg: course.ratingAvg,
                    }}
                    locale={locale}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
