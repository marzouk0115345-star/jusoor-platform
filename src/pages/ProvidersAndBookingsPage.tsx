import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apiFetch,
  BOOKING_STATUS_LABELS_AR,
  SERVICE_TYPE_LABELS_AR,
  formatCurrencyPrice,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { TeacherSessionsBookingSection } from '../components/TeacherSessionsBookingSection';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

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
  const { user, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';
  const [searchParams, setSearchParams] = useSearchParams();

  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [mySlots, setMySlots] = useState<SlotItem[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [q, setQ] = useState(() => searchParams.get('q') || '');
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

  const handleQueryChange = (val: string) => {
    setQ(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const filteredProviders = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((p) =>
      [p.fullName, p.headline, p.bio, p.qualifications || '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [providers, q]);

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
    <div>
      <PageHeader
        kicker={isAr ? 'دليل المعلّمين والمرشدين' : 'Instructors & Mentors'}
        title={isAr ? 'المعلّمون والمرشدون والخبراء' : 'Teachers, Mentors & Experts'}
        subtitle={
          isAr
            ? 'احجز درساً خصوصياً، جلسة إرشاد عملي، أو استشارة متخصصة حسب الأوقات المتاحة فعلياً.'
            : 'Book 1:1 tutoring, practical mentorship, or specialist consultations based on real availability.'
        }
        actions={
          <div className="jusoor-tabs inline-flex flex-wrap items-center gap-1">
            {[
              { code: '', label: isAr ? 'الكل' : 'All' },
              { code: 'TEACHER', label: isAr ? 'معلّمون' : 'Teachers' },
              { code: 'MENTOR', label: isAr ? 'مرشدون' : 'Mentors' },
              { code: 'EXPERT', label: isAr ? 'خبراء' : 'Experts' },
            ].map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setTypeFilter(item.code)}
                className={`jusoor-tab-btn px-3 py-1.5 text-xs whitespace-nowrap cursor-pointer ${
                  typeFilter === item.code ? 'is-active' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-6">
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

        {/* Search Filter */}
        <div className="jusoor-card p-3 p-sm-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <i
              className="bi bi-search text-[#64748B] text-sm absolute start-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={
                isAr
                  ? 'ابحث بالاسم أو المادة أو التخصص...'
                  : 'Search by name, subject, or specialization...'
              }
              aria-label={isAr ? 'ابحث في المعلّمين' : 'Search providers'}
              className="jusoor-input w-full ps-9 pe-3 py-2 text-sm"
            />
          </div>
          <div className="text-xs text-[#64748B] font-mono-num">
            {filteredProviders.length} {isAr ? 'مقدّم خدمة' : 'providers'}
          </div>
        </div>

        {/* Providers Grid */}
        {loading ? (
          <LoadingSkeleton variant="cards" count={6} />
        ) : filteredProviders.length === 0 ? (
          <EmptyState
            icon="bi-people"
            title={isAr ? 'لا توجد نتائج مطابقة' : 'No matching providers'}
            description={
              isAr
                ? 'جرّب تغيير البحث أو عرض جميع التخصصات.'
                : 'Try adjusting your search or filter.'
            }
            action={
              (q || typeFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    handleQueryChange('');
                    setTypeFilter('');
                  }}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
                >
                  {isAr ? 'عرض جميع المعلّمين' : 'Show All Providers'}
                </button>
              )
            }
          />
        ) : (
          <div className="row g-3 g-md-4">
            {filteredProviders.map((p) => (
              <div key={p.userId} className="col-12 col-md-6 col-lg-4">
                <div className="jusoor-card jusoor-card-interactive p-4 sm:p-5 h-full flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <span className="inline-flex items-center gap-1.5">
                        <span>
                          {p.providerType === 'TEACHER'
                            ? 'معلّم'
                            : p.providerType === 'MENTOR'
                            ? 'مرشد مهني'
                            : 'خبير ومستشار'}
                        </span>
                        {p.verificationStatus === 'VERIFIED' && (
                          <span className="text-[#0F766E] font-semibold inline-flex items-center gap-1">
                            · <i className="bi bi-patch-check-fill text-[#20B8A6]" aria-hidden="true" /> موثّق
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#B45309] font-mono-num font-semibold">
                        <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                        {p.ratingAvg} ({p.reviewsCount})
                      </span>
                    </div>

                    <h2 className="font-display text-lg font-bold text-[#102A43] m-0">
                      <Link
                        to={`/instructors/${p.userId}`}
                        className="text-[#102A43] hover:text-[#247BA0]"
                      >
                        {p.fullName}
                      </Link>
                    </h2>

                    <div className="text-xs font-semibold text-[#0F766E]">
                      {p.headline}
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed line-clamp-3 m-0">
                      {p.bio}
                    </p>
                    <div>
                      <Link
                        to={`/instructors/${p.userId}`}
                        className="text-xs font-semibold text-[#247BA0] hover:underline"
                      >
                        {isAr ? 'عرض الملف والدورات' : 'View Profile & Courses'}
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[#EDF2F7]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] tabular-nums">
                        خبرة {p.yearsExperience} سنوات
                      </span>
                      <span className="font-mono-num font-bold text-[#102A43]">
                        {formatCurrencyPrice(p.hourlyRate, p.currency || 'EGP', isAr ? 'ar' : 'en')} / ساعة
                      </span>
                    </div>

                    {p.availableSlots.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#172B4D]">
                          المواعيد المتاحة للحجز:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
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
                              className="btn-jusoor-outline px-2.5 py-1.5 text-xs font-mono-num cursor-pointer"
                            >
                              {slot.slotDate} · {slot.startTime}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (p.openSessionsCount ?? 0) > 0 ? (
                      <div className="text-xs flex items-center justify-between gap-2 bg-[#E8F8F5] border border-[#99E2D8] rounded-xl px-3 py-2">
                        <span className="font-semibold text-[#0B4F4A] tabular-nums">
                          متاح {p.openSessionsCount} جلسة للحجز
                        </span>
                        <Link
                          to={`/instructors/${p.userId}`}
                          className="font-bold text-[#0F766E] hover:underline whitespace-nowrap"
                        >
                          عرض الجلسات
                        </Link>
                      </div>
                    ) : (
                      <div className="text-xs text-[#64748B]">
                        لا توجد مواعيد شاغرة حالياً
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Individual & Group Lesson Sessions Marketplace */}
        <TeacherSessionsBookingSection onBookingUpdated={loadData} />

        {/* Provider Availability Manager */}
        {isProvider && (
          <section className="jusoor-card p-4 p-sm-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
              <i className="bi bi-clock text-[#247BA0]" aria-hidden="true" />
              <span>إدارة أوقات التفرغ الخاصة بك</span>
            </h2>
            <form onSubmit={handleAddSlot} className="row g-2.5 align-items-end">
              <div className="col-6 col-sm-4 col-lg-2">
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  اليوم
                </label>
                <input
                  type="text"
                  required
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="col-6 col-sm-4 col-lg-2">
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  التاريخ
                </label>
                <input
                  type="date"
                  required
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                />
              </div>
              <div className="col-6 col-sm-4 col-lg-2">
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  من
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                />
              </div>
              <div className="col-6 col-sm-4 col-lg-2">
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  إلى
                </label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                />
              </div>
              <div className="col-6 col-sm-4 col-lg-2">
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  نوع الجلسة
                </label>
                <select
                  value={slotServiceType}
                  onChange={(e) => setSlotServiceType(e.target.value)}
                  className="jusoor-select w-full px-3 py-2 text-sm"
                >
                  <option value="PRIVATE_LESSON">درس خصوصي</option>
                  <option value="MENTORSHIP">إرشاد مهني</option>
                  <option value="CONSULTATION">استشارة</option>
                </select>
              </div>
              <div className="col-6 col-sm-4 col-lg-2">
                <button
                  type="submit"
                  className="btn-jusoor-navy w-full py-2 px-3 text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                  <span>إضافة موعد</span>
                </button>
              </div>
            </form>

            {mySlots.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {mySlots.map((s) => (
                  <div
                    key={s.id}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono-num ${
                      s.isBooked
                        ? 'bg-[#EEF4FA] border-[#DCE5F0] text-[#64748B]'
                        : 'bg-[#E8F8F5] border-[#99E2D8] text-[#0B4F4A]'
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
          <section className="jusoor-card p-4 p-sm-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#102A43] flex items-center gap-2 m-0">
              <i className="bi bi-calendar-check text-[#247BA0]" aria-hidden="true" />
              <span>حجوزاتي وجلساتي ({bookings.length})</span>
            </h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-[#64748B] m-0">لا توجد حجوزات حالياً.</p>
            ) : (
              <div className="divide-y divide-[#EDF2F7]">
                {bookings.map((b) => {
                  const isBookingProvider = b.providerUserId === user.id;
                  return (
                    <div
                      key={b.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="text-xs text-[#64748B]">
                          {SERVICE_TYPE_LABELS_AR[b.serviceType] || b.serviceType} ·{' '}
                          <span className="font-bold text-[#0F766E]">
                            {BOOKING_STATUS_LABELS_AR[b.status] || b.status}
                          </span>
                        </div>
                        <div className="font-bold text-sm text-[#102A43]">
                          {b.topic}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          الطالب: {b.studentName} · مقدّم الخدمة: {b.providerName} ·{' '}
                          <span className="font-mono-num">{b.scheduledStart}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isBookingProvider && b.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleBookingStatus(b.id, 'CONFIRMED')}
                            className="btn-jusoor-primary px-3 py-1.5 text-xs inline-flex items-center gap-1 cursor-pointer"
                          >
                            <i className="bi bi-check-lg" aria-hidden="true" />
                            <span>تأكيد</span>
                          </button>
                        )}
                        {b.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            onClick={() => handleBookingStatus(b.id, 'COMPLETED')}
                            className="btn-jusoor-navy px-3 py-1.5 text-xs cursor-pointer"
                          >
                            إتمام الجلسة
                          </button>
                        )}
                        {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                          <button
                            type="button"
                            onClick={() => handleBookingStatus(b.id, 'CANCELLED')}
                            className="btn-jusoor-outline px-3 py-1.5 text-xs cursor-pointer"
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

      {/* Booking Modal */}
      {selectedSlot && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="jusoor-card w-full max-w-md p-5 sm:p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#102A43] m-0">
              تأكيد حجز جلسة مع {selectedSlot.provider.fullName}
            </h3>
            <div className="jusoor-subcard p-3 text-xs text-[#64748B] space-y-1">
              <div>
                النوع:{' '}
                {SERVICE_TYPE_LABELS_AR[selectedSlot.slot.serviceType] ||
                  selectedSlot.slot.serviceType}
              </div>
              <div className="font-mono-num">
                الموعد: {selectedSlot.slot.dayOfWeek} {selectedSlot.slot.slotDate}{' '}
                ({selectedSlot.slot.startTime} - {selectedSlot.slot.endTime})
              </div>
              <div className="font-mono-num font-bold text-[#102A43]">
                التكلفة: ${selectedSlot.provider.hourlyRate}
              </div>
            </div>

            <form onSubmit={handleBookSlot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  موضوع الجلسة
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="مثال: مراجعة مشروع React أو خطة تعلّم"
                  className="jusoor-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  ملاحظات إضافية
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  className="btn-jusoor-primary flex-1 py-2.5 text-sm cursor-pointer"
                >
                  تأكيد الحجز
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="btn-jusoor-outline px-4 py-2.5 text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
