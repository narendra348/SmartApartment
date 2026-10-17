import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Plus,
  RefreshCw,
  Eye,
  Calendar,
  Tag,
  X,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Card from '../../../components/ui/Card';
import Modal from '../../../components/ui/Modal';
import {
  getMaintenanceRequests,
  createMaintenanceRequest,
  getMaintenanceRequestById,
} from '../../../api/maintenanceApi';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS_FORM = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category…' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'hvac', label: 'HVAC / AC' },
  { value: 'structural', label: 'Structural' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_CONFIG = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-600',
};

const INITIAL_FORM = { subject: '', description: '', category: '', priority: 'medium' };

function validate(form) {
  const errors = {};
  if (!form.subject.trim()) errors.subject = 'Subject is required';
  if (!form.description.trim()) errors.description = 'Description is required';
  if (!form.category) errors.category = 'Category is required';
  return errors;
}

function formatDate(val) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// Inline detail modal for resident
function RequestDetailModal({ requestId, isOpen, onClose }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !requestId) return;
    setLoading(true);
    setError(null);
    getMaintenanceRequestById(requestId, 'resident')
      .then(setRequest)
      .catch((err) => setError(err.response?.data?.message ?? err.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [isOpen, requestId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Details" size="lg">
      {loading && <div className="py-10 text-center text-sm text-slate-400">Loading…</div>}
      {error && <p className="text-sm text-red-500 py-6 text-center">{error}</p>}
      {!loading && !error && request && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subject</p>
            <p className="text-sm font-medium text-slate-800 mt-1">{request.subject ?? request.title ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</p>
            <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{request.description ?? '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</p>
              <div className="mt-1"><StatusBadge status={request.status} /></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Priority</p>
              {request.priority ? (
                <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_CONFIG[(request.priority || '').toLowerCase()] ?? 'bg-slate-100 text-slate-600'}`}>
                  {request.priority}
                </span>
              ) : <p className="text-sm text-slate-500 mt-1">—</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Category</p>
              <p className="text-sm text-slate-700 mt-1 capitalize">{(request.category ?? '').replace(/_/g, ' ') || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Submitted</p>
              <p className="text-sm text-slate-700 mt-1">{formatDate(request.createdAt ?? request.date)}</p>
            </div>
          </div>
          {request.resolutionNotes && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resolution Notes</p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{request.resolutionNotes}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function ResidentComplaintsPage() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New request form (can be auto-opened via ?new=true)
  const [showForm, setShowForm] = useState(() => searchParams.get('new') === 'true');
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Detail modal (can be auto-opened via ?id=...)
  const [viewId, setViewId] = useState(() => searchParams.get('id') || null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMaintenanceRequests(
        { page, limit, status: statusFilter },
        'resident',
      );
      setRequests(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to load requests';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handleFilterChange(val) {
    setStatusFilter(val);
    setPage(1);
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitted) return;
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setSubmitting(true);
    try {
      await createMaintenanceRequest(
        { subject: form.subject.trim(), description: form.description.trim(), category: form.category, priority: form.priority },
        'resident',
      );
      setSubmitted(true);
      toast.success('Request submitted successfully');
      setShowForm(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      setSubmitted(false);
      fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Submission failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const tdClass = 'px-4 py-3 text-sm text-slate-700 align-top';
  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Maintenance Requests"
        subtitle={`${total} request${total !== 1 ? 's' : ''} submitted`}
        icon={<Wrench size={22} />}
      >
        <Button variant="ghost" size="sm" onClick={fetchRequests} title="Refresh">
          <RefreshCw size={16} />
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} />
          New Request
        </Button>
      </PageHeader>

      {/* New request form */}
      {showForm && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Submit a New Request</h3>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setFormErrors({}); }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-4 p-5">
              <Input
                id="res-subject"
                name="subject"
                label="Subject"
                required
                placeholder="e.g. Leaking pipe in bathroom"
                value={form.subject}
                onChange={(e) => handleFormChange('subject', e.target.value)}
                error={formErrors.subject}
                disabled={submitting}
              />
              <Textarea
                id="res-description"
                name="description"
                label="Description"
                required
                rows={3}
                placeholder="Describe the issue in detail…"
                value={form.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                error={formErrors.description}
                disabled={submitting}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={form.category}
                    onChange={(val) => handleFormChange('category', val)}
                    options={CATEGORY_OPTIONS}
                    disabled={submitting}
                  />
                  {formErrors.category && (
                    <p className="text-xs text-red-500" role="alert">{formErrors.category}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Priority</label>
                  <Select
                    value={form.priority}
                    onChange={(val) => handleFormChange('priority', val)}
                    options={PRIORITY_OPTIONS_FORM}
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                disabled={submitting}
                onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setFormErrors({}); }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting} loading={submitting}>
                <Save size={15} />
                Submit Request
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Status filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium shrink-0">Filter by status:</span>
        <Select
          value={statusFilter}
          onChange={handleFilterChange}
          options={STATUS_OPTIONS}
          className="max-w-[180px]"
        />
      </div>

      {/* Request list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState description={error} onRetry={fetchRequests} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No requests yet"
            description="You haven't submitted any maintenance requests."
            action={{ label: 'Submit a Request', onClick: () => setShowForm(true), icon: Plus }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Subject</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Priority</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Date</th>
                    <th className={thClass + ' text-right'}>View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => {
                    const id = req._id ?? req.id;
                    const category = (req.category ?? '').replace(/_/g, ' ');
                    const priorityKey = (req.priority || '').toLowerCase();
                    return (
                      <tr key={id} className="hover:bg-slate-50 transition-colors">
                        <td className={tdClass}>
                          <p className="font-medium text-slate-800 line-clamp-2 max-w-[260px]">
                            {req.subject ?? req.title ?? '—'}
                          </p>
                        </td>
                        <td className={tdClass}>
                          {category ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 capitalize">
                              <Tag size={12} />{category}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={tdClass}>
                          {req.priority ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_CONFIG[priorityKey] ?? 'bg-slate-100 text-slate-600'}`}>
                              {req.priority}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={tdClass}>
                          <StatusBadge status={req.status} />
                        </td>
                        <td className={tdClass}>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar size={12} />
                            {formatDate(req.createdAt ?? req.date ?? req.submittedAt)}
                          </span>
                        </td>
                        <td className={tdClass + ' text-right'}>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setViewId(id)}
                            title="View details"
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

      {/* Detail modal */}
      <RequestDetailModal
        requestId={viewId}
        isOpen={!!viewId}
        onClose={() => setViewId(null)}
      />
    </div>
  );
}
