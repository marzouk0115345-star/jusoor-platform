import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';

interface AiStatus {
  configured: boolean;
  model: string;
  provider: string;
}

interface RoadmapItem {
  id: number;
  title: string;
  diagnosedGap: string;
  recommendedSolutionType: string;
  aiModelUsed: string;
  isAiGenerated: boolean;
  steps: Array<{
    id: number;
    stepOrder: number;
    title: string;
    description: string;
    actionType: string;
  }>;
}

export function AssistantPage() {
  const { user, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [roadmaps, setRoadmaps] = useState<RoadmapItem[]>([]);
  const [goal, setGoal] = useState(
    'أعرف HTML و CSS و JavaScript لكن لا أستطيع العمل على مشاريع شركات حقيقية'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const st = await apiFetch<AiStatus>('/api/assistant/status');
      setStatus(st);
      if (user) {
        const rm = await apiFetch<{ roadmaps: RoadmapItem[] }>(
          '/api/assistant/roadmaps'
        );
        setRoadmaps(rm.roadmaps);
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/assistant/analyze', {
        method: 'POST',
        body: JSON.stringify({ goal }),
      });
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام التحليل الذكي حالياً.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        kicker={isAr ? 'تشخيص المسار التعليمي' : 'Learning Path Diagnostics'}
        title={isAr ? 'المستشار التعليمي الذكي' : 'Smart Learning Assistant'}
        subtitle={
          isAr
            ? 'يحلّل فجوتك الفعلية ويحدّد إن كنت تحتاج دورة تأسيسية، إرشاداً عملياً على مشاريع حقيقية، مهمة شرح محددة، أو استشارة خبير.'
            : 'Analyzes your skill gap and recommends whether you need a course, hands-on mentorship, a targeted task, or expert consultation.'
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
        {/* Honest AI Configuration State */}
        {status && (
          <StateBanner
            variant={status.configured ? 'success' : 'warning'}
            title={
              status.configured
                ? `طبقة الذكاء الاصطناعي مفعّلة (${status.provider} · ${status.model})`
                : 'بنية الذكاء الاصطناعي جاهزة — بانتظار مفتاح GEMINI_API_KEY'
            }
            message={
              status.configured
                ? 'يمكنك إرسال وصف وضعك الحالي ليقوم المساعد بتشخيص الفجوة واقتراح خارطة طريق مرتبطة بدورات وموجّهي المنصة.'
                : 'لا تعرض المنصة أي نتائج ذكاء اصطناعي وهمية عندما لا يكون مفتاح المزود مضبوطاً. أضف GEMINI_API_KEY في الإعدادات لتفعيل التحليل الحي.'
            }
          />
        )}

        {/* Goal Submission Form */}
        <form onSubmit={handleAnalyze} className="jusoor-card p-4 p-sm-5 space-y-4">
          <label
            htmlFor="ai-goal-input"
            className="block font-display text-base font-bold text-[#102A43]"
          >
            صف وضعك التعليمي أو المهني وما يعيق تقدّمك:
          </label>
          <textarea
            id="ai-goal-input"
            required
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="jusoor-textarea w-full px-3 py-2.5 text-sm"
          />
          {error && (
            <StateBanner
              variant="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-jusoor-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <i className="bi bi-compass" aria-hidden="true" />
            <span>{loading ? 'جارٍ التحليل عبر Gemini...' : 'تشخيص المسار الأنسب'}</span>
          </button>
        </form>

        {/* Saved Roadmaps */}
        {roadmaps.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
              خرائط التعلّم المحفوظة ({roadmaps.length})
            </h2>
            <div className="space-y-4">
              {roadmaps.map((rm) => (
                <div key={rm.id} className="jusoor-card p-4 p-sm-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
                      {rm.title}
                    </h3>
                    <span className="text-xs font-bold text-[#0F766E] font-mono-num">
                      الحل المقترح: {rm.recommendedSolutionType} · {rm.aiModelUsed}
                    </span>
                  </div>
                  <p className="text-sm text-[#64748B] m-0">{rm.diagnosedGap}</p>
                  <div className="divide-y divide-[#EDF2F7] pt-2">
                    {rm.steps.map((st) => (
                      <div key={st.id} className="py-2.5 text-xs space-y-1">
                        <div className="font-bold text-[#102A43]">
                          {st.stepOrder}. {st.title} ({st.actionType})
                        </div>
                        <p className="text-[#64748B] m-0">{st.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
