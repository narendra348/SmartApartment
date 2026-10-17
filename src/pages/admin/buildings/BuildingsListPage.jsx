import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Layers,
  Home,
  MapPin,
  Calendar,
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
import { getBuildings, deleteBuilding } from '../../../api/buildingsApi';
import useDebounce from '../../../hooks/useDebounce';
import { ROUTES } from '../../../constants';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'inactive', label: 'Inactive' },
];

export default function BuildingsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter & Search states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Data states
  const [buildings, setBuildings] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deletion modal state
  const [buildingToDelete, setBuildingToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBuildings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBuildings({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
      });
      setBuildings(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(
        err.message ||
          'Failed to load buildings. The backend server may be offline or the endpoint unavailable.',
      );
      setBuildings([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  // Sync URL query params
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, page, setSearchParams]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!buildingToDelete) return;
    setDeleting(true);
    const id = buildingToDelete.id || buildingToDelete._id;
    try {
      await deleteBuilding(id);
      toast.success(`Building "${buildingToDelete.name}" deleted successfully.`);
      setBuildingToDelete(null);
      await fetchBuildings();
    } catch (err) {
      toast.error(err.message || 'Failed to delete building.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buildings Management"
        subtitle="Manage apartment blocks, towers, floor configurations, and properties."
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Buildings' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchBuildings}
              disabled={loading}
              iconLeft={RefreshCw}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.BUILDINGS_NEW)}
              iconLeft={Plus}
            >
              Add Building
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by building name or code..."
            id="building-search"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            aria-label="Filter by building status"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <PageLoader message="Loading buildings list..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Unable to Retrieve Buildings"
            description={error}
            onRetry={fetchBuildings}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Expected API endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
              GET /admin/buildings
            </code>
          </div>
        </div>
      ) : buildings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Building2}
            title={
              search || statusFilter !== 'all'
                ? 'No matching buildings found'
                : 'No buildings registered yet'
            }
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search query or filter settings.'
                : 'Get started by creating your apartment complex’s first building or tower.'
            }
            action={{
              label:
                search || statusFilter !== 'all' ? 'Clear Filters' : 'Add First Building',
              onClick: () => {
                if (search || statusFilter !== 'all') {
                  setSearch('');
                  setStatusFilter('all');
                  setPage(1);
                } else {
                  navigate(ROUTES.ADMIN.BUILDINGS_NEW);
                }
              },
              icon: search || statusFilter !== 'all' ? RefreshCw : Plus,
            }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Building Name & Code</th>
                  <th className="py-3.5 px-4">Address / Location</th>
                  <th className="py-3.5 px-4">Floors</th>
                  <th className="py-3.5 px-4">Flats</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buildings.map((b) => {
                  const id = b.id || b._id;
                  const flatCount =
                    b.flatCount ??
                    b.flatsCount ??
                    (Array.isArray(b.flats) ? b.flats.length : null) ??
                    '—';
                  const floors = b.floors ?? b.floorCount ?? '—';
                  const createdDate = b.createdAt
                    ? new Date(b.createdAt).toLocaleDateString()
                    : '—';

                  return (
                    <tr
                      key={id}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 leading-tight">
                          {b.name}
                        </div>
                        <div className="text-xs text-sky-600 font-mono mt-0.5 font-medium">
                          {b.code || 'NO-CODE'}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {b.address ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <MapPin size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-xs">{b.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Floors */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="flex items-center gap-1">
                          <Layers size={13} className="text-slate-400 shrink-0" />
                          <span>{floors} floors</span>
                        </div>
                      </td>

                      {/* Flats */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="flex items-center gap-1">
                          <Home size={13} className="text-slate-400 shrink-0" />
                          <span>
                            {flatCount !== '—' ? `${flatCount} units` : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>{createdDate}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={b.status || 'active'} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/buildings/${id}`)}
                            title="View Building Details"
                            aria-label={`View details for ${b.name}`}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/buildings/${id}/edit`)}
                            title="Edit Building"
                            aria-label={`Edit ${b.name}`}
                          >
                            <Edit size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setBuildingToDelete(b)}
                            title="Delete Building"
                            aria-label={`Delete ${b.name}`}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-slate-500">
                Showing {buildings.length} of {total} buildings
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

      {/* Confirmation Dialog for Deletion */}
      <ConfirmationDialog
        isOpen={Boolean(buildingToDelete)}
        onClose={() => setBuildingToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Building?"
        message={`Are you sure you want to delete "${buildingToDelete?.name}" (${buildingToDelete?.code})? This may affect all associated flats and residents.`}
        confirmLabel="Yes, Delete Building"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
