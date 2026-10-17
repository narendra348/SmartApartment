import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES, ROLES } from './constants';

// Layouts
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';

// Route guards
import ProtectedRoute from './components/auth/ProtectedRoute';
import GuestRoute from './components/auth/GuestRoute';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterApartmentPage from './pages/auth/RegisterApartmentPage';
import AcceptInvitationPage from './pages/auth/AcceptInvitationPage';

// Role dashboards
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import ResidentDashboard from './pages/resident/ResidentDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';

// Super Admin module pages
import ApartmentsListPage from './pages/super-admin/ApartmentsListPage';
import PendingApprovalsPage from './pages/super-admin/PendingApprovalsPage';
import AuditLogsPage from './pages/super-admin/AuditLogsPage';
import SuperAdminProfilePage from './pages/super-admin/SuperAdminProfilePage';

// Admin module pages - Buildings & Flats (Prompt 5)
import BuildingsListPage from './pages/admin/buildings/BuildingsListPage';
import BuildingFormPage from './pages/admin/buildings/BuildingFormPage';
import BuildingDetailPage from './pages/admin/buildings/BuildingDetailPage';
import FlatsListPage from './pages/admin/flats/FlatsListPage';
import FlatFormPage from './pages/admin/flats/FlatFormPage';
import FlatDetailPage from './pages/admin/flats/FlatDetailPage';

// Admin module pages - Residents & Invitations (Prompt 6)
import ResidentsListPage from './pages/admin/residents/ResidentsListPage';
import ResidentFormPage from './pages/admin/residents/ResidentFormPage';
import ResidentDetailPage from './pages/admin/residents/ResidentDetailPage';

// Admin module pages - Maintenance Requests & Complaints (Prompt 9/10)
import MaintenanceListPage from './pages/admin/maintenance/MaintenanceListPage';
import MaintenanceFormPage from './pages/admin/maintenance/MaintenanceFormPage';
import MaintenanceDetailPage from './pages/admin/maintenance/MaintenanceDetailPage';

// Admin module pages - Manual Payments & Verification (Prompt 11)
import AdminPaymentsPage from './pages/admin/payments/AdminPaymentsPage';

// Resident module pages - Complaints
import ResidentComplaintsPage from './pages/resident/complaints/ResidentComplaintsPage';

// Resident module pages - Payments (Prompt 11)
import ResidentPaymentsPage from './pages/resident/payments/ResidentPaymentsPage';

// Announcements module pages (Prompt 12)
import AdminAnnouncementsPage from './pages/admin/announcements/AdminAnnouncementsPage';
import ResidentAnnouncementsPage from './pages/resident/announcements/ResidentAnnouncementsPage';
import StaffAnnouncementsPage from './pages/staff/announcements/StaffAnnouncementsPage';

// Reports module pages (Prompt 13)
import CollectionsReportPage from './pages/admin/reports/CollectionsReportPage';
import OutstandingReportPage from './pages/admin/reports/OutstandingReportPage';
import ExpensesReportPage from './pages/admin/reports/ExpensesReportPage';

// Profile pages (Prompt 14)
import AdminProfilePage from './pages/admin/profile/AdminProfilePage';
import ResidentProfilePage from './pages/resident/ResidentProfilePage';
import StaffProfilePage from './pages/staff/StaffProfilePage';

// Staff module pages - Work Orders
import StaffWorkOrdersPage from './pages/staff/work-orders/StaffWorkOrdersPage';

// Placeholder for sidebar modules pending implementation
import ModulePlaceholder from './pages/common/ModulePlaceholder';

// Error pages
import NotFoundPage from './pages/NotFoundPage';
import ForbiddenPage from './pages/ForbiddenPage';

/**
 * App
 *
 * Route tree with strict role-based access control:
 *  /                        → redirect to /login
 *  /login                   ← GuestRoute
 *  /register-apartment      ← GuestRoute
 *  /accept-invitation       ← GuestRoute
 *  /super-admin/*           ← ProtectedRoute (SUPER_ADMIN only)
 *  /admin/*                 ← ProtectedRoute (ADMIN / APARTMENT_ADMIN only)
 *  /resident/*              ← ProtectedRoute (RESIDENT only)
 *  /staff/*                 ← ProtectedRoute (STAFF / MAINTENANCE_STAFF only)
 *  /403                     ← public
 *  /404 + *                 ← public
 */
function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.LOGIN} replace />} />

      {/* ── Guest-only routes ─────────────────────────────────────────────── */}
      <Route element={<GuestRoute />}>
        <Route element={<PublicLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER_APARTMENT} element={<RegisterApartmentPage />} />
          <Route path={ROUTES.ACCEPT_INVITATION} element={<AcceptInvitationPage />} />
        </Route>
      </Route>

      {/* ── Super Admin routes ────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={[ROLES.SUPER_ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.SUPER_ADMIN.DASHBOARD} element={<SuperAdminDashboard />} />
          <Route
            path={ROUTES.SUPER_ADMIN.APARTMENTS}
            element={<ApartmentsListPage />}
          />
          <Route
            path={ROUTES.SUPER_ADMIN.PENDING_APPROVALS}
            element={<PendingApprovalsPage />}
          />
          <Route
            path={ROUTES.SUPER_ADMIN.AUDIT_LOGS}
            element={<AuditLogsPage />}
          />
          <Route
            path={ROUTES.SUPER_ADMIN.PROFILE}
            element={<SuperAdminProfilePage />}
          />
          <Route
            path={ROUTES.SUPER_ADMIN.USERS}
            element={<ModulePlaceholder title="Platform Users" />}
          />
          <Route
            path={ROUTES.SUPER_ADMIN.SETTINGS}
            element={<ModulePlaceholder title="Platform Settings" />}
          />
        </Route>
      </Route>

      {/* ── Admin routes ──────────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.APARTMENT_ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />
          {/* Buildings Management */}
          <Route path={ROUTES.ADMIN.BUILDINGS} element={<BuildingsListPage />} />
          <Route path={ROUTES.ADMIN.BUILDINGS_NEW} element={<BuildingFormPage />} />
          <Route path="/admin/buildings/:id" element={<BuildingDetailPage />} />
          <Route path="/admin/buildings/:id/edit" element={<BuildingFormPage />} />

          {/* Flats Management */}
          <Route path={ROUTES.ADMIN.FLATS} element={<FlatsListPage />} />
          <Route path={ROUTES.ADMIN.FLATS_NEW} element={<FlatFormPage />} />
          <Route path="/admin/flats/:id" element={<FlatDetailPage />} />
          <Route path="/admin/flats/:id/edit" element={<FlatFormPage />} />
          {/* Residents Management */}
          <Route path={ROUTES.ADMIN.RESIDENTS} element={<ResidentsListPage />} />
          <Route path={ROUTES.ADMIN.RESIDENTS_NEW} element={<ResidentFormPage />} />
          <Route path="/admin/residents/:id" element={<ResidentDetailPage />} />
          <Route path="/admin/residents/:id/edit" element={<ResidentFormPage />} />
          <Route
            path={ROUTES.ADMIN.MAINTENANCE_RULES}
            element={<ModulePlaceholder title="Maintenance Rules Configuration" />}
          />
          <Route
            path={ROUTES.ADMIN.BILLS}
            element={<ModulePlaceholder title="Billing Management & Generation" />}
          />
          <Route path={ROUTES.ADMIN.PAYMENTS} element={<AdminPaymentsPage />} />
          <Route path="/admin/payments/:id" element={<AdminPaymentsPage />} />
          {/* Maintenance Requests & Complaints */}
          <Route path={ROUTES.ADMIN.COMPLAINTS} element={<MaintenanceListPage />} />
          <Route path={`${ROUTES.ADMIN.COMPLAINTS}/new`} element={<MaintenanceFormPage />} />
          <Route path="/admin/complaints/:id" element={<MaintenanceDetailPage />} />
          <Route
            path={ROUTES.ADMIN.WORK_ORDERS}
            element={<ModulePlaceholder title="Work Orders Management" />}
          />
          <Route
            path={ROUTES.ADMIN.EXPENSES}
            element={<ModulePlaceholder title="Expenses Tracking" />}
          />
          <Route path={ROUTES.ADMIN.ANNOUNCEMENTS} element={<AdminAnnouncementsPage />} />
          <Route path="/admin/announcements/:id" element={<AdminAnnouncementsPage />} />
          {/* Reports & Analytics (Prompt 13) */}
          <Route
            path="/admin/reports"
            element={<Navigate to={ROUTES.ADMIN.REPORTS_COLLECTIONS} replace />}
          />
          <Route
            path={ROUTES.ADMIN.REPORTS_COLLECTIONS}
            element={<CollectionsReportPage />}
          />
          <Route
            path={ROUTES.ADMIN.REPORTS_OUTSTANDING}
            element={<OutstandingReportPage />}
          />
          <Route
            path={ROUTES.ADMIN.REPORTS_EXPENSES}
            element={<ExpensesReportPage />}
          />
          <Route
            path={ROUTES.ADMIN.AUDIT_LOGS}
            element={<ModulePlaceholder title="Community Audit Logs" />}
          />
          <Route path={ROUTES.ADMIN.PROFILE} element={<AdminProfilePage />} />
        </Route>
      </Route>

      {/* ── Resident routes ───────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={[ROLES.RESIDENT]} />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.RESIDENT.DASHBOARD} element={<ResidentDashboard />} />
          <Route
            path={ROUTES.RESIDENT.BILLS}
            element={<ModulePlaceholder title="My Bills & Invoices" />}
          />
          <Route path={ROUTES.RESIDENT.PAYMENTS} element={<ResidentPaymentsPage />} />
          <Route path="/resident/payments/:id" element={<ResidentPaymentsPage />} />
          <Route path={ROUTES.RESIDENT.COMPLAINTS} element={<ResidentComplaintsPage />} />
          <Route path={ROUTES.RESIDENT.ANNOUNCEMENTS} element={<ResidentAnnouncementsPage />} />
          <Route path="/resident/announcements/:id" element={<ResidentAnnouncementsPage />} />
          <Route path={ROUTES.RESIDENT.PROFILE} element={<ResidentProfilePage />} />
        </Route>
      </Route>

      {/* ── Staff routes ──────────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={[ROLES.STAFF, ROLES.MAINTENANCE_STAFF]} />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.STAFF.DASHBOARD} element={<StaffDashboard />} />
          <Route path={ROUTES.STAFF.WORK_ORDERS} element={<StaffWorkOrdersPage />} />
          <Route path={ROUTES.STAFF.ANNOUNCEMENTS} element={<StaffAnnouncementsPage />} />
          <Route path="/staff/announcements/:id" element={<StaffAnnouncementsPage />} />
          <Route path={ROUTES.STAFF.PROFILE} element={<StaffProfilePage />} />
        </Route>
      </Route>

      {/* ── Error pages ───────────────────────────────────────────────────── */}
      <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
      <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
