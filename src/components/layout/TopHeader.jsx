import { useState, useRef, useEffect } from 'react';
import { Menu, Bell, ChevronDown, User, LogOut, CheckCircle2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, ROLES } from '../../constants';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../api/notificationsApi';

function ProfileMenu({ user, role, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Determine profile route based on user role
  const profileRoute = (() => {
    switch (role) {
      case ROLES.SUPER_ADMIN:
        return ROUTES.SUPER_ADMIN.PROFILE;
      case ROLES.ADMIN:
      case ROLES.APARTMENT_ADMIN:
        return ROUTES.ADMIN.PROFILE;
      case ROLES.RESIDENT:
        return ROUTES.RESIDENT.PROFILE;
      case ROLES.STAFF:
      case ROLES.MAINTENANCE_STAFF:
        return ROUTES.STAFF.PROFILE;
      default:
        return '/login';
    }
  })();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        id="profile-menu-btn"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
          {initial}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-36">
            {user?.name ?? user?.email ?? 'User'}
          </p>
          <p className="text-[11px] text-slate-500 capitalize leading-tight">
            {role?.replace(/_/g, ' ')}
          </p>
        </div>
        <ChevronDown size={14} className="text-slate-400 hidden sm:block" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-labelledby="profile-menu-btn"
          className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1.5 text-sm"
        >
          <div className="px-3.5 py-2.5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {user?.name ?? 'User'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
              Role: {role?.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="py-1">
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-xs"
              onClick={() => {
                setOpen(false);
                navigate(profileRoute);
              }}
            >
              <User size={15} className="text-slate-500 shrink-0" />
              My Profile
            </button>
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-xs font-medium"
            >
              <LogOut size={15} className="shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Load notifications from backend (does not invent fake counts)
  useEffect(() => {
    let isMounted = true;
    getNotifications({ limit: 5 })
      .then((res) => {
        if (!isMounted) return;
        setNotifications(res.items || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => {
        // If notifications endpoint is not mounted or offline, keep at 0
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    } catch {
      // Backend may not support bulk mark read
    }
  };

  const handleClickItem = async (item) => {
    const id = item.id || item._id;
    if (!item.read && !item.isRead) {
      try {
        await markNotificationAsRead(id);
        setNotifications((prev) =>
          prev.map((n) =>
            (n.id || n._id) === id ? { ...n, read: true, isRead: true } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Proceed even if mark read endpoint fails
      }
    }

    const targetUrl = item.link || item.url || item.targetUrl;
    if (targetUrl) {
      setOpen(false);
      navigate(targetUrl);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        id="notifications-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <Bell size={18} />
        {/* Only show badge if actual backend data provides unread count > 0 */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-sky-500 rounded-full ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-3 px-4 text-sm animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-sky-600 hover:text-sky-700"
              >
                Mark all as read
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">All caught up</span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-6 text-center text-slate-400 flex flex-col items-center gap-1.5">
              <CheckCircle2 size={24} className="text-slate-300" />
              <p className="text-xs font-medium text-slate-600">All caught up!</p>
              <p className="text-[11px] text-slate-400">No new notifications at this time.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {notifications.map((item) => {
                const id = item.id || item._id;
                const isRead = item.read || item.isRead;
                return (
                  <div
                    key={id}
                    onClick={() => handleClickItem(item)}
                    className={`py-2.5 px-1 flex flex-col gap-0.5 cursor-pointer hover:bg-slate-50 rounded transition-colors ${
                      !isRead ? 'bg-sky-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-medium ${!isRead ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>
                        {item.title || 'Notification'}
                      </p>
                      {item.createdAt && (
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {item.message || item.content || item.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TopHeader({ onMenuClick, pageTitle }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch {
      // logout() already clears in-memory state on failure; just warn user.
      toast.error(
        'Sign-out request could not reach the server. Your local session has been cleared.',
      );
      navigate(ROUTES.LOGIN, { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          id="open-sidebar-btn"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate tracking-tight">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right: Notification & Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationMenu />
        <div className="h-5 w-px bg-slate-200 mx-1" aria-hidden="true" />
        <ProfileMenu user={user} role={role} onLogout={handleLogout} />
      </div>
    </header>
  );
}

export default TopHeader;
