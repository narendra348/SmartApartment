import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Layers,
  Home,
  MapPin,
  Calendar,
  Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import StatusBadge from '../../../components/ui/StatusBadge';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '../../../components/ui/StateViews';
import { getBuildingById, deleteBuilding } from '../../../api/buildingsApi';
import { getFlats } from '../../../api/flatsApi';
import { ROUTES } from '../../../constants';

export default function BuildingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [building, setBuilding] = useState(null);
  const [flats, setFlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const buildingData = await getBuildingById(id);
      setBuilding(buildingData);

      // Attempt to load flats in this building
      try {
        const flatsData = await getFlats({ buildingId: id, limit: 50 });
        setFlats(flatsData.items || []);
      } catch {
        // If flats endpoint returns error or is unavailable, use embedded flats if present
        if (Array.isArray(buildingData?.flats)) {
          setFlats(buildingData.flats);
        } else {
          setFlats([]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve building details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBuilding(id);
      toast.success(`Building "${building?.name}" deleted successfully.`);
      navigate(ROUTES.ADMIN.BUILDINGS);
    } catch (err) {
      toast.error(err.message || 'Failed to delete building.');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Building Details" />
        <Card className="p-12">
          <PageLoader message="Loading building specifications..." />
        </Card>
      </div>
    );
  }

  if (error || !building) {
    return (
      <div className="space-y-6">
        <PageHeader title="Building Details" />
        <Card className="p-8">
          <ErrorState
            title="Building Not Found"
            description={error || 'Unable to locate the requested building record.'}
            onRetry={loadData}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.BUILDINGS)}
              iconLeft={ArrowLeft}
            >
              Back to Buildings Directory
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const bId = building.id || building._id || id;
  const flatCount = flats.length || building.flatCount || building.flatsCount || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={building.name || 'Building Details'}
        subtitle={`Building Code: ${building.code || 'N/A'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Buildings', href: ROUTES.ADMIN.BUILDINGS },
          { label: building.name || 'Details' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ROUTES.ADMIN.BUILDINGS)}
              iconLeft={ArrowLeft}
            >
              Back
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/admin/buildings/${bId}/edit`)}
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

      {/* Building Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</p>
            <div className="mt-1">
              <StatusBadge status={building.status || 'active'} />
            </div>
          </div>
        </Card>

        {/* Floors */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Floors</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">
              {building.floors ?? building.floorCount ?? '—'}
            </p>
          </div>
        </Card>

        {/* Flats */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Home size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Flats / Units</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{flatCount}</p>
          </div>
        </Card>

        {/* Code */}
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Hash size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Unique Code</p>
            <p className="text-base font-bold font-mono text-purple-700 mt-0.5">
              {building.code || '—'}
            </p>
          </div>
        </Card>
      </div>

      {/* Building Specifications Card */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <Building2 size={18} className="text-sky-600" />
          Building Information
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Building Name</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{building.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Building Code</dt>
            <dd className="mt-1 text-sm font-mono font-semibold text-sky-600">{building.code}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Location / Address</dt>
            <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span>{building.address || 'No specific location provided'}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Floors</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {building.floors ? `${building.floors} floors` : 'Not specified'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Created At</dt>
            <dd className="mt-1 text-sm text-slate-700 flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              <span>
                {building.createdAt ? new Date(building.createdAt).toLocaleString() : '—'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Last Updated</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {building.updatedAt ? new Date(building.updatedAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Associated Flats Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Home size={18} className="text-sky-600" />
            <h3 className="text-base font-semibold text-slate-800">
              Units & Flats in this Building ({flats.length})
            </h3>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`${ROUTES.ADMIN.FLATS_NEW}?buildingId=${bId}`)}
            iconLeft={Plus}
          >
            Add Flat to this Building
          </Button>
        </div>

        {flats.length === 0 ? (
          <EmptyState
            icon={Home}
            title="No flats in this building yet"
            description="Start registering flats or units mapped to this building."
            action={{
              label: 'Add First Flat',
              onClick: () => navigate(`${ROUTES.ADMIN.FLATS_NEW}?buildingId=${bId}`),
              icon: Plus,
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Flat / Unit No.</th>
                  <th className="py-2.5 px-3">Floor</th>
                  <th className="py-2.5 px-3">Type / Size</th>
                  <th className="py-2.5 px-3">Occupancy</th>
                  <th className="py-2.5 px-3">Maintenance Fee</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flats.map((flat) => {
                  const flatId = flat.id || flat._id;
                  const maintenanceAmount =
                    flat.maintenanceAmount != null || flat.monthlyMaintenance != null
                      ? `$${flat.maintenanceAmount ?? flat.monthlyMaintenance}`
                      : '—';

                  return (
                    <tr key={flatId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {flat.flatNumber || flat.number || flat.unitNumber || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        Floor {flat.floorNumber ?? flat.floor ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {flat.flatType || flat.type || flat.size || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={flat.occupancyStatus || flat.status || 'vacant'} />
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {maintenanceAmount}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/flats/${flatId}`)}
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
        )}
      </Card>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Building?"
        message={`Are you sure you want to permanently delete "${building.name}" (${building.code})? This action cannot be undone.`}
        confirmLabel="Yes, Delete Building"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
