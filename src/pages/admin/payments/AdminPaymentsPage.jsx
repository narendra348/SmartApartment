import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  CreditCard,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Check,
  X,
  Copy,
  Receipt,
  User,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import Modal from '../../../components/ui/Modal';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import {
  getPayments,
  getPaymentById,
  verifyPayment,
  rejectPayment,
} from '../../../api/paymentsApi';
import { formatCurrency } from '../../../utils/currency';
import { formatDate, formatDateTime } from '../../../utils/date';
import useDebounce from '../../../hooks/useDebounce';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Verification' },
  { value: 'verified', label: 'Verified / Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const METHOD_FILTER_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

const COMMON_REJECTION_REASONS = [
  'Transaction reference not found in bank statement',
  'Incorrect amount submitted',
  'Duplicate submission',
  'Cheque bounced or payment failed',
  'Invalid receipt attachment',
  'Other (specify below)',
];

/**
 * Modal to view payment details and perform verification/rejection.
 */
function AdminPaymentDetailModal({
  isOpen,
  onClose,
  paymentId,
  onVerify,
  onReject,
  actionLoading,
}) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !paymentId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    setAdminNotes('');

    getPaymentById(paymentId, 'admin')
      .then((data) => {
        if (isMounted) {
          setPayment(data);
          setAdminNotes(data.verificationComments || data.notes || '');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load payment details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, paymentId]);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const residentName =
    payment?.residentName ||
    payment?.resident?.name ||
    payment?.user?.name ||
    'Resident';

  const flatNumber =
    payment?.flatNumber ||
    payment?.flat?.flatNumber ||
    payment?.resident?.flatNumber ||
    '—';

  const buildingName =
    payment?.buildingName ||
    payment?.flat?.building?.name ||
    payment?.building?.name ||
    '—';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Review & Verification" size="lg">
      {loading ? (
        <div className="py-12 flex justify-center">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="py-6">
          <ErrorState
            title="Failed to load details"
            description={error}
            onRetry={() => {
              setLoading(true);
              getPaymentById(paymentId, 'admin')
                .then(setPayment)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          />
        </div>
      ) : payment ? (
        <div className="space-y-6">
          {/* Status Header Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              payment.status === 'verified'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : payment.status === 'rejected'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {payment.status === 'verified' ? (
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
              ) : payment.status === 'rejected' ? (
                <XCircle size={24} className="text-rose-600 shrink-0" />
              ) : (
                <Clock size={24} className="text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm capitalize">
                  Current Status: {payment.status || 'Pending'}
                </p>
                <p className="text-xs opacity-90">
                  {payment.status === 'verified'
                    ? 'Payment has been verified against accounts.'
                    : payment.status === 'rejected'
                    ? `Payment was rejected. ${payment.rejectionReason ? `Reason: ${payment.rejectionReason}` : ''}`
                    : 'Awaiting your review and bank ledger reconciliation.'}
                </p>
              </div>
            </div>
            <StatusBadge status={payment.status || 'pending'} />
          </div>

          {/* Resident & Property Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} /> Resident & Property
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Resident</span>
                <span className="font-semibold text-slate-800">{residentName}</span>
                {(payment.residentEmail || payment.resident?.email) && (
                  <span className="text-xs text-slate-500 block truncate">
                    {payment.residentEmail || payment.resident?.email}
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Flat / Unit</span>
                <span className="font-medium text-slate-800">Flat {flatNumber}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Building</span>
                <span className="font-medium text-slate-800">{buildingName}</span>
              </div>
            </div>
          </div>

          {/* Transaction Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Submitted Amount</span>
              <span className="text-xl font-bold text-slate-900">
                {formatCurrency(payment.amount)}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Payment Method</span>
              <span className="font-medium text-slate-800 capitalize">
                {payment.paymentMethod?.replace(/_/g, ' ') || 'Manual Payment'}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-0.5">
                Transaction / Reference No.
              </span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs font-semibold bg-white px-2 py-1 rounded border border-slate-200 text-slate-800">
                  {payment.referenceNumber || payment.transactionId || payment.utrNumber || 'N/A'}
                </code>
                {(payment.referenceNumber || payment.transactionId || payment.utrNumber) && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        payment.referenceNumber ||
                          payment.transactionId ||
                          payment.utrNumber,
                      )
                    }
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="Copy reference"
                  >
                    {copied ? (
                      <Check size={14} className="text-emerald-600" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Payment Date</span>
              <span className="text-slate-800">
                {formatDate(payment.paymentDate || payment.createdAt)}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Bill Reference</span>
              <span className="text-slate-800 font-medium">
                {payment.billNumber || payment.bill?.billNumber || payment.billId || 'Direct Payment'}
              </span>
              {payment.bill?.billingPeriod && (
                <span className="text-xs text-slate-500 block">
                  Period: {payment.bill.billingPeriod}
                </span>
              )}
            </div>

            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Submitted On</span>
              <span className="text-slate-700">
                {formatDateTime(payment.createdAt)}
              </span>
            </div>
          </div>

          {/* Resident Remarks */}
          {payment.notes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Resident Notes
              </h4>
              <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                {payment.notes}
              </p>
            </div>
          )}

          {/* Proof of Payment attachment */}
          {(payment.proofUrl || payment.receiptUrl || payment.attachmentUrl) && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Receipt Attachment
              </h4>
              <a
                href={payment.proofUrl || payment.receiptUrl || payment.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-2 rounded-lg border border-sky-200"
              >
                <ExternalLink size={16} />
                Open Uploaded Proof / Slip
              </a>
            </div>
          )}

          {/* Verification Notes / Comments input */}
          <div>
            <Textarea
              label="Verification Notes / Comments"
              rows={2}
              placeholder="e.g. Bank statement entry verified on Oct 12, ICICI A/C ...482"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              disabled={actionLoading}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose} disabled={actionLoading}>
              Close
            </Button>

            <div className="flex items-center gap-2">
              {payment.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onReject(payment, adminNotes)}
                    disabled={actionLoading}
                    iconLeft={X}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onVerify(payment, adminNotes)}
                    disabled={actionLoading}
                    iconLeft={Check}
                  >
                    Approve & Verify
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * Rejection Reason Dialog
 */
function RejectPaymentDialog({
  isOpen,
  onClose,
  payment,
  initialNotes,
  onConfirmReject,
  loading,
}) {
  const [presetReason, setPresetReason] = useState(COMMON_REJECTION_REASONS[0]);
  const [customDetails, setCustomDetails] = useState(initialNotes || '');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setPresetReason(COMMON_REJECTION_REASONS[0]);
      setCustomDetails(initialNotes || '');
      setError(null);
    }
  }, [isOpen, initialNotes]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason =
      presetReason === 'Other (specify below)'
        ? customDetails.trim()
        : customDetails.trim()
        ? `${presetReason} — ${customDetails.trim()}`
        : presetReason;

    if (!finalReason) {
      setError('Please provide a specific rejection reason for the resident');
      return;
    }

    onConfirmReject(payment, finalReason);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title="Reject Payment Submission"
      size="md"
      closeOnBackdrop={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
          <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-900 mb-0.5">
              Confirming Payment Rejection
            </p>
            <p>
              This will notify the resident that their submission was not accepted and the corresponding bill will remain outstanding.
            </p>
          </div>
        </div>

        <Select
          label="Reason Category"
          required
          options={COMMON_REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
          value={presetReason}
          onChange={(e) => {
            setPresetReason(e.target.value);
            setError(null);
          }}
          disabled={loading}
        />

        <Textarea
          label="Additional Details / Instructions for Resident"
          rows={3}
          required={presetReason === 'Other (specify below)'}
          placeholder="e.g. Please verify the 12-digit UTR with your bank branch and re-submit."
          value={customDetails}
          onChange={(e) => {
            setCustomDetails(e.target.value);
            setError(null);
          }}
          error={error}
          disabled={loading}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={loading}
            iconLeft={XCircle}
          >
            Confirm Rejection
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Main Admin Payments Page
 */
export default function AdminPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: paramId } = useParams();

  // Filters from URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState(searchParams.get('method') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Payments State
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Selected Payment for Modal
  const [selectedPaymentId, setSelectedPaymentId] = useState(
    () => paramId || searchParams.get('id') || null,
  );

  // Verification & Rejection Modals State
  const [confirmVerifyPayment, setConfirmVerifyPayment] = useState(null);
  const [confirmVerifyNotes, setConfirmVerifyNotes] = useState('');
  const [confirmRejectPayment, setConfirmRejectPayment] = useState(null);
  const [confirmRejectNotes, setConfirmRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sync state back to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (methodFilter && methodFilter !== 'all') params.set('method', methodFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, methodFilter, page, setSearchParams]);

  // Fetch payments list
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPayments(
        {
          page,
          limit,
          search: debouncedSearch,
          status: statusFilter,
          paymentMethod: methodFilter,
        },
        'admin',
      );

      setPayments(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load payments';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, methodFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Handle Verify Confirmation
  const handleVerifyConfirm = async () => {
    if (!confirmVerifyPayment || actionLoading) return;
    const id = confirmVerifyPayment.id || confirmVerifyPayment._id;

    setActionLoading(true);
    try {
      await verifyPayment(id, { notes: confirmVerifyNotes });
      toast.success(
        `Payment of ${formatCurrency(confirmVerifyPayment.amount)} successfully verified!`,
      );
      setConfirmVerifyPayment(null);
      setSelectedPaymentId(null);
      fetchPayments();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to verify payment';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Confirmation
  const handleRejectConfirm = async (payment, reason) => {
    if (!payment || actionLoading) return;
    const id = payment.id || payment._id;

    setActionLoading(true);
    try {
      await rejectPayment(id, { reason });
      toast.success('Payment submission marked as rejected.');
      setConfirmRejectPayment(null);
      setSelectedPaymentId(null);
      fetchPayments();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reject payment';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Summary Metrics
  const stats = useMemo(() => {
    const pending = payments.filter((p) => p.status === 'pending').length;
    const verified = payments.filter((p) => p.status === 'verified').length;
    const rejected = payments.filter((p) => p.status === 'rejected').length;
    return { pending, verified, rejected };
  }, [payments]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Payment Verification"
        subtitle="Review, reconcile, and verify resident offline payment submissions"
        icon={<CreditCard size={22} />}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchPayments}
            disabled={loading}
            title="Refresh list"
          >
            <RefreshCw size={16} />
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Receipt size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Submissions</p>
            <p className="text-lg font-bold text-slate-800">{total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-amber-800 font-medium">Pending Review</p>
            <p className="text-lg font-bold text-amber-700">{stats.pending}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Verified Payments</p>
            <p className="text-lg font-bold text-emerald-600">{stats.verified}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Rejected Submissions</p>
            <p className="text-lg font-bold text-rose-600">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <SearchInput
            placeholder="Search by resident name, flat, UTR reference, or bill..."
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="w-full sm:w-48 shrink-0">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-full sm:w-44 shrink-0">
          <Select
            options={METHOD_FILTER_OPTIONS}
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <ErrorState
            title="Failed to load payment submissions"
            description={error}
            onRetry={fetchPayments}
          />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <EmptyState
            icon={CreditCard}
            title={
              search || statusFilter !== 'all' || methodFilter !== 'all'
                ? 'No matching payment records'
                : 'No payment submissions found'
            }
            description={
              search || statusFilter !== 'all' || methodFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Resident payment submissions awaiting reconciliation will appear here.'
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Resident & Flat</th>
                  <th className="py-3 px-4">Bill Reference</th>
                  <th className="py-3 px-4">Submitted Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => {
                  const id = p.id || p._id;
                  const resName =
                    p.residentName ||
                    p.resident?.name ||
                    p.user?.name ||
                    'Resident';
                  const flatNo =
                    p.flatNumber ||
                    p.flat?.flatNumber ||
                    p.resident?.flatNumber ||
                    '—';
                  const building =
                    p.buildingName ||
                    p.flat?.building?.name ||
                    p.building?.name ||
                    '';
                  const billRef =
                    p.billNumber ||
                    p.bill?.billNumber ||
                    p.billId ||
                    'General Maintenance';

                  return (
                    <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {resName}
                        </span>
                        <span className="text-xs text-slate-500">
                          Flat {flatNo} {building ? `· ${building}` : ''}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">
                          {billRef}
                        </span>
                        {p.bill?.billingPeriod && (
                          <span className="text-xs text-slate-400">
                            {p.bill.billingPeriod}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatCurrency(p.amount)}
                      </td>

                      <td className="py-3 px-4 capitalize text-slate-600">
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-slate-100 font-medium">
                          {p.paymentMethod?.replace(/_/g, ' ') || 'Manual'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                          {p.referenceNumber || p.transactionId || '—'}
                        </code>
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {formatDate(p.paymentDate || p.createdAt)}
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={p.status || 'pending'} />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPaymentId(id)}
                            iconLeft={Eye}
                            title="View details"
                          >
                            Review
                          </Button>

                          {p.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 p-1.5"
                                onClick={() => {
                                  setConfirmVerifyNotes('');
                                  setConfirmVerifyPayment(p);
                                }}
                                title="Approve & Verify"
                              >
                                <Check size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 p-1.5"
                                onClick={() => {
                                  setConfirmRejectNotes('');
                                  setConfirmRejectPayment(p);
                                }}
                                title="Reject"
                              >
                                <X size={16} />
                              </Button>
                            </>
                          )}
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
            <div className="p-4 border-t border-slate-200">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Review & Detail Modal */}
      <AdminPaymentDetailModal
        isOpen={Boolean(selectedPaymentId)}
        onClose={() => setSelectedPaymentId(null)}
        paymentId={selectedPaymentId}
        actionLoading={actionLoading}
        onVerify={(p, notes) => {
          setConfirmVerifyNotes(notes);
          setConfirmVerifyPayment(p);
        }}
        onReject={(p, notes) => {
          setConfirmRejectNotes(notes);
          setConfirmRejectPayment(p);
        }}
      />

      {/* Approve Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(confirmVerifyPayment)}
        onClose={() => {
          if (!actionLoading) setConfirmVerifyPayment(null);
        }}
        onConfirm={handleVerifyConfirm}
        title="Verify and Approve Payment?"
        message={
          confirmVerifyPayment
            ? `Are you sure you want to verify the payment of ${formatCurrency(confirmVerifyPayment.amount)} for Flat ${confirmVerifyPayment.flatNumber || confirmVerifyPayment.resident?.flatNumber || '—'} (Ref: ${confirmVerifyPayment.referenceNumber || 'N/A'})? This will confirm receipt of funds in the apartment records.`
            : ''
        }
        confirmLabel="Confirm Verification"
        variant="primary"
        loading={actionLoading}
      />

      {/* Reject Payment Reason Dialog */}
      <RejectPaymentDialog
        isOpen={Boolean(confirmRejectPayment)}
        onClose={() => {
          if (!actionLoading) setConfirmRejectPayment(null);
        }}
        payment={confirmRejectPayment}
        initialNotes={confirmRejectNotes}
        onConfirmReject={handleRejectConfirm}
        loading={actionLoading}
      />
    </div>
  );
}
