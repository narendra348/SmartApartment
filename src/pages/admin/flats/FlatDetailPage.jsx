import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Home,
  Building2,
  ArrowLeft,
  Edit,
  Trash2,
  Layers,
  DollarSign,
  User,
  Calendar,
  Mail,
  Phone,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import StatusBadge from '../../../components/ui/StatusBadge';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/StateViews';
import { getFlatById, deleteFlat } from '../../../api/flatsApi';
import { ROUTES } from '../../../constants';

export default function FlatDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [flat, setFlat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadFlat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFlatById(id);
      setFlat(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve flat details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadFlat();
  }, [loadFlat]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFlat(id);
      toast.success(
        `Flat "${flat?.flatNumber || flat?.number || 'Unit'}" deleted successfully.`,
      );
      navigate(ROUTES.ADMIN.FLATS);
    } catch (err) {
      toast.error(err.message || 'Failed to delete flat.');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Flat Details" />
        <Card className="p-12">
          <PageLoader message="Loading flat specifications..." />
        </Card>
      </div>
    );
  }

  if (error || !flat) {
    return (
      <div className="space-y-6">
        <PageHeader title="Flat Details" />
        <Card className="p-8">
          <ErrorState
            title="Flat Record Not Found"
            description={error || 'Unable to locate the requested flat.'}
            onRetry={loadFlat}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.FLATS)}
              iconLeft={ArrowLeft}
            >
              Back to Flats Directory
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const flatId = flat.id || flat._id || id;
  const flatNumber = flat.flatNumber || flat.number || flat.unitNumber || 'Unit';
  const buildingId =
    flat.buildingId || flat.building?.id || flat.building?._id;
  const buildingName = flat.building?.name || flat.buildingName || 'Building';
  const buildingCode = flat.building?.code;
  const resident = flat.resident || flat.tenant;
  const occupancyStatus = flat.occupancyStatus || flat.status || 'vacant';
  const maintenanceAmount =
    flat.maintenanceAmount != null || flat.monthlyMaintenance != null
      ? `$${flat.maintenanceAmount ?? flat.monthlyMaintenance}`
      : '—';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Flat ${flatNumber}`}
        subtitle={
          buildingName
            ? `Located in ${buildingName} ${buildingCode ? `(${buildingCode})` : ''}`
            : 'Apartment Unit'
        }
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Flats', href: ROUTES.ADMIN.FLATS },
          { label: `Flat ${flatNumber}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.FLATS)}
              iconLeft={ArrowLeft}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/admin/flats/${flatId}/edit`)}
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
              Delete
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
            <Home size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Occupancy Status
            </p>
            <div className="mt-1">
              <StatusBadge status={occupancyStatus} />
            </div>
          </div>
        </Card>

        {/* Building */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
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

        {/* Floor */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Floor
            </p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">
              {flat.floorNumber != null ? `Floor ${flat.floorNumber}` : flat.floor != null ? `Floor ${flat.floor}` : '—'}
            </p>
          </div>
        </Card>

        {/* Maintenance Fee */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Monthly Maintenance
            </p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5">
              {maintenanceAmount}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flat Specifications Card */}
        <Card className="p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Home size={18} className="text-sky-600" />
            Unit Information
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Flat / Unit Number
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-800">{flatNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Layout / Flat Type
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {flat.flatType || flat.type || flat.size || 'Not specified'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Building Reference
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {buildingId ? (
                  <Link
                    to={`/admin/buildings/${buildingId}`}
                    className="text-sky-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <span>{buildingName}</span>
                    {buildingCode && <span className="font-mono text-xs">({buildingCode})</span>}
                  </Link>
                ) : (
                  buildingName
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Floor Number
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {flat.floorNumber != null ? flat.floorNumber : flat.floor != null ? flat.floor : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Created At
              </dt>
              <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                <span>
                  {flat.createdAt ? new Date(flat.createdAt).toLocaleDateString() : '—'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Last Updated
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {flat.updatedAt ? new Date(flat.updatedAt).toLocaleDateString() : '—'}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Resident / Occupancy Details Card */}
        <Card className="p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
            <User size={18} className="text-sky-600" />
            Resident / Tenant Information
          </h3>

          {occupancyStatus === 'vacant' ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Home size={22} />
              </div>
              <p className="text-sm font-medium text-slate-700">This flat is currently vacant</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No resident is assigned to this unit. Resident assignments will be handled through the Residents module.
              </p>
            </div>
          ) : resident ? (
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Full Name
                </dt>
                <dd className="mt-1 text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  <span>{resident.name || resident.fullName || '—'}</span>
                </dd>
              </div>
              {resident.email && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email Address
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    <span>{resident.email}</span>
                  </dd>
                </div>
              )}
              {resident.phone && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Phone Number
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                    <Phone size={14} className="text-slate-400" />
                    <span>{resident.phone}</span>
                  </dd>
                </div>
              )}
              {resident.moveInDate && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Move-in / Lease Start
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>{new Date(resident.moveInDate).toLocaleDateString()}</span>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-2">
                <User size={22} />
              </div>
              <p className="text-sm font-medium text-slate-700">Occupied (Profile not linked)</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                The unit status is marked as occupied, but no resident user profile is linked yet.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Flat?"
        message={`Are you sure you want to delete Flat "${flatNumber}"? This action cannot be undone.`}
        confirmLabel="Yes, Delete Flat"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
