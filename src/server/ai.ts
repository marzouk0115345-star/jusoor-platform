import { GoogleGenAI, Type } from '@google/genai';

function isValidGeminiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return false;
  if (key === 'MY_GEMINI_API_KEY' || key.length < 15) return false;
  return true;
}

export function getAiConfigurationStatus() {
  return {
    configured: isValidGeminiKeyConfigured(),
    model: 'gemini-4-hydrogen',
    provider: 'Google Gemini (@google/genai)',
  };
}

export interface AiAnalysisOutput {
  configured: boolean;
  model: string;
  diagnosedGap: string;
  recommendedSolutionType: 'MENTORSHIP' | 'COURSE' | 'TASK' | 'CONSULTATION';
  explanation: string;
  roadmapTitle: string;
  steps: Array<{
    title: string;
    description: string;
    actionType: 'COURSE' | 'MENTORSHIP' | 'TASK' | 'PROJECT';
  }>;
}

export async function generateLearningDiagnosis(params: {
  learnerGoal: string;
  currentSkills: string[];
  availableCourses: Array<{ id: number; title: string; level: string }>;
  availableProviders: Array<{ id: number; name: string; type: string; headline: string }>;
}): Promise<AiAnalysisOutput> {
  if (!isValidGeminiKeyConfigured()) {
    throw new Error(
      'AI_NOT_CONFIGURED: لم يتم تفعيل مفتاح GEMINI_API_KEY في بيئة التشغيل. يرجى إضافة المفتاح في Settings > Secrets لتشغيل المساعد الذكي الحقيقي.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `أنت المستشار التعليمي والمهني الذكي لمنصة جسور (JUSOOR).
هدفك ليس اقتراح دورة تقليدية دائماً، بل تشخيص العائق الحقيقي للمتعلم:
- إذا كان المتعلم يعرف الأساسيات لكنه عاجز عن تطبيقها في مشاريع شركات حقيقية، فالحل الأنسب هو الإرشاد العملي (MENTORSHIP) ومشروع تطبيقي موجه وليس دورة مبتدئين جديدة.
- إذا كان لديه واجب أو مفهوم محدد يريد شرحه بسرعة، فالحل الأنسب هو مهمة تعليمية (TASK).
- إذا كان يحتاج مراجعة معمارية أو قراراً مهنياً، فالحل هو استشارة خبير (CONSULTATION).
- إذا كان يبدأ من الصفر ويحتاج بناءً تأسيسياً متدرجاً، فالحل هو دورة (COURSE).

هدف المتعلم: ${params.learnerGoal}
مهاراته الحالية: ${params.currentSkills.join('، ') || 'غير محددة'}
الدورات المتاحة في المنصة: ${params.availableCourses.map((c) => `[${c.id}] ${c.title} (${c.level})`).join(' | ')}
الموجهون والخبراء المتاحون: ${params.availableProviders.map((p) => `[${p.id}] ${p.name} - ${p.type}: ${p.headline}`).join(' | ')}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'أجب باللغة العربية الواضحة بصيغة JSON مطابقة للمخطط المحدد فقط.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosedGap: { type: Type.STRING },
          recommendedSolutionType: { type: Type.STRING },
          explanation: { type: Type.STRING },
          roadmapTitle: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                actionType: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText);

  const allowedTypes = ['MENTORSHIP', 'COURSE', 'TASK', 'CONSULTATION'] as const;
  const solutionType = allowedTypes.includes(parsed.recommendedSolutionType)
    ? parsed.recommendedSolutionType
    : 'MENTORSHIP';

  return {
    configured: true,
    model: 'gemini-4-hydrogen',
    diagnosedGap: parsed.diagnosedGap || 'تحليل الفجوة التطبيقية',
    recommendedSolutionType: solutionType,
    explanation: parsed.explanation || 'تم تحليل هدفك وربطه بأفضل مسار مناسب.',
    roadmapTitle: parsed.roadmapTitle || 'خطة التطوير المقترحة',
    steps: Array.isArray(parsed.steps) ? parsed.steps.slice(0, 5) : [],
  };
}
