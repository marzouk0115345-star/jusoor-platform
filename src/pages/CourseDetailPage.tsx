import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  apiFetch,
  COURSE_STATUS_LABELS_AR,
  formatArabicLessonOrdinal,
  formatCurrencyPrice,
  LEVEL_LABELS_AR,
  type ProviderCourseItem,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { TeacherSessionsBookingSection } from '../components/TeacherSessionsBookingSection';
import { FormattedLessonContent } from '../components/courses/FormattedLessonContent';
import { CourseEditorModal } from '../components/courses/CourseEditorModal';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface CourseDetailResponse {
  course: {
    id: number;
    title: string;
    slug?: string;
    subtitle: string;
    description: string;
    level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    language?: string;
    price: string;
    currency?: string;
    thumbnailUrl: string | null;
    coverImageKey?: string | null;
    status?: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
    instructorId: number;
    instructorName: string;
    instructorAvatarUrl?: string | null;
    instructorHeadline?: string | null;
    fieldId?: number;
    fieldNameAr: string;
    customFieldName?: string | null;
    targetAudience?: string | null;
    subjectId: number | null;
    subjectNameAr?: string | null;
    stageId: number | null;
    stageNameAr?: string | null;
    systemId?: number | null;
    systemNameAr?: string | null;
    gradeId?: number | null;
    gradeNameAr?: string | null;
    divisionId?: number | null;
    divisionNameAr?: string | null;
    pathwayId?: number | null;
    pathwayNameAr?: string | null;
    centerId?: number | null;
    centerName?: string | null;
    maxStudents?: number | null;
    enrollmentStatus?: 'OPEN' | 'PAUSED' | 'CLOSED' | null;
    enrollmentsCount?: number;
    canManage?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
  lessons: Array<{
    id: number;
    moduleTitle?: string | null;
    title: string;
    durationMinutes: number;
    sortOrder?: number;
    isFreePreview: boolean;
    unlocked: boolean;
    content: string;
    completed: boolean;
  }>;
  enrollment: { id: number; status: string } | null;
  progress: {
    completedLessonsCount: number;
    totalLessonsCount: number;
    completionPercent: number;
  } | null;
  quizzes: Array<{
    id: number;
    title: string;
    description: string | null;
    passingScore: number;
    questions: Array<{
      id: number;
      questionText: string;
      points: number;
      answers: Array<{ id: number; answerText: string }>;
    }>;
    attempts: Array<{
      id: number;
      score: number;
      maxScore: number;
      passed: boolean;
    }>;
  }>;
  assignments: Array<{
    id: number;
    title: string;
    instructions: string;
    maxScore: number;
    dueDate: string | null;
    submissions: Array<{
      id: number;
      submissionText: string;
      status: string;
      score: number | null;
      feedback: string | null;
    }>;
  }>;
  reviews: Array<{
    id: number;
    rating: number;
    comment: string;
    authorName: string;
  }>;
}

export function CourseDetailPage() {
  const { id } = useParams();
  const { user, openAuthModal } = useAuth();
  const [data, setData] = useState<CourseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quizSelection, setQuizSelection] = useState<Record<number, number>>({});
  const [assignmentText, setAssignmentText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const loadCourse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CourseDetailResponse>(`/api/courses/${id}`);
      setData(res);
      if (res.lessons.length > 0 && !activeLessonId) {
        setActiveLessonId(res.lessons[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الدورة');
    } finally {
      setLoading(false);
    }
  }, [id, activeLessonId]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const handleEnroll = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/courses/${id}/enroll`, { method: 'POST' });
      setFeedback(
        Number(data?.course.price || 0) > 0
          ? 'تم تسجيلك في الدورة وإنشاء سجل معاملة مالية في وضع التجربة (Sandbox).'
          : 'تم تسجيلك في الدورة بنجاح!'
      );
      await loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التسجيل');
    }
  };

  const handleCompleteLesson = async (lessonId: number) => {
    setError(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        progress: { completionPercent: number };
      }>(`/api/courses/${id}/lessons/${lessonId}/complete`, { method: 'POST' });
      setFeedback(
        `تم تسجيل إتمام الدرس. نسبة التقدم الحالية: ${res.progress.completionPercent}%`
      );
      await loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث التقدم');
    }
  };

  const handleSubmitQuiz = async (quizId: number) => {
    const answers = Object.entries(quizSelection).map(([qId, ansId]) => ({
      questionId: Number(qId),
      selectedAnswerId: Number(ansId),
    }));
    if (answers.length === 0) {
      setError('يرجى اختيار إجابة واحدة على الأقل.');
      return;
    }
    setError(null);
    try {
      const res = await apiFetch<{
        percentage: number;
        passed: boolean;
      }>(`/api/quizzes/${quizId}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setFeedback(
        `تم تصحيح الاختبار: نتيجتك ${res.percentage}% (${
          res.passed ? 'ناجح' : 'لم تجتز بعد'
        })`
      );
      await loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تصحيح الاختبار');
    }
  };

  const handleSubmitAssignment = async (
    e: React.FormEvent,
    assignmentId: number
  ) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submissionText: assignmentText }),
      });
      setAssignmentText('');
      setFeedback('تم تسليم التكليف العملي بنجاح.');
      await loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسليم التكليف');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/courses/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      setReviewComment('');
      setFeedback('تم نشر تقييمك للدورة.');
      await loadCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال التقييم');
    }
  };

  if (loading) {
    return (
      <div className="container-xxl px-3 px-sm-4 py-5">
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container-xxl px-3 px-sm-4 py-5">
        <EmptyState
          icon="bi-book"
          title={error || 'الدورة غير متوفرة'}
          action={
            <Link to="/courses" className="btn-jusoor-primary px-4 py-2 text-xs">
              العودة إلى الدورات
            </Link>
          }
        />
      </div>
    );
  }

  const activeLessonIndex = data.lessons.findIndex(
    (l) => l.id === (activeLessonId ?? data.lessons[0]?.id)
  );
  const resolvedLessonIndex = activeLessonIndex >= 0 ? activeLessonIndex : 0;
  const activeLesson = data.lessons[resolvedLessonIndex] || data.lessons[0];

  const editableCoursePayload: ProviderCourseItem | null = data.course.canManage
    ? {
        id: data.course.id,
        title: data.course.title,
        slug: data.course.slug || '',
        subtitle: data.course.subtitle,
        description: data.course.description,
        customFieldName: data.course.customFieldName || data.course.fieldNameAr,
        fieldNameAr: data.course.fieldNameAr,
        targetAudience: data.course.targetAudience || '',
        fieldId: data.course.fieldId || 1,
        subjectId: data.course.subjectId,
        subjectNameAr: data.course.subjectNameAr,
        stageId: data.course.stageId,
        stageNameAr: data.course.stageNameAr,
        systemId: data.course.systemId ?? null,
        gradeId: data.course.gradeId ?? null,
        gradeNameAr: data.course.gradeNameAr,
        divisionId: data.course.divisionId ?? null,
        pathwayId: data.course.pathwayId ?? null,
        level: data.course.level,
        language: data.course.language || 'ar',
        price: data.course.price,
        currency: data.course.currency || 'EGP',
        maxStudents: data.course.maxStudents ?? null,
        enrollmentStatus: data.course.enrollmentStatus || 'OPEN',
        thumbnailUrl: data.course.thumbnailUrl,
        coverImageKey: data.course.coverImageKey ?? null,
        status: data.course.status || 'PUBLISHED',
        centerId: data.course.centerId ?? null,
        instructorId: data.course.instructorId,
        instructorName: data.course.instructorName,
        createdAt: data.course.createdAt || '',
        updatedAt: data.course.updatedAt || '',
        lessons: data.lessons.map((l, idx) => ({
          id: l.id,
          moduleTitle: l.moduleTitle || '',
          title: l.title,
          content: l.content,
          durationMinutes: l.durationMinutes,
          sortOrder: l.sortOrder ?? idx + 1,
          isFreePreview: l.isFreePreview,
        })),
        lessonsCount: data.lessons.length,
        enrollmentsCount: data.course.enrollmentsCount ?? 0,
      }
    : null;

  const educationalClassification = [
    data.course.subjectNameAr,
    data.course.stageNameAr,
    data.course.systemNameAr,
    data.course.gradeNameAr,
    data.course.divisionNameAr,
    data.course.pathwayNameAr,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'الرئيسية', to: '/' },
          { label: 'الدورات', to: '/courses' },
          { label: data.course.title },
        ]}
        kicker={`${data.course.fieldNameAr} · ${
          LEVEL_LABELS_AR[data.course.level] || data.course.level
        }`}
        title={data.course.title}
        subtitle={data.course.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.course.canManage && (
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                data-testid="course-detail-edit-btn"
                className="btn-jusoor-primary px-4 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                <span>تعديل الدورة والدروس</span>
              </button>
            )}
            <Link
              to={`/instructors/${data.course.instructorId}`}
              className="btn-jusoor-outline px-4 py-2 text-xs inline-flex items-center gap-2"
            >
              <i className="bi bi-person-badge text-[#0F766E]" aria-hidden="true" />
              <span>المدرّب: {data.course.instructorName}</span>
            </Link>
          </div>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
        {data.course.status && data.course.status !== 'PUBLISHED' && (
          <StateBanner
            variant="warning"
            message={`حالة هذه الدورة حالياً: ${
              COURSE_STATUS_LABELS_AR[data.course.status] || data.course.status
            } — تظهر لك فقط بصفتك مالك/مدير الدورة ولا تظهر للجمهور حتى يتم نشرها.`}
          />
        )}

        {/* Course Summary & Enrollment Card */}
        <div className="jusoor-card p-4 sm:p-6">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-lg-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-[#E8F8F5] text-[#0F766E] font-bold">
                  المجال: {data.course.fieldNameAr}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#EEF4FA] text-[#102A43] font-semibold">
                  المستوى: {LEVEL_LABELS_AR[data.course.level] || data.course.level}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#F8FBFF] border border-[#DCE5F0] text-[#102A43] font-mono-num font-bold">
                  {formatCurrencyPrice(
                    data.course.price,
                    data.course.currency || 'USD'
                  )}
                </span>
                {data.course.centerName && (
                  <span className="px-2.5 py-1 rounded-md bg-[#F8FBFF] border border-[#DCE5F0] text-[#64748B] font-semibold">
                    {data.course.centerName}
                  </span>
                )}
              </div>

              <p className="text-sm text-[#172B4D] leading-relaxed whitespace-pre-line m-0">
                {data.course.description}
              </p>

              {data.course.targetAudience && (
                <div className="text-xs text-[#172B4D] bg-[#F8FBFF] border border-[#DCE5F0] rounded-lg px-3 py-2 flex items-start gap-2">
                  <i
                    className="bi bi-people-fill text-[#247BA0] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>الفئة المستهدفة:</strong> {data.course.targetAudience}
                  </span>
                </div>
              )}

              {educationalClassification.length > 0 && (
                <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-[#102A43]">
                    التصنيف الدراسي:
                  </span>
                  {educationalClassification.map((part, idx) => (
                    <React.Fragment key={`${part}-${idx}`}>
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {data.progress && (
                <div className="space-y-1.5 max-w-md">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#102A43]">
                    <span>تقدمك في الدورة</span>
                    <span className="font-mono-num">
                      {data.progress.completionPercent}% (
                      {data.progress.completedLessonsCount}/
                      {data.progress.totalLessonsCount})
                    </span>
                  </div>
                  <div className="h-2 bg-[#EEF4FA] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#20B8A6] transition-all"
                      style={{ width: `${data.progress.completionPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {!data.enrollment ? (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {data.course.enrollmentStatus === 'PAUSED' ||
                  data.course.enrollmentStatus === 'CLOSED' ||
                  (data.course.maxStudents &&
                    (data.course.enrollmentsCount ?? 0) >= data.course.maxStudents) ? (
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#92400E] bg-[#FFFBEB] px-3.5 py-2 rounded-lg border border-[#FDE68A]">
                      <i className="bi bi-pause-circle-fill" aria-hidden="true" />
                      <span>
                        {data.course.enrollmentStatus === 'PAUSED'
                          ? 'التسجيل متوقف مؤقتاً لهذه الدورة'
                          : data.course.enrollmentStatus === 'CLOSED'
                          ? 'التسجيل مغلق لهذه الدورة'
                          : 'اكتمل الحد الأقصى للطلاب في هذه الدورة'}
                      </span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleEnroll}
                        className="btn-jusoor-primary px-5 py-2.5 text-sm cursor-pointer"
                      >
                        {Number(data.course.price) === 0
                          ? 'التسجيل المجاني في الدورة'
                          : `التسجيل في الدورة (${formatCurrencyPrice(
                              data.course.price,
                              data.course.currency || 'USD'
                            )})`}
                      </button>
                      {Number(data.course.price) > 0 && (
                        <span className="text-xs text-[#64748B]">
                          تُسجل المعاملة المالية في سجل الدفع التجريبي (Sandbox)
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0F766E] bg-[#E8F8F5] px-3.5 py-2 rounded-lg border border-[#99E2D8]">
                  <i className="bi bi-award-fill" aria-hidden="true" />
                  <span>أنت مسجل في هذه الدورة</span>
                </div>
              )}
            </div>

            <div className="col-12 col-lg-4">
              <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#DCE5F0]">
                <SafeImage
                  src={data.course.thumbnailUrl}
                  alt={data.course.title}
                  fallbackTitle={data.course.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
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

        {/* Curriculum + Lesson Viewer */}
        <div className="row g-4">
          <div className="col-12 col-lg-5">
            <div className="jusoor-card p-4 sm:p-5 h-full space-y-3">
              <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                محتوى الدورة ({data.lessons.length} دروس)
              </h2>
              {data.lessons.length === 0 ? (
                <p className="text-xs text-[#64748B] m-0">
                  لم تُضف دروس لهذه الدورة بعد.
                </p>
              ) : (
                <div className="divide-y divide-[#EDF2F7]">
                  {data.lessons.map((lesson, idx) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setActiveLessonId(lesson.id)}
                      data-testid={`course-detail-lesson-btn-${idx}`}
                      className={`w-full text-start py-3 px-3 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        activeLesson?.id === lesson.id
                          ? 'bg-[#E8F8F5] text-[#0B4F4A]'
                          : 'hover:bg-[#F5F8FC] text-[#172B4D]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <i
                          className={`bi ${
                            lesson.completed
                              ? 'bi-check-circle-fill text-[#0F766E]'
                              : lesson.unlocked
                              ? 'bi-play-circle text-[#247BA0]'
                              : 'bi-lock text-[#64748B]'
                          } shrink-0`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#0F766E]">
                              {formatArabicLessonOrdinal(idx)}
                            </span>
                            {lesson.moduleTitle && (
                              <span className="text-[10px] font-bold text-[#247BA0] truncate">
                                · {lesson.moduleTitle}
                              </span>
                            )}
                            {lesson.isFreePreview && !data.enrollment && (
                              <span className="text-[10px] font-semibold text-[#0F766E] bg-[#E8F8F5] px-1.5 py-0.5 rounded">
                                معاينة مجانية
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-semibold truncate block">
                            {lesson.title}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono-num text-[#64748B] shrink-0">
                        {lesson.durationMinutes} د
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="jusoor-card p-4 sm:p-6 h-full space-y-4">
              {activeLesson ? (
                <>
                  <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#EDF2F7]">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-[#0F766E]">
                        {formatArabicLessonOrdinal(resolvedLessonIndex)}
                        {activeLesson.moduleTitle
                          ? ` — ${activeLesson.moduleTitle}`
                          : ''}
                      </div>
                      <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                        {activeLesson.title}
                      </h2>
                    </div>
                    <span className="text-xs font-mono-num text-[#64748B] shrink-0">
                      {activeLesson.durationMinutes} دقيقة
                    </span>
                  </div>

                  <FormattedLessonContent content={activeLesson.content} />

                  {data.enrollment && activeLesson.unlocked && (
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={activeLesson.completed}
                        onClick={() => handleCompleteLesson(activeLesson.id)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg ${
                          activeLesson.completed
                            ? 'bg-[#EEF4FA] text-[#64748B] cursor-default'
                            : 'btn-jusoor-primary cursor-pointer'
                        }`}
                      >
                        {activeLesson.completed
                          ? 'تم إتمام هذا الدرس'
                          : 'تحديد الدرس كمكتمل'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[#64748B] m-0">اختر درساً للعرض.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quizzes & Assignments */}
        {data.enrollment && (
          <div className="row g-4">
            {data.quizzes.map((quiz) => (
              <div key={quiz.id} className="col-12 col-lg-6">
                <div className="jusoor-card p-5 space-y-4 h-full">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                      {quiz.title}
                    </h3>
                    <span className="text-xs font-mono-num text-[#64748B]">
                      النجاح: {quiz.passingScore}%
                    </span>
                  </div>
                  {quiz.questions.map((q) => (
                    <div
                      key={q.id}
                      className="space-y-2 pt-2 border-t border-[#EDF2F7]"
                    >
                      <div className="text-sm font-semibold text-[#102A43]">
                        {q.questionText}
                      </div>
                      <div className="space-y-1.5">
                        {q.answers.map((ans) => (
                          <label
                            key={ans.id}
                            className="flex items-center gap-2 text-xs text-[#172B4D] cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={quizSelection[q.id] === ans.id}
                              onChange={() =>
                                setQuizSelection((prev) => ({
                                  ...prev,
                                  [q.id]: ans.id,
                                }))
                              }
                            />
                            <span>{ans.answerText}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSubmitQuiz(quiz.id)}
                    className="btn-jusoor-navy px-4 py-2 text-xs cursor-pointer"
                  >
                    إرسال الإجابات والتصحيح التلقائي
                  </button>

                  {quiz.attempts.length > 0 && (
                    <div className="pt-2 text-xs text-[#64748B]">
                      آخر محاولة: {quiz.attempts[0].score} /{' '}
                      {quiz.attempts[0].maxScore} (
                      {quiz.attempts[0].passed ? 'ناجح' : 'حاول مجدداً'})
                    </div>
                  )}
                </div>
              </div>
            ))}

            {data.assignments.map((assign) => (
              <div key={assign.id} className="col-12 col-lg-6">
                <div className="jusoor-card p-5 space-y-4 h-full">
                  <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                    {assign.title}
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed m-0">
                    {assign.instructions}
                  </p>
                  <form
                    onSubmit={(e) => handleSubmitAssignment(e, assign.id)}
                    className="space-y-3"
                  >
                    <textarea
                      required
                      rows={3}
                      value={assignmentText}
                      onChange={(e) => setAssignmentText(e.target.value)}
                      placeholder="اكتب حل التكليف أو رابط المشروع التطبيقي..."
                      className="jusoor-textarea w-full px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
                    >
                      تسليم التكليف
                    </button>
                  </form>
                  {assign.submissions.length > 0 && (
                    <div className="pt-2 border-t border-[#EDF2F7] text-xs text-[#64748B]">
                      تم التسليم ({assign.submissions.length}) — الحالة:{' '}
                      {assign.submissions[0].status}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructor Live Sessions */}
        <TeacherSessionsBookingSection
          teacherId={data.course.instructorId}
          showTeacherName={false}
          title="جلسات فردية وجماعية مباشرة مع مدرّب الدورة"
          subtitle="احجز جلسة فردية (1:1) أو انضم إلى ورشة جماعية لتطبيق مفاهيم هذه الدورة مباشرة مع المدرّب."
        />

        {/* Course Reviews */}
        <div className="jusoor-card p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
            تقييمات المتعلّمين ({data.reviews.length})
          </h3>
          {data.reviews.length > 0 ? (
            <div className="divide-y divide-[#EDF2F7]">
              {data.reviews.map((rev) => (
                <div key={rev.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#102A43]">
                      {rev.authorName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#B45309] font-mono-num font-bold">
                      <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                      {rev.rating}/5
                    </span>
                  </div>
                  <p className="text-sm text-[#172B4D] m-0">{rev.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#64748B] m-0">
              لا توجد تقييمات لهذه الدورة بعد.
            </p>
          )}

          {user && (
            <form
              onSubmit={handleSubmitReview}
              className="pt-4 border-t border-[#DCE5F0] flex flex-col sm:flex-row gap-3"
            >
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                aria-label="التقييم"
                className="jusoor-select px-3 py-2 text-sm"
              >
                <option value={5}>5 نجوم</option>
                <option value={4}>4 نجوم</option>
                <option value={3}>3 نجوم</option>
                <option value={2}>نجمتان</option>
                <option value={1}>نجمة واحدة</option>
              </select>
              <input
                type="text"
                required
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="شارك تجربتك في هذه الدورة..."
                className="jusoor-input flex-1 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="btn-jusoor-navy px-4 py-2 text-sm cursor-pointer whitespace-nowrap"
              >
                إرسال التقييم
              </button>
            </form>
          )}
        </div>
      </div>

      {editableCoursePayload && (
        <CourseEditorModal
          open={editModalOpen}
          initialCourse={editableCoursePayload}
          onClose={() => setEditModalOpen(false)}
          onSaved={async () => {
            setFeedback('تم حفظ تعديلات الدورة والمحتوى بنجاح.');
            await loadCourse();
          }}
        />
      )}
    </div>
  );
}
