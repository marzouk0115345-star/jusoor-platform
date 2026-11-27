import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFetch,
  DELIVERY_MODE_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  formatSessionDateRange,
  formatCurrencyPrice,
  isOfflineDeliveryMode,
  INDIVIDUAL_SLOT_STATUS_LABELS_AR,
  LANGUAGE_OF_INSTRUCTION_LABELS,
  SESSION_TYPE_LABELS_AR,
  type CurriculumDivisionItem,
  type CurriculumGradeItem,
  type CurriculumOverviewResponse,
  type CurriculumPathwayItem,
  type CurriculumStageItem,
  type CurriculumSubjectItem,
  type CurriculumSystemItem,
  type DiscoveredTeacherItem,
  type DiscoveredTeacherSessionItem,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'م';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

export function EducationalStagesPage() {
  const { user, openAuthModal, locale, setLocale } = useAuth();
  const isAr = locale === 'ar';

  const [overview, setOverview] = useState<CurriculumOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedPathwayId, setSelectedPathwayId] = useState<number | null>(null);

  const [subjects, setSubjects] = useState<CurriculumSubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectCategoryFilter, setSubjectCategoryFilter] = useState<
    'ALL' | 'CORE' | 'SPECIALIZATION_ELECTIVE' | 'NON_TOTAL' | 'ACTIVITY'
  >('ALL');
  const [subjectSearch, setSubjectSearch] = useState('');

  const [selectedSubject, setSelectedSubject] =
    useState<CurriculumSubjectItem | null>(null);
  const [teachers, setTeachers] = useState<DiscoveredTeacherItem[]>([]);
  const [teachersTotal, setTeachersTotal] = useState(0);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teachersError, setTeachersError] = useState<string | null>(null);

  const [teacherQ, setTeacherQ] = useState('');
  const [teacherDelivery, setTeacherDelivery] = useState('');
  const [teacherLanguage, setTeacherLanguage] = useState('');
  const [teacherReligiousVariant, setTeacherReligiousVariant] = useState('');
  const [teacherHasSessionsOnly, setTeacherHasSessionsOnly] = useState(false);
  const [teacherSort, setTeacherSort] = useState<
    'rating' | 'price_asc' | 'price_desc' | 'experience' | 'sessions'
  >('rating');

  const [bookingSession, setBookingSession] = useState<{
    session: DiscoveredTeacherSessionItem;
    teacherName: string;
  } | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const teachersSectionRef = useRef<HTMLElement | null>(null);
  const shouldScrollToTeachersRef = useRef(false);
  const isArRef = useRef(isAr);
  isArRef.current = isAr;

  useEffect(() => {
    if (selectedSubject && shouldScrollToTeachersRef.current) {
      shouldScrollToTeachersRef.current = false;
      requestAnimationFrame(() => {
        teachersSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  }, [selectedSubject]);

  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview')
      .then((res) => {
        if (!active) return;
        setOverview(res);
        setSelectedYearId(
          (prev) => prev ?? res.activeAcademicYear?.id ?? res.academicYears[0]?.id ?? null
        );
        setSelectedVersionId(
          (prev) => prev ?? res.activeVersion?.id ?? res.versions[0]?.id ?? null
        );
        const firstStage = res.stages[0] || null;
        if (firstStage) {
          setSelectedStageId((prev) => prev ?? firstStage.id);
          const stageSystems = res.systems.filter((s) => s.stageId === firstStage.id);
          const firstSys = stageSystems[0] || null;
          if (firstSys) {
            setSelectedSystemId((prev) => prev ?? firstSys.id);
            const sysGrades = res.grades.filter((g) => g.systemId === firstSys.id);
            setSelectedGradeId((prev) => prev ?? sysGrades[0]?.id ?? null);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setOverviewError(
          err instanceof Error
            ? err.message
            : isArRef.current
            ? 'تعذر تحميل المراحل التعليمية.'
            : 'Unable to load educational stages.'
        );
      })
      .finally(() => {
        if (active) setLoadingOverview(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const availableSystems = useMemo<CurriculumSystemItem[]>(() => {
    if (!overview || !selectedStageId) return [];
    return overview.systems.filter((s) => s.stageId === selectedStageId);
  }, [overview, selectedStageId]);

  const selectedSystem = useMemo(
    () => availableSystems.find((s) => s.id === selectedSystemId) || null,
    [availableSystems, selectedSystemId]
  );

  const availableGrades = useMemo<CurriculumGradeItem[]>(() => {
    if (!overview || !selectedSystemId) return [];
    return overview.grades.filter((g) => g.systemId === selectedSystemId);
  }, [overview, selectedSystemId]);

  const selectedGrade = useMemo(
    () => availableGrades.find((g) => g.id === selectedGradeId) || null,
    [availableGrades, selectedGradeId]
  );

  const availableDivisions = useMemo<CurriculumDivisionItem[]>(() => {
    if (!overview || !selectedGradeId || selectedSystem?.code !== 'GENERAL_SECONDARY') {
      return [];
    }
    return overview.divisions.filter((d) => d.gradeId === selectedGradeId);
  }, [overview, selectedGradeId, selectedSystem]);

  const availablePathways = useMemo<CurriculumPathwayItem[]>(() => {
    if (
      !overview ||
      !selectedGradeId ||
      selectedSystem?.code !== 'EGYPTIAN_BACCALAUREATE'
    ) {
      return [];
    }
    return overview.pathways.filter((p) => p.gradeId === selectedGradeId);
  }, [overview, selectedGradeId, selectedSystem]);

  const handleSelectStage = (stage: CurriculumStageItem) => {
    if (!overview) return;
    setSelectedStageId(stage.id);
    setSelectedSubject(null);
    setTeachers([]);
    const stageSystems = overview.systems.filter((s) => s.stageId === stage.id);
    const nextSys = stageSystems[0] || null;
    setSelectedSystemId(nextSys?.id ?? null);
    const sysGrades = nextSys
      ? overview.grades.filter((g) => g.systemId === nextSys.id)
      : [];
    const nextGrade = sysGrades[0] || null;
    setSelectedGradeId(nextGrade?.id ?? null);
    setSelectedDivisionId(null);
    setSelectedPathwayId(null);
  };

  const handleSelectSystem = (sys: CurriculumSystemItem) => {
    if (!overview) return;
    setSelectedSystemId(sys.id);
    setSelectedSubject(null);
    setTeachers([]);
    const sysGrades = overview.grades.filter((g) => g.systemId === sys.id);
    const nextGrade = sysGrades[0] || null;
    setSelectedGradeId(nextGrade?.id ?? null);
    if (nextGrade) {
      if (sys.code === 'GENERAL_SECONDARY') {
        const divs = overview.divisions.filter((d) => d.gradeId === nextGrade.id);
        setSelectedDivisionId(divs[0]?.id ?? null);
        setSelectedPathwayId(null);
      } else if (sys.code === 'EGYPTIAN_BACCALAUREATE') {
        const pws = overview.pathways.filter((p) => p.gradeId === nextGrade.id);
        setSelectedPathwayId(pws[0]?.id ?? null);
        setSelectedDivisionId(null);
      } else {
        setSelectedDivisionId(null);
        setSelectedPathwayId(null);
      }
    } else {
      setSelectedDivisionId(null);
      setSelectedPathwayId(null);
    }
  };

  const handleSelectGrade = (grade: CurriculumGradeItem) => {
    if (!overview) return;
    setSelectedGradeId(grade.id);
    setSelectedSubject(null);
    setTeachers([]);
    if (selectedSystem?.code === 'GENERAL_SECONDARY') {
      const divs = overview.divisions.filter((d) => d.gradeId === grade.id);
      setSelectedDivisionId(divs[0]?.id ?? null);
      setSelectedPathwayId(null);
    } else if (selectedSystem?.code === 'EGYPTIAN_BACCALAUREATE') {
      const pws = overview.pathways.filter((p) => p.gradeId === grade.id);
      setSelectedPathwayId(pws[0]?.id ?? null);
      setSelectedDivisionId(null);
    } else {
      setSelectedDivisionId(null);
      setSelectedPathwayId(null);
    }
  };

  const loadSubjects = useCallback(async () => {
    if (!selectedSystemId || !selectedGradeId || !selectedSystem || !selectedGrade) {
      setSubjects([]);
      return;
    }

    const needsDivision =
      selectedSystem.code === 'GENERAL_SECONDARY' && selectedGrade.gradeNumber >= 2;
    const needsPathway =
      selectedSystem.code === 'EGYPTIAN_BACCALAUREATE' &&
      selectedGrade.gradeNumber >= 2;

    if (needsDivision && !selectedDivisionId) {
      setSubjects([]);
      return;
    }
    if (needsPathway && !selectedPathwayId) {
      setSubjects([]);
      return;
    }

    setLoadingSubjects(true);
    setSubjectsError(null);
    try {
      const params = new URLSearchParams();
      params.set('systemId', String(selectedSystemId));
      params.set('gradeId', String(selectedGradeId));
      if (selectedVersionId) params.set('versionId', String(selectedVersionId));
      if (selectedYearId) params.set('academicYearId', String(selectedYearId));
      if (needsDivision && selectedDivisionId) {
        params.set('divisionId', String(selectedDivisionId));
      }
      if (needsPathway && selectedPathwayId) {
        params.set('pathwayId', String(selectedPathwayId));
      }
      if (subjectCategoryFilter !== 'ALL') {
        params.set('category', subjectCategoryFilter);
      }
      if (subjectSearch.trim()) {
        params.set('q', subjectSearch.trim());
      }

      const res = await apiFetch<{ subjects: CurriculumSubjectItem[] }>(
        `/api/curriculum/subjects?${params.toString()}`
      );
      setSubjects(res.subjects);
      if (res.subjects.length > 0) {
        setSelectedSubject((prev) =>
          prev && res.subjects.some((s) => s.id === prev.id) ? prev : null
        );
      } else {
        setSelectedSubject(null);
      }
    } catch (err) {
      setSubjectsError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر تحميل المواد الدراسية.'
          : 'Failed to load curriculum subjects.'
      );
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }, [
    selectedSystemId,
    selectedGradeId,
    selectedSystem,
    selectedGrade,
    selectedDivisionId,
    selectedPathwayId,
    selectedVersionId,
    selectedYearId,
    subjectCategoryFilter,
    subjectSearch,
    isAr,
  ]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const loadTeachersForSubject = useCallback(async () => {
    if (!selectedSubject) {
      setTeachers([]);
      setTeachersTotal(0);
      return;
    }
    setLoadingTeachers(true);
    setTeachersError(null);
    try {
      const params = new URLSearchParams();
      if (teacherQ.trim()) params.set('q', teacherQ.trim());
      if (teacherDelivery) params.set('deliveryMode', teacherDelivery);
      if (teacherLanguage) params.set('language', teacherLanguage);
      if (teacherReligiousVariant) {
        params.set('religiousVariant', teacherReligiousVariant);
      }
      if (teacherHasSessionsOnly) params.set('hasSessions', 'true');
      params.set('sort', teacherSort);

      const res = await apiFetch<{
        total: number;
        teachers: DiscoveredTeacherItem[];
      }>(
        `/api/curriculum/subjects/${selectedSubject.id}/teachers?${params.toString()}`
      );
      setTeachers(res.teachers);
      setTeachersTotal(res.total);
    } catch (err) {
      setTeachersError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر جلب المعلّمين لهذه المادة.'
          : 'Failed to load matching teachers.'
      );
      setTeachers([]);
    } finally {
      setLoadingTeachers(false);
    }
  }, [
    selectedSubject,
    teacherQ,
    teacherDelivery,
    teacherLanguage,
    teacherReligiousVariant,
    teacherHasSessionsOnly,
    teacherSort,
    isAr,
  ]);

  useEffect(() => {
    loadTeachersForSubject();
  }, [loadTeachersForSubject]);

  const handleBookSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSession) return;
    setBookingSubmitting(true);
    setBookingError(null);
    setBookingFeedback(null);
    try {
      await apiFetch(`/api/teaching-sessions/${bookingSession.session.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ notes: bookingNotes.trim() || undefined }),
      });
      setBookingSession(null);
      setBookingNotes('');
      setBookingFeedback(
        isAr
          ? 'تم إرسال طلب الحجز بنجاح! سيقوم المعلّم بمراجعة الطلب وتأكيد الموعد.'
          : 'Booking request submitted! The teacher will review and confirm your seat.'
      );
      await Promise.all([loadTeachersForSubject(), loadSubjects()]);
    } catch (err) {
      setBookingError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر إرسال طلب الحجز.'
          : 'Could not submit booking request.'
      );
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCancelMyEnrollment = async (enrollmentId: number) => {
    setBookingError(null);
    setBookingFeedback(null);
    try {
      await apiFetch(`/api/session-enrollments/${enrollmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setBookingFeedback(
        isAr
          ? 'تم إلغاء طلب الحجز وتحديث المقاعد المتاحة.'
          : 'Booking request cancelled.'
      );
      await Promise.all([loadTeachersForSubject(), loadSubjects()]);
    } catch (err) {
      setBookingError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر إلغاء الطلب.'
          : 'Could not cancel request.'
      );
    }
  };

  const formatSubjectClassification = (cs: CurriculumSubjectItem): string[] => {
    const tokens: string[] = [];
    if (cs.isCompulsory) {
      tokens.push(isAr ? 'إلزامية' : 'Compulsory');
    } else if (cs.isElective) {
      tokens.push(isAr ? 'اختيارية (تختار مادة واحدة)' : 'Elective (Choose One)');
    }
    if (cs.isSpecialization) {
      tokens.push(isAr ? 'مادة تخصص' : 'Specialization');
    }
    if (cs.isIncludedInTotal) {
      tokens.push(isAr ? 'داخل المجموع' : 'Included in Total');
    } else if (cs.isActivity) {
      tokens.push(isAr ? 'نشاط تربوي / مدرسي' : 'Educational Activity');
    } else {
      tokens.push(isAr ? 'خارج المجموع' : 'Non-Total');
    }
    if (cs.isPassFail) {
      tokens.push(
        cs.passThresholdPercent
          ? isAr
            ? `نجاح ورسوب (الحد الأدنى ${cs.passThresholdPercent}%)`
            : `Pass/Fail (${cs.passThresholdPercent}% pass)`
          : isAr
          ? 'نجاح ورسوب'
          : 'Pass/Fail'
      );
    }
    return tokens;
  };

  const formatLanguages = (codes: string[]): string => {
    return codes
      .map((c) => {
        const entry = LANGUAGE_OF_INSTRUCTION_LABELS[c];
        return entry ? (isAr ? entry.ar : entry.en) : c;
      })
      .join(' / ');
  };

  const formatVariants = (variants: string[]): string | null => {
    if (!variants || variants.length === 0) return null;
    return variants
      .map((v) => {
        if (v === 'CONNECT') return 'Connect';
        if (v === 'CONNECT_PLUS') return 'Connect Plus';
        if (v === 'ISLAMIC') return isAr ? 'تربية دينية إسلامية' : 'Islamic';
        if (v === 'CHRISTIAN') return isAr ? 'تربية دينية مسيحية' : 'Christian';
        if (v === 'GENERAL_FOREIGN_LANG') {
          return isAr
            ? 'فرنسية / ألمانية / إيطالية / إسبانية / صينية'
            : 'French / German / Italian / Spanish / Chinese';
        }
        return v;
      })
      .join(' · ');
  };

  return (
    <div data-testid="educational-stages-page">
      <PageHeader
        kicker={
          isAr
            ? 'التعليم العام المصري · منهج 2026/2027'
            : 'Egyptian General Education · 2026/2027 Curriculum'
        }
        title={
          isAr
            ? 'المراحل التعليمية والمناهج الدراسية'
            : 'Educational Stages & Egyptian Curriculum'
        }
        subtitle={
          isAr
            ? 'تصفّح المرحلة والنظام التعليمي والصف الدراسي والشعبة أو المسار لاستعراض المواد الرسمية المقررة واكتشاف المعلّمين المتخصصين وحجز الدروس الفردية والجماعية.'
            : 'Select your stage, educational system, grade, and division or pathway to explore official subjects, discover assigned teachers, and book 1:1 or group sessions.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {overview && overview.academicYears.length > 0 && (
              <select
                value={selectedYearId || ''}
                onChange={(e) => {
                  const yId = Number(e.target.value);
                  setSelectedYearId(yId);
                  const matchedVer = overview.versions.find(
                    (v) => v.academicYearId === yId && v.isActive
                  );
                  if (matchedVer) setSelectedVersionId(matchedVer.id);
                }}
                aria-label={isAr ? 'العام الدراسي' : 'Academic Year'}
                className="jusoor-select px-3 py-2 text-xs sm:text-sm font-semibold"
              >
                {overview.academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {isAr ? y.nameAr : y.nameEn}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setLocale(isAr ? 'en' : 'ar')}
              className="btn-jusoor-outline px-3.5 py-2 text-xs cursor-pointer"
            >
              {isAr ? 'English (LTR)' : 'العربية (RTL)'}
            </button>
          </div>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
        {/* Stepper Selector Card */}
        <section className="jusoor-card p-4 sm:p-5 space-y-5">
          {loadingOverview ? (
            <LoadingSkeleton variant="kpis" count={3} />
          ) : overviewError ? (
            <StateBanner variant="error" message={overviewError} />
          ) : overview ? (
            <div className="space-y-5">
              {/* Step 1: Stage */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5">
                  <i className="bi bi-layers text-[#0F766E]" aria-hidden="true" />
                  <span>
                    {isAr
                      ? '1. اختر المرحلة التعليمية'
                      : '1. Select Educational Stage'}
                  </span>
                </div>
                <div className="row g-3">
                  {overview.stages.map((stage) => {
                    const isActive = stage.id === selectedStageId;
                    return (
                      <div key={stage.id} className="col-12 col-sm-4">
                        <button
                          type="button"
                          onClick={() => handleSelectStage(stage)}
                          data-testid={`stage-btn-${stage.slug}`}
                          className={`w-full p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#0F766E] text-white border-[#0F766E]'
                              : 'bg-[#F5F8FC] text-[#102A43] border-[#DCE5F0] hover:border-[#247BA0]'
                          }`}
                        >
                          <div className="font-display text-base font-bold">
                            {isAr ? stage.nameAr : stage.nameEn}
                          </div>
                          <div
                            className={`text-xs mt-1 ${
                              isActive ? 'text-teal-100' : 'text-[#64748B]'
                            }`}
                          >
                            {isAr ? stage.nameEn : stage.nameAr}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Educational System */}
              {availableSystems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#102A43]">
                    {isAr ? '2. النظام التعليمي' : '2. Educational System'}
                  </div>
                  <div className="row g-3">
                    {availableSystems.map((sys) => {
                      const isActive = sys.id === selectedSystemId;
                      return (
                        <div
                          key={sys.id}
                          className={
                            availableSystems.length > 1
                              ? 'col-12 col-sm-6'
                              : 'col-12'
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectSystem(sys)}
                            data-testid={`system-btn-${sys.code}`}
                            className={`w-full p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[#102A43] text-white border-[#102A43]'
                                : 'bg-white text-[#102A43] border-[#DCE5F0] hover:border-[#247BA0]'
                            }`}
                          >
                            <div className="font-display text-sm sm:text-base font-bold">
                              {isAr ? sys.nameAr : sys.nameEn}
                            </div>
                            {(sys.descriptionAr || sys.descriptionEn) && (
                              <p
                                className={`text-xs mt-1 leading-relaxed mb-0 ${
                                  isActive ? 'text-slate-300' : 'text-[#64748B]'
                                }`}
                              >
                                {isAr ? sys.descriptionAr : sys.descriptionEn}
                              </p>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Grade */}
              {availableGrades.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#102A43]">
                    {isAr ? '3. الصف الدراسي' : '3. Grade Level'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableGrades.map((grade) => {
                      const isActive = grade.id === selectedGradeId;
                      return (
                        <button
                          key={grade.id}
                          type="button"
                          onClick={() => handleSelectGrade(grade)}
                          data-testid={`grade-btn-${grade.slug}`}
                          className={`px-4 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#0F766E] text-white border-[#0F766E]'
                              : 'bg-white text-[#172B4D] border-[#C5D3E3] hover:border-[#247BA0]'
                          }`}
                        >
                          {isAr ? grade.nameAr : grade.nameEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4A: Division */}
              {availableDivisions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#102A43]">
                    {isAr
                      ? '4. اختر الشعبة الدراسية (الثانوية العامة)'
                      : '4. Select Division (General Secondary)'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableDivisions.map((div) => {
                      const isActive = div.id === selectedDivisionId;
                      return (
                        <button
                          key={div.id}
                          type="button"
                          onClick={() => {
                            setSelectedDivisionId(div.id);
                            setSelectedSubject(null);
                            setTeachers([]);
                          }}
                          data-testid={`division-btn-${div.code}`}
                          className={`px-4 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#102A43] text-white border-[#102A43]'
                              : 'bg-[#F5F8FC] text-[#172B4D] border-[#C5D3E3] hover:border-[#247BA0]'
                          }`}
                        >
                          {isAr ? div.nameAr : div.nameEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4B: Pathway */}
              {availablePathways.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#102A43]">
                    {isAr
                      ? '4. اختر المسار التخصصي (البكالوريا المصرية)'
                      : '4. Select Pathway (Egyptian Baccalaureate)'}
                  </div>
                  <div className="row g-3">
                    {availablePathways.map((pw) => {
                      const isActive = pw.id === selectedPathwayId;
                      return (
                        <div key={pw.id} className="col-12 col-sm-6 col-lg-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPathwayId(pw.id);
                              setSelectedSubject(null);
                              setTeachers([]);
                            }}
                            data-testid={`pathway-btn-${pw.code}`}
                            className={`w-full p-3.5 rounded-xl border text-start transition-colors cursor-pointer h-full ${
                              isActive
                                ? 'bg-[#102A43] text-white border-[#102A43]'
                                : 'bg-[#F5F8FC] text-[#102A43] border-[#DCE5F0] hover:border-[#247BA0]'
                            }`}
                          >
                            <div className="text-sm font-bold">
                              {isAr ? pw.nameAr : pw.nameEn}
                            </div>
                            {(pw.descriptionAr || pw.descriptionEn) && (
                              <div
                                className={`text-[11px] mt-1 ${
                                  isActive ? 'text-slate-300' : 'text-[#64748B]'
                                }`}
                              >
                                {isAr ? pw.descriptionAr : pw.descriptionEn}
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* Step 5: Curriculum Subjects Browser */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#102A43] m-0">
                {isAr ? 'المواد الدراسية المقررة' : 'Curriculum Subjects'}{' '}
                <span className="font-mono-num text-base font-bold text-[#0F766E]">
                  ({subjects.length})
                </span>
              </h2>
              {selectedGrade && selectedSystem && (
                <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
                  {isAr ? selectedSystem.nameAr : selectedSystem.nameEn} ·{' '}
                  {isAr ? selectedGrade.nameAr : selectedGrade.nameEn}
                  {selectedDivisionId &&
                    availableDivisions.find((d) => d.id === selectedDivisionId) &&
                    ` · ${
                      isAr
                        ? availableDivisions.find((d) => d.id === selectedDivisionId)!
                            .nameAr
                        : availableDivisions.find((d) => d.id === selectedDivisionId)!
                            .nameEn
                    }`}
                  {selectedPathwayId &&
                    availablePathways.find((p) => p.id === selectedPathwayId) &&
                    ` · ${
                      isAr
                        ? availablePathways.find((p) => p.id === selectedPathwayId)!
                            .nameAr
                        : availablePathways.find((p) => p.id === selectedPathwayId)!
                            .nameEn
                    }`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <i
                  className="bi bi-search text-[#64748B] text-xs absolute top-1/2 -translate-y-1/2 start-3"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث باسم المادة...' : 'Search subjects...'}
                  className="jusoor-input ps-8 pe-3 py-2 text-xs sm:text-sm w-56"
                />
              </div>

              <select
                value={subjectCategoryFilter}
                onChange={(e) =>
                  setSubjectCategoryFilter(
                    e.target.value as typeof subjectCategoryFilter
                  )
                }
                aria-label={isAr ? 'تصنيف المواد' : 'Subject category'}
                className="jusoor-select px-3 py-2 text-xs sm:text-sm"
              >
                <option value="ALL">
                  {isAr ? 'جميع المواد والأنشطة' : 'All Subjects & Activities'}
                </option>
                <option value="CORE">
                  {isAr ? 'المواد الأساسية (داخل المجموع)' : 'Core Total Subjects'}
                </option>
                <option value="SPECIALIZATION_ELECTIVE">
                  {isAr
                    ? 'المواد التخصصية والاختيارية'
                    : 'Specialization & Elective'}
                </option>
                <option value="NON_TOTAL">
                  {isAr
                    ? 'مواد خارج المجموع / نجاح ورسوب'
                    : 'Non-Total & Pass/Fail'}
                </option>
                <option value="ACTIVITY">
                  {isAr ? 'الأنشطة التربوية والمدرسية' : 'Activities'}
                </option>
              </select>
            </div>
          </div>

          {subjectsError && <StateBanner variant="error" message={subjectsError} />}

          {loadingSubjects ? (
            <LoadingSkeleton variant="cards" count={6} />
          ) : subjects.length === 0 ? (
            <EmptyState
              icon="bi-book"
              title={
                isAr
                  ? 'لا توجد مواد مطابقة في هذا الاختيار'
                  : 'No subjects match the current selection'
              }
              description={
                isAr
                  ? 'جرّب تغيير تصنيف المواد أو البحث بكلمة مختلفة.'
                  : 'Try changing the category filter or search query.'
              }
            />
          ) : (
            <div className="row g-3 g-md-4">
              {subjects.map((cs) => {
                const isSelected = selectedSubject?.id === cs.id;
                const classifications = formatSubjectClassification(cs);
                const variantsLabel = formatVariants(cs.curriculumVariants);

                return (
                  <div key={cs.id} className="col-12 col-md-6 col-lg-4">
                    <article
                      data-testid={`curriculum-subject-card-${cs.id}`}
                      className={`jusoor-card jusoor-card-interactive p-4 sm:p-5 h-full flex flex-col justify-between gap-4 ${
                        isSelected ? 'border-[#0F766E] ring-1 ring-[#0F766E]' : ''
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="text-[11px] font-medium text-[#64748B] flex flex-wrap items-center gap-1.5">
                          {classifications.map((tok, idx) => (
                            <React.Fragment key={tok}>
                              {idx > 0 && <span aria-hidden="true">·</span>}
                              <span
                                className={
                                  tok.includes('داخل المجموع') ||
                                  tok.includes('Included in Total')
                                    ? 'text-[#0F766E] font-bold'
                                    : tok.includes('خارج المجموع') ||
                                      tok.includes('Non-Total')
                                    ? 'text-[#B45309] font-semibold'
                                    : ''
                                }
                              >
                                {tok}
                              </span>
                            </React.Fragment>
                          ))}
                        </div>

                        <h3 className="font-display text-base font-bold text-[#102A43] leading-snug m-0">
                          {isAr ? cs.subjectNameAr : cs.subjectNameEn}
                        </h3>

                        <div className="text-xs text-[#64748B] space-y-1">
                          <div>
                            {isAr ? 'لغة الدراسة:' : 'Instruction:'}{' '}
                            <span className="font-semibold text-[#172B4D]">
                              {formatLanguages(cs.languagesOfInstruction)}
                            </span>
                          </div>
                          {variantsLabel && (
                            <div>
                              {isAr ? 'المسارات المتاحة:' : 'Variants:'}{' '}
                              <span className="font-semibold text-[#172B4D]">
                                {variantsLabel}
                              </span>
                            </div>
                          )}
                          {(cs.notesAr || cs.notesEn) && (
                            <p className="text-xs text-[#64748B] line-clamp-2 pt-0.5 mb-0">
                              {isAr ? cs.notesAr : cs.notesEn}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#EDF2F7] flex items-center justify-between gap-2 text-xs">
                        <div className="text-[#64748B] tabular-nums">
                          <span className="font-bold text-[#102A43]">
                            {cs.activeTeachersCount}
                          </span>{' '}
                          {isAr ? 'معلّم' : 'teachers'} ·{' '}
                          <span className="font-bold text-[#0F766E]">
                            {cs.sessionsCount}
                          </span>{' '}
                          {isAr ? 'جلسة' : 'sessions'}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            shouldScrollToTeachersRef.current = true;
                            setSelectedSubject(cs);
                            setTeacherQ('');
                            setTeacherDelivery('');
                            setTeacherLanguage('');
                            setTeacherReligiousVariant('');
                            setBookingFeedback(null);
                            setBookingError(null);
                          }}
                          data-testid={`discover-teachers-btn-${cs.id}`}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isSelected ? 'btn-jusoor-navy' : 'btn-jusoor-primary'
                          }`}
                        >
                          <span>
                            {isSelected
                              ? isAr
                                ? 'محددة الآن'
                                : 'Selected'
                              : isAr
                              ? 'عرض المعلّمين'
                              : 'View Teachers'}
                          </span>
                          <i
                            className={`bi ${
                              isAr ? 'bi-arrow-left' : 'bi-arrow-right'
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 6: Discovered Teachers & Integrated Session Booking */}
        {selectedSubject && (
          <section
            ref={teachersSectionRef}
            id="curriculum-teachers-section"
            className="scroll-mt-24 jusoor-card p-4 sm:p-6 space-y-5"
            data-testid="discovered-teachers-section"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#DCE5F0]">
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#0F766E]">
                  {isAr
                    ? 'المعلّمون المخصصون لهذه المادة'
                    : 'Assigned Teachers for Subject'}
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#102A43] m-0">
                  {isAr
                    ? selectedSubject.subjectNameAr
                    : selectedSubject.subjectNameEn}{' '}
                  <span className="text-base font-semibold text-[#64748B] font-mono-num">
                    ({teachersTotal})
                  </span>
                </h2>
                <p className="text-xs text-[#64748B] m-0">
                  {isAr ? selectedGrade?.nameAr : selectedGrade?.nameEn} ·{' '}
                  {isAr
                    ? 'يمكنك التصفية وحجز جلسة فردية أو جماعية مباشرة أو زيارة الملف العام للمعلّم.'
                    : 'Filter available teachers, view full profiles, or request a 1:1 / group session directly.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                className="btn-jusoor-outline self-start px-3.5 py-2 text-xs cursor-pointer"
              >
                {isAr ? 'إغلاق نتائج المعلّمين' : 'Close Results'}
              </button>
            </div>

            {/* Discovery Filters Bar */}
            <div className="jusoor-subcard p-3.5 row g-2.5 m-0">
              <div className="col-12 col-sm-6 col-lg-4">
                <div className="relative">
                  <i
                    className="bi bi-search text-[#64748B] text-xs absolute top-1/2 -translate-y-1/2 start-3"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={teacherQ}
                    onChange={(e) => setTeacherQ(e.target.value)}
                    placeholder={
                      isAr
                        ? 'ابحث باسم المعلّم أو التخصص...'
                        : 'Search teacher name or bio...'
                    }
                    className="jusoor-input w-full ps-8 pe-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="col-6 col-sm-3 col-lg-2">
                <select
                  value={teacherDelivery}
                  onChange={(e) => setTeacherDelivery(e.target.value)}
                  aria-label={isAr ? 'طريقة التدريس' : 'Delivery Mode'}
                  className="jusoor-select w-full px-3 py-2 text-xs"
                >
                  <option value="">
                    {isAr ? 'أونلاين وحضوري' : 'Online & In-person'}
                  </option>
                  <option value="ONLINE">{isAr ? 'أونلاين فقط' : 'Online Only'}</option>
                  <option value="IN_PERSON">
                    {isAr ? 'حضوري فقط' : 'In-person Only'}
                  </option>
                </select>
              </div>

              <div className="col-6 col-sm-3 col-lg-2">
                <select
                  value={teacherLanguage}
                  onChange={(e) => setTeacherLanguage(e.target.value)}
                  aria-label={isAr ? 'لغة الشرح' : 'Language'}
                  className="jusoor-select w-full px-3 py-2 text-xs"
                >
                  <option value="">{isAr ? 'كل اللغات' : 'All Languages'}</option>
                  {selectedSubject.languagesOfInstruction.map((langCode) => (
                    <option key={langCode} value={langCode}>
                      {isAr
                        ? LANGUAGE_OF_INSTRUCTION_LABELS[langCode]?.ar || langCode
                        : LANGUAGE_OF_INSTRUCTION_LABELS[langCode]?.en || langCode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-sm-4 col-lg-2">
                <select
                  value={teacherSort}
                  onChange={(e) =>
                    setTeacherSort(e.target.value as typeof teacherSort)
                  }
                  aria-label={isAr ? 'الترتيب' : 'Sort by'}
                  className="jusoor-select w-full px-3 py-2 text-xs"
                >
                  <option value="rating">
                    {isAr ? 'الأعلى تقييماً' : 'Highest Rated'}
                  </option>
                  <option value="sessions">
                    {isAr ? 'الأكثر جلسات متاحة' : 'Most Sessions'}
                  </option>
                  <option value="price_asc">
                    {isAr ? 'الأقل سعراً' : 'Price: Low to High'}
                  </option>
                  <option value="price_desc">
                    {isAr ? 'الأعلى سعراً' : 'Price: High to Low'}
                  </option>
                  <option value="experience">
                    {isAr ? 'سنوات الخبرة' : 'Most Experienced'}
                  </option>
                </select>
              </div>

              <div className="col-6 col-sm-4 col-lg-2 flex items-center">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#172B4D] px-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={teacherHasSessionsOnly}
                    onChange={(e) => setTeacherHasSessionsOnly(e.target.checked)}
                  />
                  <span>{isAr ? 'بجلسات مفتوحة فقط' : 'Open sessions'}</span>
                </label>
              </div>

              {selectedSubject.curriculumVariants.some(
                (v) => v === 'ISLAMIC' || v === 'CHRISTIAN'
              ) && (
                <div className="col-12 col-sm-4">
                  <select
                    value={teacherReligiousVariant}
                    onChange={(e) => setTeacherReligiousVariant(e.target.value)}
                    aria-label={isAr ? 'مسار التربية الدينية' : 'Religious Track'}
                    className="jusoor-select w-full px-3 py-2 text-xs"
                  >
                    <option value="">
                      {isAr ? 'كل مسارات التربية الدينية' : 'All Religious Tracks'}
                    </option>
                    <option value="ISLAMIC">
                      {isAr ? 'التربية الدينية الإسلامية' : 'Islamic Religion'}
                    </option>
                    <option value="CHRISTIAN">
                      {isAr ? 'التربية الدينية المسيحية' : 'Christian Religion'}
                    </option>
                  </select>
                </div>
              )}
            </div>

            {bookingFeedback && (
              <StateBanner
                variant="success"
                message={bookingFeedback}
                onDismiss={() => setBookingFeedback(null)}
              />
            )}
            {bookingError && (
              <StateBanner
                variant="error"
                message={bookingError}
                onDismiss={() => setBookingError(null)}
              />
            )}
            {teachersError && <StateBanner variant="error" message={teachersError} />}

            {loadingTeachers ? (
              <LoadingSkeleton variant="list" count={2} />
            ) : teachers.length === 0 ? (
              <EmptyState
                icon="bi-sliders"
                title={
                  isAr
                    ? 'لا يوجد معلّمون متطابقون مع معايير البحث الحالية'
                    : 'No assigned teachers match these filters'
                }
                description={
                  isAr
                    ? 'يمكنك إزالة أحد الفلاتر أو تعيين معلّم لهذه المادة من لوحة المعلّم أو الإدارة.'
                    : 'Try clearing some filters or assign a teacher to this subject.'
                }
              />
            ) : (
              <div className="space-y-4">
                {teachers.map((teacher) => (
                  <article
                    key={teacher.teacherId}
                    data-testid={`discovered-teacher-card-${teacher.teacherId}`}
                    className="jusoor-card p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        {teacher.avatarUrl ? (
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#DCE5F0] shrink-0 bg-[#EEF4FA]">
                            <SafeImage
                              src={teacher.avatarUrl}
                              alt={teacher.fullName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-[#E8F8F5] border border-[#99E2D8] text-[#0F766E] flex items-center justify-center font-display text-xl font-bold shrink-0">
                            {getInitials(teacher.fullName)}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                            {teacher.verificationStatus === 'VERIFIED' && (
                              <span className="inline-flex items-center gap-1 text-[#0F766E] font-bold">
                                <i className="bi bi-patch-check-fill text-[#20B8A6]" aria-hidden="true" />
                                <span>{isAr ? 'معلّم موثّق' : 'Verified'}</span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-[#B45309] font-mono-num font-bold">
                              <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                              {teacher.ratingAvg.toFixed(1)} ({teacher.reviewsCount})
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {teacher.yearsExperience}{' '}
                              {isAr ? 'سنوات خبرة' : 'yrs exp.'}
                            </span>
                          </div>

                          <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                            <Link
                              to={`/instructors/${teacher.teacherId}`}
                              className="text-[#102A43] hover:text-[#247BA0]"
                            >
                              {teacher.fullName}
                            </Link>
                          </h3>

                          <div className="text-xs font-semibold text-[#0F766E]">
                            {teacher.jobTitle}
                          </div>

                          {teacher.bio && (
                            <p className="text-xs sm:text-sm text-[#64748B] max-w-3xl line-clamp-2 m-0">
                              {teacher.bio}
                            </p>
                          )}

                          <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-2 pt-1">
                            <span>
                              {isAr ? 'لغات الشرح:' : 'Languages:'}{' '}
                              <strong className="text-[#102A43]">
                                {formatLanguages(teacher.languagesOffered)}
                              </strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {teacher.supportsOnline && teacher.supportsInPerson
                                ? isAr
                                  ? 'أونلاين وحضوري'
                                  : 'Online & In-person'
                                : teacher.supportsOnline
                                ? isAr
                                  ? 'أونلاين'
                                  : 'Online'
                                : isAr
                                ? 'حضوري'
                                : 'In-person'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {teacher.publishedCoursesCount}{' '}
                              {isAr ? 'دورات منشورة' : 'published courses'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#EDF2F7]">
                        <div className="text-end">
                          <div className="font-mono-num text-xl font-extrabold text-[#102A43]">
                            {formatCurrencyPrice(
                              teacher.effectivePrice,
                              teacher.currency || 'EGP',
                              locale
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {isAr ? 'متوسط سعر الحصة' : 'Hourly / Session rate'}
                          </div>
                        </div>

                        <Link
                          to={`/instructors/${teacher.teacherId}`}
                          data-testid={`teacher-profile-link-${teacher.teacherId}`}
                          className="btn-jusoor-navy px-4 py-2 text-xs whitespace-nowrap"
                        >
                          {isAr
                            ? 'عرض الملف العام والجلسات'
                            : 'View Profile & Sessions'}
                        </Link>
                      </div>
                    </div>

                    {teacher.teachingAssignmentsSummary.length > 0 && (
                      <div className="jusoor-subcard text-xs text-[#64748B] px-3.5 py-2.5">
                        <span className="font-bold text-[#102A43]">
                          {isAr ? 'المواد والصفوف التي يدرّسها:' : 'Teaches:'}{' '}
                        </span>
                        {teacher.teachingAssignmentsSummary
                          .slice(0, 5)
                          .map((item) =>
                            isAr
                              ? `${item.subjectNameAr} (${item.gradeNameAr})`
                              : `${item.subjectNameEn} (${item.gradeNameEn})`
                          )
                          .join(' · ')}
                        {teacher.teachingAssignmentsSummary.length > 5 &&
                          ` (+${teacher.teachingAssignmentsSummary.length - 5})`}
                      </div>
                    )}

                    {/* Directly Bookable Sessions */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold text-[#102A43] flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {isAr
                            ? 'الجلسات الفردية والجماعية المتاحة للحجز الآن'
                            : 'Available 1:1 & Group Sessions'}
                        </span>
                        <span className="text-[#64748B] tabular-nums font-medium">
                          {isAr
                            ? teacher.onlineGroupSessionsCount !== undefined
                              ? `${teacher.onlineGroupSessionsCount} جماعية أونلاين · ${
                                  teacher.onlineIndividualSlotsCount ?? 0
                                } فردية أونلاين · ${
                                  teacher.offlineGroupSessionsCount ?? 0
                                } جماعية أوفلاين`
                              : `${teacher.individualSessionsCount} فردية · ${teacher.groupSessionsCount} جماعية`
                            : `${teacher.individualSessionsCount} 1:1 · ${teacher.groupSessionsCount} Group`}
                        </span>
                      </div>

                      {teacher.sessions.length === 0 ? (
                        <div className="text-xs text-[#64748B] py-2">
                          {isAr
                            ? 'لا توجد جلسات مجدولة لهذه المادة حالياً. يمكنك زيارة ملف المعلّم لعرض باقي مواعيده.'
                            : 'No upcoming curriculum-linked sessions yet. Visit the teacher profile for more slots.'}
                        </div>
                      ) : (
                        <>
                          <div className="row g-3">
                            {(() => {
                              const onlineGrp = teacher.sessions.filter(
                                (x) =>
                                  x.sessionType === 'GROUP' &&
                                  !isOfflineDeliveryMode(x.deliveryMode)
                              );
                              const online1on1 = teacher.sessions.filter(
                                (x) =>
                                  x.sessionType === 'ONE_TO_ONE' &&
                                  !isOfflineDeliveryMode(x.deliveryMode)
                              );
                              const offlineGrp = teacher.sessions.filter(
                                (x) =>
                                  x.sessionType === 'GROUP' &&
                                  isOfflineDeliveryMode(x.deliveryMode)
                              );
                              const picked = new Map<
                                number,
                                DiscoveredTeacherSessionItem
                              >();
                              for (const item of [
                                ...online1on1.slice(0, 2),
                                ...onlineGrp.slice(0, 2),
                                ...offlineGrp.slice(0, 2),
                                ...teacher.sessions,
                              ]) {
                                if (picked.size >= 6) break;
                                picked.set(item.id, item);
                              }
                              return Array.from(picked.values());
                            })().map((sess) => {
                              const myEnr = sess.myEnrollment;
                              const isOwn = user?.id === sess.teacherUserId;
                              const isOffline = isOfflineDeliveryMode(
                                sess.deliveryMode
                              );
                              return (
                                <div key={sess.id} className="col-12 col-md-6">
                                  <div
                                    data-testid={`discovery-session-card-${sess.id}`}
                                    className="jusoor-subcard p-3.5 h-full flex flex-col justify-between gap-2.5"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="font-semibold text-[#102A43] inline-flex items-center gap-1">
                                          <i
                                            className={`bi ${
                                              sess.sessionType === 'ONE_TO_ONE'
                                                ? 'bi-person-video text-[#247BA0]'
                                                : 'bi-people-fill text-[#0F766E]'
                                            }`}
                                            aria-hidden="true"
                                          />
                                          {isAr
                                            ? SESSION_TYPE_LABELS_AR[sess.sessionType]
                                            : sess.sessionType === 'ONE_TO_ONE'
                                            ? '1:1 Individual'
                                            : 'Group Session'}
                                          {sess.sessionType === 'ONE_TO_ONE' &&
                                            sess.slotStatus && (
                                              <span className="text-[#0F766E] mr-1">
                                                ·{' '}
                                                {INDIVIDUAL_SLOT_STATUS_LABELS_AR[
                                                  sess.slotStatus
                                                ] || sess.slotStatus}
                                              </span>
                                            )}
                                        </span>
                                        <span className="font-mono-num font-bold text-[#102A43]">
                                          {formatCurrencyPrice(
                                            sess.price,
                                            sess.currency || 'EGP',
                                            locale
                                          )}
                                        </span>
                                      </div>

                                      <div className="text-sm font-bold text-[#102A43]">
                                        {sess.title}
                                      </div>

                                      <div className="text-[11px] text-[#64748B] space-y-1">
                                        <div className="flex items-center gap-1 font-mono-num">
                                          <i
                                            className="bi bi-clock text-[#0F766E] shrink-0"
                                            aria-hidden="true"
                                          />
                                          <span>
                                            {formatSessionDateRange(
                                              sess.startTime,
                                              sess.endTime,
                                              locale
                                            )}
                                          </span>
                                          <span>({sess.durationMinutes} د)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="inline-flex items-center gap-1">
                                            <i
                                              className={`bi ${
                                                !isOffline
                                                  ? 'bi-camera-video'
                                                  : 'bi-geo-alt'
                                              } text-[#0F766E]`}
                                              aria-hidden="true"
                                            />
                                            {isAr
                                              ? DELIVERY_MODE_LABELS_AR[
                                                  sess.deliveryMode
                                                ]
                                              : sess.deliveryMode}
                                          </span>
                                          <span className="tabular-nums font-semibold text-[#0F766E]">
                                            {isAr
                                              ? `المتبقي: ${sess.remainingSeats}/${sess.capacity}`
                                              : `${sess.remainingSeats}/${sess.capacity} seats left`}
                                          </span>
                                        </div>
                                        {isOffline && sess.location && (
                                          <div className="text-[#172B4D] font-medium pt-0.5">
                                            {isAr ? 'العنوان:' : 'Address:'}{' '}
                                            {sess.location}
                                            {sess.isDemoLocation &&
                                              !sess.location.includes(
                                                'موقع عرض تجريبي'
                                              ) && (
                                                <span className="text-[#64748B] font-normal mr-1">
                                                  (موقع عرض تجريبي)
                                                </span>
                                              )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="pt-2 border-t border-[#DCE5F0]">
                                      {myEnr &&
                                      (myEnr.status === 'PENDING' ||
                                        myEnr.status === 'ACCEPTED') ? (
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                          <span className="font-bold text-[#0F766E]">
                                            {isAr
                                              ? ENROLLMENT_STATUS_LABELS_AR[
                                                  myEnr.status
                                                ]
                                              : myEnr.status}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCancelMyEnrollment(myEnr.id)
                                            }
                                            className="text-[#DC2626] hover:underline font-semibold cursor-pointer"
                                          >
                                            {isAr ? 'إلغاء الطلب' : 'Cancel'}
                                          </button>
                                        </div>
                                      ) : isOwn ? (
                                        <span className="text-[11px] text-[#64748B]">
                                          {isAr
                                            ? 'جلستك الخاصة'
                                            : 'Your own session'}
                                        </span>
                                      ) : sess.isRegistrationOpen ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!user) {
                                              openAuthModal();
                                              return;
                                            }
                                            setBookingError(null);
                                            setBookingSession({
                                              session: sess,
                                              teacherName: teacher.fullName,
                                            });
                                          }}
                                          data-testid={`book-discovery-session-btn-${sess.id}`}
                                          className="btn-jusoor-primary w-full py-2 text-xs cursor-pointer"
                                        >
                                          {sess.sessionType === 'ONE_TO_ONE'
                                            ? isAr
                                              ? 'طلب جلسة فردية'
                                              : 'Request 1:1 Session'
                                            : isAr
                                            ? 'طلب انضمام للمجموعة'
                                            : 'Join Group Session'}
                                        </button>
                                      ) : (
                                        <span className="text-xs text-[#64748B]">
                                          {isAr
                                            ? 'مكتملة / مغلقة'
                                            : 'Full / Closed'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {teacher.sessions.length > 6 && (
                            <div className="pt-1">
                              <Link
                                to={`/instructors/${teacher.teacherId}`}
                                className="text-xs font-bold text-[#0F766E] hover:underline"
                              >
                                {isAr
                                  ? `عرض جميع الجلسات المتاحة للمعلّم (${teacher.sessions.length} جلسة)`
                                  : `View all ${teacher.sessions.length} available sessions`}
                              </Link>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Booking Modal */}
      {bookingSession && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-md p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
              <i className="bi bi-calendar2-check text-[#0F766E]" aria-hidden="true" />
              <span>
                {bookingSession.session.sessionType === 'ONE_TO_ONE'
                  ? isAr
                    ? 'تأكيد طلب جلسة فردية'
                    : 'Confirm 1:1 Session Request'
                  : isAr
                  ? 'طلب انضمام لجلسة جماعية'
                  : 'Request Group Session'}
              </span>
            </h3>

            <dl className="jusoor-subcard p-3.5 text-xs row g-2 m-0 text-[#64748B]">
              <div className="col-12 font-bold text-[#102A43]">
                {bookingSession.session.title}
              </div>
              <div className="col-6">
                <span>{isAr ? 'المعلّم: ' : 'Teacher: '}</span>
                <strong className="text-[#102A43]">
                  {bookingSession.teacherName}
                </strong>
              </div>
              {selectedSubject && (
                <div className="col-6">
                  <span>{isAr ? 'المادة: ' : 'Subject: '}</span>
                  <strong className="text-[#102A43]">
                    {isAr
                      ? selectedSubject.subjectNameAr
                      : selectedSubject.subjectNameEn}
                  </strong>
                </div>
              )}
              {selectedGrade && (
                <div className="col-6">
                  <span>{isAr ? 'الصف: ' : 'Grade: '}</span>
                  <strong className="text-[#102A43]">
                    {isAr ? selectedGrade.nameAr : selectedGrade.nameEn}
                  </strong>
                </div>
              )}
              <div className="col-6">
                <span>{isAr ? 'المدة: ' : 'Duration: '}</span>
                <strong className="font-mono-num text-[#102A43]">
                  {bookingSession.session.durationMinutes}{' '}
                  {isAr ? 'دقيقة' : 'min'}
                </strong>
              </div>
              <div className="col-12 font-mono-num text-[#102A43] font-semibold">
                {formatSessionDateRange(
                  bookingSession.session.startTime,
                  bookingSession.session.endTime,
                  locale
                )}
              </div>
              {isOfflineDeliveryMode(bookingSession.session.deliveryMode) &&
                bookingSession.session.location && (
                  <div className="col-12 text-[#172B4D] font-medium">
                    {isAr ? 'العنوان: ' : 'Address: '}
                    {bookingSession.session.location}
                  </div>
                )}
              <div className="col-12 font-mono-num font-bold text-[#0F766E] pt-1 border-t border-[#DCE5F0]">
                {formatCurrencyPrice(
                  bookingSession.session.price,
                  bookingSession.session.currency || 'EGP',
                  locale
                )}
              </div>
            </dl>

            <form onSubmit={handleBookSessionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  {isAr
                    ? 'ملاحظات للمعلّم (اختياري)'
                    : 'Notes for Teacher (Optional)'}
                </label>
                <textarea
                  rows={3}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder={
                    isAr
                      ? 'اذكر الدروس التي تحتاج شرحها أو أهدافك...'
                      : 'Share topics or questions you want to cover...'
                  }
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="btn-jusoor-primary flex-1 py-2.5 text-sm cursor-pointer"
                >
                  {bookingSubmitting
                    ? isAr
                      ? 'جاري الإرسال...'
                      : 'Submitting...'
                    : isAr
                    ? 'تأكيد إرسال الطلب'
                    : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setBookingSession(null)}
                  className="btn-jusoor-outline px-4 py-2.5 text-sm cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
