import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DesktopSidebar, MobileSidebar } from '../components/layout/Sidebar';
import TopHeader from '../components/layout/TopHeader';

/**
 * Derive a clean, human-readable page title from the current URL path.
 */
function derivePageTitle(pathname) {
  const titles = {
    '/super-admin/dashboard': 'Super Admin Dashboard',
    '/super-admin/apartments': 'Apartments Overview',
    '/super-admin/apartments/pending': 'Pending Apartment Approvals',
    '/super-admin/audit-logs': 'Platform Audit Logs',
    '/super-admin/profile': 'Super Admin Profile',

    '/admin/dashboard': 'Apartment Admin Dashboard',
    '/admin/buildings': 'Buildings Management',
    '/admin/flats': 'Flats & Units',
    '/admin/residents': 'Residents Directory',
    '/admin/maintenance-rules': 'Maintenance Rules',
    '/admin/bills': 'Billing Management',
    '/admin/payments': 'Payment Verification',
    '/admin/expenses': 'Expenses Tracking',
    '/admin/complaints': 'Complaints Management',
    '/admin/work-orders': 'Work Orders',
    '/admin/announcements': 'Announcements',
    '/admin/reports/collections': 'Collection Reports',
    '/admin/reports/outstanding': 'Outstanding Balance Reports',
    '/admin/reports/expenses': 'Expense Reports',
    '/admin/audit-logs': 'Community Audit Logs',
    '/admin/profile': 'Admin Profile',

    '/resident/dashboard': 'Resident Dashboard',
    '/resident/bills': 'My Bills',
    '/resident/payments': 'My Payments',
    '/resident/complaints': 'My Complaints',
    '/resident/announcements': 'Apartment Announcements',
    '/resident/profile': 'Resident Profile',

    '/staff/dashboard': 'Maintenance Staff Dashboard',
    '/staff/work-orders': 'My Work Orders',
    '/staff/announcements': 'Staff Announcements',
    '/staff/profile': 'Staff Profile',
  };

  if (titles[pathname]) {
    return titles[pathname];
  }

  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return 'Dashboard';
  const last = segments[segments.length - 1];
  return last
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const pageTitle = derivePageTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <DesktopSidebar />

      {/* Mobile sidebar drawer */}
      <MobileSidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main content area offset by sidebar on lg+ */}
      <div className="lg:pl-64 flex flex-col min-h-screen transition-all duration-200">
        <TopHeader
          onMenuClick={() => setMobileOpen(true)}
          pageTitle={pageTitle}
        />

        <main
          id="main-content"
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto"
          role="main"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
