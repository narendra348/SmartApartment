import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Megaphone,
  RefreshCw,
  ArrowRight,
  Play,
  Wrench,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import StatCard from '../../components/dashboard/StatCard';
import DashboardSection from '../../components/dashboard/DashboardSection';
import { getStaffDashboardData } from '../../api/dashboardApi';
import { ROUTES } from '../../constants';
import { useAuth } from '../../context/AuthContext';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getStaffDashboardData();
      setData(response);
    } catch (err) {
      // Isolate real error - do not fake data
      setError(err.message || 'Failed to fetch maintenance staff work orders.');
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
        title="Maintenance Staff Dashboard"
        subtitle={`Logged in as ${user?.name || 'Staff'}`}
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
            onClick={() => navigate(ROUTES.STAFF.WORK_ORDERS)}
            iconLeft={ClipboardList}
          >
            My Work Orders
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(ROUTES.STAFF.ANNOUNCEMENTS)}
            iconLeft={Megaphone}
          >
            View Announcements
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard loading title="Assigned Work Orders" />
            <StatCard loading title="In Progress" />
            <StatCard loading title="Completed Work Orders" />
          </div>
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse p-6" />
        </div>
      )}

      {/* Error / Offline State */}
      {!loading && error && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Maintenance Service Unavailable"
            description={
              error ||
              'Unable to connect to the maintenance assignments backend endpoint.'
            }
            onRetry={fetchDashboardData}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /dashboard/staff
            </code>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !data && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={ClipboardList}
            title="No work orders assigned"
            description="You currently have no pending tasks or assigned repair tickets."
            action={{
              label: 'Check Announcements',
              onClick: () => navigate(ROUTES.STAFF.ANNOUNCEMENTS),
            }}
          />
        </div>
      )}

      {/* Real Data View */}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Assigned Work Orders"
              value={data.assignedOrdersCount ?? 0}
              icon={ClipboardList}
              color="blue"
              subtitle="Total active queue"
            />
            <StatCard
              title="In Progress"
              value={data.inProgressOrdersCount ?? 0}
              icon={Clock}
              color="amber"
              subtitle="Currently being worked on"
            />
            <StatCard
              title="Completed Orders"
              value={data.completedOrdersCount ?? 0}
              icon={CheckCircle2}
              color="emerald"
              subtitle="Resolved tasks"
            />
          </div>

          {/* Recent Work Orders Assignments */}
          <DashboardSection
            title="Recent Work Order Assignments"
            subtitle="Prioritized maintenance jobs assigned to you"
            actions={
              <Link
                to={ROUTES.STAFF.WORK_ORDERS}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                All Work Orders <ArrowRight size={14} />
              </Link>
            }
          >
            {data.recentAssignments && data.recentAssignments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">Task / Issue</th>
                      <th className="pb-3">Location</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentAssignments.map((task) => (
                      <tr key={task.id || task._id} className="hover:bg-slate-50/50">
                        <td className="py-3 font-medium text-slate-800">
                          {task.title || task.issue || 'Maintenance Task'}
                        </td>
                        <td className="py-3 text-xs text-slate-600">
                          {task.location || `Flat ${task.flatNumber || '—'}`}
                        </td>
                        <td className="py-3 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded font-medium ${
                              task.priority === 'urgent' || task.priority === 'high'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority || 'Normal'}
                          </span>
                        </td>
                        <td className="py-3 text-xs">
                          <span className="capitalize text-slate-600">
                            {task.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to={`${ROUTES.STAFF.WORK_ORDERS}?id=${task.id || task._id}`}
                            className="text-xs font-medium text-sky-600 hover:text-sky-700 inline-flex items-center gap-1"
                          >
                            <Play size={12} /> Open Task
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                <Wrench size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="font-medium text-slate-700">No active work orders</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your task queue is clear. New repair assignments will appear here.
                </p>
              </div>
            )}
          </DashboardSection>
        </>
      )}
    </div>
  );
}
