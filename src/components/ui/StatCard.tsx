interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: string;
  accent?: 'navy' | 'blue' | 'teal' | 'amber';
}

const ACCENT_ICON: Record<NonNullable<StatCardProps['accent']>, string> = {
  navy: 'bg-[#EEF4FA] text-[#102A43]',
  blue: 'bg-[#E7F4FA] text-[#247BA0]',
  teal: 'bg-[#E8F8F5] text-[#0F766E]',
  amber: 'bg-[#FEF3C7] text-[#B45309]',
};

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent = 'navy',
}: StatCardProps) {
  return (
    <div className="jusoor-card p-4 h-full flex items-start justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <div className="text-xs font-medium text-[#64748B] truncate">{label}</div>
        <div className="font-mono-num text-xl sm:text-2xl font-bold text-[#102A43]">
          {value}
        </div>
        {sublabel && (
          <div className="text-[11px] text-[#64748B] tabular-nums truncate">
            {sublabel}
          </div>
        )}
      </div>
      {icon && (
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_ICON[accent]}`}
          aria-hidden="true"
        >
          <i className={`bi ${icon} text-lg`} />
        </div>
      )}
    </div>
  );
}
