import React, { useRef, useState } from 'react';
import { uploadCenterImageWithProgress } from '../../lib/api';
import { validateCourseImageMeta } from '../../lib/domain';
import { SafeImage } from '../SafeImage';

interface CourseImageUploadFieldProps {
  centerId?: number | null;
  courseId?: number | null;
  mode?: 'course' | 'logo' | 'front';
  uploadEndpointOverride?: string;
  value: string | null;
  fallbackTitle: string;
  label?: string;
  onChange: (next: {
    url: string | null;
    coverImageKey?: string | null;
  }) => void;
  onRemoveExisting?: () => Promise<void>;
}

export function CourseImageUploadField({
  centerId = null,
  courseId = null,
  mode = 'course',
  uploadEndpointOverride,
  value,
  fallbackTitle,
  label,
  onChange,
  onRemoveExisting,
}: CourseImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const uploadEndpoint =
    uploadEndpointOverride ||
    (mode === 'logo' && centerId
      ? `/api/center-dashboard/${centerId}/logo`
      : mode === 'front' && centerId
      ? `/api/center-dashboard/${centerId}/front-image`
      : centerId
      ? courseId
        ? `/api/center-dashboard/${centerId}/course-images?courseId=${courseId}`
        : `/api/center-dashboard/${centerId}/course-images`
      : courseId
      ? `/api/courses/cover-image?courseId=${courseId}`
      : `/api/courses/cover-image`);

  const handleSelectedFile = async (file: File | undefined | null) => {
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const check = validateCourseImageMeta({
      mimeType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
    });
    if (!check.valid) {
      setErrorMsg(check.error || 'ملف الصورة غير صالح.');
      return;
    }

    setUploading(true);
    setProgress(8);
    try {
      const res = await uploadCenterImageWithProgress(
        uploadEndpoint,
        file,
        (pct) => setProgress(pct)
      );
      const uploadedUrl =
        mode === 'logo'
          ? res.logoUrl || null
          : mode === 'front'
          ? res.frontImageUrl || res.bannerUrl || null
          : res.thumbnailUrl || null;
      onChange({
        url: uploadedUrl,
        coverImageKey: res.coverImageKey ?? null,
      });
      setSuccessMsg(
        mode === 'logo'
          ? 'تم رفع شعار المركز وحفظه بنجاح.'
          : mode === 'front'
          ? 'تم رفع صورة واجهة المركز بنجاح.'
          : 'تم رفع صورة غلاف الدورة وحفظها بنجاح.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر رفع الصورة. حاول مرة أخرى.'
      );
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (onRemoveExisting) {
      setRemoving(true);
      try {
        await onRemoveExisting();
        onChange({ url: null, coverImageKey: null });
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'تعذر إزالة الصورة الحالية.'
        );
      } finally {
        setRemoving(false);
      }
      return;
    }
    onChange({ url: null, coverImageKey: null });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-[#102A43]">
          {label ||
            (mode === 'logo'
              ? 'شعار المركز التعليمي'
              : mode === 'front'
              ? 'صورة واجهة المركز'
              : 'صورة غلاف الدورة')}
        </label>
        <span className="text-[11px] text-[#64748B]">
          JPEG · PNG · WebP (الحد الأقصى 5 ميجابايت)
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          void handleSelectedFile(dropped);
        }}
        className={`rounded-xl border-2 border-dashed p-3.5 transition-colors ${
          dragging
            ? 'border-[#20B8A6] bg-[#E8F8F5]/60'
            : 'border-[#DCE5F0] bg-[#F8FBFF]'
        }`}
      >
        <div className="row g-3 align-items-center">
          <div className="col-12 col-sm-5">
            <div
              className={`${
                mode === 'logo'
                  ? 'aspect-square max-w-[140px] mx-auto'
                  : 'aspect-[16/10]'
              } rounded-lg overflow-hidden border border-[#DCE5F0] bg-[#EEF4FA] relative`}
            >
              <SafeImage
                src={value}
                alt={fallbackTitle}
                fallbackTitle={fallbackTitle}
                className="w-full h-full object-cover"
              />
              {!value && (
                <div className="absolute bottom-1.5 inset-x-1.5 bg-[#102A43]/75 text-white text-[10px] text-center py-0.5 px-1.5 rounded">
                  معاينة افتراضية
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-sm-7 space-y-2.5">
            <p className="text-xs text-[#64748B] m-0 leading-relaxed">
              {mode === 'logo'
                ? 'اسحب وأفلت شعار المركز هنا أو اختر صورة من جهازك ليظهر في صفحة المركز ولوحة الإدارة.'
                : mode === 'front'
                ? 'اسحب وأفلت صورة واجهة المركز الخارجية هنا أو اختر صورة من جهازك لتظهر في قائمة المراكز والملف العام للمركز.'
                : 'اسحب وأفلت صورة الغلاف هنا أو اختر ملفاً من جهازك. ستظهر الصورة مباشرة في البطاقة العامة وصفحة الدورة.'}
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => void handleSelectedFile(e.target.files?.[0])}
              className="sr-only"
              data-testid="course-cover-file-input"
              aria-label={
                mode === 'logo'
                  ? 'رفع شعار المركز'
                  : mode === 'front'
                  ? 'رفع صورة واجهة المركز'
                  : 'رفع صورة غلاف الدورة'
              }
            />

            {uploading && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F766E]">
                  <span>جارٍ رفع الصورة وتأمينها...</span>
                  <span className="font-mono-num">{progress}%</span>
                </div>
                <div className="h-2 bg-[#DCE5F0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#20B8A6] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading || removing}
                onClick={() => inputRef.current?.click()}
                className="btn-jusoor-primary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                <span>{value ? 'تغيير الصورة' : 'اختيار صورة'}</span>
              </button>

              {value && (
                <button
                  type="button"
                  disabled={uploading || removing}
                  onClick={() => void handleRemove()}
                  className="px-3 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <i className="bi bi-trash" aria-hidden="true" />
                  <span>{removing ? 'جارٍ الإزالة...' : 'إزالة الصورة'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {successMsg && !errorMsg && (
        <div
          role="status"
          className="px-3 py-2 rounded-lg border border-[#99E2D8] bg-[#E8F8F5] text-[#0F766E] text-xs font-semibold flex items-center gap-2"
        >
          <i className="bi bi-check-circle-fill shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="px-3 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] text-xs font-medium flex items-center gap-2"
        >
          <i className="bi bi-exclamation-triangle-fill shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
