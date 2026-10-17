/**
 * ProtectedRoute.jsx
 *
 * Wraps routes that require authentication and, optionally, a specific role.
 *
 * Behaviour:
 *  1. While session check is in progress → render a full-page loader.
 *  2. Not authenticated → redirect to /login, preserving the intended path.
 *  3. Authenticated but wrong role → render the ForbiddenPage (403).
 *  4. Authenticated and authorised → render child routes via <Outlet>.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants';
import { PageLoader } from '../ui/LoadingSpinner';
import ForbiddenPage from '../../pages/ForbiddenPage';

/**
 * @param {string|string[]} [roles]  — allowed role(s). Omit to allow any authenticated user.
 */
function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  // 1. Session restoration in progress
  if (loading) {
    return <PageLoader message="Checking session…" />;
  }

  // 2. Not authenticated — redirect to login and remember where they were going
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // 3. Role check — only enforced when roles prop is provided
  if (roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(role)) {
      return <ForbiddenPage />;
    }
  }

  // 4. Authorised — render children
  return <Outlet />;
}

export default ProtectedRoute;
