import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Receipt,
  CreditCard,
  AlertTriangle,
  Building2,
  UserPlus,
  RefreshCw,
  ArrowRight,
  Clock,
  DollarSign,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import StatCard from '../../components/dashboard/StatCard';
import DashboardSection from '../../components/dashboard/DashboardSection';
import { getAdminDashboardData } from '../../api/dashboardApi';
import { ROUTES } from '../../constants';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminDashboardData();
      setData(response);
    } catch (err) {
      // Isolate real error - do not fake data
      setError(err.message || 'Failed to fetch apartment administration metrics.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apartment Administration Dashboard"
        subtitle="Manage building units, resident billing, collections, and maintenance operations."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDashboardData}
              disabled={loading}
              iconLeft={RefreshCw}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Quick Links Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Quick Actions:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(ROUTES.ADMIN.BILLS)}
            iconLeft={Receipt}
          >
            Create Bill
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(ROUTES.ADMIN.BUILDINGS_NEW)}
            iconLeft={Building2}
          >
            Add Building
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate(ROUTES.ADMIN.RESIDENTS_NEW)}
            iconLeft={UserPlus}
          >
            Invite Resident
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard loading title="Total Flats" />
            <StatCard loading title="Occupied Flats" />
            <StatCard loading title="Total Collections" />
            <StatCard loading title="Outstanding Balance" />
          </div>
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse p-6" />
        </div>
      )}

      {/* Error / Backend Unavailable State */}
      {!loading && error && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Apartment Dashboard Service Unavailable"
            description={
              error ||
              'Unable to connect to the Admin dashboard endpoint. Please verify the backend service is running.'
            }
            onRetry={fetchDashboardData}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /dashboard/admin
            </code>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !data && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Building2}
            title="No community data available"
            description="Start by adding buildings and flats to begin tracking apartment metrics."
            action={{
              label: 'Add Building',
              onClick: () => navigate(ROUTES.ADMIN.BUILDINGS),
            }}
          />
        </div>
      )}

      {/* Real Data View */}
      {!loading && !error && data && (
        <>
          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Flats"
              value={data.totalFlats ?? 0}
              icon={Home}
              color="blue"
              subtitle={
                data.occupiedFlats !== undefined
                  ? `${data.occupiedFlats} occupied (${
                      data.totalFlats
                        ? Math.round((data.occupiedFlats / data.totalFlats) * 100)
                        : 0
                    }%)`
                  : undefined
              }
            />
            <StatCard
              title="Collections"
              value={
                data.totalCollections !== undefined
                  ? `₹${Number(data.totalCollections).toLocaleString()}`
                  : '₹0'
              }
              icon={DollarSign}
              color="emerald"
              subtitle="Current period receipts"
            />
            <StatCard
              title="Outstanding Balance"
              value={
                data.outstandingBalance !== undefined
                  ? `₹${Number(data.outstandingBalance).toLocaleString()}`
                  : '₹0'
              }
              icon={Receipt}
              color="amber"
              trend={data.pendingBillsCount ? `${data.pendingBillsCount} bills due` : undefined}
              trendType="negative"
              subtitle="Pending collection"
            />
            <StatCard
              title="Pending Verifications"
              value={data.pendingPaymentsCount ?? 0}
              icon={CreditCard}
              color="violet"
              onClick={() => navigate(ROUTES.ADMIN.PAYMENTS)}
              subtitle="Payments awaiting review"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Bills Issued"
              value={data.billsIssuedCount ?? 0}
              icon={Receipt}
              color="slate"
              subtitle="Current billing cycle"
            />
            <StatCard
              title="Open Complaints"
              value={data.openComplaintsCount ?? 0}
              icon={AlertTriangle}
              color="amber"
              onClick={() => navigate(ROUTES.ADMIN.COMPLAINTS)}
              subtitle="Residents awaiting resolution"
            />
            <StatCard
              title="Active Work Orders"
              value={data.activeWorkOrdersCount ?? 0}
              icon={Clock}
              color="blue"
              onClick={() => navigate(ROUTES.ADMIN.WORK_ORDERS)}
              subtitle="Staff maintenance assignments"
            />
          </div>

          {/* Collection Chart if available */}
          {data.collectionTrends && data.collectionTrends.length > 0 && (
            <DashboardSection
              title="Collection Trends"
              subtitle="Historical monthly maintenance fee receipts"
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.collectionTrends}>
                    <defs>
                      <linearGradient id="collectionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#0284c7"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#collectionGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </DashboardSection>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Payment Verifications Shortcut Preview */}
            <DashboardSection
              title="Pending Payment Verifications"
              subtitle="Bank transfers and UPI receipts submitted by residents"
              actions={
                <Link
                  to={ROUTES.ADMIN.PAYMENTS}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  Verify All <ArrowRight size={14} />
                </Link>
              }
            >
              {data.recentPayments && data.recentPayments.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.recentPayments.map((payment) => (
                    <div
                      key={payment.id || payment._id}
                      className="py-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {payment.residentName || 'Resident'} · Flat {payment.flatNumber || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          ₹{payment.amount} · Ref: {payment.referenceNumber || 'N/A'}
                        </p>
                      </div>
                      <Link
                        to={`${ROUTES.ADMIN.PAYMENTS}?id=${payment.id || payment._id}`}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700 px-2 py-1 bg-sky-50 rounded"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No pending payment verifications.
                </p>
              )}
            </DashboardSection>

            {/* Open Complaints Preview */}
            <DashboardSection
              title="Open Complaints"
              subtitle="Urgent maintenance tickets requiring attention"
              actions={
                <Link
                  to={ROUTES.ADMIN.COMPLAINTS}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  View All <ArrowRight size={14} />
                </Link>
              }
            >
              {data.recentComplaints && data.recentComplaints.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.recentComplaints.map((complaint) => (
                    <div
                      key={complaint.id || complaint._id}
                      className="py-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {complaint.title || complaint.category || 'Maintenance Issue'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Flat {complaint.flatNumber || '—'} · {complaint.priority || 'Normal'} priority
                        </p>
                      </div>
                      <Link
                        to={`${ROUTES.ADMIN.COMPLAINTS}/${complaint.id || complaint._id}`}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700 px-2 py-1 bg-slate-100 rounded"
                      >
                        View / Assign
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No unresolved complaints.
                </p>
              )}
            </DashboardSection>
          </div>
        </>
      )}
    </div>
  );
}
