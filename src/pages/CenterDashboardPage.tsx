import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  apiFetch,
  getCenterVerificationLabelAr,
  type CenterCourseItem,
  type CenterDashboardCenterItem,
  type CenterOverviewResponse,
  type CenterSettingsResponse,
  type CenterStudentListItem,
  type CenterTeacherItem,
  type CurriculumOverviewResponse,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { StateBanner } from '../components/ui/StateBanner';
import { SafeImage } from '../components/SafeImage';
import {
  CenterOverviewTab,
  type CenterDashboardTabKey,
} from '../components/center-dashboard/CenterOverviewTab';
import { CenterTeachersTab } from '../components/center-dashboard/CenterTeachersTab';
import { CenterStudentsTab } from '../components/center-dashboard/CenterStudentsTab';
import { CenterCoursesTab } from '../components/center-dashboard/CenterCoursesTab';
import { CenterSettingsTab } from '../components/center-dashboard/CenterSettingsTab';

interface TaxonomyResponse {
  fields: Array<{ id: number; nameAr: string }>;
  stages: Array<{ id: number; nameAr: string }>;
  subjects: Array<{ id: number; nameAr: string }>;
}

export function CenterDashboardPage() {
  const { centerId: centerIdParam } = useParams();
  const { user, openAuthModal } = useAuth();

  const [myCenters, setMyCenters] = useState<CenterDashboardCenterItem[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(
    centerIdParam ? Number(centerIdParam) : null
  );
  const [activeTab, setActiveTab] = useState<CenterDashboardTabKey>('overview');
  const [bootLoading, setBootLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  const [overview, setOverview] = useState<CenterOverviewResponse | null>(null);
  const [teachers, setTeachers] = useState<CenterTeacherItem[]>([]);
  const [students, setStudents] = useState<CenterStudentListItem[]>([]);
  const [courses, setCourses] = useState<CenterCourseItem[]>([]);
  const [settings, setSettings] = useState<CenterSettingsResponse | null>(null);

  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse>({
    fields: [],
    stages: [],
    subjects: [],
  });
  const [curriculum, setCurriculum] = useState<CurriculumOverviewResponse | null>(
    null
  );

  const [banner, setBanner] = useState<{
    variant: 'success' | 'error';
    message: string;
  } | null>(null);

  // Onboarding form if user is CENTER_OWNER with 0 centers
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createCountry, setCreateCountry] = useState('مصر');
  const [creatingCenter, setCreatingCenter] = useState(false);

  const notify = useCallback(
    (variant: 'success' | 'error', message: string) => {
      setBanner({ variant, message });
    },
    []
  );

  const loadBootstrap = useCallback(async () => {
    if (!user) {
      setBootLoading(false);
      return;
    }
    setBootLoading(true);
    try {
      const [centersRes, taxRes, currRes] = await Promise.all([
        apiFetch<{ centers: CenterDashboardCenterItem[] }>(
          '/api/center-dashboard/my-centers'
        ),
        apiFetch<TaxonomyResponse>('/api/taxonomy'),
        apiFetch<CurriculumOverviewResponse>('/api/curriculum/overview').catch(
          () => null
        ),
      ]);
      setMyCenters(centersRes.centers);
      setTaxonomy(taxRes);
      if (currRes) setCurriculum(currRes);

      if (centersRes.centers.length > 0) {
        const paramId = centerIdParam ? Number(centerIdParam) : null;
        const found = paramId
          ? centersRes.centers.find((c) => c.id === paramId)
          : undefined;
        setSelectedCenterId((prev) => {
          if (found) return found.id;
          if (prev && centersRes.centers.some((c) => c.id === prev)) return prev;
          return centersRes.centers[0].id;
        });
      } else {
        setSelectedCenterId(null);
      }
    } catch (err) {
      notify(
        'error',
        err instanceof Error
          ? err.message
          : 'تعذر تحميل بيانات لوحة تحكم المركز.'
      );
    } finally {
      setBootLoading(false);
    }
  }, [user, centerIdParam, notify]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const activeCenter =
    myCenters.find((c) => c.id === selectedCenterId) || myCenters[0] || null;
  const activePerms = new Set(activeCenter?.callerPermissions || []);
  const isOwnerOrAdmin = Boolean(
    activeCenter?.isOwner || user?.roles.includes('ADMIN')
  );

  const hasPerm = useCallback(
    (perm: string) => isOwnerOrAdmin || activePerms.has(perm),
    [isOwnerOrAdmin, activePerms]
  );

  const loadCenterAllData = useCallback(
    async (
      cid: number,
      studentFilters?: { q?: string; stageId?: string; gradeId?: string }
    ) => {
      setTabLoading(true);
      try {
        const studentParams = new URLSearchParams();
        if (studentFilters?.q) studentParams.set('q', studentFilters.q);
        if (studentFilters?.stageId)
          studentParams.set('stageId', studentFilters.stageId);
        if (studentFilters?.gradeId)
          studentParams.set('gradeId', studentFilters.gradeId);
        const studentQuery = studentParams.toString()
          ? `?${studentParams.toString()}`
          : '';

        const [ovRes, teaRes, stuRes, crsRes, setRes] = await Promise.all([
          apiFetch<CenterOverviewResponse>(`/api/center-dashboard/${cid}/overview`).catch(
            () => null
          ),
          apiFetch<{ teachers: CenterTeacherItem[] }>(
            `/api/center-dashboard/${cid}/teachers`
          ).catch(() => ({ teachers: [] })),
          apiFetch<{ students: CenterStudentListItem[] }>(
            `/api/center-dashboard/${cid}/students${studentQuery}`
          ).catch(() => ({ students: [] })),
          apiFetch<{ courses: CenterCourseItem[] }>(
            `/api/center-dashboard/${cid}/courses`
          ).catch(() => ({ courses: [] })),
          apiFetch<CenterSettingsResponse>(
            `/api/center-dashboard/${cid}/settings`
          ).catch(() => null),
        ]);

        if (ovRes) setOverview(ovRes);
        setTeachers(teaRes.teachers);
        setStudents(stuRes.students);
        setCourses(crsRes.courses);
        if (setRes) {
          setSettings(setRes);
          setMyCenters((prev) =>
            prev.map((c) =>
              c.id === cid
                ? {
                    ...c,
                    name: setRes.center.name,
                    city: setRes.center.city,
                    country: setRes.center.country,
                    bannerUrl: setRes.center.bannerUrl,
                    logoUrl: setRes.center.logoUrl,
                    verificationStatus: setRes.center.verificationStatus,
                  }
                : c
            )
          );
        }
      } finally {
        setTabLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user && activeCenter?.id) {
      void loadCenterAllData(activeCenter.id);
    }
  }, [user?.id, activeCenter?.id, loadCenterAllData]);

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCenter(true);
    try {
      await apiFetch('/api/centers', {
        method: 'POST',
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim(),
          city: createCity.trim(),
          country: createCountry.trim(),
        }),
      });
      notify('success', 'تم إنشاء المركز التعليمي بنجاح!');
      await loadBootstrap();
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'تعذر إنشاء المركز التعليمي.'
      );
    } finally {
      setCreatingCenter(false);
    }
  };

  if (!user) {
    return (
      <div>
        <PageHeader
          title="لوحة إدارة المركز التعليمي"
          subtitle="يرجى تسجيل الدخول بحساب مالك مركز أو طاقم إداري للوصول إلى لوحة إدارة المركز."
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          <EmptyState
            icon="bi-building-gear"
            title="تسجيل الدخول مطلوب"
            description="سجّل الدخول بحساب مالك مركز (أو جرّب حساب مالك المركز التجريبي) لإدارة المعلّمين والطلاب والدورات."
            action={
              <button
                type="button"
                onClick={openAuthModal}
                className="btn-jusoor-primary px-5 py-2.5 text-sm cursor-pointer"
              >
                تسجيل الدخول الآن
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (bootLoading) {
    return (
      <div className="container-xxl px-3 px-sm-4 py-5">
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (myCenters.length === 0) {
    const canCreate =
      user.roles.includes('CENTER_OWNER') || user.roles.includes('ADMIN');
    return (
      <div>
        <PageHeader
          kicker="إدارة المراكز التعليمية"
          title="لوحة تحكم مالك المركز"
          subtitle="أنشئ مركزك التعليمي لإدارة المعلّمين والطلاب والدورات والفروع من مكان واحد."
        />
        <div className="container-xxl px-3 px-sm-4 py-5">
          {banner && (
            <div className="mb-4">
              <StateBanner
                variant={banner.variant}
                message={banner.message}
                onDismiss={() => setBanner(null)}
              />
            </div>
          )}
          {canCreate ? (
            <form
              onSubmit={handleCreateCenter}
              className="jusoor-card max-w-xl mx-auto p-5 sm:p-6 space-y-4"
            >
              <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                تأسيس مركز تعليمي جديد
              </h2>
              <input
                type="text"
                required
                minLength={3}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="اسم المركز أو الأكاديمية"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
              <textarea
                required
                minLength={10}
                rows={3}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="وصف رسالة المركز والمجالات التعليمية"
                className="jusoor-textarea w-full px-3 py-2 text-sm"
              />
              <div className="row g-3">
                <div className="col-6">
                  <input
                    type="text"
                    required
                    value={createCity}
                    onChange={(e) => setCreateCity(e.target.value)}
                    placeholder="المدينة"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-6">
                  <input
                    type="text"
                    required
                    value={createCountry}
                    onChange={(e) => setCreateCountry(e.target.value)}
                    placeholder="الدولة"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creatingCenter}
                className="btn-jusoor-primary w-full py-2.5 text-sm cursor-pointer"
              >
                {creatingCenter ? 'جارٍ الإنشاء...' : 'إنشاء المركز وتفعيل لوحة الإدارة'}
              </button>
            </form>
          ) : (
            <EmptyState
              icon="bi-shield-lock"
              title="لا تملك صلاحية إدارة مركز تعليمي"
              description="هذا القسم مخصص لمالكي المراكز التعليمية وأعضاء الطاقم المصرّح لهم فقط."
              action={
                <Link to="/dashboard" className="btn-jusoor-primary px-4 py-2 text-xs">
                  العودة إلى لوحتي الشخصية
                </Link>
              }
            />
          )}
        </div>
      </div>
    );
  }

  const navItems: Array<{
    key: CenterDashboardTabKey;
    label: string;
    icon: string;
    badge?: number;
    visible: boolean;
  }> = [
    {
      key: 'overview',
      label: 'نظرة عامة',
      icon: 'bi-grid-1x2',
      visible: hasPerm('VIEW_REPORTS'),
    },
    {
      key: 'teachers',
      label: 'إدارة المعلّمين',
      icon: 'bi-person-workspace',
      badge: teachers.length,
      visible: hasPerm('MANAGE_STAFF'),
    },
    {
      key: 'students',
      label: 'إدارة الطلاب',
      icon: 'bi-people',
      badge: students.length,
      visible: hasPerm('MANAGE_STUDENTS'),
    },
    {
      key: 'courses',
      label: 'إدارة الدورات',
      icon: 'bi-journal-bookmark',
      badge: courses.length,
      visible: hasPerm('MANAGE_COURSES'),
    },
    {
      key: 'settings',
      label: 'إعدادات المركز',
      icon: 'bi-sliders',
      visible: hasPerm('MANAGE_SETTINGS'),
    },
  ];

  const visibleNavItems = navItems.filter((n) => n.visible);

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'الرئيسية', to: '/' },
          { label: 'المراكز', to: '/centers' },
          { label: activeCenter?.name || 'لوحة إدارة المركز' },
        ]}
        kicker={`لوحة إدارة المركز التعليمي · ${
          isOwnerOrAdmin ? 'صلاحية مالك المركز الكاملة' : activeCenter?.callerRole
        }`}
        title={activeCenter?.name || 'إدارة المركز التعليمي'}
        subtitle={`${activeCenter?.city || ''} · ${activeCenter?.country || ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {myCenters.length > 1 && (
              <select
                value={selectedCenterId ?? ''}
                onChange={(e) => setSelectedCenterId(Number(e.target.value))}
                aria-label="اختر المركز"
                className="jusoor-select px-3 py-2 text-xs"
              >
                {myCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <Link
              to={activeCenter ? `/centers/${activeCenter.id}` : '/centers'}
              className="btn-jusoor-outline px-3 py-2 text-xs inline-flex items-center gap-1.5"
            >
              <i className="bi bi-eye text-[#247BA0]" aria-hidden="true" />
              <span>ملف المركز العام</span>
            </Link>
            <Link
              to="/dashboard"
              className="btn-jusoor-navy px-3 py-2 text-xs inline-flex items-center gap-1.5"
            >
              <i className="bi bi-arrow-return-right" aria-hidden="true" />
              <span>لوحتي الشخصية</span>
            </Link>
          </div>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-4">
        {banner && (
          <StateBanner
            variant={banner.variant}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        )}

        <div className="row g-4 align-items-start">
          {/* Desktop Sidebar Navigation */}
          <aside className="col-12 col-lg-3 d-none d-lg-block">
            <div className="jusoor-card p-3 sticky top-20 space-y-2">
              {activeCenter && (
                <div className="jusoor-subcard p-3 flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-lg overflow-hidden border border-[#DCE5F0] bg-[#EEF4FA] shrink-0">
                    <SafeImage
                      src={activeCenter.logoUrl || activeCenter.bannerUrl}
                      alt={activeCenter.name}
                      fallbackTitle={activeCenter.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#102A43] truncate">
                      {activeCenter.name}
                    </div>
                    <div
                      className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                        activeCenter.verificationStatus === 'VERIFIED'
                          ? 'text-[#0F766E]'
                          : activeCenter.verificationStatus === 'REJECTED'
                          ? 'text-[#991B1B]'
                          : 'text-[#B45309]'
                      }`}
                    >
                      {activeCenter.verificationStatus === 'VERIFIED' && (
                        <i className="bi bi-patch-check-fill" aria-hidden="true" />
                      )}
                      <span>
                        {getCenterVerificationLabelAr(activeCenter.verificationStatus)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {visibleNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`jusoor-sidebar-nav-btn ${
                    activeTab === item.key ? 'active' : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="font-mono-num text-xs opacity-80">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* Mobile Tab Bar */}
          <div className="col-12 d-lg-none">
            <div className="jusoor-card p-2 flex flex-wrap gap-1.5">
              {visibleNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    activeTab === item.key
                      ? 'bg-[#102A43] text-white'
                      : 'text-[#64748B] hover:bg-[#F5F8FC]'
                  }`}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Section Area */}
          <div className="col-12 col-lg-9">
            {tabLoading && !overview ? (
              <LoadingSkeleton variant="detail" />
            ) : !selectedCenterId ? null : (
              <>
                {activeTab === 'overview' && overview && (
                  <CenterOverviewTab
                    overview={overview}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'teachers' && (
                  <CenterTeachersTab
                    centerId={selectedCenterId}
                    teachers={teachers}
                    taxonomy={taxonomy}
                    curriculum={curriculum}
                    onRefresh={() => loadCenterAllData(selectedCenterId)}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'students' && (
                  <CenterStudentsTab
                    centerId={selectedCenterId}
                    students={students}
                    courses={courses}
                    stages={taxonomy.stages}
                    curriculum={curriculum}
                    onRefresh={(filters) =>
                      loadCenterAllData(selectedCenterId, filters)
                    }
                    onNotify={notify}
                  />
                )}

                {activeTab === 'courses' && (
                  <CenterCoursesTab
                    centerId={selectedCenterId}
                    courses={courses}
                    teachers={teachers}
                    taxonomy={taxonomy}
                    curriculum={curriculum}
                    onRefresh={() => loadCenterAllData(selectedCenterId)}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'settings' && settings && (
                  <CenterSettingsTab
                    centerId={selectedCenterId}
                    settings={settings}
                    onRefresh={() => loadCenterAllData(selectedCenterId)}
                    onNotify={notify}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
