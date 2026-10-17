/**
 * GuestRoute.jsx
 *
 * Wraps routes that should only be accessible by unauthenticated visitors
 * (login, register, accept-invitation).
 *
 * Behaviour:
 *  1. While session check is in progress → render a full-page loader.
 *  2. Authenticated → redirect to the user's role-appropriate dashboard.
 *  3. Not authenticated → render child routes via <Outlet>.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/LoadingSpinner';

function GuestRoute() {
  const { isAuthenticated, loading, getDashboardRoute } = useAuth();

  // 1. Session restoration in progress
  if (loading) {
    return <PageLoader message="Loading…" />;
  }

  // 2. Already authenticated → send to their dashboard
  if (isAuthenticated) {
    return <Navigate to={getDashboardRoute()} replace />;
  }

  // 3. Guest — allow access
  return <Outlet />;
}

export default GuestRoute;
