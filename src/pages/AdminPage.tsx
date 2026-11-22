import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Check, XCircle } from 'lucide-react';
import { apiFetch, ROLE_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AdminCurriculumManager } from '../components/AdminCurriculumManager';

interface AdminOverview {
  stats: {
    usersCount: number;
    realUsersCount: number;
    coursesCount: number;
    publishedCoursesCount: number;
    tasksCount: number;
    openTasksCount: number;
    bookingsCount: number;
    centersCount: number;
    openReportsCount: number;
    pendingVerificationsCount: number;
    totalVolume: number;
    totalCommission: number;
  };
  settings: Array<{ key: string; value: string; description: string | null }>;
}

interface AdminUserRow {
  id: number;
  email: string;
  fullName: string;
  accountStatus: string;
  isDemo: boolean;
  roles: string[];
}

interface AdminModerationData {
  providers: Array<{
    userId: number;
    fullName: string;
    providerType: string;
    headline: string;
    verificationStatus: string;
  }>;
  centers: Array<{
    id: number;
    name: string;
    city: string;
    verificationStatus: string;
  }>;
  reports: Array<{
    id: number;
    targetType: string;
    targetId: number;
    reason: string;
    details: string;
    status: string;
  }>;
  payments: Array<{
    id: number;
    paymentReference: string;
    entityType: string;
    amount: string;
    commissionAmount: string;
    status: string;
    paymentMode: string;
  }>;
}

export function AdminPage() {
  const { user, refreshTaxonomy, taxonomy } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [modData, setModData] = useState<AdminModerationData | null>(null);
  const [newFieldAr, setNewFieldAr] = useState('');
  const [newFieldEn, setNewFieldEn] = useState('');
  const [commissionRate, setCommissionRate] = useState('10');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.roles.includes('ADMIN');

  const loadAdmin = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [ov, us, mod] = await Promise.all([
        apiFetch<AdminOverview>('/api/admin/overview'),
        apiFetch<{ users: AdminUserRow[] }>('/api/admin/users'),
        apiFetch<AdminModerationData>('/api/admin/moderation'),
      ]);
      setOverview(ov);
      setUsersList(us.users);
      setModData(mod);
      const comm = ov.settings.find((s) => s.key === 'commission_rate_percent');
      if (comm) setCommissionRate(comm.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل لوحة الإدارة');
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-8 h-8 text-red-600 mx-auto" />
        <h1 className="font-display text-xl font-bold text-slate-900">
          منطقة محمية — خاصة بمدير المنصة
        </h1>
        <p className="text-sm text-slate-600">
          يجب تسجيل الدخول بحساب يملك صلاحية ADMIN للوصول إلى هذا القسم.
        </p>
      </div>
    );
  }

  const handleToggleUserStatus = async (u: AdminUserRow) => {
    const next = u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await apiFetch(`/api/admin/users/${u.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ accountStatus: next }),
    });
    setFeedback(
      `تم تحديث حالة ${u.fullName} إلى ${next === 'ACTIVE' ? 'نشط' : 'موقوف'}.`
    );
    await loadAdmin();
  };

  const handleVerifyProvider = async (userId: number, status: string) => {
    await apiFetch(`/api/admin/providers/${userId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setFeedback('تم تحديث حالة توثيق مقدّم الخدمة.');
    await loadAdmin();
  };

  const handleResolveReport = async (reportId: number, status: string) => {
    await apiFetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        resolutionNote: 'تمت المراجعة من فريق الإدارة',
      }),
    });
    setFeedback('تم تحديث حالة البلاغ.');
    await loadAdmin();
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/taxonomy/fields', {
      method: 'POST',
      body: JSON.stringify({ nameAr: newFieldAr, nameEn: newFieldEn }),
    });
    setNewFieldAr('');
    setNewFieldEn('');
    await refreshTaxonomy();
    setFeedback('تمت إضافة المجال الجديد بنجاح دون الحاجة لتعديل الكود.');
  };

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        key: 'commission_rate_percent',
        value: commissionRate,
      }),
    });
    setFeedback(`تم تحديث عمولة المنصة إلى ${commissionRate}%.`);
    await loadAdmin();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
          لوحة إدارة منصة جسور
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          إدارة المستخدمين والأدوار، التوثيق، البلاغات، التصنيفات الديناميكية، والمراقبة المالية.
        </p>
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

      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">المستخدمون (الحقيقيون)</div>
            <div className="font-mono-num text-2xl font-extrabold text-slate-900 mt-1">
              {overview.stats.usersCount} ({overview.stats.realUsersCount})
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">الدورات / المهام</div>
            <div className="font-mono-num text-2xl font-extrabold text-slate-900 mt-1">
              {overview.stats.coursesCount} / {overview.stats.tasksCount}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">البلاغات المفتوحة</div>
            <div className="font-mono-num text-2xl font-extrabold text-amber-700 mt-1">
              {overview.stats.openReportsCount}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="text-xs text-slate-500">حجم المعاملات / العمولة</div>
            <div className="font-mono-num text-xl font-extrabold text-teal-700 mt-1">
              ${overview.stats.totalVolume} / ${overview.stats.totalCommission}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Taxonomy & Commission Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAddField}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
        >
          <h2 className="font-display text-base font-bold text-slate-900">
            إضافة مجال تعليمي جديد ({taxonomy?.fields.length ?? 0} مجال حالياً)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="الاسم بالعربية (مثال: الروبوتات)"
              value={newFieldAr}
              onChange={(e) => setNewFieldAr(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              placeholder="الاسم بالإنجليزية (Robotics)"
              value={newFieldEn}
              onChange={(e) => setNewFieldEn(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            إضافة المجال
          </button>
        </form>

        <form
          onSubmit={handleUpdateCommission}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-3"
        >
          <h2 className="font-display text-base font-bold text-slate-900">
            إعدادات عمولة المنصة
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="50"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="w-32 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
            />
            <span className="text-sm text-slate-600">% من كل معاملة</span>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            حفظ نسبة العمولة
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 overflow-x-auto">
        <h2 className="font-display text-lg font-bold text-slate-900">
          إدارة المستخدمين ({usersList.length})
        </h2>
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2 px-2">الاسم</th>
              <th className="py-2 px-2">البريد</th>
              <th className="py-2 px-2">الأدوار</th>
              <th className="py-2 px-2">النوع</th>
              <th className="py-2 px-2">الحالة</th>
              <th className="py-2 px-2">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersList.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-2 font-semibold text-slate-900">
                  {u.fullName}
                </td>
                <td className="py-2.5 px-2 font-mono-num text-slate-600">
                  {u.email}
                </td>
                <td className="py-2.5 px-2 text-slate-600">
                  {u.roles.map((r) => ROLE_LABELS_AR[r] || r).join(' · ')}
                </td>
                <td className="py-2.5 px-2 text-slate-500">
                  {u.isDemo ? 'تجريبي' : 'حقيقي'}
                </td>
                <td className="py-2.5 px-2 font-semibold">
                  {u.accountStatus === 'ACTIVE' ? 'نشط' : 'موقوف'}
                </td>
                <td className="py-2.5 px-2">
                  <button
                    type="button"
                    onClick={() => handleToggleUserStatus(u)}
                    className="text-teal-700 hover:underline cursor-pointer"
                  >
                    {u.accountStatus === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verifications & Reports */}
      {modData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              توثيق المعلّمين والخبراء
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              {modData.providers.map((p) => (
                <div
                  key={p.userId}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900">{p.fullName}</div>
                    <div className="text-slate-500">
                      {ROLE_LABELS_AR[p.providerType] || p.providerType} ·{' '}
                      {({
                        VERIFIED: 'موثّق',
                        PENDING: 'قيد المراجعة',
                        REJECTED: 'مرفوض',
                      } as Record<string, string>)[p.verificationStatus] ||
                        p.verificationStatus}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleVerifyProvider(p.userId, 'VERIFIED')}
                      className="px-2.5 py-1 bg-teal-700 text-white rounded cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>توثيق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerifyProvider(p.userId, 'REJECTED')}
                      className="px-2.5 py-1 border border-slate-300 text-slate-700 rounded cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>رفض</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              البلاغات والشكاوى
            </h2>
            <div className="divide-y divide-slate-100 text-xs">
              {modData.reports.map((r) => (
                <div key={r.id} className="py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {r.reason} (
                      {({
                        COURSE: 'دورة',
                        TASK: 'مهمة',
                        USER: 'مستخدم',
                        REVIEW: 'تقييم',
                      } as Record<string, string>)[r.targetType] || r.targetType}{' '}
                      #{r.targetId})
                    </span>
                    <span className="text-slate-500">
                      {({
                        OPEN: 'مفتوح',
                        RESOLVED: 'تمت المعالجة',
                        DISMISSED: 'مُغلق',
                      } as Record<string, string>)[r.status] || r.status}
                    </span>
                  </div>
                  <p className="text-slate-600">{r.details}</p>
                  {r.status === 'OPEN' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolveReport(r.id, 'RESOLVED')}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded cursor-pointer"
                      >
                        معالجة وإغلاق
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveReport(r.id, 'DISMISSED')}
                        className="px-2.5 py-1 border border-slate-300 rounded cursor-pointer"
                      >
                        تجاهل
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AdminCurriculumManager />
    </div>
  );
}
