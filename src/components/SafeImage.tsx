import { useEffect, useState } from 'react';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EEF4FA] via-[#E8F8F5] to-[#DCE5F0] text-[#102A43] p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <i className="bi bi-book-half text-2xl text-[#0F766E] mb-2" aria-hidden="true" />
        {fallbackTitle && (
          <span className="text-xs font-semibold text-[#102A43] line-clamp-2">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
