import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';

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
  const { user, taxonomy, openAuthModal, refreshUser, locale } = useAuth();
  const isAr = locale === 'ar';
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
      <div>
        <PageHeader
          title={isAr ? 'الملف المهني والسيرة الذاتية' : 'Professional Profile & CV'}
          subtitle={
            isAr
              ? 'سجّل الدخول لبناء سيرتك الذاتية ومعرض أعمالك وإدارة سجل مهاراتك.'
              : 'Sign in to build your CV, portfolio, and verified skill passport.'
          }
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-person-vcard"
            title={isAr ? 'يرجى تسجيل الدخول' : 'Sign in required'}
            description={
              isAr
                ? 'الوصول إلى منشئ السيرة الذاتية وسجل المعاملات متاح للأعضاء المسجلين.'
                : 'Sign in to access your CV builder and financial ledger.'
            }
            action={
              <button
                type="button"
                onClick={openAuthModal}
                className="btn-jusoor-primary px-5 py-2.5 text-sm cursor-pointer"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            }
          />
        </div>
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
    <div>
      <PageHeader
        kicker={isAr ? 'الهوية المهنية والشهادات' : 'Career & Credentials'}
        title={isAr ? 'الملف المهني والسجل المالي' : 'Professional Profile & Ledger'}
        subtitle={
          isAr
            ? 'منشئ السيرة الذاتية، النبذة التعريفية للمدرّب، معرض الأعمال، جواز المهارات، وسجل المعاملات.'
            : 'CV builder, instructor biography, portfolio projects, digital skill passport, and financial ledger.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {canEditInstructorBio && (
              <Link
                to={`/instructors/${user.id}`}
                className="btn-jusoor-outline px-3.5 py-2 text-xs whitespace-nowrap"
              >
                عرض ملفي العام كمدرّب
              </Link>
            )}
            {profData?.skillPassport && (
              <div className="jusoor-subcard px-3.5 py-2 text-xs">
                <div className="text-[#64748B]">جواز المهارات الرقمي</div>
                <div className="font-mono-num font-bold text-[#0F766E]">
                  {profData.skillPassport.passportCode}
                </div>
              </div>
            )}
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

        <div className="row g-4">
          {/* Left Column */}
          <div className="col-12 col-lg-6 space-y-4">
            <form onSubmit={handleSaveName} className="jusoor-card p-4 p-sm-5 space-y-3">
              <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                بيانات الحساب
              </h2>
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="btn-jusoor-navy px-4 py-2 text-xs cursor-pointer"
              >
                حفظ الاسم
              </button>
            </form>

            {centerMemberships.length > 0 && (
              <div className="jusoor-card p-4 p-sm-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#102A43] flex items-center gap-2 m-0">
                  <i className="bi bi-building text-[#247BA0]" aria-hidden="true" />
                  <span>الانتماء للمراكز التعليمية والمسمى الوظيفي</span>
                </h2>
                <div className="divide-y divide-[#EDF2F7] text-xs">
                  {centerMemberships.map((m) => (
                    <div
                      key={m.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-[#102A43]">
                          {m.centerName}
                        </div>
                        <div className="text-[#64748B] mt-0.5" dir="auto">
                          {m.jobTitle?.trim() || m.memberRole}
                        </div>
                      </div>
                      <span className="text-[#64748B]">
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
                className="jusoor-card p-4 p-sm-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                    <i className="bi bi-person-check text-[#0F766E]" aria-hidden="true" />
                    <span>نبذة عني — About Me</span>
                  </h2>
                  <Link
                    to={`/instructors/${user.id}`}
                    className="text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    معاينة الصفحة العامة
                  </Link>
                </div>
                <div>
                  <label
                    htmlFor="instructor-headline"
                    className="block text-xs font-semibold text-[#172B4D] mb-1"
                  >
                    المسمى المهني / التخصص
                  </label>
                  <input
                    id="instructor-headline"
                    type="text"
                    value={bioHeadline}
                    onChange={(e) => setBioHeadline(e.target.value)}
                    placeholder="مثال: مدرّس تطوير واجهات أمامية React و TypeScript"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                    dir="auto"
                  />
                </div>
                <div className="row g-2.5">
                  <div className="col-12 col-sm-8">
                    <label
                      htmlFor="instructor-qualifications"
                      className="block text-xs font-semibold text-[#172B4D] mb-1"
                    >
                      المؤهلات العلمية والشهادات
                    </label>
                    <input
                      id="instructor-qualifications"
                      type="text"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="مثال: ماجستير هندسة البرمجيات"
                      className="jusoor-input w-full px-3 py-2 text-sm"
                      dir="auto"
                    />
                  </div>
                  <div className="col-12 col-sm-4">
                    <label
                      htmlFor="instructor-years-exp"
                      className="block text-xs font-semibold text-[#172B4D] mb-1"
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
                      className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="instructor-about-me"
                      className="block text-xs font-semibold text-[#172B4D]"
                    >
                      About Me — نبذة عني (السيرة المهنية للطلاب)
                    </label>
                    <span className="text-[11px] font-mono-num text-[#64748B]">
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
                    className="jusoor-textarea w-full px-3 py-2 text-sm"
                    dir="auto"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingBio}
                  className="btn-jusoor-primary px-5 py-2 text-xs cursor-pointer"
                >
                  {savingBio ? 'جارٍ الحفظ...' : 'حفظ النبذة التعريفية'}
                </button>
              </form>
            )}

            <form onSubmit={handleSaveCv} className="jusoor-card p-4 p-sm-5 space-y-3">
              <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                <i className="bi bi-file-earmark-text text-[#247BA0]" aria-hidden="true" />
                <span>منشئ السيرة الذاتية (CV Builder)</span>
              </h2>
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  المسمى المهني
                </label>
                <input
                  type="text"
                  required
                  value={cvHeadline}
                  onChange={(e) => setCvHeadline(e.target.value)}
                  placeholder="مثال: مطوّر واجهات أمامية React & TypeScript"
                  className="jusoor-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  الملخص المهني
                </label>
                <textarea
                  required
                  rows={4}
                  value={cvSummary}
                  onChange={(e) => setCvSummary(e.target.value)}
                  placeholder="ملخص خبراتك وأهدافك العملية..."
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="btn-jusoor-primary px-5 py-2 text-xs cursor-pointer"
              >
                حفظ السيرة الذاتية
              </button>
            </form>

            {/* Skills */}
            <div className="jusoor-card p-4 p-sm-5 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                المهارات المسجلة ({profData?.skills.length ?? 0})
              </h2>
              <div className="divide-y divide-[#EDF2F7] text-xs">
                {profData?.skills.map((s) => (
                  <div
                    key={s.id}
                    className="py-2 flex items-center justify-between"
                  >
                    <span className="font-bold text-[#102A43]">
                      {s.nameAr}
                    </span>
                    <span className="text-[#64748B]">
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
              <form onSubmit={handleAddSkill} className="flex flex-wrap gap-2 pt-2">
                <select
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  className="jusoor-select flex-1 px-3 py-2 text-xs"
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
                  className="jusoor-select px-3 py-2 text-xs"
                >
                  <option value="BEGINNER">مبتدئ</option>
                  <option value="INTERMEDIATE">متوسط</option>
                  <option value="ADVANCED">متقدم</option>
                  <option value="EXPERT">خبير</option>
                </select>
                <button
                  type="submit"
                  className="btn-jusoor-navy px-3 py-2 text-xs cursor-pointer"
                >
                  إضافة
                </button>
              </form>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-12 col-lg-6 space-y-4">
            <div className="jusoor-card p-4 p-sm-5 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
                <i className="bi bi-briefcase text-[#247BA0]" aria-hidden="true" />
                <span>معرض الأعمال ({profData?.portfolios.length ?? 0})</span>
              </h2>
              <div className="space-y-3">
                {profData?.portfolios.map((item) => (
                  <div
                    key={item.id}
                    className="jusoor-subcard p-3 flex items-start gap-3"
                  >
                    <div className="w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-[#EEF4FA]">
                      <SafeImage
                        src={item.imageUrl}
                        alt={item.title}
                        fallbackTitle={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-sm font-bold text-[#102A43] truncate">
                        {item.title}
                      </div>
                      <p className="text-xs text-[#64748B] line-clamp-2 m-0">
                        {item.description}
                      </p>
                      {item.skillsSummary && (
                        <div className="text-[11px] text-[#64748B]">
                          {item.skillsSummary}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(item.id)}
                      aria-label={`حذف ${item.title}`}
                      className="p-1.5 text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                    >
                      <i className="bi bi-trash" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddProject}
                className="pt-3 border-t border-[#DCE5F0] space-y-2.5"
              >
                <div className="text-xs font-bold text-[#102A43]">
                  إضافة مشروع جديد للمعرض
                </div>
                <input
                  type="text"
                  required
                  placeholder="اسم المشروع"
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-xs"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="وصف المشروع ودورك فيه"
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="jusoor-textarea w-full px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="التقنيات المستخدمة (مثال: React · TypeScript)"
                  value={projSkills}
                  onChange={(e) => setProjSkills(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
                >
                  إضافة للمعرض
                </button>
              </form>
            </div>

            {/* Certificates */}
            <div className="jusoor-card p-4 p-sm-5 space-y-3">
              <h2 className="font-display text-base font-bold text-[#102A43] flex items-center gap-2 m-0">
                <i className="bi bi-award text-[#0F766E]" aria-hidden="true" />
                <span>الشهادات المعتمدة ({profData?.certificates.length ?? 0})</span>
              </h2>
              {profData?.certificates.length === 0 ? (
                <p className="text-xs text-[#64748B] m-0">
                  ستصدر الشهادات تلقائياً عند إتمام 100% من دروس أي دورة.
                </p>
              ) : (
                <div className="divide-y divide-[#EDF2F7] text-xs">
                  {profData?.certificates.map((c) => (
                    <div
                      key={c.id}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <span className="font-bold text-[#102A43]">
                        {c.title}
                      </span>
                      <span className="font-mono-num text-[#0F766E]">
                        {c.credentialCode}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payments & Earnings Sandbox Ledger */}
            <div className="jusoor-card p-4 p-sm-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#102A43] flex items-center gap-2 m-0">
                  <i className="bi bi-wallet2 text-[#247BA0]" aria-hidden="true" />
                  <span>السجل المالي والعمولات</span>
                </h2>
                <span className="text-[11px] text-[#B45309] font-bold">
                  {ledger?.gatewayConfigured
                    ? 'بوابة دفع مفعلة'
                    : 'وضع التجربة المعلق (Sandbox)'}
                </span>
              </div>
              {!ledger?.gatewayConfigured && (
                <p className="text-xs text-[#64748B] m-0">
                  بوابة الدفع الحقيقية بانتظار ضبط مفاتيح المزود؛ تُسجل المعاملات هنا بشفافية دون تنفيذ تحصيل مالي فعلي.
                </p>
              )}
              <div className="divide-y divide-[#EDF2F7] text-xs">
                {ledger?.payments.map((p) => (
                  <div
                    key={p.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-mono-num font-bold text-[#102A43]">
                        {p.paymentReference}
                      </div>
                      <div className="text-[#64748B]">
                        {({
                          COURSE_ENROLLMENT: 'تسجيل دورة',
                          TASK_OFFER: 'عرض مهمة تعليمية',
                          BOOKING: 'حجز جلسة',
                        } as Record<string, string>)[p.entityType] ||
                          p.entityType}{' '}
                        ·{' '}
                        {({
                          PENDING_SETUP: 'بانتظار تفعيل بوابة الدفع',
                          PENDING: 'قيد المراجعة',
                          HELD: 'محجوز بالضمان',
                          PAID: 'مدفوع',
                          REFUNDED: 'مسترد',
                        } as Record<string, string>)[p.status] || p.status}
                      </div>
                    </div>
                    <div className="text-end font-mono-num">
                      <div className="font-bold text-[#102A43]">${p.amount}</div>
                      <div className="text-[11px] text-[#64748B]">
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
    </div>
  );
}
