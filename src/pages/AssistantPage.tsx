import React, { useEffect, useState, useCallback } from 'react';
import { Compass, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
  const { user, openAuthModal } = useAuth();
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
          المستشار التعليمي الذكي
        </h1>
        <p className="text-sm text-slate-600">
          يحلّل فجوتك الفعلية ويحدّد إن كنت تحتاج دورة تأسيسية، إرشاداً عملياً على مشاريع حقيقية، مهمة شرح محددة، أو استشارة خبير.
        </p>
      </div>

      {/* Honest AI Configuration State */}
      {status && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            status.configured
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {status.configured ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal-700" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          )}
          <div className="space-y-1">
            <div className="font-bold">
              {status.configured
                ? `طبقة الذكاء الاصطناعي مفعّلة (${status.provider} · ${status.model})`
                : 'بنية الذكاء الاصطناعي جاهزة — بانتظار مفتاح GEMINI_API_KEY'}
            </div>
            <p className="leading-relaxed">
              {status.configured
                ? 'يمكنك إرسال وصف وضعك الحالي ليقوم المساعد بتشخيص الفجوة واقتراح خارطة طريق مرتبطة بدورات وموجّهي المنصة.'
                : 'لا تعرض المنصة أي نتائج ذكاء اصطناعي وهمية عندما لا يكون مفتاح المزود مضبوطاً. أضف GEMINI_API_KEY في Settings > Secrets لتفعيل التحليل الحي.'}
            </p>
          </div>
        </div>
      )}

      {/* Goal Submission Form */}
      <form
        onSubmit={handleAnalyze}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <label
          htmlFor="ai-goal-input"
          className="block font-display text-base font-bold text-slate-900"
        >
          صف وضعك التعليمي أو المهني وما يعيق تقدّمك:
        </label>
        <textarea
          id="ai-goal-input"
          required
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
        />
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Compass className="w-4 h-4" />
          <span>{loading ? 'جارٍ التحليل عبر Gemini...' : 'تشخيص المسار الأنسب'}</span>
        </button>
      </form>

      {/* Saved Roadmaps */}
      {roadmaps.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            خرائط التعلّم المحفوظة ({roadmaps.length})
          </h2>
          {roadmaps.map((rm) => (
            <div
              key={rm.id}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {rm.title}
                </h3>
                <span className="text-xs font-semibold text-teal-800">
                  الحل المقترح: {rm.recommendedSolutionType} · {rm.aiModelUsed}
                </span>
              </div>
              <p className="text-sm text-slate-600">{rm.diagnosedGap}</p>
              <div className="divide-y divide-slate-100 pt-2">
                {rm.steps.map((st) => (
                  <div key={st.id} className="py-2.5 text-xs space-y-1">
                    <div className="font-bold text-slate-900">
                      {st.stepOrder}. {st.title} ({st.actionType})
                    </div>
                    <p className="text-slate-600">{st.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
