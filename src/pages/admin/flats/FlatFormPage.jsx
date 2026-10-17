import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Home,
  Layers,
  Save,
  ArrowLeft,
  DollarSign,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/StateViews';
import { getFlatById, createFlat, updateFlat } from '../../../api/flatsApi';
import { getBuildings } from '../../../api/buildingsApi';
import { ROUTES } from '../../../constants';

const OCCUPANCY_OPTIONS = [
  { value: 'vacant', label: 'Vacant' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
];

const FLAT_TYPE_OPTIONS = [
  { value: '', label: 'Select Flat Type (Optional)' },
  { value: 'Studio', label: 'Studio' },
  { value: '1BHK', label: '1 BHK' },
  { value: '2BHK', label: '2 BHK' },
  { value: '3BHK', label: '3 BHK' },
  { value: '4BHK', label: '4 BHK' },
  { value: 'Penthouse', label: 'Penthouse' },
  { value: 'Commercial', label: 'Commercial' },
];

export default function FlatFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBuildingId = searchParams.get('buildingId') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Buildings dropdown options
  const [buildings, setBuildings] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    flatNumber: '',
    buildingId: preselectedBuildingId,
    floorNumber: '',
    flatType: '',
    occupancyStatus: 'vacant',
    maintenanceAmount: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setLoading(true);
      setFetchError(null);
      try {
        // 1. Fetch available buildings from API
        const bResult = await getBuildings({ limit: 100 });
        const bList = bResult.items || [];
        if (isMounted) setBuildings(bList);

        // 2. If edit mode, load flat data
        if (isEdit) {
          const flatData = await getFlatById(id);
          if (isMounted && flatData) {
            const bldId =
              flatData.buildingId ||
              flatData.building?.id ||
              flatData.building?._id ||
              '';
            setFormData({
              flatNumber: flatData.flatNumber || flatData.number || flatData.unitNumber || '',
              buildingId: bldId,
              floorNumber:
                flatData.floorNumber != null
                  ? String(flatData.floorNumber)
                  : flatData.floor != null
                  ? String(flatData.floor)
                  : '',
              flatType: flatData.flatType || flatData.type || '',
              occupancyStatus: flatData.occupancyStatus || flatData.status || 'vacant',
              maintenanceAmount:
                flatData.maintenanceAmount != null
                  ? String(flatData.maintenanceAmount)
                  : flatData.monthlyMaintenance != null
                  ? String(flatData.monthlyMaintenance)
                  : '',
            });
          }
        } else if (preselectedBuildingId && isMounted) {
          setFormData((prev) => ({ ...prev, buildingId: preselectedBuildingId }));
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err.message || 'Failed to initialize flat form.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initialize();
    return () => {
      isMounted = false;
    };
  }, [id, isEdit, preselectedBuildingId]);

  const validate = () => {
    const errs = {};
    if (!formData.flatNumber.trim()) {
      errs.flatNumber = 'Flat / Unit number is required (e.g. 101, B-402).';
    }
    if (!formData.buildingId) {
      errs.buildingId = 'Please select a building for this flat.';
    }
    if (formData.floorNumber && (isNaN(Number(formData.floorNumber)) || Number(formData.floorNumber) < 0)) {
      errs.floorNumber = 'Floor number must be a valid non-negative number.';
    }
    if (formData.maintenanceAmount && (isNaN(Number(formData.maintenanceAmount)) || Number(formData.maintenanceAmount) < 0)) {
      errs.maintenanceAmount = 'Maintenance fee must be a valid positive amount.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        flatNumber: formData.flatNumber.trim(),
        buildingId: formData.buildingId,
        floorNumber: formData.floorNumber ? Number(formData.floorNumber) : undefined,
        flatType: formData.flatType || undefined,
        occupancyStatus: formData.occupancyStatus,
        maintenanceAmount: formData.maintenanceAmount ? Number(formData.maintenanceAmount) : undefined,
      };

      if (isEdit) {
        await updateFlat(id, payload);
        toast.success(`Flat "${payload.flatNumber}" updated successfully.`);
      } else {
        await createFlat(payload);
        toast.success(`Flat "${payload.flatNumber}" registered successfully.`);
      }

      navigate(ROUTES.ADMIN.FLATS);
    } catch (err) {
      const msg = err.message || `Failed to ${isEdit ? 'update' : 'create'} flat.`;
      if (err.response?.status === 409 || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
        setErrors((prev) => ({
          ...prev,
          flatNumber: `Flat "${formData.flatNumber}" already exists in the selected building.`,
        }));
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title={isEdit ? 'Edit Flat' : 'Add New Flat'} />
        <Card className="p-12">
          <PageLoader message="Loading flat and building options..." />
        </Card>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title="Flat Management" />
        <Card className="p-8">
          <ErrorState
            title="Unable to Load Data"
            description={fetchError}
            onRetry={() => navigate(ROUTES.ADMIN.FLATS)}
          />
        </Card>
      </div>
    );
  }

  const buildingOptions = [
    { value: '', label: 'Select a Building' },
    ...buildings.map((b) => ({
      value: b.id || b._id,
      label: `${b.name} (${b.code || 'NO-CODE'})`,
    })),
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title={isEdit ? `Edit Flat: ${formData.flatNumber || 'Unit'}` : 'Register New Flat'}
        subtitle={
          isEdit
            ? 'Update unit information, occupancy status, and maintenance fees.'
            : 'Add a new unit to a building in your apartment complex.'
        }
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Flats', href: ROUTES.ADMIN.FLATS },
          { label: isEdit ? 'Edit Flat' : 'New Flat' },
        ]}
      />

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Building Selection */}
          <div>
            <label htmlFor="buildingId" className="block text-xs font-medium text-slate-700 mb-1">
              Building / Tower <span className="text-red-500">*</span>
            </label>
            <Select
              id="buildingId"
              name="buildingId"
              value={formData.buildingId}
              onChange={handleChange}
              options={buildingOptions}
              disabled={buildings.length === 0}
            />
            {errors.buildingId && (
              <p className="mt-1 text-xs text-red-600">{errors.buildingId}</p>
            )}
            {buildings.length === 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                <Info size={14} className="shrink-0" />
                <span>
                  No buildings found. You need to create a building first before adding flats.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Flat Number */}
            <Input
              label="Flat / Unit Number"
              id="flatNumber"
              name="flatNumber"
              value={formData.flatNumber}
              onChange={handleChange}
              placeholder="e.g. 101, A-204"
              error={errors.flatNumber}
              required
              autoFocus
              iconLeft={Home}
            />

            {/* Floor Number */}
            <Input
              label="Floor Number"
              id="floorNumber"
              name="floorNumber"
              type="number"
              min="0"
              value={formData.floorNumber}
              onChange={handleChange}
              placeholder="e.g. 1, 2, 10"
              error={errors.floorNumber}
              iconLeft={Layers}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Flat Type */}
            <div>
              <label htmlFor="flatType" className="block text-xs font-medium text-slate-700 mb-1">
                Flat Type / Layout
              </label>
              <Select
                id="flatType"
                name="flatType"
                value={formData.flatType}
                onChange={handleChange}
                options={FLAT_TYPE_OPTIONS}
              />
            </div>

            {/* Occupancy Status */}
            <div>
              <label htmlFor="occupancyStatus" className="block text-xs font-medium text-slate-700 mb-1">
                Occupancy Status <span className="text-red-500">*</span>
              </label>
              <Select
                id="occupancyStatus"
                name="occupancyStatus"
                value={formData.occupancyStatus}
                onChange={handleChange}
                options={OCCUPANCY_OPTIONS}
              />
            </div>
          </div>

          {/* Monthly Maintenance Fee */}
          <Input
            label="Monthly Maintenance Fee ($)"
            id="maintenanceAmount"
            name="maintenanceAmount"
            type="number"
            min="0"
            step="0.01"
            value={formData.maintenanceAmount}
            onChange={handleChange}
            placeholder="e.g. 150.00"
            helperText="Default monthly maintenance billing charge for this flat unit."
            error={errors.maintenanceAmount}
            iconLeft={DollarSign}
          />

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(ROUTES.ADMIN.FLATS)}
              disabled={submitting}
              iconLeft={ArrowLeft}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting}
              iconLeft={Save}
            >
              {isEdit ? 'Save Changes' : 'Register Flat'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
