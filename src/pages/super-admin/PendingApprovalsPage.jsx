import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  MapPin,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import SearchInput from '../../components/ui/SearchInput';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/StateViews';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import ApartmentDetailsModal from '../../components/super-admin/ApartmentDetailsModal';
import {
  getPendingApartments,
  approveApartment,
  rejectApartment,
} from '../../api/superAdminApi';
import useDebounce from '../../hooks/useDebounce';

export default function PendingApprovalsPage() {
  const [searchParams] = useSearchParams();

  // Search & pagination state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Data & loading state
  const [pendingList, setPendingList] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal / Action states
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Direct Actions (from table row directly)
  const [approveConfirm, setApproveConfirm] = useState({
    isOpen: false,
    apartment: null,
  });

  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    apartment: null,
    reason: '',
    error: '',
  });

  // Fetch pending list
  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPendingApartments({
        page,
        limit,
        search: debouncedSearch,
      });
      setPendingList(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err.message ||
          'Failed to load pending apartment approvals. Endpoint GET /super-admin/apartments/pending may be unavailable.',
      );
      setPendingList([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // Handle direct review from URL query (?id=...)
  useEffect(() => {
    const aptId = searchParams.get('id');
    if (aptId && pendingList.length > 0) {
      const match = pendingList.find((a) => (a.id || a._id) === aptId);
      if (match) {
        setSelectedApartment(match);
        setDetailsModalOpen(true);
      }
    }
  }, [searchParams, pendingList]);

  // Approve Handler
  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await approveApartment(id);
      toast.success('Apartment registration approved successfully!');
      setDetailsModalOpen(false);
      setSelectedApartment(null);
      setApproveConfirm({ isOpen: false, apartment: null });
      await fetchPending();
    } catch (err) {
      toast.error(err.message || 'Failed to approve application.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Handler
  const handleReject = async (id, reason) => {
    if (!reason || !reason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    setActionLoading(true);
    try {
      await rejectApartment(id, reason.trim());
      toast.success('Apartment application rejected.');
      setDetailsModalOpen(false);
      setSelectedApartment(null);
      setRejectModal({ isOpen: false, apartment: null, reason: '', error: '' });
      await fetchPending();
    } catch (err) {
      toast.error(err.message || 'Failed to reject application.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Apartment Approvals"
        subtitle="Review onboarding registrations submitted by property managers and administrators."
        breadcrumbs={[
          { label: 'Dashboard', href: '/super-admin/dashboard' },
          { label: 'Apartments', href: '/super-admin/apartments' },
          { label: 'Pending Approvals' },
        ]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPending}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        }
      />

      {/* Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by apartment name, admin email, city..."
            id="pending-search"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {total} pending {total === 1 ? 'application' : 'applications'}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <PageLoader message="Loading pending registrations..." />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <ErrorState
            title="Service Unavailable"
            description={error}
            onRetry={fetchPending}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>Expected endpoint:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">
              GET /super-admin/apartments/pending
            </code>
          </div>
        </div>
      ) : pendingList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <EmptyState
            icon={CheckCircle}
            title={
              search
                ? 'No matching pending applications'
                : 'No pending approvals'
            }
            description={
              search
                ? 'No applications match your search query.'
                : 'All apartment onboarding submissions have been reviewed and processed.'
            }
            action={
              search
                ? {
                    label: 'Clear Search',
                    onClick: () => {
                      setSearch('');
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
                  <th className="py-3.5 px-4">Apartment Name</th>
                  <th className="py-3.5 px-4">Administrator</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Submitted Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.map((apt) => {
                  const aptId = apt.id || apt._id;
                  const adminName = apt.adminName || apt.admin?.name || '—';
                  const email = apt.adminEmail || apt.contactEmail || apt.admin?.email || '—';
                  const phone = apt.adminPhone || apt.contactPhone || apt.admin?.phone || '—';
                  const location = [apt.city, apt.state].filter(Boolean).join(', ') || '—';

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

                      {/* Admin contact */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-700">{adminName}</div>
                        <div className="text-slate-500 mt-0.5">{email}</div>
                        {phone !== '—' && (
                          <div className="text-slate-400 text-[11px] mt-0.5">{phone}</div>
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

                      {/* Submitted Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {apt.createdAt
                          ? new Date(apt.createdAt).toLocaleDateString()
                          : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status="pending" />
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedApartment(apt);
                              setDetailsModalOpen(true);
                            }}
                            iconLeft={Eye}
                          >
                            Details
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setApproveConfirm({
                                isOpen: true,
                                apartment: apt,
                              })
                            }
                            iconLeft={CheckCircle}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              setRejectModal({
                                isOpen: true,
                                apartment: apt,
                                reason: '',
                                error: '',
                              })
                            }
                            iconLeft={XCircle}
                          >
                            Reject
                          </Button>
                        </div>
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
                Showing {pendingList.length} of {total} pending applications
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

      {/* Details Modal */}
      <ApartmentDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedApartment(null);
        }}
        apartment={selectedApartment}
        onApprove={handleApprove}
        onReject={handleReject}
        loadingAction={actionLoading}
      />

      {/* Row-Level Quick Approve Dialog */}
      <ConfirmationDialog
        isOpen={approveConfirm.isOpen}
        onClose={() => setApproveConfirm({ isOpen: false, apartment: null })}
        onConfirm={() =>
          handleApprove(
            approveConfirm.apartment?.id || approveConfirm.apartment?._id,
          )
        }
        title="Approve Apartment Application?"
        message={`Are you sure you want to approve "${approveConfirm.apartment?.name}"? The apartment administrator will receive authorization to operate.`}
        variant="primary"
        loading={actionLoading}
      />

      {/* Row-Level Quick Reject Modal */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() =>
          setRejectModal({
            isOpen: false,
            apartment: null,
            reason: '',
            error: '',
          })
        }
        title="Reject Apartment Application"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please enter the reason for rejecting{' '}
            <strong className="text-slate-800">
              {rejectModal.apartment?.name}
            </strong>
            . This explanation will be documented in the platform records.
          </p>

          <Textarea
            value={rejectModal.reason}
            onChange={(e) => {
              setRejectModal((prev) => ({
                ...prev,
                reason: e.target.value,
                error: '',
              }));
            }}
            placeholder="Reason for rejection (e.g. invalid registration documents, unrecognized address)..."
            rows={3}
            error={rejectModal.error}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setRejectModal({
                  isOpen: false,
                  apartment: null,
                  reason: '',
                  error: '',
                })
              }
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!rejectModal.reason.trim()) {
                  setRejectModal((prev) => ({
                    ...prev,
                    error: 'Please enter a rejection reason.',
                  }));
                  return;
                }
                handleReject(
                  rejectModal.apartment?.id || rejectModal.apartment?._id,
                  rejectModal.reason,
                );
              }}
              loading={actionLoading}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
