import { Link } from 'react-router-dom';
import { formatCurrencyPrice, LEVEL_LABELS_AR } from '../../lib/api';
import { SafeImage } from '../SafeImage';

export interface CourseCardData {
  id: number;
  title: string;
  subtitle: string;
  level: string;
  price: string;
  currency?: string | null;
  thumbnailUrl: string | null;
  instructorId: number;
  instructorName: string;
  fieldNameAr: string;
  customFieldName?: string | null;
  targetAudience?: string | null;
  centerName?: string | null;
  lessonsCount: number;
  ratingAvg?: number | null;
}

interface CourseCardProps {
  course: CourseCardData;
  locale?: 'ar' | 'en';
}

export function CourseCard({ course, locale = 'ar' }: CourseCardProps) {
  const isAr = locale === 'ar';

  return (
    <article className="jusoor-card jusoor-card-interactive overflow-hidden flex flex-col h-full">
      <Link
        to={`/courses/${course.id}`}
        className="block aspect-[4/3] bg-[#EEF4FA] overflow-hidden"
      >
        <SafeImage
          src={course.thumbnailUrl}
          alt={course.title}
          fallbackTitle={course.title}
          className="w-full h-full object-cover"
        />
      </Link>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-[#0F766E]">
              {course.fieldNameAr}
            </span>
            <span aria-hidden="true">·</span>
            <span>{LEVEL_LABELS_AR[course.level] || course.level}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {course.lessonsCount} {isAr ? 'دروس' : 'lessons'}
            </span>
          </div>

          <h3 className="font-display text-base font-bold text-[#102A43] leading-snug m-0">
            <Link
              to={`/courses/${course.id}`}
              className="text-[#102A43] hover:text-[#247BA0] transition-colors"
            >
              {course.title}
            </Link>
          </h3>

          <p className="text-xs text-[#64748B] line-clamp-2 m-0 leading-relaxed">
            {course.subtitle}
          </p>
        </div>

        <div className="pt-3 border-t border-[#EDF2F7] flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate">
            <Link
              to={`/instructors/${course.instructorId}`}
              className="font-semibold text-[#0F766E] hover:underline inline-flex items-center gap-1"
            >
              <i className="bi bi-patch-check-fill text-[#20B8A6]" aria-hidden="true" />
              <span className="truncate">{course.instructorName}</span>
            </Link>
            {course.centerName && (
              <span className="text-[#64748B]"> · {course.centerName}</span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {course.ratingAvg !== undefined &&
              course.ratingAvg !== null &&
              Number(course.ratingAvg) > 0 && (
                <span className="font-mono-num text-[#B45309] font-semibold inline-flex items-center gap-1">
                  <i className="bi bi-star-fill text-[#F59E0B]" aria-hidden="true" />
                  {Number(course.ratingAvg).toFixed(1)}
                </span>
              )}
            <span className="font-mono-num font-bold text-[#102A43]">
              {formatCurrencyPrice(course.price, course.currency || 'USD', locale)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
