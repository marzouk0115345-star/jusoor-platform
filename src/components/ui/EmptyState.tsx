import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon = 'bi-inbox',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="jusoor-card p-8 sm:p-12 text-center space-y-3">
      <div className="w-12 h-12 rounded-xl bg-[#EEF4FA] text-[#247BA0] flex items-center justify-center mx-auto">
        <i className={`bi ${icon} text-2xl`} aria-hidden="true" />
      </div>
      <div className="font-display text-base sm:text-lg font-bold text-[#102A43]">
        {title}
      </div>
      {description && (
        <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto leading-relaxed m-0">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
