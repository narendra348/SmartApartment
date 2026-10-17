// Application-wide constants

export const APP_NAME = 'SmartApartment';
export const APP_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// User roles
// These strings must match exactly what the backend returns in the user object.
// The backend may return any of these variants — keep both sets mapped below.
// ---------------------------------------------------------------------------
export const ROLES = {
  // Primary values (what our UI logic branches on)
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',           // also returned as 'APARTMENT_ADMIN' by some backends
  RESIDENT: 'resident',
  STAFF: 'staff',           // also returned as 'MAINTENANCE_STAFF' by some backends

  // Backend aliases — normalised to the above in AuthContext
  APARTMENT_ADMIN: 'apartment_admin',
  MAINTENANCE_STAFF: 'maintenance_staff',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.APARTMENT_ADMIN]: 'Admin',
  [ROLES.RESIDENT]: 'Resident',
  [ROLES.STAFF]: 'Staff',
  [ROLES.MAINTENANCE_STAFF]: 'Staff',
};

// ---------------------------------------------------------------------------
// Route paths
// ---------------------------------------------------------------------------
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER_APARTMENT: '/register-apartment',
  ACCEPT_INVITATION: '/accept-invitation',
  NOT_FOUND: '/404',
  FORBIDDEN: '/403',

  SUPER_ADMIN: {
    DASHBOARD: '/super-admin/dashboard',
    APARTMENTS: '/super-admin/apartments',
    PENDING_APPROVALS: '/super-admin/apartments/pending',
    AUDIT_LOGS: '/super-admin/audit-logs',
    PROFILE: '/super-admin/profile',
    // Compatibility aliases
    USERS: '/super-admin/users',
    SETTINGS: '/super-admin/settings',
  },

  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    BUILDINGS: '/admin/buildings',
    BUILDINGS_NEW: '/admin/buildings/new',
    FLATS: '/admin/flats',
    FLATS_NEW: '/admin/flats/new',
    RESIDENTS: '/admin/residents',
    RESIDENTS_NEW: '/admin/residents/new',
    MAINTENANCE_RULES: '/admin/maintenance-rules',
    BILLS: '/admin/bills',
    PAYMENTS: '/admin/payments',
    COMPLAINTS: '/admin/complaints',
    WORK_ORDERS: '/admin/work-orders',
    EXPENSES: '/admin/expenses',
    ANNOUNCEMENTS: '/admin/announcements',
    REPORTS_COLLECTIONS: '/admin/reports/collections',
    REPORTS_OUTSTANDING: '/admin/reports/outstanding',
    REPORTS_EXPENSES: '/admin/reports/expenses',
    AUDIT_LOGS: '/admin/audit-logs',
    PROFILE: '/admin/profile',
    // Compatibility aliases
    UNITS: '/admin/flats',
    MAINTENANCE: '/admin/maintenance-rules',
    BILLING: '/admin/bills',
    STAFF: '/admin/work-orders',
    REPORTS: '/admin/reports/collections',
    SETTINGS: '/admin/profile',
  },

  RESIDENT: {
    DASHBOARD: '/resident/dashboard',
    BILLS: '/resident/bills',
    PAYMENTS: '/resident/payments',
    COMPLAINTS: '/resident/complaints',
    ANNOUNCEMENTS: '/resident/announcements',
    PROFILE: '/resident/profile',
    // Compatibility aliases
    MAINTENANCE: '/resident/complaints',
    BILLING: '/resident/bills',
  },

  STAFF: {
    DASHBOARD: '/staff/dashboard',
    WORK_ORDERS: '/staff/work-orders',
    ANNOUNCEMENTS: '/staff/announcements',
    PROFILE: '/staff/profile',
    // Compatibility aliases
    TASKS: '/staff/work-orders',
  },
};

// ---------------------------------------------------------------------------
// Role → default dashboard mapping (used after login redirect)
// ---------------------------------------------------------------------------
export const ROLE_DASHBOARD = {
  [ROLES.SUPER_ADMIN]: ROUTES.SUPER_ADMIN.DASHBOARD,
  [ROLES.ADMIN]: ROUTES.ADMIN.DASHBOARD,
  [ROLES.APARTMENT_ADMIN]: ROUTES.ADMIN.DASHBOARD,
  [ROLES.RESIDENT]: ROUTES.RESIDENT.DASHBOARD,
  [ROLES.STAFF]: ROUTES.STAFF.DASHBOARD,
  [ROLES.MAINTENANCE_STAFF]: ROUTES.STAFF.DASHBOARD,
};

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Maintenance request statuses
export const MAINTENANCE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

// Bill statuses
export const BILL_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  PARTIALLY_PAID: 'partially_paid',
  CANCELLED: 'cancelled',
};
