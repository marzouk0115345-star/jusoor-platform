import React from 'react';

interface StateBannerProps {
  variant: 'success' | 'error' | 'warning' | 'info';
  message: React.ReactNode;
  title?: string;
  onDismiss?: () => void;
}

const VARIANT_CLASSES: Record<
  StateBannerProps['variant'],
  { box: string; icon: string }
> = {
  success: {
    box: 'bg-[#E8F8F5] border-[#99E2D8] text-[#0B4F4A]',
    icon: 'bi-check-circle-fill text-[#0F766E]',
  },
  error: {
    box: 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
    icon: 'bi-exclamation-octagon-fill text-[#DC2626]',
  },
  warning: {
    box: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
    icon: 'bi-exclamation-triangle-fill text-[#D97706]',
  },
  info: {
    box: 'bg-[#EEF4FA] border-[#C5D3E3] text-[#102A43]',
    icon: 'bi-info-circle-fill text-[#247BA0]',
  },
};

export function StateBanner({
  variant,
  message,
  title,
  onDismiss,
}: StateBannerProps) {
  const styles = VARIANT_CLASSES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`border rounded-xl p-3.5 text-xs sm:text-sm flex items-start justify-between gap-3 ${styles.box}`}
    >
      <div className="flex items-start gap-2.5">
        <i className={`bi ${styles.icon} text-base leading-none mt-0.5 shrink-0`} aria-hidden="true" />
        <div className="space-y-0.5">
          {title && <div className="font-bold">{title}</div>}
          <div className="leading-relaxed">{message}</div>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق التنبيه"
          className="text-current opacity-70 hover:opacity-100 p-1 cursor-pointer shrink-0"
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
