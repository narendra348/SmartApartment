import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  ExternalLink,
  Check,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Modal from '../../../components/ui/Modal';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import {
  getPayments,
  getPaymentById,
  submitPayment,
  getResidentBills,
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

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI / QR Code' },
  { value: 'bank_transfer', label: 'Bank Transfer (IMPS / NEFT / RTGS)' },
  { value: 'cash', label: 'Cash Payment' },
  { value: 'cheque', label: 'Cheque / Demand Draft' },
];

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

/**
 * Modal to display full payment details to the resident.
 */
function ResidentPaymentDetailModal({ isOpen, onClose, paymentId }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !paymentId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    getPaymentById(paymentId, 'resident')
      .then((data) => {
        if (isMounted) setPayment(data);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load payment details');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, paymentId]);

  const handleCopyRef = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success('Reference copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Details" size="lg">
      {loading ? (
        <div className="py-12 flex justify-center">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="py-6">
          <ErrorState
            title="Unable to load details"
            description={error}
            onRetry={() => {
              setLoading(true);
              getPaymentById(paymentId, 'resident')
                .then(setPayment)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          />
        </div>
      ) : payment ? (
        <div className="space-y-6">
          {/* Status summary banner */}
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
                  Status: {payment.status || 'Pending'}
                </p>
                <p className="text-xs opacity-90">
                  {payment.status === 'verified'
                    ? 'Payment verified and credited to your account by apartment admin.'
                    : payment.status === 'rejected'
                    ? 'Payment submission rejected. Please review the reason below.'
                    : 'Awaiting admin verification against bank statement.'}
                </p>
              </div>
            </div>
            <StatusBadge status={payment.status || 'pending'} />
          </div>

          {/* Rejection notice if rejected */}
          {payment.status === 'rejected' && (payment.rejectionReason || payment.notes) && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <h4 className="text-xs font-semibold text-rose-800 uppercase tracking-wider mb-1">
                Reason for Rejection
              </h4>
              <p className="text-sm text-rose-700">
                {payment.rejectionReason || payment.notes}
              </p>
            </div>
          )}

          {/* Verification comments if verified */}
          {payment.status === 'verified' && (payment.verificationComments || payment.notes) && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              <span className="font-semibold">Admin Note: </span>
              {payment.verificationComments || payment.notes}
            </div>
          )}

          {/* Main Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block mb-0.5">Amount Paid</span>
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
                      handleCopyRef(
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

          {/* Resident Remarks / Notes */}
          {payment.notes && payment.status !== 'rejected' && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Your Remarks / Notes
              </h4>
              <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                {payment.notes}
              </p>
            </div>
          )}

          {/* Proof of payment preview / link */}
          {(payment.proofUrl || payment.receiptUrl || payment.attachmentUrl) && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Payment Proof Attachment
              </h4>
              <a
                href={payment.proofUrl || payment.receiptUrl || payment.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-2 rounded-lg border border-sky-200"
              >
                <ExternalLink size={16} />
                View Uploaded Receipt / Proof
              </a>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * Modal for submitting a new manual payment record.
 */
function SubmitPaymentModal({ isOpen, onClose, onSuccess }) {
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const [form, setForm] = useState({
    billId: '',
    manualBillNumber: '',
    amount: '',
    paymentMethod: 'upi',
    referenceNumber: '',
    paymentDate: getTodayDateString(),
    notes: '',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch unpaid bills when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoadingBills(true);

    getResidentBills({ status: 'unpaid' })
      .then((items) => {
        if (isMounted) {
          setBills(items || []);
        }
      })
      .catch(() => {
        if (isMounted) setBills([]);
      })
      .finally(() => {
        if (isMounted) setLoadingBills(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // When a bill is selected, auto-fill suggested amount
  const handleBillSelect = (e) => {
    const billId = e.target.value;
    const selected = bills.find((b) => String(b.id || b._id) === String(billId));

    setForm((prev) => ({
      ...prev,
      billId,
      amount: selected ? String(selected.amount || selected.totalAmount || '') : prev.amount,
    }));

    if (errors.billId) {
      setErrors((prev) => ({ ...prev, billId: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.amount || Number(form.amount) <= 0 || Number.isNaN(Number(form.amount))) {
      errs.amount = 'Please enter a valid payment amount greater than ₹0';
    }
    if (!form.paymentMethod) {
      errs.paymentMethod = 'Please select a payment method';
    }
    if (!form.referenceNumber?.trim()) {
      errs.referenceNumber = 'Transaction/UTR/Reference number is required';
    } else if (form.referenceNumber.trim().length < 4) {
      errs.referenceNumber = 'Reference number should be at least 4 characters';
    }
    if (!form.paymentDate) {
      errs.paymentDate = 'Please specify the date payment was made';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      let payload;
      if (receiptFile) {
        payload = new FormData();
        payload.append('amount', form.amount);
        payload.append('paymentMethod', form.paymentMethod);
        payload.append('referenceNumber', form.referenceNumber.trim());
        payload.append('paymentDate', form.paymentDate);
        if (form.billId && form.billId !== 'manual') {
          payload.append('billId', form.billId);
        }
        if (form.manualBillNumber?.trim()) {
          payload.append('billNumber', form.manualBillNumber.trim());
        }
        if (form.notes?.trim()) {
          payload.append('notes', form.notes.trim());
        }
        payload.append('receipt', receiptFile);
      } else {
        payload = {
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber.trim(),
          paymentDate: form.paymentDate,
          billId: form.billId && form.billId !== 'manual' ? form.billId : undefined,
          billNumber: form.manualBillNumber?.trim() || undefined,
          notes: form.notes?.trim() || undefined,
        };
      }

      await submitPayment(payload);
      toast.success('Payment submitted successfully! Awaiting admin verification.');
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit payment';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const billOptions = [
    { value: '', label: loadingBills ? 'Loading your bills...' : '-- Select Outstanding Bill (Optional) --' },
    ...bills.map((b) => ({
      value: String(b.id || b._id),
      label: `${b.billNumber ? `[${b.billNumber}] ` : ''}${b.title || b.month || 'Maintenance'} — ₹${b.amount || b.totalAmount || 0}`,
    })),
    { value: 'manual', label: 'Other / Specify Bill Number Manually' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title="Submit Manual Payment"
      size="lg"
      closeOnBackdrop={!submitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Security & Instruction Banner */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 text-xs text-sky-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-sky-900">
            <CreditCard size={15} />
            Offline / Bank Transfer Verification
          </p>
          <p>
            Submit your reference details after completing an external transfer (UPI, IMPS, NEFT, or Cash). Apartment Admins will verify the receipt against bank records.
          </p>
          <p className="text-[11px] text-sky-700">
            <strong>Security Notice:</strong> Never share your bank passwords, UPI PINs, or OTPs. SmartApartment never collects private credentials.
          </p>
        </div>

        {/* Bill Selection */}
        <Select
          label="Select Bill to Pay"
          options={billOptions}
          value={form.billId}
          onChange={handleBillSelect}
          disabled={submitting || loadingBills}
          helperText="Select the bill associated with this payment, or choose 'Other' to specify manually"
        />

        {form.billId === 'manual' && (
          <Input
            label="Bill Number / Reference"
            placeholder="e.g. BILL-2026-10-0042"
            value={form.manualBillNumber}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, manualBillNumber: e.target.value }))
            }
            disabled={submitting}
          />
        )}

        {/* Amount & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Amount Paid (₹)"
            type="number"
            step="0.01"
            min="1"
            required
            placeholder="e.g. 2500"
            value={form.amount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, amount: e.target.value }))
            }
            error={errors.amount}
            disabled={submitting}
            prefix="₹"
          />

          <Select
            label="Payment Method"
            required
            options={PAYMENT_METHODS}
            value={form.paymentMethod}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
            }
            error={errors.paymentMethod}
            disabled={submitting}
          />
        </div>

        {/* Reference Number & Payment Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Transaction / UTR Reference"
            required
            placeholder="e.g. 428190348201 or UPI Ref"
            value={form.referenceNumber}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))
            }
            error={errors.referenceNumber}
            disabled={submitting}
            helperText="From your bank SMS, UPI app, or deposit slip"
          />

          <Input
            label="Payment Date"
            type="date"
            required
            value={form.paymentDate}
            max={getTodayDateString()}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paymentDate: e.target.value }))
            }
            error={errors.paymentDate}
            disabled={submitting}
          />
        </div>

        {/* Optional Proof Upload */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">
            Proof of Payment (Optional)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*,application/pdf"
              id="payment-receipt"
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              disabled={submitting}
            />
            {receiptFile && (
              <span className="text-xs text-emerald-600 font-medium">
                {receiptFile.name} ({(receiptFile.size / 1024).toFixed(0)} KB)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            PNG, JPG, or PDF up to 5MB
          </span>
        </div>

        {/* Notes */}
        <Textarea
          label="Remarks / Notes (Optional)"
          rows={2}
          placeholder="e.g. Paid via GooglePay from Axis Bank account ending 1234"
          value={form.notes}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, notes: e.target.value }))
          }
          disabled={submitting}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            iconLeft={Check}
          >
            Submit Payment Details
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Main Resident Payments Page
 */
export default function ResidentPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: paramId } = useParams();

  // URL Query Parameters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Payments State
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(
    () => searchParams.get('submit') === 'true' || searchParams.get('new') === 'true',
  );
  const [viewPaymentId, setViewPaymentId] = useState(
    () => paramId || searchParams.get('id') || null,
  );

  // Sync state back to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, page, setSearchParams]);

  // Fetch resident payments
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
        },
        'resident',
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
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Computed summary counts for quick stats
  const stats = useMemo(() => {
    const pendingCount = payments.filter((p) => p.status === 'pending').length;
    const verifiedCount = payments.filter((p) => p.status === 'verified').length;
    const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return { pendingCount, verifiedCount, totalAmount };
  }, [payments]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="My Payments"
        subtitle="View submission history and submit offline payment receipts"
        icon={<CreditCard size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPayments}
              disabled={loading}
              title="Refresh payments"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowSubmitModal(true)}
              iconLeft={Plus}
            >
              Submit Payment
            </Button>
          </div>
        }
      />

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <Receipt size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Submissions</p>
            <p className="text-lg font-bold text-slate-800">{total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Pending Verification</p>
            <p className="text-lg font-bold text-amber-600">{stats.pendingCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Verified Payments</p>
            <p className="text-lg font-bold text-emerald-600">{stats.verifiedCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <SearchInput
            placeholder="Search by transaction reference or bill..."
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="w-full sm:w-56 shrink-0">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <ErrorState
            title="Failed to load payments"
            description={error}
            onRetry={fetchPayments}
          />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <EmptyState
            icon={CreditCard}
            title={
              search || statusFilter !== 'all'
                ? 'No matching payment records'
                : 'No payment submissions yet'
            }
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Submit payment details after completing your maintenance or bill transfer.'
            }
            action={{
              label: 'Submit Payment Details',
              onClick: () => setShowSubmitModal(true),
              icon: Plus,
            }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Bill Reference</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {payments.map((p) => {
                  const id = p.id || p._id;
                  const billRef =
                    p.billNumber ||
                    p.bill?.billNumber ||
                    p.billId ||
                    'General Maintenance';

                  return (
                    <tr key={id} className="hover:bg-slate-50/70 transition-colors">
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

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {formatCurrency(p.amount)}
                      </td>

                      <td className="py-3 px-4 capitalize text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          {p.paymentMethod?.replace(/_/g, ' ') || 'Manual'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewPaymentId(id)}
                          iconLeft={Eye}
                        >
                          Details
                        </Button>
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

      {/* Modals */}
      <SubmitPaymentModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSuccess={() => {
          fetchPayments();
        }}
      />

      <ResidentPaymentDetailModal
        isOpen={Boolean(viewPaymentId)}
        onClose={() => setViewPaymentId(null)}
        paymentId={viewPaymentId}
      />
    </div>
  );
}
