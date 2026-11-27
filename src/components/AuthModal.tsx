import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS_AR, apiFetch } from '../lib/api';
import { StateBanner } from './ui/StateBanner';

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    loginAsDemo,
    demoAccounts,
    taxonomy,
    loading,
  } = useAuth();

  const [tab, setTab] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [primaryRole, setPrimaryRole] = useState('STUDENT');
  const [stageId, setStageId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await registerWithEmail({
        email,
        password,
        fullName,
        primaryRole,
        stageId: stageId ? Number(stageId) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء الحساب');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const res = await apiFetch<{ message: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب');
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر إتمام تسجيل الدخول عبر Google'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="jusoor-card w-full max-w-lg p-5 sm:p-6 shadow-xl my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg bg-[#E8F8F5] text-[#0F766E] inline-flex items-center justify-center"
              aria-hidden="true"
            >
              <i className="bi bi-person-lock text-base" />
            </span>
            <h2
              id="auth-modal-title"
              className="font-display text-lg font-bold text-[#102A43] m-0"
            >
              الدخول إلى منصة جسور
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="إغلاق نافذة الدخول"
            className="w-8 h-8 rounded-lg text-[#64748B] hover:bg-[#EEF4FA] hover:text-[#102A43] inline-flex items-center justify-center cursor-pointer"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="jusoor-tabs grid grid-cols-3 gap-1 mt-4">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
              setInfo(null);
            }}
            className={`jusoor-tab-btn py-2 px-3 text-xs whitespace-nowrap cursor-pointer ${
              tab === 'login' ? 'is-active' : ''
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
              setInfo(null);
            }}
            className={`jusoor-tab-btn py-2 px-3 text-xs whitespace-nowrap cursor-pointer ${
              tab === 'register' ? 'is-active' : ''
            }`}
          >
            حساب جديد
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('reset');
              setError(null);
              setInfo(null);
            }}
            className={`jusoor-tab-btn py-2 px-3 text-xs whitespace-nowrap cursor-pointer ${
              tab === 'reset' ? 'is-active' : ''
            }`}
          >
            استعادة كلمة المرور
          </button>
        </div>

        {error && (
          <div className="mt-4">
            <StateBanner variant="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {info && (
          <div className="mt-4">
            <StateBanner variant="success" message={info} onDismiss={() => setInfo(null)} />
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-[#172B4D] mb-1"
              >
                البريد الإلكتروني
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#172B4D] mb-1"
              >
                كلمة المرور
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-jusoor-primary w-full py-2.5 px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <i className="bi bi-box-arrow-in-left" aria-hidden="true" />
              <span>{loading ? 'جارٍ الدخول...' : 'دخول بالبريد الإلكتروني'}</span>
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="reg-name"
                className="block text-xs font-semibold text-[#172B4D] mb-1"
              >
                الاسم الكامل
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أحمد العبدالله"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold text-[#172B4D] mb-1"
              >
                البريد الإلكتروني
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-semibold text-[#172B4D] mb-1"
              >
                كلمة المرور (8 أحرف على الأقل)
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="row g-3">
              <div className={primaryRole === 'STUDENT' ? 'col-12 col-sm-6' : 'col-12'}>
                <label
                  htmlFor="reg-role"
                  className="block text-xs font-semibold text-[#172B4D] mb-1"
                >
                  الدور الرئيسي
                </label>
                <select
                  id="reg-role"
                  value={primaryRole}
                  onChange={(e) => setPrimaryRole(e.target.value)}
                  className="jusoor-select w-full px-3 py-2 text-sm"
                >
                  <option value="STUDENT">طالب / متعلّم</option>
                  <option value="TEACHER">معلّم / مدرّب</option>
                  <option value="MENTOR">مرشد مهني</option>
                  <option value="EXPERT">خبير / مستشار</option>
                  <option value="CENTER_OWNER">مالك مركز تعليمي</option>
                </select>
              </div>
              {primaryRole === 'STUDENT' && (
                <div className="col-12 col-sm-6">
                  <label
                    htmlFor="reg-stage"
                    className="block text-xs font-semibold text-[#172B4D] mb-1"
                  >
                    المرحلة التعليمية
                  </label>
                  <select
                    id="reg-stage"
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="">اختر المرحلة</option>
                    {taxonomy?.stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-jusoor-primary w-full py-2.5 px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <i className="bi bi-person-plus" aria-hidden="true" />
              <span>{loading ? 'جارٍ التسجيل...' : 'إنشاء الحساب'}</span>
            </button>
          </form>
        )}

        {tab === 'reset' && (
          <form onSubmit={handleReset} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold text-[#172B4D] mb-1"
              >
                البريد الإلكتروني المسجل
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="btn-jusoor-navy w-full py-2.5 px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <i className="bi bi-key" aria-hidden="true" />
              <span>طلب إعادة تعيين كلمة المرور</span>
            </button>
          </form>
        )}

        {/* Google Sign-In */}
        <div className="mt-4 pt-4 border-t border-[#DCE5F0]">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="btn-jusoor-outline w-full py-2.5 px-4 text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="bi bi-google text-[#247BA0]" aria-hidden="true" />
            <span>المتابعة عبر حساب Google</span>
          </button>
        </div>

        {/* Clearly Labeled Demo Personas Switcher */}
        {demoAccounts.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#DCE5F0]">
            <div className="text-xs font-bold text-[#102A43] mb-2 flex items-center gap-1.5">
              <i className="bi bi-people-fill text-[#0F766E]" aria-hidden="true" />
              <span>حسابات العرض التجريبية (دخول سريع للتجربة)</span>
            </div>
            <div className="row g-2 max-h-48 overflow-y-auto">
              {demoAccounts.map((acc) => (
                <div key={acc.id} className="col-12 col-sm-6">
                  <button
                    type="button"
                    onClick={() => loginAsDemo(acc.email)}
                    className="w-full text-start p-2.5 rounded-lg border border-[#DCE5F0] bg-[#F5F8FC] hover:border-[#247BA0] hover:bg-[#E8F8F5]/60 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-bold text-[#102A43] truncate">
                      {acc.fullName}
                    </div>
                    <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                      {acc.roles.map((r) => ROLE_LABELS_AR[r] || r).join(' · ')}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
