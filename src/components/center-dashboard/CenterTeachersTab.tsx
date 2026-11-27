import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFetch,
  EMPLOYMENT_TYPE_LABELS_AR,
  type CenterTeacherItem,
  type CurriculumOverviewResponse,
} from '../../lib/api';
import { EmptyState } from '../ui/EmptyState';

interface TaxonomyLite {
  stages: Array<{ id: number; nameAr: string }>;
  subjects: Array<{ id: number; nameAr: string; stageId?: number | null }>;
}

interface AssignmentDraft {
  subjectId: string;
  stageId: string;
  systemId: string;
  gradeId: string;
  divisionId: string;
  pathwayId: string;
  notes: string;
}

interface CenterTeachersTabProps {
  centerId: number;
  teachers: CenterTeacherItem[];
  taxonomy: TaxonomyLite;
  curriculum: CurriculumOverviewResponse | null;
  onRefresh: () => Promise<void>;
  onNotify: (variant: 'success' | 'error', msg: string) => void;
}

const MEMBER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'مالك المركز',
  MANAGER: 'مدير إداري',
  INSTRUCTOR: 'معلّم / مدرّب',
  STAFF: 'موظف دعم',
};

export function CenterTeachersTab({
  centerId,
  teachers,
  taxonomy,
  curriculum,
  onRefresh,
  onNotify,
}: CenterTeachersTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<CenterTeacherItem | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [employmentType, setEmploymentType] = useState<
    'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE'
  >('PART_TIME');
  const [memberRole, setMemberRole] = useState<'INSTRUCTOR' | 'MANAGER' | 'STAFF'>(
    'INSTRUCTOR'
  );
  const [notes, setNotes] = useState('');
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (q) {
        const hay = `${t.fullName} ${t.email} ${t.jobTitle} ${t.phone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [teachers, search, statusFilter]);

  const openAddModal = () => {
    setEditingTeacher(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setJobTitle('');
    setEmploymentType('PART_TIME');
    setMemberRole('INSTRUCTOR');
    setNotes('');
    setAssignments([
      {
        subjectId: taxonomy.subjects[0] ? String(taxonomy.subjects[0].id) : '',
        stageId: taxonomy.stages[0] ? String(taxonomy.stages[0].id) : '',
        systemId: '',
        gradeId: '',
        divisionId: '',
        pathwayId: '',
        notes: '',
      },
    ]);
    setModalOpen(true);
  };

  const openEditModal = (t: CenterTeacherItem) => {
    setEditingTeacher(t);
    setFullName(t.fullName);
    setEmail(t.email);
    setPhone(t.phone || '');
    setPassword('');
    setJobTitle(t.jobTitle);
    setEmploymentType(t.employmentType || 'PART_TIME');
    setMemberRole(
      t.memberRole === 'MANAGER' || t.memberRole === 'STAFF'
        ? t.memberRole
        : 'INSTRUCTOR'
    );
    setNotes(t.notes || '');
    setAssignments(
      t.assignments.map((a) => ({
        subjectId: String(a.subjectId),
        stageId: String(a.stageId),
        systemId: a.systemId ? String(a.systemId) : '',
        gradeId: a.gradeId ? String(a.gradeId) : '',
        divisionId: a.divisionId ? String(a.divisionId) : '',
        pathwayId: a.pathwayId ? String(a.pathwayId) : '',
        notes: a.notes || '',
      }))
    );
    setModalOpen(true);
  };

  const handleToggleStatus = async (t: CenterTeacherItem) => {
    const nextStatus = t.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTogglingId(t.id);
    try {
      await apiFetch(
        `/api/center-dashboard/${centerId}/teachers/${t.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      onNotify(
        'success',
        nextStatus === 'ACTIVE'
          ? `تم تفعيل عضوية ${t.fullName} داخل هذا المركز.`
          : `تم تعطيل عضوية ${t.fullName} داخل هذا المركز فقط دون المساس بحسابه في المنصة.`
      );
      await onRefresh();
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر تغيير حالة العضو.'
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const normalizedAssignments = assignments
        .filter((a) => a.subjectId && a.stageId)
        .map((a) => ({
          subjectId: Number(a.subjectId),
          stageId: Number(a.stageId),
          systemId: a.systemId ? Number(a.systemId) : null,
          gradeId: a.gradeId ? Number(a.gradeId) : null,
          divisionId: a.divisionId ? Number(a.divisionId) : null,
          pathwayId: a.pathwayId ? Number(a.pathwayId) : null,
          notes: a.notes.trim() || undefined,
        }));

      if (editingTeacher) {
        await apiFetch(
          `/api/center-dashboard/${centerId}/teachers/${editingTeacher.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...(editingTeacher.memberRole !== 'OWNER'
                ? {
                    fullName: fullName.trim(),
                    phone: phone.trim() || null,
                    memberRole,
                  }
                : {}),
              jobTitle: jobTitle.trim(),
              employmentType,
              notes: notes.trim() || null,
              assignments: normalizedAssignments,
            }),
          }
        );
        onNotify('success', 'تم تحديث بيانات المعلّم وتكليفاته بنجاح.');
      } else {
        await apiFetch(`/api/center-dashboard/${centerId}/teachers`, {
          method: 'POST',
          body: JSON.stringify({
            fullName: fullName.trim() || undefined,
            email: email.trim(),
            phone: phone.trim() || undefined,
            password: password.trim() || undefined,
            jobTitle: jobTitle.trim(),
            employmentType,
            memberRole,
            notes: notes.trim() || undefined,
            assignments: normalizedAssignments,
          }),
        });
        onNotify('success', 'تمت إضافة المعلّم إلى فريق المركز بنجاح.');
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر حفظ بيانات المعلّم.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="jusoor-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، البريد، التخصص أو الهاتف..."
            className="jusoor-input px-3 py-2 text-xs sm:text-sm flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
            }
            aria-label="تصفية حسب الحالة"
            className="jusoor-select px-3 py-2 text-xs sm:text-sm"
          >
            <option value="ALL">كل الحالات ({teachers.length})</option>
            <option value="ACTIVE">
              نشطون ({teachers.filter((t) => t.status === 'ACTIVE').length})
            </option>
            <option value="INACTIVE">
              غير نشطين ({teachers.filter((t) => t.status === 'INACTIVE').length})
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
        >
          <i className="bi bi-person-plus" aria-hidden="true" />
          <span>إضافة معلّم أو عضو كادر</span>
        </button>
      </div>

      {filteredTeachers.length === 0 ? (
        <EmptyState
          icon="bi-person-workspace"
          title="لا يوجد معلّمون مطابقون للبحث"
          description="يمكنك إضافة معلّم جديد أو ربط معلّم حالي في المنصة بفريق المركز."
          action={
            <button
              type="button"
              onClick={openAddModal}
              className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
            >
              + إضافة معلّم
            </button>
          }
        />
      ) : (
        <div className="row g-3">
          {filteredTeachers.map((t) => (
            <div key={t.id} className="col-12 col-lg-6">
              <article className="jusoor-card p-4 sm:p-5 h-full flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/instructors/${t.userId}`}
                          className="font-display text-base font-bold text-[#102A43] hover:text-[#247BA0]"
                        >
                          {t.fullName}
                        </Link>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            t.status === 'ACTIVE'
                              ? 'bg-[#E8F8F5] text-[#0F766E]'
                              : 'bg-[#FEF2F2] text-[#991B1B]'
                          }`}
                        >
                          {t.status === 'ACTIVE' ? 'نشط بالمركز' : 'غير نشط بالمركز'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#247BA0] mt-0.5">
                        {t.jobTitle}
                      </div>
                      <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-2 mt-1">
                        <span>{MEMBER_ROLE_LABELS[t.memberRole] || t.memberRole}</span>
                        <span>·</span>
                        <span>
                          {EMPLOYMENT_TYPE_LABELS_AR[t.employmentType] ||
                            t.employmentType}
                        </span>
                        <span>·</span>
                        <span dir="ltr">{t.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="btn-jusoor-outline px-2.5 py-1.5 text-xs cursor-pointer"
                      >
                        تعديل
                      </button>
                      {t.memberRole !== 'OWNER' && (
                        <button
                          type="button"
                          disabled={togglingId === t.id}
                          onClick={() => void handleToggleStatus(t)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            t.status === 'ACTIVE'
                              ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]'
                              : 'border-[#99E2D8] bg-[#E8F8F5] text-[#0F766E] hover:bg-[#D1FAF0]'
                          }`}
                        >
                          {togglingId === t.id
                            ? '...'
                            : t.status === 'ACTIVE'
                            ? 'تعطيل بالمركز'
                            : 'تفعيل بالمركز'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats bar */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="jusoor-subcard px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">الدورات بالمركز</span>
                      <span className="font-mono-num font-bold text-[#102A43]">
                        {t.coursesCount}
                      </span>
                    </div>
                    <div className="jusoor-subcard px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">الطلاب المسندون</span>
                      <span className="font-mono-num font-bold text-[#0F766E]">
                        {t.studentsCount}
                      </span>
                    </div>
                  </div>

                  {/* Curriculum Assignments */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-[#102A43]">
                      المواد والمراحل المسندة داخل المركز:
                    </div>
                    {t.assignments.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] m-0">
                        لم يتم تحديد مواد دراسية مخصصة بعد.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {t.assignments.map((a) => (
                          <span
                            key={a.id}
                            className="text-[11px] px-2.5 py-1 rounded-md bg-[#F5F8FC] border border-[#DCE5F0] text-[#172B4D]"
                          >
                            {a.subjectNameAr} · {a.stageNameAr}
                            {a.gradeNameAr ? ` · ${a.gradeNameAr}` : ''}
                            {a.divisionNameAr ? ` (${a.divisionNameAr})` : ''}
                            {a.pathwayNameAr ? ` (${a.pathwayNameAr})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {t.notes && (
                  <p className="text-[11px] text-[#64748B] m-0 pt-2 border-t border-[#EDF2F7]">
                    ملاحظات: {t.notes}
                  </p>
                )}
              </article>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Teacher Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-2xl p-4 sm:p-6 my-auto max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
              <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                {editingTeacher
                  ? `تعديل بيانات: ${editingTeacher.fullName}`
                  : 'إضافة معلّم أو عضو جديد للمركز'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-lg text-[#64748B] hover:bg-[#EEF4FA] inline-flex items-center justify-center cursor-pointer"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    required={!editingTeacher}
                    disabled={editingTeacher?.memberRole === 'OWNER'}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: أ. أحمد محمود"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingTeacher)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@center.edu"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المسمى الوظيفي / التخصص
                  </label>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="مثال: معلّم الرياضيات للمرحلة الثانوية"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    disabled={editingTeacher?.memberRole === 'OWNER'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+2010..."
                    className="jusoor-input w-full px-3 py-2 text-sm"
                    dir="ltr"
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    نوع التعاقد / الدوام
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) =>
                      setEmploymentType(
                        e.target.value as
                          | 'FULL_TIME'
                          | 'PART_TIME'
                          | 'CONTRACT'
                          | 'FREELANCE'
                      )
                    }
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="FULL_TIME">دوام كامل</option>
                    <option value="PART_TIME">دوام جزئي</option>
                    <option value="CONTRACT">تعاقد فصلي</option>
                    <option value="FREELANCE">مستقل / بالساعة</option>
                  </select>
                </div>
                <div className="col-12 col-sm-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الدور بالمركز
                  </label>
                  <select
                    disabled={editingTeacher?.memberRole === 'OWNER'}
                    value={memberRole}
                    onChange={(e) =>
                      setMemberRole(
                        e.target.value as 'INSTRUCTOR' | 'MANAGER' | 'STAFF'
                      )
                    }
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="INSTRUCTOR">معلّم / مدرّب</option>
                    <option value="MANAGER">مدير فرعي</option>
                    <option value="STAFF">موظف مركز</option>
                  </select>
                </div>
                {!editingTeacher && (
                  <div className="col-12 col-sm-4">
                    <label className="block text-xs font-bold text-[#102A43] mb-1">
                      كلمة مرور مبدئية (اختياري)
                    </label>
                    <input
                      type="password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 أحرف على الأقل"
                      className="jusoor-input w-full px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Curriculum Assignments */}
              <div className="jusoor-subcard p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#102A43]">
                    إسناد المواد والمراحل والصفوف الدراسية
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAssignments((prev) => [
                        ...prev,
                        {
                          subjectId: taxonomy.subjects[0]
                            ? String(taxonomy.subjects[0].id)
                            : '',
                          stageId: taxonomy.stages[0]
                            ? String(taxonomy.stages[0].id)
                            : '',
                          systemId: '',
                          gradeId: '',
                          divisionId: '',
                          pathwayId: '',
                          notes: '',
                        },
                      ])
                    }
                    className="text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
                  >
                    + إضافة تكليف مادة
                  </button>
                </div>

                {assignments.length === 0 ? (
                  <p className="text-xs text-[#64748B] m-0">
                    لا توجد تكليفات مواد حالياً.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {assignments.map((a, idx) => {
                      const stageNum = a.stageId ? Number(a.stageId) : null;
                      const systemsForStage = (curriculum?.systems || []).filter(
                        (s) => !stageNum || s.stageId === stageNum
                      );
                      const sysNum = a.systemId ? Number(a.systemId) : null;
                      const gradesForSystem = (curriculum?.grades || []).filter(
                        (g) => (!stageNum || g.stageId === stageNum) && (!sysNum || g.systemId === sysNum)
                      );
                      const gradeNum = a.gradeId ? Number(a.gradeId) : null;
                      const divisionsForGrade = (curriculum?.divisions || []).filter(
                        (d) => gradeNum && d.gradeId === gradeNum
                      );
                      const pathwaysForGrade = (curriculum?.pathways || []).filter(
                        (p) => gradeNum && p.gradeId === gradeNum
                      );

                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-white border border-[#DCE5F0] rounded-lg space-y-2"
                        >
                          <div className="row g-2">
                            <div className="col-12 col-sm-4">
                              <select
                                value={a.subjectId}
                                onChange={(e) =>
                                  setAssignments((prev) =>
                                    prev.map((x, i) =>
                                      i === idx ? { ...x, subjectId: e.target.value } : x
                                    )
                                  )
                                }
                                aria-label="المادة"
                                className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                              >
                                <option value="">اختر المادة</option>
                                {taxonomy.subjects.map((sub) => (
                                  <option key={sub.id} value={sub.id}>
                                    {sub.nameAr}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-12 col-sm-4">
                              <select
                                value={a.stageId}
                                onChange={(e) =>
                                  setAssignments((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            stageId: e.target.value,
                                            systemId: '',
                                            gradeId: '',
                                            divisionId: '',
                                            pathwayId: '',
                                          }
                                        : x
                                    )
                                  )
                                }
                                aria-label="المرحلة"
                                className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                              >
                                <option value="">اختر المرحلة</option>
                                {taxonomy.stages.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.nameAr}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-12 col-sm-4">
                              <select
                                value={a.systemId}
                                onChange={(e) =>
                                  setAssignments((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            systemId: e.target.value,
                                            gradeId: '',
                                            divisionId: '',
                                            pathwayId: '',
                                          }
                                        : x
                                    )
                                  )
                                }
                                aria-label="النظام التعليمي"
                                className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                              >
                                <option value="">كل الأنظمة</option>
                                {systemsForStage.map((sys) => (
                                  <option key={sys.id} value={sys.id}>
                                    {sys.nameAr}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-12 col-sm-4">
                              <select
                                value={a.gradeId}
                                onChange={(e) =>
                                  setAssignments((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? {
                                            ...x,
                                            gradeId: e.target.value,
                                            divisionId: '',
                                            pathwayId: '',
                                          }
                                        : x
                                    )
                                  )
                                }
                                aria-label="الصف الدراسي"
                                className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                              >
                                <option value="">كل الصفوف</option>
                                {gradesForSystem.map((gr) => (
                                  <option key={gr.id} value={gr.id}>
                                    {gr.nameAr}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {divisionsForGrade.length > 0 && (
                              <div className="col-12 col-sm-4">
                                <select
                                  value={a.divisionId}
                                  onChange={(e) =>
                                    setAssignments((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? { ...x, divisionId: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                  aria-label="الشعبة"
                                  className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                                >
                                  <option value="">اختر الشعبة</option>
                                  {divisionsForGrade.map((dv) => (
                                    <option key={dv.id} value={dv.id}>
                                      {dv.nameAr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {pathwaysForGrade.length > 0 && (
                              <div className="col-12 col-sm-4">
                                <select
                                  value={a.pathwayId}
                                  onChange={(e) =>
                                    setAssignments((prev) =>
                                      prev.map((x, i) =>
                                        i === idx
                                          ? { ...x, pathwayId: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                  aria-label="المسار"
                                  className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                                >
                                  <option value="">اختر المسار</option>
                                  {pathwaysForGrade.map((pw) => (
                                    <option key={pw.id} value={pw.id}>
                                      {pw.nameAr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setAssignments((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-[11px] font-semibold text-[#991B1B] hover:underline cursor-pointer"
                            >
                              حذف التكليف
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  ملاحظات إدارية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE5F0]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-jusoor-primary px-5 py-2 text-xs cursor-pointer disabled:opacity-60"
                >
                  {submitting
                    ? 'جارٍ الحفظ...'
                    : editingTeacher
                    ? 'حفظ التعديلات'
                    : 'إضافة المعلّم للمركز'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
