import { NavLink, useNavigate } from 'react-router-dom';
import {
  Building2,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, APP_NAME } from '../../constants';
import { getNavItemsForRole } from '../../constants/navigation';

// ---------------------------------------------------------------------------
// Single nav item
// ---------------------------------------------------------------------------
function SidebarItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.href}
      onClick={onClick}
      end={item.href.endsWith('/dashboard')}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
          isActive
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
        ].join(' ')
      }
    >
      {Icon && <Icon size={17} className="shrink-0" aria-hidden="true" />}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Sidebar content (shared between desktop persistent + mobile drawer)
// ---------------------------------------------------------------------------
function SidebarContent({ onClose }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = getNavItemsForRole(role);

  // Group items if they have group properties
  const groupedItems = navItems.reduce((acc, item) => {
    const groupName = item.group || 'Main';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(item);
    return acc;
  }, {});

  const groupKeys = Object.keys(groupedItems);
  const hasMultipleGroups = groupKeys.length > 1;

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // logout() clears in-memory state regardless; safe to proceed.
    }
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Logo / App name */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
            <Building2 size={18} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide block leading-tight">
              {APP_NAME}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              Management Portal
            </span>
          </div>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4 space-y-4 custom-scrollbar"
        aria-label="Main navigation"
      >
        {hasMultipleGroups ? (
          groupKeys.map((group) => (
            <div key={group} className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {group}
              </div>
              {groupedItems[group].map((item) => (
                <SidebarItem key={item.href} item={item} onClick={onClose} />
              ))}
            </div>
          ))
        ) : (
          <div className="space-y-1">
            {navItems.map((item) => (
              <SidebarItem key={item.href} item={item} onClick={onClose} />
            ))}
          </div>
        )}
      </nav>

      {/* User profile snippet + Logout */}
      <div className="px-3 py-3 border-t border-slate-800 bg-slate-950/40">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-slate-850">
            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center shrink-0 font-semibold text-xs">
              {(user.name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {user.name ?? user.email ?? 'User'}
              </p>
              <p className="text-[11px] text-slate-400 capitalize truncate">
                {role?.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
        >
          <LogOut size={15} className="shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop sidebar (fixed, visible on lg+)
// ---------------------------------------------------------------------------
export function DesktopSidebar() {
  return (
    <aside
      className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-30"
      aria-label="Desktop Sidebar"
    >
      <SidebarContent />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Mobile drawer sidebar
// ---------------------------------------------------------------------------
export function MobileSidebar({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col lg:hidden shadow-2xl animate-in slide-in-from-left duration-200"
        aria-label="Mobile navigation"
      >
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  );
}

export default DesktopSidebar;
