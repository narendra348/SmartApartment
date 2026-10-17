import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  Save,
  ArrowLeft,
  Hash,
  MapPin,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/StateViews';
import {
  createBuilding,
  updateBuilding,
  getBuildingById,
} from '../../../api/buildingsApi';
import { ROUTES } from '../../../constants';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'inactive', label: 'Inactive' },
];

export default function BuildingFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    floors: '',
    status: 'active',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEdit) return;

    async function loadBuilding() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await getBuildingById(id);
        if (data) {
          setFormData({
            name: data.name || '',
            code: data.code || '',
            address: data.address || '',
            floors: data.floors !== undefined && data.floors !== null ? String(data.floors) : '',
            status: data.status || 'active',
          });
        }
      } catch (err) {
        setFetchError(err.message || 'Failed to load building details.');
      } finally {
        setLoading(false);
      }
    }

    loadBuilding();
  }, [id, isEdit]);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Building name is required.';
    }
    if (!formData.code.trim()) {
      errs.code = 'Building code is required (e.g. BLD-A).';
    }
    if (formData.floors && (isNaN(Number(formData.floors)) || Number(formData.floors) < 0)) {
      errs.floors = 'Number of floors must be a valid positive number.';
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
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim(),
        floors: formData.floors ? Number(formData.floors) : undefined,
        status: formData.status,
      };

      if (isEdit) {
        await updateBuilding(id, payload);
        toast.success(`Building "${payload.name}" updated successfully.`);
      } else {
        await createBuilding(payload);
        toast.success(`Building "${payload.name}" created successfully.`);
      }

      navigate(ROUTES.ADMIN.BUILDINGS);
    } catch (err) {
      toast.error(err.message || `Failed to ${isEdit ? 'update' : 'create'} building.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title={isEdit ? 'Edit Building' : 'Add New Building'} />
        <Card className="p-12">
          <PageLoader message="Loading building data..." />
        </Card>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title="Building Details" />
        <Card className="p-8">
          <ErrorState
            title="Building Not Found"
            description={fetchError}
            onRetry={() => navigate(ROUTES.ADMIN.BUILDINGS)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title={isEdit ? `Edit Building: ${formData.name || 'Building'}` : 'Add New Building'}
        subtitle={
          isEdit
            ? 'Update building specifications, floor count, and status.'
            : 'Register a new residential or commercial tower to your apartment complex.'
        }
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Buildings', href: ROUTES.ADMIN.BUILDINGS },
          { label: isEdit ? 'Edit' : 'New Building' },
        ]}
      />

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Building Name */}
          <Input
            label="Building / Tower Name"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Tower A, Maple Wing, West Block"
            error={errors.name}
            required
            autoFocus
            iconLeft={Building2}
          />

          {/* Building Code */}
          <Input
            label="Building Code"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="e.g. BLD-A, TWR-1"
            helperText="A unique identifier used for flat prefixes and reporting."
            error={errors.code}
            required
            iconLeft={Hash}
          />

          {/* Address */}
          <Input
            label="Address / Location Description"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="e.g. North Gate Entrance, Complex Phase 1"
            iconLeft={MapPin}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Number of floors */}
            <Input
              label="Number of Floors"
              id="floors"
              name="floors"
              type="number"
              min="0"
              value={formData.floors}
              onChange={handleChange}
              placeholder="e.g. 12"
              error={errors.floors}
              iconLeft={Layers}
            />

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-xs font-medium text-slate-700 mb-1">
                Operational Status
              </label>
              <Select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(ROUTES.ADMIN.BUILDINGS)}
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
              {isEdit ? 'Save Changes' : 'Create Building'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
