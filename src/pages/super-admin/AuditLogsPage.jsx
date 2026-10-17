import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { getAuditLogs } from '../../api/superAdminApi';
import useDebounce from '../../hooks/useDebounce';

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'LOGIN', label: 'User Login' },
  { value: 'LOGOUT', label: 'User Logout' },
  { value: 'APARTMENT_APPROVE', label: 'Apartment Approved' },
  { value: 'APARTMENT_REJECT', label: 'Apartment Rejected' },
  { value: 'APARTMENT_SUSPEND', label: 'Apartment Suspended' },
  { value: 'APARTMENT_REACTIVATE', label: 'Apartment Reactivated' },
  { value: 'PROFILE_UPDATE', label: 'Profile Updated' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Results' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILURE', label: 'Failure / Error' },
];

export default function AuditLogsPage() {
  // Search & Filter state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [actionFilter, setActionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Data & loading state
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs({
        page,
        limit,
        search: debouncedSearch,
        action: actionFilter,
        status: statusFilter,
      });
      setLogs(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err.message ||
          'Audit log service is currently unavailable. Backend endpoint GET /super-admin/audit-logs may not be deployed yet.',
      );
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, actionFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const renderStatusBadge = (status) => {
    const norm = (status || 'success').toUpperCase();
    if (norm === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle2 size={11} /> Success
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-100">
        <XCircle size={11} /> Failed
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Audit Logs"
        subtitle="Security event logs, administrative modifications, and multi-tenant audit trail."
        breadcrumbs={[
          { label: 'Dashboard', href: '/super-admin/dashboard' },
          { label: 'Audit Logs' },
        ]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by actor, target entity, or description..."
            id="audit-log-search"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <Select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              options={ACTION_OPTIONS}
              aria-label="Filter by action"
            />
          </div>

          <div className="w-40">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              aria-label="Filter by result status"
            />
          </div>
        </div>
      </div>

      {/* Main Table / View */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <PageLoader message="Loading platform audit logs..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Audit Log Service Unavailable"
            description={error}
            onRetry={fetchLogs}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /super-admin/audit-logs
            </code>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={FileText}
            title={
              search || actionFilter !== 'all' || statusFilter !== 'all'
                ? 'No matching audit records'
                : 'No audit logs recorded'
            }
            description={
              search || actionFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'System actions and administrator activities will be indexed and displayed here.'
            }
            action={
              search || actionFilter !== 'all' || statusFilter !== 'all'
                ? {
                    label: 'Reset Filters',
                    onClick: () => {
                      setSearch('');
                      setActionFilter('all');
                      setStatusFilter('all');
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor / User</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Target Entity</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log, idx) => {
                  const logId = log.id || log._id || idx;
                  const actor = log.actor || log.userName || log.userEmail || 'System';
                  const action = log.action || log.event || 'ACTION';
                  const target = log.target || log.entity || log.targetEntity || '—';
                  const desc = log.description || log.details || log.message || '—';
                  const timestamp = log.createdAt || log.timestamp || log.date;

                  return (
                    <tr
                      key={logId}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {timestamp ? new Date(timestamp).toLocaleString() : '—'}
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-40">{actor}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-xs">
                        <span className="px-2 py-0.5 rounded font-mono font-medium text-[11px] bg-slate-100 text-slate-700">
                          {action}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                        {target}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                        <span className="line-clamp-2">{desc}</span>
                      </td>

                      {/* Result */}
                      <td className="py-3 px-4 text-right">
                        {renderStatusBadge(log.status || log.result)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {logs.length} of {total} audit records
              </span>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
