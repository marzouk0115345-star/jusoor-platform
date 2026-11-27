import React, { useEffect, useState } from 'react';
import {
  apiFetch,
  formatCurrencyPrice,
  normalizeCourseLessonsOrder,
  validateCoursePublishReadiness,
  type CurriculumOverviewResponse,
  type ProviderCourseItem,
  type ProviderCourseLessonItem,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { StateBanner } from '../ui/StateBanner';
import { CourseImageUploadField } from '../center-dashboard/CourseImageUploadField';
import {
  CourseLessonsEditor,
  createEmptyCourseLesson,
} from './CourseLessonsEditor';

interface CourseEditorModalProps {
  open: boolean;
  initialCourse?: ProviderCourseItem | null;
  onClose: () => void;
  onSaved: (savedCourse: ProviderCourseItem) => Promise<void> | void;
}

const SUGGESTED_FIELD_EXAMPLES = [
  'الأمن السيبراني',
  'تطوير الويب',
  'الذكاء الاصطناعي',
  'الرياضيات المتقدمة',
  'اللغة الإنجليزية',
  'الفيزياء التطبيقية',
];

export function CourseEditorModal({
  open,
  initialCourse = null,
  onClose,
  onSaved,
}: CourseEditorModalProps) {
  const { taxonomy } = useAuth();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [customFieldName, setCustomFieldName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [level, setLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>(
    'BEGINNER'
  );
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('EGP');
  const [maxStudents, setMaxStudents] = useState('');
  const [enrollmentStatus, setEnrollmentStatus] = useState<
    'OPEN' | 'PAUSED' | 'CLOSED'
  >('OPEN');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);

  // Optional Egyptian curriculum / subject linkage
  const [showCurriculum, setShowCurriculum] = useState(false);
  const [curriculum, setCurriculum] =
    useState<CurriculumOverviewResponse | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [stageId, setStageId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [pathwayId, setPathwayId] = useState('');

  // Lessons
  const [lessons, setLessons] = useState<ProviderCourseLessonItem[]>([
    createEmptyCourseLesson(1),
  ]);

  // Submission & validation
  const [savingMode, setSavingMode] = useState<'DRAFT' | 'PUBLISHED' | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lessonErrors, setLessonErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;

    setFormError(null);
    setFieldErrors({});
    setLessonErrors({});

    if (initialCourse) {
      setTitle(initialCourse.title || '');
      setSubtitle(initialCourse.subtitle || '');
      setDescription(initialCourse.description || '');
      setCustomFieldName(
        initialCourse.customFieldName || initialCourse.fieldNameAr || ''
      );
      setTargetAudience(initialCourse.targetAudience || '');
      setLevel(initialCourse.level || 'BEGINNER');
      setPrice(String(Number(initialCourse.price ?? 0)));
      setCurrency(initialCourse.currency || 'EGP');
      setMaxStudents(
        initialCourse.maxStudents ? String(initialCourse.maxStudents) : ''
      );
      setEnrollmentStatus(initialCourse.enrollmentStatus || 'OPEN');
      setThumbnailUrl(initialCourse.thumbnailUrl || null);
      setCoverImageKey(initialCourse.coverImageKey || null);
      setSubjectId(
        initialCourse.subjectId ? String(initialCourse.subjectId) : ''
      );
      setStageId(initialCourse.stageId ? String(initialCourse.stageId) : '');
      setSystemId(initialCourse.systemId ? String(initialCourse.systemId) : '');
      setGradeId(initialCourse.gradeId ? String(initialCourse.gradeId) : '');
      setDivisionId(
        initialCourse.divisionId ? String(initialCourse.divisionId) : ''
      );
      setPathwayId(
        initialCourse.pathwayId ? String(initialCourse.pathwayId) : ''
      );
      setShowCurriculum(
        Boolean(
          initialCourse.subjectId ||
            initialCourse.stageId ||
            initialCourse.gradeId
        )
      );
      setLessons(
        initialCourse.lessons && initialCourse.lessons.length > 0
          ? normalizeCourseLessonsOrder(
              initialCourse.lessons.map((l) => ({
                id: l.id,
                moduleTitle: l.moduleTitle || '',
                title: l.title,
                content: l.content,
                durationMinutes: l.durationMinutes,
                sortOrder: l.sortOrder,
                isFreePreview: Boolean(l.isFreePreview),
              }))
            )
          : [createEmptyCourseLesson(1)]
      );
    } else {
      setTitle('');
      setSubtitle('');
      setDescription('');
      setCustomFieldName('');
      setTargetAudience('');
      setLevel('BEGINNER');
      setPrice('0');
      setCurrency('EGP');
      setMaxStudents('');
      setEnrollmentStatus('OPEN');
      setThumbnailUrl(null);
      setCoverImageKey(null);
      setSubjectId('');
      setStageId('');
      setSystemId('');
      setGradeId('');
      setDivisionId('');
      setPathwayId('');
      setShowCurriculum(false);
      setLessons([createEmptyCourseLesson(1)]);
    }
  }, [open, initialCourse]);

  useEffect(() => {
    if (!open || !showCurriculum || curriculum) return;
    apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview')
      .then((res) => setCurriculum(res))
      .catch(() => {
        // Optional helper
      });
  }, [open, showCurriculum, curriculum]);

  if (!open) return null;

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

  const handleSubmit = async (targetStatus: 'DRAFT' | 'PUBLISHED') => {
    setFormError(null);
    setFieldErrors({});
    setLessonErrors({});

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

    const validation = validateCoursePublishReadiness({
      title,
      description,
      customFieldName,
      lessons: normalizedLessons,
      status: targetStatus,
    });

    if (!validation.valid) {
      setFieldErrors(validation.errors);
      setLessonErrors(validation.lessonErrors);
      const firstErr =
        Object.values(validation.errors)[0] ||
        Object.values(validation.lessonErrors)[0] ||
        'يرجى مراجعة الحقول المطلوبة قبل الحفظ.';
      setFormError(firstErr);
      return;
    }

    setSavingMode(targetStatus);
    try {
      const payload = {
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
        enrollmentStatus,
        status: targetStatus,
        thumbnailUrl,
        coverImageKey,
        ...(initialCourse && thumbnailUrl === null
          ? { removeThumbnail: true }
          : {}),
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

      const res = initialCourse
        ? await apiFetch<{ course: ProviderCourseItem }>(
            `/api/courses/${initialCourse.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            }
          )
        : await apiFetch<{ course: ProviderCourseItem }>('/api/courses', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      await onSaved(res.course);
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'تعذر حفظ الدورة. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setSavingMode(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-editor-modal-title"
    >
      <div className="jusoor-card w-full max-w-4xl p-4 sm:p-6 my-auto max-h-[92vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
          <div>
            <h2
              id="course-editor-modal-title"
              className="font-display text-lg font-bold text-[#102A43] m-0"
            >
              {initialCourse
                ? `تعديل الدورة: ${initialCourse.title}`
                : 'إنشاء دورة تدريبية جديدة'}
            </h2>
            <p className="text-xs text-[#64748B] m-0 mt-0.5">
              ارفع صورة الغلاف، وأدخل المجال يدوياً، وأنشئ دروس الدورة كاملة مع إمكانية الحفظ كمسودة أو النشر الفوري.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-lg text-[#64748B] hover:bg-[#EEF4FA] inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        {formError && (
          <StateBanner
            variant="error"
            message={formError}
            onDismiss={() => setFormError(null)}
          />
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit('PUBLISHED');
          }}
          className="space-y-5"
        >
          {/* Section 1: Cover Image */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#0F766E]">
              1. صورة غلاف الدورة
            </div>
            <CourseImageUploadField
              courseId={initialCourse?.id ?? null}
              mode="course"
              value={thumbnailUrl}
              fallbackTitle={title || 'غلاف الدورة التدريبية'}
              onChange={({ url, coverImageKey: nextKey }) => {
                setThumbnailUrl(url);
                if (nextKey !== undefined) {
                  setCoverImageKey(nextKey);
                }
              }}
              onRemoveExisting={
                initialCourse
                  ? async () => {
                      await apiFetch(
                        `/api/courses/${initialCourse.id}/cover-image`,
                        { method: 'DELETE' }
                      );
                    }
                  : undefined
              }
            />
          </div>

          {/* Section 2: Course Info & Manual Field Input */}
          <div className="space-y-3 pt-2 border-t border-[#EDF2F7]">
            <div className="text-xs font-bold text-[#0F766E]">
              2. المعلومات الأساسية والمجال التعليمي
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-7">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  عنوان الدورة *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="course-title-input"
                  placeholder="مثال: مسار أساسيات الأمن السيبراني وتطبيقاته"
                  className={`jusoor-input w-full px-3 py-2 text-sm ${
                    fieldErrors.title ? 'border-[#FCA5A5]' : ''
                  }`}
                />
                {fieldErrors.title && (
                  <p className="text-[11px] text-[#991B1B] mt-1 mb-0">
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              <div className="col-12 col-md-5">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  المجال / التخصص التعليمي (كتابة يدوية) *
                </label>
                <input
                  type="text"
                  value={customFieldName}
                  onChange={(e) => setCustomFieldName(e.target.value)}
                  data-testid="course-manual-field-input"
                  placeholder="مثال: الأمن السيبراني، تطوير الويب، AI & Systems"
                  className={`jusoor-input w-full px-3 py-2 text-sm ${
                    fieldErrors.customFieldName ? 'border-[#FCA5A5]' : ''
                  }`}
                />
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[10px] text-[#64748B]">اقتراحات سريعة:</span>
                  {SUGGESTED_FIELD_EXAMPLES.slice(0, 4).map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setCustomFieldName(example)}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] cursor-pointer"
                    >
                      {example}
                    </button>
                  ))}
                </div>
                {fieldErrors.customFieldName && (
                  <p className="text-[11px] text-[#991B1B] mt-1 mb-0">
                    {fieldErrors.customFieldName}
                  </p>
                )}
              </div>

              <div className="col-12 col-md-6">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  عنوان فرعي مختصر (اختياري)
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  data-testid="course-subtitle-input"
                  placeholder="ملخص سريع يظهر في بطاقة الدورة (يُستخرج تلقائياً إن تُرك فارغاً)"
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
                  data-testid="course-target-audience-input"
                  placeholder="مثال: طلاب الثانوية، المبتدئون في البرمجة، مهندسو الشبكات"
                  className="jusoor-input w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="col-12">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  الوصف الكامل وأهداف الدورة *
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="course-description-input"
                  placeholder="اشرح ماذا سيتعلم الطالب في هذه الدورة، والمتطلبات المسبقة، والمخرجات العملية..."
                  className={`jusoor-textarea w-full px-3 py-2 text-sm ${
                    fieldErrors.description ? 'border-[#FCA5A5]' : ''
                  }`}
                />
                {fieldErrors.description && (
                  <p className="text-[11px] text-[#991B1B] mt-1 mb-0">
                    {fieldErrors.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Pricing, Level & Optional Curriculum Link */}
          <div className="space-y-3 pt-2 border-t border-[#EDF2F7]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#0F766E]">
                3. التسعير والمستوى والتصنيف الدراسي
              </div>
              <button
                type="button"
                onClick={() => setShowCurriculum((v) => !v)}
                className="text-[11px] font-semibold text-[#247BA0] hover:underline cursor-pointer"
              >
                {showCurriculum
                  ? 'إخفاء ربط المنهج الدراسي المصري'
                  : '+ ربط الدورة بمرحلة/صف دراسي (اختياري)'}
              </button>
            </div>

            <div className="row g-2.5">
              <div className="col-6 col-md-3">
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

              <div className="col-6 col-md-3">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  السعر (0 للمجانية)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  data-testid="course-price-input"
                  className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                />
              </div>

              <div className="col-4 col-md-2">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  العملة
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="jusoor-select w-full px-2.5 py-2 text-sm"
                >
                  <option value="EGP">EGP (ج.م)</option>
                  <option value="SAR">SAR (ر.س)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="col-4 col-md-2">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  أقصى عدد طلاب
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(e.target.value)}
                  placeholder="مفتوح"
                  className="jusoor-input w-full px-2.5 py-2 text-sm font-mono-num"
                />
              </div>

              <div className="col-4 col-md-2">
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  التسجيل
                </label>
                <select
                  value={enrollmentStatus}
                  onChange={(e) =>
                    setEnrollmentStatus(
                      e.target.value as 'OPEN' | 'PAUSED' | 'CLOSED'
                    )
                  }
                  className="jusoor-select w-full px-2.5 py-2 text-sm"
                >
                  <option value="OPEN">مفتوح</option>
                  <option value="PAUSED">متوقف مؤقتاً</option>
                  <option value="CLOSED">مغلق</option>
                </select>
              </div>
            </div>

            {showCurriculum && (
              <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#DCE5F0] row g-2.5">
                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                    المادة الدراسية
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="jusoor-select w-full px-2.5 py-1.5 text-xs sm:text-sm"
                  >
                    <option value="">غير محدد</option>
                    {taxonomy?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-[11px] font-bold text-[#102A43] mb-1">
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
                    className="jusoor-select w-full px-2.5 py-1.5 text-xs sm:text-sm"
                  >
                    <option value="">كل المراحل / غير محدد</option>
                    {(curriculum?.stages || taxonomy?.stages || []).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-sm-6 col-md-4">
                  <label className="block text-[11px] font-bold text-[#102A43] mb-1">
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
                    className="jusoor-select w-full px-2.5 py-1.5 text-xs sm:text-sm"
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
                  <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                    الصف الدراسي
                  </label>
                  <select
                    value={gradeId}
                    onChange={(e) => {
                      setGradeId(e.target.value);
                      setDivisionId('');
                      setPathwayId('');
                    }}
                    className="jusoor-select w-full px-2.5 py-1.5 text-xs sm:text-sm"
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
                    <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                      الشعبة (الثانوية العامة)
                    </label>
                    <select
                      value={divisionId}
                      onChange={(e) => setDivisionId(e.target.value)}
                      className="jusoor-select w-full px-2.5 py-1.5 text-xs sm:text-sm"
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
                    <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                      المسار (البكالوريا)
                    </label>
                    <select
                      value={pathwayId}
                      onChange={(e) => setPathwayId(e.target.value)}
                      className="jusoor-select w-full px-2.5 py-1.5 text-xs sm:text-sm"
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
              </div>
            )}
          </div>

          {/* Section 4: Multiple Lessons Builder */}
          <div className="space-y-2 pt-2 border-t border-[#EDF2F7]">
            <div className="text-xs font-bold text-[#0F766E]">
              4. بناء محتوى الدورة والدروس
            </div>
            <CourseLessonsEditor
              lessons={lessons}
              onChange={setLessons}
              lessonErrors={lessonErrors}
              sectionError={fieldErrors.lessons}
            />
          </div>

          {/* Review Summary + Footer Actions */}
          <div className="p-3 rounded-xl bg-[#F8FBFF] border border-[#DCE5F0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#172B4D]">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <strong>المجال:</strong>{' '}
                {customFieldName.trim() || 'لم يُدخل بعد'}
              </span>
              <span>·</span>
              <span>
                <strong>الدروس:</strong> {lessons.length}
              </span>
              <span>·</span>
              <span>
                <strong>السعر:</strong>{' '}
                {formatCurrencyPrice(price || 0, currency)}
              </span>
              <span>·</span>
              <span>
                <strong>الغلاف:</strong>{' '}
                {thumbnailUrl ? 'صورة مرفوعة' : 'غلاف افتراضي'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#DCE5F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={savingMode !== null}
              className="btn-jusoor-outline px-4 py-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={savingMode !== null}
              onClick={() => void handleSubmit('DRAFT')}
              data-testid="save-course-draft-btn"
              className="btn-jusoor-outline px-4 py-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
            >
              {savingMode === 'DRAFT' ? 'جارٍ الحفظ...' : 'حفظ كمسودة'}
            </button>
            <button
              type="submit"
              disabled={savingMode !== null}
              data-testid="publish-course-btn"
              className="btn-jusoor-primary px-5 py-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
            >
              {savingMode === 'PUBLISHED' ? 'جارٍ النشر...' : 'نشر الدورة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
