import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Home,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Building2,
  DollarSign,
  User,
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
import { getFlats, deleteFlat } from '../../../api/flatsApi';
import { getBuildings } from '../../../api/buildingsApi';
import useDebounce from '../../../hooks/useDebounce';
import { ROUTES } from '../../../constants';

const OCCUPANCY_STATUS_OPTIONS = [
  { value: 'all', label: 'All Occupancy' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
];

export default function FlatsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search & Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [buildingFilter, setBuildingFilter] = useState(searchParams.get('buildingId') || 'all');
  const [occupancyFilter, setOccupancyFilter] = useState(
    searchParams.get('occupancyStatus') || 'all',
  );
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Data states
  const [flats, setFlats] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Buildings list for filtering
  const [buildings, setBuildings] = useState([]);

  // Deletion modal state
  const [flatToDelete, setFlatToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch buildings once for the filter dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadBuildings() {
      try {
        const bResult = await getBuildings({ limit: 100 });
        if (isMounted) setBuildings(bResult.items || []);
      } catch {
        // Non-blocking: if buildings endpoint fails, filter just won't show extra buildings
      }
    }
    loadBuildings();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchFlats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFlats({
        page,
        limit,
        search: debouncedSearch,
        buildingId: buildingFilter,
        occupancyStatus: occupancyFilter,
      });
      setFlats(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(
        err.message ||
          'Failed to load flats. The backend server may be offline or the endpoint GET /admin/flats unavailable.',
      );
      setFlats([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, buildingFilter, occupancyFilter]);

  useEffect(() => {
    fetchFlats();
  }, [fetchFlats]);

  // Sync URL query params
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (buildingFilter !== 'all') params.buildingId = buildingFilter;
    if (occupancyFilter !== 'all') params.occupancyStatus = occupancyFilter;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, buildingFilter, occupancyFilter, page, setSearchParams]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleBuildingChange = (e) => {
    setBuildingFilter(e.target.value);
    setPage(1);
  };

  const handleOccupancyChange = (e) => {
    setOccupancyFilter(e.target.value);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!flatToDelete) return;
    setDeleting(true);
    const id = flatToDelete.id || flatToDelete._id;
    try {
      await deleteFlat(id);
      toast.success(
        `Flat "${flatToDelete.flatNumber || flatToDelete.number}" deleted successfully.`,
      );
      setFlatToDelete(null);
      await fetchFlats();
    } catch (err) {
      toast.error(err.message || 'Failed to delete flat.');
    } finally {
      setDeleting(false);
    }
  };

  const buildingFilterOptions = [
    { value: 'all', label: 'All Buildings' },
    ...buildings.map((b) => ({
      value: b.id || b._id,
      label: `${b.name} (${b.code || 'NO-CODE'})`,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flats & Units Directory"
        subtitle="Manage apartment units, occupancy status, maintenance fees, and resident assignments."
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Flats' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchFlats}
              disabled={loading}
              iconLeft={RefreshCw}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.FLATS_NEW)}
              iconLeft={Plus}
            >
              Add Flat
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by flat or unit number..."
            id="flat-search"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="w-44">
            <Select
              value={buildingFilter}
              onChange={handleBuildingChange}
              options={buildingFilterOptions}
              aria-label="Filter by building"
            />
          </div>
          <div className="w-44">
            <Select
              value={occupancyFilter}
              onChange={handleOccupancyChange}
              options={OCCUPANCY_STATUS_OPTIONS}
              aria-label="Filter by occupancy status"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <PageLoader message="Loading flats directory..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Unable to Retrieve Flats"
            description={error}
            onRetry={fetchFlats}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Expected API endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
              GET /admin/flats
            </code>
          </div>
        </div>
      ) : flats.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Home}
            title={
              search || buildingFilter !== 'all' || occupancyFilter !== 'all'
                ? 'No matching flats found'
                : 'No flats registered yet'
            }
            description={
              search || buildingFilter !== 'all' || occupancyFilter !== 'all'
                ? 'Try adjusting your search criteria or clear your active filters.'
                : 'Get started by creating your first flat unit.'
            }
            action={{
              label:
                search || buildingFilter !== 'all' || occupancyFilter !== 'all'
                  ? 'Clear Filters'
                  : 'Add First Flat',
              onClick: () => {
                if (search || buildingFilter !== 'all' || occupancyFilter !== 'all') {
                  setSearch('');
                  setBuildingFilter('all');
                  setOccupancyFilter('all');
                  setPage(1);
                } else {
                  navigate(ROUTES.ADMIN.FLATS_NEW);
                }
              },
              icon:
                search || buildingFilter !== 'all' || occupancyFilter !== 'all'
                  ? RefreshCw
                  : Plus,
            }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Flat / Unit</th>
                  <th className="py-3.5 px-4">Building</th>
                  <th className="py-3.5 px-4">Floor</th>
                  <th className="py-3.5 px-4">Type / Size</th>
                  <th className="py-3.5 px-4">Occupancy</th>
                  <th className="py-3.5 px-4">Resident</th>
                  <th className="py-3.5 px-4">Maintenance Fee</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flats.map((flat) => {
                  const id = flat.id || flat._id;
                  const flatNo = flat.flatNumber || flat.number || flat.unitNumber || '—';
                  const buildingName =
                    flat.building?.name ||
                    flat.buildingName ||
                    buildings.find((b) => (b.id || b._id) === flat.buildingId)?.name ||
                    '—';
                  const buildingCode =
                    flat.building?.code ||
                    buildings.find((b) => (b.id || b._id) === flat.buildingId)?.code;
                  const floor = flat.floorNumber ?? flat.floor ?? '—';
                  const type = flat.flatType || flat.type || flat.size || '—';
                  const status = flat.occupancyStatus || flat.status || 'vacant';
                  const residentName =
                    flat.resident?.name ||
                    flat.residentName ||
                    flat.tenantName ||
                    (status === 'vacant' ? null : null);
                  const maintenance =
                    flat.maintenanceAmount != null || flat.monthlyMaintenance != null
                      ? `$${flat.maintenanceAmount ?? flat.monthlyMaintenance}`
                      : '—';

                  return (
                    <tr
                      key={id}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* Flat Number */}
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {flatNo}
                      </td>

                      {/* Building */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-700 flex items-center gap-1">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span>{buildingName}</span>
                        </div>
                        {buildingCode && (
                          <div className="text-[11px] text-sky-600 font-mono mt-0.5">
                            {buildingCode}
                          </div>
                        )}
                      </td>

                      {/* Floor */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {floor !== '—' ? `Floor ${floor}` : '—'}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                        {type}
                      </td>

                      {/* Occupancy Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={status} />
                      </td>

                      {/* Resident */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {residentName ? (
                          <div className="flex items-center gap-1 text-slate-800 font-medium">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span>{residentName}</span>
                          </div>
                        ) : status === 'occupied' ? (
                          <span className="text-slate-500 italic">Occupied (No profile)</span>
                        ) : (
                          <span className="text-slate-400 italic">Vacant</span>
                        )}
                      </td>

                      {/* Maintenance Fee */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                        <div className="flex items-center gap-1">
                          {maintenance !== '—' && (
                            <DollarSign size={13} className="text-slate-400 shrink-0" />
                          )}
                          <span>{maintenance !== '—' ? maintenance.replace('$', '') : '—'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/flats/${id}`)}
                            title="View Flat Details"
                            aria-label={`View details for Flat ${flatNo}`}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/flats/${id}/edit`)}
                            title="Edit Flat"
                            aria-label={`Edit Flat ${flatNo}`}
                          >
                            <Edit size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setFlatToDelete(flat)}
                            title="Delete Flat"
                            aria-label={`Delete Flat ${flatNo}`}
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
                Showing {flats.length} of {total} flats
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
        isOpen={Boolean(flatToDelete)}
        onClose={() => setFlatToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Flat?"
        message={`Are you sure you want to delete Flat "${flatToDelete?.flatNumber || flatToDelete?.number}"? This will remove all associated unit records.`}
        confirmLabel="Yes, Delete Flat"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
