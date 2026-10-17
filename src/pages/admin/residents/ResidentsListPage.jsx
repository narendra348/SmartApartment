import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  UserPlus,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Building2,
  Home,
  Mail,
  Phone,
  Send,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
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
  getResidents,
  deleteResident,
  resendResidentInvitation,
} from '../../../api/residentsApi';
import { getBuildings } from '../../../api/buildingsApi';
import useDebounce from '../../../hooks/useDebounce';
import { ROUTES } from '../../../constants';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Account Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
];

const OCCUPANCY_OPTIONS = [
  { value: 'all', label: 'All Occupancy' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'reserved', label: 'Reserved' },
];

const INVITATION_STATUS_OPTIONS = [
  { value: 'all', label: 'All Invitation Statuses' },
  { value: 'invited', label: 'Invited' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
];

export default function ResidentsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search, Filter, and Sort states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [buildingFilter, setBuildingFilter] = useState(searchParams.get('buildingId') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [occupancyFilter, setOccupancyFilter] = useState(searchParams.get('occupancy') || 'all');
  const [invitationFilter, setInvitationFilter] = useState(
    searchParams.get('invitationStatus') || 'all',
  );
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'name');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'asc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Data states
  const [residents, setResidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Buildings list for filtering
  const [buildings, setBuildings] = useState([]);

  // Modal states
  const [residentToDelete, setResidentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  // Fetch buildings once for building filter dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadBuildings() {
      try {
        const bResult = await getBuildings({ limit: 100 });
        if (isMounted) setBuildings(bResult.items || []);
      } catch {
        // Non-blocking
      }
    }
    loadBuildings();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResidents({
        page,
        limit,
        search: debouncedSearch,
        buildingId: buildingFilter,
        status: statusFilter,
        invitationStatus: invitationFilter,
        occupancy: occupancyFilter,
        sortBy,
        sortOrder,
      });

      let items = data.items || [];

      // Client-side fallback sorting
      items = [...items].sort((a, b) => {
        let valA = '';
        let valB = '';
        if (sortBy === 'name') {
          valA = (a.name || a.fullName || '').toLowerCase();
          valB = (b.name || b.fullName || '').toLowerCase();
        } else if (sortBy === 'flat') {
          valA = (a.flat?.flatNumber || a.flatNumber || a.unitNumber || '').toLowerCase();
          valB = (b.flat?.flatNumber || b.flatNumber || b.unitNumber || '').toLowerCase();
        } else if (sortBy === 'building') {
          valA = (a.building?.name || a.buildingName || '').toLowerCase();
          valB = (b.building?.name || b.buildingName || '').toLowerCase();
        } else if (sortBy === 'occupancy') {
          valA = (a.occupancyStatus || a.flat?.occupancyStatus || 'occupied').toLowerCase();
          valB = (b.occupancyStatus || b.flat?.occupancyStatus || 'occupied').toLowerCase();
        } else if (sortBy === 'status') {
          valA = (a.status || a.accountStatus || 'active').toLowerCase();
          valB = (b.status || b.accountStatus || 'active').toLowerCase();
        } else if (sortBy === 'createdAt') {
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Filter by occupancy on client if backend didn't filter
      if (occupancyFilter !== 'all') {
        items = items.filter(
          (r) =>
            (r.occupancyStatus || r.flat?.occupancyStatus || 'occupied').toLowerCase() ===
            occupancyFilter.toLowerCase(),
        );
      }

      setResidents(items);
      setTotal(data.total || items.length);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(
        err.message ||
          'Failed to load residents. The backend server may be offline or GET /admin/residents unavailable.',
      );
      setResidents([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    buildingFilter,
    statusFilter,
    invitationFilter,
    occupancyFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  // Sync URL query params
  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (buildingFilter !== 'all') params.buildingId = buildingFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (occupancyFilter !== 'all') params.occupancy = occupancyFilter;
    if (invitationFilter !== 'all') params.invitationStatus = invitationFilter;
    if (sortBy !== 'name') params.sortBy = sortBy;
    if (sortOrder !== 'asc') params.sortOrder = sortOrder;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [
    debouncedSearch,
    buildingFilter,
    statusFilter,
    occupancyFilter,
    invitationFilter,
    sortBy,
    sortOrder,
    page,
    setSearchParams,
  ]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (field) => {
    if (sortBy !== field) {
      return <ChevronsUpDown size={13} className="text-slate-400 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp size={13} className="text-sky-600 shrink-0" />
    ) : (
      <ChevronDown size={13} className="text-sky-600 shrink-0" />
    );
  };

  const handleDelete = async () => {
    if (!residentToDelete) return;
    setDeleting(true);
    const id = residentToDelete.id || residentToDelete._id;
    try {
      await deleteResident(id);
      toast.success(
        `Resident "${residentToDelete.name || residentToDelete.fullName}" removed successfully.`,
      );
      setResidentToDelete(null);
      await fetchResidents();
    } catch (err) {
      toast.error(err.message || 'Failed to remove resident.');
    } finally {
      setDeleting(false);
    }
  };

  const handleResendInvitation = async (id, name) => {
    setResendingId(id);
    try {
      await resendResidentInvitation(id);
      toast.success(`Invitation email resent to ${name || 'resident'}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to resend invitation email.');
    } finally {
      setResendingId(null);
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
        title="Residents Directory"
        subtitle="Manage resident profiles, unit assignments, and onboard members with secure email invitations."
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Residents' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchResidents}
              disabled={loading}
              iconLeft={RefreshCw}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.RESIDENTS_NEW)}
              iconLeft={Plus}
            >
              Add Resident
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by resident name, email, or flat number..."
            id="resident-search"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-36">
            <Select
              value={buildingFilter}
              onChange={(e) => {
                setBuildingFilter(e.target.value);
                setPage(1);
              }}
              options={buildingFilterOptions}
              aria-label="Filter by building"
            />
          </div>
          <div className="w-36">
            <Select
              value={occupancyFilter}
              onChange={(e) => {
                setOccupancyFilter(e.target.value);
                setPage(1);
              }}
              options={OCCUPANCY_OPTIONS}
              aria-label="Filter by occupancy"
            />
          </div>
          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              aria-label="Filter by account status"
            />
          </div>
          <div className="w-36">
            <Select
              value={invitationFilter}
              onChange={(e) => {
                setInvitationFilter(e.target.value);
                setPage(1);
              }}
              options={INVITATION_STATUS_OPTIONS}
              aria-label="Filter by invitation status"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <PageLoader message="Loading residents directory..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Unable to Retrieve Residents"
            description={error}
            onRetry={fetchResidents}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span>Expected API endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
              GET /admin/residents
            </code>
          </div>
        </div>
      ) : residents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Users}
            title={
              search ||
              buildingFilter !== 'all' ||
              statusFilter !== 'all' ||
              occupancyFilter !== 'all' ||
              invitationFilter !== 'all'
                ? 'No matching residents found'
                : 'No residents registered yet'
            }
            description={
              search ||
              buildingFilter !== 'all' ||
              statusFilter !== 'all' ||
              occupancyFilter !== 'all' ||
              invitationFilter !== 'all'
                ? 'Try adjusting your search criteria or clear your active filters.'
                : 'Get started by adding or inviting your first resident to their assigned flat.'
            }
            action={{
              label:
                search ||
                buildingFilter !== 'all' ||
                statusFilter !== 'all' ||
                occupancyFilter !== 'all' ||
                invitationFilter !== 'all'
                  ? 'Clear Filters'
                  : 'Add Resident',
              onClick: () => {
                if (
                  search ||
                  buildingFilter !== 'all' ||
                  statusFilter !== 'all' ||
                  occupancyFilter !== 'all' ||
                  invitationFilter !== 'all'
                ) {
                  setSearch('');
                  setBuildingFilter('all');
                  setStatusFilter('all');
                  setOccupancyFilter('all');
                  setInvitationFilter('all');
                  setPage(1);
                } else {
                  navigate(ROUTES.ADMIN.RESIDENTS_NEW);
                }
              },
              icon:
                search ||
                buildingFilter !== 'all' ||
                statusFilter !== 'all' ||
                occupancyFilter !== 'all' ||
                invitationFilter !== 'all'
                  ? RefreshCw
                  : UserPlus,
            }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {/* Name Header - Sortable */}
                  <th
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-800 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Resident Name
                      {renderSortIcon('name')}
                    </span>
                  </th>

                  {/* Flat & Building - Sortable */}
                  <th
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-800 transition-colors"
                    onClick={() => handleSort('flat')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Flat & Building
                      {renderSortIcon('flat')}
                    </span>
                  </th>

                  {/* Contact Details */}
                  <th className="py-3.5 px-4">Contact Details</th>

                  {/* Occupancy Status - Sortable */}
                  <th
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-800 transition-colors"
                    onClick={() => handleSort('occupancy')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Occupancy
                      {renderSortIcon('occupancy')}
                    </span>
                  </th>

                  {/* Account Status - Sortable */}
                  <th
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-800 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Account Status
                      {renderSortIcon('status')}
                    </span>
                  </th>

                  {/* Invitation Status */}
                  <th className="py-3.5 px-4">Invitation</th>

                  {/* Registration Date - Sortable */}
                  <th
                    className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-800 transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Registered Date
                      {renderSortIcon('createdAt')}
                    </span>
                  </th>

                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {residents.map((r) => {
                  const id = r.id || r._id;
                  const name = r.name || r.fullName || 'Resident';
                  const email = r.email || '—';
                  const phone = r.phone || r.phoneNumber || '—';
                  const buildingName =
                    r.building?.name ||
                    r.buildingName ||
                    buildings.find((b) => (b.id || b._id) === r.buildingId)?.name ||
                    '—';
                  const flatNo =
                    r.flat?.flatNumber ||
                    r.flat?.number ||
                    r.flatNumber ||
                    r.unitNumber ||
                    '—';
                  const occupancy = r.occupancyStatus || r.flat?.occupancyStatus || 'occupied';
                  const accountStatus = r.status || r.accountStatus || 'active';
                  const invitationStatus = r.invitationStatus || (r.invited ? 'invited' : null);
                  const createdDate = r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString()
                    : '—';

                  return (
                    <tr
                      key={id}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {name}
                      </td>

                      {/* Assigned Unit & Building */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1 font-bold text-slate-800">
                          <Home size={13} className="text-slate-400 shrink-0" />
                          <span>Flat {flatNo}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 text-[11px] mt-0.5">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          <span>{buildingName}</span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Mail size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-44">{email}</span>
                        </div>
                        {phone !== '—' && (
                          <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                            <Phone size={13} className="text-slate-400 shrink-0" />
                            <span>{phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Occupancy Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={occupancy} />
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={accountStatus} />
                      </td>

                      {/* Invitation Status */}
                      <td className="py-3.5 px-4">
                        {invitationStatus ? (
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={invitationStatus} />
                            {invitationStatus === 'invited' && (
                              <button
                                type="button"
                                onClick={() => handleResendInvitation(id, name)}
                                disabled={resendingId === id}
                                title="Resend invitation email"
                                className="text-slate-400 hover:text-sky-600 disabled:opacity-50 transition-colors"
                              >
                                <Send size={13} className={resendingId === id ? 'animate-pulse' : ''} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {createdDate}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/residents/${id}`)}
                            title="View Resident Details"
                            aria-label={`View details for ${name}`}
                          >
                            <Eye size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/residents/${id}/edit`)}
                            title="Edit Resident"
                            aria-label={`Edit ${name}`}
                          >
                            <Edit size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setResidentToDelete(r)}
                            title="Remove Resident"
                            aria-label={`Remove ${name}`}
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
                Showing {residents.length} of {total} residents
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
        isOpen={Boolean(residentToDelete)}
        onClose={() => setResidentToDelete(null)}
        onConfirm={handleDelete}
        title="Remove Resident?"
        message={`Are you sure you want to remove resident "${residentToDelete?.name || residentToDelete?.fullName}"? This will unassign them from their flat.`}
        confirmLabel="Yes, Remove Resident"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
