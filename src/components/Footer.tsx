import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Footer() {
  const { locale, setLocale } = useAuth();
  const isAr = locale === 'ar';

  return (
    <footer className="bg-[#102A43] text-white mt-16 border-t border-[#1E3A5F]">
      <div className="container-xxl px-3 px-sm-4 py-5">
        <div className="row g-4 align-items-start">
          <div className="col-12 col-lg-4">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="w-8 h-8 rounded-lg bg-[#194266] border border-[#247BA0]/40 inline-flex items-center justify-center"
                aria-hidden="true"
              >
                <i className="bi bi-mortarboard-fill text-[#20B8A6]" />
              </span>
              <span className="font-display text-lg font-extrabold text-white">
                جسور | JUSOOR
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3 max-w-sm">
              {isAr
                ? 'منصة تعليمية ومهنية تجمع طلاب المراحل المصرية، المعلمين المعتمدين، الدورات التطبيقية، والمراكز التعليمية في مساحة موحدة.'
                : 'An educational and professional marketplace uniting Egyptian curriculum students, verified teachers, practical courses, and educational centers.'}
            </p>
            <button
              type="button"
              onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#194266] border border-[#247BA0]/50 text-xs font-semibold text-[#20B8A6] hover:text-white transition-colors cursor-pointer"
            >
              <i className="bi bi-translate" aria-hidden="true" />
              <span>
                {locale === 'ar' ? 'تجهيز واجهة English (LTR)' : 'العودة للعربية (RTL)'}
              </span>
            </button>
          </div>

          <div className="col-6 col-md-4 col-lg-3">
            <h3 className="font-display text-sm font-bold text-white mb-3">
              {isAr ? 'التعلّم والمناهج' : 'Learning & Curriculum'}
            </h3>
            <ul className="list-none p-0 m-0 space-y-2 text-xs text-slate-300">
              <li>
                <Link to="/educational-stages" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'المراحل التعليمية والمناهج' : 'Educational Stages'}
                </Link>
              </li>
              <li>
                <Link to="/courses" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'الدورات التدريبية' : 'Courses Marketplace'}
                </Link>
              </li>
              <li>
                <Link to="/providers" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'المعلّمون وجلسات الحجز' : 'Teachers & Sessions'}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-6 col-md-4 col-lg-3">
            <h3 className="font-display text-sm font-bold text-white mb-3">
              {isAr ? 'السوق والمؤسسات' : 'Marketplace & Centers'}
            </h3>
            <ul className="list-none p-0 m-0 space-y-2 text-xs text-slate-300">
              <li>
                <Link to="/tasks" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'سوق المهام التعليمية' : 'Tasks Marketplace'}
                </Link>
              </li>
              <li>
                <Link to="/centers" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'المراكز التعليمية' : 'Educational Centers'}
                </Link>
              </li>
              <li>
                <Link to="/assistant" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'المستشار التعليمي الذكي' : 'Smart Advisor'}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-12 col-md-4 col-lg-2">
            <h3 className="font-display text-sm font-bold text-white mb-3">
              {isAr ? 'حسابك' : 'Account'}
            </h3>
            <ul className="list-none p-0 m-0 space-y-2 text-xs text-slate-300">
              <li>
                <Link to="/dashboard" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'لوحة التحكم' : 'Dashboard'}
                </Link>
              </li>
              <li>
                <Link to="/messages" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'الرسائل والإشعارات' : 'Messages'}
                </Link>
              </li>
              <li>
                <Link to="/profile" className="text-slate-300 hover:text-white transition-colors">
                  {isAr ? 'الملف المهني' : 'Profile & CV'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#1E3A5F] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            © {new Date().getFullYear()}{' '}
            {isAr ? 'جسور التعليمية والمهنية — جميع الحقوق محفوظة' : 'JUSOOR Educational Marketplace'}
          </span>
          <span className="font-mono-num text-[11px] text-slate-400">
            JUSOOR · Egypt Education & Career Platform
          </span>
        </div>
      </div>
    </footer>
  );
}
