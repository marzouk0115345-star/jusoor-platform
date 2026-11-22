import React, { useState } from 'react';
import { X, LogIn, UserPlus, KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS_AR, apiFetch } from '../lib/api';

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
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <h2
            id="auth-modal-title"
            className="font-display text-lg font-bold text-slate-900"
          >
            الدخول إلى منصة جسور
          </h2>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="إغلاق نافذة الدخول"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg mt-4">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
              setInfo(null);
            }}
            className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
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
            className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
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
            className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'reset'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            نسيت كلمة المرور
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {info && (
          <div className="mt-4 p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900">
            {info}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-slate-700 mb-1"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700 mb-1"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'جارٍ الدخول...' : 'دخول بالبريد الإلكتروني'}</span>
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="reg-name"
                className="block text-xs font-medium text-slate-700 mb-1"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-medium text-slate-700 mb-1"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-medium text-slate-700 mb-1"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="reg-role"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  الدور الرئيسي
                </label>
                <select
                  id="reg-role"
                  value={primaryRole}
                  onChange={(e) => setPrimaryRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  <option value="STUDENT">طالب / متعلّم</option>
                  <option value="TEACHER">معلّم / مدرّب</option>
                  <option value="MENTOR">مرشد مهني</option>
                  <option value="EXPERT">خبير / مستشار</option>
                  <option value="CENTER_OWNER">مالك مركز تعليمي</option>
                </select>
              </div>
              {primaryRole === 'STUDENT' && (
                <div>
                  <label
                    htmlFor="reg-stage"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    المرحلة التعليمية
                  </label>
                  <select
                    id="reg-stage"
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
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
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'جارٍ التسجيل...' : 'إنشاء الحساب'}</span>
            </button>
          </form>
        )}

        {tab === 'reset' && (
          <form onSubmit={handleReset} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-medium text-slate-700 mb-1"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>طلب إعادة تعيين كلمة المرور</span>
            </button>
          </form>
        )}

        {/* Google Sign-In */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>المتابعة عبر حساب Google</span>
          </button>
        </div>

        {/* Clearly Labeled Demo Personas Switcher */}
        {demoAccounts.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              حسابات العرض التجريبية (بيانات توضيحية للتجربة السريعة)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => loginAsDemo(acc.email)}
                  className="text-right p-2.5 rounded-lg border border-slate-200 hover:border-teal-600 hover:bg-teal-50/40 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {acc.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {acc.roles.map((r) => ROLE_LABELS_AR[r] || r).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
