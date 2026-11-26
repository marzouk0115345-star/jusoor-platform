import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  User,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  ChevronRight,
  ChevronLeft,
  Info,
  RotateCcw,
} from 'lucide-react';
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

  // Marketplace discovery filters (used when not locked to a single teacher)
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
        const effSystemId = systemId || (selectedSystemId ? Number(selectedSystemId) : null);
        const effGradeId = gradeId || (selectedGradeId ? Number(selectedGradeId) : null);
        const effDivisionId =
          divisionId || (selectedDivisionId ? Number(selectedDivisionId) : null);
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
        'تم إرسال طلب الحجز بنجاح! سيقوم المعلّم بمراجعة طلبك وإشعارك فور القبول أو الرفض.'
      );
      await loadSessions();
      onBookingUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال طلب الحجز.');
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
      setFeedback('تم إلغاء الطلب وتحديث المقاعد المتاحة.');
      await loadSessions();
      onBookingUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الطلب.');
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
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      data-testid="teacher-sessions-booking-section"
    >
      {/* Header + Primary Type & Delivery Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-700" />
            <span>{title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="تصفية نوع الجلسة"
          >
            {[
              { code: 'ALL' as const, label: 'الكل' },
              { code: 'ONE_TO_ONE' as const, label: 'فردية (1:1)' },
              { code: 'GROUP' as const, label: 'جماعية' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                role="tab"
                aria-selected={typeFilter === item.code}
                onClick={() => setTypeFilter(item.code)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === item.code
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            aria-label="طريقة تقديم الجلسة"
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="">كل طرق التقديم</option>
            <option value="ONLINE">عن بُعد (أونلاين)</option>
            <option value="IN_PERSON">حضوري (أوفلاين)</option>
          </select>
        </div>
      </div>

      {/* Extended Filters Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teacherId && teacherAssignments && teacherAssignments.length > 0 && onSelectCurriculumContext ? (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                تصفية حسب المادة والصف الدراسي
              </label>
              <select
                value={curriculumSubjectId ? String(curriculumSubjectId) : ''}
                onChange={(e) =>
                  onSelectCurriculumContext(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                aria-label="تصفية حسب المادة والصف الدراسي"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="">كل المواد والصفوف المعيّنة للمعلّم</option>
                {teacherAssignments.map((ta) => (
                  <option
                    key={ta.id ?? ta.curriculumSubjectId}
                    value={ta.curriculumSubjectId}
                  >
                    {ta.subjectNameAr} — {ta.gradeNameAr} ({ta.systemNameAr}
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
                <select
                  value={selectedSystemId}
                  onChange={(e) => {
                    setSelectedSystemId(e.target.value);
                    setSelectedGradeId('');
                    setSelectedDivisionId('');
                    setSelectedPathwayId('');
                  }}
                  aria-label="النظام التعليمي"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="">كل المراحل / الأنظمة</option>
                  {overview.systems.map((sys) => (
                    <option key={sys.id} value={sys.id}>
                      {sys.nameAr}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedGradeId}
                  onChange={(e) => {
                    setSelectedGradeId(e.target.value);
                    setSelectedDivisionId('');
                    setSelectedPathwayId('');
                  }}
                  disabled={!selectedSystemId}
                  aria-label="الصف الدراسي"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 disabled:opacity-60"
                >
                  <option value="">كل الصفوف</option>
                  {overview.grades
                    .filter((g) => String(g.systemId) === selectedSystemId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nameAr}
                      </option>
                    ))}
                </select>

                {showDivisions && (
                  <select
                    value={selectedDivisionId}
                    onChange={(e) => setSelectedDivisionId(e.target.value)}
                    aria-label="الشعبة"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">كل الشعب</option>
                    {overview.divisions
                      .filter((d) => String(d.gradeId) === selectedGradeId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr}
                        </option>
                      ))}
                  </select>
                )}

                {showPathways && (
                  <select
                    value={selectedPathwayId}
                    onChange={(e) => setSelectedPathwayId(e.target.value)}
                    aria-label="المسار"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">كل المسارات</option>
                    {overview.pathways
                      .filter((p) => String(p.gradeId) === selectedGradeId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr}
                        </option>
                      ))}
                  </select>
                )}

                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  aria-label="المادة الدراسية"
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="">كل المواد الدراسية</option>
                  {taxSubjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.nameAr}
                    </option>
                  ))}
                </select>
              </>
            )
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالعنوان، المعلّم، المحافظة..."
              aria-label="بحث في الجلسات"
              className="w-full ps-8 pe-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="تصفية بتاريخ الجلسة"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
          />

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={minPriceFilter}
              onChange={(e) => setMinPriceFilter(e.target.value)}
              placeholder="أقل سعر (ج.م)"
              aria-label="الحد الأدنى للسعر"
              className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
            />
            <input
              type="number"
              min="0"
              value={maxPriceFilter}
              onChange={(e) => setMaxPriceFilter(e.target.value)}
              placeholder="أعلى سعر (ج.م)"
              aria-label="الحد الأقصى للسعر"
              className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
          <span className="tabular-nums font-medium">
            {loading
              ? 'جاري تحميل الجلسات...'
              : `إجمالي الجلسات المطابقة: ${total} جلسة`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-xs sm:text-sm text-teal-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-50 border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-2 bg-slate-50/50">
          <Calendar className="w-7 h-7 text-slate-400 mx-auto" />
          <div className="text-sm font-semibold text-slate-800">
            لا توجد جلسات متاحة حالياً ضمن هذا التصنيف
          </div>
          <p className="text-xs text-slate-500">
            يمكنك تغيير الفلاتر أو إعادة ضبط البحث لاستعراض باقي المواعيد المتاحة.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  ? INDIVIDUAL_SLOT_STATUS_LABELS_AR[s.slotStatus] || s.slotStatus
                  : s.status === 'OPEN' && !s.isRegistrationOpen
                  ? 'انتهى التسجيل'
                  : SESSION_STATUS_LABELS_AR[s.status] || s.status;

              const isOpenPositive =
                s.sessionType === 'ONE_TO_ONE'
                  ? s.slotStatus === 'AVAILABLE'
                  : s.status === 'OPEN' && s.isRegistrationOpen;

              return (
                <article
                  key={s.id}
                  className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 bg-white hover:border-teal-600/60 transition-colors"
                  data-testid={`session-card-${s.id}`}
                >
                  <div className="space-y-3">
                    {/* Clean unboxed metadata row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                          {s.sessionType === 'ONE_TO_ONE' ? (
                            <User className="w-3.5 h-3.5 text-slate-700" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-teal-700" />
                          )}
                          <span>
                            {SESSION_TYPE_LABELS_AR[s.sessionType] || s.sessionType}
                          </span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            isOpenPositive
                              ? 'text-teal-800'
                              : s.slotStatus === 'PENDING'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {slotStatusLabel}
                        </span>
                      </div>

                      <span className="font-mono-num font-bold text-sm text-slate-900">
                        {formatCurrencyPrice(s.price, s.currency, isAr ? 'ar' : 'en')}
                      </span>
                    </div>

                    <div>
                      <h3
                        className="font-display text-base font-bold text-slate-900 leading-snug"
                        dir="auto"
                      >
                        {s.title}
                      </h3>
                      {(s.subjectNameAr || s.gradeNameAr || s.stageNameAr) && (
                        <div className="text-xs text-teal-800 font-medium mt-1">
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
                        <div className="text-xs text-slate-600 mt-1">
                          المعلّم:{' '}
                          <Link
                            to={`/instructors/${s.teacherUserId}`}
                            className="font-semibold text-teal-700 hover:underline"
                          >
                            {s.teacherName}
                          </Link>
                        </div>
                      )}
                    </div>

                    {s.description && (
                      <p
                        className="text-xs text-slate-600 leading-relaxed line-clamp-2"
                        dir="auto"
                      >
                        {s.description}
                      </p>
                    )}

                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5 font-mono-num">
                        <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span>{formatSessionDateRange(s.startTime, s.endTime)}</span>
                        <span className="text-slate-400">
                          ({s.durationMinutes} دقيقة)
                        </span>
                      </div>

                      <div className="flex items-start gap-1.5">
                        {!isOffline ? (
                          <Video className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 leading-relaxed">
                          <span className="font-medium text-slate-800">
                            {DELIVERY_MODE_LABELS_AR[s.deliveryMode] || s.deliveryMode}
                          </span>
                          {isOffline && s.location && (
                            <div
                              className="text-slate-700 font-medium"
                              data-testid={`session-address-${s.id}`}
                            >
                              العنوان: {s.location}
                              {s.isDemoLocation &&
                                !s.location.includes('موقع عرض تجريبي') && (
                                  <span className="text-slate-500 font-normal mr-1.5">
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
                            <span className="text-slate-600">
                              السعة: {s.acceptedCount} / {s.capacity} مقعد
                            </span>
                            <span className="font-semibold text-teal-800">
                              المقاعد المتبقية: {s.remainingSeats}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-700 transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((s.acceptedCount / s.capacity) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailModalSession(s)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>التفاصيل</span>
                    </button>

                    {myEnr &&
                    (myEnr.status === 'PENDING' || myEnr.status === 'ACCEPTED') ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            myEnr.status === 'ACCEPTED'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {ENROLLMENT_STATUS_LABELS_AR[myEnr.status] || myEnr.status}
                        </span>
                        {myEnr.status === 'ACCEPTED' && s.meetingUrl && (
                          <a
                            href={s.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
                          >
                            رابط الجلسة
                          </a>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelEnrollment(myEnr.id)}
                            className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        )}
                      </div>
                    ) : isOwnSession ? (
                      <span className="text-xs text-slate-500">
                        جلستك الخاصة
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
                        className="flex-1 py-2 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                      >
                        {s.sessionType === 'ONE_TO_ONE'
                          ? 'طلب جلسة فردية'
                          : 'طلب الانضمام للجلسة'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {s.isFull
                          ? 'اكتملت المقاعد المتاحة'
                          : 'التسجيل مغلق حالياً'}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-600 tabular-nums">
                صفحة {page} من {totalPages} (إجمالي {total} جلسة)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>السابق</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Session Details Modal */}
      {detailModalSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-teal-800 font-semibold">
                  {SESSION_TYPE_LABELS_AR[detailModalSession.sessionType]} ·{' '}
                  {DELIVERY_MODE_LABELS_AR[detailModalSession.deliveryMode]}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                  {detailModalSession.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalSession(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            {detailModalSession.description && (
              <p className="text-sm text-slate-700 leading-relaxed">
                {detailModalSession.description}
              </p>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
              <div>
                <dt className="text-slate-500">المعلّم</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {detailModalSession.teacherName}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">السعر</dt>
                <dd className="font-mono-num font-bold text-teal-800 mt-0.5">
                  {formatCurrencyPrice(
                    detailModalSession.price,
                    detailModalSession.currency,
                    isAr ? 'ar' : 'en'
                  )}
                </dd>
              </div>
              {detailModalSession.subjectNameAr && (
                <div>
                  <dt className="text-slate-500">المادة</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {detailModalSession.subjectNameAr}
                  </dd>
                </div>
              )}
              {(detailModalSession.gradeNameAr || detailModalSession.systemNameAr) && (
                <div>
                  <dt className="text-slate-500">الصف والنظام</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
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
              <div className="sm:col-span-2">
                <dt className="text-slate-500">الموعد والمدة</dt>
                <dd className="font-mono-num font-semibold text-slate-900 mt-0.5">
                  {formatSessionDateRange(
                    detailModalSession.startTime,
                    detailModalSession.endTime
                  )}{' '}
                  ({detailModalSession.durationMinutes} دقيقة)
                </dd>
              </div>
              {isOfflineDeliveryMode(detailModalSession.deliveryMode) &&
                detailModalSession.location && (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">العنوان الحضوري الكامل</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {detailModalSession.location}
                      {detailModalSession.isDemoLocation &&
                        !detailModalSession.location.includes('موقع عرض تجريبي') && (
                          <span className="text-slate-500 font-normal mr-1.5">
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
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                إغلاق
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
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    {detailModalSession.sessionType === 'ONE_TO_ONE'
                      ? 'طلب جلسة فردية'
                      : 'طلب الانضمام للجلسة'}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Request Booking Modal */}
      {requestModalSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          data-testid="session-booking-confirmation-modal"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {requestModalSession.sessionType === 'ONE_TO_ONE'
                ? 'تأكيد طلب جلسة فردية'
                : 'تأكيد طلب الانضمام لجلسة جماعية'}
            </h3>

            <dl className="text-xs text-slate-700 grid grid-cols-2 gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <div className="col-span-2">
                <dt className="text-slate-500">عنوان الجلسة</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {requestModalSession.title}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">المعلّم</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {requestModalSession.teacherName}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">المادة</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {requestModalSession.subjectNameAr || 'مادة عامة'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">الصف الدراسي</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {requestModalSession.gradeNameAr ||
                    requestModalSession.stageNameAr ||
                    'مفتوح'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">المدة</dt>
                <dd className="font-mono-num font-semibold text-slate-900 mt-0.5">
                  {requestModalSession.durationMinutes} دقيقة
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">التاريخ ووقت البدء</dt>
                <dd className="font-mono-num font-semibold text-slate-900 mt-0.5">
                  {formatSessionDateRange(
                    requestModalSession.startTime,
                    requestModalSession.endTime
                  )}
                </dd>
              </div>
              {isOfflineDeliveryMode(requestModalSession.deliveryMode) &&
                requestModalSession.location && (
                  <div className="col-span-2">
                    <dt className="text-slate-500">المكان الحضوري</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">
                      {requestModalSession.location}
                    </dd>
                  </div>
                )}
              <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">السعر المحدد</span>
                <span className="font-mono-num font-bold text-sm text-teal-800">
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  رسالة اختيارية للمعلّم
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اذكر هدفك من الجلسة أو الدروس التي تود التركيز عليها..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  {submitting ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب'}
                </button>
                <button
                  type="button"
                  onClick={() => setRequestModalSession(null)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
