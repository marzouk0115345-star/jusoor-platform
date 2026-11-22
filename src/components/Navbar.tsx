import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, openAuthModal, locale } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAr = locale === 'ar';

  const navItems = [
    { to: '/courses', label: isAr ? 'الدورات' : 'Courses' },
    {
      to: '/educational-stages',
      label: isAr ? 'المراحل التعليمية' : 'Educational Stages',
    },
    { to: '/tasks', label: isAr ? 'المهام التعليمية' : 'Tasks' },
    { to: '/providers', label: isAr ? 'الإرشاد والحجوزات' : 'Bookings' },
    { to: '/centers', label: isAr ? 'المراكز' : 'Centers' },
    { to: '/assistant', label: isAr ? 'المستشار الذكي' : 'Advisor' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          جسور | JUSOOR
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label={isAr ? 'التنقل الرئيسي' : 'Main Navigation'}
          className="hidden md:flex items-center gap-4 lg:gap-6 text-xs lg:text-sm font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const active =
              location.pathname === item.to ||
              location.pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  active
                    ? 'text-teal-700 font-semibold underline underline-offset-8 decoration-2'
                    : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              {isAr ? 'لوحة التحكم' : 'Dashboard'}
            </Link>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
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
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label={isAr ? 'القائمة الجانبية للجوال' : 'Mobile Navigation'}
          className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-2"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <>
              <Link
                to="/messages"
                onClick={() => setMobileOpen(false)}
                className="py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {isAr ? 'الرسائل والإشعارات' : 'Messages & Notifications'}
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="py-2 px-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {isAr ? 'الملف المهني والسيرة الذاتية' : 'Profile & CV'}
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
