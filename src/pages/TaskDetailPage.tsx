import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, TASK_STATUS_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

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
  const { user, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';
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
      <div className="container-xxl px-3 px-sm-4 py-5">
        <LoadingSkeleton variant="detail" count={1} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader
          title={isAr ? 'المهمة غير موجودة' : 'Task Not Found'}
          breadcrumbs={[
            { label: isAr ? 'الرئيسية' : 'Home', to: '/' },
            { label: isAr ? 'سوق المهام' : 'Tasks', to: '/tasks' },
          ]}
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-briefcase"
            title={error || (isAr ? 'المهمة غير موجودة' : 'Task not found')}
            action={
              <Link to="/tasks" className="btn-jusoor-primary px-4 py-2 text-xs">
                {isAr ? 'العودة إلى سوق المهام' : 'Back to Tasks'}
              </Link>
            }
          />
        </div>
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
    <div>
      <PageHeader
        kicker={`${task.categoryNameAr} · ${task.fieldNameAr}`}
        title={task.title}
        subtitle={`${isAr ? 'صاحب المهمة:' : 'Student:'} ${task.studentName} · ${isAr ? 'المدة:' : 'Duration:'} ${task.expectedDuration} · ${isAr ? 'الموعد النهائي:' : 'Deadline:'} ${task.deadline}`}
        breadcrumbs={[
          { label: isAr ? 'الرئيسية' : 'Home', to: '/' },
          { label: isAr ? 'سوق المهام' : 'Tasks', to: '/tasks' },
          { label: task.title },
        ]}
        actions={
          <div className="jusoor-subcard px-4 py-2.5 text-end">
            <div className="text-[11px] text-[#64748B]">
              {isAr ? 'الميزانية المرصودة' : 'Budget'}
            </div>
            <div className="font-mono-num text-xl font-extrabold text-[#102A43]">
              ${task.budget}
            </div>
          </div>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
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

        {/* Task Overview & 6-Step Lifecycle Stepper */}
        <section className="jusoor-card p-4 p-sm-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#0F766E]">
              {TASK_STATUS_LABELS_AR[task.status] || task.status}
            </span>
            {task.requiredSkills && (
              <div className="text-xs text-[#64748B]">
                <span className="font-bold text-[#102A43]">المهارات المطلوبة: </span>
                {task.requiredSkills}
              </div>
            )}
          </div>

          <p className="text-sm text-[#172B4D] leading-relaxed whitespace-pre-line m-0">
            {task.description}
          </p>

          <div className="pt-4 border-t border-[#DCE5F0]">
            <div className="row g-2">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const passed = currentStepIdx >= idx;
                return (
                  <div key={step.code} className="col-6 col-sm-4 col-lg-2">
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                        passed
                          ? 'bg-[#E8F8F5] border-[#99E2D8] text-[#0B4F4A]'
                          : 'bg-[#F5F8FC] border-[#DCE5F0] text-[#64748B]'
                      }`}
                    >
                      <i
                        className={`bi ${
                          passed
                            ? 'bi-check-circle-fill text-[#0F766E]'
                            : 'bi-clock text-[#64748B]'
                        } shrink-0`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{step.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Lifecycle Controls for Accepted Offer Participants */}
        {(isOwner || isAcceptedTeacher) &&
          ['OFFER_ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'].includes(
            task.status
          ) && (
            <section className="jusoor-card p-4 p-sm-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                  متابعة تنفيذ المهمة
                </h2>
                <Link
                  to="/messages"
                  className="text-xs font-semibold text-[#0F766E] inline-flex items-center gap-1.5 hover:underline"
                >
                  <i className="bi bi-chat-dots" aria-hidden="true" />
                  <span>فتح المحادثة المباشرة</span>
                </Link>
              </div>

              {isAcceptedTeacher && task.status === 'OFFER_ACCEPTED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('IN_PROGRESS')}
                  className="btn-jusoor-primary px-4 py-2 text-xs sm:text-sm cursor-pointer"
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
                    className="jusoor-textarea w-full px-3 py-2 text-sm"
                  />
                  <input
                    type="url"
                    value={deliverableUrl}
                    onChange={(e) => setDeliverableUrl(e.target.value)}
                    placeholder="رابط المخرجات (اختياري)"
                    className="jusoor-input w-full px-3 py-2 text-sm"
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
                    className="btn-jusoor-primary px-4 py-2.5 text-sm cursor-pointer"
                  >
                    تسليم المهمة للطالب
                  </button>
                </div>
              )}

              {isOwner && task.status === 'DELIVERED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('COMPLETED')}
                  className="btn-jusoor-primary px-4 py-2.5 text-sm cursor-pointer"
                >
                  تأكيد استلام المخرجات وإتمام المهمة
                </button>
              )}

              {isOwner && task.status === 'COMPLETED' && (
                <form
                  onSubmit={handleReviewSubmit}
                  className="pt-3 border-t border-[#DCE5F0] flex flex-col sm:flex-row gap-2.5"
                >
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    aria-label="تقييم المعلّم"
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
                    placeholder="قيّم أداء المعلّم..."
                    className="jusoor-input flex-1 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="btn-jusoor-navy px-4 py-2 text-sm cursor-pointer"
                  >
                    إرسال التقييم
                  </button>
                </form>
              )}

              {deliverables.length > 0 && (
                <div className="pt-3 border-t border-[#EDF2F7] space-y-2">
                  <div className="text-xs font-bold text-[#102A43]">
                    المخرجات المسلّمة:
                  </div>
                  {deliverables.map((d) => (
                    <div
                      key={d.id}
                      className="jusoor-subcard p-3 text-xs text-[#172B4D] space-y-1"
                    >
                      <div className="font-bold text-[#102A43]">{d.submittedByName}</div>
                      <p className="m-0">{d.summary}</p>
                      {d.deliverableUrl && (
                        <a
                          href={d.deliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0F766E] font-semibold hover:underline"
                        >
                          فتح رابط المرفق
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        {/* Teacher Offer Submission Form */}
        {canOffer && (
          <section className="jusoor-card p-4 p-sm-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
              تقديم عرض تعليمي على هذه المهمة
            </h2>
            <form onSubmit={handleSubmitOffer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  خطة الشرح وتفاصيل العرض
                </label>
                <textarea
                  required
                  rows={3}
                  value={proposal}
                  onChange={(e) => setProposal(e.target.value)}
                  placeholder="اشرح كيف ستساعد الطالب وما الذي سيحصل عليه..."
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="row g-3">
                <div className="col-12 col-sm-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    السعر المقترح (USD)
                  </label>
                  <input
                    type="number"
                    required
                    min="5"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    المدة المتوقعة
                  </label>
                  <input
                    type="text"
                    required
                    value={offerDuration}
                    onChange={(e) => setOfferDuration(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    ملاحظات إضافية
                  </label>
                  <input
                    type="text"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn-jusoor-primary px-5 py-2.5 text-sm cursor-pointer"
              >
                إرسال العرض
              </button>
            </form>
          </section>
        )}

        {!user && (task.status === 'OPEN' || task.status === 'OFFERS_RECEIVED') && (
          <div className="jusoor-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-sm text-[#172B4D]">
              هل أنت معلّم أو مرشد وترغب في تقديم عرض على هذه المهمة؟
            </span>
            <button
              type="button"
              onClick={openAuthModal}
              className="btn-jusoor-navy px-4 py-2 text-xs cursor-pointer whitespace-nowrap"
            >
              سجّل الدخول لتقديم عرض
            </button>
          </div>
        )}

        {/* Offers Comparison List */}
        <section className="jusoor-card p-4 p-sm-5 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
            العروض المقدّمة ({offers.length})
          </h2>

          {offers.length === 0 ? (
            <p className="text-sm text-[#64748B] m-0">
              لم تُقدّم عروض بعد على هذه المهمة.
            </p>
          ) : (
            <div className="divide-y divide-[#DCE5F0]">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link
                        to={`/instructors/${offer.teacherUserId}`}
                        className="font-bold text-[#102A43] hover:text-[#247BA0]"
                      >
                        {offer.teacherName}
                      </Link>
                      {offer.providerVerified === 'VERIFIED' && (
                        <span className="text-xs text-[#0F766E] font-semibold inline-flex items-center gap-1">
                          <i className="bi bi-patch-check-fill text-[#20B8A6]" aria-hidden="true" />
                          موثّق
                        </span>
                      )}
                      {offer.providerRating && (
                        <span className="text-xs text-[#B45309] inline-flex items-center gap-1 font-mono-num">
                          <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                          {offer.providerRating}
                        </span>
                      )}
                      <span className="text-xs text-[#64748B]">
                        ·{' '}
                        {offer.status === 'ACCEPTED'
                          ? 'مقبول'
                          : offer.status === 'REJECTED'
                          ? 'مرفوض'
                          : 'قيد الانتظار'}
                      </span>
                    </div>
                    {offer.providerHeadline && (
                      <div className="text-xs text-[#64748B]">
                        {offer.providerHeadline}
                      </div>
                    )}
                    <p className="text-sm text-[#172B4D] leading-relaxed pt-1 m-0">
                      {offer.proposal}
                    </p>
                    <div className="text-xs text-[#64748B]">
                      المدة المقترحة: {offer.expectedDuration}
                      {offer.additionalNotes && ` · ${offer.additionalNotes}`}
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0">
                    <div className="font-mono-num text-lg font-extrabold text-[#102A43]">
                      ${offer.proposedPrice}
                    </div>
                    {isOwner &&
                      offer.status === 'PENDING' &&
                      (task.status === 'OPEN' ||
                        task.status === 'OFFERS_RECEIVED') && (
                        <button
                          type="button"
                          onClick={() => handleAcceptOffer(offer.id)}
                          className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer whitespace-nowrap"
                        >
                          قبول هذا العرض
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Status History */}
        <section className="jusoor-card p-4 p-sm-5 space-y-3">
          <h3 className="font-display text-base font-bold text-[#102A43] m-0">
            سجل تغيّرات المهمة
          </h3>
          <div className="divide-y divide-[#EDF2F7] text-xs">
            {history.map((h) => (
              <div
                key={h.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
              >
                <div className="text-[#172B4D]">
                  <span className="font-bold text-[#102A43]">{h.changedByName}</span>:{' '}
                  <span>
                    {h.note ||
                      `${TASK_STATUS_LABELS_AR[h.fromStatus] || h.fromStatus} ← ${
                        TASK_STATUS_LABELS_AR[h.toStatus] || h.toStatus
                      }`}
                  </span>
                </div>
                <span className="font-mono-num text-[#64748B]">
                  {new Date(h.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
