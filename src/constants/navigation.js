import {
  LayoutDashboard,
  Building,
  Building2,
  Clock,
  ShieldCheck,
  User,
  Home,
  Users,
  Sliders,
  Receipt,
  CreditCard,
  AlertTriangle,
  ClipboardList,
  Wallet,
  Megaphone,
  BarChart3,
  TrendingUp,
  PieChart,
} from 'lucide-react';
import { ROLES, ROUTES } from './index';

/**
 * Role-based navigation items configuration
 */
export const NAV_ITEMS_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: [
    { label: 'Dashboard', href: ROUTES.SUPER_ADMIN.DASHBOARD, icon: LayoutDashboard },
    { label: 'Apartments', href: ROUTES.SUPER_ADMIN.APARTMENTS, icon: Building },
    { label: 'Pending Approvals', href: ROUTES.SUPER_ADMIN.PENDING_APPROVALS, icon: Clock },
    { label: 'Audit Logs', href: ROUTES.SUPER_ADMIN.AUDIT_LOGS, icon: ShieldCheck },
    { label: 'Profile', href: ROUTES.SUPER_ADMIN.PROFILE, icon: User },
  ],

  [ROLES.ADMIN]: [
    { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard, group: 'Overview' },
    { label: 'Buildings', href: ROUTES.ADMIN.BUILDINGS, icon: Building2, group: 'Property' },
    { label: 'Flats', href: ROUTES.ADMIN.FLATS, icon: Home, group: 'Property' },
    { label: 'Residents', href: ROUTES.ADMIN.RESIDENTS, icon: Users, group: 'Property' },
    { label: 'Maintenance Rules', href: ROUTES.ADMIN.MAINTENANCE_RULES, icon: Sliders, group: 'Operations' },
    { label: 'Bills', href: ROUTES.ADMIN.BILLS, icon: Receipt, group: 'Finance' },
    { label: 'Payment Verification', href: ROUTES.ADMIN.PAYMENTS, icon: CreditCard, group: 'Finance' },
    { label: 'Expenses', href: ROUTES.ADMIN.EXPENSES, icon: Wallet, group: 'Finance' },
    { label: 'Complaints', href: ROUTES.ADMIN.COMPLAINTS, icon: AlertTriangle, group: 'Operations' },
    { label: 'Work Orders', href: ROUTES.ADMIN.WORK_ORDERS, icon: ClipboardList, group: 'Operations' },
    { label: 'Announcements', href: ROUTES.ADMIN.ANNOUNCEMENTS, icon: Megaphone, group: 'Communication' },
    { label: 'Collection Reports', href: ROUTES.ADMIN.REPORTS_COLLECTIONS, icon: BarChart3, group: 'Reports' },
    { label: 'Outstanding Reports', href: ROUTES.ADMIN.REPORTS_OUTSTANDING, icon: TrendingUp, group: 'Reports' },
    { label: 'Expense Reports', href: ROUTES.ADMIN.REPORTS_EXPENSES, icon: PieChart, group: 'Reports' },
    { label: 'Audit Logs', href: ROUTES.ADMIN.AUDIT_LOGS, icon: ShieldCheck, group: 'System' },
    { label: 'Profile', href: ROUTES.ADMIN.PROFILE, icon: User, group: 'System' },
  ],

  [ROLES.APARTMENT_ADMIN]: [
    { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard, group: 'Overview' },
    { label: 'Buildings', href: ROUTES.ADMIN.BUILDINGS, icon: Building2, group: 'Property' },
    { label: 'Flats', href: ROUTES.ADMIN.FLATS, icon: Home, group: 'Property' },
    { label: 'Residents', href: ROUTES.ADMIN.RESIDENTS, icon: Users, group: 'Property' },
    { label: 'Maintenance Rules', href: ROUTES.ADMIN.MAINTENANCE_RULES, icon: Sliders, group: 'Operations' },
    { label: 'Bills', href: ROUTES.ADMIN.BILLS, icon: Receipt, group: 'Finance' },
    { label: 'Payment Verification', href: ROUTES.ADMIN.PAYMENTS, icon: CreditCard, group: 'Finance' },
    { label: 'Expenses', href: ROUTES.ADMIN.EXPENSES, icon: Wallet, group: 'Finance' },
    { label: 'Complaints', href: ROUTES.ADMIN.COMPLAINTS, icon: AlertTriangle, group: 'Operations' },
    { label: 'Work Orders', href: ROUTES.ADMIN.WORK_ORDERS, icon: ClipboardList, group: 'Operations' },
    { label: 'Announcements', href: ROUTES.ADMIN.ANNOUNCEMENTS, icon: Megaphone, group: 'Communication' },
    { label: 'Collection Reports', href: ROUTES.ADMIN.REPORTS_COLLECTIONS, icon: BarChart3, group: 'Reports' },
    { label: 'Outstanding Reports', href: ROUTES.ADMIN.REPORTS_OUTSTANDING, icon: TrendingUp, group: 'Reports' },
    { label: 'Expense Reports', href: ROUTES.ADMIN.REPORTS_EXPENSES, icon: PieChart, group: 'Reports' },
    { label: 'Audit Logs', href: ROUTES.ADMIN.AUDIT_LOGS, icon: ShieldCheck, group: 'System' },
    { label: 'Profile', href: ROUTES.ADMIN.PROFILE, icon: User, group: 'System' },
  ],

  [ROLES.RESIDENT]: [
    { label: 'Dashboard', href: ROUTES.RESIDENT.DASHBOARD, icon: LayoutDashboard },
    { label: 'My Bills', href: ROUTES.RESIDENT.BILLS, icon: Receipt },
    { label: 'My Payments', href: ROUTES.RESIDENT.PAYMENTS, icon: CreditCard },
    { label: 'My Complaints', href: ROUTES.RESIDENT.COMPLAINTS, icon: AlertTriangle },
    { label: 'Announcements', href: ROUTES.RESIDENT.ANNOUNCEMENTS, icon: Megaphone },
    { label: 'Profile', href: ROUTES.RESIDENT.PROFILE, icon: User },
  ],

  [ROLES.STAFF]: [
    { label: 'Dashboard', href: ROUTES.STAFF.DASHBOARD, icon: LayoutDashboard },
    { label: 'My Work Orders', href: ROUTES.STAFF.WORK_ORDERS, icon: ClipboardList },
    { label: 'Announcements', href: ROUTES.STAFF.ANNOUNCEMENTS, icon: Megaphone },
    { label: 'Profile', href: ROUTES.STAFF.PROFILE, icon: User },
  ],

  [ROLES.MAINTENANCE_STAFF]: [
    { label: 'Dashboard', href: ROUTES.STAFF.DASHBOARD, icon: LayoutDashboard },
    { label: 'My Work Orders', href: ROUTES.STAFF.WORK_ORDERS, icon: ClipboardList },
    { label: 'Announcements', href: ROUTES.STAFF.ANNOUNCEMENTS, icon: Megaphone },
    { label: 'Profile', href: ROUTES.STAFF.PROFILE, icon: User },
  ],
};

/**
 * Helper to get navigation items for an authenticated user role
 */
export function getNavItemsForRole(role) {
  if (!role) return [];
  return NAV_ITEMS_BY_ROLE[role] || [];
}
