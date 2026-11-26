import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, Plus, Star, AlertCircle } from 'lucide-react';
import {
  apiFetch,
  BOOKING_STATUS_LABELS_AR,
  SERVICE_TYPE_LABELS_AR,
  formatCurrencyPrice,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TeacherSessionsBookingSection } from '../components/TeacherSessionsBookingSection';

interface SlotItem {
  id: number;
  dayOfWeek: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  serviceType: string;
  isBooked: boolean;
}

interface ProviderItem {
  userId: number;
  fullName: string;
  providerType: string;
  headline: string;
  bio: string;
  qualifications: string | null;
  yearsExperience: number;
  hourlyRate: string;
  currency?: string;
  verificationStatus: string;
  ratingAvg: string;
  reviewsCount: number;
  availableSlots: SlotItem[];
  openSessionsCount?: number;
}

interface BookingItem {
  id: number;
  studentUserId: number;
  providerUserId: number;
  studentName: string;
  providerName: string;
  serviceType: string;
  topic: string;
  scheduledStart: string;
  scheduledEnd: string;
  price: string;
  status: string;
  session: { meetingLink: string | null } | null;
}

export function ProvidersAndBookingsPage() {
  const { user, openAuthModal } = useAuth();
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [mySlots, setMySlots] = useState<SlotItem[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<{
    slot: SlotItem;
    provider: ProviderItem;
  } | null>(null);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add availability slot state (for providers)
  const [slotDate, setSlotDate] = useState('2026-12-02');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [dayOfWeek, setDayOfWeek] = useState('الأربعاء');
  const [slotServiceType, setSlotServiceType] = useState('MENTORSHIP');

  const isProvider =
    user &&
    user.roles.some((r) => ['TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'].includes(r));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pUrl = typeFilter
        ? `/api/providers?type=${typeFilter}`
        : '/api/providers';
      const pRes = await apiFetch<{ providers: ProviderItem[] }>(pUrl);
      setProviders(pRes.providers);

      if (user) {
        const bRes = await apiFetch<{ bookings: BookingItem[] }>('/api/bookings');
        setBookings(bRes.bookings);
        if (isProvider) {
          const sRes = await apiFetch<{ slots: SlotItem[] }>(
            '/api/availability/mine'
          );
          setMySlots(sRes.slots);
        }
      } else {
        setBookings([]);
        setMySlots([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [typeFilter, user, isProvider]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          availabilityId: selectedSlot.slot.id,
          topic,
          notes,
        }),
      });
      setSelectedSlot(null);
      setTopic('');
      setNotes('');
      setFeedback('تم إرسال طلب الحجز وحجز الموعد بنجاح.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إتمام الحجز');
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      await apiFetch('/api/availability', {
        method: 'POST',
        body: JSON.stringify({
          dayOfWeek,
          slotDate,
          startTime,
          endTime,
          serviceType: slotServiceType,
        }),
      });
      setFeedback('تمت إضافة وقت التفرغ الجديد لجدولك.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الموعد');
    }
  };

  const handleBookingStatus = async (bookingId: number, status: string) => {
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setFeedback('تم تحديث حالة الحجز.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الحجز');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            المعلّمون والمرشدون والخبراء
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            احجز درساً خصوصياً، جلسة إرشاد عملي، أو استشارة متخصصة حسب الأوقات المتاحة فعلياً.
          </p>
        </div>

        {/* Segmented Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {[
            { code: '', label: 'الكل' },
            { code: 'TEACHER', label: 'معلّمون' },
            { code: 'MENTOR', label: 'مرشدون' },
            { code: 'EXPERT', label: 'خبراء' },
          ].map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setTypeFilter(item.code)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === item.code
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-900">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Providers Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((p) => (
            <div
              key={p.userId}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {p.providerType === 'TEACHER'
                      ? 'معلّم'
                      : p.providerType === 'MENTOR'
                      ? 'مرشد مهني'
                      : 'خبير ومستشار'}
                    {p.verificationStatus === 'VERIFIED' && ' · موثّق'}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 font-mono-num">
                    <Star className="w-3.5 h-3.5 fill-amber-500" />
                    {p.ratingAvg} ({p.reviewsCount})
                  </span>
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  <Link
                    to={`/instructors/${p.userId}`}
                    className="hover:text-teal-700 hover:underline"
                  >
                    {p.fullName}
                  </Link>
                </h2>
                <div className="text-xs font-semibold text-teal-800">
                  {p.headline}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {p.bio}
                </p>
                <div className="pt-1">
                  <Link
                    to={`/instructors/${p.userId}`}
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    عرض الملف والدورات
                  </Link>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    خبرة {p.yearsExperience} سنوات
                  </span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {formatCurrencyPrice(p.hourlyRate, p.currency || 'EGP', 'ar')} / ساعة
                  </span>
                </div>

                {p.availableSlots.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-700">
                      المواعيد المتاحة للحجز:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.availableSlots.slice(0, 3).map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => {
                            if (!user) {
                              openAuthModal();
                              return;
                            }
                            setSelectedSlot({ slot, provider: p });
                          }}
                          className="px-2.5 py-1.5 text-xs font-mono-num border border-slate-300 hover:border-teal-700 hover:bg-teal-50 rounded-lg text-slate-800 cursor-pointer"
                        >
                          {slot.slotDate} · {slot.startTime}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (p.openSessionsCount ?? 0) > 0 ? (
                  <div className="text-xs flex items-center justify-between gap-2 bg-teal-50/60 border border-teal-200/80 rounded-lg px-3 py-2">
                    <span className="font-semibold text-teal-900 tabular-nums">
                      متاح {p.openSessionsCount} جلسة للحجز
                    </span>
                    <Link
                      to={`/instructors/${p.userId}`}
                      className="font-bold text-teal-700 hover:underline whitespace-nowrap"
                    >
                      عرض الجلسات
                    </Link>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    لا توجد مواعيد شاغرة حالياً
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Individual & Group Lesson Sessions Marketplace */}
      <TeacherSessionsBookingSection onBookingUpdated={loadData} />

      {/* Booking Modal */}
      {selectedSlot && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">
              تأكيد حجز جلسة مع {selectedSlot.provider.fullName}
            </h3>
            <div className="text-xs text-slate-600 space-y-1">
              <div>
                النوع:{' '}
                {SERVICE_TYPE_LABELS_AR[selectedSlot.slot.serviceType] ||
                  selectedSlot.slot.serviceType}
              </div>
              <div className="font-mono-num">
                الموعد: {selectedSlot.slot.dayOfWeek} {selectedSlot.slot.slotDate}{' '}
                ({selectedSlot.slot.startTime} - {selectedSlot.slot.endTime})
              </div>
              <div className="font-mono-num font-semibold text-slate-900">
                التكلفة: ${selectedSlot.provider.hourlyRate}
              </div>
            </div>

            <form onSubmit={handleBookSlot} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  موضوع الجلسة
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="مثال: مراجعة مشروع React أو خطة تعلّم"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                >
                  تأكيد الحجز
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provider Availability Manager */}
      {isProvider && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-700" />
            <span>إدارة أوقات التفرغ الخاصة بك</span>
          </h2>
          <form
            onSubmit={handleAddSlot}
            className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                اليوم
              </label>
              <input
                type="text"
                required
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                التاريخ
              </label>
              <input
                type="date"
                required
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                من
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                إلى
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                نوع الجلسة
              </label>
              <select
                value={slotServiceType}
                onChange={(e) => setSlotServiceType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="PRIVATE_LESSON">درس خصوصي</option>
                <option value="MENTORSHIP">إرشاد مهني</option>
                <option value="CONSULTATION">استشارة</option>
              </select>
            </div>
            <button
              type="submit"
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موعد</span>
            </button>
          </form>

          {mySlots.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {mySlots.map((s) => (
                <div
                  key={s.id}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono-num ${
                    s.isBooked
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : 'bg-teal-50 border-teal-200 text-teal-900'
                  }`}
                >
                  {s.slotDate} {s.startTime} ({s.isBooked ? 'محجوز' : 'متاح'})
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* User's Bookings */}
      {user && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-700" />
            <span>حجوزاتي وجلساتي ({bookings.length})</span>
          </h2>
          {bookings.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد حجوزات حالياً.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {bookings.map((b) => {
                const isBookingProvider = b.providerUserId === user.id;
                return (
                  <div
                    key={b.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">
                        {SERVICE_TYPE_LABELS_AR[b.serviceType] || b.serviceType} ·{' '}
                        <span className="font-semibold text-teal-800">
                          {BOOKING_STATUS_LABELS_AR[b.status] || b.status}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-slate-900">
                        {b.topic}
                      </div>
                      <div className="text-xs text-slate-600">
                        الطالب: {b.studentName} · مقدّم الخدمة: {b.providerName} ·{' '}
                        <span className="font-mono-num">{b.scheduledStart}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isBookingProvider && b.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleBookingStatus(b.id, 'CONFIRMED')}
                          className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تأكيد</span>
                        </button>
                      )}
                      {b.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => handleBookingStatus(b.id, 'COMPLETED')}
                          className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          إتمام الجلسة
                        </button>
                      )}
                      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                        <button
                          type="button"
                          onClick={() => handleBookingStatus(b.id, 'CANCELLED')}
                          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
