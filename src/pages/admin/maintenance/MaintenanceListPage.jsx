import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wrench,
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  Building2,
  Home,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Calendar,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import {
  getMaintenanceRequests,
  deleteMaintenanceRequest,
} from '../../../api/maintenanceApi';
import { getBuildings } from '../../../api/buildingsApi';
import useDebounce from '../../../hooks/useDebounce';
import { ROUTES } from '../../../constants';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
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
  low: { label: 'Low', className: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', className: 'bg-sky-100 text-sky-700' },
  high: { label: 'High', className: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-600' },
};

function PriorityBadge({ priority }) {
  const key = (priority || '').toLowerCase();
  const cfg = PRIORITY_CONFIG[key] ?? { label: priority ?? 'Unknown', className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function SortIcon({ column, sortBy, sortOrder }) {
  if (sortBy !== column) return <ChevronsUpDown size={14} className="text-slate-400" />;
  return sortOrder === 'asc'
    ? <ChevronUp size={14} className="text-indigo-600" />
    : <ChevronDown size={14} className="text-indigo-600" />;
}

export default function MaintenanceListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'all');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [buildingFilter, setBuildingFilter] = useState(searchParams.get('buildingId') || 'all');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [buildings, setBuildings] = useState([]);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // If navigated with ?id=..., redirect to the canonical detail route
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      navigate(`${ROUTES.ADMIN.COMPLAINTS}/${idParam}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Load buildings for filter
  useEffect(() => {
    let isMounted = true;
    getBuildings({ limit: 100 })
      .then((res) => {
        if (!isMounted) return;
        const bList = res?.items ?? (Array.isArray(res) ? res : []);
        setBuildings(bList);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const buildingOptions = [
    { value: 'all', label: 'All Buildings' },
    ...buildings.map((b) => ({ value: b._id ?? b.id ?? String(b.id), label: b.name ?? b.buildingName ?? 'Unnamed' })),
  ];

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMaintenanceRequests(
        {
          page,
          limit,
          search: debouncedSearch,
          status: statusFilter,
          priority: priorityFilter,
          category: categoryFilter,
          buildingId: buildingFilter,
          sortBy,
          sortOrder,
        },
        'admin',
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
  }, [page, limit, debouncedSearch, statusFilter, priorityFilter, categoryFilter, buildingFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Keep URL in sync
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (priorityFilter !== 'all') params.priority = priorityFilter;
    if (categoryFilter !== 'all') params.category = categoryFilter;
    if (buildingFilter !== 'all') params.buildingId = buildingFilter;
    if (sortBy !== 'createdAt') params.sortBy = sortBy;
    if (sortOrder !== 'desc') params.sortOrder = sortOrder;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, priorityFilter, categoryFilter, buildingFilter, sortBy, sortOrder, page, setSearchParams]);

  function handleSort(column) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function handleFilterChange(setter) {
    return (val) => {
      setter(val);
      setPage(1);
    };
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMaintenanceRequest(toDelete._id ?? toDelete.id);
      toast.success('Request deleted');
      setToDelete(null);
      fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Delete failed';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(val) {
    if (!val) return '—';
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide';
  const thSortClass = `${thClass} cursor-pointer select-none hover:text-indigo-600 transition-colors`;
  const tdClass = 'px-4 py-3 text-sm text-slate-700 align-top';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Maintenance & Complaints"
        subtitle={`${total} request${total !== 1 ? 's' : ''} total`}
        icon={<Wrench size={22} />}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchRequests()}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(ROUTES.ADMIN.COMPLAINTS + '/new')}
        >
          <Plus size={16} />
          New Request
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={(val) => { setSearch(val); setPage(1); }}
            placeholder="Search by subject, ID, resident…"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={handleFilterChange(setStatusFilter)}
          options={STATUS_OPTIONS}
          className="min-w-[155px]"
        />
        <Select
          value={priorityFilter}
          onChange={handleFilterChange(setPriorityFilter)}
          options={PRIORITY_OPTIONS}
          className="min-w-[145px]"
        />
        <Select
          value={categoryFilter}
          onChange={handleFilterChange(setCategoryFilter)}
          options={CATEGORY_OPTIONS}
          className="min-w-[155px]"
        />
        <Select
          value={buildingFilter}
          onChange={handleFilterChange(setBuildingFilter)}
          options={buildingOptions}
          className="min-w-[155px]"
        />
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState description={error} onRetry={fetchRequests} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No requests found"
            description="No maintenance requests match your current filters."
            action={{ label: 'New Request', onClick: () => navigate(ROUTES.ADMIN.COMPLAINTS + '/new'), icon: Plus }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th
                      className={thSortClass}
                      onClick={() => handleSort('ticketNumber')}
                    >
                      <span className="flex items-center gap-1">
                        ID <SortIcon column="ticketNumber" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th
                      className={thSortClass}
                      onClick={() => handleSort('subject')}
                    >
                      <span className="flex items-center gap-1">
                        Subject <SortIcon column="subject" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Building / Flat</th>
                    <th className={thClass}>Priority</th>
                    <th
                      className={thSortClass}
                      onClick={() => handleSort('status')}
                    >
                      <span className="flex items-center gap-1">
                        Status <SortIcon column="status" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th
                      className={thSortClass}
                      onClick={() => handleSort('createdAt')}
                    >
                      <span className="flex items-center gap-1">
                        Date <SortIcon column="createdAt" sortBy={sortBy} sortOrder={sortOrder} />
                      </span>
                    </th>
                    <th className={thClass + ' text-right'}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => {
                    const id = req._id ?? req.id;
                    const ticketNum =
                      req.ticketNumber ?? req.requestNumber ?? req.complaintNumber ?? `#${String(id).slice(-6)}`;
                    const building = req.building?.name ?? req.buildingName ?? req.building ?? '—';
                    const flat = req.flat?.number ?? req.flatNumber ?? req.unit ?? req.flat ?? '';
                    const category = (req.category ?? '').replace(/_/g, ' ');

                    return (
                      <tr key={id} className="hover:bg-slate-50 transition-colors">
                        <td className={tdClass}>
                          <span className="font-mono text-xs text-indigo-600 font-medium">{ticketNum}</span>
                        </td>
                        <td className={tdClass}>
                          <p className="font-medium text-slate-800 leading-snug line-clamp-2 max-w-[220px]">
                            {req.subject ?? req.title ?? req.description?.substring(0, 60) ?? '—'}
                          </p>
                          {req.residentName && (
                            <p className="text-xs text-slate-400 mt-0.5">{req.residentName}</p>
                          )}
                        </td>
                        <td className={tdClass}>
                          {category ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 capitalize">
                              <Tag size={12} />
                              {category}
                            </span>
                          ) : '—'}
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-col gap-0.5">
                            {building !== '—' && (
                              <span className="flex items-center gap-1 text-xs text-slate-600">
                                <Building2 size={12} /> {building}
                              </span>
                            )}
                            {flat && (
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Home size={12} /> Flat {flat}
                              </span>
                            )}
                            {building === '—' && !flat && '—'}
                          </div>
                        </td>
                        <td className={tdClass}>
                          <PriorityBadge priority={req.priority} />
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => navigate(`${ROUTES.ADMIN.COMPLAINTS}/${id}`)}
                              title="View details"
                            >
                              <Eye size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setToDelete(req)}
                              title="Delete request"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
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

      <ConfirmationDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Request"
        message={`Are you sure you want to delete request "${toDelete?.subject ?? toDelete?.title ?? toDelete?._id ?? toDelete?.id}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
