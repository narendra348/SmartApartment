import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building,
  RefreshCw,
  Eye,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import Select from '../../components/ui/Select';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import ApartmentDetailsModal from '../../components/super-admin/ApartmentDetailsModal';
import {
  getApartments,
  approveApartment,
  rejectApartment,
  suspendApartment,
  reactivateApartment,
} from '../../api/superAdminApi';
import useDebounce from '../../hooks/useDebounce';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

export default function ApartmentsListPage() {
  const [searchParams] = useSearchParams();

  // Search & Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Data & loading state
  const [apartments, setApartments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected apartment for Details Modal
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch list
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getApartments({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
      });
      setApartments(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err.message ||
          'Failed to load apartments. Backend endpoint GET /super-admin/apartments may be unavailable.',
      );
      setApartments([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter]);

  // Sync with searchParams / filters
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Open modal if ?id is in query string
  useEffect(() => {
    const aptId = searchParams.get('id');
    if (aptId && apartments.length > 0) {
      const match = apartments.find((a) => (a.id || a._id) === aptId);
      if (match) {
        setSelectedApartment(match);
        setDetailsModalOpen(true);
      }
    }
  }, [searchParams, apartments]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  // Actions
  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await approveApartment(id);
      toast.success('Apartment registration approved successfully!');
      setDetailsModalOpen(false);
      setSelectedApartment(null);
      await fetchList();
    } catch (err) {
      toast.error(err.message || 'Failed to approve apartment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id, reason) => {
    setActionLoading(true);
    try {
      await rejectApartment(id, reason);
      toast.success('Apartment application rejected.');
      setDetailsModalOpen(false);
      setSelectedApartment(null);
      await fetchList();
    } catch (err) {
      toast.error(err.message || 'Failed to reject apartment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (id) => {
    setActionLoading(true);
    try {
      await suspendApartment(id);
      toast.success('Apartment complex has been suspended.');
      setDetailsModalOpen(false);
      setSelectedApartment(null);
      await fetchList();
    } catch (err) {
      toast.error(err.message || 'Failed to suspend apartment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (id) => {
    setActionLoading(true);
    try {
      await reactivateApartment(id);
      toast.success('Apartment complex reactivated successfully!');
      setDetailsModalOpen(false);
      setSelectedApartment(null);
      await fetchList();
    } catch (err) {
      toast.error(err.message || 'Failed to reactivate apartment.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apartments Directory"
        subtitle="Manage all registered complexes, verify applications, and review platform tenants."
        breadcrumbs={[
          { label: 'Dashboard', href: '/super-admin/dashboard' },
          { label: 'Apartments' },
        ]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchList}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by apartment name, city, ID, or email..."
            id="apartment-search"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-48">
            <Select
              value={statusFilter}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              aria-label="Filter by approval status"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <PageLoader message="Loading apartments directory..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Unable to Retrieve Apartments"
            description={error}
            onRetry={fetchList}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /super-admin/apartments
            </code>
          </div>
        </div>
      ) : apartments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={Building}
            title={
              search || statusFilter !== 'all'
                ? 'No matching apartments found'
                : 'No apartments registered yet'
            }
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search keywords or filter criteria.'
                : 'Apartments submitted through the registration portal will appear here.'
            }
            action={
              search || statusFilter !== 'all'
                ? {
                    label: 'Clear Filters',
                    onClick: () => {
                      setSearch('');
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
          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Apartment & ID</th>
                  <th className="py-3.5 px-4">Contact Person</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Buildings / Flats</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apartments.map((apt) => {
                  const aptId = apt.id || apt._id;
                  const adminName = apt.adminName || apt.admin?.name || '—';
                  const email = apt.contactEmail || apt.adminEmail || apt.admin?.email || '—';
                  const phone = apt.contactPhone || apt.adminPhone || apt.admin?.phone || '—';
                  const location = [apt.city, apt.state].filter(Boolean).join(', ') || '—';
                  const buildings = apt.buildingCount ?? apt.buildings?.length ?? '—';
                  const flats = apt.flatCount ?? apt.flatsCount ?? '—';

                  return (
                    <tr
                      key={aptId}
                      className="hover:bg-slate-50/60 transition-colors duration-150"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 leading-tight">
                          {apt.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          ID: {aptId}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-700">{adminName}</div>
                        <div className="text-slate-500 mt-0.5 truncate max-w-44">
                          {email}
                        </div>
                        {phone !== '—' && (
                          <div className="text-slate-400 text-[11px] mt-0.5">
                            {phone}
                          </div>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1 font-medium text-slate-700">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span>{location}</span>
                        </div>
                        {apt.address && (
                          <div className="text-[11px] text-slate-400 truncate max-w-40 mt-0.5">
                            {apt.address}
                          </div>
                        )}
                      </td>

                      {/* Buildings / Flats */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span>{buildings} bldgs</span>
                        <span className="text-slate-300 mx-1.5">/</span>
                        <span>{flats} flats</span>
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {apt.createdAt
                          ? new Date(apt.createdAt).toLocaleDateString()
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={apt.status || 'pending'} />
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedApartment(apt);
                            setDetailsModalOpen(true);
                          }}
                          iconLeft={Eye}
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {apartments.length} of {total} apartments
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

      {/* Apartment Details Modal */}
      <ApartmentDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedApartment(null);
        }}
        apartment={selectedApartment}
        onApprove={handleApprove}
        onReject={handleReject}
        onSuspend={handleSuspend}
        onReactivate={handleReactivate}
        loadingAction={actionLoading}
      />
    </div>
  );
}
