import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  apiFetch,
  getCenterVerificationLabelAr,
  ROLE_LABELS_AR,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AdminCurriculumManager } from '../components/AdminCurriculumManager';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';

interface AdminOverview {
  stats: {
    usersCount: number;
    realUsersCount: number;
    demoUsersCount?: number;
    qaUsersCount?: number;
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
    qaBreakdown?: {
      users: number;
      courses: number;
      tasks: number;
      bookings: number;
      centers: number;
      payments: number;
    };
  };
  settings: Array<{ key: string; value: string; description: string | null }>;
}

interface AdminUserRow {
  id: number;
  email: string;
  fullName: string;
  accountStatus: string;
  isDemo: boolean;
  recordOrigin?: 'REAL' | 'DEMO' | 'QA_TEST';
  roles: string[];
}

interface AdminModerationData {
  providers: Array<{
    userId: number;
    fullName: string;
    providerType: string;
    headline: string;
    verificationStatus: string;
    recordOrigin?: 'REAL' | 'DEMO' | 'QA_TEST';
  }>;
  centers: Array<{
    id: number;
    name: string;
    city: string;
    verificationStatus: string;
    recordOrigin?: 'REAL' | 'DEMO' | 'QA_TEST';
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
    recordOrigin?: 'REAL' | 'DEMO' | 'QA_TEST';
  }>;
}

export function AdminPage() {
  const { user, refreshTaxonomy, taxonomy, locale } = useAuth();
  const isAr = locale === 'ar';
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [modData, setModData] = useState<AdminModerationData | null>(null);
  const [newFieldAr, setNewFieldAr] = useState('');
  const [newFieldEn, setNewFieldEn] = useState('');
  const [commissionRate, setCommissionRate] = useState('10');
  const [originFilter, setOriginFilter] = useState<'LIVE' | 'REAL' | 'DEMO' | 'QA_TEST'>('LIVE');
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
      <div>
        <PageHeader
          title={isAr ? 'لوحة إدارة منصة جسور' : 'JUSOOR Admin Console'}
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-shield-exclamation"
            title={isAr ? 'منطقة محمية — خاصة بمدير المنصة' : 'Restricted Area — Admin Only'}
            description={
              isAr
                ? 'يجب تسجيل الدخول بحساب يملك صلاحية ADMIN للوصول إلى هذا القسم.'
                : 'You must sign in with an ADMIN account to access platform management.'
            }
          />
        </div>
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

  const handleVerifyCenter = async (
    centerId: number,
    centerName: string,
    status: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'UNVERIFIED'
  ) => {
    try {
      await apiFetch(`/api/admin/centers/${centerId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFeedback(
        `تم تحديث توثيق "${centerName}" إلى: ${getCenterVerificationLabelAr(status)}.`
      );
      await loadAdmin();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحديث حالة توثيق المركز.'
      );
    }
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

  const filteredUsers = usersList.filter((u) => {
    const orig = u.recordOrigin || (u.isDemo ? 'DEMO' : 'REAL');
    if (originFilter === 'LIVE') return orig !== 'QA_TEST';
    return orig === originFilter;
  });

  return (
    <div>
      <PageHeader
        kicker={isAr ? 'إدارة العمليات والجودة' : 'Platform Operations'}
        title={isAr ? 'لوحة إدارة منصة جسور' : 'JUSOOR Admin Console'}
        subtitle={
          isAr
            ? 'إدارة المستخدمين والأدوار، التوثيق، البلاغات، التصنيفات الديناميكية، والمناهج التعليمية.'
            : 'Manage users, provider verification, moderation reports, taxonomy, and Egyptian curriculum catalog.'
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

        {overview && (
          <div className="row g-3">
            <div className="col-6 col-lg-3">
              <StatCard
                label="المستخدمون (الحقيقيون)"
                value={`${overview.stats.usersCount} (${overview.stats.realUsersCount})`}
                icon="bi-people"
                accent="navy"
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="الدورات / المهام"
                value={`${overview.stats.coursesCount} / ${overview.stats.tasksCount}`}
                icon="bi-journal-bookmark"
                accent="blue"
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="البلاغات المفتوحة"
                value={overview.stats.openReportsCount}
                icon="bi-flag"
                accent="amber"
              />
            </div>
            <div className="col-6 col-lg-3">
              <StatCard
                label="حجم المعاملات / العمولة"
                value={`$${overview.stats.totalVolume} / $${overview.stats.totalCommission}`}
                icon="bi-cash-stack"
                accent="teal"
              />
            </div>
          </div>
        )}

        {/* Dynamic Taxonomy & Commission Settings */}
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <form
              onSubmit={handleAddField}
              className="jusoor-card p-4 p-sm-5 space-y-3 h-full"
            >
              <h2 className="font-display text-base font-bold text-[#102A43] m-0">
                إضافة مجال تعليمي جديد ({taxonomy?.fields.length ?? 0} مجال حالياً)
              </h2>
              <div className="row g-2.5">
                <div className="col-12 col-sm-6">
                  <input
                    type="text"
                    required
                    placeholder="الاسم بالعربية (مثال: الروبوتات)"
                    value={newFieldAr}
                    onChange={(e) => setNewFieldAr(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <input
                    type="text"
                    required
                    placeholder="الاسم بالإنجليزية (Robotics)"
                    value={newFieldEn}
                    onChange={(e) => setNewFieldEn(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn-jusoor-primary px-4 py-2 text-xs cursor-pointer"
              >
                إضافة المجال
              </button>
            </form>
          </div>

          <div className="col-12 col-lg-6">
            <form
              onSubmit={handleUpdateCommission}
              className="jusoor-card p-4 p-sm-5 space-y-3 h-full"
            >
              <h2 className="font-display text-base font-bold text-[#102A43] m-0">
                إعدادات عمولة المنصة
              </h2>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  className="jusoor-input w-32 px-3 py-2 text-sm font-mono-num"
                />
                <span className="text-sm text-[#64748B]">% من كل معاملة</span>
              </div>
              <button
                type="submit"
                className="btn-jusoor-navy px-4 py-2 text-xs cursor-pointer"
              >
                حفظ نسبة العمولة
              </button>
            </form>
          </div>
        </div>

        {/* Users Table */}
        <section className="jusoor-card p-4 p-sm-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
              إدارة المستخدمين ({filteredUsers.length})
            </h2>
            <div className="jusoor-tabs flex flex-wrap items-center gap-1 text-xs">
              {(
                [
                  ['LIVE', 'الفعلي + التجريبي'],
                  ['REAL', 'حقيقي فقط'],
                  ['DEMO', 'تجريبي فقط'],
                  ['QA_TEST', `سجلات QA (${overview?.stats.qaUsersCount ?? 0})`],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setOriginFilter(val)}
                  className={`jusoor-tab-btn px-3 py-1.5 text-xs cursor-pointer ${
                    originFilter === val ? 'is-active' : ''
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover table-jusoor text-xs">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الأدوار</th>
                  <th>التصنيف</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const orig = u.recordOrigin || (u.isDemo ? 'DEMO' : 'REAL');
                  return (
                    <tr key={u.id}>
                      <td className="font-bold text-[#102A43] whitespace-nowrap">
                        {u.fullName}
                      </td>
                      <td className="font-mono-num text-[#64748B] whitespace-nowrap">
                        {u.email}
                      </td>
                      <td className="text-[#64748B]">
                        {u.roles.map((r) => ROLE_LABELS_AR[r] || r).join(' · ')}
                      </td>
                      <td className="text-[#64748B] whitespace-nowrap">
                        {orig === 'QA_TEST'
                          ? 'اختبار QA'
                          : orig === 'DEMO'
                          ? 'تجريبي'
                          : 'حقيقي'}
                      </td>
                      <td className="font-bold whitespace-nowrap">
                        <span
                          className={
                            u.accountStatus === 'ACTIVE'
                              ? 'text-[#0F766E]'
                              : 'text-[#991B1B]'
                          }
                        >
                          {u.accountStatus === 'ACTIVE' ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className="text-[#247BA0] font-semibold hover:underline cursor-pointer"
                        >
                          {u.accountStatus === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Verifications & Reports */}
        {modData && (
          <div className="row g-4">
            <div className="col-12 col-lg-6">
              <div className="jusoor-card p-4 p-sm-5 space-y-3 h-full">
                <h2 className="font-display text-base font-bold text-[#102A43] m-0">
                  توثيق المعلّمين والخبراء
                </h2>
                <div className="divide-y divide-[#EDF2F7] text-xs">
                  {modData.providers
                    .filter((p) => (p.recordOrigin || 'REAL') !== 'QA_TEST')
                    .map((p) => (
                      <div
                        key={p.userId}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#102A43]">{p.fullName}</div>
                          <div className="text-[#64748B]">
                            {ROLE_LABELS_AR[p.providerType] || p.providerType} ·{' '}
                            {({
                              VERIFIED: 'موثّق',
                              PENDING: 'قيد المراجعة',
                              REJECTED: 'مرفوض',
                            } as Record<string, string>)[p.verificationStatus] ||
                              p.verificationStatus}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleVerifyProvider(p.userId, 'VERIFIED')}
                            className="btn-jusoor-primary px-2.5 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <i className="bi bi-check-lg" aria-hidden="true" />
                            <span>توثيق</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyProvider(p.userId, 'REJECTED')}
                            className="btn-jusoor-outline px-2.5 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <i className="bi bi-x-circle" aria-hidden="true" />
                            <span>رفض</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="jusoor-card p-4 p-sm-5 space-y-3 h-full">
                <h2 className="font-display text-base font-bold text-[#102A43] m-0">
                  توثيق المراكز التعليمية ({modData.centers.filter((c) => (c.recordOrigin || 'REAL') !== 'QA_TEST').length})
                </h2>
                <div className="divide-y divide-[#EDF2F7] text-xs">
                  {modData.centers
                    .filter((c) => (c.recordOrigin || 'REAL') !== 'QA_TEST')
                    .map((c) => (
                      <div
                        key={c.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <Link
                            to={`/centers/${c.id}`}
                            className="font-bold text-[#102A43] hover:text-[#247BA0] hover:underline"
                          >
                            {c.name}
                          </Link>
                          <div className="text-[#64748B] flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>{c.city}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-bold ${
                                c.verificationStatus === 'VERIFIED'
                                  ? 'text-[#0F766E]'
                                  : c.verificationStatus === 'REJECTED'
                                  ? 'text-[#991B1B]'
                                  : 'text-[#B45309]'
                              }`}
                            >
                              {getCenterVerificationLabelAr(c.verificationStatus)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {c.verificationStatus !== 'VERIFIED' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleVerifyCenter(c.id, c.name, 'VERIFIED')
                              }
                              className="btn-jusoor-primary px-2.5 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <i className="bi bi-patch-check-fill" aria-hidden="true" />
                              <span>توثيق كمركز موثوق</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleVerifyCenter(c.id, c.name, 'PENDING')
                              }
                              className="btn-jusoor-outline px-2.5 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                              <span>إعادة للمراجعة</span>
                            </button>
                          )}
                          {c.verificationStatus !== 'REJECTED' && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleVerifyCenter(c.id, c.name, 'REJECTED')
                              }
                              className="px-2.5 py-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <i className="bi bi-x-circle" aria-hidden="true" />
                              <span>رفض</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="jusoor-card p-4 p-sm-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#102A43] m-0">
                  البلاغات والشكاوى
                </h2>
                <div className="divide-y divide-[#EDF2F7] text-xs">
                  {modData.reports.map((r) => (
                    <div key={r.id} className="py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#102A43]">
                          {r.reason} (
                          {({
                            COURSE: 'دورة',
                            TASK: 'مهمة',
                            USER: 'مستخدم',
                            REVIEW: 'تقييم',
                          } as Record<string, string>)[r.targetType] || r.targetType}{' '}
                          #{r.targetId})
                        </span>
                        <span className="text-[#64748B] font-semibold">
                          {({
                            OPEN: 'مفتوح',
                            RESOLVED: 'تمت المعالجة',
                            DISMISSED: 'مُغلق',
                          } as Record<string, string>)[r.status] || r.status}
                        </span>
                      </div>
                      <p className="text-[#64748B] m-0">{r.details}</p>
                      {r.status === 'OPEN' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveReport(r.id, 'RESOLVED')}
                            className="btn-jusoor-navy px-2.5 py-1 text-xs cursor-pointer"
                          >
                            معالجة وإغلاق
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveReport(r.id, 'DISMISSED')}
                            className="btn-jusoor-outline px-2.5 py-1 text-xs cursor-pointer"
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
          </div>
        )}

        <AdminCurriculumManager />
      </div>
    </div>
  );
}
