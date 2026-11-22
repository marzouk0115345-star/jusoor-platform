import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Footer() {
  const { locale, setLocale } = useAuth();
  const isAr = locale === 'ar';

  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="font-display text-base font-bold text-slate-900">
            جسور | JUSOOR
          </div>
          <p className="text-xs text-slate-600">
            {isAr
              ? 'جسور تربطك بالتعلّم والفرص — من المعرفة إلى الفرص.'
              : 'JUSOOR connects you to learning and opportunities — From Knowledge to Opportunity.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
          <Link to="/courses" className="hover:text-slate-900">
            {isAr ? 'الدورات التدريبية' : 'Courses'}
          </Link>
          <Link to="/educational-stages" className="hover:text-slate-900">
            {isAr ? 'المراحل التعليمية' : 'Educational Stages'}
          </Link>
          <Link to="/tasks" className="hover:text-slate-900">
            {isAr ? 'سوق المهام التعليمية' : 'Tasks Marketplace'}
          </Link>
          <Link to="/providers" className="hover:text-slate-900">
            {isAr ? 'المرشدون والخبراء' : 'Mentors & Bookings'}
          </Link>
          <Link to="/centers" className="hover:text-slate-900">
            {isAr ? 'المراكز التعليمية' : 'Educational Centers'}
          </Link>
          <button
            type="button"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="text-teal-700 font-medium hover:underline cursor-pointer"
          >
            {locale === 'ar' ? 'تجهيز واجهة English (LTR)' : 'العودة للعربية (RTL)'}
          </button>
        </div>

        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()}{' '}
          {isAr ? 'جسور التعليمية والمهنية' : 'JUSOOR Educational Marketplace'}
        </div>
      </div>
    </footer>
  );
}
