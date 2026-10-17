/**
 * AuthContext.jsx
 *
 * Single source of truth for the authenticated session.
 *
 * - Session is backed by HTTP-only cookies (set by the server).
 * - No tokens or passwords stored in localStorage or sessionStorage.
 * - On mount, calls GET /auth/me to restore a session from the existing cookie.
 * - If the backend is unavailable or unauthenticated, loading is always cleared cleanly.
 * - Provides login(), logout(), and refreshUser() to the rest of the app.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '../api/authApi';
import { ROLES, ROLE_DASHBOARD, ROUTES } from '../constants';

// ---------------------------------------------------------------------------
// Role normalisation
// The backend may return role strings in various forms (e.g. APARTMENT_ADMIN,
// apartment_admin, admin). We normalise them to our internal ROLES constants.
// ---------------------------------------------------------------------------
const ROLE_ALIAS_MAP = {
  apartment_admin: ROLES.ADMIN,
  APARTMENT_ADMIN: ROLES.ADMIN,
  ADMIN: ROLES.ADMIN,
  maintenance_staff: ROLES.STAFF,
  MAINTENANCE_STAFF: ROLES.STAFF,
  STAFF: ROLES.STAFF,
  super_admin: ROLES.SUPER_ADMIN,
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  resident: ROLES.RESIDENT,
  RESIDENT: ROLES.RESIDENT,
  admin: ROLES.ADMIN,
  staff: ROLES.STAFF,
};

function normaliseRole(rawRole) {
  if (!rawRole) return null;
  return ROLE_ALIAS_MAP[rawRole] ?? rawRole;
}

function normaliseUser(user) {
  if (!user) return null;
  return {
    ...user,
    role: normaliseRole(user.role),
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
  /**
   * loading=true   → initial session check in progress (show page loader)
   * loading=false  → session check complete; user may be null or an object
   */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------------------------
  // Session restoration — runs on mount
  // Reliable cleanup ensuring loading is ALWAYS cleared on success, 401, or offline.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let isSubscribed = true;

    async function restoreSession() {
      try {
        const rawUser = await getCurrentUser();
        if (isSubscribed) {
          setUser(rawUser ? normaliseUser(rawUser) : null);
        }
      } catch {
        // 401 = no valid session (expected unauthenticated visitor)
        // Network error = backend unavailable
        // In either case, treat as unauthenticated visitor
        if (isSubscribed) {
          setUser(null);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    // Absolute fallback timer (max 4s): guarantees loading state is never stuck
    const safetyTimer = setTimeout(() => {
      if (isSubscribed) {
        setLoading(false);
      }
    }, 4000);

    return () => {
      isSubscribed = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------
  const login = useCallback(async ({ email, password }) => {
    const { user: rawUser } = await apiLogin({ email, password });

    // If login response already contains user, use it directly.
    // Otherwise fallback to /auth/me call.
    let resolvedUser = rawUser;
    if (!resolvedUser) {
      resolvedUser = await getCurrentUser();
    }

    if (!resolvedUser) {
      throw new Error('Login succeeded but user data was not returned by the server.');
    }

    const normUser = normaliseUser(resolvedUser);
    setUser(normUser);
    return normUser;
  }, []);

  // -------------------------------------------------------------------------
  // logout()
  // -------------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Even if server request fails, clear local in-memory state
    } finally {
      setUser(null);
    }
  }, []);

  // -------------------------------------------------------------------------
  // refreshUser() — re-fetches /auth/me to sync stale profile data
  // -------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const rawUser = await getCurrentUser();
      setUser(rawUser ? normaliseUser(rawUser) : null);
    } catch {
      // Keep existing user if request fails
    }
  }, []);

  // -------------------------------------------------------------------------
  // getDashboardRoute() — returns the home route for the current role
  // -------------------------------------------------------------------------
  const getDashboardRoute = useCallback(
    (roleOverride) => {
      const r = roleOverride ?? user?.role;
      return ROLE_DASHBOARD[r] ?? ROUTES.LOGIN;
    },
    [user],
  );

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    role: user?.role ?? null,
    login,
    logout,
    refreshUser,
    getDashboardRoute,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
