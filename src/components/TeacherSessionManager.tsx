import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Users,
  User,
  CheckCircle2,
  XCircle,
  Edit3,
  Clock,
  AlertCircle,
  Ban,
  BookOpen,
  Trash2,
} from 'lucide-react';
import {
  apiFetch,
  SESSION_TYPE_LABELS_AR,
  SESSION_STATUS_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  DELIVERY_MODE_LABELS_AR,
  WEEKDAY_LABELS_AR,
  LANGUAGE_OF_INSTRUCTION_LABELS,
  formatSessionDateRange,
  type TeachingSessionItem,
  type TeacherTeachingAssignmentItem,
  type CurriculumOverviewResponse,
  type CurriculumSubjectItem,
} from '../lib/api';

interface TaxonomyOption {
  id: number;
  nameAr: string;
}

interface TeacherRequestItem {
  id: number;
  sessionId: number;
  sessionTitle: string;
  sessionType: 'ONE_TO_ONE' | 'GROUP';
  sessionStartTime: string;
  sessionEndTime: string;
  sessionStatus: string;
  subjectNameAr: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  notes: string | null;
  requestedAt: string;
  student: {
    id: number;
    fullName: string;
    avatarUrl: string | null;
    stageNameAr: string | null;
    learningGoal: string | null;
    bio: string | null;
  };
}

interface AvailabilityRule {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AcceptedStudentItem {
  enrollmentId: number;
  studentUserId: number;
  fullName: string;
  stageNameAr: string | null;
  learningGoal: string | null;
  notes: string | null;
  respondedAt: string | null;
}

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TeacherSessionManager({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    'SESSIONS' | 'REQUESTS' | 'AVAILABILITY' | 'ASSIGNMENTS'
  >('SESSIONS');
  const [sessions, setSessions] = useState<TeachingSessionItem[]>([]);
  const [requests, setRequests] = useState<TeacherRequestItem[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [stages, setStages] = useState<TaxonomyOption[]>([]);
  const [assignments, setAssignments] = useState<TeacherTeachingAssignmentItem[]>([]);
  const [currOverview, setCurrOverview] = useState<CurriculumOverviewResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Teacher Assignment selector state
  const [assignSystemId, setAssignSystemId] = useState<number | ''>('');
  const [assignGradeId, setAssignGradeId] = useState<number | ''>('');
  const [assignDivisionId, setAssignDivisionId] = useState<number | ''>('');
  const [assignPathwayId, setAssignPathwayId] = useState<number | ''>('');
  const [assignCurrSubjOptions, setAssignCurrSubjOptions] = useState<
    CurriculumSubjectItem[]
  >([]);
  const [assignCurriculumSubjectId, setAssignCurriculumSubjectId] = useState<
    number | ''
  >('');
  const [assignHourlyRate, setAssignHourlyRate] = useState('30');
  const [assignLanguages, setAssignLanguages] = useState<string[]>(['ar']);
  const [assignOnline, setAssignOnline] = useState(true);
  const [assignInPerson, setAssignInPerson] = useState(false);

  // Request Filters
  const [reqTypeFilter, setReqTypeFilter] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState('');
  const [reqSubjectFilter, setReqSubjectFilter] = useState('');
  const [reqDateFilter, setReqDateFilter] = useState('');

  // Create / Edit session form state
  const [showForm, setShowForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [sessionType, setSessionType] = useState<'ONE_TO_ONE' | 'GROUP'>(
    'ONE_TO_ONE'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [curriculumSubjectId, setCurriculumSubjectId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [startTime, setStartTime] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + 3 * 86_400_000))
  );
  const [endTime, setEndTime] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + 3 * 86_400_000 + 3_600_000))
  );
  const [capacity, setCapacity] = useState(6);
  const [minStudents, setMinStudents] = useState<string>('2');
  const [price, setPrice] = useState('30');
  const [deliveryMode, setDeliveryMode] = useState<'ONLINE' | 'IN_PERSON'>(
    'ONLINE'
  );
  const [meetingUrl, setMeetingUrl] = useState('');
  const [location, setLocation] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Accepted students modal
  const [viewingStudentsSession, setViewingStudentsSession] =
    useState<TeachingSessionItem | null>(null);
  const [acceptedStudents, setAcceptedStudents] = useState<
    AcceptedStudentItem[]
  >([]);

  // New availability rule input
  const [newDay, setNewDay] = useState(0);
  const [newAvailStart, setNewAvailStart] = useState('17:00');
  const [newAvailEnd, setNewAvailEnd] = useState('20:00');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const reqParams = new URLSearchParams();
      if (reqTypeFilter) reqParams.set('sessionType', reqTypeFilter);
      if (reqStatusFilter) reqParams.set('status', reqStatusFilter);
      if (reqSubjectFilter) reqParams.set('subjectId', reqSubjectFilter);
      if (reqDateFilter) reqParams.set('date', reqDateFilter);

      const [mineRes, reqRes, taxRes, assignRes, currRes] = await Promise.all([
        apiFetch<{
          sessions: TeachingSessionItem[];
          availability: AvailabilityRule[];
        }>('/api/teaching-sessions/mine'),
        apiFetch<{ requests: TeacherRequestItem[] }>(
          `/api/teaching-sessions/teacher/requests${
            reqParams.toString() ? `?${reqParams.toString()}` : ''
          }`
        ),
        apiFetch<{
          subjects: TaxonomyOption[];
          stages: TaxonomyOption[];
        }>('/api/taxonomy'),
        apiFetch<{ assignments: TeacherTeachingAssignmentItem[] }>(
          '/api/teaching-assignments/mine'
        ).catch(() => ({ assignments: [] })),
        apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview').catch(
          () => null
        ),
      ]);
      setSessions(mineRes.sessions);
      setAvailability(mineRes.availability);
      setRequests(reqRes.requests);
      setSubjects(taxRes.subjects);
      setStages(taxRes.stages);
      setAssignments(assignRes.assignments);
      if (currRes) setCurrOverview(currRes);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحميل إدارة الجلسات.'
      );
    } finally {
      setLoading(false);
    }
  }, [reqTypeFilter, reqStatusFilter, reqSubjectFilter, reqDateFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Load candidate curriculum subjects when teacher picks System/Grade/Division/Pathway
  useEffect(() => {
    if (!currOverview || !assignSystemId || !assignGradeId) {
      setAssignCurrSubjOptions([]);
      return;
    }
    const sys = currOverview.systems.find((s) => s.id === assignSystemId);
    const grd = currOverview.grades.find((g) => g.id === assignGradeId);
    if (!sys || !grd) return;
    const needsDiv = sys.code === 'GENERAL_SECONDARY' && grd.gradeNumber >= 2;
    const needsPw = sys.code === 'EGYPTIAN_BACCALAUREATE' && grd.gradeNumber >= 2;
    if ((needsDiv && !assignDivisionId) || (needsPw && !assignPathwayId)) {
      setAssignCurrSubjOptions([]);
      return;
    }
    const params = new URLSearchParams({
      systemId: String(assignSystemId),
      gradeId: String(assignGradeId),
    });
    if (needsDiv && assignDivisionId) {
      params.set('divisionId', String(assignDivisionId));
    }
    if (needsPw && assignPathwayId) {
      params.set('pathwayId', String(assignPathwayId));
    }
    apiFetch<{ subjects: CurriculumSubjectItem[] }>(
      `/api/curriculum/subjects?${params.toString()}`
    )
      .then((res) => {
        const assignable = res.subjects.filter(
          (s) => s.isAvailableForTeacherAssignment
        );
        setAssignCurrSubjOptions(assignable);
        setAssignCurriculumSubjectId(assignable[0]?.id ?? '');
      })
      .catch(() => setAssignCurrSubjOptions([]));
  }, [
    currOverview,
    assignSystemId,
    assignGradeId,
    assignDivisionId,
    assignPathwayId,
  ]);

  const resetForm = () => {
    setEditingSessionId(null);
    setSessionType('ONE_TO_ONE');
    setTitle('');
    setDescription('');
    setCurriculumSubjectId('');
    setSubjectId('');
    setStageId('');
    const nextStart = new Date(Date.now() + 3 * 86_400_000);
    setStartTime(toLocalDatetimeInput(nextStart));
    setEndTime(toLocalDatetimeInput(new Date(nextStart.getTime() + 3_600_000)));
    setCapacity(6);
    setMinStudents('2');
    setPrice('30');
    setDeliveryMode('ONLINE');
    setMeetingUrl('');
    setLocation('');
    setRegistrationDeadline('');
  };

  const openEditForm = (s: TeachingSessionItem) => {
    setEditingSessionId(s.id);
    setSessionType(s.sessionType);
    setTitle(s.title);
    setDescription(s.description || '');
    setCurriculumSubjectId(
      s.curriculumSubjectId ? String(s.curriculumSubjectId) : ''
    );
    setSubjectId(s.subjectId ? String(s.subjectId) : '');
    setStageId(s.stageId ? String(s.stageId) : '');
    setStartTime(toLocalDatetimeInput(new Date(s.startTime)));
    setEndTime(toLocalDatetimeInput(new Date(s.endTime)));
    setCapacity(s.capacity);
    setMinStudents(s.minStudents ? String(s.minStudents) : '');
    setPrice(String(Number(s.price)));
    setDeliveryMode(s.deliveryMode);
    setMeetingUrl(s.meetingUrl || '');
    setLocation(s.location || '');
    setRegistrationDeadline(
      s.registrationDeadline
        ? toLocalDatetimeInput(new Date(s.registrationDeadline))
        : ''
    );
    setShowForm(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSession(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        sessionType,
        title: title.trim(),
        description: description.trim() || null,
        curriculumSubjectId: curriculumSubjectId
          ? Number(curriculumSubjectId)
          : null,
        subjectId: curriculumSubjectId
          ? null
          : subjectId
          ? Number(subjectId)
          : null,
        stageId: curriculumSubjectId ? null : stageId ? Number(stageId) : null,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        capacity: sessionType === 'ONE_TO_ONE' ? 1 : Number(capacity),
        minStudents:
          sessionType === 'GROUP' && minStudents
            ? Number(minStudents)
            : null,
        price: Number(price),
        deliveryMode,
        meetingUrl: deliveryMode === 'ONLINE' ? meetingUrl.trim() || null : null,
        location: deliveryMode === 'IN_PERSON' ? location.trim() || null : null,
        registrationDeadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : null,
      };

      if (editingSessionId) {
        await apiFetch(`/api/teaching-sessions/${editingSessionId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback('تم تحديث تفاصيل الجلسة بنجاح.');
      } else {
        await apiFetch('/api/teaching-sessions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('تم نشر الجلسة التعليمية بنجاح.');
      }

      setShowForm(false);
      resetForm();
      await loadAll();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الجلسة.');
    } finally {
      setSavingSession(false);
    }
  };

  const handleSessionAction = async (
    sessionId: number,
    action: 'cancel' | 'complete'
  ) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/teaching-sessions/${sessionId}/${action}`, {
        method: 'POST',
      });
      setFeedback(
        action === 'cancel'
          ? 'تم إلغاء الجلسة وإشعار الطلاب المسجلين.'
          : 'تم تحديد الجلسة كمكتملة.'
      );
      await loadAll();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء.');
    }
  };

  const handleRequestDecision = async (
    enrollmentId: number,
    decision: 'accept' | 'reject'
  ) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/session-enrollments/${enrollmentId}/${decision}`, {
        method: 'POST',
      });
      setFeedback(
        decision === 'accept'
          ? 'تم قبول الطالب وتحديث حالة المقاعد.'
          : 'تم رفض الطلب وتحديث المقاعد المتاحة.'
      );
      await loadAll();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الطلب.');
    }
  };

  const handleViewAcceptedStudents = async (s: TeachingSessionItem) => {
    setViewingStudentsSession(s);
    try {
      const res = await apiFetch<{ students: AcceptedStudentItem[] }>(
        `/api/teaching-sessions/${s.id}/students`
      );
      setAcceptedStudents(res.students);
    } catch {
      setAcceptedStudents([]);
    }
  };

  const handleAddAvailabilityRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const updatedSlots = [
      ...availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isActive: a.isActive,
      })),
      {
        dayOfWeek: newDay,
        startTime: newAvailStart,
        endTime: newAvailEnd,
        isActive: true,
      },
    ];
    try {
      const res = await apiFetch<{ slots: AvailabilityRule[] }>(
        '/api/teacher-availability',
        {
          method: 'PUT',
          body: JSON.stringify({ slots: updatedSlots }),
        }
      );
      setAvailability(res.slots);
      setFeedback('تم تحديث جدول التفرغ الأسبوعي.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر حفظ جدول التفرغ الأسبوعي.'
      );
    }
  };

  const handleRemoveAvailabilityRule = async (idx: number) => {
    const next = availability
      .filter((_, i) => i !== idx)
      .map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        isActive: a.isActive,
      }));
    try {
      const res = await apiFetch<{ slots: AvailabilityRule[] }>(
        '/api/teacher-availability',
        {
          method: 'PUT',
          body: JSON.stringify({ slots: next }),
        }
      );
      setAvailability(res.slots);
      setFeedback('تم حذف الفترة من جدول التفرغ.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث التفرغ.');
    }
  };

  const handleAddTeachingAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCurriculumSubjectId) return;
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/teaching-assignments/mine', {
        method: 'POST',
        body: JSON.stringify({
          curriculumSubjectId: Number(assignCurriculumSubjectId),
          languagesOffered:
            assignLanguages.length > 0 ? assignLanguages : ['ar'],
          hourlyRate: assignHourlyRate ? Number(assignHourlyRate) : null,
          supportsOnline: assignOnline,
          supportsInPerson: assignInPerson,
        }),
      });
      setFeedback('تم إضافة المادة والصف الدراسي لقائمة تدريسك بنجاح.');
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر حفظ تعيين المادة والصف.'
      );
    }
  };

  const handleDeleteTeachingAssignment = async (assignmentId: number) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/teaching-assignments/mine/${assignmentId}`, {
        method: 'DELETE',
      });
      setFeedback('تم حذف تعيين المادة من ملفك.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف التعيين.');
    }
  };

  const pendingRequestsCount = requests.filter(
    (r) => r.status === 'PENDING'
  ).length;

  return (
    <section
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      data-testid="teacher-session-manager"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-700" />
            <span>إدارة الجلسات الفردية والجماعية والمواد الدراسية</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            حدّد الصفوف والمواد المصرية التي تدرّسها، وأنشئ مواعيد فردية أو جلسات جماعية مرتبطة بالمنهج.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (showForm && !editingSessionId) {
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showForm ? 'إغلاق النموذج' : 'إنشاء جلسة جديدة'}</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-full lg:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('SESSIONS')}
          className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            activeTab === 'SESSIONS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          جلساتي ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('REQUESTS')}
          className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            activeTab === 'REQUESTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          الطلبات الواردة ({pendingRequestsCount} معلق)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ASSIGNMENTS')}
          className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            activeTab === 'ASSIGNMENTS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          موادي وصفوفي ({assignments.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('AVAILABILITY')}
          className={`flex-1 sm:flex-none text-center px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
            activeTab === 'AVAILABILITY'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          التفرغ الأسبوعي ({availability.length})
        </button>
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

      {/* Create / Edit Session Form */}
      {showForm && (
        <form
          onSubmit={handleSaveSession}
          className="border border-slate-200 bg-slate-50/70 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">
              {editingSessionId
                ? 'تعديل بيانات الجلسة'
                : 'نشر موعد فردي أو جلسة جماعية جديدة'}
            </h3>
            <div className="flex items-center gap-2">
              {(['ONE_TO_ONE', 'GROUP'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSessionType(t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                    sessionType === t
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {SESSION_TYPE_LABELS_AR[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                عنوان الجلسة *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  sessionType === 'ONE_TO_ONE'
                    ? 'مثال: جلسة فردية لمراجعة مشروع التخرج في React'
                    : 'مثال: ورشة عمل جماعية في تطبيع قواعد البيانات'
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                السعر ({sessionType === 'GROUP' ? 'لكل طالب' : 'للجلسة'}) بالدولار
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ربط بمادة من المراحل التعليمية المصرية (اختياري — يُظهر الجلسة في اكتشاف الطلاب)
              </label>
              <select
                value={curriculumSubjectId}
                onChange={(e) => setCurriculumSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">بدون ربط بمنهج صف محدد (استخدم التخصص العام بالأسفل)</option>
                {assignments.map((ta) => (
                  <option key={ta.curriculumSubjectId} value={ta.curriculumSubjectId}>
                    {ta.subjectNameAr} — {ta.gradeNameAr} ({ta.systemNameAr}
                    {ta.divisionNameAr ? ` / ${ta.divisionNameAr}` : ''}
                    {ta.pathwayNameAr ? ` / ${ta.pathwayNameAr}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {!curriculumSubjectId && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المادة / التخصص العام
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">عام / بدون مادة محددة</option>
                    {subjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>
                        {subj.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المرحلة الدراسية
                  </label>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">كل المراحل</option>
                    {stages.map((stg) => (
                      <option key={stg.id} value={stg.id}>
                        {stg.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                طريقة التقديم *
              </label>
              <select
                value={deliveryMode}
                onChange={(e) =>
                  setDeliveryMode(e.target.value as 'ONLINE' | 'IN_PERSON')
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="ONLINE">عن بُعد (أونلاين)</option>
                <option value="IN_PERSON">حضوري</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                وقت البدء *
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                وقت الانتهاء *
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                آخر موعد للتسجيل (اختياري)
              </label>
              <input
                type="datetime-local"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>

            {sessionType === 'GROUP' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    السعة القصوى للطلاب *
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="500"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    الحد الأدنى للطلاب (اختياري)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={capacity}
                    value={minStudents}
                    onChange={(e) => setMinStudents(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
                  />
                </div>
              </>
            )}

            <div className={sessionType === 'GROUP' ? '' : 'lg:col-span-2'}>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {deliveryMode === 'ONLINE'
                  ? 'رابط الجلسة (يظهر للمقبولين فقط)'
                  : 'الموقع / القاعة *'}
              </label>
              {deliveryMode === 'ONLINE' ? (
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.example.com/..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
                />
              ) : (
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="مثال: الرياض — قاعة التدريب 2"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                />
              )}
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                وصف الجلسة وأهدافها
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح باختصار ما سيتعلمه الطالب في هذه الجلسة..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={savingSession}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer"
            >
              {savingSession
                ? 'جاري الحفظ...'
                : editingSessionId
                ? 'حفظ التعديلات'
                : 'نشر الجلسة'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold rounded-lg bg-white cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Tab 1: Teacher's Sessions */}
      {activeTab === 'SESSIONS' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              لم تقم بإنشاء جلسات فردية أو جماعية بعد.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900 flex items-center gap-1">
                        {s.sessionType === 'ONE_TO_ONE' ? (
                          <User className="w-3.5 h-3.5 text-slate-700" />
                        ) : (
                          <Users className="w-3.5 h-3.5 text-teal-700" />
                        )}
                        {SESSION_TYPE_LABELS_AR[s.sessionType]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-teal-800">
                        {SESSION_STATUS_LABELS_AR[s.status] || s.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{DELIVERY_MODE_LABELS_AR[s.deliveryMode]}</span>
                    </div>

                    <div className="font-display text-sm sm:text-base font-bold text-slate-900">
                      {s.title}
                    </div>
                    {(s.subjectNameAr || s.gradeNameAr) && (
                      <div className="text-xs text-teal-800 font-medium">
                        {[s.subjectNameAr, s.gradeNameAr, s.systemNameAr]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 font-mono-num">
                      <span>{formatSessionDateRange(s.startTime, s.endTime)}</span>
                      <span>
                        المقاعد: {s.acceptedCount}/{s.capacity} (المتبقي:{' '}
                        {s.remainingSeats})
                      </span>
                      {(s.pendingCount ?? 0) > 0 && (
                        <span className="text-amber-700 font-semibold font-sans">
                          {s.pendingCount} طلب بانتظار المراجعة
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewAcceptedStudents(s)}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      الطلاب المقبولون ({s.acceptedCount})
                    </button>

                    {s.status !== 'CANCELLED' && s.status !== 'COMPLETED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditForm(s)}
                          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSessionAction(s.id, 'complete')}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          إتمام
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSessionAction(s.id, 'cancel')}
                          className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>إلغاء الجلسة</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Incoming Booking / Enrollment Requests */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <select
              value={reqTypeFilter}
              onChange={(e) => setReqTypeFilter(e.target.value)}
              aria-label="تصفية بنوع الجلسة"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">كل أنواع الجلسات</option>
              <option value="ONE_TO_ONE">فردية (1:1)</option>
              <option value="GROUP">جماعية</option>
            </select>
            <select
              value={reqStatusFilter}
              onChange={(e) => setReqStatusFilter(e.target.value)}
              aria-label="تصفية بحالة الطلب"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">كل الحالات</option>
              <option value="PENDING">بانتظار الموافقة</option>
              <option value="ACCEPTED">مقبول</option>
              <option value="REJECTED">مرفوض</option>
              <option value="CANCELLED">ملغى</option>
            </select>
            <select
              value={reqSubjectFilter}
              onChange={(e) => setReqSubjectFilter(e.target.value)}
              aria-label="تصفية بالمادة"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="">كل المواد</option>
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.nameAr}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={reqDateFilter}
              onChange={(e) => setReqDateFilter(e.target.value)}
              aria-label="تصفية بالتاريخ"
              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
            />
          </div>

          {requests.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              لا توجد طلبات مطابقة لخيارات البحث الحالية.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {SESSION_TYPE_LABELS_AR[r.sessionType]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          r.status === 'ACCEPTED'
                            ? 'text-emerald-700 font-semibold'
                            : r.status === 'PENDING'
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-500 font-semibold'
                        }
                      >
                        {ENROLLMENT_STATUS_LABELS_AR[r.status] || r.status}
                      </span>
                      {r.subjectNameAr && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-teal-800">{r.subjectNameAr}</span>
                        </>
                      )}
                    </div>

                    <div className="text-sm font-bold text-slate-900">
                      الطالب: {r.student.fullName}
                      {r.student.stageNameAr && (
                        <span className="text-xs font-normal text-slate-500 mr-2">
                          ({r.student.stageNameAr})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700">
                      الجلسة: <span className="font-medium">{r.sessionTitle}</span>{' '}
                      ·{' '}
                      <span className="font-mono-num text-slate-500">
                        {formatSessionDateRange(r.sessionStartTime, r.sessionEndTime)}
                      </span>
                    </div>

                    {r.student.learningGoal && (
                      <p className="text-xs text-slate-600">
                        هدف الطالب: {r.student.learningGoal}
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        ملاحظة الطلب: {r.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {r.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => handleRequestDecision(r.id, 'accept')}
                        className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>قبول</span>
                      </button>
                    )}
                    {(r.status === 'PENDING' || r.status === 'ACCEPTED') && (
                      <button
                        type="button"
                        onClick={() => handleRequestDecision(r.id, 'reject')}
                        className="px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{r.status === 'ACCEPTED' ? 'إلغاء القبول' : 'رفض'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Weekly Recurring Availability */}
      {activeTab === 'AVAILABILITY' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddAvailabilityRule}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-slate-50 border border-slate-200 rounded-xl p-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                اليوم
              </label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {Object.entries(WEEKDAY_LABELS_AR).map(([dayIdx, label]) => (
                  <option key={dayIdx} value={dayIdx}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                من الساعة
              </label>
              <input
                type="time"
                required
                value={newAvailStart}
                onChange={(e) => setNewAvailStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                إلى الساعة
              </label>
              <input
                type="time"
                required
                value={newAvailEnd}
                onChange={(e) => setNewAvailEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-num"
              />
            </div>
            <button
              type="submit"
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>إضافة فترة</span>
            </button>
          </form>

          {availability.length === 0 ? (
            <p className="text-xs text-slate-500">
              لم تضف أوقات تفرغ أسبوعية ثابتة بعد.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availability.map((rule, idx) => (
                <div
                  key={`${rule.dayOfWeek}-${rule.startTime}-${idx}`}
                  className="px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-center gap-3"
                >
                  <span className="font-semibold">
                    {WEEKDAY_LABELS_AR[rule.dayOfWeek]}
                  </span>
                  <span className="font-mono-num">
                    {rule.startTime} - {rule.endTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAvailabilityRule(idx)}
                    className="text-red-700 hover:text-red-900 font-bold cursor-pointer"
                    aria-label="حذف فترة التفرغ"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Teacher Curriculum Teaching Assignments */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="space-y-5" data-testid="teacher-assignments-panel">
          {currOverview && (
            <form
              onSubmit={handleAddTeachingAssignment}
              className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
            >
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-700" />
                <span>إضافة مادة وصف دراسي للتدريس</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    النظام التعليمي *
                  </label>
                  <select
                    value={assignSystemId}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : '';
                      setAssignSystemId(val);
                      setAssignGradeId('');
                      setAssignDivisionId('');
                      setAssignPathwayId('');
                      setAssignCurriculumSubjectId('');
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">اختر النظام...</option>
                    {currOverview.systems.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    الصف الدراسي *
                  </label>
                  <select
                    value={assignGradeId}
                    onChange={(e) => {
                      setAssignGradeId(
                        e.target.value ? Number(e.target.value) : ''
                      );
                      setAssignDivisionId('');
                      setAssignPathwayId('');
                      setAssignCurriculumSubjectId('');
                    }}
                    disabled={!assignSystemId}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:opacity-60"
                  >
                    <option value="">اختر الصف...</option>
                    {currOverview.grades
                      .filter((g) => g.systemId === assignSystemId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nameAr}
                        </option>
                      ))}
                  </select>
                </div>

                {assignSystemId &&
                  assignGradeId &&
                  currOverview.systems.find((s) => s.id === assignSystemId)
                    ?.code === 'GENERAL_SECONDARY' &&
                  (currOverview.grades.find((g) => g.id === assignGradeId)
                    ?.gradeNumber ?? 0) >= 2 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        الشعبة (ثانوية عامة) *
                      </label>
                      <select
                        value={assignDivisionId}
                        onChange={(e) =>
                          setAssignDivisionId(
                            e.target.value ? Number(e.target.value) : ''
                          )
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">اختر الشعبة...</option>
                        {currOverview.divisions
                          .filter((d) => d.gradeId === assignGradeId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.nameAr}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                {assignSystemId &&
                  assignGradeId &&
                  currOverview.systems.find((s) => s.id === assignSystemId)
                    ?.code === 'EGYPTIAN_BACCALAUREATE' &&
                  (currOverview.grades.find((g) => g.id === assignGradeId)
                    ?.gradeNumber ?? 0) >= 2 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        المسار (بكالوريا مصرية) *
                      </label>
                      <select
                        value={assignPathwayId}
                        onChange={(e) =>
                          setAssignPathwayId(
                            e.target.value ? Number(e.target.value) : ''
                          )
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">اختر المسار...</option>
                        {currOverview.pathways
                          .filter((p) => p.gradeId === assignGradeId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nameAr}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المادة المقررة *
                  </label>
                  <select
                    value={assignCurriculumSubjectId}
                    onChange={(e) =>
                      setAssignCurriculumSubjectId(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                    disabled={assignCurrSubjOptions.length === 0}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:opacity-60"
                  >
                    <option value="">اختر المادة...</option>
                    {assignCurrSubjOptions.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.subjectNameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    سعر الحصة (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={assignHourlyRate}
                    onChange={(e) => setAssignHourlyRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono-num"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-5 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignOnline}
                      onChange={(e) => setAssignOnline(e.target.checked)}
                    />
                    <span>أونلاين</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignInPerson}
                      onChange={(e) => setAssignInPerson(e.target.checked)}
                    />
                    <span>حضوري</span>
                  </label>
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-5 text-xs">
                  <span className="text-slate-600 font-medium">لغات الشرح:</span>
                  {(['ar', 'en', 'fr'] as const).map((lang) => (
                    <label key={lang} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignLanguages.includes(lang)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignLanguages((prev) =>
                              Array.from(new Set([...prev, lang]))
                            );
                          } else {
                            setAssignLanguages((prev) =>
                              prev.filter((x) => x !== lang)
                            );
                          }
                        }}
                      />
                      <span>{LANGUAGE_OF_INSTRUCTION_LABELS[lang]?.ar}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!assignCurriculumSubjectId}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                حفظ المادة ضمن تخصصي التدريسي
              </button>
            </form>
          )}

          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              لم تقم بإضافة مواد من المناهج المصرية بعد.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      {a.subjectNameAr}
                    </div>
                    <div className="text-xs text-teal-800 font-medium">
                      {a.systemNameAr} · {a.gradeNameAr}
                      {a.divisionNameAr ? ` · ${a.divisionNameAr}` : ''}
                      {a.pathwayNameAr ? ` · ${a.pathwayNameAr}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      لغات الشرح:{' '}
                      {(a.languagesOffered || [])
                        .map((l) => LANGUAGE_OF_INSTRUCTION_LABELS[l]?.ar || l)
                        .join(' / ')}
                      {a.hourlyRate && ` · السعر: $${a.hourlyRate}`}
                      {` · ${a.supportsOnline ? 'أونلاين' : ''}${
                        a.supportsOnline && a.supportsInPerson ? ' و' : ''
                      }${a.supportsInPerson ? 'حضوري' : ''}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeachingAssignment(a.id)}
                    className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إزالة</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accepted Students Modal */}
      {viewingStudentsSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">
                الطلاب المقبولون: {viewingStudentsSession.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingStudentsSession(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            {acceptedStudents.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                لا يوجد طلاب مقبولون في هذه الجلسة بعد.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {acceptedStudents.map((st) => (
                  <div key={st.enrollmentId} className="py-3 space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      {st.fullName}
                      {st.stageNameAr && (
                        <span className="text-xs font-normal text-slate-500 mr-2">
                          ({st.stageNameAr})
                        </span>
                      )}
                    </div>
                    {st.learningGoal && (
                      <p className="text-xs text-slate-600">{st.learningGoal}</p>
                    )}
                    {st.notes && (
                      <p className="text-xs text-teal-800">ملاحظة: {st.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
