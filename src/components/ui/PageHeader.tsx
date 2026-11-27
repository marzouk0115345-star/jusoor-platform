import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  kicker,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <section className="bg-white border-b border-[#DCE5F0]">
      <div className="container-xxl py-4 py-lg-5 px-3 px-sm-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] m-0 p-0 list-none">
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={`${bc.label}-${idx}`}>
                  {idx > 0 && <li aria-hidden="true">/</li>}
                  <li>
                    {bc.to ? (
                      <Link
                        to={bc.to}
                        className="hover:text-[#102A43] transition-colors"
                      >
                        {bc.label}
                      </Link>
                    ) : (
                      <span className="text-[#172B4D] font-semibold">
                        {bc.label}
                      </span>
                    )}
                  </li>
                </React.Fragment>
              ))}
            </ol>
          </nav>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            {kicker && (
              <div className="text-xs font-semibold text-[#0F766E]">
                {kicker}
              </div>
            )}
            <h1
              className="font-display text-2xl sm:text-3xl font-extrabold text-[#102A43] m-0"
              style={{ textWrap: 'balance' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[#64748B] leading-relaxed m-0">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
