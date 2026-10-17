import { useState } from 'react';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Layers,
  Home,
  ShieldAlert,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import StatusBadge from '../ui/StatusBadge';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import Textarea from '../ui/Textarea';

/**
 * ApartmentDetailsModal
 *
 * Full-featured inspection modal for an apartment application or registered complex.
 * Provides Approve, Reject, Suspend, and Reactivate actions with confirmations.
 */
export default function ApartmentDetailsModal({
  isOpen,
  onClose,
  apartment,
  onApprove,
  onReject,
  onSuspend,
  onReactivate,
  loadingAction = false,
}) {
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    action: null, // 'approve' | 'reject' | 'suspend' | 'reactivate'
    title: '',
    message: '',
    variant: 'primary',
  });

  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!apartment) return null;

  const status = (apartment.status || 'PENDING').toLowerCase();
  const isPending = status === 'pending';
  const isApproved = status === 'approved';
  const isSuspended = status === 'suspended';

  // Handle action triggers
  const promptApprove = () => {
    setConfirmDialog({
      isOpen: true,
      action: 'approve',
      title: 'Approve Apartment Registration?',
      message: `Are you sure you want to approve "${apartment.name}"? The apartment administrator will receive access to begin onboarding residents.`,
      variant: 'primary',
    });
  };

  const promptReject = () => {
    setShowRejectInput(true);
    setRejectReason('');
    setRejectReasonError('');
  };

  const handleConfirmRejectWithReason = () => {
    if (!rejectReason.trim()) {
      setRejectReasonError('Please provide a reason for rejecting this application.');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      action: 'reject',
      title: 'Confirm Application Rejection',
      message: `Are you sure you want to reject "${apartment.name}"? This decision will be recorded with your provided reason.`,
      variant: 'danger',
    });
  };

  const promptSuspend = () => {
    setConfirmDialog({
      isOpen: true,
      action: 'suspend',
      title: 'Suspend Apartment Complex?',
      message: `Suspending "${apartment.name}" will temporarily pause portal access for its administrator and residents. Continue?`,
      variant: 'danger',
    });
  };

  const promptReactivate = () => {
    setConfirmDialog({
      isOpen: true,
      action: 'reactivate',
      title: 'Reactivate Apartment Complex?',
      message: `Are you sure you want to restore full portal access for "${apartment.name}"?`,
      variant: 'primary',
    });
  };

  const handleDialogConfirm = async () => {
    const action = confirmDialog.action;
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

    if (action === 'approve' && onApprove) {
      await onApprove(apartment.id || apartment._id);
    } else if (action === 'reject' && onReject) {
      await onReject(apartment.id || apartment._id, rejectReason);
      setShowRejectInput(false);
    } else if (action === 'suspend' && onSuspend) {
      await onSuspend(apartment.id || apartment._id);
    } else if (action === 'reactivate' && onReactivate) {
      await onReactivate(apartment.id || apartment._id);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Apartment Details & Verification"
        size="lg"
      >
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                <Building size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 leading-tight">
                  {apartment.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: <span className="font-mono text-slate-600">{apartment.id || apartment._id || 'N/A'}</span>
                </p>
              </div>
            </div>
            <StatusBadge status={apartment.status || 'pending'} />
          </div>

          {/* Rejection Reason notice if present */}
          {apartment.rejectionReason && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Rejection Reason:</span>
                <span>{apartment.rejectionReason}</span>
              </div>
            </div>
          )}

          {/* Grid Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            {/* Property Information */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" /> Location & Contact
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Address:</span>
                  <span className="text-slate-700 font-medium">
                    {apartment.address || apartment.addressLine || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block">City / State:</span>
                    <span className="text-slate-700 font-medium">
                      {apartment.city || '—'}, {apartment.state || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Postal Code:</span>
                    <span className="text-slate-700 font-medium font-mono">
                      {apartment.postalCode || apartment.postal_code || '—'}
                    </span>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-50">
                  <span className="text-slate-400 block">Contact Email:</span>
                  <span className="text-slate-700 font-medium flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} className="text-slate-400" />
                    {apartment.contactEmail || apartment.contact_email || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Contact Phone:</span>
                  <span className="text-slate-700 font-medium flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} className="text-slate-400" />
                    {apartment.contactPhone || apartment.contact_phone || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Administrator Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <User size={14} className="text-slate-400" /> Apartment Administrator
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Admin Name:</span>
                  <span className="text-slate-700 font-medium">
                    {apartment.adminName || apartment.admin?.name || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Admin Email:</span>
                  <span className="text-slate-700 font-medium flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} className="text-slate-400" />
                    {apartment.adminEmail || apartment.admin?.email || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Admin Phone:</span>
                  <span className="text-slate-700 font-medium flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} className="text-slate-400" />
                    {apartment.adminPhone || apartment.admin?.phone || '—'}
                  </span>
                </div>

                {/* Building metrics if provided */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block">Buildings:</span>
                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                      <Layers size={12} className="text-slate-400" />
                      {apartment.buildingCount ?? apartment.buildings?.length ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Flats:</span>
                    <span className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                      <Home size={12} className="text-slate-400" />
                      {apartment.flatCount ?? apartment.flatsCount ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} /> Registered: {apartment.createdAt ? new Date(apartment.createdAt).toLocaleString() : '—'}
            </span>
            {apartment.updatedAt && (
              <span>Last Updated: {new Date(apartment.updatedAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* Rejection input box if triggered */}
          {showRejectInput && isPending && (
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-3 animate-in fade-in-50 duration-150">
              <h4 className="text-xs font-semibold text-rose-900">
                Specify Rejection Reason (Required)
              </h4>
              <Textarea
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectReasonError) setRejectReasonError('');
                }}
                placeholder="Explain why this apartment application is being rejected (e.g. invalid documentation, unverifiable address)..."
                rows={3}
                error={rejectReasonError}
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowRejectInput(false)}
                  disabled={loadingAction}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleConfirmRejectWithReason}
                  loading={loadingAction}
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          )}

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <Button variant="secondary" onClick={onClose} disabled={loadingAction}>
              Close
            </Button>

            <div className="flex items-center gap-2">
              {/* Actions for Pending */}
              {isPending && !showRejectInput && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={promptReject}
                    disabled={loadingAction}
                    iconLeft={XCircle}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={promptApprove}
                    disabled={loadingAction}
                    loading={loadingAction}
                    iconLeft={CheckCircle}
                  >
                    Approve Application
                  </Button>
                </>
              )}

              {/* Actions for Approved */}
              {isApproved && onSuspend && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={promptSuspend}
                  disabled={loadingAction}
                  loading={loadingAction}
                  iconLeft={AlertTriangle}
                >
                  Suspend Complex
                </Button>
              )}

              {/* Actions for Suspended */}
              {isSuspended && onReactivate && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={promptReactivate}
                  disabled={loadingAction}
                  loading={loadingAction}
                  iconLeft={CheckCircle}
                >
                  Reactivate Complex
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleDialogConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        loading={loadingAction}
      />
    </>
  );
}
