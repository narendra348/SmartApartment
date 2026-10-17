import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  RefreshCw,
  Eye,
  CheckCircle,
  Building2,
  Home,
  Calendar,
  Tag,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import Modal from '../../../components/ui/Modal';
import Textarea from '../../../components/ui/Textarea';
import {
  getMaintenanceRequests,
  getMaintenanceRequestById,
  updateMaintenanceRequest,
  addMaintenanceComment,
} from '../../../api/maintenanceApi';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_CONFIG = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-600',
};

// Staff may move requests to in_progress or resolved
const STAFF_STATUS_OPTIONS = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function WorkOrderDetailModal({ workOrderId, isOpen, onClose, onUpdated }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [commentText, setCommentText] = useState('');
  const [updating, setUpdating] = useState(false);
  const [addingComment, setAddingComment] = useState(false);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    setLoading(true);
    setError(null);
    // Staff endpoint falls back to admin endpoint if staff-specific not available
    getMaintenanceRequestById(workOrderId, 'admin')
      .then((data) => {
        setRequest(data);
        setNewStatus(data.status === 'resolved' || data.status === 'closed' ? 'resolved' : 'in_progress');
      })
      .catch((err) => setError(err.response?.data?.message ?? err.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [isOpen, workOrderId]);

  async function handleStatusUpdate() {
    setUpdating(true);
    try {
      await updateMaintenanceRequest(workOrderId, { status: newStatus });
      toast.success('Status updated');
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message ?? 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      await addMaintenanceComment(workOrderId, commentText.trim(), 'admin');
      setCommentText('');
      toast.success('Note added');
    } catch (err) {
      toast.error(err.response?.data?.message ?? err.message ?? 'Failed to add note');
    } finally {
      setAddingComment(false);
    }
  }

  const statusChanged = request && newStatus !== request.status;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Work Order Details" size="lg">
      {loading && <div className="py-10 text-center text-sm text-slate-400">Loading…</div>}
      {error && <p className="text-sm text-red-500 py-6 text-center">{error}</p>}
      {!loading && !error && request && (
        <div className="flex flex-col gap-5">
          {/* Header info */}
          <div>
            <p className="text-base font-semibold text-slate-800">{request.subject ?? request.title ?? '—'}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={request.status} />
              {request.priority && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_CONFIG[(request.priority || '').toLowerCase()] ?? ''}`}>
                  {request.priority}
                </span>
              )}
            </div>
          </div>

          <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
            {request.description ?? '—'}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {(request.building?.name ?? request.buildingName) && (
              <div className="flex items-center gap-2 text-slate-600">
                <Building2 size={13} />
                {request.building?.name ?? request.buildingName}
              </div>
            )}
            {(request.flat?.number ?? request.flatNumber) && (
              <div className="flex items-center gap-2 text-slate-600">
                <Home size={13} />
                Flat {request.flat?.number ?? request.flatNumber}
              </div>
            )}
            {(request.residentName ?? request.resident?.name) && (
              <div className="flex items-center gap-2 text-slate-600">
                <User size={13} />
                {request.residentName ?? request.resident?.name}
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={13} />
              {formatDate(request.createdAt ?? request.date)}
            </div>
          </div>

          {/* Status update (staff limited actions) */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Update Status</p>
            <div className="flex items-center gap-3">
              <Select
                value={newStatus}
                onChange={setNewStatus}
                options={STAFF_STATUS_OPTIONS}
                disabled={updating}
                className="flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleStatusUpdate}
                disabled={!statusChanged || updating}
                loading={updating}
              >
                <CheckCircle size={14} />
                Save
              </Button>
            </div>
          </div>

          {/* Add note */}
          <form onSubmit={handleAddComment} className="flex flex-col gap-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add Note</p>
            <Textarea
              id="staff-comment"
              name="comment"
              placeholder="Add a progress note or completion note…"
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={addingComment}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={!commentText.trim() || addingComment}
                loading={addingComment}
              >
                Add Note
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}

export default function StaffWorkOrdersPage() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [workOrders, setWorkOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewId, setViewId] = useState(() => searchParams.get('id') || null);

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Staff sees requests assigned to them — the backend filters by authenticated user
      // Endpoint: GET /admin/complaints (backend returns only assigned items for staff role)
      // Alternatively some backends expose GET /staff/work-orders
      const result = await getMaintenanceRequests(
        { page, limit, status: statusFilter },
        'admin', // staff use admin-path; backend scopes by role automatically
      );
      setWorkOrders(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to load work orders';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const tdClass = 'px-4 py-3 text-sm text-slate-700 align-top';
  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Work Orders"
        subtitle={`${total} work order${total !== 1 ? 's' : ''} assigned`}
        icon={<ClipboardList size={22} />}
      >
        <Button variant="ghost" size="sm" onClick={fetchWorkOrders} title="Refresh">
          <RefreshCw size={16} />
        </Button>
      </PageHeader>

      {/* Status filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium shrink-0">Filter by status:</span>
        <Select
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val); setPage(1); }}
          options={STATUS_OPTIONS}
          className="max-w-[180px]"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState description={error} onRetry={fetchWorkOrders} />
        ) : workOrders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No work orders"
            description="No work orders have been assigned to you yet."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Subject</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Location</th>
                    <th className={thClass}>Priority</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Date</th>
                    <th className={thClass + ' text-right'}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((wo) => {
                    const id = wo._id ?? wo.id;
                    const category = (wo.category ?? '').replace(/_/g, ' ');
                    const building = wo.building?.name ?? wo.buildingName ?? wo.building;
                    const flat = wo.flat?.number ?? wo.flatNumber ?? wo.unit ?? wo.flat;
                    const priorityKey = (wo.priority || '').toLowerCase();
                    return (
                      <tr key={id} className="hover:bg-slate-50 transition-colors">
                        <td className={tdClass}>
                          <p className="font-medium text-slate-800 line-clamp-2 max-w-[220px]">
                            {wo.subject ?? wo.title ?? '—'}
                          </p>
                          {wo.residentName && (
                            <p className="text-xs text-slate-400 mt-0.5">{wo.residentName}</p>
                          )}
                        </td>
                        <td className={tdClass}>
                          {category ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 capitalize">
                              <Tag size={12} />{category}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-col gap-0.5">
                            {building && (
                              <span className="flex items-center gap-1 text-xs text-slate-600">
                                <Building2 size={12} />{building}
                              </span>
                            )}
                            {flat && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Home size={12} />Flat {flat}
                              </span>
                            )}
                            {!building && !flat && '—'}
                          </div>
                        </td>
                        <td className={tdClass}>
                          {wo.priority ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_CONFIG[priorityKey] ?? 'bg-slate-100 text-slate-600'}`}>
                              {wo.priority}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={tdClass}>
                          <StatusBadge status={wo.status} />
                        </td>
                        <td className={tdClass}>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar size={12} />
                            {formatDate(wo.createdAt ?? wo.date ?? wo.submittedAt)}
                          </span>
                        </td>
                        <td className={tdClass + ' text-right'}>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setViewId(id)}
                            title="View & update"
                          >
                            <Eye size={14} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      <WorkOrderDetailModal
        workOrderId={viewId}
        isOpen={!!viewId}
        onClose={() => setViewId(null)}
        onUpdated={fetchWorkOrders}
      />
    </div>
  );
}
