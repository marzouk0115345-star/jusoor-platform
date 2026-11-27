interface LoadingSkeletonProps {
  variant?: 'cards' | 'list' | 'kpis' | 'detail';
  count?: number;
}

export function LoadingSkeleton({
  variant = 'cards',
  count = 3,
}: LoadingSkeletonProps) {
  if (variant === 'kpis') {
    return (
      <div className="row g-3" aria-busy="true" aria-label="جاري التحميل">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="col-6 col-lg-3">
            <div className="jusoor-card p-4 space-y-2">
              <div className="jusoor-skeleton h-3 w-24" />
              <div className="jusoor-skeleton h-7 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="جاري التحميل">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="jusoor-card p-4 space-y-2.5">
            <div className="jusoor-skeleton h-3 w-40" />
            <div className="jusoor-skeleton h-5 w-3/4" />
            <div className="jusoor-skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="جاري التحميل">
        <div className="jusoor-card p-6 space-y-3">
          <div className="jusoor-skeleton h-4 w-36" />
          <div className="jusoor-skeleton h-8 w-2/3" />
          <div className="jusoor-skeleton h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="row g-4" aria-busy="true" aria-label="جاري التحميل">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-12 col-md-6 col-lg-4">
          <div className="jusoor-card overflow-hidden">
            <div className="jusoor-skeleton h-44 rounded-none" />
            <div className="p-4 space-y-2.5">
              <div className="jusoor-skeleton h-3 w-32" />
              <div className="jusoor-skeleton h-5 w-4/5" />
              <div className="jusoor-skeleton h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
