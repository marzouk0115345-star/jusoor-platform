import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, AlertCircle, Star, MessageSquare } from 'lucide-react';
import { apiFetch, TASK_STATUS_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface TaskDetailData {
  task: {
    id: number;
    studentUserId: number;
    studentName: string;
    categoryNameAr: string;
    fieldNameAr: string;
    title: string;
    description: string;
    requiredSkills: string;
    budget: string;
    expectedDuration: string;
    preferredMethod: string;
    deadline: string;
    status: string;
    acceptedOfferId: number | null;
  };
  offers: Array<{
    id: number;
    teacherUserId: number;
    teacherName: string;
    proposal: string;
    proposedPrice: string;
    expectedDuration: string;
    deliveryMethod: string;
    additionalNotes: string | null;
    status: string;
    providerHeadline: string | null;
    providerRating: string | null;
    providerVerified: string | null;
  }>;
  deliverables: Array<{
    id: number;
    summary: string;
    deliverableUrl: string | null;
    submittedByName: string;
    createdAt: string;
  }>;
  history: Array<{
    id: number;
    fromStatus: string;
    toStatus: string;
    note: string | null;
    changedByName: string;
    createdAt: string;
  }>;
}

const LIFECYCLE_STEPS = [
  { code: 'OPEN', label: 'مفتوحة' },
  { code: 'OFFERS_RECEIVED', label: 'استلام العروض' },
  { code: 'OFFER_ACCEPTED', label: 'قبول عرض' },
  { code: 'IN_PROGRESS', label: 'قيد التنفيذ' },
  { code: 'DELIVERED', label: 'التسليم' },
  { code: 'COMPLETED', label: 'مكتملة' },
];

export function TaskDetailPage() {
  const { id } = useParams();
  const { user, openAuthModal } = useAuth();
  const [data, setData] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Offer submission form
  const [proposal, setProposal] = useState('');
  const [proposedPrice, setProposedPrice] = useState('40');
  const [offerDuration, setOfferDuration] = useState('جلستان');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Deliverable & review
  const [deliverableSummary, setDeliverableSummary] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<TaskDetailData>(`/api/tasks/${id}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المهمة');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/tasks/${id}/offers`, {
        method: 'POST',
        body: JSON.stringify({
          proposal,
          proposedPrice: Number(proposedPrice),
          expectedDuration: offerDuration,
          deliveryMethod: 'ONLINE',
          additionalNotes,
        }),
      });
      setProposal('');
      setAdditionalNotes('');
      setFeedback('تم إرسال عرضك بنجاح إلى الطالب.');
      await loadTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال العرض');
    }
  };

  const handleAcceptOffer = async (offerId: number) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/tasks/${id}/accept-offer/${offerId}`, {
        method: 'POST',
      });
      setFeedback(
        'تم قبول العرض وفتح محادثة مباشرة مع المعلّم وإغلاق العروض الأخرى تلقائياً.'
      );
      await loadTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قبول العرض');
    }
  };

  const handleStatusChange = async (
    toStatus: string,
    extra?: { deliverableSummary?: string; deliverableUrl?: string }
  ) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/tasks/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ toStatus, ...extra }),
      });
      setFeedback(
        `تم تحديث حالة المهمة إلى: ${TASK_STATUS_LABELS_AR[toStatus] || toStatus}`
      );
      setDeliverableSummary('');
      setDeliverableUrl('');
      await loadTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الحالة');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/tasks/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      setReviewComment('');
      setFeedback('تم حفظ تقييمك للمعلّم بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التقييم');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <p className="text-slate-700 font-semibold">{error || 'المهمة غير موجودة'}</p>
        <Link to="/tasks" className="text-teal-700 text-sm underline">
          العودة إلى سوق المهام
        </Link>
      </div>
    );
  }

  const { task, offers, deliverables, history } = data;
  const isOwner = user?.id === task.studentUserId;
  const acceptedOffer = offers.find((o) => o.id === task.acceptedOfferId);
  const isAcceptedTeacher = user?.id === acceptedOffer?.teacherUserId;
  const isProvider =
    user &&
    user.roles.some((r) => ['TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'].includes(r));
  const alreadyOffered = offers.some((o) => o.teacherUserId === user?.id);
  const canOffer =
    isProvider &&
    !isOwner &&
    !alreadyOffered &&
    (task.status === 'OPEN' || task.status === 'OFFERS_RECEIVED');

  const currentStepIdx = LIFECYCLE_STEPS.findIndex((s) => s.code === task.status);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Task Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>{task.categoryNameAr}</span>
              <span aria-hidden="true">·</span>
              <span>{task.fieldNameAr}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-teal-800">
                {TASK_STATUS_LABELS_AR[task.status] || task.status}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
              {task.title}
            </h1>
            <div className="text-xs text-slate-500">
              صاحب المهمة: {task.studentName} · المدة: {task.expectedDuration} · الموعد النهائي:{' '}
              <span className="font-mono-num">{task.deadline}</span>
            </div>
          </div>
          <div className="sm:text-left shrink-0">
            <div className="text-xs text-slate-500">الميزانية المرصودة</div>
            <div className="font-mono-num text-2xl font-extrabold text-slate-900">
              ${task.budget}
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {task.description}
        </p>

        {task.requiredSkills && (
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">المهارات المطلوبة: </span>
            {task.requiredSkills}
          </div>
        )}

        {/* Lifecycle Stepper */}
        <div className="pt-4 border-t border-slate-100">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const passed = currentStepIdx >= idx;
              return (
                <div
                  key={step.code}
                  className={`p-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                    passed
                      ? 'bg-teal-50 border-teal-200 text-teal-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  {passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{step.label}</span>
                </div>
              );
            })}
          </div>
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

      {/* Lifecycle Controls for Accepted Offer Participants */}
      {(isOwner || isAcceptedTeacher) &&
        ['OFFER_ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'].includes(
          task.status
        ) && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                متابعة تنفيذ المهمة
              </h2>
              <Link
                to="/messages"
                className="text-xs font-semibold text-teal-700 flex items-center gap-1 hover:underline"
              >
                <MessageSquare className="w-4 h-4" />
                <span>فتح المحادثة المباشرة</span>
              </Link>
            </div>

            {isAcceptedTeacher && task.status === 'OFFER_ACCEPTED' && (
              <button
                type="button"
                onClick={() => handleStatusChange('IN_PROGRESS')}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                بدء تنفيذ المهمة (قيد التنفيذ)
              </button>
            )}

            {isAcceptedTeacher && task.status === 'IN_PROGRESS' && (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={deliverableSummary}
                  onChange={(e) => setDeliverableSummary(e.target.value)}
                  placeholder="ملخص المخرجات، الملاحظات، أو رابط الجلسة والملفات..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="url"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="رابط المخرجات (اختياري)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleStatusChange('DELIVERED', {
                      deliverableSummary:
                        deliverableSummary || 'تم إتمام الشرح وتسليم المخرجات.',
                      deliverableUrl,
                    })
                  }
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  تسليم المهمة للطالب
                </button>
              </div>
            )}

            {isOwner && task.status === 'DELIVERED' && (
              <button
                type="button"
                onClick={() => handleStatusChange('COMPLETED')}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                تأكيد استلام المخرجات وإتمام المهمة
              </button>
            )}

            {isOwner && task.status === 'COMPLETED' && (
              <form
                onSubmit={handleReviewSubmit}
                className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-3"
              >
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  aria-label="تقييم المعلّم"
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
                  placeholder="قيّم أداء المعلّم..."
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

            {deliverables.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  المخرجات المسلّمة:
                </div>
                {deliverables.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1"
                  >
                    <div className="font-semibold">{d.submittedByName}</div>
                    <p>{d.summary}</p>
                    {d.deliverableUrl && (
                      <a
                        href={d.deliverableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 underline"
                      >
                        فتح رابط المرفق
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Teacher Offer Submission Form */}
      {canOffer && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            تقديم عرض تعليمي على هذه المهمة
          </h2>
          <form onSubmit={handleSubmitOffer} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                خطة الشرح وتفاصيل العرض
              </label>
              <textarea
                required
                rows={3}
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                placeholder="اشرح كيف ستساعد الطالب وما الذي سيحصل عليه..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  السعر المقترح (USD)
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  المدة المتوقعة
                </label>
                <input
                  type="text"
                  required
                  value={offerDuration}
                  onChange={(e) => setOfferDuration(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ملاحظات إضافية
                </label>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              إرسال العرض
            </button>
          </form>
        </div>
      )}

      {!user && (task.status === 'OPEN' || task.status === 'OFFERS_RECEIVED') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <span className="text-sm text-slate-700">
            هل أنت معلّم أو مرشد وترغب في تقديم عرض على هذه المهمة؟
          </span>
          <button
            type="button"
            onClick={openAuthModal}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
          >
            سجّل الدخول لتقديم عرض
          </button>
        </div>
      )}

      {/* Offers Comparison List */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900">
          العروض المقدّمة ({offers.length})
        </h2>

        {offers.length === 0 ? (
          <p className="text-sm text-slate-500">
            لم تُقدّم عروض بعد على هذه المهمة.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-slate-900">
                      {offer.teacherName}
                    </span>
                    {offer.providerVerified === 'VERIFIED' && (
                      <span className="text-xs text-teal-700 font-medium">
                        · موثّق
                      </span>
                    )}
                    {offer.providerRating && (
                      <span className="text-xs text-amber-600 flex items-center gap-0.5 font-mono-num">
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                        {offer.providerRating}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      · حالة العرض: {offer.status === 'ACCEPTED' ? 'مقبول' : offer.status === 'REJECTED' ? 'مرفوض' : 'قيد الانتظار'}
                    </span>
                  </div>
                  {offer.providerHeadline && (
                    <div className="text-xs text-slate-500">
                      {offer.providerHeadline}
                    </div>
                  )}
                  <p className="text-sm text-slate-700 leading-relaxed pt-1">
                    {offer.proposal}
                  </p>
                  <div className="text-xs text-slate-500">
                    المدة المقترحة: {offer.expectedDuration}
                    {offer.additionalNotes && ` · ${offer.additionalNotes}`}
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
                  <div className="font-mono-num text-lg font-extrabold text-slate-900">
                    ${offer.proposedPrice}
                  </div>
                  {isOwner &&
                    offer.status === 'PENDING' &&
                    (task.status === 'OPEN' ||
                      task.status === 'OFFERS_RECEIVED') && (
                      <button
                        type="button"
                        onClick={() => handleAcceptOffer(offer.id)}
                        className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        قبول هذا العرض
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status History */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h3 className="font-display text-base font-bold text-slate-900">
          سجل تغيّرات المهمة
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          {history.map((h) => (
            <div
              key={h.id}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
            >
              <div className="text-slate-700">
                <span className="font-semibold">{h.changedByName}</span>:{' '}
                <span>
                  {h.note ||
                    `${TASK_STATUS_LABELS_AR[h.fromStatus] || h.fromStatus} ← ${
                      TASK_STATUS_LABELS_AR[h.toStatus] || h.toStatus
                    }`}
                </span>
              </div>
              <span className="font-mono-num text-slate-400">
                {new Date(h.createdAt).toLocaleString('ar-EG')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
