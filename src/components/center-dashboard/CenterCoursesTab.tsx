import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFetch,
  COURSE_ENROLLMENT_STATUS_LABELS_AR,
  COURSE_STATUS_LABELS_AR,
  LEVEL_LABELS_AR,
  normalizeCourseLessonsOrder,
  validateCoursePublishReadiness,
  type CenterCourseItem,
  type CenterCourseLessonInput,
  type CenterTeacherItem,
  type CurriculumOverviewResponse,
} from '../../lib/api';
import { SafeImage } from '../SafeImage';
import { EmptyState } from '../ui/EmptyState';
import { CourseImageUploadField } from './CourseImageUploadField';
import {
  CourseLessonsEditor,
  createEmptyCourseLesson,
} from '../courses/CourseLessonsEditor';

interface TaxonomyLite {
  fields: Array<{ id: number; nameAr: string }>;
  stages: Array<{ id: number; nameAr: string }>;
  subjects: Array<{ id: number; nameAr: string }>;
}

interface CenterCoursesTabProps {
  centerId: number;
  courses: CenterCourseItem[];
  teachers: CenterTeacherItem[];
  taxonomy: TaxonomyLite;
  curriculum: CurriculumOverviewResponse | null;
  onRefresh: () => Promise<void>;
  onNotify: (variant: 'success' | 'error', msg: string) => void;
}

export function CenterCoursesTab({
  centerId,
  courses,
  teachers,
  taxonomy,
  curriculum,
  onRefresh,
  onNotify,
}: CenterCoursesTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CenterCourseItem | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Course Form Fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructorUserId, setInstructorUserId] = useState('');
  const [customFieldName, setCustomFieldName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [stageId, setStageId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [pathwayId, setPathwayId] = useState('');
  const [level, setLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>(
    'BEGINNER'
  );
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('EGP');
  const [maxStudents, setMaxStudents] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'>(
    'PUBLISHED'
  );
  const [enrollmentStatus, setEnrollmentStatus] = useState<
    'OPEN' | 'PAUSED' | 'CLOSED'
  >('OPEN');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [lessons, setLessons] = useState<CenterCourseLessonInput[]>([
    createEmptyCourseLesson(1),
  ]);
  const [lessonErrors, setLessonErrors] = useState<Record<number, string>>({});
  const [lessonsSectionError, setLessonsSectionError] = useState<
    string | undefined
  >(undefined);

  const activeEligibleTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'ACTIVE'),
    [teachers]
  );

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (q) {
        const hay = `${c.title} ${c.subtitle} ${c.fieldNameAr} ${c.instructorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, search, statusFilter]);

  const openCreateModal = () => {
    setEditingCourse(null);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setInstructorUserId(
      activeEligibleTeachers[0] ? String(activeEligibleTeachers[0].userId) : ''
    );
    setCustomFieldName('');
    setTargetAudience('');
    setSubjectId('');
    setStageId('');
    setSystemId('');
    setGradeId('');
    setDivisionId('');
    setPathwayId('');
    setLevel('BEGINNER');
    setPrice('0');
    setCurrency('EGP');
    setMaxStudents('');
    setStatus('PUBLISHED');
    setEnrollmentStatus('OPEN');
    setThumbnailUrl(null);
    setCoverImageKey(null);
    setLessons([createEmptyCourseLesson(1)]);
    setLessonErrors({});
    setLessonsSectionError(undefined);
    setModalOpen(true);
  };

  const openEditModal = (c: CenterCourseItem) => {
    setEditingCourse(c);
    setTitle(c.title);
    setSubtitle(c.subtitle);
    setDescription(c.description);
    setInstructorUserId(String(c.instructorUserId));
    setCustomFieldName(c.customFieldName || c.fieldNameAr || '');
    setTargetAudience(c.targetAudience || '');
    setSubjectId(c.subjectId ? String(c.subjectId) : '');
    setStageId(c.stageId ? String(c.stageId) : '');
    setSystemId(c.systemId ? String(c.systemId) : '');
    setGradeId(c.gradeId ? String(c.gradeId) : '');
    setDivisionId(c.divisionId ? String(c.divisionId) : '');
    setPathwayId(c.pathwayId ? String(c.pathwayId) : '');
    setLevel(c.level);
    setPrice(String(Number(c.price)));
    setCurrency(c.currency || 'EGP');
    setMaxStudents(c.maxStudents ? String(c.maxStudents) : '');
    setStatus(c.status === 'ARCHIVED' ? 'CLOSED' : c.status);
    setEnrollmentStatus(c.enrollmentStatus || 'OPEN');
    setThumbnailUrl(c.thumbnailUrl);
    setCoverImageKey(c.coverImageKey || null);
    setLessons(
      c.lessons.length > 0
        ? normalizeCourseLessonsOrder(
            c.lessons.map((l) => ({
              id: l.id,
              moduleTitle: l.moduleTitle || '',
              title: l.title,
              content: l.content,
              durationMinutes: l.durationMinutes,
              sortOrder: l.sortOrder,
              isFreePreview: l.isFreePreview,
            }))
          )
        : [createEmptyCourseLesson(1)]
    );
    setLessonErrors({});
    setLessonsSectionError(undefined);
    setModalOpen(true);
  };

  const submitWithStatus = async (
    targetStatus: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'
  ) => {
    if (!instructorUserId) {
      onNotify('error', 'يرجى اختيار المعلّم المسؤول عن الدورة.');
      return;
    }

    setLessonErrors({});
    setLessonsSectionError(undefined);

    const normalizedLessons = normalizeCourseLessonsOrder(
      lessons.map((l, idx) => ({
        ...(l.id ? { id: l.id } : {}),
        moduleTitle: l.moduleTitle?.trim() || null,
        title: l.title,
        content: l.content,
        durationMinutes: Number(l.durationMinutes) || 20,
        sortOrder: l.sortOrder ?? idx + 1,
        isFreePreview: Boolean(l.isFreePreview),
      }))
    );

    const check = validateCoursePublishReadiness({
      title,
      description,
      customFieldName,
      lessons: normalizedLessons,
      status: targetStatus,
    });

    if (!check.valid) {
      setLessonErrors(check.lessonErrors);
      setLessonsSectionError(check.errors.lessons);
      const firstErr =
        Object.values(check.errors)[0] ||
        Object.values(check.lessonErrors)[0] ||
        'يرجى استكمال الحقول المطلوبة.';
      onNotify('error', firstErr);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        instructorUserId: Number(instructorUserId),
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        customFieldName: customFieldName.trim(),
        targetAudience: targetAudience.trim() || null,
        subjectId: subjectId ? Number(subjectId) : null,
        stageId: stageId ? Number(stageId) : null,
        systemId: systemId ? Number(systemId) : null,
        gradeId: gradeId ? Number(gradeId) : null,
        divisionId: divisionId ? Number(divisionId) : null,
        pathwayId: pathwayId ? Number(pathwayId) : null,
        level,
        price: Number(price) || 0,
        currency,
        maxStudents: maxStudents ? Number(maxStudents) : null,
        status: targetStatus,
        enrollmentStatus,
        thumbnailUrl,
        coverImageKey,
        lessons: normalizedLessons.map((l) => ({
          ...(l.id ? { id: l.id } : {}),
          moduleTitle: l.moduleTitle,
          title: l.title.trim(),
          content: l.content.trim(),
          durationMinutes: Number(l.durationMinutes) || 20,
          isFreePreview: Boolean(l.isFreePreview),
          sortOrder: l.sortOrder,
        })),
      };

      if (editingCourse) {
        await apiFetch(
          `/api/center-dashboard/${centerId}/courses/${editingCourse.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              removeThumbnail: thumbnailUrl === null,
            }),
          }
        );
        onNotify('success', 'تم تحديث الدورة وغلافها ومحتواها بنجاح.');
      } else {
        await apiFetch(`/api/center-dashboard/${centerId}/courses`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify(
          'success',
          targetStatus === 'DRAFT'
            ? 'تم حفظ الدورة كمسودة في المركز بنجاح.'
            : 'تم إنشاء الدورة ونشرها في المركز بنجاح.'
        );
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر حفظ بيانات الدورة.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    void submitWithStatus(status);
  };

  const systemsForStage = (curriculum?.systems || []).filter(
    (s) => !stageId || s.stageId === Number(stageId)
  );
  const gradesForSystem = (curriculum?.grades || []).filter(
    (g) =>
      (!stageId || g.stageId === Number(stageId)) &&
      (!systemId || g.systemId === Number(systemId))
  );
  const divisionsForGrade = (curriculum?.divisions || []).filter(
    (d) => gradeId && d.gradeId === Number(gradeId)
  );
  const pathwaysForGrade = (curriculum?.pathways || []).filter(
    (p) => gradeId && p.gradeId === Number(gradeId)
  );

  return (
    <div className="space-y-4">
      <div className="jusoor-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بعنوان الدورة أو اسم المعلّم..."
            className="jusoor-input px-3 py-2 text-xs sm:text-sm flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="تصفية حسب حالة الدورة"
            className="jusoor-select px-3 py-2 text-xs sm:text-sm"
          >
            <option value="ALL">كل الدورات ({courses.length})</option>
            <option value="PUBLISHED">منشورة</option>
            <option value="DRAFT">مسودة</option>
            <option value="PAUSED">متوقفة</option>
            <option value="CLOSED">مغلقة</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
        >
          <i className="bi bi-plus-circle" aria-hidden="true" />
          <span>إنشاء دورة جديدة</span>
        </button>
      </div>

      {filteredCourses.length === 0 ? (
        <EmptyState
          icon="bi-journal-bookmark"
          title="لا توجد دورات مطابقة"
          description="أضف دورة جديدة وارفع غلافها المخصص ليشاهدها الطلاب في الكتالوج العام."
          action={
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
            >
              + إنشاء أول دورة
            </button>
          }
        />
      ) : (
        <div className="row g-4">
          {filteredCourses.map((c) => (
            <div key={c.id} className="col-12 col-md-6 col-xl-4">
              <article className="jusoor-card overflow-hidden flex flex-col h-full">
                <div className="aspect-[16/10] bg-[#EEF4FA] relative overflow-hidden">
                  <SafeImage
                    src={c.thumbnailUrl}
                    alt={c.title}
                    fallbackTitle={c.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2.5 start-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/95 text-[#102A43] shadow-xs">
                      {COURSE_STATUS_LABELS_AR[c.status] || c.status}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold shadow-xs ${
                        c.enrollmentStatus === 'OPEN'
                          ? 'bg-[#0F766E] text-white'
                          : 'bg-[#B45309] text-white'
                      }`}
                    >
                      {COURSE_ENROLLMENT_STATUS_LABELS_AR[c.enrollmentStatus] ||
                        c.enrollmentStatus}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-1.5">
                      <span>{c.fieldNameAr}</span>
                      <span>·</span>
                      <span>{LEVEL_LABELS_AR[c.level] || c.level}</span>
                      {c.subjectNameAr && (
                        <>
                          <span>·</span>
                          <span>{c.subjectNameAr}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-[#102A43] m-0 leading-snug">
                      {c.title}
                    </h3>
                    <p className="text-xs text-[#64748B] m-0 line-clamp-2">
                      {c.subtitle}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-[#EDF2F7]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#172B4D] font-semibold">
                        المعلّم: {c.instructorName}
                      </span>
                      <span className="font-mono-num font-bold text-[#0F766E]">
                        {Number(c.price) === 0
                          ? 'مجانية'
                          : `${c.price} ${c.currency}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                      <span className="font-mono-num">
                        الطلاب: {c.enrollmentsCount}
                        {c.maxStudents ? ` / ${c.maxStudents}` : ''} · {c.lessonsCount} دروس
                      </span>
                      <span className="font-mono-num">
                        {c.ratingAvg ? `★ ${c.ratingAvg} (${c.reviewsCount})` : 'جديدة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="btn-jusoor-primary flex-1 py-1.5 text-xs cursor-pointer"
                      >
                        تعديل الدورة والغلاف
                      </button>
                      <Link
                        to={`/courses/${c.id}`}
                        className="btn-jusoor-outline px-3 py-1.5 text-xs"
                      >
                        معاينة
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Course Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-4xl p-4 sm:p-6 my-auto max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
              <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                {editingCourse
                  ? `تعديل الدورة: ${editingCourse.title}`
                  : 'إنشاء دورة تدريبية جديدة بالمركز'}
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

            <form onSubmit={handleSaveCourse} className="space-y-5">
              {/* Dedicated Course Cover Image Upload */}
              <CourseImageUploadField
                centerId={centerId}
                courseId={editingCourse?.id ?? null}
                mode="course"
                value={thumbnailUrl}
                fallbackTitle={title || 'غلاف الدورة الجديدة'}
                onChange={({ url, coverImageKey: nextKey }) => {
                  setThumbnailUrl(url);
                  if (nextKey !== undefined) {
                    setCoverImageKey(nextKey);
                  }
                }}
                onRemoveExisting={
                  editingCourse
                    ? async () => {
                        await apiFetch(
                          `/api/center-dashboard/${centerId}/courses/${editingCourse.id}/image`,
                          { method: 'DELETE' }
                        );
                        onNotify('success', 'تمت إزالة صورة غلاف الدورة.');
                        await onRefresh();
                      }
                    : undefined
                }
              />

              {/* Basic Details */}
              <div className="row g-3">
                <div className="col-12 col-md-8">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    عنوان الدورة
                  </label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: المراجعة النهائية في الفيزياء — الصف الثالث الثانوي"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-md-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المعلّم المسؤول (من كادر المركز النشط)
                  </label>
                  <select
                    required
                    value={instructorUserId}
                    onChange={(e) => setInstructorUserId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">اختر المعلّم</option>
                    {activeEligibleTeachers.map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.fullName} — {t.jobTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-md-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    العنوان الفرعي المختصر (اختياري)
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="وصف موجز يظهر في بطاقة الدورة العامة"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الفئة المستهدفة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="مثال: طلاب الثانوية، المبتدئون في البرمجة"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div className="col-12">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الوصف التفصيلي والأهداف التعليمية
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="jusoor-textarea w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Manual Field Entry & Curriculum Cascade */}
                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المجال / التخصص (كتابة يدوية) *
                  </label>
                  <input
                    type="text"
                    required
                    value={customFieldName}
                    onChange={(e) => setCustomFieldName(e.target.value)}
                    placeholder="مثال: الأمن السيبراني، الفيزياء، تطوير الويب"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المادة الدراسية
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">عام / غير محدد</option>
                    {taxonomy.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المرحلة التعليمية
                  </label>
                  <select
                    value={stageId}
                    onChange={(e) => {
                      setStageId(e.target.value);
                      setSystemId('');
                      setGradeId('');
                      setDivisionId('');
                      setPathwayId('');
                    }}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">كل المراحل</option>
                    {taxonomy.stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    النظام التعليمي
                  </label>
                  <select
                    value={systemId}
                    onChange={(e) => {
                      setSystemId(e.target.value);
                      setGradeId('');
                      setDivisionId('');
                      setPathwayId('');
                    }}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">عام</option>
                    {systemsForStage.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الصف الدراسي
                  </label>
                  <select
                    value={gradeId}
                    onChange={(e) => {
                      setGradeId(e.target.value);
                      setDivisionId('');
                      setPathwayId('');
                    }}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">غير محدد</option>
                    {gradesForSystem.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {divisionsForGrade.length > 0 && (
                  <div className="col-12 col-sm-6 col-md-4">
                    <label className="block text-xs font-bold text-[#102A43] mb-1">
                      الشعبة (الثانوية العامة)
                    </label>
                    <select
                      value={divisionId}
                      onChange={(e) => setDivisionId(e.target.value)}
                      className="jusoor-select w-full px-3 py-2 text-sm"
                    >
                      <option value="">اختر الشعبة</option>
                      {divisionsForGrade.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {pathwaysForGrade.length > 0 && (
                  <div className="col-12 col-sm-6 col-md-4">
                    <label className="block text-xs font-bold text-[#102A43] mb-1">
                      المسار (البكالوريا المصرية)
                    </label>
                    <select
                      value={pathwayId}
                      onChange={(e) => setPathwayId(e.target.value)}
                      className="jusoor-select w-full px-3 py-2 text-sm"
                    >
                      <option value="">اختر المسار</option>
                      {pathwaysForGrade.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Pricing, Capacity, Status */}
                <div className="col-6 col-md-2">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    السعر
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div className="col-6 col-md-2">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    العملة
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="EGP">EGP</option>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div className="col-6 col-md-2">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    الحد الأقصى للطلاب
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={maxStudents}
                    onChange={(e) => setMaxStudents(e.target.value)}
                    placeholder="غير محدود"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>

                <div className="col-6 col-md-2">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    المستوى
                  </label>
                  <select
                    value={level}
                    onChange={(e) =>
                      setLevel(
                        e.target.value as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
                      )
                    }
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="BEGINNER">مبتدئ</option>
                    <option value="INTERMEDIATE">متوسط</option>
                    <option value="ADVANCED">متقدم</option>
                  </select>
                </div>

                <div className="col-6 col-md-2">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    حالة النشر
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'
                      )
                    }
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="PUBLISHED">منشورة</option>
                    <option value="DRAFT">مسودة</option>
                    <option value="PAUSED">متوقفة مؤقتاً</option>
                    <option value="CLOSED">مغلقة</option>
                  </select>
                </div>

                <div className="col-6 col-md-2">
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    حالة التسجيل
                  </label>
                  <select
                    value={enrollmentStatus}
                    onChange={(e) =>
                      setEnrollmentStatus(
                        e.target.value as 'OPEN' | 'PAUSED' | 'CLOSED'
                      )
                    }
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="OPEN">مفتوح</option>
                    <option value="PAUSED">متوقف</option>
                    <option value="CLOSED">مغلق</option>
                  </select>
                </div>
              </div>

              {/* Modules & Lessons Builder */}
              <CourseLessonsEditor
                lessons={lessons}
                onChange={(nextLessons) => setLessons(nextLessons)}
                lessonErrors={lessonErrors}
                sectionError={lessonsSectionError}
              />

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#DCE5F0]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitWithStatus('DRAFT')}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'جارٍ الحفظ...' : 'حفظ كمسودة'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitWithStatus('PUBLISHED')}
                  className="btn-jusoor-primary px-5 py-2 text-xs cursor-pointer disabled:opacity-60"
                >
                  {saving
                    ? 'جارٍ الحفظ...'
                    : editingCourse && status !== 'DRAFT'
                    ? 'حفظ تعديلات الدورة'
                    : 'نشر الدورة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
