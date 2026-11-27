import React, { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  ATTENDANCE_STATUS_LABELS_AR,
  PAYMENT_METHOD_LABELS_AR,
  PAYMENT_STATUS_LABELS_AR,
  type CenterCourseItem,
  type CenterStudentDetailResponse,
  type CenterStudentListItem,
  type CurriculumOverviewResponse,
} from '../../lib/api';
import { EmptyState } from '../ui/EmptyState';

interface CenterStudentsTabProps {
  centerId: number;
  students: CenterStudentListItem[];
  courses: CenterCourseItem[];
  stages: Array<{ id: number; nameAr: string }>;
  curriculum: CurriculumOverviewResponse | null;
  onRefresh: (filters?: {
    q?: string;
    stageId?: string;
    gradeId?: string;
  }) => Promise<void>;
  onNotify: (variant: 'success' | 'error', msg: string) => void;
}

export function CenterStudentsTab({
  centerId,
  students,
  courses,
  stages,
  curriculum,
  onRefresh,
  onNotify,
}: CenterStudentsTabProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [searching, setSearching] = useState(false);

  // Register Student Modal
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regStageId, setRegStageId] = useState('');
  const [regGradeId, setRegGradeId] = useState('');
  const [regGuardianName, setRegGuardianName] = useState('');
  const [regGuardianPhone, setRegGuardianPhone] = useState('');
  const [regCourseId, setRegCourseId] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Detail Modal
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CenterStudentDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Attendance form
  const [attDate, setAttDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [attStatus, setAttStatus] = useState<
    'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
  >('PRESENT');
  const [attCourseId, setAttCourseId] = useState('');
  const [attNotes, setAttNotes] = useState('');
  const [attSaving, setAttSaving] = useState(false);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState('EGP');
  const [payStatus, setPayStatus] = useState<
    'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE' | 'REFUNDED'
  >('PAID');
  const [payMethod, setPayMethod] = useState<
    'CASH' | 'CARD' | 'TRANSFER' | 'WALLET'
  >('CASH');
  const [payCourseId, setPayCourseId] = useState('');
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  // Enroll in additional course
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrollSaving, setEnrollSaving] = useState(false);

  const applyFilters = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearching(true);
    try {
      await onRefresh({
        q: search.trim(),
        stageId: stageFilter,
        gradeId: gradeFilter,
      });
    } finally {
      setSearching(false);
    }
  };

  const loadStudentDetail = useCallback(
    async (studentUserId: number) => {
      setDetailLoading(true);
      try {
        const res = await apiFetch<CenterStudentDetailResponse>(
          `/api/center-dashboard/${centerId}/students/${studentUserId}`
        );
        setDetail(res);
      } catch (err) {
        onNotify(
          'error',
          err instanceof Error ? err.message : 'تعذر تحميل ملف الطالب.'
        );
        setSelectedStudentId(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [centerId, onNotify]
  );

  useEffect(() => {
    if (selectedStudentId) {
      void loadStudentDetail(selectedStudentId);
    }
  }, [selectedStudentId, loadStudentDetail]);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSubmitting(true);
    try {
      await apiFetch(`/api/center-dashboard/${centerId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: regName.trim(),
          email: regEmail.trim() || undefined,
          phone: regPhone.trim(),
          stageId: regStageId ? Number(regStageId) : null,
          gradeId: regGradeId ? Number(regGradeId) : null,
          guardianName: regGuardianName.trim() || undefined,
          guardianPhone: regGuardianPhone.trim() || undefined,
          courseId: regCourseId ? Number(regCourseId) : null,
          notes: regNotes.trim() || undefined,
        }),
      });
      setShowRegister(false);
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegStageId('');
      setRegGradeId('');
      setRegGuardianName('');
      setRegGuardianPhone('');
      setRegCourseId('');
      setRegNotes('');
      onNotify('success', 'تم تسجيل الطالب وإضافته إلى سجل المركز بنجاح.');
      await onRefresh({ q: search.trim(), stageId: stageFilter, gradeId: gradeFilter });
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر تسجيل الطالب.'
      );
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setAttSaving(true);
    try {
      await apiFetch(
        `/api/center-dashboard/${centerId}/students/${selectedStudentId}/attendance`,
        {
          method: 'POST',
          body: JSON.stringify({
            attendanceDate: attDate,
            status: attStatus,
            courseId: attCourseId ? Number(attCourseId) : null,
            notes: attNotes.trim() || undefined,
          }),
        }
      );
      setAttNotes('');
      onNotify('success', 'تم تسجيل سجل الحضور/الغياب للطالب.');
      await Promise.all([
        loadStudentDetail(selectedStudentId),
        onRefresh({ q: search.trim(), stageId: stageFilter, gradeId: gradeFilter }),
      ]);
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر تسجيل الحضور.'
      );
    } finally {
      setAttSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    const numericAmount = Number(payAmount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      onNotify('error', 'يرجى إدخال مبلغ مالي صحيح.');
      return;
    }
    setPaySaving(true);
    try {
      await apiFetch(
        `/api/center-dashboard/${centerId}/students/${selectedStudentId}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: numericAmount,
            currency: payCurrency,
            status: payStatus,
            paymentMethod: payMethod,
            courseId: payCourseId ? Number(payCourseId) : null,
            paidAt: payDate,
            notes: payNotes.trim() || undefined,
          }),
        }
      );
      setPayAmount('');
      setPayNotes('');
      onNotify('success', 'تم تسجيل الدفعة المالية في سجل الطالب.');
      await Promise.all([
        loadStudentDetail(selectedStudentId),
        onRefresh({ q: search.trim(), stageId: stageFilter, gradeId: gradeFilter }),
      ]);
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر تسجيل الدفعة المالية.'
      );
    } finally {
      setPaySaving(false);
    }
  };

  const handleEnrollExtraCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !enrollCourseId) return;
    setEnrollSaving(true);
    try {
      await apiFetch(
        `/api/center-dashboard/${centerId}/students/${selectedStudentId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enrollCourseId: Number(enrollCourseId) }),
        }
      );
      setEnrollCourseId('');
      onNotify('success', 'تم إلحاق الطالب بالدورة المختارة.');
      await Promise.all([
        loadStudentDetail(selectedStudentId),
        onRefresh({ q: search.trim(), stageId: stageFilter, gradeId: gradeFilter }),
      ]);
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر إلحاق الطالب بالدورة.'
      );
    } finally {
      setEnrollSaving(false);
    }
  };

  const gradesList = curriculum?.grades || [];
  const filteredGradesForFilter = stageFilter
    ? gradesList.filter((g) => g.stageId === Number(stageFilter))
    : gradesList;
  const regFilteredGrades = regStageId
    ? gradesList.filter((g) => g.stageId === Number(regStageId))
    : gradesList;

  return (
    <div className="space-y-4">
      {/* Filters + Register CTA */}
      <form
        onSubmit={applyFilters}
        className="jusoor-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الطالب أو رقم الهاتف..."
            className="jusoor-input px-3 py-2 text-xs sm:text-sm min-w-[200px] flex-1"
          />
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setGradeFilter('');
            }}
            aria-label="تصفية حسب المرحلة"
            className="jusoor-select px-3 py-2 text-xs sm:text-sm"
          >
            <option value="">كل المراحل</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="تصفية حسب الصف"
            className="jusoor-select px-3 py-2 text-xs sm:text-sm"
          >
            <option value="">كل الصفوف</option>
            {filteredGradesForFilter.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nameAr}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={searching}
            className="btn-jusoor-outline px-3.5 py-2 text-xs cursor-pointer"
          >
            {searching ? 'جارٍ البحث...' : 'تطبيق الفلتر'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
        >
          <i className="bi bi-person-plus" aria-hidden="true" />
          <span>تسجيل طالب جديد</span>
        </button>
      </form>

      {students.length === 0 ? (
        <EmptyState
          icon="bi-people"
          title="لا يوجد طلاب مسجّلون بهذا الفلتر"
          description="يعرض هذا القسم طلاب هذا المركز فقط مع اشتراكاتهم وسجلات حضورهم ومدفوعاتهم."
          action={
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
            >
              + تسجيل أول طالب
            </button>
          }
        />
      ) : (
        <div className="jusoor-card overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-xs sm:text-sm">
              <thead className="bg-[#F5F8FC] text-[#102A43]">
                <tr>
                  <th className="py-3 px-3 font-bold">الطالب</th>
                  <th className="py-3 px-3 font-bold">المرحلة / الصف</th>
                  <th className="py-3 px-3 font-bold">الدورات والمعلّمون</th>
                  <th className="py-3 px-3 font-bold">الحضور والغياب</th>
                  <th className="py-3 px-3 font-bold">المدفوعات</th>
                  <th className="py-3 px-3 font-bold text-end">ملف الطالب</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.studentUserId}>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#102A43]">{st.fullName}</div>
                      <div className="text-[11px] text-[#64748B]" dir="ltr">
                        {st.phone || st.email}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-semibold text-[#172B4D]">
                        {st.stageNameAr || 'غير محدد'}
                      </div>
                      {st.gradeNameAr && (
                        <div className="text-[11px] text-[#64748B]">
                          {st.gradeNameAr}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-semibold text-[#247BA0]">
                        {st.enrolledCourses.length} دورات
                      </div>
                      {st.assignedTeachers.length > 0 && (
                        <div className="text-[11px] text-[#64748B] truncate max-w-[200px]">
                          {st.assignedTeachers.map((t) => t.fullName).join('، ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono-num text-xs text-[#0F766E] font-semibold">
                        حاضر: {st.attendanceSummary.present} · غائب:{' '}
                        {st.attendanceSummary.absent}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        إجمالي السجلات: {st.attendanceSummary.total}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono-num text-xs font-bold text-[#102A43]">
                        مدفوع: {st.paymentsSummary.totalPaid.toFixed(2)}
                      </div>
                      {st.paymentsSummary.lastStatus && (
                        <div className="text-[11px] text-[#64748B]">
                          آخر حالة:{' '}
                          {PAYMENT_STATUS_LABELS_AR[st.paymentsSummary.lastStatus] ||
                            st.paymentsSummary.lastStatus}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-end">
                      <button
                        type="button"
                        onClick={() => setSelectedStudentId(st.studentUserId)}
                        className="btn-jusoor-outline px-3 py-1.5 text-xs cursor-pointer"
                      >
                        عرض السجل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Student Modal */}
      {showRegister && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-xl p-4 sm:p-6 my-auto max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
              <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                تسجيل طالب جديد في المركز
              </h3>
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-lg text-[#64748B] hover:bg-[#EEF4FA] inline-flex items-center justify-center cursor-pointer"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleRegisterStudent} className="space-y-3">
              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الاسم الكامل للطالب
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="مثال: مريم عبد الله"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="01012345678"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المرحلة التعليمية
                  </label>
                  <select
                    value={regStageId}
                    onChange={(e) => {
                      setRegStageId(e.target.value);
                      setRegGradeId('');
                    }}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">اختر المرحلة</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الصف الدراسي (اختياري)
                  </label>
                  <select
                    value={regGradeId}
                    onChange={(e) => setRegGradeId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">اختر الصف</option>
                    {regFilteredGrades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    تسجيل مباشر في دورة (اختياري)
                  </label>
                  <select
                    value={regCourseId}
                    onChange={(e) => setRegCourseId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">بدون تسجيل فوري</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    اسم ولي الأمر (اختياري)
                  </label>
                  <input
                    type="text"
                    value={regGuardianName}
                    onChange={(e) => setRegGuardianName(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    هاتف ولي الأمر (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={regGuardianPhone}
                    onChange={(e) => setRegGuardianPhone(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  ملاحظات تعليمية
                </label>
                <textarea
                  rows={2}
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE5F0]">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="btn-jusoor-primary px-5 py-2 text-xs cursor-pointer disabled:opacity-60"
                >
                  {regSubmitting ? 'جارٍ التسجيل...' : 'تأكيد تسجيل الطالب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Profile & Educational History Modal */}
      {selectedStudentId && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-4xl p-4 sm:p-6 my-auto max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
              <div>
                <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                  {detail?.student.fullName || 'سجل الطالب التفصيلي'}
                </h3>
                {detail && (
                  <p className="text-xs text-[#64748B] m-0 mt-0.5" dir="ltr">
                    {detail.student.phone || detail.student.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedStudentId(null);
                  setDetail(null);
                }}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-lg text-[#64748B] hover:bg-[#EEF4FA] inline-flex items-center justify-center cursor-pointer"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                جارٍ تحميل ملف الطالب وسجلاته...
              </div>
            ) : (
              <div className="space-y-5">
                {/* Summary Info */}
                <div className="jusoor-subcard p-3.5 row g-3">
                  <div className="col-6 col-md-3">
                    <div className="text-[11px] text-[#64748B]">المرحلة التعليمية</div>
                    <div className="text-xs font-bold text-[#102A43]">
                      {detail.student.stageNameAr || 'غير محددة'}
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="text-[11px] text-[#64748B]">الصف الدراسي</div>
                    <div className="text-xs font-bold text-[#102A43]">
                      {detail.student.gradeNameAr || 'غير محدد'}
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="text-[11px] text-[#64748B]">ولي الأمر</div>
                    <div className="text-xs font-bold text-[#102A43]">
                      {detail.student.guardianName || '—'}
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="text-[11px] text-[#64748B]">هاتف ولي الأمر</div>
                    <div className="text-xs font-bold text-[#102A43]" dir="ltr">
                      {detail.student.guardianPhone || '—'}
                    </div>
                  </div>
                </div>

                {/* Enrolled Courses + Quick Enroll */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-display text-sm font-bold text-[#102A43] m-0">
                      الدورات المسجّل بها داخل المركز ({detail.enrollments.length})
                    </h4>
                    <form
                      onSubmit={handleEnrollExtraCourse}
                      className="flex items-center gap-2"
                    >
                      <select
                        value={enrollCourseId}
                        onChange={(e) => setEnrollCourseId(e.target.value)}
                        aria-label="إلحاق الطالب بدورة"
                        className="jusoor-select px-2.5 py-1.5 text-xs"
                      >
                        <option value="">إلحاق بدورة جديدة...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!enrollCourseId || enrollSaving}
                        className="btn-jusoor-primary px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                      >
                        {enrollSaving ? '...' : 'إلحاق'}
                      </button>
                    </form>
                  </div>

                  {detail.enrollments.length === 0 ? (
                    <p className="text-xs text-[#64748B] m-0">
                      لم يُلحق الطالب بأي دورة في المركز بعد.
                    </p>
                  ) : (
                    <div className="row g-2.5">
                      {detail.enrollments.map((enr) => (
                        <div key={enr.enrollmentId} className="col-12 col-md-6">
                          <div className="jusoor-subcard p-3 space-y-1.5">
                            <div className="text-xs font-bold text-[#102A43]">
                              {enr.courseTitle}
                            </div>
                            <div className="text-[11px] text-[#64748B] flex items-center justify-between">
                              <span>المعلّم: {enr.instructorName}</span>
                              <span className="font-mono-num text-[#0F766E] font-bold">
                                التقدم: {enr.completionPercent ?? 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="row g-4">
                  {/* Attendance Section */}
                  <div className="col-12 col-lg-6 space-y-3">
                    <h4 className="font-display text-sm font-bold text-[#102A43] m-0">
                      سجل الحضور والغياب ({detail.attendance.length})
                    </h4>

                    <form
                      onSubmit={handleRecordAttendance}
                      className="jusoor-subcard p-3 space-y-2"
                    >
                      <div className="row g-2">
                        <div className="col-6">
                          <input
                            type="date"
                            required
                            value={attDate}
                            onChange={(e) => setAttDate(e.target.value)}
                            className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="col-6">
                          <select
                            value={attStatus}
                            onChange={(e) =>
                              setAttStatus(
                                e.target.value as
                                  | 'PRESENT'
                                  | 'ABSENT'
                                  | 'LATE'
                                  | 'EXCUSED'
                              )
                            }
                            aria-label="حالة الحضور"
                            className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                          >
                            <option value="PRESENT">حاضر</option>
                            <option value="ABSENT">غائب</option>
                            <option value="LATE">متأخر</option>
                            <option value="EXCUSED">غياب بعذر</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <select
                            value={attCourseId}
                            onChange={(e) => setAttCourseId(e.target.value)}
                            aria-label="الدورة المرتبطة"
                            className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                          >
                            <option value="">حضور عام بالمركز</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 flex gap-2">
                          <input
                            type="text"
                            value={attNotes}
                            onChange={(e) => setAttNotes(e.target.value)}
                            placeholder="ملاحظة الحضور (اختياري)"
                            className="jusoor-input flex-1 px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="submit"
                            disabled={attSaving}
                            className="btn-jusoor-primary px-3 py-1.5 text-xs cursor-pointer shrink-0"
                          >
                            {attSaving ? '...' : 'تسجيل'}
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {detail.attendance.map((a) => (
                        <div
                          key={a.id}
                          className="p-2.5 border border-[#DCE5F0] rounded-lg flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#102A43]">
                              {ATTENDANCE_STATUS_LABELS_AR[a.status] || a.status}
                            </div>
                            <div className="text-[11px] text-[#64748B]">
                              {a.courseTitle || 'حضور بالمركز'}
                              {a.notes ? ` · ${a.notes}` : ''}
                            </div>
                          </div>
                          <span
                            dir="ltr"
                            className="font-mono-num text-[11px] text-[#64748B] whitespace-nowrap shrink-0"
                          >
                            {a.attendanceDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payments Section */}
                  <div className="col-12 col-lg-6 space-y-3">
                    <h4 className="font-display text-sm font-bold text-[#102A43] m-0">
                      سجل المدفوعات المالية ({detail.payments.length})
                    </h4>

                    <form
                      onSubmit={handleRecordPayment}
                      className="jusoor-subcard p-3 space-y-2"
                    >
                      <div className="row g-2">
                        <div className="col-4">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="المبلغ"
                            className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="col-4">
                          <select
                            value={payStatus}
                            onChange={(e) =>
                              setPayStatus(
                                e.target.value as
                                  | 'PAID'
                                  | 'PENDING'
                                  | 'PARTIAL'
                                  | 'OVERDUE'
                                  | 'REFUNDED'
                              )
                            }
                            aria-label="حالة الدفع"
                            className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                          >
                            <option value="PAID">مدفوعة</option>
                            <option value="PARTIAL">جزئية</option>
                            <option value="PENDING">معلّقة</option>
                            <option value="OVERDUE">متأخرة</option>
                            <option value="REFUNDED">مستردة</option>
                          </select>
                        </div>
                        <div className="col-4">
                          <select
                            value={payMethod}
                            onChange={(e) =>
                              setPayMethod(
                                e.target.value as
                                  | 'CASH'
                                  | 'CARD'
                                  | 'TRANSFER'
                                  | 'WALLET'
                              )
                            }
                            aria-label="طريقة الدفع"
                            className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                          >
                            <option value="CASH">نقدي</option>
                            <option value="CARD">بطاقة</option>
                            <option value="TRANSFER">تحويل</option>
                            <option value="WALLET">محفظة</option>
                          </select>
                        </div>
                        <div className="col-6">
                          <input
                            type="date"
                            required
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="col-6">
                          <select
                            value={payCurrency}
                            onChange={(e) => setPayCurrency(e.target.value)}
                            aria-label="العملة"
                            className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                          >
                            <option value="EGP">EGP</option>
                            <option value="SAR">SAR</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <select
                            value={payCourseId}
                            onChange={(e) => setPayCourseId(e.target.value)}
                            aria-label="دورة الدفع"
                            className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                          >
                            <option value="">دفعة عامة للمركز</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 flex gap-2">
                          <input
                            type="text"
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            placeholder="بيان أو ملاحظة الدفعة"
                            className="jusoor-input flex-1 px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="submit"
                            disabled={paySaving}
                            className="btn-jusoor-primary px-3 py-1.5 text-xs cursor-pointer shrink-0"
                          >
                            {paySaving ? '...' : 'حفظ الدفعة'}
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {detail.payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 border border-[#DCE5F0] rounded-lg flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-[#102A43] font-mono-num">
                              {p.amount} {p.currency} ·{' '}
                              <span className="text-[#0F766E]">
                                {PAYMENT_STATUS_LABELS_AR[p.status] || p.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#64748B]">
                              {PAYMENT_METHOD_LABELS_AR[p.paymentMethod] ||
                                p.paymentMethod}
                              {p.courseTitle ? ` · ${p.courseTitle}` : ''}
                            </div>
                          </div>
                          <span
                            dir="ltr"
                            className="font-mono-num text-[11px] text-[#64748B] whitespace-nowrap shrink-0"
                          >
                            {p.paidAt}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
