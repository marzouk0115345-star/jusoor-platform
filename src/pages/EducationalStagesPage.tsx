import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  MapPin,
  Search,
  Star,
  User,
  Users,
  Video,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  apiFetch,
  DELIVERY_MODE_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  formatSessionDateRange,
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

  // Selection State
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const [selectedPathwayId, setSelectedPathwayId] = useState<number | null>(null);

  // Subjects State
  const [subjects, setSubjects] = useState<CurriculumSubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectCategoryFilter, setSubjectCategoryFilter] = useState<
    'ALL' | 'CORE' | 'SPECIALIZATION_ELECTIVE' | 'NON_TOTAL' | 'ACTIVITY'
  >('ALL');
  const [subjectSearch, setSubjectSearch] = useState('');

  // Teacher Discovery State
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

  // Booking Modal State
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

  // Load initial curriculum overview once on mount (preserve selection across locale switches)
  useEffect(() => {
    let active = true;
    setLoadingOverview(true);
    apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview')
      .then((res) => {
        if (!active) return;
        setOverview(res);
        setSelectedYearId((prev) => prev ?? res.activeAcademicYear?.id ?? res.academicYears[0]?.id ?? null);
        setSelectedVersionId((prev) => prev ?? res.activeVersion?.id ?? res.versions[0]?.id ?? null);
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

  // Handlers for cascading hierarchy changes
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

  // Load subjects for active selection
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

  // Load matching teachers when a curriculum subject is selected
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

  const DirectionArrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8"
      data-testid="educational-stages-page"
    >
      {/* Page Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-semibold text-teal-700 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span>
                {isAr
                  ? 'التعليم العام المصري · منهج 2026/2027'
                  : 'Egyptian General Education · 2026/2027 Curriculum'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
              {isAr
                ? 'المراحل التعليمية والمناهج الدراسية'
                : 'Educational Stages & Egyptian Curriculum'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isAr
                ? 'تصفّح المرحلة والنظام التعليمي والصف الدراسي والشعبة أو المسار لاستعراض المواد الرسمية المقررة واكتشاف المعلّمين المتخصصين وحجز الدروس الفردية والجماعية.'
                : 'Select your stage, educational system, grade, and division or pathway to explore official subjects, discover assigned teachers, and book 1:1 or group sessions.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
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
                className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
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
              className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 cursor-pointer"
            >
              {isAr ? 'English (LTR)' : 'العربية (RTL)'}
            </button>
          </div>
        </div>

        {loadingOverview ? (
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ) : overviewError ? (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {overviewError}
          </div>
        ) : overview ? (
          <div className="space-y-6 pt-2 border-t border-slate-100">
            {/* Step 1: Stage Selector */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-700" />
                <span>
                  {isAr
                    ? '1. اختر المرحلة التعليمية'
                    : '1. Select Educational Stage'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {overview.stages.map((stage) => {
                  const isActive = stage.id === selectedStageId;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => handleSelectStage(stage)}
                      data-testid={`stage-btn-${stage.slug}`}
                      className={`p-4 rounded-xl border text-start transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50/70 text-slate-900 border-slate-200 hover:border-teal-600'
                      }`}
                    >
                      <div className="font-display text-base font-bold">
                        {isAr ? stage.nameAr : stage.nameEn}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          isActive ? 'text-teal-100' : 'text-slate-500'
                        }`}
                      >
                        {isAr ? stage.nameEn : stage.nameAr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Educational System Selector (especially Secondary: General Secondary vs Baccalaureate) */}
            {availableSystems.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700">
                  {isAr
                    ? '2. النظام التعليمي'
                    : '2. Educational System'}
                </div>
                <div
                  className={`grid grid-cols-1 ${
                    availableSystems.length > 1 ? 'sm:grid-cols-2' : ''
                  } gap-3`}
                >
                  {availableSystems.map((sys) => {
                    const isActive = sys.id === selectedSystemId;
                    return (
                      <button
                        key={sys.id}
                        type="button"
                        onClick={() => handleSelectSystem(sys)}
                        data-testid={`system-btn-${sys.code}`}
                        className={`p-4 rounded-xl border text-start transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="font-display text-sm sm:text-base font-bold">
                          {isAr ? sys.nameAr : sys.nameEn}
                        </div>
                        {(sys.descriptionAr || sys.descriptionEn) && (
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              isActive ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {isAr ? sys.descriptionAr : sys.descriptionEn}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Grade Selector */}
            {availableGrades.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700">
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
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-teal-600'
                        }`}
                      >
                        {isAr ? grade.nameAr : grade.nameEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4A: General Secondary Division Selector (Grade 2 & 3 only) */}
            {availableDivisions.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700">
                  {isAr
                    ? '4. اختر الشعبة الدراسية (الثانوية العامة)'
                    : '4. Select Division (General Secondary)'}
                </div>
                <div className="flex flex-wrap gap-2.5">
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
                        className={`px-4 py-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {isAr ? div.nameAr : div.nameEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4B: Egyptian Baccalaureate Pathway Selector (Grade 2 & 3 only) */}
            {availablePathways.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700">
                  {isAr
                    ? '4. اختر المسار التخصصي (البكالوريا المصرية)'
                    : '4. Select Pathway (Egyptian Baccalaureate)'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {availablePathways.map((pw) => {
                    const isActive = pw.id === selectedPathwayId;
                    return (
                      <button
                        key={pw.id}
                        type="button"
                        onClick={() => {
                          setSelectedPathwayId(pw.id);
                          setSelectedSubject(null);
                          setTeachers([]);
                        }}
                        data-testid={`pathway-btn-${pw.code}`}
                        className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-sm font-bold">
                          {isAr ? pw.nameAr : pw.nameEn}
                        </div>
                        {(pw.descriptionAr || pw.descriptionEn) && (
                          <div
                            className={`text-[11px] mt-1 ${
                              isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {isAr ? pw.descriptionAr : pw.descriptionEn}
                          </div>
                        )}
                      </button>
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {isAr ? 'المواد الدراسية المقررة' : 'Curriculum Subjects'}{' '}
              <span className="font-mono-num text-base font-semibold text-teal-700">
                ({subjects.length})
              </span>
            </h2>
            {selectedGrade && selectedSystem && (
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
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
              <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
              <input
                type="search"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder={isAr ? 'ابحث باسم المادة...' : 'Search subjects...'}
                className="ps-9 pe-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white w-56"
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
              className="px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-800"
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

        {subjectsError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
            {subjectsError}
          </div>
        )}

        {loadingSubjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-44 bg-white border border-slate-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-900">
              {isAr
                ? 'لا توجد مواد مطابقة في هذا الاختيار'
                : 'No subjects match the current selection'}
            </div>
            <p className="text-xs text-slate-500">
              {isAr
                ? 'جرّب تغيير تصنيف المواد أو البحث بكلمة مختلفة.'
                : 'Try changing the category filter or search query.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((cs) => {
              const isSelected = selectedSubject?.id === cs.id;
              const classifications = formatSubjectClassification(cs);
              const variantsLabel = formatVariants(cs.curriculumVariants);

              return (
                <article
                  key={cs.id}
                  data-testid={`curriculum-subject-card-${cs.id}`}
                  className={`bg-white rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isSelected
                      ? 'border-teal-700 ring-1 ring-teal-700'
                      : 'border-slate-200 hover:border-teal-600/70'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-medium text-slate-500 flex flex-wrap items-center gap-1.5">
                      {classifications.map((tok, idx) => (
                        <React.Fragment key={tok}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span
                            className={
                              tok.includes('داخل المجموع') ||
                              tok.includes('Included in Total')
                                ? 'text-teal-800 font-semibold'
                                : tok.includes('خارج المجموع') ||
                                  tok.includes('Non-Total')
                                ? 'text-amber-700 font-semibold'
                                : ''
                            }
                          >
                            {tok}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>

                    <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                      {isAr ? cs.subjectNameAr : cs.subjectNameEn}
                    </h3>

                    <div className="text-xs text-slate-500 space-y-1">
                      <div>
                        {isAr ? 'لغة الدراسة:' : 'Instruction:'}{' '}
                        <span className="font-medium text-slate-700">
                          {formatLanguages(cs.languagesOfInstruction)}
                        </span>
                      </div>
                      {variantsLabel && (
                        <div>
                          {isAr ? 'المسارات المتاحة:' : 'Variants:'}{' '}
                          <span className="font-medium text-slate-700">
                            {variantsLabel}
                          </span>
                        </div>
                      )}
                      {(cs.notesAr || cs.notesEn) && (
                        <p className="text-xs text-slate-600 line-clamp-2 pt-0.5">
                          {isAr ? cs.notesAr : cs.notesEn}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div className="text-slate-600 tabular-nums">
                      <span className="font-bold text-slate-900">
                        {cs.activeTeachersCount}
                      </span>{' '}
                      {isAr ? 'معلّم' : 'teachers'} ·{' '}
                      <span className="font-bold text-teal-800">
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
                      className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-teal-700 hover:bg-teal-800 text-white'
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
                      <DirectionArrow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
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
          className="scroll-mt-24 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
          data-testid="discovered-teachers-section"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-teal-700">
                {isAr
                  ? 'المعلّمون المخصصون لهذه المادة'
                  : 'Assigned Teachers for Subject'}
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-slate-900">
                {isAr
                  ? selectedSubject.subjectNameAr
                  : selectedSubject.subjectNameEn}{' '}
                <span className="text-base font-semibold text-slate-500 font-mono-num">
                  ({teachersTotal})
                </span>
              </h2>
              <p className="text-xs text-slate-600">
                {isAr ? selectedGrade?.nameAr : selectedGrade?.nameEn} ·{' '}
                {isAr
                  ? 'يمكنك التصفية وحجز جلسة فردية أو جماعية مباشرة أو زيارة الملف العام للمعلّم.'
                  : 'Filter available teachers, view full profiles, or request a 1:1 / group session directly.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSubject(null)}
              className="self-start px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {isAr ? 'إغلاق نتائج المعلّمين' : 'Close Results'}
            </button>
          </div>

          {/* Discovery Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
              <input
                type="search"
                value={teacherQ}
                onChange={(e) => setTeacherQ(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث باسم المعلّم أو التخصص...'
                    : 'Search teacher name or bio...'
                }
                className="w-full ps-9 pe-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <select
              value={teacherDelivery}
              onChange={(e) => setTeacherDelivery(e.target.value)}
              aria-label={isAr ? 'طريقة التدريس' : 'Delivery Mode'}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">
                {isAr ? 'أونلاين وحضوري' : 'Online & In-person'}
              </option>
              <option value="ONLINE">{isAr ? 'أونلاين فقط' : 'Online Only'}</option>
              <option value="IN_PERSON">
                {isAr ? 'حضوري فقط' : 'In-person Only'}
              </option>
            </select>

            <select
              value={teacherLanguage}
              onChange={(e) => setTeacherLanguage(e.target.value)}
              aria-label={isAr ? 'لغة الشرح' : 'Language'}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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

            <select
              value={teacherSort}
              onChange={(e) =>
                setTeacherSort(e.target.value as typeof teacherSort)
              }
              aria-label={isAr ? 'الترتيب' : 'Sort by'}
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
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

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 px-2 cursor-pointer">
              <input
                type="checkbox"
                checked={teacherHasSessionsOnly}
                onChange={(e) => setTeacherHasSessionsOnly(e.target.checked)}
                className="rounded border-slate-300 text-teal-700"
              />
              <span>
                {isAr ? 'بجلسات مفتوحة فقط' : 'With open sessions'}
              </span>
            </label>

            {selectedSubject.curriculumVariants.some(
              (v) => v === 'ISLAMIC' || v === 'CHRISTIAN'
            ) && (
              <select
                value={teacherReligiousVariant}
                onChange={(e) => setTeacherReligiousVariant(e.target.value)}
                aria-label={isAr ? 'مسار التربية الدينية' : 'Religious Track'}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white sm:col-span-2"
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
            )}
          </div>

          {bookingFeedback && (
            <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-xs sm:text-sm text-teal-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span>{bookingFeedback}</span>
            </div>
          )}
          {bookingError && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}
          {teachersError && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800">
              {teachersError}
            </div>
          )}

          {loadingTeachers ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-44 bg-slate-50 border border-slate-200 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-2 bg-slate-50/60">
              <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-900">
                {isAr
                  ? 'لا يوجد معلّمون متطابقون مع معايير البحث الحالية'
                  : 'No assigned teachers match these filters'}
              </div>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'يمكنك إزالة أحد الفلاتر أو تعيين معلّم لهذه المادة من لوحة المعلّم أو الإدارة.'
                  : 'Try clearing some filters, or assign a teacher to this subject.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {teachers.map((teacher) => (
                <article
                  key={teacher.teacherId}
                  data-testid={`discovered-teacher-card-${teacher.teacherId}`}
                  className="border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 bg-white"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {teacher.avatarUrl ? (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                          <SafeImage
                            src={teacher.avatarUrl}
                            alt={teacher.fullName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-display text-xl font-bold shrink-0">
                          {getInitials(teacher.fullName)}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {teacher.verificationStatus === 'VERIFIED' && (
                            <span className="inline-flex items-center gap-1 text-teal-800 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                              <span>{isAr ? 'معلّم موثّق' : 'Verified'}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-amber-600 font-mono-num font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            {teacher.ratingAvg.toFixed(1)} ({teacher.reviewsCount})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {teacher.yearsExperience}{' '}
                            {isAr ? 'سنوات خبرة' : 'yrs exp.'}
                          </span>
                        </div>

                        <h3 className="font-display text-lg font-bold text-slate-900">
                          <Link
                            to={`/instructors/${teacher.teacherId}`}
                            className="hover:text-teal-700"
                          >
                            {teacher.fullName}
                          </Link>
                        </h3>

                        <div className="text-xs font-semibold text-teal-800">
                          {teacher.jobTitle}
                        </div>

                        {teacher.bio && (
                          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl line-clamp-2">
                            {teacher.bio}
                          </p>
                        )}

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 pt-1">
                          <span>
                            {isAr ? 'لغات الشرح:' : 'Languages:'}{' '}
                            <strong className="text-slate-800">
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

                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="text-end">
                        <div className="font-mono-num text-xl font-extrabold text-slate-900">
                          ${teacher.effectivePrice}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isAr ? 'متوسط سعر الحصة' : 'Hourly / Session rate'}
                        </div>
                      </div>

                      <Link
                        to={`/instructors/${teacher.teacherId}`}
                        data-testid={`teacher-profile-link-${teacher.teacherId}`}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                      >
                        {isAr
                          ? 'عرض الملف العام والدورات'
                          : 'View Profile & Courses'}
                      </Link>
                    </div>
                  </div>

                  {/* Other Curriculum Grades/Subjects Taught by Teacher */}
                  {teacher.teachingAssignmentsSummary.length > 0 && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
                      <span className="font-semibold text-slate-800">
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

                  {/* Directly Bookable Individual & Group Sessions */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>
                        {isAr
                          ? 'الجلسات الفردية والجماعية المتاحة للحجز الآن'
                          : 'Available 1:1 & Group Sessions'}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {isAr
                          ? `${teacher.individualSessionsCount} فردية · ${teacher.groupSessionsCount} جماعية`
                          : `${teacher.individualSessionsCount} 1:1 · ${teacher.groupSessionsCount} Group`}
                      </span>
                    </div>

                    {teacher.sessions.length === 0 ? (
                      <div className="text-xs text-slate-500 py-2">
                        {isAr
                          ? 'لا توجد جلسات مجدولة لهذه المادة حالياً. يمكنك زيارة ملف المعلّم لعرض باقي مواعيده.'
                          : 'No upcoming curriculum-linked sessions yet. Visit the teacher profile for more slots.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {teacher.sessions.map((sess) => {
                          const myEnr = sess.myEnrollment;
                          const isOwn = user?.id === sess.teacherUserId;
                          return (
                            <div
                              key={sess.id}
                              data-testid={`discovery-session-card-${sess.id}`}
                              className="border border-slate-200 rounded-lg p-3.5 space-y-2.5 bg-slate-50/40"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-semibold text-slate-800 flex items-center gap-1">
                                  {sess.sessionType === 'ONE_TO_ONE' ? (
                                    <User className="w-3.5 h-3.5 text-slate-700" />
                                  ) : (
                                    <Users className="w-3.5 h-3.5 text-teal-700" />
                                  )}
                                  {isAr
                                    ? SESSION_TYPE_LABELS_AR[sess.sessionType]
                                    : sess.sessionType === 'ONE_TO_ONE'
                                    ? '1:1 Individual'
                                    : 'Group Session'}
                                </span>
                                <span className="font-mono-num font-bold text-slate-900">
                                  ${sess.price}
                                </span>
                              </div>

                              <div className="text-sm font-bold text-slate-900">
                                {sess.title}
                              </div>

                              <div className="text-[11px] text-slate-600 space-y-1">
                                <div className="flex items-center gap-1 font-mono-num">
                                  <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                  <span>
                                    {formatSessionDateRange(
                                      sess.startTime,
                                      sess.endTime,
                                      locale
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    {sess.deliveryMode === 'ONLINE' ? (
                                      <Video className="w-3.5 h-3.5 text-teal-700" />
                                    ) : (
                                      <MapPin className="w-3.5 h-3.5 text-teal-700" />
                                    )}
                                    {isAr
                                      ? DELIVERY_MODE_LABELS_AR[sess.deliveryMode]
                                      : sess.deliveryMode}
                                  </span>
                                  <span className="tabular-nums font-semibold text-teal-800">
                                    {isAr
                                      ? `المتبقي: ${sess.remainingSeats}/${sess.capacity}`
                                      : `${sess.remainingSeats}/${sess.capacity} seats left`}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200/70">
                                {myEnr &&
                                (myEnr.status === 'PENDING' ||
                                  myEnr.status === 'ACCEPTED') ? (
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-teal-800">
                                      {isAr
                                        ? ENROLLMENT_STATUS_LABELS_AR[myEnr.status]
                                        : myEnr.status}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelMyEnrollment(myEnr.id)}
                                      className="text-red-700 hover:underline font-semibold cursor-pointer"
                                    >
                                      {isAr ? 'إلغاء الطلب' : 'Cancel'}
                                    </button>
                                  </div>
                                ) : isOwn ? (
                                  <span className="text-[11px] text-slate-500">
                                    {isAr ? 'جلستك الخاصة' : 'Your own session'}
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
                                    className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                                  >
                                    {sess.sessionType === 'ONE_TO_ONE'
                                      ? isAr
                                        ? 'طلب حجز فردي (1:1)'
                                        : 'Request 1:1 Slot'
                                      : isAr
                                      ? 'طلب انضمام للمجموعة'
                                      : 'Join Group Session'}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    {isAr ? 'مكتملة / مغلقة' : 'Full / Closed'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Booking Modal */}
      {bookingSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-700" />
              <span>
                {bookingSession.session.sessionType === 'ONE_TO_ONE'
                  ? isAr
                    ? 'طلب حجز جلسة فردية'
                    : 'Request Individual Session'
                  : isAr
                  ? 'طلب انضمام لجلسة جماعية'
                  : 'Request Group Session'}
              </span>
            </h3>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1 text-slate-600">
              <div className="font-bold text-slate-900">
                {bookingSession.session.title}
              </div>
              <div>
                {isAr ? 'المعلّم:' : 'Teacher:'} {bookingSession.teacherName}
              </div>
              <div className="font-mono-num">
                {formatSessionDateRange(
                  bookingSession.session.startTime,
                  bookingSession.session.endTime,
                  locale
                )}
              </div>
              <div className="font-mono-num font-bold text-teal-800">
                ${bookingSession.session.price}
              </div>
            </div>

            <form onSubmit={handleBookSessionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {isAr ? 'ملاحظات للمعلّم (اختياري)' : 'Notes for Teacher (Optional)'}
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
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
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
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
