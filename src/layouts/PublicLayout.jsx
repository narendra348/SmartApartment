import { Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { APP_NAME } from '../constants';

/**
 * PublicLayout — minimal centered layout for auth pages (login, forgot password, etc.)
 */
function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Minimal top bar */}
      <header className="py-4 px-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-sky-600 flex items-center justify-center">
            <Building2 size={15} className="text-white" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold text-slate-800 tracking-wide">
            {APP_NAME}
          </span>
        </div>
      </header>

      {/* Page content */}
      <main
        id="main-content"
        className="flex-1 flex items-center justify-center p-6"
        role="main"
      >
        <Outlet />
      </main>

      <footer className="py-3 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </footer>
    </div>
  );
}

export default PublicLayout;
