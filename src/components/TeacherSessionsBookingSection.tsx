import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFetch,
  SESSION_TYPE_LABELS_AR,
  SESSION_STATUS_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  DELIVERY_MODE_LABELS_AR,
  INDIVIDUAL_SLOT_STATUS_LABELS_AR,
  formatSessionDateRange,
  formatCurrencyPrice,
  isOfflineDeliveryMode,
  type TeachingSessionItem,
  type TeachingSessionsPagedResponse,
  type CurriculumOverviewResponse,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StateBanner } from './ui/StateBanner';
import { EmptyState } from './ui/EmptyState';
import { LoadingSkeleton } from './ui/LoadingSkeleton';

export interface TeacherContextOption {
  id?: number;
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
  divisionNameAr?: string | null;
  pathwayId?: number | null;
  pathwayNameAr?: string | null;
}

interface TeacherSessionsBookingSectionProps {
  teacherId?: number;
  subjectId?: number | null;
  curriculumSubjectId?: number | null;
  gradeId?: number | null;
  systemId?: number | null;
  divisionId?: number | null;
  pathwayId?: number | null;
  teacherAssignments?: TeacherContextOption[];
  onSelectCurriculumContext?: (csId: number | null) => void;
  title?: string;
  subtitle?: string;
  showTeacherName?: boolean;
  onBookingUpdated?: () => void;
}

interface SubjectTaxOption {
  id: number;
  nameAr: string;
  nameEn: string;
}

export function TeacherSessionsBookingSection({
  teacherId,
  subjectId,
  curriculumSubjectId,
  gradeId,
  systemId,
  divisionId,
  pathwayId,
  teacherAssignments,
  onSelectCurriculumContext,
  title = 'الجلسات الفردية والجماعية المتاحة للحجز',
  subtitle = 'اختر جلسة فردية أونلاين أو جماعية (أونلاين / أوفلاين) وأرسل طلبك بسهولة.',
  showTeacherName = true,
  onBookingUpdated,
}: TeacherSessionsBookingSectionProps) {
  const { user, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';

  const [sessions, setSessions] = useState<TeachingSessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 12;

  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ONE_TO_ONE' | 'GROUP'>(
    'ALL'
  );
  const [deliveryFilter, setDeliveryFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [minPriceFilter, setMinPriceFilter] = useState<string>('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [overview, setOverview] = useState<CurriculumOverviewResponse | null>(
    null
  );
  const [taxSubjects, setTaxSubjects] = useState<SubjectTaxOption[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string>(
    systemId ? String(systemId) : ''
  );
  const [selectedGradeId, setSelectedGradeId] = useState<string>(
    gradeId ? String(gradeId) : ''
  );
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(
    divisionId ? String(divisionId) : ''
  );
  const [selectedPathwayId, setSelectedPathwayId] = useState<string>(
    pathwayId ? String(pathwayId) : ''
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjectId ? String(subjectId) : ''
  );

  const [detailModalSession, setDetailModalSession] =
    useState<TeachingSessionItem | null>(null);
  const [requestModalSession, setRequestModalSession] =
    useState<TeachingSessionItem | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teacherId) return;
    Promise.all([
      apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview').catch(
        () => null
      ),
      apiFetch<{ subjects: SubjectTaxOption[] }>('/api/taxonomy').catch(() => ({
        subjects: [],
      })),
    ]).then(([ov, tax]) => {
      if (ov) setOverview(ov);
      setTaxSubjects(tax.subjects || []);
    });
  }, [teacherId]);

  useEffect(() => {
    setPage(1);
  }, [
    teacherId,
    subjectId,
    curriculumSubjectId,
    gradeId,
    systemId,
    divisionId,
    pathwayId,
    typeFilter,
    deliveryFilter,
    dateFilter,
    minPriceFilter,
    maxPriceFilter,
    searchQuery,
    selectedSystemId,
    selectedGradeId,
    selectedDivisionId,
    selectedPathwayId,
    selectedSubjectId,
  ]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (teacherId) params.set('teacherId', String(teacherId));
      if (curriculumSubjectId) {
        params.set('curriculumSubjectId', String(curriculumSubjectId));
      } else {
        const effSystemId =
          systemId || (selectedSystemId ? Number(selectedSystemId) : null);
        const effGradeId =
          gradeId || (selectedGradeId ? Number(selectedGradeId) : null);
        const effDivisionId =
          divisionId ||
          (selectedDivisionId ? Number(selectedDivisionId) : null);
        const effPathwayId =
          pathwayId || (selectedPathwayId ? Number(selectedPathwayId) : null);
        const effSubjectId =
          subjectId || (selectedSubjectId ? Number(selectedSubjectId) : null);

        if (effSystemId) params.set('systemId', String(effSystemId));
        if (effGradeId) params.set('gradeId', String(effGradeId));
        if (effDivisionId) params.set('divisionId', String(effDivisionId));
        if (effPathwayId) params.set('pathwayId', String(effPathwayId));
        if (effSubjectId) params.set('subjectId', String(effSubjectId));
      }
      if (typeFilter !== 'ALL') params.set('sessionType', typeFilter);
      if (deliveryFilter) params.set('deliveryMode', deliveryFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (minPriceFilter !== '') params.set('minPrice', minPriceFilter);
      if (maxPriceFilter !== '') params.set('maxPrice', maxPriceFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await apiFetch<TeachingSessionsPagedResponse>(
        `/api/teaching-sessions?${params.toString()}`
      );
      setSessions(res.sessions);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setSessions([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    teacherId,
    subjectId,
    curriculumSubjectId,
    gradeId,
    systemId,
    divisionId,
    pathwayId,
    typeFilter,
    deliveryFilter,
    dateFilter,
    minPriceFilter,
    maxPriceFilter,
    searchQuery,
    selectedSystemId,
    selectedGradeId,
    selectedDivisionId,
    selectedPathwayId,
    selectedSubjectId,
    page,
  ]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalSession) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/teaching-sessions/${requestModalSession.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      setRequestModalSession(null);
      setDetailModalSession(null);
      setNotes('');
      setFeedback(
        isAr
          ? 'تم إرسال طلب الحجز بنجاح! سيقوم المعلّم بمراجعة طلبك وإشعارك فور القبول أو الرفض.'
          : 'Booking request submitted! The teacher will review your request shortly.'
      );
      await loadSessions();
      onBookingUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر إرسال طلب الحجز.'
          : 'Could not submit booking request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEnrollment = async (enrollmentId: number) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/session-enrollments/${enrollmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setFeedback(
        isAr
          ? 'تم إلغاء الطلب وتحديث المقاعد المتاحة.'
          : 'Booking request cancelled and seats updated.'
      );
      await loadSessions();
      onBookingUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isAr
          ? 'تعذر إلغاء الطلب.'
          : 'Could not cancel booking request.'
      );
    }
  };

  const resetAllFilters = () => {
    setTypeFilter('ALL');
    setDeliveryFilter('');
    setDateFilter('');
    setMinPriceFilter('');
    setMaxPriceFilter('');
    setSearchQuery('');
    setSelectedSystemId('');
    setSelectedGradeId('');
    setSelectedDivisionId('');
    setSelectedPathwayId('');
    setSelectedSubjectId('');
    onSelectCurriculumContext?.(null);
  };

  const activeSystemObj = overview?.systems.find(
    (s) => String(s.id) === selectedSystemId
  );
  const activeGradeObj = overview?.grades.find(
    (g) => String(g.id) === selectedGradeId
  );
  const showDivisions =
    activeSystemObj?.code === 'GENERAL_SECONDARY' &&
    (activeGradeObj?.gradeNumber ?? 0) >= 2;
  const showPathways =
    activeSystemObj?.code === 'EGYPTIAN_BACCALAUREATE' &&
    (activeGradeObj?.gradeNumber ?? 0) >= 2;

  const hasActiveFilters = Boolean(
    typeFilter !== 'ALL' ||
      deliveryFilter ||
      dateFilter ||
      minPriceFilter !== '' ||
      maxPriceFilter !== '' ||
      searchQuery.trim() ||
      selectedSystemId ||
      selectedGradeId ||
      selectedDivisionId ||
      selectedPathwayId ||
      selectedSubjectId ||
      (teacherId && curriculumSubjectId)
  );

  return (
    <section
      className="jusoor-card p-4 sm:p-6 space-y-5"
      data-testid="teacher-sessions-booking-section"
    >
      {/* Header + Primary Type & Delivery Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#102A43] flex items-center gap-2 m-0">
            <i className="bi bi-calendar2-week text-[#0F766E]" aria-hidden="true" />
            <span>{title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className="jusoor-tabs inline-flex items-center gap-1"
            role="tablist"
            aria-label={isAr ? 'تصفية نوع الجلسة' : 'Session type filter'}
          >
            {[
              { code: 'ALL' as const, label: isAr ? 'الكل' : 'All' },
              {
                code: 'ONE_TO_ONE' as const,
                label: isAr ? 'فردية (1:1)' : '1:1 Individual',
              },
              { code: 'GROUP' as const, label: isAr ? 'جماعية' : 'Group' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                role="tab"
                aria-selected={typeFilter === item.code}
                onClick={() => setTypeFilter(item.code)}
                className={`jusoor-tab-btn px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap ${
                  typeFilter === item.code ? 'is-active' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            aria-label={isAr ? 'طريقة تقديم الجلسة' : 'Delivery mode'}
            className="jusoor-select px-3 py-1.5 text-xs"
          >
            <option value="">{isAr ? 'كل طرق التقديم' : 'All Modes'}</option>
            <option value="ONLINE">
              {isAr ? 'عن بُعد (أونلاين)' : 'Online'}
            </option>
            <option value="IN_PERSON">
              {isAr ? 'حضوري (أوفلاين)' : 'In-person'}
            </option>
          </select>
        </div>
      </div>

      {/* Extended Filters Bar */}
      <div className="jusoor-subcard p-3.5 sm:p-4 space-y-3">
        <div className="row g-2.5">
          {teacherId &&
          teacherAssignments &&
          teacherAssignments.length > 0 &&
          onSelectCurriculumContext ? (
            <div className="col-12 col-lg-6">
              <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                {isAr
                  ? 'تصفية حسب المادة والصف الدراسي'
                  : 'Filter by Subject & Grade'}
              </label>
              <select
                value={curriculumSubjectId ? String(curriculumSubjectId) : ''}
                onChange={(e) =>
                  onSelectCurriculumContext(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                aria-label={
                  isAr
                    ? 'تصفية حسب المادة والصف الدراسي'
                    : 'Filter by Subject & Grade'
                }
                className="jusoor-select w-full px-3 py-2 text-xs"
              >
                <option value="">
                  {isAr
                    ? 'كل المواد والصفوف المعيّنة للمعلّم'
                    : 'All Assigned Subjects & Grades'}
                </option>
                {teacherAssignments.map((ta) => (
                  <option
                    key={ta.id ?? ta.curriculumSubjectId}
                    value={ta.curriculumSubjectId}
                  >
                    {isAr ? ta.subjectNameAr : ta.subjectNameEn} —{' '}
                    {isAr ? ta.gradeNameAr : ta.gradeNameEn} (
                    {isAr ? ta.systemNameAr : ta.systemNameEn}
                    {ta.divisionNameAr ? ` / ${ta.divisionNameAr}` : ''}
                    {ta.pathwayNameAr ? ` / ${ta.pathwayNameAr}` : ''})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            !teacherId &&
            overview && (
              <>
                <div className="col-12 col-sm-6 col-lg-3">
                  <select
                    value={selectedSystemId}
                    onChange={(e) => {
                      setSelectedSystemId(e.target.value);
                      setSelectedGradeId('');
                      setSelectedDivisionId('');
                      setSelectedPathwayId('');
                    }}
                    aria-label={isAr ? 'النظام التعليمي' : 'Educational System'}
                    className="jusoor-select w-full px-3 py-2 text-xs"
                  >
                    <option value="">
                      {isAr ? 'كل المراحل / الأنظمة' : 'All Educational Systems'}
                    </option>
                    {overview.systems.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {isAr ? sys.nameAr : sys.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <select
                    value={selectedGradeId}
                    onChange={(e) => {
                      setSelectedGradeId(e.target.value);
                      setSelectedDivisionId('');
                      setSelectedPathwayId('');
                    }}
                    disabled={!selectedSystemId}
                    aria-label={isAr ? 'الصف الدراسي' : 'Grade'}
                    className="jusoor-select w-full px-3 py-2 text-xs disabled:opacity-60"
                  >
                    <option value="">{isAr ? 'كل الصفوف' : 'All Grades'}</option>
                    {overview.grades
                      .filter((g) => String(g.systemId) === selectedSystemId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {isAr ? g.nameAr : g.nameEn}
                        </option>
                      ))}
                  </select>
                </div>

                {showDivisions && (
                  <div className="col-12 col-sm-6 col-lg-3">
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => setSelectedDivisionId(e.target.value)}
                      aria-label={isAr ? 'الشعبة' : 'Division'}
                      className="jusoor-select w-full px-3 py-2 text-xs"
                    >
                      <option value="">
                        {isAr ? 'كل الشعب' : 'All Divisions'}
                      </option>
                      {overview.divisions
                        .filter((d) => String(d.gradeId) === selectedGradeId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {isAr ? d.nameAr : d.nameEn}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {showPathways && (
                  <div className="col-12 col-sm-6 col-lg-3">
                    <select
                      value={selectedPathwayId}
                      onChange={(e) => setSelectedPathwayId(e.target.value)}
                      aria-label={isAr ? 'المسار' : 'Pathway'}
                      className="jusoor-select w-full px-3 py-2 text-xs"
                    >
                      <option value="">
                        {isAr ? 'كل المسارات' : 'All Pathways'}
                      </option>
                      {overview.pathways
                        .filter((p) => String(p.gradeId) === selectedGradeId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {isAr ? p.nameAr : p.nameEn}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="col-12 col-sm-6 col-lg-3">
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    aria-label={isAr ? 'المادة الدراسية' : 'Subject'}
                    className="jusoor-select w-full px-3 py-2 text-xs"
                  >
                    <option value="">
                      {isAr ? 'كل المواد الدراسية' : 'All Subjects'}
                    </option>
                    {taxSubjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>
                        {isAr ? subj.nameAr : subj.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )
          )}

          <div className="col-12 col-sm-6 col-lg-3">
            <div className="relative">
              <i
                className="bi bi-search text-[#64748B] text-xs absolute start-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'بحث بالعنوان، المعلّم، المحافظة...'
                    : 'Search title, teacher, city...'
                }
                aria-label={isAr ? 'بحث في الجلسات' : 'Search sessions'}
                className="jusoor-input w-full ps-8 pe-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="col-12 col-sm-6 col-lg-3">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label={isAr ? 'تصفية بتاريخ الجلسة' : 'Session date'}
              className="jusoor-input w-full px-3 py-2 text-xs font-mono-num"
            />
          </div>

          <div className="col-12 col-sm-6 col-lg-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={minPriceFilter}
                onChange={(e) => setMinPriceFilter(e.target.value)}
                placeholder={isAr ? 'أقل سعر (ج.م)' : 'Min EGP'}
                aria-label={isAr ? 'الحد الأدنى للسعر' : 'Min price'}
                className="jusoor-input w-full px-2.5 py-2 text-xs font-mono-num"
              />
              <input
                type="number"
                min="0"
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(e.target.value)}
                placeholder={isAr ? 'أعلى سعر (ج.م)' : 'Max EGP'}
                aria-label={isAr ? 'الحد الأقصى للسعر' : 'Max price'}
                className="jusoor-input w-full px-2.5 py-2 text-xs font-mono-num"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] pt-1">
          <span className="tabular-nums font-medium">
            {loading
              ? isAr
                ? 'جاري تحميل الجلسات...'
                : 'Loading sessions...'
              : isAr
              ? `إجمالي الجلسات المطابقة: ${total} جلسة`
              : `Matching sessions: ${total}`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 text-[#247BA0] hover:text-[#102A43] font-semibold cursor-pointer"
            >
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
              <span>{isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <StateBanner
          variant="success"
          message={feedback}
          onDismiss={() => setFeedback(null)}
        />
      )}
      {error && (
        <StateBanner
          variant="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {loading ? (
        <LoadingSkeleton variant="cards" count={4} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon="bi-calendar-x"
          title={
            isAr
              ? 'لا توجد جلسات متاحة حالياً ضمن هذا التصنيف'
              : 'No available sessions match this filter'
          }
          description={
            isAr
              ? 'يمكنك تغيير الفلاتر أو إعادة ضبط البحث لاستعراض باقي المواعيد المتاحة.'
              : 'Try adjusting your filters or resetting the search to browse upcoming slots.'
          }
        />
      ) : (
        <>
          <div className="row g-3 g-md-4">
            {sessions.map((s) => {
              const isOwnSession = user?.id === s.teacherUserId;
              const myEnr = s.myEnrollment;
              const hasActiveRequest =
                myEnr &&
                (myEnr.status === 'PENDING' || myEnr.status === 'ACCEPTED');
              const canCancel =
                hasActiveRequest &&
                s.status !== 'CANCELLED' &&
                s.status !== 'COMPLETED' &&
                Date.now() < new Date(s.startTime).getTime();
              const isOffline = isOfflineDeliveryMode(s.deliveryMode);

              const slotStatusLabel =
                s.sessionType === 'ONE_TO_ONE' && s.slotStatus
                  ? INDIVIDUAL_SLOT_STATUS_LABELS_AR[s.slotStatus] ||
                    s.slotStatus
                  : s.status === 'OPEN' && !s.isRegistrationOpen
                  ? isAr
                    ? 'انتهى التسجيل'
                    : 'Registration Closed'
                  : SESSION_STATUS_LABELS_AR[s.status] || s.status;

              const isOpenPositive =
                s.sessionType === 'ONE_TO_ONE'
                  ? s.slotStatus === 'AVAILABLE'
                  : s.status === 'OPEN' && s.isRegistrationOpen;

              return (
                <div key={s.id} className="col-12 col-md-6">
                  <article
                    className="jusoor-card jusoor-card-interactive p-4 sm:p-5 h-full flex flex-col justify-between gap-4"
                    data-testid={`session-card-${s.id}`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5 text-[#64748B]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#102A43]">
                            <i
                              className={`bi ${
                                s.sessionType === 'ONE_TO_ONE'
                                  ? 'bi-person-video text-[#247BA0]'
                                  : 'bi-people-fill text-[#0F766E]'
                              }`}
                              aria-hidden="true"
                            />
                            <span>
                              {SESSION_TYPE_LABELS_AR[s.sessionType] ||
                                s.sessionType}
                            </span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              isOpenPositive
                                ? 'text-[#0F766E]'
                                : s.slotStatus === 'PENDING'
                                ? 'text-[#B45309]'
                                : 'text-[#64748B]'
                            }`}
                          >
                            {slotStatusLabel}
                          </span>
                        </div>

                        <span className="font-mono-num font-bold text-sm text-[#102A43]">
                          {formatCurrencyPrice(
                            s.price,
                            s.currency,
                            isAr ? 'ar' : 'en'
                          )}
                        </span>
                      </div>

                      <div>
                        <h3
                          className="font-display text-base font-bold text-[#102A43] leading-snug m-0"
                          dir="auto"
                        >
                          {s.title}
                        </h3>
                        {(s.subjectNameAr || s.gradeNameAr || s.stageNameAr) && (
                          <div className="text-xs text-[#247BA0] font-semibold mt-1">
                            {[
                              s.subjectNameAr,
                              s.gradeNameAr || s.stageNameAr,
                              s.divisionNameAr || s.pathwayNameAr,
                              s.systemNameAr,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                        {showTeacherName && (
                          <div className="text-xs text-[#64748B] mt-1">
                            {isAr ? 'المعلّم:' : 'Teacher:'}{' '}
                            <Link
                              to={`/instructors/${s.teacherUserId}`}
                              className="font-semibold text-[#0F766E] hover:underline"
                            >
                              {s.teacherName}
                            </Link>
                          </div>
                        )}
                      </div>

                      {s.description && (
                        <p
                          className="text-xs text-[#64748B] leading-relaxed line-clamp-2 m-0"
                          dir="auto"
                        >
                          {s.description}
                        </p>
                      )}

                      <div className="space-y-1.5 text-xs text-[#64748B] pt-1">
                        <div className="flex items-center gap-1.5 font-mono-num">
                          <i
                            className="bi bi-clock text-[#0F766E] shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            {formatSessionDateRange(s.startTime, s.endTime)}
                          </span>
                          <span className="text-[#64748B]">
                            ({s.durationMinutes} {isAr ? 'دقيقة' : 'min'})
                          </span>
                        </div>

                        <div className="flex items-start gap-1.5">
                          <i
                            className={`bi ${
                              !isOffline ? 'bi-camera-video' : 'bi-geo-alt'
                            } text-[#0F766E] shrink-0 mt-0.5`}
                            aria-hidden="true"
                          />
                          <div className="space-y-0.5 leading-relaxed">
                            <span className="font-semibold text-[#172B4D]">
                              {DELIVERY_MODE_LABELS_AR[s.deliveryMode] ||
                                s.deliveryMode}
                            </span>
                            {isOffline && s.location && (
                              <div
                                className="text-[#172B4D] font-medium"
                                data-testid={`session-address-${s.id}`}
                              >
                                {isAr ? 'العنوان:' : 'Address:'} {s.location}
                                {s.isDemoLocation &&
                                  !s.location.includes('موقع عرض تجريبي') && (
                                    <span className="text-[#64748B] font-normal mr-1.5">
                                      (موقع عرض تجريبي)
                                    </span>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>

                        {s.sessionType === 'GROUP' && (
                          <div className="pt-1 space-y-1">
                            <div className="flex items-center justify-between text-xs tabular-nums">
                              <span>
                                {isAr
                                  ? `السعة: ${s.acceptedCount} / ${s.capacity} مقعد`
                                  : `Seats: ${s.acceptedCount} / ${s.capacity}`}
                              </span>
                              <span className="font-semibold text-[#0F766E]">
                                {isAr
                                  ? `المقاعد المتبقية: ${s.remainingSeats}`
                                  : `Left: ${s.remainingSeats}`}
                              </span>
                            </div>
                            <div className="h-1.5 bg-[#EEF4FA] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#20B8A6] transition-all"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      (s.acceptedCount / s.capacity) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#EDF2F7] flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailModalSession(s)}
                        className="btn-jusoor-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="bi bi-info-circle" aria-hidden="true" />
                        <span>{isAr ? 'التفاصيل' : 'Details'}</span>
                      </button>

                      {myEnr &&
                      (myEnr.status === 'PENDING' ||
                        myEnr.status === 'ACCEPTED') ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs font-bold ${
                              myEnr.status === 'ACCEPTED'
                                ? 'text-[#0F766E]'
                                : 'text-[#B45309]'
                            }`}
                          >
                            {ENROLLMENT_STATUS_LABELS_AR[myEnr.status] ||
                              myEnr.status}
                          </span>
                          {myEnr.status === 'ACCEPTED' && s.meetingUrl && (
                            <a
                              href={s.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-jusoor-primary px-3 py-1.5 text-xs"
                            >
                              {isAr ? 'رابط الجلسة' : 'Join Link'}
                            </a>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => handleCancelEnrollment(myEnr.id)}
                              className="px-3 py-1.5 border border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2] text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <i className="bi bi-x-circle" aria-hidden="true" />
                              <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                            </button>
                          )}
                        </div>
                      ) : isOwnSession ? (
                        <span className="text-xs text-[#64748B]">
                          {isAr ? 'جلستك الخاصة' : 'Your own session'}
                        </span>
                      ) : s.isRegistrationOpen ? (
                        <button
                          type="button"
                          data-testid={`request-session-btn-${s.id}`}
                          onClick={() => {
                            if (!user) {
                              openAuthModal();
                              return;
                            }
                            setError(null);
                            setRequestModalSession(s);
                          }}
                          className="btn-jusoor-primary flex-1 py-2 px-4 text-xs sm:text-sm cursor-pointer whitespace-nowrap"
                        >
                          {s.sessionType === 'ONE_TO_ONE'
                            ? isAr
                              ? 'طلب جلسة فردية'
                              : 'Request 1:1 Session'
                            : isAr
                            ? 'طلب الانضمام للجلسة'
                            : 'Join Group Session'}
                        </button>
                      ) : (
                        <span className="text-xs text-[#64748B]">
                          {s.isFull
                            ? isAr
                              ? 'اكتملت المقاعد المتاحة'
                              : 'Seats full'
                            : isAr
                            ? 'التسجيل مغلق حالياً'
                            : 'Registration closed'}
                        </span>
                      )}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DCE5F0] text-xs">
              <span className="text-[#64748B] tabular-nums">
                {isAr
                  ? `صفحة ${page} من ${totalPages} (إجمالي ${total} جلسة)`
                  : `Page ${page} of ${totalPages} (${total} total)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-jusoor-outline px-3 py-1.5 text-xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                >
                  <i
                    className={`bi ${
                      isAr ? 'bi-chevron-right' : 'bi-chevron-left'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{isAr ? 'السابق' : 'Previous'}</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn-jusoor-outline px-3 py-1.5 text-xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{isAr ? 'التالي' : 'Next'}</span>
                  <i
                    className={`bi ${
                      isAr ? 'bi-chevron-left' : 'bi-chevron-right'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Session Details Modal */}
      {detailModalSession && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-[#0F766E] font-semibold">
                  {SESSION_TYPE_LABELS_AR[detailModalSession.sessionType]} ·{' '}
                  {DELIVERY_MODE_LABELS_AR[detailModalSession.deliveryMode]}
                </div>
                <h3 className="font-display text-lg font-bold text-[#102A43] mt-1 mb-0">
                  {detailModalSession.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalSession(null)}
                className="text-xs font-semibold text-[#64748B] hover:text-[#102A43] cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>

            {detailModalSession.description && (
              <p className="text-sm text-[#172B4D] leading-relaxed mb-0">
                {detailModalSession.description}
              </p>
            )}

            <dl className="jusoor-subcard p-4 row g-3 m-0 text-xs">
              <div className="col-12 col-sm-6">
                <dt className="text-[#64748B]">{isAr ? 'المعلّم' : 'Teacher'}</dt>
                <dd className="font-bold text-[#102A43] mt-0.5 mb-0">
                  {detailModalSession.teacherName}
                </dd>
              </div>
              <div className="col-12 col-sm-6">
                <dt className="text-[#64748B]">{isAr ? 'السعر' : 'Price'}</dt>
                <dd className="font-mono-num font-bold text-[#0F766E] mt-0.5 mb-0">
                  {formatCurrencyPrice(
                    detailModalSession.price,
                    detailModalSession.currency,
                    isAr ? 'ar' : 'en'
                  )}
                </dd>
              </div>
              {detailModalSession.subjectNameAr && (
                <div className="col-12 col-sm-6">
                  <dt className="text-[#64748B]">{isAr ? 'المادة' : 'Subject'}</dt>
                  <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                    {detailModalSession.subjectNameAr}
                  </dd>
                </div>
              )}
              {(detailModalSession.gradeNameAr ||
                detailModalSession.systemNameAr) && (
                <div className="col-12 col-sm-6">
                  <dt className="text-[#64748B]">
                    {isAr ? 'الصف والنظام' : 'Grade & System'}
                  </dt>
                  <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                    {[
                      detailModalSession.systemNameAr,
                      detailModalSession.gradeNameAr,
                      detailModalSession.divisionNameAr ||
                        detailModalSession.pathwayNameAr,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </dd>
                </div>
              )}
              <div className="col-12">
                <dt className="text-[#64748B]">
                  {isAr ? 'الموعد والمدة' : 'Schedule & Duration'}
                </dt>
                <dd className="font-mono-num font-semibold text-[#102A43] mt-0.5 mb-0">
                  {formatSessionDateRange(
                    detailModalSession.startTime,
                    detailModalSession.endTime
                  )}{' '}
                  ({detailModalSession.durationMinutes}{' '}
                  {isAr ? 'دقيقة' : 'min'})
                </dd>
              </div>
              {isOfflineDeliveryMode(detailModalSession.deliveryMode) &&
                detailModalSession.location && (
                  <div className="col-12">
                    <dt className="text-[#64748B]">
                      {isAr ? 'العنوان الحضوري الكامل' : 'In-person Address'}
                    </dt>
                    <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                      {detailModalSession.location}
                      {detailModalSession.isDemoLocation &&
                        !detailModalSession.location.includes(
                          'موقع عرض تجريبي'
                        ) && (
                          <span className="text-[#64748B] font-normal mr-1.5">
                            (موقع عرض تجريبي)
                          </span>
                        )}
                    </dd>
                  </div>
                )}
            </dl>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDetailModalSession(null)}
                className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              {detailModalSession.isRegistrationOpen &&
                !detailModalSession.myEnrollment &&
                user?.id !== detailModalSession.teacherUserId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        openAuthModal();
                        return;
                      }
                      const target = detailModalSession;
                      setDetailModalSession(null);
                      setRequestModalSession(target);
                    }}
                    className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
                  >
                    {detailModalSession.sessionType === 'ONE_TO_ONE'
                      ? isAr
                        ? 'طلب جلسة فردية'
                        : 'Request 1:1'
                      : isAr
                      ? 'طلب الانضمام للجلسة'
                      : 'Request Seat'}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Request Booking Modal */}
      {requestModalSession && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          data-testid="session-booking-confirmation-modal"
        >
          <div className="jusoor-card w-full max-w-md p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
              {requestModalSession.sessionType === 'ONE_TO_ONE'
                ? isAr
                  ? 'تأكيد طلب جلسة فردية'
                  : 'Confirm 1:1 Request'
                : isAr
                ? 'تأكيد طلب الانضمام لجلسة جماعية'
                : 'Confirm Group Session Request'}
            </h3>

            <dl className="jusoor-subcard p-3.5 text-xs row g-2 m-0 text-[#172B4D]">
              <div className="col-12">
                <dt className="text-[#64748B]">
                  {isAr ? 'عنوان الجلسة' : 'Session Title'}
                </dt>
                <dd className="font-bold text-[#102A43] mt-0.5 mb-0">
                  {requestModalSession.title}
                </dd>
              </div>
              <div className="col-6">
                <dt className="text-[#64748B]">{isAr ? 'المعلّم' : 'Teacher'}</dt>
                <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                  {requestModalSession.teacherName}
                </dd>
              </div>
              <div className="col-6">
                <dt className="text-[#64748B]">{isAr ? 'المادة' : 'Subject'}</dt>
                <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                  {requestModalSession.subjectNameAr ||
                    (isAr ? 'مادة عامة' : 'General')}
                </dd>
              </div>
              <div className="col-6">
                <dt className="text-[#64748B]">
                  {isAr ? 'الصف الدراسي' : 'Grade'}
                </dt>
                <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                  {requestModalSession.gradeNameAr ||
                    requestModalSession.stageNameAr ||
                    (isAr ? 'مفتوح' : 'Open')}
                </dd>
              </div>
              <div className="col-6">
                <dt className="text-[#64748B]">{isAr ? 'المدة' : 'Duration'}</dt>
                <dd className="font-mono-num font-semibold text-[#102A43] mt-0.5 mb-0">
                  {requestModalSession.durationMinutes}{' '}
                  {isAr ? 'دقيقة' : 'min'}
                </dd>
              </div>
              <div className="col-12">
                <dt className="text-[#64748B]">
                  {isAr ? 'التاريخ ووقت البدء' : 'Date & Start Time'}
                </dt>
                <dd className="font-mono-num font-semibold text-[#102A43] mt-0.5 mb-0">
                  {formatSessionDateRange(
                    requestModalSession.startTime,
                    requestModalSession.endTime
                  )}
                </dd>
              </div>
              {isOfflineDeliveryMode(requestModalSession.deliveryMode) &&
                requestModalSession.location && (
                  <div className="col-12">
                    <dt className="text-[#64748B]">
                      {isAr ? 'المكان الحضوري' : 'Location'}
                    </dt>
                    <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                      {requestModalSession.location}
                    </dd>
                  </div>
                )}
              <div className="col-12 pt-2 border-t border-[#DCE5F0] flex items-center justify-between">
                <span className="text-[#64748B]">
                  {isAr ? 'السعر المحدد' : 'Session Price'}
                </span>
                <span className="font-mono-num font-bold text-sm text-[#0F766E]">
                  {formatCurrencyPrice(
                    requestModalSession.price,
                    requestModalSession.currency,
                    isAr ? 'ar' : 'en'
                  )}
                </span>
              </div>
            </dl>

            <form onSubmit={handleRequestSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  {isAr ? 'رسالة اختيارية للمعلّم' : 'Optional note for teacher'}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isAr
                      ? 'اذكر هدفك من الجلسة أو الدروس التي تود التركيز عليها...'
                      : 'Share your goals or topics to cover...'
                  }
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-jusoor-primary flex-1 py-2.5 text-sm cursor-pointer"
                >
                  {submitting
                    ? isAr
                      ? 'جاري الإرسال...'
                      : 'Sending...'
                    : isAr
                    ? 'تأكيد وإرسال الطلب'
                    : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setRequestModalSession(null)}
                  className="btn-jusoor-outline px-4 py-2.5 text-sm cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
