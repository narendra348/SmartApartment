import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Receipt,
  CreditCard,
  AlertTriangle,
  Megaphone,
  Home,
  RefreshCw,
  ArrowRight,
  Clock,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import StatCard from '../../components/dashboard/StatCard';
import DashboardSection from '../../components/dashboard/DashboardSection';
import { getResidentDashboardData } from '../../api/dashboardApi';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';

export default function ResidentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getResidentDashboardData();
      setData(response);
    } catch (err) {
      // Isolate real error - do not fake data
      setError(err.message || 'Failed to fetch resident account details.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derive flat info from data or user session
  const buildingName = data?.flatInfo?.buildingName || user?.building || '—';
  const flatNumber = data?.flatInfo?.flatNumber || user?.flat || '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name || 'Resident'}`}
        subtitle={`Flat: ${buildingName} - ${flatNumber}`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Quick Actions:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate(ROUTES.RESIDENT.PAYMENTS)}
            iconLeft={CreditCard}
          >
            Submit Payment Details
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(ROUTES.RESIDENT.BILLS)}
            iconLeft={Receipt}
          >
            View My Bills
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(ROUTES.RESIDENT.COMPLAINTS)}
            iconLeft={AlertTriangle}
          >
            Raise Complaint
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(ROUTES.RESIDENT.ANNOUNCEMENTS)}
            iconLeft={Megaphone}
          >
            View Announcements
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard loading title="Outstanding Balance" />
            <StatCard loading title="Latest Bill Due" />
            <StatCard loading title="Open Complaints" />
          </div>
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse p-6" />
        </div>
      )}

      {/* Error / Offline State */}
      {!loading && error && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Resident Portal Service Unavailable"
            description={
              error ||
              'Unable to retrieve resident billing and service records from the server.'
            }
            onRetry={fetchDashboardData}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /dashboard/resident
            </code>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !data && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Home}
            title="No billing or ticket history"
            description="Your flat account is set up. You have no pending bills or active complaints."
            action={{
              label: 'View Announcements',
              onClick: () => navigate(ROUTES.RESIDENT.ANNOUNCEMENTS),
            }}
          />
        </div>
      )}

      {/* Real Data View */}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Outstanding Balance"
              value={
                data.outstandingBalance !== undefined
                  ? `₹${Number(data.outstandingBalance).toLocaleString()}`
                  : '₹0'
              }
              icon={Receipt}
              color={data.outstandingBalance > 0 ? 'amber' : 'emerald'}
              subtitle={
                data.outstandingBalance > 0
                  ? 'Payment required for outstanding dues'
                  : 'All dues settled up to date'
              }
            />
            <StatCard
              title="Latest Bill Due Date"
              value={data.latestBill?.dueDate || (data.latestBill ? 'Due Now' : 'None')}
              icon={Clock}
              color="blue"
              subtitle={
                data.latestBill
                  ? `Amount: ₹${data.latestBill.amount || 0}`
                  : 'No upcoming bills issued'
              }
            />
            <StatCard
              title="Open Complaints"
              value={data.openComplaintsCount ?? 0}
              icon={AlertTriangle}
              color="slate"
              onClick={() => navigate(ROUTES.RESIDENT.COMPLAINTS)}
              subtitle="Tickets currently in progress"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latest Bill & Recent Payments */}
            <DashboardSection
              title="Recent Payment Submissions"
              subtitle="Verification status of submitted payments"
              actions={
                <Link
                  to={ROUTES.RESIDENT.PAYMENTS}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  History <ArrowRight size={14} />
                </Link>
              }
            >
              {data.recentPayments && data.recentPayments.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.recentPayments.map((payment) => (
                    <div
                      key={payment.id || payment._id}
                      className="py-3 flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          ₹{payment.amount} via {payment.paymentMethod || 'Bank Transfer'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '—'} · Ref: {payment.referenceNumber || 'N/A'}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          payment.status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700'
                            : payment.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {payment.status === 'verified'
                          ? 'Verified'
                          : payment.status === 'rejected'
                          ? 'Rejected'
                          : 'Pending Verification'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No payment records found.
                </p>
              )}
            </DashboardSection>

            {/* Community Announcements */}
            <DashboardSection
              title="Apartment Announcements"
              subtitle="Recent notices from building management"
              actions={
                <Link
                  to={ROUTES.RESIDENT.ANNOUNCEMENTS}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  All Notices <ArrowRight size={14} />
                </Link>
              }
            >
              {data.recentAnnouncements && data.recentAnnouncements.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.recentAnnouncements.map((item) => (
                    <div key={item.id || item._id} className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800 text-sm">{item.title}</p>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {item.content || item.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No announcements at this time.
                </p>
              )}
            </DashboardSection>
          </div>
        </>
      )}
    </div>
  );
}
