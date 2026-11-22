import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Award, Briefcase, Building2, FileText, Trash2, UserCheck, Wallet } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';

interface ProfDevResponse {
  cv: {
    headline: string;
    summary: string;
    educationJson: Array<{ institution: string; degree: string; year: string }>;
    experienceJson: Array<{
      role: string;
      organization: string;
      period: string;
      highlights: string;
    }>;
    languagesJson: string[];
  } | null;
  portfolios: Array<{
    id: number;
    title: string;
    description: string;
    projectUrl: string | null;
    imageUrl: string | null;
    skillsSummary: string | null;
    completedAt: string | null;
  }>;
  skills: Array<{
    id: number;
    skillId: number;
    nameAr: string;
    proficiencyLevel: string;
    verifiedByPassport: boolean;
  }>;
  certificates: Array<{
    id: number;
    title: string;
    issuerName: string;
    credentialCode: string;
  }>;
  skillPassport: {
    passportCode: string;
    verifiedSkillsCount: number;
    completedTasksCount: number;
    completedCoursesCount: number;
  } | null;
}

interface PaymentLedgerResponse {
  gatewayConfigured: boolean;
  mode: string;
  payments: Array<{
    id: number;
    entityType: string;
    amount: string;
    commissionAmount: string;
    netAmount: string;
    status: string;
    paymentMode: string;
    paymentReference: string;
  }>;
  earnings: Array<{
    id: number;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
    status: string;
  }>;
}

interface AuthMeDetailsResponse {
  providerProfile: {
    providerType: string;
    headline: string;
    bio: string;
    qualifications: string | null;
    yearsExperience: number;
  } | null;
  centerMemberships: Array<{
    id: number;
    centerId: number;
    centerName: string;
    memberRole: string;
    jobTitle: string;
  }>;
}

export function ProfilePage() {
  const { user, taxonomy, openAuthModal, refreshUser } = useAuth();
  const [profData, setProfData] = useState<ProfDevResponse | null>(null);
  const [ledger, setLedger] = useState<PaymentLedgerResponse | null>(null);
  const [centerMemberships, setCenterMemberships] = useState<
    AuthMeDetailsResponse['centerMemberships']
  >([]);
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [bioHeadline, setBioHeadline] = useState('');
  const [aboutMeBio, setAboutMeBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [yearsExperience, setYearsExperience] = useState('1');
  const [savingBio, setSavingBio] = useState(false);
  const [cvHeadline, setCvHeadline] = useState('');
  const [cvSummary, setCvSummary] = useState('');
  const [projTitle, setProjTitle] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projSkills, setProjSkills] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [skillLevel, setSkillLevel] = useState('INTERMEDIATE');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setFullName(user.fullName);
    const [pd, pay, me] = await Promise.all([
      apiFetch<ProfDevResponse>('/api/prof-dev/me'),
      apiFetch<PaymentLedgerResponse>('/api/payments/me'),
      apiFetch<AuthMeDetailsResponse>('/api/auth/me'),
    ]);
    setProfData(pd);
    setLedger(pay);
    setCenterMemberships(me.centerMemberships || []);
    setHasProviderProfile(Boolean(me.providerProfile));
    if (me.providerProfile) {
      setBioHeadline(me.providerProfile.headline || '');
      setAboutMeBio(me.providerProfile.bio || '');
      setQualifications(me.providerProfile.qualifications || '');
      setYearsExperience(String(me.providerProfile.yearsExperience ?? 1));
    }
    if (pd.cv) {
      setCvHeadline(pd.cv.headline);
      setCvSummary(pd.cv.summary);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          الملف المهني والسيرة الذاتية
        </h1>
        <p className="text-sm text-slate-600">
          سجّل الدخول لبناء سيرتك الذاتية ومعرض أعمالك وإدارة سجل مهاراتك.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="px-6 py-3 bg-teal-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  const canEditInstructorBio =
    hasProviderProfile ||
    centerMemberships.some((m) => m.memberRole === 'INSTRUCTOR') ||
    user.roles.some((r) =>
      ['TEACHER', 'MENTOR', 'EXPERT', 'CENTER_OWNER', 'CENTER_STAFF', 'ADMIN'].includes(r)
    );

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName }),
      });
      await refreshUser();
      setFeedback('تم تحديث بيانات الحساب.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث بيانات الحساب.');
    }
  };

  const handleSaveAboutMe = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    if (aboutMeBio.trim().length > 3000) {
      setError('النبذة التعريفية طويلة جداً (الحد الأقصى 3000 حرف).');
      return;
    }
    setSavingBio(true);
    try {
      await apiFetch('/api/instructors/me/bio', {
        method: 'PUT',
        body: JSON.stringify({
          bio: aboutMeBio.trim(),
          headline: bioHeadline.trim() || undefined,
          qualifications: qualifications.trim() || undefined,
          yearsExperience: Math.max(0, Math.min(70, Number(yearsExperience) || 0)),
        }),
      });
      setFeedback('تم حفظ النبذة التعريفية (About Me) بنجاح.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ النبذة التعريفية.');
    } finally {
      setSavingBio(false);
    }
  };

  const handleSaveCv = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    await apiFetch('/api/prof-dev/cv', {
      method: 'PUT',
      body: JSON.stringify({
        headline: cvHeadline,
        summary: cvSummary,
        educationJson: profData?.cv?.educationJson || [],
        experienceJson: profData?.cv?.experienceJson || [],
        languagesJson: profData?.cv?.languagesJson || ['العربية'],
      }),
    });
    setFeedback('تم حفظ السيرة الذاتية بنجاح.');
    await loadData();
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/prof-dev/portfolio', {
      method: 'POST',
      body: JSON.stringify({
        title: projTitle,
        description: projDesc,
        skillsSummary: projSkills,
      }),
    });
    setProjTitle('');
    setProjDesc('');
    setProjSkills('');
    setFeedback('تمت إضافة العمل إلى معرض أعمالك.');
    await loadData();
  };

  const handleDeleteProject = async (id: number) => {
    await apiFetch(`/api/prof-dev/portfolio/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const sid = Number(selectedSkillId || taxonomy?.skills[0]?.id || 1);
    await apiFetch('/api/prof-dev/skills', {
      method: 'POST',
      body: JSON.stringify({ skillId: sid, proficiencyLevel: skillLevel }),
    });
    setFeedback('تم تحديث مهاراتك.');
    await loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            الملف المهني والسجل المالي
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            منشئ السيرة الذاتية، النبذة التعريفية للمدرّب، معرض الأعمال، جواز المهارات، وسجل المعاملات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEditInstructorBio && (
            <Link
              to={`/instructors/${user.id}`}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:border-teal-700 text-slate-800 text-xs font-semibold rounded-xl"
            >
              عرض ملفي العام كمدرّب
            </Link>
          )}
          {profData?.skillPassport && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs">
              <div className="text-slate-500">جواز المهارات الرقمي</div>
              <div className="font-mono-num font-bold text-teal-800">
                {profData.skillPassport.passportCode}
              </div>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account + Instructor Bio + CV Builder */}
        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handleSaveName}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">
              بيانات الحساب
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                الاسم الكامل
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              حفظ الاسم
            </button>
          </form>

          {centerMemberships.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700" />
                <span>الانتماء للمراكز التعليمية والمسمى الوظيفي</span>
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {centerMemberships.map((m) => (
                  <div
                    key={m.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {m.centerName}
                      </div>
                      <div className="text-slate-600 mt-0.5" dir="auto">
                        {m.jobTitle?.trim() || m.memberRole}
                      </div>
                    </div>
                    <span className="text-slate-500">
                      {({
                        OWNER: 'مالك المركز',
                        MANAGER: 'مدير فرعي',
                        INSTRUCTOR: 'مدرّب',
                        STAFF: 'موظف مركز',
                      } as Record<string, string>)[m.memberRole] || m.memberRole}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canEditInstructorBio && (
            <form
              onSubmit={handleSaveAboutMe}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-teal-700" />
                  <span>نبذة عني — About Me</span>
                </h2>
                <Link
                  to={`/instructors/${user.id}`}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  معاينة الصفحة العامة
                </Link>
              </div>
              <div>
                <label
                  htmlFor="instructor-headline"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  المسمى المهني / التخصص
                </label>
                <input
                  id="instructor-headline"
                  type="text"
                  value={bioHeadline}
                  onChange={(e) => setBioHeadline(e.target.value)}
                  placeholder="مثال: مدرّس تطوير واجهات أمامية React و TypeScript"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  dir="auto"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="instructor-qualifications"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    المؤهلات العلمية والشهادات
                  </label>
                  <input
                    id="instructor-qualifications"
                    type="text"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="مثال: ماجستير هندسة البرمجيات"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    dir="auto"
                  />
                </div>
                <div>
                  <label
                    htmlFor="instructor-years-exp"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    سنوات الخبرة
                  </label>
                  <input
                    id="instructor-years-exp"
                    type="number"
                    min="0"
                    max="70"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="instructor-about-me"
                    className="block text-xs font-medium text-slate-700"
                  >
                    About Me — نبذة عني (السيرة المهنية للطلاب)
                  </label>
                  <span className="text-[11px] font-mono-num text-slate-400">
                    {aboutMeBio.length}/3000
                  </span>
                </div>
                <textarea
                  id="instructor-about-me"
                  rows={5}
                  maxLength={3000}
                  value={aboutMeBio}
                  onChange={(e) => setAboutMeBio(e.target.value)}
                  placeholder="عرّف الطلاب بنفسك: خلفيتك الأكاديمية، مؤهلاتك، سنوات خبرتك في التدريس، التخصصات والمواد التي تدرّسها، وأسلوبك التعليمي..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  dir="auto"
                />
              </div>
              <button
                type="submit"
                disabled={savingBio}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {savingBio ? 'جارٍ الحفظ...' : 'حفظ النبذة التعريفية'}
              </button>
            </form>
          )}

          <form
            onSubmit={handleSaveCv}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
          >
            <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-700" />
              <span>منشئ السيرة الذاتية (CV Builder)</span>
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                المسمى المهني
              </label>
              <input
                type="text"
                required
                value={cvHeadline}
                onChange={(e) => setCvHeadline(e.target.value)}
                placeholder="مثال: مطوّر واجهات أمامية React & TypeScript"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                الملخص المهني
              </label>
              <textarea
                required
                rows={4}
                value={cvSummary}
                onChange={(e) => setCvSummary(e.target.value)}
                placeholder="ملخص خبراتك وأهدافك العملية..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              حفظ السيرة الذاتية
            </button>
          </form>

          {/* Skills */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              المهارات المسجلة ({profData?.skills.length ?? 0})
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              {profData?.skills.map((s) => (
                <div
                  key={s.id}
                  className="py-2 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-900">
                    {s.nameAr}
                  </span>
                  <span className="text-slate-500">
                    {({
                      BEGINNER: 'مبتدئ',
                      INTERMEDIATE: 'متوسط',
                      ADVANCED: 'متقدم',
                      EXPERT: 'خبير',
                    } as Record<string, string>)[s.proficiencyLevel] ||
                      s.proficiencyLevel}
                    {s.verifiedByPassport && ' · موثّقة'}
                  </span>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddSkill} className="flex gap-2 pt-2">
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {taxonomy?.skills.map((sk) => (
                  <option key={sk.id} value={sk.id}>
                    {sk.nameAr}
                  </option>
                ))}
              </select>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="BEGINNER">مبتدئ</option>
                <option value="INTERMEDIATE">متوسط</option>
                <option value="ADVANCED">متقدم</option>
                <option value="EXPERT">خبير</option>
              </select>
              <button
                type="submit"
                className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                إضافة
              </button>
            </form>
          </div>
        </div>

        {/* Portfolio + Certificates + Payments */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-700" />
              <span>معرض الأعمال ({profData?.portfolios.length ?? 0})</span>
            </h2>
            <div className="space-y-3">
              {profData?.portfolios.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border border-slate-200 rounded-lg flex items-start gap-3"
                >
                  <div className="w-20 h-16 rounded-md overflow-hidden shrink-0 bg-slate-100">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {item.description}
                    </p>
                    {item.skillsSummary && (
                      <div className="text-[11px] text-slate-500">
                        {item.skillsSummary}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(item.id)}
                    aria-label={`حذف ${item.title}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddProject}
              className="pt-3 border-t border-slate-200 space-y-2.5"
            >
              <div className="text-xs font-bold text-slate-800">
                إضافة مشروع جديد للمعرض
              </div>
              <input
                type="text"
                required
                placeholder="اسم المشروع"
                value={projTitle}
                onChange={(e) => setProjTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <textarea
                required
                rows={2}
                placeholder="وصف المشروع ودورك فيه"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="التقنيات المستخدمة (مثال: React · TypeScript)"
                value={projSkills}
                onChange={(e) => setProjSkills(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                إضافة للمعرض
              </button>
            </form>
          </div>

          {/* Certificates */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-700" />
              <span>الشهادات المعتمدة ({profData?.certificates.length ?? 0})</span>
            </h2>
            {profData?.certificates.length === 0 ? (
              <p className="text-xs text-slate-500">
                ستصدر الشهادات تلقائياً عند إتمام 100% من دروس أي دورة.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {profData?.certificates.map((c) => (
                  <div
                    key={c.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-slate-900">
                      {c.title}
                    </span>
                    <span className="font-mono-num text-teal-700">
                      {c.credentialCode}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments & Earnings Sandbox Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-teal-700" />
                <span>السجل المالي والعمولات</span>
              </h2>
              <span className="text-[11px] text-amber-700 font-semibold">
                {ledger?.gatewayConfigured
                  ? 'بوابة دفع مفعلة'
                  : 'وضع التجربة المعلق (Sandbox)'}
              </span>
            </div>
            {!ledger?.gatewayConfigured && (
              <p className="text-xs text-slate-500">
                بوابة الدفع الحقيقية بانتظار ضبط مفاتيح المزود؛ تُسجل المعاملات هنا بشفافية دون تنفيذ تحصيل مالي فعلي.
              </p>
            )}
            <div className="divide-y divide-slate-100 text-xs">
              {ledger?.payments.map((p) => (
                <div
                  key={p.id}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-mono-num font-semibold text-slate-900">
                      {p.paymentReference}
                    </div>
                    <div className="text-slate-500">
                      {({
                        COURSE_ENROLLMENT: 'تسجيل دورة',
                        TASK_OFFER: 'عرض مهمة تعليمية',
                        BOOKING: 'حجز جلسة',
                      } as Record<string, string>)[p.entityType] ||
                        p.entityType}{' '}
                      · الحالة:{' '}
                      {({
                        PENDING_SETUP: 'بانتظار تفعيل بوابة الدفع',
                        PENDING: 'قيد المراجعة',
                        HELD: 'محجوز بالضمان',
                        PAID: 'مدفوع',
                        REFUNDED: 'مسترد',
                      } as Record<string, string>)[p.status] || p.status}
                    </div>
                  </div>
                  <div className="text-left font-mono-num">
                    <div className="font-bold text-slate-900">${p.amount}</div>
                    <div className="text-[11px] text-slate-500">
                      عمولة ${p.commissionAmount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
