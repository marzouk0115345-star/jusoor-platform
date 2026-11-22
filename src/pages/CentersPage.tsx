import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Users, BookOpen, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';

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
  city: string;
  country: string;
  bannerUrl: string | null;
  verificationStatus: string;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            المراكز والأكاديميات التعليمية
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            مراكز تدريب معتمدة تدير فرق المدرّبين والموظفين والدورات والبرامج التطبيقية.
          </p>
        </div>

        {canCreateCenter && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 cursor-pointer self-start"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مركز تعليمي</span>
          </button>
        )}
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

      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : centers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="font-semibold text-slate-900">
            لا توجد مراكز تعليمية مسجلة بعد
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {centers.map((center) => {
            const canManage =
              Boolean(center.canManage) ||
              Boolean(
                user &&
                  (center.ownerUserId === user.id || user.roles.includes('ADMIN'))
              );
            return (
              <div
                key={center.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12"
              >
                <div className="lg:col-span-4 aspect-[16/9] lg:aspect-auto bg-slate-100">
                  <SafeImage
                    src={center.bannerUrl}
                    alt={center.name}
                    fallbackTitle={center.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="lg:col-span-8 p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">
                        {center.city} · {center.country} ·{' '}
                        {center.verificationStatus === 'VERIFIED'
                          ? 'مركز موثّق'
                          : 'قيد المراجعة'}
                      </div>
                      <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                        {center.name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 tabular-nums">
                      <span>{center.stats.coursesCount} دورات</span>
                      <span>{center.stats.membersCount} أعضاء</span>
                      <span>{center.stats.totalEnrollments} متعلّمين</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {center.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5 text-teal-700" />
                        <span>فريق المركز والمدرّبون</span>
                      </div>
                      <div className="space-y-2 text-xs text-slate-600">
                        {center.members.map((m) => {
                          const isEditingThis =
                            editingMember?.centerId === center.id &&
                            editingMember?.memberId === m.id;
                          return (
                            <div
                              key={m.id}
                              className="p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  {m.hasInstructorProfile ? (
                                    <Link
                                      to={`/instructors/${m.userId}`}
                                      className="font-semibold text-teal-800 hover:underline block truncate"
                                    >
                                      {m.fullName}
                                    </Link>
                                  ) : (
                                    <div className="font-semibold text-slate-900 truncate">
                                      {m.fullName}
                                    </div>
                                  )}
                                  <div
                                    className="text-slate-600 mt-0.5"
                                    dir="auto"
                                  >
                                    {m.jobTitle?.trim() ||
                                      CENTER_ROLE_LABELS_AR[m.memberRole] ||
                                      m.memberRole}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] text-slate-500">
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
                                      className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                                    >
                                      تعديل المسمى
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditingThis && editingMember && (
                                <form
                                  onSubmit={handleUpdateMember}
                                  className="pt-2 border-t border-slate-200 space-y-2"
                                >
                                  <div>
                                    <label
                                      htmlFor={`edit-job-title-${m.id}`}
                                      className="block text-[11px] font-medium text-slate-700 mb-1"
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
                                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
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
                                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                    >
                                      <option value="INSTRUCTOR">مدرّب</option>
                                      <option value="STAFF">موظف مركز</option>
                                      <option value="MANAGER">مدير فرعي</option>
                                    </select>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="submit"
                                      className="px-3 py-1 bg-teal-700 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                                    >
                                      حفظ التعديل
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingMember(null)}
                                      className="px-3 py-1 border border-slate-300 text-[11px] rounded-lg cursor-pointer"
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

                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                        <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                        <span>دورات المركز</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {center.courses.map((c) => (
                          <Link
                            key={c.id}
                            to={`/courses/${c.id}`}
                            className="block text-teal-700 hover:underline truncate"
                          >
                            {c.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="pt-3 border-t border-slate-100">
                      {activeCenterId === center.id ? (
                        <form
                          onSubmit={(e) => handleAddMember(e, center.id)}
                          className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label
                                htmlFor={`member-email-${center.id}`}
                                className="block text-[11px] font-medium text-slate-700 mb-1"
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
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`member-role-${center.id}`}
                                className="block text-[11px] font-medium text-slate-700 mb-1"
                              >
                                الدور الإداري بالمركز
                              </label>
                              <select
                                id={`member-role-${center.id}`}
                                value={staffRole}
                                onChange={(e) => setStaffRole(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="INSTRUCTOR">مدرّب</option>
                                <option value="STAFF">موظف مركز</option>
                                <option value="MANAGER">مدير فرعي</option>
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor={`member-job-title-${center.id}`}
                                className="block text-[11px] font-medium text-slate-700 mb-1"
                              >
                                Job Title / Specialization
                              </label>
                              <input
                                id={`member-job-title-${center.id}`}
                                type="text"
                                required
                                value={staffJobTitle}
                                onChange={(e) => setStaffJobTitle(e.target.value)}
                                placeholder="e.g. Mathematics Teacher"
                                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                dir="auto"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              إضافة العضو للمركز
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCenterId(null);
                                setStaffJobTitle('');
                              }}
                              className="px-3 py-1.5 border border-slate-300 bg-white text-xs rounded-lg cursor-pointer"
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
                          className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                        >
                          + إضافة مدرّب أو موظف وتحديد مسماه الوظيفي
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h2 className="font-display text-lg font-bold text-slate-900">
                إنشاء مركز تعليمي جديد
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="إغلاق"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCenter} className="space-y-3">
              <input
                type="text"
                required
                placeholder="اسم المركز أو الأكاديمية"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <textarea
                required
                rows={3}
                placeholder="وصف رسالة المركز وتخصصاته"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="المدينة"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="الدولة"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
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
