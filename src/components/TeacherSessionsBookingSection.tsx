import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  User,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import {
  apiFetch,
  SESSION_TYPE_LABELS_AR,
  SESSION_STATUS_LABELS_AR,
  ENROLLMENT_STATUS_LABELS_AR,
  DELIVERY_MODE_LABELS_AR,
  formatSessionDateRange,
  type TeachingSessionItem,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface TeacherSessionsBookingSectionProps {
  teacherId?: number;
  subjectId?: number | null;
  curriculumSubjectId?: number | null;
  gradeId?: number | null;
  title?: string;
  subtitle?: string;
  showTeacherName?: boolean;
  onBookingUpdated?: () => void;
}

export function TeacherSessionsBookingSection({
  teacherId,
  subjectId,
  curriculumSubjectId,
  gradeId,
  title = 'الجلسات الفردية والجماعية المتاحة للحجز',
  subtitle = 'اختر جلسة فردية (1:1) أو انضم إلى جلسة جماعية تفاعلية وأرسل طلب التسجيل.',
  showTeacherName = true,
  onBookingUpdated,
}: TeacherSessionsBookingSectionProps) {
  const { user, openAuthModal } = useAuth();
  const [sessions, setSessions] = useState<TeachingSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ONE_TO_ONE' | 'GROUP'>(
    'ALL'
  );
  const [deliveryFilter, setDeliveryFilter] = useState<string>('');
  const [requestModalSession, setRequestModalSession] =
    useState<TeachingSessionItem | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (teacherId) params.set('teacherId', String(teacherId));
      if (subjectId) params.set('subjectId', String(subjectId));
      if (curriculumSubjectId) {
        params.set('curriculumSubjectId', String(curriculumSubjectId));
      }
      if (gradeId) params.set('gradeId', String(gradeId));
      if (typeFilter !== 'ALL') params.set('sessionType', typeFilter);
      if (deliveryFilter) params.set('deliveryMode', deliveryFilter);
      const queryStr = params.toString();
      const res = await apiFetch<{ sessions: TeachingSessionItem[] }>(
        `/api/teaching-sessions${queryStr ? `?${queryStr}` : ''}`
      );
      setSessions(res.sessions);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, subjectId, curriculumSubjectId, gradeId, typeFilter, deliveryFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalSession) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/teaching-sessions/${requestModalSession.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      setRequestModalSession(null);
      setNotes('');
      setFeedback(
        'تم إرسال طلب الحجز بنجاح! سيقوم المدرّب بمراجعة طلبك وإشعارك فور القبول.'
      );
      await loadSessions();
      onBookingUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال طلب الحجز.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEnrollment = async (enrollmentId: number) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/session-enrollments/${enrollmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setFeedback('تم إلغاء الطلب وتحديث المقاعد المتاحة.');
      await loadSessions();
      onBookingUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الطلب.');
    }
  };

  return (
    <section
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      data-testid="teacher-sessions-booking-section"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-700" />
            <span>{title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="تصفية نوع الجلسة"
          >
            {[
              { code: 'ALL' as const, label: 'الكل' },
              { code: 'ONE_TO_ONE' as const, label: 'فردية (1:1)' },
              { code: 'GROUP' as const, label: 'جماعية' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                role="tab"
                aria-selected={typeFilter === item.code}
                onClick={() => setTypeFilter(item.code)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  typeFilter === item.code
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            value={deliveryFilter}
            onChange={(e) => setDeliveryFilter(e.target.value)}
            aria-label="طريقة تقديم الجلسة"
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
          >
            <option value="">كل طرق التقديم</option>
            <option value="ONLINE">عن بُعد (أونلاين)</option>
            <option value="IN_PERSON">حضوري</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-xs sm:text-sm text-teal-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 bg-slate-50 border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-2 bg-slate-50/50">
          <Calendar className="w-7 h-7 text-slate-400 mx-auto" />
          <div className="text-sm font-semibold text-slate-800">
            لا توجد جلسات متاحة حالياً ضمن هذا التصنيف
          </div>
          <p className="text-xs text-slate-500">
            يمكنك تجربة تغيير فلتر الجلسات الفردية أو الجماعية أو استعراض جميع المدرّبين.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sessions.map((s) => {
            const isOwnSession = user?.id === s.teacherUserId;
            const myEnr = s.myEnrollment;
            const hasActiveRequest =
              myEnr &&
              (myEnr.status === 'PENDING' || myEnr.status === 'ACCEPTED');
            const canCancel =
              hasActiveRequest &&
              s.status !== 'CANCELLED' &&
              s.status !== 'COMPLETED' &&
              Date.now() < new Date(s.startTime).getTime();

            return (
              <article
                key={s.id}
                className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 bg-white hover:border-teal-600/60 transition-colors"
                data-testid={`session-card-${s.id}`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md ${
                          s.sessionType === 'ONE_TO_ONE'
                            ? 'bg-slate-900 text-white'
                            : 'bg-teal-50 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {s.sessionType === 'ONE_TO_ONE' ? (
                          <User className="w-3.5 h-3.5" />
                        ) : (
                          <Users className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {SESSION_TYPE_LABELS_AR[s.sessionType] || s.sessionType}
                        </span>
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          s.status === 'OPEN' && s.isRegistrationOpen
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status === 'OPEN' && !s.isRegistrationOpen
                          ? 'انتهى التسجيل'
                          : SESSION_STATUS_LABELS_AR[s.status] || s.status}
                      </span>
                    </div>

                    <span className="font-mono-num font-bold text-sm text-slate-900">
                      {Number(s.price) === 0 ? 'مجانية' : `$${s.price}`}
                    </span>
                  </div>

                  <div>
                    <h3
                      className="font-display text-base font-bold text-slate-900 leading-snug"
                      dir="auto"
                    >
                      {s.title}
                    </h3>
                    {(s.subjectNameAr || s.gradeNameAr || s.stageNameAr) && (
                      <div className="text-xs text-teal-800 font-medium mt-1">
                        {[s.subjectNameAr, s.gradeNameAr || s.stageNameAr, s.systemNameAr]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    {showTeacherName && (
                      <div className="text-xs text-slate-600 mt-1">
                        المدرّب:{' '}
                        <Link
                          to={`/instructors/${s.teacherUserId}`}
                          className="font-semibold text-teal-700 hover:underline"
                        >
                          {s.teacherName}
                        </Link>
                      </div>
                    )}
                  </div>

                  {s.description && (
                    <p
                      className="text-xs text-slate-600 leading-relaxed line-clamp-2"
                      dir="auto"
                    >
                      {s.description}
                    </p>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5 font-mono-num">
                      <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span>{formatSessionDateRange(s.startTime, s.endTime)}</span>
                      <span className="text-slate-400">
                        ({s.durationMinutes} د)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {s.deliveryMode === 'ONLINE' ? (
                        <Video className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      )}
                      <span>
                        {DELIVERY_MODE_LABELS_AR[s.deliveryMode] || s.deliveryMode}
                      </span>
                      {s.location && (
                        <span className="text-slate-500">· {s.location}</span>
                      )}
                    </div>

                    {s.sessionType === 'GROUP' && (
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">
                            السعة: {s.acceptedCount} / {s.capacity} مقعد
                          </span>
                          <span className="font-semibold text-teal-800">
                            المقاعد المتبقية: {s.remainingSeats}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-700 transition-all"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((s.acceptedCount / s.capacity) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {myEnr ? (
                    <div className="flex flex-wrap items-center justify-between w-full gap-2">
                      <div className="text-xs font-semibold">
                        حالة طلبك:{' '}
                        <span
                          className={
                            myEnr.status === 'ACCEPTED'
                              ? 'text-emerald-700'
                              : myEnr.status === 'PENDING'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }
                        >
                          {ENROLLMENT_STATUS_LABELS_AR[myEnr.status] ||
                            myEnr.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {myEnr.status === 'ACCEPTED' && s.meetingUrl && (
                          <a
                            href={s.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
                          >
                            رابط الجلسة
                          </a>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelEnrollment(myEnr.id)}
                            className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : isOwnSession ? (
                    <span className="text-xs text-slate-500">
                      هذه جلستك الخاصة (إدارتها من لوحة التحكم)
                    </span>
                  ) : s.isRegistrationOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          openAuthModal();
                          return;
                        }
                        setError(null);
                        setRequestModalSession(s);
                      }}
                      className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      {s.sessionType === 'ONE_TO_ONE'
                        ? 'طلب حجز هذه الجلسة الفردية'
                        : 'طلب الانضمام إلى الجلسة الجماعية'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">
                      {s.isFull
                        ? 'اكتملت المقاعد المتاحة لهذه الجلسة'
                        : 'التسجيل مغلق حالياً'}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Request Booking Modal */}
      {requestModalSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {requestModalSession.sessionType === 'ONE_TO_ONE'
                ? 'طلب حجز جلسة فردية'
                : 'طلب انضمام لجلسة جماعية'}
            </h3>
            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-semibold text-slate-900">
                {requestModalSession.title}
              </div>
              <div>المدرّب: {requestModalSession.teacherName}</div>
              <div className="font-mono-num">
                {formatSessionDateRange(
                  requestModalSession.startTime,
                  requestModalSession.endTime
                )}
              </div>
              <div className="font-mono-num font-bold text-teal-800">
                {Number(requestModalSession.price) === 0
                  ? 'مجانية'
                  : `السعر: $${requestModalSession.price}`}
              </div>
            </div>

            <form onSubmit={handleRequestSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ملاحظات للمدرّب (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اذكر هدفك من الجلسة أو المواضيع التي تود التركيز عليها..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  {submitting ? 'جاري الإرسال...' : 'إرسال الطلب الآن'}
                </button>
                <button
                  type="button"
                  onClick={() => setRequestModalSession(null)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
