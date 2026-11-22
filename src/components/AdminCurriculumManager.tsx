import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Copy,
  CheckCircle2,
  AlertCircle,
  Layers,
  Plus,
  Trash2,
  Users,
  Calendar,
} from 'lucide-react';
import { apiFetch, LANGUAGE_OF_INSTRUCTION_LABELS } from '../lib/api';

interface AdminCurriculumPayload {
  academicYears: Array<{
    id: number;
    code: string;
    nameAr: string;
    nameEn: string;
    isCurrent: boolean;
    isActive: boolean;
  }>;
  versions: Array<{
    id: number;
    academicYearId: number;
    versionCode: string;
    nameAr: string;
    nameEn: string;
    description: string | null;
    copiedFromVersionId: number | null;
    isActive: boolean;
    isPublished: boolean;
  }>;
  selectedVersionId: number | null;
  stages: Array<{ id: number; slug: string; nameAr: string; nameEn: string; isActive: boolean }>;
  systems: Array<{ id: number; stageId: number; code: string; nameAr: string; nameEn: string; isActive: boolean }>;
  grades: Array<{
    id: number;
    stageId: number;
    systemId: number;
    gradeNumber: number;
    slug: string;
    nameAr: string;
    nameEn: string;
    isActive: boolean;
  }>;
  divisions: Array<{
    id: number;
    systemId: number;
    gradeId: number;
    code: string;
    nameAr: string;
    nameEn: string;
    isActive: boolean;
  }>;
  pathways: Array<{
    id: number;
    systemId: number;
    gradeId: number;
    code: string;
    nameAr: string;
    nameEn: string;
    isActive: boolean;
  }>;
  fields: Array<{ id: number; nameAr: string; nameEn: string }>;
  masterSubjects: Array<{ id: number; fieldId: number; slug: string; nameAr: string; nameEn: string; isActive: boolean }>;
  curriculumSubjects: Array<{
    id: number;
    curriculumVersionId: number;
    gradeId: number;
    systemId: number;
    divisionId: number | null;
    pathwayId: number | null;
    subjectId: number;
    subjectNameAr: string;
    subjectNameEn: string;
    subjectType: string;
    isCompulsory: boolean;
    isElective: boolean;
    isSpecialization: boolean;
    isIncludedInTotal: boolean;
    isPassFail: boolean;
    isNonTotal: boolean;
    isActivity: boolean;
    passThresholdPercent: number | null;
    languagesOfInstruction: string[];
    isAvailableForTeacherAssignment: boolean;
    isActive: boolean;
  }>;
  teacherAssignments: Array<{
    id: number;
    teacherUserId: number;
    teacherName: string;
    curriculumSubjectId: number;
    subjectNameAr: string;
    gradeNameAr: string;
    systemNameAr: string;
    divisionNameAr: string | null;
    pathwayNameAr: string | null;
    languagesOffered: string[];
    hourlyRate: string | null;
    supportsOnline: boolean;
    supportsInPerson: boolean;
    isActive: boolean;
  }>;
  teachers: Array<{ id: number; fullName: string }>;
}

export function AdminCurriculumManager() {
  const [data, setData] = useState<AdminCurriculumPayload | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | ''>('');
  const [selectedGradeId, setSelectedGradeId] = useState<number | ''>('');
  const [activeSubTab, setActiveSubTab] = useState<
    'VERSIONS' | 'SUBJECTS' | 'HIERARCHY' | 'ASSIGNMENTS'
  >('VERSIONS');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Forms: New Academic Year
  const [newYearCode, setNewYearCode] = useState('');
  const [newYearNameAr, setNewYearNameAr] = useState('');
  const [newYearNameEn, setNewYearNameEn] = useState('');

  // Forms: Copy Version
  const [copySourceVersionId, setCopySourceVersionId] = useState<number | ''>('');
  const [copyTargetYearId, setCopyTargetYearId] = useState<number | ''>('');
  const [copyVersionCode, setCopyVersionCode] = useState('');
  const [copyNameAr, setCopyNameAr] = useState('');
  const [copyNameEn, setCopyNameEn] = useState('');
  const [copyActivate, setCopyActivate] = useState(false);

  // Forms: New Master Subject
  const [newMasterSubjFieldId, setNewMasterSubjFieldId] = useState<number | ''>('');
  const [newMasterSubjAr, setNewMasterSubjAr] = useState('');
  const [newMasterSubjEn, setNewMasterSubjEn] = useState('');

  // Forms: Attach Subject to Grade/Curriculum Version
  const [csGradeId, setCsGradeId] = useState<number | ''>('');
  const [csDivisionId, setCsDivisionId] = useState<number | ''>('');
  const [csPathwayId, setCsPathwayId] = useState<number | ''>('');
  const [csSubjectId, setCsSubjectId] = useState<number | ''>('');
  const [csSubjectType, setCsSubjectType] = useState<string>('CORE');
  const [csIncludedInTotal, setCsIncludedInTotal] = useState(true);
  const [csCompulsory, setCsCompulsory] = useState(true);
  const [csElective, setCsElective] = useState(false);
  const [csSpecialization, setCsSpecialization] = useState(false);
  const [csPassFail, setCsPassFail] = useState(false);
  const [csActivity, setCsActivity] = useState(false);
  const [csAssignable, setCsAssignable] = useState(true);
  const [csPassThreshold, setCsPassThreshold] = useState('');

  // Forms: Assign Teacher
  const [assignTeacherId, setAssignTeacherId] = useState<number | ''>('');
  const [assignCurrSubjectId, setAssignCurrSubjectId] = useState<number | ''>('');
  const [assignRate, setAssignRate] = useState('35');

  const loadCurriculumAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedVersionId) params.set('versionId', String(selectedVersionId));
      if (selectedGradeId) params.set('gradeId', String(selectedGradeId));
      const res = await apiFetch<AdminCurriculumPayload>(
        `/api/admin/curriculum/all${params.toString() ? `?${params.toString()}` : ''}`
      );
      setData(res);
      if (!selectedVersionId && res.selectedVersionId) {
        setSelectedVersionId(res.selectedVersionId);
      }
      if (!copySourceVersionId && res.versions[0]) {
        setCopySourceVersionId(res.versions[0].id);
      }
      if (!copyTargetYearId && res.academicYears[0]) {
        setCopyTargetYearId(res.academicYears[0].id);
      }
      if (!newMasterSubjFieldId && res.fields[0]) {
        setNewMasterSubjFieldId(res.fields[0].id);
      }
      if (!csGradeId && res.grades[0]) {
        setCsGradeId(res.grades[0].id);
      }
      if (!csSubjectId && res.masterSubjects[0]) {
        setCsSubjectId(res.masterSubjects[0].id);
      }
      if (!assignTeacherId && res.teachers[0]) {
        setAssignTeacherId(res.teachers[0].id);
      }
      if (!assignCurrSubjectId && res.curriculumSubjects[0]) {
        setAssignCurrSubjectId(res.curriculumSubjects[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحميل بيانات إدارة المناهج.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    selectedVersionId,
    selectedGradeId,
    copySourceVersionId,
    copyTargetYearId,
    newMasterSubjFieldId,
    csGradeId,
    csSubjectId,
    assignTeacherId,
    assignCurrSubjectId,
  ]);

  useEffect(() => {
    loadCurriculumAdmin();
  }, [loadCurriculumAdmin]);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/admin/curriculum/academic-years', {
        method: 'POST',
        body: JSON.stringify({
          code: newYearCode.trim(),
          nameAr: newYearNameAr.trim(),
          nameEn: newYearNameEn.trim(),
          isCurrent: false,
          isActive: true,
        }),
      });
      setNewYearCode('');
      setNewYearNameAr('');
      setNewYearNameEn('');
      setFeedback('تمت إضافة العام الدراسي الجديد بنجاح.');
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء العام الدراسي.');
    }
  };

  const handleCopyVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copySourceVersionId || !copyTargetYearId) return;
    setError(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{ version: { id: number }; copiedCount: number }>(
        `/api/admin/curriculum/versions/${copySourceVersionId}/copy`,
        {
          method: 'POST',
          body: JSON.stringify({
            academicYearId: Number(copyTargetYearId),
            versionCode: copyVersionCode.trim(),
            nameAr: copyNameAr.trim(),
            nameEn: copyNameEn.trim(),
            activate: copyActivate,
          }),
        }
      );
      setCopyVersionCode('');
      setCopyNameAr('');
      setCopyNameEn('');
      setSelectedVersionId(res.version.id);
      setFeedback(`تم استنساخ نسخة المنهج بنجاح (${res.copiedCount} مادة مقررة).`);
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نسخ نسخة المنهج.');
    }
  };

  const handleToggleVersionActive = async (versionId: number, activate: boolean) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/curriculum/versions/${versionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: activate }),
      });
      setFeedback(
        activate ? 'تم تفعيل هذه النسخة كالنسخة الحالية.' : 'تم تعطيل النسخة.'
      );
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة النسخة.');
    }
  };

  const handleCreateMasterSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterSubjFieldId) return;
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/admin/curriculum/subjects', {
        method: 'POST',
        body: JSON.stringify({
          fieldId: Number(newMasterSubjFieldId),
          nameAr: newMasterSubjAr.trim(),
          nameEn: newMasterSubjEn.trim(),
        }),
      });
      setNewMasterSubjAr('');
      setNewMasterSubjEn('');
      setFeedback('تم إنشاء المادة الأساسية بنجاح.');
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة المادة.');
    }
  };

  const handleAddCurriculumSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersionId || !csGradeId || !csSubjectId) return;
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/admin/curriculum/curriculum-subjects', {
        method: 'POST',
        body: JSON.stringify({
          curriculumVersionId: Number(selectedVersionId),
          gradeId: Number(csGradeId),
          divisionId: csDivisionId ? Number(csDivisionId) : null,
          pathwayId: csPathwayId ? Number(csPathwayId) : null,
          subjectId: Number(csSubjectId),
          subjectType: csSubjectType,
          isCompulsory: csCompulsory,
          isElective: csElective,
          isSpecialization: csSpecialization,
          isIncludedInTotal: csIncludedInTotal,
          isPassFail: csPassFail,
          isNonTotal: !csIncludedInTotal,
          isActivity: csActivity,
          passThresholdPercent: csPassThreshold ? Number(csPassThreshold) : null,
          isAvailableForTeacherAssignment: csAssignable,
          isActive: true,
        }),
      });
      setFeedback('تمت إضافة المادة إلى المنهج بنجاح.');
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة المادة للمنهج.');
    }
  };

  const handleToggleCurrSubjectFlag = async (
    id: number,
    patch: { isActive?: boolean; isAvailableForTeacherAssignment?: boolean }
  ) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/curriculum/curriculum-subjects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setFeedback('تم تحديث إعدادات المادة في المنهج.');
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث المادة.');
    }
  };

  const handleAdminAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTeacherId || !assignCurrSubjectId) return;
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/admin/curriculum/assignments', {
        method: 'POST',
        body: JSON.stringify({
          teacherUserId: Number(assignTeacherId),
          curriculumSubjectId: Number(assignCurrSubjectId),
          languagesOffered: ['ar'],
          hourlyRate: assignRate ? Number(assignRate) : null,
          supportsOnline: true,
          supportsInPerson: false,
          isActive: true,
        }),
      });
      setFeedback('تم تعيين المعلّم للمادة المنهجية بنجاح.');
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تعيين المعلّم.');
    }
  };

  const handleAdminDeleteAssignment = async (id: number) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/curriculum/assignments/${id}`, {
        method: 'DELETE',
      });
      setFeedback('تم حذف تعيين المعلّم.');
      await loadCurriculumAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف التعيين.');
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 h-48 animate-pulse" />
    );
  }

  if (!data) return null;

  const selectedCsGrade = data.grades.find((g) => g.id === csGradeId) || null;
  const selectedCsSystem = selectedCsGrade
    ? data.systems.find((s) => s.id === selectedCsGrade.systemId) || null
    : null;
  const csDivisionOptions =
    selectedCsSystem?.code === 'GENERAL_SECONDARY' &&
    (selectedCsGrade?.gradeNumber ?? 0) >= 2
      ? data.divisions.filter((d) => d.gradeId === selectedCsGrade!.id)
      : [];
  const csPathwayOptions =
    selectedCsSystem?.code === 'EGYPTIAN_BACCALAUREATE' &&
    (selectedCsGrade?.gradeNumber ?? 0) >= 2
      ? data.pathways.filter((p) => p.gradeId === selectedCsGrade!.id)
      : [];

  return (
    <section
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      data-testid="admin-curriculum-manager"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-700" />
            <span>إدارة المراحل التعليمية والمناهج الدراسية</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            إدارة السنوات الدراسية، نسخ المناهج واستنساخها، الصفوف والشعب والمسارات، المواد وتصنيفاتها، وتعيين المعلّمين.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {[
            { code: 'VERSIONS' as const, label: 'السنوات والنسخ' },
            { code: 'SUBJECTS' as const, label: 'مواد المنهج والتصنيفات' },
            { code: 'ASSIGNMENTS' as const, label: 'تعيين المعلّمين' },
            { code: 'HIERARCHY' as const, label: 'الهيكل التعليمي' },
          ].map((tab) => (
            <button
              key={tab.code}
              type="button"
              onClick={() => setActiveSubTab(tab.code)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                activeSubTab === tab.code
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
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

      {/* Sub-tab 1: Academic Years & Curriculum Versions (including Copy) */}
      {activeSubTab === 'VERSIONS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleCreateYear}
              className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/60"
            >
              <div className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-700" />
                <span>إضافة عام دراسي جديد</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="الرمز (مثال: 2027/2028)"
                  value={newYearCode}
                  onChange={(e) => setNewYearCode(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
                />
                <input
                  type="text"
                  required
                  placeholder="الاسم بالعربية"
                  value={newYearNameAr}
                  onChange={(e) => setNewYearNameAr(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  required
                  placeholder="الاسم بالإنجليزية"
                  value={newYearNameEn}
                  onChange={(e) => setNewYearNameEn(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                إضافة العام الدراسي
              </button>
            </form>

            <form
              onSubmit={handleCopyVersion}
              className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/60"
              data-testid="copy-curriculum-version-form"
            >
              <div className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-teal-700" />
                <span>نسخ نسخة منهج لعام جديد أو تحديث</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={copySourceVersionId}
                  onChange={(e) =>
                    setCopySourceVersionId(
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {data.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      المصدر: {v.nameAr} ({v.versionCode})
                    </option>
                  ))}
                </select>
                <select
                  value={copyTargetYearId}
                  onChange={(e) =>
                    setCopyTargetYearId(
                      e.target.value ? Number(e.target.value) : ''
                    )
                  }
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {data.academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      العام المستهدف: {y.nameAr}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="كود النسخة الجديدة (EG-2027-2028-V1)"
                  value={copyVersionCode}
                  onChange={(e) => setCopyVersionCode(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
                />
                <input
                  type="text"
                  required
                  placeholder="اسم النسخة بالعربية"
                  value={copyNameAr}
                  onChange={(e) => setCopyNameAr(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  required
                  placeholder="اسم النسخة بالإنجليزية"
                  value={copyNameEn}
                  onChange={(e) => setCopyNameEn(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <label className="flex items-center gap-2 text-xs text-slate-700 px-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={copyActivate}
                    onChange={(e) => setCopyActivate(e.target.checked)}
                  />
                  <span>تفعيل النسخة الجديدة فوراً</span>
                </label>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                استنساخ كافة المواد إلى النسخة الجديدة
              </button>
            </form>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">الكود</th>
                  <th className="py-2.5 px-3">النسخة</th>
                  <th className="py-2.5 px-3">العام الدراسي</th>
                  <th className="py-2.5 px-3">الحالة</th>
                  <th className="py-2.5 px-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.versions.map((v) => {
                  const yr = data.academicYears.find((y) => y.id === v.academicYearId);
                  return (
                    <tr key={v.id}>
                      <td className="py-2.5 px-3 font-mono-num font-bold text-slate-900">
                        {v.versionCode}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{v.nameAr}</div>
                        <div className="text-[11px] text-slate-500">{v.nameEn}</div>
                      </td>
                      <td className="py-2.5 px-3">{yr?.nameAr || v.academicYearId}</td>
                      <td className="py-2.5 px-3 font-semibold">
                        {v.isActive ? (
                          <span className="text-teal-700">مفعّلة الآن</span>
                        ) : (
                          <span className="text-slate-500">مؤرشفة</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 flex items-center gap-3">
                        {!v.isActive && (
                          <button
                            type="button"
                            onClick={() => handleToggleVersionActive(v.id, true)}
                            className="text-teal-700 hover:underline font-semibold cursor-pointer"
                          >
                            تفعيل
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVersionId(v.id);
                            setActiveSubTab('SUBJECTS');
                          }}
                          className="text-slate-700 hover:underline cursor-pointer"
                        >
                          عرض موادها
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 2: Curriculum Subjects Matrix */}
      {activeSubTab === 'SUBJECTS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleCreateMasterSubject}
              className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/60"
            >
              <div className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <span>إنشاء مادة دراسية أساسية جديدة</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={newMasterSubjFieldId}
                  onChange={(e) => setNewMasterSubjFieldId(Number(e.target.value))}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {data.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameAr}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="اسم المادة بالعربية"
                  value={newMasterSubjAr}
                  onChange={(e) => setNewMasterSubjAr(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Subject Name (EN)"
                  value={newMasterSubjEn}
                  onChange={(e) => setNewMasterSubjEn(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                إضافة للدليل الرئيسي
              </button>
            </form>

            <form
              onSubmit={handleAddCurriculumSubject}
              className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/60"
            >
              <div className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-700" />
                <span>إضافة مادة لصف/شعبة/مسار في النسخة المحددة</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={csGradeId}
                  onChange={(e) => {
                    setCsGradeId(Number(e.target.value));
                    setCsDivisionId('');
                    setCsPathwayId('');
                  }}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {data.grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameAr}
                    </option>
                  ))}
                </select>
                <select
                  value={csSubjectId}
                  onChange={(e) => setCsSubjectId(Number(e.target.value))}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {data.masterSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>

                {csDivisionOptions.length > 0 && (
                  <select
                    value={csDivisionId}
                    onChange={(e) =>
                      setCsDivisionId(e.target.value ? Number(e.target.value) : '')
                    }
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">اختر الشعبة...</option>
                    {csDivisionOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nameAr}
                      </option>
                    ))}
                  </select>
                )}

                {csPathwayOptions.length > 0 && (
                  <select
                    value={csPathwayId}
                    onChange={(e) =>
                      setCsPathwayId(e.target.value ? Number(e.target.value) : '')
                    }
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">اختر المسار...</option>
                    {csPathwayOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={csSubjectType}
                  onChange={(e) => setCsSubjectType(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="CORE">أساسية (CORE)</option>
                  <option value="SPECIALIZATION">تخصصية (SPECIALIZATION)</option>
                  <option value="ELECTIVE">اختيارية (ELECTIVE)</option>
                  <option value="NON_TOTAL">خارج المجموع (NON_TOTAL)</option>
                  <option value="ACTIVITY">نشاط (ACTIVITY)</option>
                  <option value="RELIGIOUS">تربية دينية (RELIGIOUS)</option>
                </select>

                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="نسبة النجاح (مثال: 70 اختياري)"
                  value={csPassThreshold}
                  onChange={(e) => setCsPassThreshold(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
                />
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-slate-700">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csIncludedInTotal}
                    onChange={(e) => setCsIncludedInTotal(e.target.checked)}
                  />
                  <span>داخل المجموع</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csCompulsory}
                    onChange={(e) => setCsCompulsory(e.target.checked)}
                  />
                  <span>إلزامية</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csElective}
                    onChange={(e) => setCsElective(e.target.checked)}
                  />
                  <span>اختيارية</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csSpecialization}
                    onChange={(e) => setCsSpecialization(e.target.checked)}
                  />
                  <span>تخصص</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csPassFail}
                    onChange={(e) => setCsPassFail(e.target.checked)}
                  />
                  <span>نجاح ورسوب</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csActivity}
                    onChange={(e) => setCsActivity(e.target.checked)}
                  />
                  <span>نشاط</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={csAssignable}
                    onChange={(e) => setCsAssignable(e.target.checked)}
                  />
                  <span>متاحة لتعيين المعلّمين</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                إضافة المادة للمنهج
              </button>
            </form>
          </div>

          {/* Filter curriculum subjects table */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedVersionId}
              onChange={(e) =>
                setSelectedVersionId(e.target.value ? Number(e.target.value) : '')
              }
              aria-label="تصفية بنسخة المنهج"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {data.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nameAr} ({v.versionCode})
                </option>
              ))}
            </select>
            <select
              value={selectedGradeId}
              onChange={(e) =>
                setSelectedGradeId(e.target.value ? Number(e.target.value) : '')
              }
              aria-label="تصفية بالصف الدراسي"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">كل الصفوف الدراسية</option>
              {data.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500 tabular-nums">
              إجمالي السجلات المعروضة: {data.curriculumSubjects.length}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">المادة</th>
                  <th className="py-2.5 px-3">الصف / الشعبة / المسار</th>
                  <th className="py-2.5 px-3">التصنيف</th>
                  <th className="py-2.5 px-3">تعيين المعلّمين</th>
                  <th className="py-2.5 px-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.curriculumSubjects.slice(0, 120).map((cs) => {
                  const gr = data.grades.find((g) => g.id === cs.gradeId);
                  const dv = cs.divisionId
                    ? data.divisions.find((d) => d.id === cs.divisionId)
                    : null;
                  const pw = cs.pathwayId
                    ? data.pathways.find((p) => p.id === cs.pathwayId)
                    : null;
                  return (
                    <tr key={cs.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {cs.subjectNameAr}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {gr?.nameAr}
                        {dv ? ` · ${dv.nameAr}` : ''}
                        {pw ? ` · ${pw.nameAr}` : ''}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {cs.isIncludedInTotal ? 'داخل المجموع' : 'خارج المجموع'}
                        {cs.isActivity ? ' · نشاط' : ''}
                        {cs.passThresholdPercent
                          ? ` · نجاح ${cs.passThresholdPercent}%`
                          : ''}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleCurrSubjectFlag(cs.id, {
                              isAvailableForTeacherAssignment:
                                !cs.isAvailableForTeacherAssignment,
                            })
                          }
                          className={`font-semibold cursor-pointer ${
                            cs.isAvailableForTeacherAssignment
                              ? 'text-teal-700 hover:underline'
                              : 'text-slate-500 hover:underline'
                          }`}
                        >
                          {cs.isAvailableForTeacherAssignment ? 'متاحة' : 'مغلقة'}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleCurrSubjectFlag(cs.id, {
                              isActive: !cs.isActive,
                            })
                          }
                          className={`font-semibold cursor-pointer ${
                            cs.isActive
                              ? 'text-teal-700 hover:underline'
                              : 'text-red-700 hover:underline'
                          }`}
                        >
                          {cs.isActive ? 'نشطة' : 'معطّلة'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 3: Teacher Assignments */}
      {activeSubTab === 'ASSIGNMENTS' && (
        <div className="space-y-5">
          <form
            onSubmit={handleAdminAssignTeacher}
            className="border border-slate-200 rounded-xl p-5 space-y-3 bg-slate-50/60"
          >
            <div className="font-display text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-teal-700" />
              <span>ربط معلّم بمادة منهجية وصف دراسي (متعدد إلى متعدد M:N)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={assignTeacherId}
                onChange={(e) => setAssignTeacherId(Number(e.target.value))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
              <select
                value={assignCurrSubjectId}
                onChange={(e) => setAssignCurrSubjectId(Number(e.target.value))}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {data.curriculumSubjects.slice(0, 150).map((cs) => {
                  const gr = data.grades.find((g) => g.id === cs.gradeId);
                  return (
                    <option key={cs.id} value={cs.id}>
                      {cs.subjectNameAr} — {gr?.nameAr}
                    </option>
                  );
                })}
              </select>
              <input
                type="number"
                min="0"
                step="1"
                value={assignRate}
                onChange={(e) => setAssignRate(e.target.value)}
                placeholder="السعر بالدولار"
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              تعيين المعلّم للمادة
            </button>
          </form>

          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            {data.teacherAssignments.map((a) => (
              <div
                key={a.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-white"
              >
                <div>
                  <span className="font-bold text-slate-900">{a.teacherName}</span>
                  {' · '}
                  <span className="font-semibold text-teal-800">
                    {a.subjectNameAr}
                  </span>
                  {' · '}
                  <span className="text-slate-600">
                    {a.systemNameAr} / {a.gradeNameAr}
                    {a.divisionNameAr ? ` / ${a.divisionNameAr}` : ''}
                    {a.pathwayNameAr ? ` / ${a.pathwayNameAr}` : ''}
                  </span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    اللغات:{' '}
                    {(a.languagesOffered || [])
                      .map((l) => LANGUAGE_OF_INSTRUCTION_LABELS[l]?.ar || l)
                      .join(' / ')}
                    {a.hourlyRate && ` · $${a.hourlyRate}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdminDeleteAssignment(a.id)}
                  className="text-red-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-tab 4: Systems, Grades, Divisions & Pathways Hierarchy Overview */}
      {activeSubTab === 'HIERARCHY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-slate-900">
              الأنظمة التعليمية ({data.systems.length})
            </h3>
            <ul className="divide-y divide-slate-100">
              {data.systems.map((s) => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <span>
                    <strong className="text-slate-900">{s.nameAr}</strong> ·{' '}
                    <span className="text-slate-500">{s.nameEn}</span>
                  </span>
                  <span className="font-mono-num text-slate-400">{s.code}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-slate-900">
              الشعب والمسارات التخصصية ({data.divisions.length + data.pathways.length})
            </h3>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {data.divisions.map((d) => (
                <div key={`div-${d.id}`} className="py-1 border-b border-slate-100">
                  <span className="font-semibold text-slate-800">{d.nameAr}</span>{' '}
                  <span className="text-slate-500">({d.nameEn})</span>
                </div>
              ))}
              {data.pathways.map((p) => (
                <div key={`pw-${p.id}`} className="py-1 border-b border-slate-100">
                  <span className="font-semibold text-teal-800">{p.nameAr}</span>{' '}
                  <span className="text-slate-500">({p.nameEn})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
