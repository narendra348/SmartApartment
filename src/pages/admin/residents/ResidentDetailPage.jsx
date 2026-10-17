import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Building2,
  Home,
  ArrowLeft,
  Edit,
  Trash2,
  Send,
  Calendar,
  Shuffle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import StatusBadge from '../../../components/ui/StatusBadge';
import Modal from '../../../components/ui/Modal';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/StateViews';
import {
  getResidentById,
  deleteResident,
  resendResidentInvitation,
  reassignResidentFlat,
} from '../../../api/residentsApi';
import { getBuildings } from '../../../api/buildingsApi';
import { getFlats } from '../../../api/flatsApi';
import { ROUTES } from '../../../constants';

export default function ResidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invitation resend state
  const [resending, setResending] = useState(false);

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reassignment modal states
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [buildings, setBuildings] = useState([]);
  const [targetBuildingId, setTargetBuildingId] = useState('');
  const [targetFlatId, setTargetFlatId] = useState('');
  const [availableFlats, setAvailableFlats] = useState([]);
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [reassignError, setReassignError] = useState('');

  const loadResident = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResidentById(id);
      setResident(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve resident details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadResident();
  }, [loadResident]);

  // Load buildings for reassignment modal
  const openReassignModal = async () => {
    setTargetBuildingId('');
    setTargetFlatId('');
    setAvailableFlats([]);
    setReassignError('');
    setReassignModalOpen(true);

    try {
      const bData = await getBuildings({ limit: 100 });
      setBuildings(bData.items || []);
    } catch {
      // Non-blocking
    }
  };

  const handleTargetBuildingChange = async (e) => {
    const bId = e.target.value;
    setTargetBuildingId(bId);
    setTargetFlatId('');
    setReassignError('');

    if (!bId) {
      setAvailableFlats([]);
      return;
    }

    setLoadingFlats(true);
    try {
      const fData = await getFlats({ buildingId: bId, limit: 100 });
      setAvailableFlats(fData.items || []);
    } catch {
      setAvailableFlats([]);
    } finally {
      setLoadingFlats(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!targetBuildingId || !targetFlatId) {
      setReassignError('Please select both a building and a destination flat.');
      return;
    }

    setReassigning(true);
    setReassignError('');
    try {
      await reassignResidentFlat(id, {
        buildingId: targetBuildingId,
        flatId: targetFlatId,
      });
      toast.success('Resident successfully reassigned to new flat.');
      setReassignModalOpen(false);
      await loadResident();
    } catch (err) {
      setReassignError(err.message || 'Failed to reassign flat.');
    } finally {
      setReassigning(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendResidentInvitation(id);
      toast.success('Invitation email has been resent.');
    } catch (err) {
      toast.error(err.message || 'Failed to resend invitation.');
    } finally {
      setResending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteResident(id);
      toast.success('Resident removed successfully.');
      navigate(ROUTES.ADMIN.RESIDENTS);
    } catch (err) {
      toast.error(err.message || 'Failed to remove resident.');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resident Profile" />
        <Card className="p-12">
          <PageLoader message="Loading resident details..." />
        </Card>
      </div>
    );
  }

  if (error || !resident) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resident Profile" />
        <Card className="p-8">
          <ErrorState
            title="Resident Record Not Found"
            description={error || 'Unable to locate the requested resident.'}
            onRetry={loadResident}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.RESIDENTS)}
              iconLeft={ArrowLeft}
            >
              Back to Residents Directory
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const resId = resident.id || resident._id || id;
  const name = resident.name || resident.fullName || 'Resident Profile';
  const email = resident.email || '—';
  const phone = resident.phone || resident.phoneNumber || '—';
  const buildingId =
    resident.buildingId || resident.building?.id || resident.building?._id;
  const buildingName = resident.building?.name || resident.buildingName || 'Building';
  const buildingCode = resident.building?.code;
  const flatId = resident.flatId || resident.flat?.id || resident.flat?._id;
  const flatNo =
    resident.flat?.flatNumber ||
    resident.flat?.number ||
    resident.flatNumber ||
    resident.unitNumber ||
    '—';
  const floorNo = resident.flat?.floorNumber ?? resident.flat?.floor;
  const accountStatus = resident.status || resident.accountStatus || 'active';
  const invitationStatus = resident.invitationStatus || (resident.invited ? 'invited' : null);

  const buildingOptions = [
    { value: '', label: 'Select Target Building' },
    ...buildings.map((b) => ({
      value: b.id || b._id,
      label: `${b.name} (${b.code || 'NO-CODE'})`,
    })),
  ];

  const flatOptions = [
    { value: '', label: loadingFlats ? 'Loading flats...' : 'Select Target Flat' },
    ...availableFlats.map((f) => ({
      value: f.id || f._id,
      label: `Flat ${f.flatNumber || f.number} (Floor ${f.floorNumber ?? f.floor ?? '—'}) - ${f.occupancyStatus || 'vacant'}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        subtitle={`Resident profile and unit assignment in ${buildingName}`}
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Residents', href: ROUTES.ADMIN.RESIDENTS },
          { label: name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.RESIDENTS)}
              iconLeft={ArrowLeft}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/admin/residents/${resId}/edit`)}
              iconLeft={Edit}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteModalOpen(true)}
              iconLeft={Trash2}
            >
              Remove
            </Button>
          </div>
        }
      />

      {/* KPI / Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Account Status */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Account Status
            </p>
            <div className="mt-1">
              <StatusBadge status={accountStatus} />
            </div>
          </div>
        </Card>

        {/* Invitation Status */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Send size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Invitation Status
            </p>
            <div className="mt-1">
              {invitationStatus ? (
                <StatusBadge status={invitationStatus} />
              ) : (
                <span className="text-xs text-slate-400">Direct / Active</span>
              )}
            </div>
          </div>
        </Card>

        {/* Assigned Building */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
            <Building2 size={24} />
          </div>
          <div className="truncate">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Building
            </p>
            {buildingId ? (
              <Link
                to={`/admin/buildings/${buildingId}`}
                className="text-sm font-bold text-sky-600 hover:underline truncate block mt-0.5"
              >
                {buildingName}
              </Link>
            ) : (
              <p className="text-sm font-bold text-slate-800 mt-0.5">{buildingName}</p>
            )}
          </div>
        </Card>

        {/* Assigned Flat */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Home size={24} />
          </div>
          <div className="truncate">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Assigned Flat
            </p>
            {flatId ? (
              <Link
                to={`/admin/flats/${flatId}`}
                className="text-sm font-bold text-purple-700 hover:underline truncate block mt-0.5"
              >
                Flat {flatNo}
              </Link>
            ) : (
              <p className="text-sm font-bold text-slate-800 mt-0.5">Flat {flatNo}</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <Card className="p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <User size={18} className="text-sky-600" />
            Personal Details
          </h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Full Name
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-800">{name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email Address
              </dt>
              <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                <span>{email}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Phone Number
              </dt>
              <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                <Phone size={14} className="text-slate-400" />
                <span>{phone}</span>
              </dd>
            </div>
            {resident.emergencyContact && (
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Emergency Contact / Notes
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {resident.emergencyContact}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Registration Date
              </dt>
              <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                <span>
                  {resident.createdAt ? new Date(resident.createdAt).toLocaleDateString() : '—'}
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        {/* Residence & Flat Assignment Card */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 flex-wrap gap-2">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Home size={18} className="text-sky-600" />
                Residence Assignment
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={openReassignModal}
                iconLeft={Shuffle}
              >
                Reassign Flat
              </Button>
            </div>

            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Assigned Flat / Unit
                </dt>
                <dd className="mt-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Home size={14} className="text-slate-400" />
                  <span>Flat {flatNo}</span>
                  {floorNo != null && (
                    <span className="text-xs text-slate-500 font-normal">
                      (Floor {floorNo})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Building
                </dt>
                <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  <span>{buildingName}</span>
                  {buildingCode && (
                    <span className="font-mono text-xs text-sky-600">
                      ({buildingCode})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Occupancy Status
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    status={
                      resident.occupancyStatus ||
                      resident.flat?.occupancyStatus ||
                      'occupied'
                    }
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Move-in / Lease Start
                </dt>
                <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>
                    {resident.moveInDate
                      ? new Date(resident.moveInDate).toLocaleDateString()
                      : resident.createdAt
                      ? new Date(resident.createdAt).toLocaleDateString()
                      : '—'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Invitation Action banner if invited */}
          {invitationStatus === 'invited' && (
            <div className="mt-6 pt-4 border-t border-slate-100 bg-indigo-50/50 p-4 rounded-xl flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-indigo-900">
                  Invitation Link Pending
                </p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  Resident has not accepted their email invitation yet.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResend}
                loading={resending}
                disabled={resending}
                iconLeft={Send}
              >
                Resend Email
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Reassign Flat Modal */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title="Reassign Resident to Another Flat"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Select a new building and flat unit to reassign{' '}
            <strong className="text-slate-800">{name}</strong>. Currently residing in{' '}
            <strong>
              Flat {flatNo} ({buildingName})
            </strong>
            .
          </p>

          {reassignError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {reassignError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Destination Building <span className="text-red-500">*</span>
            </label>
            <Select
              value={targetBuildingId}
              onChange={handleTargetBuildingChange}
              options={buildingOptions}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Destination Flat / Unit <span className="text-red-500">*</span>
            </label>
            <Select
              value={targetFlatId}
              onChange={(e) => setTargetFlatId(e.target.value)}
              options={flatOptions}
              disabled={!targetBuildingId || loadingFlats}
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setReassignModalOpen(false)}
              disabled={reassigning}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmReassign}
              loading={reassigning}
              disabled={reassigning || !targetBuildingId || !targetFlatId}
            >
              Confirm Reassignment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deletion Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Remove Resident?"
        message={`Are you sure you want to remove "${name}"? They will lose access to this apartment complex and unit Flat ${flatNo}.`}
        confirmLabel="Yes, Remove Resident"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
