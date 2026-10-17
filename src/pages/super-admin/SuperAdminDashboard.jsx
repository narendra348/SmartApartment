import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building,
  Clock,
  CheckCircle,
  AlertOctagon,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import StatCard from '../../components/dashboard/StatCard';
import DashboardSection from '../../components/dashboard/DashboardSection';
import { getSuperAdminDashboardData } from '../../api/dashboardApi';
import { ROUTES } from '../../constants';

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSuperAdminDashboardData();
      setData(response);
    } catch (err) {
      // Isolate real error - do not fake data
      setError(err.message || 'Failed to fetch platform dashboard metrics.');
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
        title="Platform Administration Dashboard"
        subtitle="Multi-tenant platform overview and apartment onboarding management."
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

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard loading title="Total Apartments" />
            <StatCard loading title="Pending Approvals" />
            <StatCard loading title="Approved Apartments" />
            <StatCard loading title="Suspended Apartments" />
          </div>
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse p-6" />
        </div>
      )}

      {/* Error / Offline / Not Connected State */}
      {!loading && error && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Platform Dashboard Service Unavailable"
            description={
              error ||
              'Unable to connect to the Super Admin dashboard endpoint. Please check backend connection.'
            }
            onRetry={fetchDashboardData}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /dashboard/super-admin
            </code>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !data && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Building}
            title="No platform data available"
            description="There are currently no apartments or platform metrics registered on the system."
            action={{
              label: 'Refresh Status',
              onClick: fetchDashboardData,
            }}
          />
        </div>
      )}

      {/* Real Data View */}
      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Apartments"
              value={data.totalApartments ?? 0}
              icon={Building}
              color="blue"
              subtitle="Registered complexes"
            />
            <StatCard
              title="Pending Approvals"
              value={data.pendingApartments ?? 0}
              icon={Clock}
              color="amber"
              trend={data.pendingApartments > 0 ? `${data.pendingApartments} require action` : undefined}
              trendType="negative"
              subtitle="Awaiting administrative review"
            />
            <StatCard
              title="Approved Apartments"
              value={data.approvedApartments ?? 0}
              icon={CheckCircle}
              color="emerald"
              subtitle="Active complexes"
            />
            <StatCard
              title="Suspended Apartments"
              value={data.suspendedApartments ?? 0}
              icon={AlertOctagon}
              color="slate"
              subtitle="Inactive or paused"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pending Approvals Preview */}
            <DashboardSection
              className="lg:col-span-2"
              title="Pending Apartment Approvals"
              subtitle="Recently submitted apartment registrations requiring verification"
              actions={
                <Link
                  to={ROUTES.SUPER_ADMIN.PENDING_APPROVALS}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  View All <ArrowRight size={14} />
                </Link>
              }
            >
              {data.pendingList && data.pendingList.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="pb-3">Apartment Name</th>
                        <th className="pb-3">Admin Email</th>
                        <th className="pb-3">Submitted</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.pendingList.map((apt) => (
                        <tr key={apt.id || apt._id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-medium text-slate-800">
                            {apt.name}
                          </td>
                          <td className="py-3 text-slate-600 text-xs">
                            {apt.adminEmail || apt.email || '—'}
                          </td>
                          <td className="py-3 text-slate-500 text-xs">
                            {apt.createdAt ? new Date(apt.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              to={`${ROUTES.SUPER_ADMIN.PENDING_APPROVALS}?id=${apt.id || apt._id}`}
                              className="text-xs font-medium text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
                            >
                              Review <ExternalLink size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-sm">
                  <CheckCircle size={28} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-medium text-slate-700">No pending approvals</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    All apartment onboarding submissions have been reviewed.
                  </p>
                </div>
              )}
            </DashboardSection>

            {/* Platform Activity / Status Chart */}
            <DashboardSection
              title="Platform Distribution"
              subtitle="Apartment status breakdown"
            >
              {data.chartData && data.chartData.length > 0 ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <ShieldCheck size={28} className="mx-auto text-slate-300 mb-2" />
                  No distribution chart data provided by backend.
                </div>
              )}
            </DashboardSection>
          </div>
        </>
      )}
    </div>
  );
}
