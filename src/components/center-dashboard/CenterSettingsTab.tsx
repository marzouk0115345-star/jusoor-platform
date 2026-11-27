import React, { useEffect, useState } from 'react';
import {
  apiFetch,
  buildGoogleMapsSearchUrl,
  getCenterVerificationLabelAr,
  parseCoordinatesFromMapsInput,
  validateCoordinates,
  WEEKDAY_LABELS_AR,
  type CenterBookingPolicies,
  type CenterBranchItem,
  type CenterNotificationSettings,
  type CenterRoomItem,
  type CenterSettingsResponse,
  type CenterWorkingHourItem,
} from '../../lib/api';
import { CourseImageUploadField } from './CourseImageUploadField';

interface CenterSettingsTabProps {
  centerId: number;
  settings: CenterSettingsResponse;
  onRefresh: () => Promise<void>;
  onNotify: (variant: 'success' | 'error', msg: string) => void;
}

type SettingsSubTab =
  | 'basic'
  | 'hours'
  | 'branches'
  | 'policies'
  | 'notifications'
  | 'permissions';

const PERMISSION_LABELS_AR: Array<{ key: string; label: string }> = [
  { key: 'MANAGE_STAFF', label: 'إدارة المعلّمين والطاقم' },
  { key: 'MANAGE_STUDENTS', label: 'إدارة الطلاب والحضور والمدفوعات' },
  { key: 'MANAGE_COURSES', label: 'إنشاء وتعديل الدورات' },
  { key: 'MANAGE_SETTINGS', label: 'تعديل إعدادات المركز والفروع' },
  { key: 'VIEW_REPORTS', label: 'عرض التقارير والإحصاءات' },
  { key: 'VIEW_ENROLLMENTS', label: 'الاطلاع على الاشتراكات' },
];

export function CenterSettingsTab({
  centerId,
  settings,
  onRefresh,
  onNotify,
}: CenterSettingsTabProps) {
  const [subTab, setSubTab] = useState<SettingsSubTab>('basic');
  const [saving, setSaving] = useState(false);

  // Basic Info State
  const [name, setName] = useState(settings.center.name);
  const [description, setDescription] = useState(settings.center.description);
  const [governorate, setGovernorate] = useState(
    settings.center.governorate || ''
  );
  const [city, setCity] = useState(settings.center.city);
  const [country, setCountry] = useState(settings.center.country);
  const [street, setStreet] = useState(settings.center.street || '');
  const [buildingDetails, setBuildingDetails] = useState(
    settings.center.buildingDetails || ''
  );
  const [address, setAddress] = useState(settings.center.address || '');
  const [latitude, setLatitude] = useState(
    settings.center.latitude !== null && settings.center.latitude !== undefined
      ? String(settings.center.latitude)
      : ''
  );
  const [longitude, setLongitude] = useState(
    settings.center.longitude !== null && settings.center.longitude !== undefined
      ? String(settings.center.longitude)
      : ''
  );
  const [mapsLinkInput, setMapsLinkInput] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);
  const [phone, setPhone] = useState(settings.center.phone || '');
  const [secondaryPhone, setSecondaryPhone] = useState(
    settings.center.secondaryPhone || ''
  );
  const [website, setWebsite] = useState(settings.center.website || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.center.logoUrl);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(
    settings.center.bannerUrl
  );

  // Working Hours
  const [workingHours, setWorkingHours] = useState<CenterWorkingHourItem[]>(
    settings.center.workingHoursJson
  );

  // Booking Policies
  const [policies, setPolicies] = useState<CenterBookingPolicies>(
    settings.center.bookingPoliciesJson
  );

  // Notification Settings
  const [notifications, setNotifications] = useState<CenterNotificationSettings>(
    settings.center.notificationSettingsJson
  );

  // New Branch Form
  const [branchName, setBranchName] = useState('');
  const [branchCity, setBranchCity] = useState(settings.center.city);
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchIsMain, setBranchIsMain] = useState(false);

  // New Room Form
  const [roomBranchId, setRoomBranchId] = useState(
    settings.branches[0] ? String(settings.branches[0].id) : ''
  );
  const [roomName, setRoomName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('20');
  const [roomNotes, setRoomNotes] = useState('');

  useEffect(() => {
    setName(settings.center.name);
    setDescription(settings.center.description);
    setGovernorate(settings.center.governorate || '');
    setCity(settings.center.city);
    setCountry(settings.center.country);
    setStreet(settings.center.street || '');
    setBuildingDetails(settings.center.buildingDetails || '');
    setAddress(settings.center.address || '');
    setLatitude(
      settings.center.latitude !== null && settings.center.latitude !== undefined
        ? String(settings.center.latitude)
        : ''
    );
    setLongitude(
      settings.center.longitude !== null && settings.center.longitude !== undefined
        ? String(settings.center.longitude)
        : ''
    );
    setPhone(settings.center.phone || '');
    setSecondaryPhone(settings.center.secondaryPhone || '');
    setWebsite(settings.center.website || '');
    setLogoUrl(settings.center.logoUrl);
    setFrontImageUrl(settings.center.bannerUrl);
    setWorkingHours(settings.center.workingHoursJson);
    setPolicies(settings.center.bookingPoliciesJson);
    setNotifications(settings.center.notificationSettingsJson);
    if (!roomBranchId && settings.branches[0]) {
      setRoomBranchId(String(settings.branches[0].id));
    }
  }, [settings, roomBranchId]);

  const handleSaveSettingsPatch = async (payload: Record<string, unknown>, msg: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/center-dashboard/${centerId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onNotify('success', msg);
      await onRefresh();
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/center-dashboard/${centerId}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          name: branchName.trim(),
          city: branchCity.trim(),
          address: branchAddress.trim(),
          phone: branchPhone.trim() || null,
          isMain: branchIsMain,
          isActive: true,
        }),
      });
      setBranchName('');
      setBranchAddress('');
      setBranchPhone('');
      setBranchIsMain(false);
      onNotify('success', 'تمت إضافة الفرع بنجاح.');
      await onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'تعذر إضافة الفرع.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBranch = async (b: CenterBranchItem, patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/center-dashboard/${centerId}/branches/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      onNotify('success', 'تم تحديث بيانات الفرع.');
      await onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'تعذر تحديث الفرع.');
    }
  };

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomBranchId) {
      onNotify('error', 'يرجى إضافة أو اختيار فرع أولاً.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/center-dashboard/${centerId}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          branchId: Number(roomBranchId),
          name: roomName.trim(),
          roomNumber: roomNumber.trim(),
          capacity: Number(roomCapacity) || 20,
          equipmentNotes: roomNotes.trim() || null,
          isActive: true,
        }),
      });
      setRoomName('');
      setRoomNumber('');
      setRoomNotes('');
      onNotify('success', 'تمت إضافة القاعة الدراسية بنجاح.');
      await onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'تعذر إضافة القاعة.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRoom = async (r: CenterRoomItem) => {
    try {
      await apiFetch(`/api/center-dashboard/${centerId}/rooms/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      onNotify('success', 'تم تحديث حالة القاعة الدراسية.');
      await onRefresh();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'تعذر تحديث القاعة.');
    }
  };

  const handleUpdateStaffPermissions = async (
    memberId: number,
    permissions: string[]
  ) => {
    try {
      await apiFetch(
        `/api/center-dashboard/${centerId}/staff-permissions/${memberId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ permissions }),
        }
      );
      onNotify('success', 'تم تحديث صلاحيات الموظف.');
      await onRefresh();
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'تعذر تحديث صلاحيات الطاقم.'
      );
    }
  };

  const subTabs: Array<{ key: SettingsSubTab; label: string; icon: string }> = [
    { key: 'basic', label: 'المعلومات والشعار', icon: 'bi-building-gear' },
    { key: 'hours', label: 'ساعات العمل', icon: 'bi-clock' },
    { key: 'branches', label: 'الفروع والقاعات', icon: 'bi-geo-alt' },
    { key: 'policies', label: 'سياسات الحجز', icon: 'bi-shield-check' },
    { key: 'notifications', label: 'الإشعارات', icon: 'bi-bell' },
    { key: 'permissions', label: 'صلاحيات الطاقم', icon: 'bi-key' },
  ];

  return (
    <div className="space-y-4">
      <div className="jusoor-card p-2.5 flex flex-wrap gap-1.5">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              subTab === t.key
                ? 'bg-[#102A43] text-white'
                : 'text-[#64748B] hover:bg-[#F5F8FC] hover:text-[#102A43]'
            }`}
          >
            <i className={`bi ${t.icon}`} aria-hidden="true" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 1. Basic Info + Front Image + Logo + Address/Maps */}
      {subTab === 'basic' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const coordCheck = validateCoordinates(latitude, longitude);
            if (!coordCheck.valid) {
              onNotify('error', coordCheck.error || 'إحداثيات الموقع غير صالحة.');
              return;
            }
            void handleSaveSettingsPatch(
              {
                name: name.trim(),
                description: description.trim(),
                governorate: governorate.trim() || null,
                city: city.trim(),
                country: country.trim(),
                street: street.trim() || null,
                buildingDetails: buildingDetails.trim() || null,
                address: address.trim() || null,
                latitude: coordCheck.latitude,
                longitude: coordCheck.longitude,
                phone: phone.trim() || null,
                secondaryPhone: secondaryPhone.trim() || null,
                website: website.trim() || null,
              },
              'تم حفظ البيانات الأساسية وعنوان المركز بنجاح.'
            );
          }}
          className="jusoor-card p-4 sm:p-6 space-y-5"
        >
          {/* Verification Status Read-Only Notice */}
          <div className="jusoor-subcard p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <i
                className={`bi ${
                  settings.center.verificationStatus === 'VERIFIED'
                    ? 'bi-patch-check-fill text-[#0F766E]'
                    : 'bi-shield-check text-[#B45309]'
                } text-base`}
                aria-hidden="true"
              />
              <span className="font-bold text-[#102A43]">حالة توثيق المركز:</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-md border ${
                  settings.center.verificationStatus === 'VERIFIED'
                    ? 'bg-[#E8F8F5] text-[#0F766E] border-[#B2EAE0]'
                    : settings.center.verificationStatus === 'REJECTED'
                    ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                    : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                }`}
              >
                {getCenterVerificationLabelAr(settings.center.verificationStatus)}
              </span>
            </div>
            <span className="text-[11px] text-[#64748B]">
              تتم مراجعة واعتماد التوثيق بواسطة إدارة المنصة فقط
            </span>
          </div>

          {/* Center Front Image & Logo Uploads */}
          <div className="row g-4">
            <div className="col-12 col-xl-6">
              <CourseImageUploadField
                centerId={centerId}
                mode="front"
                label="صورة واجهة المركز"
                value={frontImageUrl}
                fallbackTitle={name}
                onChange={({ url }) => {
                  setFrontImageUrl(url);
                  if (url) {
                    onNotify('success', 'تم رفع وتحديث صورة واجهة المركز.');
                    void onRefresh();
                  }
                }}
                onRemoveExisting={async () => {
                  await apiFetch(`/api/center-dashboard/${centerId}/front-image`, {
                    method: 'DELETE',
                  });
                  onNotify('success', 'تمت إزالة صورة واجهة المركز.');
                  await onRefresh();
                }}
              />
            </div>

            <div className="col-12 col-xl-6">
              <CourseImageUploadField
                centerId={centerId}
                mode="logo"
                value={logoUrl}
                fallbackTitle={name}
                onChange={({ url }) => {
                  setLogoUrl(url);
                  if (url) {
                    onNotify('success', 'تم رفع وتحديث شعار المركز.');
                    void onRefresh();
                  }
                }}
                onRemoveExisting={async () => {
                  await handleSaveSettingsPatch(
                    { removeLogo: true },
                    'تمت إزالة شعار المركز.'
                  );
                }}
              />
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                اسم المركز التعليمي
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                الدولة
              </label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                المحافظة / المنطقة
              </label>
              <input
                type="text"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                placeholder="مثال: القاهرة"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                الوصف التعريفي
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="jusoor-textarea w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Structured Address Section */}
            <div className="col-12 col-md-4">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                المدينة / الحي
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                الشارع
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="مثال: شارع عباس العقاد"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                تفاصيل المبنى / الدور
              </label>
              <input
                type="text"
                value={buildingDetails}
                onChange={(e) => setBuildingDetails(e.target.value)}
                placeholder="مثال: برج النور — الدور الثالث"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                العنوان التفصيلي / علامة مميزة
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="وصف إضافي لسهولة الوصول للمركز"
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                الموقع الإلكتروني
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                الهاتف الأساسي
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                هاتف إضافي (اختياري)
              </label>
              <input
                type="tel"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                className="jusoor-input w-full px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
          </div>

          {/* Google Maps Coordinates & Location Helper */}
          <div className="jusoor-subcard p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-[#102A43] m-0 flex items-center gap-1.5">
                  <i className="bi bi-geo-alt-fill text-[#0F766E]" aria-hidden="true" />
                  <span>موقع المركز على خرائط جوجل (اختياري)</span>
                </h3>
                <p className="text-[11px] text-[#64748B] m-0 mt-0.5">
                  عند إدخال الإحداثيات يتم فتح الموقع بدقة، وعند تركها فارغة يُستخدم العنوان النصي تلقائياً.
                </p>
              </div>
              {(() => {
                const previewUrl = buildGoogleMapsSearchUrl({
                  governorate,
                  city,
                  street,
                  buildingDetails,
                  address,
                  country,
                  latitude,
                  longitude,
                });
                return previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-jusoor-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                  >
                    <i className="bi bi-map text-[#0F766E]" aria-hidden="true" />
                    <span>معاينة الموقع على الخريطة</span>
                  </a>
                ) : null;
              })()}
            </div>

            <div className="row g-2.5 align-items-end">
              <div className="col-12 col-md-4">
                <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                  خط العرض (Latitude)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="30.044420"
                  className="jusoor-input w-full px-3 py-1.5 text-xs font-mono-num"
                  dir="ltr"
                />
              </div>
              <div className="col-12 col-md-4">
                <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                  خط الطول (Longitude)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="31.235712"
                  className="jusoor-input w-full px-3 py-1.5 text-xs font-mono-num"
                  dir="ltr"
                />
              </div>
              <div className="col-12 col-md-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={locatingGps}
                  onClick={() => {
                    if (!navigator.geolocation) {
                      onNotify('error', 'المتصفح لا يدعم تحديد الموقع التلقائي.');
                      return;
                    }
                    setLocatingGps(true);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setLatitude(pos.coords.latitude.toFixed(6));
                        setLongitude(pos.coords.longitude.toFixed(6));
                        setLocatingGps(false);
                        onNotify('success', 'تم التقاط إحداثيات موقعك الحالي بنجاح.');
                      },
                      () => {
                        setLocatingGps(false);
                        onNotify(
                          'error',
                          'تعذر قراءة الموقع من المتصفح. يمكنك إدخال الإحداثيات أو لصق رابط خرائط جوجل.'
                        );
                      },
                      { enableHighAccuracy: true, timeout: 8000 }
                    );
                  }}
                  className="btn-jusoor-outline px-3 py-1.5 text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <i className="bi bi-crosshair" aria-hidden="true" />
                  <span>{locatingGps ? 'جارٍ التحديد...' : 'موقعي الحالي (GPS)'}</span>
                </button>
                {(latitude || longitude) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude('');
                      setLongitude('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-[#DCE5F0] text-[11px] text-[#64748B] hover:text-[#991B1B] cursor-pointer"
                  >
                    مسح الإحداثيات
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={mapsLinkInput}
                onChange={(e) => setMapsLinkInput(e.target.value)}
                placeholder="أو الصق رابط خرائط جوجل لاستخراج الإحداثيات تلقائياً..."
                className="jusoor-input flex-1 px-3 py-1.5 text-xs"
                dir="auto"
              />
              <button
                type="button"
                onClick={() => {
                  const extracted = parseCoordinatesFromMapsInput(mapsLinkInput);
                  if (!extracted) {
                    onNotify(
                      'error',
                      'لم يتم العثور على إحداثيات صالحة في النص المُدخل.'
                    );
                    return;
                  }
                  setLatitude(String(extracted.latitude));
                  setLongitude(String(extracted.longitude));
                  setMapsLinkInput('');
                  onNotify('success', 'تم استخراج الإحداثيات من الرابط بنجاح.');
                }}
                className="btn-jusoor-navy px-3 py-1.5 text-[11px] shrink-0 cursor-pointer"
              >
                استخراج من الرابط
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-jusoor-primary px-5 py-2 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ المعلومات الأساسية'}
            </button>
          </div>
        </form>
      )}

      {/* 2. Working Hours */}
      {subTab === 'hours' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveSettingsPatch(
              { workingHoursJson: workingHours },
              'تم حفظ جدول أوقات العمل الأسبوعي.'
            );
          }}
          className="jusoor-card p-4 sm:p-6 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-[#102A43] m-0">
            ساعات وأيام العمل الأسبوعية
          </h3>
          <div className="space-y-2.5">
            {workingHours.map((wh, idx) => (
              <div
                key={wh.dayOfWeek}
                className="jusoor-subcard p-3 row g-2 align-items-center"
              >
                <div className="col-12 col-sm-3 flex items-center justify-between sm:justify-start gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[#102A43] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wh.isOpen}
                      onChange={(e) =>
                        setWorkingHours((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, isOpen: e.target.checked } : x
                          )
                        )
                      }
                    />
                    <span>{WEEKDAY_LABELS_AR[wh.dayOfWeek] || wh.dayOfWeek}</span>
                  </label>
                </div>
                <div className="col-6 col-sm-2">
                  <input
                    type="time"
                    disabled={!wh.isOpen}
                    value={wh.openTime}
                    onChange={(e) =>
                      setWorkingHours((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, openTime: e.target.value } : x
                        )
                      )
                    }
                    className="jusoor-input w-full px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-6 col-sm-2">
                  <input
                    type="time"
                    disabled={!wh.isOpen}
                    value={wh.closeTime}
                    onChange={(e) =>
                      setWorkingHours((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, closeTime: e.target.value } : x
                        )
                      )
                    }
                    className="jusoor-input w-full px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-12 col-sm-5">
                  <input
                    type="text"
                    value={wh.note || ''}
                    onChange={(e) =>
                      setWorkingHours((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, note: e.target.value } : x
                        )
                      )
                    }
                    placeholder="ملاحظة (مثال: فترة مسائية فقط)"
                    className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-jusoor-primary px-5 py-2 text-xs sm:text-sm cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ ساعات العمل'}
            </button>
          </div>
        </form>
      )}

      {/* 3. Branches & Classrooms */}
      {subTab === 'branches' && (
        <div className="row g-4">
          <div className="col-12 col-lg-6 space-y-4">
            <div className="jusoor-card p-4 sm:p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                فروع المركز ({settings.branches.length})
              </h3>
              <form onSubmit={handleAddBranch} className="jusoor-subcard p-3 space-y-2.5">
                <div className="text-xs font-bold text-[#102A43]">+ إضافة فرع جديد</div>
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <input
                      type="text"
                      required
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="اسم الفرع"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <input
                      type="text"
                      required
                      value={branchCity}
                      onChange={(e) => setBranchCity(e.target.value)}
                      placeholder="المدينة"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-7">
                    <input
                      type="text"
                      required
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      placeholder="العنوان التفصيلي للفرع"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-12 col-sm-5">
                    <input
                      type="tel"
                      value={branchPhone}
                      onChange={(e) => setBranchPhone(e.target.value)}
                      placeholder="هاتف الفرع"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={branchIsMain}
                      onChange={(e) => setBranchIsMain(e.target.checked)}
                    />
                    <span>تعيين كفرع رئيسي</span>
                  </label>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-jusoor-primary px-3.5 py-1.5 text-xs cursor-pointer"
                  >
                    إضافة الفرع
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {settings.branches.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 border border-[#DCE5F0] rounded-lg flex items-start justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#102A43]">
                        {b.name}{' '}
                        {b.isMain && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8F8F5] text-[#0F766E]">
                            رئيسي
                          </span>
                        )}
                      </div>
                      <div className="text-[#64748B]">
                        {b.city} — {b.address}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!b.isMain && (
                        <button
                          type="button"
                          onClick={() => void handleToggleBranch(b, { isMain: true })}
                          className="btn-jusoor-outline px-2 py-1 text-[11px] cursor-pointer"
                        >
                          رئيسي
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleBranch(b, { isActive: !b.isActive })
                        }
                        className="px-2 py-1 rounded border border-[#DCE5F0] text-[11px] font-semibold cursor-pointer"
                      >
                        {b.isActive ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6 space-y-4">
            <div className="jusoor-card p-4 sm:p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                القاعات الدراسية ({settings.rooms.length})
              </h3>
              <form onSubmit={handleAddRoom} className="jusoor-subcard p-3 space-y-2.5">
                <div className="text-xs font-bold text-[#102A43]">+ إضافة قاعة جديدة</div>
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <select
                      required
                      value={roomBranchId}
                      onChange={(e) => setRoomBranchId(e.target.value)}
                      aria-label="الفرع التابع"
                      className="jusoor-select w-full px-2.5 py-1.5 text-xs"
                    >
                      <option value="">اختر الفرع</option>
                      {settings.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-sm-6">
                    <input
                      type="text"
                      required
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="اسم القاعة (مثال: قاعة النور)"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-6">
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="رقم القاعة (B-201)"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-6">
                    <input
                      type="number"
                      min="1"
                      max="500"
                      required
                      value={roomCapacity}
                      onChange={(e) => setRoomCapacity(e.target.value)}
                      placeholder="السعة"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="col-12">
                    <input
                      type="text"
                      value={roomNotes}
                      onChange={(e) => setRoomNotes(e.target.value)}
                      placeholder="التجهيزات (شاشة ذكية، سبورة...)"
                      className="jusoor-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-jusoor-primary px-3.5 py-1.5 text-xs cursor-pointer"
                  >
                    إضافة القاعة
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {settings.rooms.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 border border-[#DCE5F0] rounded-lg flex items-start justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#102A43]">
                        {r.name} {r.roomNumber ? `(${r.roomNumber})` : ''}
                      </div>
                      <div className="text-[#64748B]">
                        {r.branchName} · السعة: {r.capacity} طالب
                      </div>
                      {r.equipmentNotes && (
                        <div className="text-[11px] text-[#64748B]">
                          {r.equipmentNotes}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleRoom(r)}
                      className="px-2.5 py-1 rounded border border-[#DCE5F0] text-[11px] font-semibold shrink-0 cursor-pointer"
                    >
                      {r.isActive ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Booking Policies */}
      {subTab === 'policies' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveSettingsPatch(
              { bookingPoliciesJson: policies },
              'تم حفظ سياسات الحجز والإلغاء.'
            );
          }}
          className="jusoor-card p-4 sm:p-6 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-[#102A43] m-0">
            سياسات الحجز والإلغاء بالمركز
          </h3>
          <div className="row g-3">
            <div className="col-12 col-sm-4">
              <label className="jusoor-subcard p-3 flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.allowStudentBookings}
                  onChange={(e) =>
                    setPolicies({ ...policies, allowStudentBookings: e.target.checked })
                  }
                />
                <span>السماح بحجوزات الطلاب المباشرة</span>
              </label>
            </div>
            <div className="col-12 col-sm-4">
              <label className="jusoor-subcard p-3 flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.requireApproval}
                  onChange={(e) =>
                    setPolicies({ ...policies, requireApproval: e.target.checked })
                  }
                />
                <span>موافقة الإدارة قبل تأكيد الحجز</span>
              </label>
            </div>
            <div className="col-12 col-sm-4">
              <label className="jusoor-subcard p-3 flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={policies.allowCancellation}
                  onChange={(e) =>
                    setPolicies({ ...policies, allowCancellation: e.target.checked })
                  }
                />
                <span>إتاحة إلغاء الحجز للطلاب</span>
              </label>
            </div>
            <div className="col-12 col-sm-4">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                مهلة الحجز المسبق (ساعات)
              </label>
              <input
                type="number"
                min="0"
                max="168"
                value={policies.minBookingNoticeHours}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    minBookingNoticeHours: Number(e.target.value) || 0,
                  })
                }
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-sm-4">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                مهلة الإلغاء المسموحة (ساعات)
              </label>
              <input
                type="number"
                min="0"
                max="168"
                value={policies.minCancellationNoticeHours}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    minCancellationNoticeHours: Number(e.target.value) || 0,
                  })
                }
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12 col-sm-4">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                الحد الأقصى لإعادة الجدولة
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={policies.maxReschedulesPerBooking}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    maxReschedulesPerBooking: Number(e.target.value) || 0,
                  })
                }
                className="jusoor-input w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="col-12">
              <label className="block text-xs font-bold text-[#102A43] mb-1">
                نص السياسة الظاهر للطلاب
              </label>
              <textarea
                rows={2}
                value={policies.policySummary}
                onChange={(e) =>
                  setPolicies({ ...policies, policySummary: e.target.value })
                }
                className="jusoor-textarea w-full px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-jusoor-primary px-5 py-2 text-xs sm:text-sm cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ سياسات الحجز'}
            </button>
          </div>
        </form>
      )}

      {/* 5. Notification Settings */}
      {subTab === 'notifications' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveSettingsPatch(
              { notificationSettingsJson: notifications },
              'تم حفظ تفضيلات الإشعارات بنجاح.'
            );
          }}
          className="jusoor-card p-4 sm:p-6 space-y-4"
        >
          <h3 className="font-display text-base font-bold text-[#102A43] m-0">
            تفضيلات إشعارات المركز
          </h3>
          <div className="row g-3">
            {[
              {
                key: 'notifyNewStudentRegistration' as const,
                label: 'إشعار عند تسجيل طالب جديد بالمركز',
              },
              {
                key: 'notifyNewCourseEnrollment' as const,
                label: 'إشعار عند التحاق طالب بدورة',
              },
              {
                key: 'notifyBookingRequests' as const,
                label: 'إشعار عند ورود طلبات حجز جديدة',
              },
              {
                key: 'notifyCancellations' as const,
                label: 'إشعار عند إلغاء الحجوزات أو الاعتذار',
              },
              {
                key: 'notifyPaymentUpdates' as const,
                label: 'إشعار عند تسجيل أو تحديث المدفوعات',
              },
              {
                key: 'notifyStaffActivities' as const,
                label: 'إشعار بتعديلات أعضاء الكادر الإداري',
              },
            ].map((item) => (
              <div key={item.key} className="col-12 col-md-6">
                <label className="jusoor-subcard p-3 flex items-center justify-between gap-2 text-xs font-bold cursor-pointer">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[item.key]}
                    onChange={(e) =>
                      setNotifications({
                        ...notifications,
                        [item.key]: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-jusoor-primary px-5 py-2 text-xs sm:text-sm cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ إعدادات الإشعارات'}
            </button>
          </div>
        </form>
      )}

      {/* 6. Staff Permissions */}
      {subTab === 'permissions' && (
        <div className="jusoor-card p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#102A43] m-0">
                صلاحيات الطاقم والمعلّمين داخل المركز
              </h3>
              <p className="text-xs text-[#64748B] m-0 mt-1">
                يمتلك مالك المركز كامل الصلاحيات الإدارية دائماً ولا يمكن تقييد وصوله.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {settings.staff.map((st) => {
              const isCenterOwnerRow = st.memberRole === 'OWNER';
              return (
                <div
                  key={st.id}
                  className="jusoor-subcard p-3.5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[#102A43]">
                        {st.fullName}
                      </div>
                      <div className="text-xs text-[#64748B]">
                        {st.jobTitle} · {st.email}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-white border border-[#DCE5F0] text-[#102A43]">
                      {isCenterOwnerRow ? 'مالك المركز (كامل الصلاحيات)' : st.memberRole}
                    </span>
                  </div>

                  {!isCenterOwnerRow && (
                    <div className="flex flex-wrap gap-2">
                      {PERMISSION_LABELS_AR.map((perm) => {
                        const checked = st.permissionsJson.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs inline-flex items-center gap-1.5 ${
                              settings.isOwner
                                ? 'cursor-pointer bg-white'
                                : 'opacity-75 bg-[#F8FAFC]'
                            } ${
                              checked
                                ? 'border-[#20B8A6] text-[#0F766E] font-bold'
                                : 'border-[#DCE5F0] text-[#64748B]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={!settings.isOwner}
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...st.permissionsJson, perm.key]
                                  : st.permissionsJson.filter((p) => p !== perm.key);
                                void handleUpdateStaffPermissions(st.id, next);
                              }}
                            />
                            <span>{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
