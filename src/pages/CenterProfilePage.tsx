import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  apiFetch,
  COURSE_ENROLLMENT_STATUS_LABELS_AR,
  formatCurrencyPrice,
  getCenterVerificationLabelAr,
  LEVEL_LABELS_AR,
  WEEKDAY_LABELS_AR,
  type PublicCenterProfileResponse,
} from '../lib/api';
import { SafeImage } from '../components/SafeImage';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function CenterProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState<PublicCenterProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [showAllCourses, setShowAllCourses] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<PublicCenterProfileResponse>(`/api/centers/${id}`);
        if (active) {
          setProfile(res);
          setShowAllTeachers(false);
          setShowAllCourses(false);
        }
      } catch (err) {
        if (active) {
          setProfile(null);
          setError(
            err instanceof Error
              ? err.message
              : 'تعذر تحميل ملف المركز التعليمي.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
        <LoadingSkeleton variant="cards" count={3} />
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container-xxl px-3 px-sm-4 py-5 space-y-4">
        <EmptyState
          icon="bi-building-exclamation"
          title={error || 'المركز التعليمي غير موجود'}
          description="تأكد من صحة الرابط أو تصفح المراكز التعليمية المعتمدة على منصة جسور."
          action={
            <Link to="/centers" className="btn-jusoor-primary px-4 py-2 text-xs">
              العودة إلى قائمة المراكز
            </Link>
          }
        />
      </div>
    );
  }

  const { center, branches, teachers, courses } = profile;
  const isVerified = center.verificationStatus === 'VERIFIED';
  const verificationLabel =
    center.verificationLabelAr ||
    getCenterVerificationLabelAr(center.verificationStatus);
  const visibleTeachers = showAllTeachers ? teachers : teachers.slice(0, 6);
  const visibleCourses = showAllCourses ? courses : courses.slice(0, 6);

  return (
    <div className="py-4 py-md-5">
      <div className="container-xxl px-3 px-sm-4 space-y-6">
        {/* Breadcrumb */}
        <nav
          aria-label="مسار التنقل"
          className="text-xs text-[#64748B] flex flex-wrap items-center gap-2"
        >
          <Link to="/" className="hover:text-[#102A43]">
            الرئيسية
          </Link>
          <span aria-hidden="true">/</span>
          <Link to="/centers" className="hover:text-[#102A43]">
            المراكز التعليمية
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[#102A43] font-bold">{center.name}</span>
        </nav>

        {/* SECTION A: CENTER HEADER */}
        <section className="jusoor-card overflow-hidden">
          <div className="relative h-52 sm:h-64 md:h-72 bg-[#EEF4FA] border-b border-[#DCE5F0]">
            <SafeImage
              src={center.bannerUrl}
              alt={center.name}
              fallbackTitle={center.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/65 via-transparent to-transparent pointer-events-none" />
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                {center.logoUrl && (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 border-white shadow-sm bg-[#EEF4FA] shrink-0 -mt-10 sm:-mt-12 relative z-10">
                    <SafeImage
                      src={center.logoUrl}
                      alt={`شعار ${center.name}`}
                      fallbackTitle={center.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#102A43] m-0">
                      {center.name}
                    </h1>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#E8F8F5] text-[#0F766E] border border-[#B2EAE0] text-xs font-bold">
                        <i className="bi bi-patch-check-fill" aria-hidden="true" />
                        <span>مركز موثوق</span>
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-xs font-bold ${
                          center.verificationStatus === 'REJECTED'
                            ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                            : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                        }`}
                      >
                        <i className="bi bi-shield-check" aria-hidden="true" />
                        <span>{verificationLabel}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[#64748B]">
                    {(center.fullAddress || center.city) &&
                      (center.googleMapsUrl ? (
                        <a
                          href={center.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#172B4D] hover:text-[#0F766E] font-medium"
                        >
                          <i
                            className="bi bi-geo-alt-fill text-[#0F766E]"
                            aria-hidden="true"
                          />
                          <span>
                            {center.fullAddress || `${center.city}، ${center.country}`}
                          </span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <i
                            className="bi bi-geo-alt-fill text-[#247BA0]"
                            aria-hidden="true"
                          />
                          <span>
                            {center.fullAddress || `${center.city}، ${center.country}`}
                          </span>
                        </span>
                      ))}

                    {center.phone && (
                      <a
                        href={`tel:${center.phone}`}
                        className="inline-flex items-center gap-1.5 text-[#172B4D] hover:text-[#247BA0] font-mono-num"
                        dir="ltr"
                      >
                        <i className="bi bi-telephone text-[#247BA0]" aria-hidden="true" />
                        <span>{center.phone}</span>
                      </a>
                    )}

                    {center.secondaryPhone && (
                      <a
                        href={`tel:${center.secondaryPhone}`}
                        className="inline-flex items-center gap-1.5 text-[#64748B] hover:text-[#247BA0] font-mono-num"
                        dir="ltr"
                      >
                        <i className="bi bi-telephone-plus" aria-hidden="true" />
                        <span>{center.secondaryPhone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {center.googleMapsUrl && (
                  <a
                    href={center.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-jusoor-outline px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <i className="bi bi-geo-alt-fill text-[#0F766E]" aria-hidden="true" />
                    <span>عرض الموقع على الخريطة</span>
                  </a>
                )}
                {center.website && (
                  <a
                    href={center.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-jusoor-outline px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <i className="bi bi-globe text-[#247BA0]" aria-hidden="true" />
                    <span>الموقع الإلكتروني</span>
                  </a>
                )}
                {center.canManage && (
                  <Link
                    to={`/centers/${center.id}/dashboard`}
                    className="btn-jusoor-primary px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <i className="bi bi-building-gear" aria-hidden="true" />
                    <span>لوحة إدارة المركز</span>
                  </Link>
                )}
              </div>
            </div>

            <p className="text-sm sm:text-base text-[#172B4D] leading-relaxed m-0 line-clamp-3">
              {center.description}
            </p>

            <div className="row g-2.5 pt-2">
              <div className="col-6 col-sm-3">
                <div className="jusoor-subcard p-3 text-center">
                  <div className="font-mono-num text-xl font-extrabold text-[#102A43]">
                    {center.stats.teachersCount}
                  </div>
                  <div className="text-xs text-[#64748B]">مدرسو المركز</div>
                </div>
              </div>
              <div className="col-6 col-sm-3">
                <div className="jusoor-subcard p-3 text-center">
                  <div className="font-mono-num text-xl font-extrabold text-[#0F766E]">
                    {center.stats.coursesCount}
                  </div>
                  <div className="text-xs text-[#64748B]">الدورات المتاحة</div>
                </div>
              </div>
              <div className="col-6 col-sm-3">
                <div className="jusoor-subcard p-3 text-center">
                  <div className="font-mono-num text-xl font-extrabold text-[#247BA0]">
                    {center.stats.branchesCount}
                  </div>
                  <div className="text-xs text-[#64748B]">الفروع النشطة</div>
                </div>
              </div>
              <div className="col-6 col-sm-3">
                <div className="jusoor-subcard p-3 text-center">
                  <div className="font-mono-num text-xl font-extrabold text-[#102A43]">
                    {center.stats.totalEnrollments}
                  </div>
                  <div className="text-xs text-[#64748B]">إجمالي التسجيلات</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION B: CENTER INFORMATION, ADDRESS & WORKING HOURS */}
        <section className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="jusoor-card p-4 sm:p-6 space-y-4 h-full">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#EDF2F7]">
                <h2 className="font-display text-lg font-bold text-[#102A43] m-0 flex items-center gap-2">
                  <i className="bi bi-info-circle text-[#0F766E]" aria-hidden="true" />
                  <span>معلومات المركز والموقع</span>
                </h2>
                <span className="text-xs font-bold text-[#64748B]">
                  {verificationLabel}
                </span>
              </div>

              <p className="text-sm text-[#172B4D] leading-relaxed whitespace-pre-line m-0">
                {center.description}
              </p>

              <div className="jusoor-subcard p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5">
                    <i className="bi bi-pin-map-fill text-[#247BA0]" aria-hidden="true" />
                    <span>العنوان التفصيلي</span>
                  </div>
                  {center.googleMapsUrl && (
                    <a
                      href={center.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#0F766E] hover:underline inline-flex items-center gap-1"
                    >
                      <span>عرض الموقع على الخريطة</span>
                      <i className="bi bi-box-arrow-up-left" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="row g-2 text-xs text-[#172B4D]">
                  {center.governorate && (
                    <div className="col-6 col-sm-4">
                      <span className="text-[#64748B]">المحافظة: </span>
                      <span className="font-semibold">{center.governorate}</span>
                    </div>
                  )}
                  <div className="col-6 col-sm-4">
                    <span className="text-[#64748B]">المدينة: </span>
                    <span className="font-semibold">{center.city}</span>
                  </div>
                  <div className="col-6 col-sm-4">
                    <span className="text-[#64748B]">الدولة: </span>
                    <span className="font-semibold">{center.country}</span>
                  </div>
                  {center.street && (
                    <div className="col-12 col-sm-6">
                      <span className="text-[#64748B]">الشارع: </span>
                      <span className="font-semibold">{center.street}</span>
                    </div>
                  )}
                  {center.buildingDetails && (
                    <div className="col-12 col-sm-6">
                      <span className="text-[#64748B]">المبنى / الدور: </span>
                      <span className="font-semibold">{center.buildingDetails}</span>
                    </div>
                  )}
                  {center.address && (
                    <div className="col-12">
                      <span className="text-[#64748B]">تفاصيل العنوان: </span>
                      <span className="font-semibold">{center.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {branches.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <h3 className="text-xs font-bold text-[#102A43] m-0 flex items-center gap-1.5">
                    <i className="bi bi-buildings text-[#247BA0]" aria-hidden="true" />
                    <span>فروع المركز النشطة ({branches.length})</span>
                  </h3>
                  <div className="row g-2.5">
                    {branches.map((b) => (
                      <div key={b.id} className="col-12 col-sm-6">
                        <div className="jusoor-subcard p-3 space-y-1 text-xs h-full">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#102A43]">{b.name}</span>
                            {b.isMain && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E8F8F5] text-[#0F766E]">
                                الرئيسي
                              </span>
                            )}
                          </div>
                          <div className="text-[#64748B]">
                            {b.city} — {b.address}
                          </div>
                          {b.phone && (
                            <div className="font-mono-num text-[#247BA0]" dir="ltr">
                              {b.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="jusoor-card p-4 sm:p-6 space-y-4 h-full">
              <div className="pb-2 border-b border-[#EDF2F7]">
                <h2 className="font-display text-lg font-bold text-[#102A43] m-0 flex items-center gap-2">
                  <i className="bi bi-clock text-[#247BA0]" aria-hidden="true" />
                  <span>ساعات العمل الأسبوعية</span>
                </h2>
              </div>

              <div className="divide-y divide-[#EDF2F7] text-xs">
                {center.workingHoursJson.map((wh) => (
                  <div
                    key={wh.dayOfWeek}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="font-bold text-[#102A43]">
                      {WEEKDAY_LABELS_AR[wh.dayOfWeek] || wh.dayOfWeek}
                    </span>
                    {wh.isOpen ? (
                      <span className="font-mono-num text-[#0F766E] font-semibold">
                        {wh.openTime} - {wh.closeTime}
                        {wh.note ? ` · ${wh.note}` : ''}
                      </span>
                    ) : (
                      <span className="text-[#991B1B] font-semibold">
                        {wh.note || 'مغلق'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {(center.phone || center.secondaryPhone || center.website) && (
                <div className="jusoor-subcard p-3.5 space-y-1.5 text-xs">
                  <div className="font-bold text-[#102A43]">التواصل المباشر</div>
                  {center.phone && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#64748B]">الهاتف الأساسي</span>
                      <a
                        href={`tel:${center.phone}`}
                        className="font-mono-num font-bold text-[#102A43] hover:text-[#247BA0]"
                        dir="ltr"
                      >
                        {center.phone}
                      </a>
                    </div>
                  )}
                  {center.secondaryPhone && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#64748B]">هاتف إضافي</span>
                      <a
                        href={`tel:${center.secondaryPhone}`}
                        className="font-mono-num font-bold text-[#102A43] hover:text-[#247BA0]"
                        dir="ltr"
                      >
                        {center.secondaryPhone}
                      </a>
                    </div>
                  )}
                  {center.website && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#64748B]">الموقع الإلكتروني</span>
                      <a
                        href={center.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#247BA0] hover:underline truncate max-w-[200px]"
                        dir="ltr"
                      >
                        {center.website}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION C: TEACHERS SECTION (مدرسو المركز) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
                مدرسو المركز ({teachers.length})
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] m-0 mt-1">
                نخبة المعلّمين النشطين المعتمدين داخل {center.name}. اضغط على أي معلّم لعرض ملفه الكامل وجدول حصصه.
              </p>
            </div>
            {teachers.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllTeachers((prev) => !prev)}
                className="btn-jusoor-outline px-4 py-2 text-xs font-bold cursor-pointer"
              >
                {showAllTeachers
                  ? 'عرض عدد أقل'
                  : `عرض الكل (${teachers.length})`}
              </button>
            )}
          </div>

          {teachers.length === 0 ? (
            <EmptyState
              icon="bi-person-badge"
              title="لا يوجد معلّمون معروضون حالياً في هذا المركز"
              description="سيظهر هنا المعلّمون النشطون فور إضافتهم وتفعيلهم ضمن فريق المركز."
            />
          ) : (
            <div className="row g-3 g-md-4">
              {visibleTeachers.map((teacher) => {
                const initials = teacher.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0] || '')
                  .join('');
                return (
                  <div key={teacher.memberId} className="col-12 col-md-6 col-lg-4">
                    <Link
                      to={`/instructors/${teacher.userId}`}
                      className="jusoor-card jusoor-card-interactive p-4 sm:p-5 h-full flex flex-col justify-between gap-3.5 text-decoration-none"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#DCE5F0] bg-[#EEF4FA] shrink-0 flex items-center justify-center">
                            {teacher.avatarUrl ? (
                              <SafeImage
                                src={teacher.avatarUrl}
                                alt={teacher.fullName}
                                fallbackTitle={teacher.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="font-display font-bold text-base text-[#102A43]">
                                {initials || 'م'}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-display text-base font-bold text-[#102A43] truncate m-0">
                                {teacher.fullName}
                              </h3>
                              {teacher.verificationStatus === 'VERIFIED' && (
                                <i
                                  className="bi bi-patch-check-fill text-[#20B8A6] text-xs shrink-0"
                                  aria-label="حساب موثّق"
                                />
                              )}
                            </div>
                            <div className="text-xs font-semibold text-[#0F766E] truncate mt-0.5">
                              {teacher.jobTitle}
                            </div>
                            {teacher.ratingAvg > 0 && (
                              <div className="text-[11px] text-[#B45309] font-semibold mt-1 inline-flex items-center gap-1">
                                <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                                <span className="font-mono-num">
                                  {teacher.ratingAvg.toFixed(1)}
                                </span>
                                <span className="text-[#64748B]">
                                  ({teacher.reviewsCount} تقييم)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {teacher.bio && (
                          <p className="text-xs text-[#64748B] line-clamp-2 m-0 leading-relaxed">
                            {teacher.bio}
                          </p>
                        )}

                        {(teacher.stages.length > 0 ||
                          teacher.grades.length > 0 ||
                          teacher.subjects.length > 0) && (
                          <div className="space-y-1.5 text-[11px]">
                            {teacher.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {teacher.subjects.slice(0, 3).map((subj) => (
                                  <span
                                    key={subj.id}
                                    className="px-2 py-0.5 rounded bg-[#E8F8F5] text-[#0F766E] font-semibold"
                                  >
                                    {subj.nameAr}
                                  </span>
                                ))}
                              </div>
                            )}
                            {(teacher.stages.length > 0 || teacher.grades.length > 0) && (
                              <div className="text-[#64748B] line-clamp-2">
                                {teacher.stages.map((s) => s.nameAr).join(' · ')}
                                {teacher.grades.length > 0 && (
                                  <span>
                                    {teacher.stages.length > 0 ? ' — ' : ''}
                                    {teacher.grades
                                      .slice(0, 3)
                                      .map((g) => g.nameAr)
                                      .join('، ')}
                                    {teacher.grades.length > 3
                                      ? ` (+${teacher.grades.length - 3})`
                                      : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#EDF2F7] flex items-center justify-between text-xs">
                        <span className="text-[#64748B] font-mono-num">
                          {teacher.centerCoursesCount} دورات بالمركز
                        </span>
                        <span className="font-bold text-[#247BA0] inline-flex items-center gap-1">
                          <span>عرض ملف المعلّم</span>
                          <i className="bi bi-arrow-left" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION D: COURSES SECTION (الدورات المتاحة) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#102A43] m-0">
                الدورات المتاحة ({courses.length})
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] m-0 mt-1">
                الدورات المنشورة والمتاحة للتسجيل في {center.name}.
              </p>
            </div>
            {courses.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllCourses((prev) => !prev)}
                className="btn-jusoor-outline px-4 py-2 text-xs font-bold cursor-pointer"
              >
                {showAllCourses
                  ? 'عرض عدد أقل'
                  : `عرض الكل (${courses.length})`}
              </button>
            )}
          </div>

          {courses.length === 0 ? (
            <EmptyState
              icon="bi-journal-bookmark"
              title="لا توجد دورات منشورة متاحة حالياً"
              description="لم ينشر هذا المركز دورات متاحة للتسجيل بعد."
            />
          ) : (
            <div className="row g-3 g-md-4">
              {visibleCourses.map((course) => {
                const isSeatsFull =
                  Boolean(course.maxStudents) &&
                  course.enrollmentsCount >= (course.maxStudents ?? 0);
                const availabilityText = isSeatsFull
                  ? 'اكتمل العدد'
                  : COURSE_ENROLLMENT_STATUS_LABELS_AR[course.enrollmentStatus] ||
                    'مفتوح للتسجيل';
                const availabilityTone =
                  !course.isEnrollmentAvailable || isSeatsFull
                    ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                    : 'bg-[#E8F8F5] text-[#0F766E] border-[#B2EAE0]';

                return (
                  <div key={course.id} className="col-12 col-md-6 col-lg-4">
                    <article className="jusoor-card jusoor-card-interactive overflow-hidden flex flex-col h-full">
                      <Link
                        to={`/courses/${course.id}`}
                        className="block aspect-[16/10] bg-[#EEF4FA] overflow-hidden relative"
                      >
                        <SafeImage
                          src={course.thumbnailUrl}
                          alt={course.title}
                          fallbackTitle={course.title}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute top-2.5 start-2.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${availabilityTone}`}
                        >
                          {availabilityText}
                        </span>
                      </Link>

                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3.5">
                        <div className="space-y-2">
                          <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-1.5">
                            <span>{course.subjectNameAr || course.fieldNameAr}</span>
                            {course.stageNameAr && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{course.stageNameAr}</span>
                              </>
                            )}
                            {course.gradeNameAr && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{course.gradeNameAr}</span>
                              </>
                            )}
                            {(course.divisionNameAr || course.pathwayNameAr) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {course.divisionNameAr || course.pathwayNameAr}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="font-display text-base font-bold text-[#102A43] leading-snug m-0">
                            <Link
                              to={`/courses/${course.id}`}
                              className="text-[#102A43] hover:text-[#247BA0] transition-colors"
                            >
                              {course.title}
                            </Link>
                          </h3>

                          <p className="text-xs text-[#64748B] line-clamp-2 m-0 leading-relaxed">
                            {course.subtitle}
                          </p>
                        </div>

                        <div className="space-y-2.5 pt-3 border-t border-[#EDF2F7]">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <Link
                              to={`/instructors/${course.instructorId}`}
                              className="inline-flex items-center gap-2 font-semibold text-[#0F766E] hover:underline min-w-0"
                            >
                              <span className="w-6 h-6 rounded-full overflow-hidden border border-[#DCE5F0] bg-[#EEF4FA] shrink-0 flex items-center justify-center text-[10px] font-bold text-[#102A43]">
                                {course.instructorAvatarUrl ? (
                                  <SafeImage
                                    src={course.instructorAvatarUrl}
                                    alt={course.instructorName}
                                    fallbackTitle={course.instructorName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  course.instructorName.charAt(0)
                                )}
                              </span>
                              <span className="truncate">{course.instructorName}</span>
                            </Link>

                            <span className="font-mono-num font-extrabold text-[#102A43] shrink-0">
                              {formatCurrencyPrice(course.price, course.currency, 'ar')}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748B]">
                            <span className="tabular-nums">
                              {LEVEL_LABELS_AR[course.level] || course.level} ·{' '}
                              {course.enrollmentsCount}
                              {course.maxStudents
                                ? ` / ${course.maxStudents} طالب`
                                : ' مسجّل'}
                            </span>
                            {course.ratingAvg !== null && course.ratingAvg > 0 && (
                              <span className="font-mono-num font-bold text-[#B45309] inline-flex items-center gap-1">
                                <i
                                  className="bi bi-star-fill text-[#F59E0B]"
                                  aria-hidden="true"
                                />
                                {course.ratingAvg.toFixed(1)} ({course.reviewsCount})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
