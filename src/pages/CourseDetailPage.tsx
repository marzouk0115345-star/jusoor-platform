import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Lock, PlayCircle, Award, Star, AlertCircle } from 'lucide-react';
import { apiFetch, LEVEL_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { TeacherSessionsBookingSection } from '../components/TeacherSessionsBookingSection';

interface CourseDetailResponse {
  course: {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    level: string;
    price: string;
    thumbnailUrl: string | null;
    instructorId: number;
    instructorName: string;
    fieldNameAr: string;
    subjectId: number | null;
    stageId: number | null;
  };
  lessons: Array<{
    id: number;
    title: string;
    durationMinutes: number;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-slate-700 font-semibold">{error || 'الدورة غير متوفرة'}</p>
        <Link to="/courses" className="text-teal-700 text-sm underline">
          العودة إلى الدورات
        </Link>
      </div>
    );
  }

  const activeLesson =
    data.lessons.find((l) => l.id === activeLessonId) || data.lessons[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-4">
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
            <span>{data.course.fieldNameAr}</span>
            <span aria-hidden="true">·</span>
            <span>{LEVEL_LABELS_AR[data.course.level] || data.course.level}</span>
            <span aria-hidden="true">·</span>
            <span>
              المدرّب:{' '}
              <Link
                to={`/instructors/${data.course.instructorId}`}
                className="font-semibold text-teal-700 hover:underline"
              >
                {data.course.instructorName}
              </Link>
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            {data.course.title}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {data.course.description}
          </p>

          {data.progress && (
            <div className="pt-2 space-y-1.5 max-w-md">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>تقدمك في الدورة</span>
                <span className="font-mono-num">
                  {data.progress.completionPercent}% ({data.progress.completedLessonsCount}/
                  {data.progress.totalLessonsCount})
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-700 transition-all"
                  style={{ width: `${data.progress.completionPercent}%` }}
                />
              </div>
            </div>
          )}

          {!data.enrollment ? (
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleEnroll}
                className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                {Number(data.course.price) === 0
                  ? 'التسجيل المجاني في الدورة'
                  : `التسجيل في الدورة ($${data.course.price})`}
              </button>
              <span className="text-xs text-slate-500">
                {Number(data.course.price) > 0 &&
                  'تُسجل المعاملة المالية في سجل الدفع التجريبي (Sandbox)'}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
              <Award className="w-4 h-4" />
              <span>أنت مسجل في هذه الدورة</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 aspect-[4/3] rounded-xl overflow-hidden border border-slate-200">
          <SafeImage
            src={data.course.thumbnailUrl}
            alt={data.course.title}
            fallbackTitle={data.course.title}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Curriculum + Lesson Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-lg font-bold text-slate-900">
            منهج الدورة ({data.lessons.length} دروس)
          </h2>
          <div className="divide-y divide-slate-100">
            {data.lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setActiveLessonId(lesson.id)}
                className={`w-full text-right py-3 px-3 rounded-lg transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                  activeLesson?.id === lesson.id
                    ? 'bg-teal-50/70 text-teal-900'
                    : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {lesson.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  ) : lesson.unlocked ? (
                    <PlayCircle className="w-4 h-4 text-slate-600 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate">
                    {lesson.title}
                  </span>
                </div>
                <span className="text-xs font-mono-num text-slate-500 shrink-0">
                  {lesson.durationMinutes} د
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {activeLesson ? (
            <>
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {activeLesson.title}
                </h2>
                <span className="text-xs font-mono-num text-slate-500">
                  {activeLesson.durationMinutes} دقيقة
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {activeLesson.content}
              </p>
              {data.enrollment && activeLesson.unlocked && (
                <div className="pt-3">
                  <button
                    type="button"
                    disabled={activeLesson.completed}
                    onClick={() => handleCompleteLesson(activeLesson.id)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
                      activeLesson.completed
                        ? 'bg-slate-100 text-slate-600 cursor-default'
                        : 'bg-teal-700 hover:bg-teal-800 text-white'
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
            <p className="text-sm text-slate-500">اختر درساً للعرض.</p>
          )}
        </div>
      </div>

      {/* Quizzes & Assignments for Enrolled Students */}
      {data.enrollment && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {quiz.title}
                </h3>
                <span className="text-xs font-mono-num text-slate-500">
                  النجاح: {quiz.passingScore}%
                </span>
              </div>
              {quiz.questions.map((q) => (
                <div key={q.id} className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-sm font-semibold text-slate-800">
                    {q.questionText}
                  </div>
                  <div className="space-y-1.5">
                    {q.answers.map((ans) => (
                      <label
                        key={ans.id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
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
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                إرسال الإجابات والتصحيح التلقائي
              </button>

              {quiz.attempts.length > 0 && (
                <div className="pt-2 text-xs text-slate-600">
                  آخر محاولة: {quiz.attempts[0].score} / {quiz.attempts[0].maxScore} (
                  {quiz.attempts[0].passed ? 'ناجح' : 'حاول مجدداً'})
                </div>
              )}
            </div>
          ))}

          {data.assignments.map((assign) => (
            <div
              key={assign.id}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h3 className="font-display text-lg font-bold text-slate-900">
                {assign.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  تسليم التكليف
                </button>
              </form>
              {assign.submissions.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                  تم التسليم ({assign.submissions.length}) — الحالة:{' '}
                  {assign.submissions[0].status}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Instructor Live Individual & Group Sessions */}
      <TeacherSessionsBookingSection
        teacherId={data.course.instructorId}
        showTeacherName={false}
        title="جلسات فردية وجماعية مباشرة مع مدرّب الدورة"
        subtitle="احجز جلسة فردية (1:1) أو انضم إلى ورشة جماعية لتطبيق مفاهيم هذه الدورة مباشرة مع المدرّب."
      />

      {/* Course Reviews */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-slate-900">
          تقييمات المتعلّمين ({data.reviews.length})
        </h3>
        {data.reviews.length > 0 && (
          <div className="divide-y divide-slate-100">
            {data.reviews.map((rev) => (
              <div key={rev.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    {rev.authorName}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 font-mono-num">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                    {rev.rating}/5
                  </span>
                </div>
                <p className="text-sm text-slate-700">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}

        {user && (
          <form
            onSubmit={handleSubmitReview}
            className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3"
          >
            <select
              value={reviewRating}
              onChange={(e) => setReviewRating(Number(e.target.value))}
              aria-label="التقييم"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
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
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              إرسال التقييم
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
