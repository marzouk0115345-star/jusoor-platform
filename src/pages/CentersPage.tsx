import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, getCenterVerificationLabelAr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface CenterMemberItem {
  id: number;
  userId: number;
  memberRole: string;
  jobTitle: string;
  permissionsJson: string[];
  fullName: string;
  email?: string;
  hasInstructorProfile?: boolean;
}

interface CenterItem {
  id: number;
  name: string;
  description: string;
  governorate?: string | null;
  city: string;
  country: string;
  street?: string | null;
  buildingDetails?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  googleMapsUrl?: string | null;
  phone?: string | null;
  bannerUrl: string | null;
  logoUrl?: string | null;
  verificationStatus: string;
  verificationLabelAr?: string;
  ownerUserId: number;
  ownerName: string;
  canManage?: boolean;
  members: CenterMemberItem[];
  courses: Array<{
    id: number;
    title: string;
    price: string;
    status: string;
    level: string;
  }>;
  stats: {
    membersCount: number;
    coursesCount: number;
    totalEnrollments: number;
  };
}

const CENTER_ROLE_LABELS_AR: Record<string, string> = {
  OWNER: 'مالك المركز',
  MANAGER: 'مدير فرعي',
  INSTRUCTOR: 'مدرّب',
  STAFF: 'موظف مركز',
};

export function CentersPage() {
  const { user } = useAuth();
  const [centers, setCenters] = useState<CenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('INSTRUCTOR');
  const [staffJobTitle, setStaffJobTitle] = useState('');
  const [activeCenterId, setActiveCenterId] = useState<number | null>(null);
  const [editingMember, setEditingMember] = useState<{
    centerId: number;
    memberId: number;
    memberName: string;
    memberRole: string;
    jobTitle: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreateCenter =
    user &&
    (user.roles.includes('CENTER_OWNER') || user.roles.includes('ADMIN'));

  const loadCenters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ centers: CenterItem[] }>('/api/centers');
      setCenters(res.centers);
    } catch {
      setCenters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCenters();
  }, [loadCenters]);

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/centers', {
        method: 'POST',
        body: JSON.stringify({ name, description, city, country }),
      });
      setShowCreate(false);
      setName('');
      setDescription('');
      setCity('');
      setCountry('');
      setFeedback('تم إنشاء المركز التعليمي بنجاح.');
      await loadCenters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء المركز');
    }
  };

  const handleAddMember = async (e: React.FormEvent, centerId: number) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    const trimmedJobTitle = staffJobTitle.trim();
    if (trimmedJobTitle.length < 2) {
      setError('المسمى الوظيفي أو التخصص مطلوب (حرفان على الأقل).');
      return;
    }
    try {
      await apiFetch(`/api/centers/${centerId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          email: staffEmail.trim(),
          memberRole: staffRole,
          jobTitle: trimmedJobTitle,
          permissions:
            staffRole === 'INSTRUCTOR'
              ? ['MANAGE_COURSES']
              : staffRole === 'MANAGER'
              ? ['MANAGE_STAFF', 'MANAGE_COURSES', 'VIEW_ENROLLMENTS']
              : ['VIEW_ENROLLMENTS', 'MANAGE_COURSES'],
        }),
      });
      setStaffEmail('');
      setStaffJobTitle('');
      setActiveCenterId(null);
      setFeedback('تمت إضافة العضو وتحديد مسماه الوظيفي وصلاحياته في المركز.');
      await loadCenters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة العضو');
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setError(null);
    setFeedback(null);
    const trimmedJobTitle = editingMember.jobTitle.trim();
    if (trimmedJobTitle.length < 2) {
      setError('المسمى الوظيفي أو التخصص مطلوب (حرفان على الأقل).');
      return;
    }
    try {
      await apiFetch(
        `/api/centers/${editingMember.centerId}/members/${editingMember.memberId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            jobTitle: trimmedJobTitle,
            ...(editingMember.memberRole !== 'OWNER'
              ? { memberRole: editingMember.memberRole }
              : {}),
          }),
        }
      );
      setEditingMember(null);
      setFeedback('تم تحديث المسمى الوظيفي ودور العضو بنجاح.');
      await loadCenters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث بيانات العضو');
    }
  };

  return (
    <div>
      <PageHeader
        kicker="الأكاديميات ومراكز التدريب المعتمدة"
        title="المراكز والأكاديميات التعليمية"
        subtitle="مراكز تدريب معتمدة تدير فرق المدرّبين والموظفين والدورات والبرامج التطبيقية."
        actions={
          canCreateCenter && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn-jusoor-primary px-4 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              <span>تسجيل مركز تعليمي</span>
            </button>
          )
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

        {loading ? (
          <LoadingSkeleton variant="list" count={3} />
        ) : centers.length === 0 ? (
          <EmptyState
            icon="bi-building"
            title="لا توجد مراكز تعليمية مسجلة بعد"
            description="يمكن لمالكي المراكز إنشاء ملف أكاديمي وإضافة المدرّبين والدورات."
          />
        ) : (
          <div className="space-y-5">
            {centers.map((center) => {
              const canManage =
                Boolean(center.canManage) ||
                Boolean(
                  user &&
                    (center.ownerUserId === user.id || user.roles.includes('ADMIN'))
                );
              return (
                <div key={center.id} className="jusoor-card overflow-hidden">
                  <div className="row g-0">
                    <div className="col-12 col-lg-4">
                      <Link
                        to={`/centers/${center.id}`}
                        className="block aspect-[16/9] lg:aspect-auto h-full bg-[#EEF4FA] overflow-hidden"
                      >
                        <SafeImage
                          src={center.bannerUrl}
                          alt={center.name}
                          fallbackTitle={center.name}
                          className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                        />
                      </Link>
                    </div>

                    <div className="col-12 col-lg-8 p-4 sm:p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <i className="bi bi-geo-alt text-[#247BA0]" aria-hidden="true" />
                              <span>
                                {center.fullAddress || `${center.city} · ${center.country}`}
                              </span>
                            </span>
                            {center.verificationStatus === 'VERIFIED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E8F8F5] text-[#0F766E] border border-[#B2EAE0] font-bold text-[11px]">
                                <i className="bi bi-patch-check-fill" aria-hidden="true" />
                                <span>مركز موثوق</span>
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold text-[11px] ${
                                  center.verificationStatus === 'REJECTED'
                                    ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                                    : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                }`}
                              >
                                {center.verificationLabelAr ||
                                  getCenterVerificationLabelAr(center.verificationStatus)}
                              </span>
                            )}
                          </div>
                          <h2 className="font-display text-xl font-bold text-[#102A43] mt-1 mb-0">
                            <Link
                              to={`/centers/${center.id}`}
                              className="text-[#102A43] hover:text-[#247BA0] transition-colors"
                            >
                              {center.name}
                            </Link>
                          </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#64748B] tabular-nums">
                          <span>{center.stats.coursesCount} دورات</span>
                          <span>{center.stats.membersCount} أعضاء</span>
                          <span>{center.stats.totalEnrollments} متعلّمين</span>
                          <Link
                            to={`/centers/${center.id}`}
                            className="btn-jusoor-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                          >
                            <i className="bi bi-building" aria-hidden="true" />
                            <span>عرض ملف المركز</span>
                          </Link>
                          {center.googleMapsUrl && (
                            <a
                              href={center.googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-jusoor-outline px-2.5 py-1.5 text-xs inline-flex items-center gap-1"
                              title="عرض الموقع على خرائط جوجل"
                            >
                              <i className="bi bi-map text-[#0F766E]" aria-hidden="true" />
                              <span>الخريطة</span>
                            </a>
                          )}
                          {canManage && (
                            <Link
                              to={`/centers/${center.id}/dashboard`}
                              className="btn-jusoor-primary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <i className="bi bi-building-gear" aria-hidden="true" />
                              <span>لوحة إدارة المركز</span>
                            </Link>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-[#172B4D] leading-relaxed m-0">
                        {center.description}
                      </p>

                      <div className="row g-4 pt-3 border-t border-[#EDF2F7]">
                        <div className="col-12 col-md-6">
                          <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5 mb-2">
                            <i className="bi bi-people text-[#0F766E]" aria-hidden="true" />
                            <span>فريق المركز والمدرّبون</span>
                          </div>
                          <div className="space-y-2 text-xs text-[#64748B]">
                            {center.members.map((m) => {
                              const isEditingThis =
                                editingMember?.centerId === center.id &&
                                editingMember?.memberId === m.id;
                              return (
                                <div
                                  key={m.id}
                                  className="jusoor-subcard p-2.5 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      {m.hasInstructorProfile ? (
                                        <Link
                                          to={`/instructors/${m.userId}`}
                                          className="font-bold text-[#0F766E] hover:underline block truncate"
                                        >
                                          {m.fullName}
                                        </Link>
                                      ) : (
                                        <div className="font-bold text-[#102A43] truncate">
                                          {m.fullName}
                                        </div>
                                      )}
                                      <div className="text-[#172B4D] mt-0.5" dir="auto">
                                        {m.jobTitle?.trim() ||
                                          CENTER_ROLE_LABELS_AR[m.memberRole] ||
                                          m.memberRole}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[11px] text-[#64748B]">
                                        {CENTER_ROLE_LABELS_AR[m.memberRole] ||
                                          m.memberRole}
                                      </span>
                                      {canManage && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingMember({
                                              centerId: center.id,
                                              memberId: m.id,
                                              memberName: m.fullName,
                                              memberRole: m.memberRole,
                                              jobTitle: m.jobTitle || '',
                                            })
                                          }
                                          className="text-[11px] font-semibold text-[#247BA0] hover:underline cursor-pointer"
                                        >
                                          تعديل المسمى
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {isEditingThis && editingMember && (
                                    <form
                                      onSubmit={handleUpdateMember}
                                      className="pt-2 border-t border-[#DCE5F0] space-y-2"
                                    >
                                      <div>
                                        <label
                                          htmlFor={`edit-job-title-${m.id}`}
                                          className="block text-[11px] font-semibold text-[#172B4D] mb-1"
                                        >
                                          Job Title / Specialization — المسمى الوظيفي أو التخصص
                                        </label>
                                        <input
                                          id={`edit-job-title-${m.id}`}
                                          type="text"
                                          required
                                          value={editingMember.jobTitle}
                                          onChange={(e) =>
                                            setEditingMember({
                                              ...editingMember,
                                              jobTitle: e.target.value,
                                            })
                                          }
                                          placeholder="e.g. Mathematics Teacher"
                                          className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                                          dir="auto"
                                        />
                                      </div>
                                      {editingMember.memberRole !== 'OWNER' && (
                                        <select
                                          value={editingMember.memberRole}
                                          onChange={(e) =>
                                            setEditingMember({
                                              ...editingMember,
                                              memberRole: e.target.value,
                                            })
                                          }
                                          aria-label="دور العضو في المركز"
                                          className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                                        >
                                          <option value="INSTRUCTOR">مدرّب</option>
                                          <option value="STAFF">موظف مركز</option>
                                          <option value="MANAGER">مدير فرعي</option>
                                        </select>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="submit"
                                          className="btn-jusoor-primary px-3 py-1 text-[11px] cursor-pointer"
                                        >
                                          حفظ التعديل
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingMember(null)}
                                          className="btn-jusoor-outline px-3 py-1 text-[11px] cursor-pointer"
                                        >
                                          إلغاء
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="col-12 col-md-6">
                          <div className="text-xs font-bold text-[#102A43] flex items-center gap-1.5 mb-2">
                            <i className="bi bi-book text-[#0F766E]" aria-hidden="true" />
                            <span>دورات المركز</span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {center.courses.map((c) => (
                              <Link
                                key={c.id}
                                to={`/courses/${c.id}`}
                                className="block font-semibold text-[#247BA0] hover:underline truncate"
                              >
                                {c.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <div className="pt-3 border-t border-[#EDF2F7]">
                          {activeCenterId === center.id ? (
                            <form
                              onSubmit={(e) => handleAddMember(e, center.id)}
                              className="jusoor-subcard p-3.5 space-y-3"
                            >
                              <div className="row g-2.5">
                                <div className="col-12 col-sm-4">
                                  <label
                                    htmlFor={`member-email-${center.id}`}
                                    className="block text-[11px] font-semibold text-[#172B4D] mb-1"
                                  >
                                    البريد الإلكتروني للعضو
                                  </label>
                                  <input
                                    id={`member-email-${center.id}`}
                                    type="email"
                                    required
                                    value={staffEmail}
                                    onChange={(e) => setStaffEmail(e.target.value)}
                                    placeholder="teacher@example.com"
                                    className="jusoor-input w-full px-3 py-1.5 text-xs"
                                  />
                                </div>
                                <div className="col-12 col-sm-4">
                                  <label
                                    htmlFor={`member-role-${center.id}`}
                                    className="block text-[11px] font-semibold text-[#172B4D] mb-1"
                                  >
                                    الدور الإداري بالمركز
                                  </label>
                                  <select
                                    id={`member-role-${center.id}`}
                                    value={staffRole}
                                    onChange={(e) => setStaffRole(e.target.value)}
                                    className="jusoor-select w-full px-3 py-1.5 text-xs"
                                  >
                                    <option value="INSTRUCTOR">مدرّب</option>
                                    <option value="STAFF">موظف مركز</option>
                                    <option value="MANAGER">مدير فرعي</option>
                                  </select>
                                </div>
                                <div className="col-12 col-sm-4">
                                  <label
                                    htmlFor={`member-job-title-${center.id}`}
                                    className="block text-[11px] font-semibold text-[#172B4D] mb-1"
                                  >
                                    Job Title / Specialization
                                  </label>
                                  <input
                                    id={`member-job-title-${center.id}`}
                                    type="text"
                                    required
                                    value={staffJobTitle}
                                    onChange={(e) =>
                                      setStaffJobTitle(e.target.value)
                                    }
                                    placeholder="e.g. Mathematics Teacher"
                                    className="jusoor-input w-full px-3 py-1.5 text-xs"
                                    dir="auto"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  className="btn-jusoor-primary px-4 py-1.5 text-xs cursor-pointer"
                                >
                                  إضافة العضو للمركز
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCenterId(null);
                                    setStaffJobTitle('');
                                  }}
                                  className="btn-jusoor-outline px-3 py-1.5 text-xs cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCenterId(center.id);
                                setError(null);
                              }}
                              className="text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
                            >
                              + إضافة مدرّب أو موظف وتحديد مسماه الوظيفي
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5F0]">
              <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                إنشاء مركز تعليمي جديد
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="إغلاق"
                className="w-8 h-8 text-[#64748B] hover:bg-[#EEF4FA] rounded-lg inline-flex items-center justify-center cursor-pointer"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreateCenter} className="space-y-3">
              <input
                type="text"
                required
                placeholder="اسم المركز أو الأكاديمية"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={3}
                placeholder="وصف رسالة المركز وتخصصاته"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="jusoor-textarea w-full px-3 py-2 text-sm"
              />
              <div className="row g-2.5">
                <div className="col-6">
                  <input
                    type="text"
                    required
                    placeholder="المدينة"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-6">
                  <input
                    type="text"
                    required
                    placeholder="الدولة"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn-jusoor-primary w-full py-2.5 text-sm cursor-pointer"
              >
                إنشاء المركز
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
