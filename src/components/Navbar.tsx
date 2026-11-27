import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, openAuthModal, locale, setLocale } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAr = locale === 'ar';

  const navItems = [
    { to: '/courses', label: isAr ? 'الدورات' : 'Courses' },
    {
      to: '/educational-stages',
      label: isAr ? 'المراحل التعليمية' : 'Educational Stages',
    },
    { to: '/tasks', label: isAr ? 'المهام' : 'Tasks' },
    { to: '/providers', label: isAr ? 'المعلّمون والحجوزات' : 'Tutors & Bookings' },
    { to: '/centers', label: isAr ? 'المراكز' : 'Centers' },
    { to: '/assistant', label: isAr ? 'المستشار' : 'Advisor' },
  ];

  const isAdmin = user?.roles?.includes('ADMIN');
  const isCenterManager = Boolean(
    user?.roles?.some((r) =>
      ['CENTER_OWNER', 'CENTER_STAFF', 'ADMIN'].includes(r)
    )
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#DCE5F0]">
      <div className="container-xxl px-3 px-sm-4 h-16 flex items-center justify-between gap-2 lg:gap-6">
        {/* Zone 1: Brand Wordmark + Geometric Bridge Emblem */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-base sm:text-lg font-extrabold tracking-tight text-[#102A43] whitespace-nowrap shrink-0"
        >
          <span
            className="w-8 h-8 rounded-lg bg-[#102A43] text-white inline-flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 16C5.5 10.5 8.8 8 12 8C15.2 8 18.5 10.5 21 16"
                stroke="#20B8A6"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M4 17.5H20"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="5.5" r="1.8" fill="#20B8A6" />
            </svg>
          </span>
          <span>جسور | JUSOOR</span>
        </Link>

        {/* Zone 2: Single-line navigation links */}
        <nav
          aria-label={isAr ? 'التنقل الرئيسي' : 'Main Navigation'}
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-[#64748B]"
        >
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              location.pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                  active
                    ? 'text-[#102A43] font-bold border-[#20B8A6]'
                    : 'border-transparent text-[#64748B] hover:text-[#102A43]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Drawer Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isCenterManager && (
                <Link
                  to="/center-dashboard"
                  className="btn-jusoor-outline px-2.5 sm:px-3 py-2 text-xs sm:text-sm hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <i className="bi bi-building-gear text-[#0F766E]" aria-hidden="true" />
                  <span>{isAr ? 'إدارة المركز' : 'Center Panel'}</span>
                </Link>
              )}
              <Link
                to="/dashboard"
                className="btn-jusoor-primary px-3 sm:px-3.5 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
              >
                <i className="bi bi-grid-1x2" aria-hidden="true" />
                <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="btn-jusoor-navy px-3 sm:px-4 py-2 text-xs sm:text-sm inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <i className="bi bi-box-arrow-in-left" aria-hidden="true" />
              <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={
              mobileOpen
                ? isAr
                  ? 'إغلاق القائمة'
                  : 'Close menu'
                : isAr
                ? 'فتح القائمة'
                : 'Open menu'
            }
            aria-expanded={mobileOpen}
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-[#DCE5F0] text-[#102A43] hover:bg-[#EEF4FA] inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <i
              className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'} text-lg`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileOpen && (
        <nav
          aria-label={isAr ? 'القائمة الجانبية للجوال' : 'Mobile Navigation'}
          className="lg:hidden border-t border-[#DCE5F0] bg-white px-3 py-3 shadow-md"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + '/');
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-[#E8F8F5] text-[#0F766E]'
                      : 'text-[#172B4D] hover:bg-[#F5F8FC]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {user && (
              <div className="mt-2 pt-2 border-t border-[#EDF2F7] flex flex-col gap-1">
                {isCenterManager && (
                  <Link
                    to="/center-dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="py-2.5 px-3 rounded-lg text-sm font-bold text-[#0F766E] bg-[#E8F8F5]/60 hover:bg-[#E8F8F5] inline-flex items-center gap-2"
                  >
                    <i className="bi bi-building-gear text-[#0F766E]" aria-hidden="true" />
                    <span>{isAr ? 'لوحة إدارة المركز' : 'Center Dashboard'}</span>
                  </Link>
                )}
                <Link
                  to="/messages"
                  onClick={() => setMobileOpen(false)}
                  className="py-2.5 px-3 rounded-lg text-sm font-medium text-[#172B4D] hover:bg-[#F5F8FC] inline-flex items-center gap-2"
                >
                  <i className="bi bi-chat-dots text-[#247BA0]" aria-hidden="true" />
                  <span>{isAr ? 'الرسائل والإشعارات' : 'Messages & Notifications'}</span>
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="py-2.5 px-3 rounded-lg text-sm font-medium text-[#172B4D] hover:bg-[#F5F8FC] inline-flex items-center gap-2"
                >
                  <i className="bi bi-person-badge text-[#247BA0]" aria-hidden="true" />
                  <span>{isAr ? 'الملف المهني والسيرة الذاتية' : 'Profile & CV'}</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="py-2.5 px-3 rounded-lg text-sm font-medium text-[#102A43] hover:bg-[#F5F8FC] inline-flex items-center gap-2"
                  >
                    <i className="bi bi-shield-check text-[#0F766E]" aria-hidden="true" />
                    <span>{isAr ? 'إدارة المنصة' : 'Platform Admin'}</span>
                  </Link>
                )}
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-[#EDF2F7] flex items-center justify-between px-3 py-1">
              <span className="text-xs text-[#64748B]">
                {isAr ? 'لغة الواجهة' : 'Interface Language'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocale(isAr ? 'en' : 'ar');
                  setMobileOpen(false);
                }}
                className="text-xs font-bold text-[#247BA0] hover:underline cursor-pointer"
              >
                {isAr ? 'English (LTR)' : 'العربية (RTL)'}
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
