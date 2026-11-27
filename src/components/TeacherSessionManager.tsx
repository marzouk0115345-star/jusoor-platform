import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  apiFetch,
  SESSION_TYPE_LABELS_AR,
  SESSION_STATUS_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  DELIVERY_MODE_LABELS_AR,
  WEEKDAY_LABELS_AR,
  LANGUAGE_OF_INSTRUCTION_LABELS,
  formatSessionDateRange,
  formatCurrencyPrice,
  formatOfflineAddress,
  isOfflineDeliveryMode,
  type TeachingSessionItem,
  type TeacherSessionCounts,
  type TeacherTeachingAssignmentItem,
  type CurriculumOverviewResponse,
  type CurriculumSubjectItem,
} from '../lib/api';
import { StateBanner } from './ui/StateBanner';
import { EmptyState } from './ui/EmptyState';
import { LoadingSkeleton } from './ui/LoadingSkeleton';

interface TaxonomyOption {
  id: number;
  nameAr: string;
}

interface TeacherRequestItem {
  id: number;
  sessionId: number;
  sessionTitle: string;
  sessionType: 'ONE_TO_ONE' | 'GROUP';
  deliveryMode: 'ONLINE' | 'IN_PERSON';
  location: string | null;
  sessionStartTime: string;
  sessionEndTime: string;
  durationMinutes?: number;
  price?: string;
  currency?: string;
  sessionStatus: string;
  subjectNameAr: string | null;
  gradeNameAr?: string | null;
  systemNameAr?: string | null;
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

type SessionViewCode =
  | 'all'
  | 'online_group'
  | 'online_one_to_one'
  | 'offline_group'
  | 'upcoming'
  | 'completed'
  | 'cancelled';

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
  const [sessionView, setSessionView] = useState<SessionViewCode>('all');
  const [sessionSubjectFilter, setSessionSubjectFilter] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionPage, setSessionPage] = useState(1);
  const sessionsPerPage = 10;

  const [sessions, setSessions] = useState<TeachingSessionItem[]>([]);
  const [counts, setCounts] = useState<TeacherSessionCounts>({
    all: 0,
    onlineGroup: 0,
    onlineOneToOne: 0,
    offlineGroup: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
  });
  const [requests, setRequests] = useState<TeacherRequestItem[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyOption[]>([]);
  const [stages, setStages] = useState<TaxonomyOption[]>([]);
  const [assignments, setAssignments] = useState<TeacherTeachingAssignmentItem[]>(
    []
  );
  const [currOverview, setCurrOverview] =
    useState<CurriculumOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const [assignHourlyRate, setAssignHourlyRate] = useState('150');
  const [assignLanguages, setAssignLanguages] = useState<string[]>(['ar']);
  const [assignOnline, setAssignOnline] = useState(true);
  const [assignInPerson, setAssignInPerson] = useState(false);

  const [reqTypeFilter, setReqTypeFilter] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState('');
  const [reqSubjectFilter, setReqSubjectFilter] = useState('');
  const [reqDateFilter, setReqDateFilter] = useState('');

  const [pendingDecision, setPendingDecision] = useState<{
    request: TeacherRequestItem;
    decision: 'accept' | 'reject';
  } | null>(null);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const [viewingDetailsSession, setViewingDetailsSession] =
    useState<TeachingSessionItem | null>(null);

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
  const [price, setPrice] = useState('150');
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [deliveryMode, setDeliveryMode] = useState<'ONLINE' | 'IN_PERSON'>(
    'ONLINE'
  );
  const [meetingUrl, setMeetingUrl] = useState('');
  const [location, setLocation] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [streetName, setStreetName] = useState('');
  const [buildingOrCenterName, setBuildingOrCenterName] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  const [viewingStudentsSession, setViewingStudentsSession] =
    useState<TeachingSessionItem | null>(null);
  const [acceptedStudents, setAcceptedStudents] = useState<
    AcceptedStudentItem[]
  >([]);

  const [newDay, setNewDay] = useState(0);
  const [newAvailStart, setNewAvailStart] = useState('17:00');
  const [newAvailEnd, setNewAvailEnd] = useState('20:00');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const mineParams = new URLSearchParams();
      if (sessionView !== 'all') mineParams.set('view', sessionView);
      if (sessionSubjectFilter) mineParams.set('subjectId', sessionSubjectFilter);

      const reqParams = new URLSearchParams();
      if (reqTypeFilter) reqParams.set('sessionType', reqTypeFilter);
      if (reqStatusFilter) reqParams.set('status', reqStatusFilter);
      if (reqSubjectFilter) reqParams.set('subjectId', reqSubjectFilter);
      if (reqDateFilter) reqParams.set('date', reqDateFilter);

      const [mineRes, reqRes, taxRes, assignRes, currRes] = await Promise.all([
        apiFetch<{
          sessions: TeachingSessionItem[];
          availability: AvailabilityRule[];
          counts?: TeacherSessionCounts;
        }>(
          `/api/teaching-sessions/mine${
            mineParams.toString() ? `?${mineParams.toString()}` : ''
          }`
        ),
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
      if (mineRes.counts) setCounts(mineRes.counts);
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
  }, [
    sessionView,
    sessionSubjectFilter,
    reqTypeFilter,
    reqStatusFilter,
    reqSubjectFilter,
    reqDateFilter,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setSessionPage(1);
  }, [sessionView, sessionSubjectFilter, sessionSearch]);

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
    setPrice('150');
    setCurrency('EGP');
    setDeliveryMode('ONLINE');
    setMeetingUrl('');
    setLocation('');
    setGovernorate('');
    setCity('');
    setDistrict('');
    setStreetName('');
    setBuildingOrCenterName('');
    setLocationNotes('');
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
    setCurrency(s.currency === 'USD' ? 'USD' : 'EGP');
    setDeliveryMode(isOfflineDeliveryMode(s.deliveryMode) ? 'IN_PERSON' : 'ONLINE');
    setMeetingUrl(s.meetingUrl || '');
    setLocation(s.location || '');
    setGovernorate(s.governorate || '');
    setCity(s.city || '');
    setDistrict(s.district || '');
    setStreetName(s.streetName || '');
    setBuildingOrCenterName(s.buildingOrCenterName || '');
    setLocationNotes(s.locationNotes || '');
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
      const builtAddress =
        deliveryMode === 'IN_PERSON'
          ? formatOfflineAddress({
              governorate,
              city,
              district,
              streetName,
              buildingOrCenterName,
              locationNotes,
              location,
            })
          : null;

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
        currency,
        deliveryMode,
        meetingUrl: deliveryMode === 'ONLINE' ? meetingUrl.trim() || null : null,
        location: deliveryMode === 'IN_PERSON' ? builtAddress || null : null,
        governorate: deliveryMode === 'IN_PERSON' ? governorate.trim() || null : null,
        city: deliveryMode === 'IN_PERSON' ? city.trim() || null : null,
        district: deliveryMode === 'IN_PERSON' ? district.trim() || null : null,
        streetName: deliveryMode === 'IN_PERSON' ? streetName.trim() || null : null,
        buildingOrCenterName:
          deliveryMode === 'IN_PERSON'
            ? buildingOrCenterName.trim() || null
            : null,
        locationNotes:
          deliveryMode === 'IN_PERSON' ? locationNotes.trim() || null : null,
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

  const confirmAndExecuteRequestDecision = async () => {
    if (!pendingDecision) return;
    setSubmittingDecision(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(
        `/api/session-enrollments/${pendingDecision.request.id}/${pendingDecision.decision}`,
        {
          method: 'POST',
        }
      );
      setFeedback(
        pendingDecision.decision === 'accept'
          ? 'تم قبول الطالب وتأكيد الحجز وإشعار الطالب.'
          : 'تم رفض الطلب وتحديث المقاعد المتاحة وإشعار الطالب.'
      );
      setPendingDecision(null);
      await loadAll();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الطلب.');
    } finally {
      setSubmittingDecision(false);
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

  const filteredLocalSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      `${s.title} ${s.subjectNameAr || ''} ${s.gradeNameAr || ''} ${
        s.location || ''
      }`
        .toLowerCase()
        .includes(q)
    );
  }, [sessions, sessionSearch]);

  const totalSessionPages = Math.max(
    1,
    Math.ceil(filteredLocalSessions.length / sessionsPerPage)
  );
  const pagedSessions = filteredLocalSessions.slice(
    (sessionPage - 1) * sessionsPerPage,
    sessionPage * sessionsPerPage
  );

  const pendingIndividualRequestsCount = requests.filter(
    (r) => r.sessionType === 'ONE_TO_ONE' && r.status === 'PENDING'
  ).length;
  const pendingGroupRequestsCount = requests.filter(
    (r) => r.sessionType === 'GROUP' && r.status === 'PENDING'
  ).length;

  const openSessionView = (view: SessionViewCode) => {
    setActiveTab('SESSIONS');
    setSessionView(view);
  };

  const openRequestsView = (sessionType: 'ONE_TO_ONE' | 'GROUP') => {
    setActiveTab('REQUESTS');
    setReqTypeFilter(sessionType);
  };

  return (
    <section
      className="jusoor-card p-4 sm:p-6 space-y-5"
      data-testid="teacher-session-manager"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#102A43] flex items-center gap-2 m-0">
            <i className="bi bi-calendar2-check text-[#0F766E]" aria-hidden="true" />
            <span>إدارة الجلسات الفردية والجماعية وطلبات الحجز</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-0">
            استعرض الجلسات الأونلاين والأوفلاين، وأدر طلبات الجلسات الفردية والجماعية والمواد المرتبطة بالمنهج.
          </p>
        </div>

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
          className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer self-start lg:self-auto"
        >
          <i className={`bi ${showForm ? 'bi-x-lg' : 'bi-plus-lg'}`} aria-hidden="true" />
          <span>{showForm ? 'إغلاق النموذج' : 'إنشاء جلسة جديدة'}</span>
        </button>
      </div>

      {/* Section Navigation Tabs */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="أقسام إدارة جلسات المعلم"
      >
        {[
          {
            key: 'all' as const,
            label: `كل الجلسات (${counts.all})`,
            active: activeTab === 'SESSIONS' && sessionView === 'all',
            onClick: () => openSessionView('all'),
          },
          {
            key: 'online_group' as const,
            label: `الجماعية أونلاين (${counts.onlineGroup})`,
            active: activeTab === 'SESSIONS' && sessionView === 'online_group',
            onClick: () => openSessionView('online_group'),
          },
          {
            key: 'online_one_to_one' as const,
            label: `الفردية أونلاين (${counts.onlineOneToOne})`,
            active:
              activeTab === 'SESSIONS' && sessionView === 'online_one_to_one',
            onClick: () => openSessionView('online_one_to_one'),
          },
          {
            key: 'offline_group' as const,
            label: `الجماعية أوفلاين (${counts.offlineGroup})`,
            active: activeTab === 'SESSIONS' && sessionView === 'offline_group',
            onClick: () => openSessionView('offline_group'),
          },
          {
            key: 'req_1on1' as const,
            label: `طلبات الفردية (${pendingIndividualRequestsCount})`,
            active: activeTab === 'REQUESTS' && reqTypeFilter === 'ONE_TO_ONE',
            onClick: () => openRequestsView('ONE_TO_ONE'),
          },
          {
            key: 'req_group' as const,
            label: `طلبات الجماعية (${pendingGroupRequestsCount})`,
            active: activeTab === 'REQUESTS' && reqTypeFilter === 'GROUP',
            onClick: () => openRequestsView('GROUP'),
          },
          {
            key: 'upcoming' as const,
            label: `القادمة (${counts.upcoming})`,
            active: activeTab === 'SESSIONS' && sessionView === 'upcoming',
            onClick: () => openSessionView('upcoming'),
          },
          {
            key: 'completed' as const,
            label: `المكتملة (${counts.completed})`,
            active: activeTab === 'SESSIONS' && sessionView === 'completed',
            onClick: () => openSessionView('completed'),
          },
          {
            key: 'cancelled' as const,
            label: `الملغاة (${counts.cancelled})`,
            active: activeTab === 'SESSIONS' && sessionView === 'cancelled',
            onClick: () => openSessionView('cancelled'),
          },
          {
            key: 'assignments' as const,
            label: `موادي وصفوفي (${assignments.length})`,
            active: activeTab === 'ASSIGNMENTS',
            onClick: () => setActiveTab('ASSIGNMENTS'),
          },
          {
            key: 'availability' as const,
            label: `التفرغ الأسبوعي (${availability.length})`,
            active: activeTab === 'AVAILABILITY',
            onClick: () => setActiveTab('AVAILABILITY'),
          },
        ].map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={btn.onClick}
            data-testid={`teacher-tab-${btn.key}`}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              btn.active
                ? 'bg-[#102A43] text-white border-[#102A43]'
                : 'bg-[#F5F8FC] text-[#172B4D] border-[#DCE5F0] hover:border-[#247BA0]'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {feedback && (
        <StateBanner variant="success" message={feedback} onDismiss={() => setFeedback(null)} />
      )}
      {error && (
        <StateBanner variant="error" message={error} onDismiss={() => setError(null)} />
      )}

      {/* Create / Edit Session Form */}
      {showForm && (
        <form
          onSubmit={handleSaveSession}
          className="jusoor-subcard p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#102A43] m-0">
              {editingSessionId
                ? 'تعديل بيانات الجلسة'
                : 'نشر موعد فردي أو جلسة جماعية جديدة'}
            </h3>
            <div className="jusoor-tabs inline-flex items-center gap-1">
              {(['ONE_TO_ONE', 'GROUP'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSessionType(t)}
                  className={`jusoor-tab-btn px-3 py-1.5 text-xs cursor-pointer ${
                    sessionType === t ? 'is-active' : ''
                  }`}
                >
                  {SESSION_TYPE_LABELS_AR[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-8">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                عنوان الجلسة *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  sessionType === 'ONE_TO_ONE'
                    ? 'مثال: جلسة فردية أونلاين لمراجعة الوحدة الأولى'
                    : 'مثال: ورشة مراجعة جماعية شاملة'
                }
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div className="col-12 col-lg-4">
              <div className="row g-2">
                <div className="col-6">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    السعر *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                  />
                </div>
                <div className="col-6">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    العملة
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'EGP' | 'USD')}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="USD">دولار (USD)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="col-12">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                ربط بمادة من المراحل التعليمية المصرية (اختياري — يُظهر الجلسة في اكتشاف الطلاب)
              </label>
              <select
                value={curriculumSubjectId}
                onChange={(e) => setCurriculumSubjectId(e.target.value)}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="">
                  بدون ربط بمنهج صف محدد (استخدم التخصص العام بالأسفل)
                </option>
                {assignments.map((ta) => (
                  <option
                    key={ta.curriculumSubjectId}
                    value={ta.curriculumSubjectId}
                  >
                    {ta.subjectNameAr} — {ta.gradeNameAr} ({ta.systemNameAr}
                    {ta.divisionNameAr ? ` / ${ta.divisionNameAr}` : ''}
                    {ta.pathwayNameAr ? ` / ${ta.pathwayNameAr}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {!curriculumSubjectId && (
              <>
                <div className="col-12 col-md-6 col-lg-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    المادة / التخصص العام
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">عام / بدون مادة محددة</option>
                    {subjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>
                        {subj.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6 col-lg-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    المرحلة الدراسية
                  </label>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
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

            <div className="col-12 col-md-6 col-lg-4">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                طريقة التقديم *
              </label>
              <select
                value={deliveryMode}
                onChange={(e) =>
                  setDeliveryMode(e.target.value as 'ONLINE' | 'IN_PERSON')
                }
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="ONLINE">عن بُعد (أونلاين)</option>
                <option value="IN_PERSON">حضوري (أوفلاين)</option>
              </select>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                وقت البدء *
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
              />
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                وقت الانتهاء *
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
              />
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                آخر موعد للتسجيل (اختياري)
              </label>
              <input
                type="datetime-local"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
              />
            </div>

            {sessionType === 'GROUP' && (
              <>
                <div className="col-6 col-md-3">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    السعة القصوى *
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="500"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    الحد الأدنى للطلاب
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={capacity}
                    value={minStudents}
                    onChange={(e) => setMinStudents(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                  />
                </div>
              </>
            )}

            {deliveryMode === 'ONLINE' ? (
              <div className="col-12 col-lg-6">
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  رابط الجلسة (يظهر للمقبولين فقط)
                </label>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.example.com/..."
                  className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                />
              </div>
            ) : (
              <div className="col-12">
                <div className="bg-white border border-[#DCE5F0] rounded-xl p-4 row g-3 m-0">
                  <div className="col-12 text-xs font-bold text-[#102A43]">
                    تفاصيل العنوان الحضوري (تظهر بوضوح للطلاب عند التصفح)
                  </div>
                  <div className="col-12 col-sm-6 col-lg-4">
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                      المحافظة *
                    </label>
                    <input
                      type="text"
                      required={!location.trim()}
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      placeholder="مثال: القاهرة"
                      className="jusoor-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-6 col-lg-4">
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                      المدينة *
                    </label>
                    <input
                      type="text"
                      required={!location.trim()}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="مثال: مدينة نصر"
                      className="jusoor-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-6 col-lg-4">
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                      الحي / المنطقة
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="مثال: المنطقة السادسة"
                      className="jusoor-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-6 col-lg-4">
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                      الشارع
                    </label>
                    <input
                      type="text"
                      value={streetName}
                      onChange={(e) => setStreetName(e.target.value)}
                      placeholder="مثال: 18 شارع عباس العقاد"
                      className="jusoor-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-6 col-lg-4">
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                      اسم المبنى أو السنتر التعليمي
                    </label>
                    <input
                      type="text"
                      value={buildingOrCenterName}
                      onChange={(e) => setBuildingOrCenterName(e.target.value)}
                      placeholder="مثال: سنتر النخبة التعليمي"
                      className="jusoor-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-6 col-lg-4">
                    <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                      ملاحظات الوصول / القاعة
                    </label>
                    <input
                      type="text"
                      value={locationNotes}
                      onChange={(e) => setLocationNotes(e.target.value)}
                      placeholder="مثال: الدور الثالث - قاعة 4"
                      className="jusoor-input w-full px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="col-12">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                وصف الجلسة وأهدافها
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح باختصار ما سيتعلمه الطالب في هذه الجلسة..."
                className="jusoor-textarea w-full px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={savingSession}
              className="btn-jusoor-primary px-5 py-2.5 text-xs sm:text-sm cursor-pointer"
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
              className="btn-jusoor-outline px-4 py-2.5 text-xs sm:text-sm cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Tab 1: Teacher's Sessions */}
      {activeTab === 'SESSIONS' && (
        <div className="space-y-4">
          <div className="jusoor-subcard p-3 row g-2.5 m-0">
            <div className="col-12 col-sm-8">
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="ابحث بعنوان الجلسة، الصف، أو العنوان..."
                aria-label="بحث في جلسات المعلم"
                className="jusoor-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div className="col-12 col-sm-4">
              <select
                value={sessionSubjectFilter}
                onChange={(e) => setSessionSubjectFilter(e.target.value)}
                aria-label="تصفية الجلسات بالمادة"
                className="jusoor-select w-full px-3 py-2 text-xs"
              >
                <option value="">كل المواد</option>
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton variant="list" count={3} />
          ) : filteredLocalSessions.length === 0 ? (
            <EmptyState
              icon="bi-calendar2"
              title="لا توجد جلسات في هذا القسم حالياً"
              description="يمكنك إنشاء جلسة جديدة أو تبديل التبويب لعرض باقي الجلسات."
            />
          ) : (
            <>
              <div className="divide-y divide-[#DCE5F0] border border-[#DCE5F0] rounded-xl overflow-hidden bg-white">
                {pagedSessions.map((s) => {
                  const isOffline = isOfflineDeliveryMode(s.deliveryMode);
                  return (
                    <div
                      key={s.id}
                      data-testid={`teacher-session-row-${s.id}`}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F8FBFE] transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-[#102A43] inline-flex items-center gap-1">
                            <i
                              className={`bi ${
                                s.sessionType === 'ONE_TO_ONE'
                                  ? 'bi-person-video text-[#247BA0]'
                                  : 'bi-people-fill text-[#0F766E]'
                              }`}
                              aria-hidden="true"
                            />
                            {SESSION_TYPE_LABELS_AR[s.sessionType]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#0F766E]">
                            {SESSION_STATUS_LABELS_AR[s.status] || s.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[#64748B]">
                            <i
                              className={`bi ${
                                isOffline ? 'bi-geo-alt' : 'bi-camera-video'
                              } text-[#0F766E]`}
                              aria-hidden="true"
                            />
                            {DELIVERY_MODE_LABELS_AR[s.deliveryMode]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num font-bold text-[#102A43]">
                            {formatCurrencyPrice(s.price, s.currency)}
                          </span>
                        </div>

                        <div className="font-display text-sm sm:text-base font-bold text-[#102A43]">
                          {s.title}
                        </div>
                        {(s.subjectNameAr || s.gradeNameAr) && (
                          <div className="text-xs text-[#247BA0] font-semibold">
                            {[
                              s.subjectNameAr,
                              s.gradeNameAr,
                              s.divisionNameAr || s.pathwayNameAr,
                              s.systemNameAr,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                        {isOffline && s.location && (
                          <div className="text-xs text-[#64748B] flex items-center gap-1">
                            <i className="bi bi-geo-alt shrink-0" aria-hidden="true" />
                            <span>
                              {s.location}
                              {s.isDemoLocation &&
                              !s.location.includes('موقع عرض تجريبي')
                                ? ' (موقع عرض تجريبي)'
                                : ''}
                            </span>
                          </div>
                        )}

                        <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-3 font-mono-num">
                          <span>
                            {formatSessionDateRange(s.startTime, s.endTime)}
                          </span>
                          <span>
                            المقاعد: {s.acceptedCount}/{s.capacity} (المتبقي:{' '}
                            {s.remainingSeats})
                          </span>
                          {(s.pendingCount ?? 0) > 0 && (
                            <span className="text-[#B45309] font-bold font-sans">
                              {s.pendingCount} طلب بانتظار المراجعة
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setViewingDetailsSession(s)}
                          className="btn-jusoor-outline px-3 py-1.5 text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <i className="bi bi-info-circle" aria-hidden="true" />
                          <span>التفاصيل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewAcceptedStudents(s)}
                          className="btn-jusoor-outline px-3 py-1.5 text-xs cursor-pointer"
                        >
                          الطلاب المقبولون ({s.acceptedCount})
                        </button>

                        {s.status !== 'CANCELLED' &&
                          s.status !== 'COMPLETED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditForm(s)}
                                className="btn-jusoor-outline px-3 py-1.5 text-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <i className="bi bi-pencil-square" aria-hidden="true" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSessionAction(s.id, 'complete')
                                }
                                className="btn-jusoor-navy px-3 py-1.5 text-xs cursor-pointer"
                              >
                                إتمام
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSessionAction(s.id, 'cancel')
                                }
                                className="px-3 py-1.5 border border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2] text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                              >
                                <i className="bi bi-slash-circle" aria-hidden="true" />
                                <span>إلغاء</span>
                              </button>
                            </>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalSessionPages > 1 && (
                <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
                  <span className="tabular-nums">
                    صفحة {sessionPage} من {totalSessionPages} (إجمالي{' '}
                    {filteredLocalSessions.length} جلسة)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={sessionPage <= 1}
                      onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                      className="btn-jusoor-outline px-3 py-1.5 text-xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <i className="bi bi-chevron-right" aria-hidden="true" />
                      <span>السابق</span>
                    </button>
                    <button
                      type="button"
                      disabled={sessionPage >= totalSessionPages}
                      onClick={() =>
                        setSessionPage((p) => Math.min(totalSessionPages, p + 1))
                      }
                      className="btn-jusoor-outline px-3 py-1.5 text-xs disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>التالي</span>
                      <i className="bi bi-chevron-left" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 2: Incoming Requests */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-4" data-testid="teacher-requests-panel">
          <div className="jusoor-subcard p-3 row g-2.5 m-0">
            <div className="col-12 col-sm-6 col-lg-3">
              <select
                value={reqTypeFilter}
                onChange={(e) => setReqTypeFilter(e.target.value)}
                aria-label="تصفية بنوع الجلسة"
                className="jusoor-select w-full px-3 py-2 text-xs"
              >
                <option value="">كل أنواع الجلسات</option>
                <option value="ONE_TO_ONE">طلبات الجلسات الفردية (1:1)</option>
                <option value="GROUP">طلبات الجلسات الجماعية</option>
              </select>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <select
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value)}
                aria-label="تصفية بحالة الطلب"
                className="jusoor-select w-full px-3 py-2 text-xs"
              >
                <option value="">كل الحالات</option>
                <option value="PENDING">بانتظار الموافقة</option>
                <option value="ACCEPTED">مقبول</option>
                <option value="REJECTED">مرفوض</option>
                <option value="CANCELLED">ملغى</option>
              </select>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <select
                value={reqSubjectFilter}
                onChange={(e) => setReqSubjectFilter(e.target.value)}
                aria-label="تصفية بالمادة"
                className="jusoor-select w-full px-3 py-2 text-xs"
              >
                <option value="">كل المواد</option>
                {subjects.map((subj) => (
                  <option key={subj.id} value={subj.id}>
                    {subj.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <input
                type="date"
                value={reqDateFilter}
                onChange={(e) => setReqDateFilter(e.target.value)}
                aria-label="تصفية بالتاريخ"
                className="jusoor-input w-full px-3 py-2 text-xs font-mono-num"
              />
            </div>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              icon="bi-inbox"
              title="لا توجد طلبات مطابقة لخيارات البحث الحالية"
            />
          ) : (
            <div className="divide-y divide-[#DCE5F0] border border-[#DCE5F0] rounded-xl overflow-hidden bg-white">
              {requests.map((r) => (
                <div
                  key={r.id}
                  data-testid={`teacher-request-row-${r.id}`}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[#102A43]">
                        {SESSION_TYPE_LABELS_AR[r.sessionType]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          r.status === 'ACCEPTED'
                            ? 'text-[#0F766E] font-bold'
                            : r.status === 'PENDING'
                            ? 'text-[#B45309] font-bold'
                            : 'text-[#64748B] font-semibold'
                        }
                      >
                        {ENROLLMENT_STATUS_LABELS_AR[r.status] || r.status}
                      </span>
                      {(r.subjectNameAr || r.gradeNameAr) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#247BA0] font-semibold">
                            {[r.subjectNameAr, r.gradeNameAr, r.systemNameAr]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </>
                      )}
                      {r.price !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num font-bold text-[#102A43]">
                            {formatCurrencyPrice(
                              r.price,
                              r.currency || 'EGP'
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="text-sm font-bold text-[#102A43]">
                      الطالب: {r.student.fullName}
                      {r.student.stageNameAr && (
                        <span className="text-xs font-normal text-[#64748B] mr-2">
                          ({r.student.stageNameAr})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#172B4D] flex flex-wrap items-center gap-2">
                      <span>
                        الجلسة: <strong className="font-semibold">{r.sessionTitle}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num text-[#64748B]">
                        {formatSessionDateRange(
                          r.sessionStartTime,
                          r.sessionEndTime
                        )}
                      </span>
                      {r.durationMinutes && (
                        <span className="text-[#64748B]">
                          ({r.durationMinutes} د)
                        </span>
                      )}
                    </div>

                    {isOfflineDeliveryMode(r.deliveryMode) && r.location && (
                      <div className="text-xs text-[#64748B] flex items-center gap-1">
                        <i className="bi bi-geo-alt text-[#0F766E] shrink-0" aria-hidden="true" />
                        <span>{r.location}</span>
                      </div>
                    )}

                    {r.student.learningGoal && (
                      <p className="text-xs text-[#64748B] m-0">
                        هدف الطالب: {r.student.learningGoal}
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-xs text-[#172B4D] jusoor-subcard px-2.5 py-1.5 m-0">
                        رسالة الطالب: {r.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {r.status === 'PENDING' && (
                      <button
                        type="button"
                        data-testid={`accept-request-btn-${r.id}`}
                        onClick={() =>
                          setPendingDecision({ request: r, decision: 'accept' })
                        }
                        className="btn-jusoor-primary px-3.5 py-2 text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <i className="bi bi-check-circle" aria-hidden="true" />
                        <span>قبول</span>
                      </button>
                    )}
                    {(r.status === 'PENDING' || r.status === 'ACCEPTED') && (
                      <button
                        type="button"
                        data-testid={`reject-request-btn-${r.id}`}
                        onClick={() =>
                          setPendingDecision({ request: r, decision: 'reject' })
                        }
                        className="px-3.5 py-2 border border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2] text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <i className="bi bi-x-circle" aria-hidden="true" />
                        <span>
                          {r.status === 'ACCEPTED' ? 'إلغاء القبول' : 'رفض'}
                        </span>
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
            className="jusoor-subcard p-4 row g-3 align-items-end m-0"
          >
            <div className="col-12 col-sm-3">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                اليوم
              </label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                {Object.entries(WEEKDAY_LABELS_AR).map(([dayIdx, label]) => (
                  <option key={dayIdx} value={dayIdx}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-sm-3">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                من الساعة
              </label>
              <input
                type="time"
                required
                value={newAvailStart}
                onChange={(e) => setNewAvailStart(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
              />
            </div>
            <div className="col-6 col-sm-3">
              <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                إلى الساعة
              </label>
              <input
                type="time"
                required
                value={newAvailEnd}
                onChange={(e) => setNewAvailEnd(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
              />
            </div>
            <div className="col-12 col-sm-3">
              <button
                type="submit"
                className="btn-jusoor-navy w-full py-2 px-4 text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <i className="bi bi-clock" aria-hidden="true" />
                <span>إضافة فترة</span>
              </button>
            </div>
          </form>

          {availability.length === 0 ? (
            <EmptyState
              icon="bi-clock-history"
              title="لم تضف أوقات تفرغ أسبوعية ثابتة بعد"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {availability.map((rule, idx) => (
                <div
                  key={`${rule.dayOfWeek}-${rule.startTime}-${idx}`}
                  className="px-3 py-2 bg-[#E8F8F5] border border-[#99E2D8] rounded-lg text-xs text-[#0B4F4A] flex items-center gap-3"
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
                    className="text-[#DC2626] hover:text-[#991B1B] font-bold cursor-pointer"
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

      {/* Tab 4: Curriculum Teaching Assignments */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="space-y-4" data-testid="teacher-assignments-panel">
          {currOverview && (
            <form
              onSubmit={handleAddTeachingAssignment}
              className="jusoor-subcard p-4 sm:p-5 space-y-4"
            >
              <div className="text-sm font-bold text-[#102A43] flex items-center gap-2">
                <i className="bi bi-book text-[#0F766E]" aria-hidden="true" />
                <span>إضافة مادة وصف دراسي للتدريس</span>
              </div>

              <div className="row g-3">
                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
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
                    className="jusoor-select w-full px-3 py-2 text-xs"
                  >
                    <option value="">اختر النظام...</option>
                    {currOverview.systems.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
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
                    className="jusoor-select w-full px-3 py-2 text-xs disabled:opacity-60"
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
                    <div className="col-12 col-sm-6 col-lg-3">
                      <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                        الشعبة (ثانوية عامة) *
                      </label>
                      <select
                        value={assignDivisionId}
                        onChange={(e) =>
                          setAssignDivisionId(
                            e.target.value ? Number(e.target.value) : ''
                          )
                        }
                        className="jusoor-select w-full px-3 py-2 text-xs"
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
                    <div className="col-12 col-sm-6 col-lg-3">
                      <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                        المسار (بكالوريا مصرية) *
                      </label>
                      <select
                        value={assignPathwayId}
                        onChange={(e) =>
                          setAssignPathwayId(
                            e.target.value ? Number(e.target.value) : ''
                          )
                        }
                        className="jusoor-select w-full px-3 py-2 text-xs"
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

                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
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
                    className="jusoor-select w-full px-3 py-2 text-xs disabled:opacity-60"
                  >
                    <option value="">اختر المادة...</option>
                    {assignCurrSubjOptions.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.subjectNameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    سعر الحصة (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={assignHourlyRate}
                    onChange={(e) => setAssignHourlyRate(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-xs font-mono-num"
                  />
                </div>

                <div className="col-12 col-sm-6 col-lg-3 flex flex-wrap items-center gap-3 pt-sm-4 text-xs">
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
                    <span>حضوري (أوفلاين)</span>
                  </label>
                </div>

                <div className="col-12 col-lg-6 flex flex-wrap items-center gap-3 pt-lg-4 text-xs">
                  <span className="text-[#64748B] font-semibold">
                    لغات الشرح:
                  </span>
                  {(['ar', 'en', 'fr'] as const).map((lang) => (
                    <label
                      key={lang}
                      className="flex items-center gap-1 cursor-pointer"
                    >
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
                className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
              >
                حفظ المادة ضمن تخصصي التدريسي
              </button>
            </form>
          )}

          {assignments.length === 0 ? (
            <EmptyState
              icon="bi-journal-bookmark"
              title="لم تقم بإضافة مواد من المناهج المصرية بعد"
            />
          ) : (
            <div className="divide-y divide-[#DCE5F0] border border-[#DCE5F0] rounded-xl overflow-hidden bg-white">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#102A43]">
                      {a.subjectNameAr}
                    </div>
                    <div className="text-xs text-[#247BA0] font-semibold">
                      {a.systemNameAr} · {a.gradeNameAr}
                      {a.divisionNameAr ? ` · ${a.divisionNameAr}` : ''}
                      {a.pathwayNameAr ? ` · ${a.pathwayNameAr}` : ''}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      لغات الشرح:{' '}
                      {(a.languagesOffered || [])
                        .map((l) => LANGUAGE_OF_INSTRUCTION_LABELS[l]?.ar || l)
                        .join(' / ')}
                      {a.hourlyRate &&
                        ` · السعر: ${formatCurrencyPrice(
                          a.hourlyRate,
                          a.currency || 'EGP'
                        )}`}
                      {` · ${a.supportsOnline ? 'أونلاين' : ''}${
                        a.supportsOnline && a.supportsInPerson ? ' و' : ''
                      }${a.supportsInPerson ? 'حضوري (أوفلاين)' : ''}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeachingAssignment(a.id)}
                    className="px-3 py-1.5 border border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2] text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer self-start sm:self-center"
                  >
                    <i className="bi bi-trash3" aria-hidden="true" />
                    <span>إزالة</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingDecision && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          data-testid="teacher-decision-confirm-modal"
        >
          <div className="jusoor-card w-full max-w-md p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
              {pendingDecision.decision === 'accept'
                ? 'تأكيد قبول طلب الحجز'
                : pendingDecision.request.status === 'ACCEPTED'
                ? 'تأكيد إلغاء قبول الطالب'
                : 'تأكيد رفض طلب الحجز'}
            </h3>

            <dl className="jusoor-subcard p-3.5 text-xs space-y-1.5 text-[#172B4D] m-0">
              <div>
                <span className="text-[#64748B]">الطالب: </span>
                <strong className="text-[#102A43]">
                  {pendingDecision.request.student.fullName}
                </strong>
              </div>
              <div>
                <span className="text-[#64748B]">الجلسة: </span>
                <strong className="text-[#102A43]">
                  {pendingDecision.request.sessionTitle}
                </strong>
              </div>
              {(pendingDecision.request.subjectNameAr ||
                pendingDecision.request.gradeNameAr) && (
                <div>
                  <span className="text-[#64748B]">المادة والصف: </span>
                  <span className="text-[#0F766E] font-semibold">
                    {[
                      pendingDecision.request.subjectNameAr,
                      pendingDecision.request.gradeNameAr,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}
              <div className="font-mono-num">
                <span className="text-[#64748B] font-sans">الموعد: </span>
                {formatSessionDateRange(
                  pendingDecision.request.sessionStartTime,
                  pendingDecision.request.sessionEndTime
                )}
              </div>
              {pendingDecision.request.price !== undefined && (
                <div className="font-mono-num font-bold text-[#0F766E]">
                  {formatCurrencyPrice(
                    pendingDecision.request.price,
                    pendingDecision.request.currency || 'EGP'
                  )}
                </div>
              )}
            </dl>

            <p className="text-xs text-[#64748B] leading-relaxed m-0">
              {pendingDecision.decision === 'accept'
                ? pendingDecision.request.sessionType === 'ONE_TO_ONE'
                  ? 'سيتم حجز هذا الموعد الفردي للطالب وإغلاقه أمام الطلبات الأخرى وإشعار الطالب فوراً.'
                  : 'سيتم تأكيد انضمام الطالب إلى الجلسة الجماعية وإرسال إشعار القبول له.'
                : 'سيتم تحديث حالة الطلب وإرسال إشعار للطالب مع إتاحة المقعد مجدداً.'}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={submittingDecision}
                data-testid="confirm-decision-btn"
                onClick={confirmAndExecuteRequestDecision}
                className={`flex-1 py-2.5 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60 ${
                  pendingDecision.decision === 'accept'
                    ? 'bg-[#0F766E] hover:bg-[#0B5D56]'
                    : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                }`}
              >
                {submittingDecision
                  ? 'جاري التنفيذ...'
                  : pendingDecision.decision === 'accept'
                  ? 'تأكيد القبول'
                  : 'تأكيد الرفض'}
              </button>
              <button
                type="button"
                disabled={submittingDecision}
                onClick={() => setPendingDecision(null)}
                className="btn-jusoor-outline px-4 py-2.5 text-xs sm:text-sm cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {viewingDetailsSession && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                {viewingDetailsSession.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingDetailsSession(null)}
                className="text-xs font-semibold text-[#64748B] hover:text-[#102A43] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <dl className="jusoor-subcard p-4 row g-3 text-xs m-0">
              <div className="col-12 col-sm-6">
                <dt className="text-[#64748B]">النوع والحالة</dt>
                <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                  {SESSION_TYPE_LABELS_AR[viewingDetailsSession.sessionType]} ·{' '}
                  {SESSION_STATUS_LABELS_AR[viewingDetailsSession.status]}
                </dd>
              </div>
              <div className="col-12 col-sm-6">
                <dt className="text-[#64748B]">السعر</dt>
                <dd className="font-mono-num font-bold text-[#0F766E] mt-0.5 mb-0">
                  {formatCurrencyPrice(
                    viewingDetailsSession.price,
                    viewingDetailsSession.currency
                  )}
                </dd>
              </div>
              <div className="col-12">
                <dt className="text-[#64748B]">التاريخ والوقت</dt>
                <dd className="font-mono-num font-semibold text-[#102A43] mt-0.5 mb-0">
                  {formatSessionDateRange(
                    viewingDetailsSession.startTime,
                    viewingDetailsSession.endTime
                  )}{' '}
                  ({viewingDetailsSession.durationMinutes} دقيقة)
                </dd>
              </div>
              {isOfflineDeliveryMode(viewingDetailsSession.deliveryMode) &&
                viewingDetailsSession.location && (
                  <div className="col-12">
                    <dt className="text-[#64748B]">العنوان الحضوري الكامل</dt>
                    <dd className="font-semibold text-[#102A43] mt-0.5 mb-0">
                      {viewingDetailsSession.location}
                    </dd>
                  </div>
                )}
              {viewingDetailsSession.meetingUrl && (
                <div className="col-12">
                  <dt className="text-[#64748B]">رابط الجلسة الأونلاين</dt>
                  <dd className="mt-0.5 break-all text-[#247BA0] font-mono-num mb-0">
                    {viewingDetailsSession.meetingUrl}
                  </dd>
                </div>
              )}
            </dl>
            {viewingDetailsSession.description && (
              <p className="text-xs text-[#64748B] leading-relaxed m-0">
                {viewingDetailsSession.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Accepted Students Modal */}
      {viewingStudentsSession && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                الطلاب المقبولون: {viewingStudentsSession.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingStudentsSession(null)}
                className="text-xs font-semibold text-[#64748B] hover:text-[#102A43] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            {acceptedStudents.length === 0 ? (
              <p className="text-sm text-[#64748B] py-4 text-center m-0">
                لا يوجد طلاب مقبولون في هذه الجلسة بعد.
              </p>
            ) : (
              <div className="divide-y divide-[#EDF2F7] max-h-80 overflow-y-auto">
                {acceptedStudents.map((st) => (
                  <div key={st.enrollmentId} className="py-3 space-y-1">
                    <div className="text-sm font-bold text-[#102A43]">
                      {st.fullName}
                      {st.stageNameAr && (
                        <span className="text-xs font-normal text-[#64748B] mr-2">
                          ({st.stageNameAr})
                        </span>
                      )}
                    </div>
                    {st.learningGoal && (
                      <p className="text-xs text-[#64748B] m-0">
                        {st.learningGoal}
                      </p>
                    )}
                    {st.notes && (
                      <p className="text-xs text-[#0F766E] m-0">ملاحظة: {st.notes}</p>
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
