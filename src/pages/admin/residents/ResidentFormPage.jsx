import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Save,
  ArrowLeft,
  MailCheck,
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
import {
  getResidentById,
  createResident,
  updateResident,
} from '../../../api/residentsApi';
import { getBuildings } from '../../../api/buildingsApi';
import { getFlats } from '../../../api/flatsApi';
import { ROUTES } from '../../../constants';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

const OCCUPANCY_OPTIONS = [
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'vacant', label: 'Vacant' },
];

export default function ResidentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Dynamic dropdowns
  const [buildings, setBuildings] = useState([]);
  const [flats, setFlats] = useState([]);
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    buildingId: '',
    flatId: '',
    occupancyStatus: 'occupied',
    emergencyContact: '',
    status: 'active',
  });

  const [errors, setErrors] = useState({});

  // 1. Initial load: Buildings and (if edit) existing resident
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setLoading(true);
      setFetchError(null);
      try {
        // Fetch buildings
        const bResult = await getBuildings({ limit: 100 });
        const bList = bResult.items || [];
        if (isMounted) setBuildings(bList);

        if (isEdit) {
          const resData = await getResidentById(id);
          if (isMounted && resData) {
            const bldId =
              resData.buildingId ||
              resData.building?.id ||
              resData.building?._id ||
              '';
            const fltId =
              resData.flatId ||
              resData.flat?.id ||
              resData.flat?._id ||
              '';

            setFormData({
              name: resData.name || resData.fullName || '',
              email: resData.email || '',
              phone: resData.phone || resData.phoneNumber || '',
              buildingId: bldId,
              flatId: fltId,
              occupancyStatus: resData.occupancyStatus || resData.flat?.occupancyStatus || 'occupied',
              emergencyContact: resData.emergencyContact || '',
              status: resData.status || resData.accountStatus || 'active',
            });

            // Fetch flats for this resident's building
            if (bldId) {
              const fResult = await getFlats({ buildingId: bldId, limit: 100 });
              if (isMounted) setFlats(fResult.items || []);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err.message || 'Failed to initialize resident form.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initialize();
    return () => {
      isMounted = false;
    };
  }, [id, isEdit]);

  // 2. Fetch flats dynamically when building changes
  const handleBuildingChange = async (e) => {
    const selectedBuildingId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      buildingId: selectedBuildingId,
      flatId: '', // Reset flat selection
    }));

    if (errors.buildingId) {
      setErrors((prev) => ({ ...prev, buildingId: '', flatId: '' }));
    }

    if (!selectedBuildingId) {
      setFlats([]);
      return;
    }

    setLoadingFlats(true);
    try {
      const fResult = await getFlats({ buildingId: selectedBuildingId, limit: 100 });
      setFlats(fResult.items || []);
    } catch {
      setFlats([]);
    } finally {
      setLoadingFlats(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Full name is required.';
    }
    if (!formData.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (formData.phone && !/^[\d\s+()-]{7,20}$/.test(formData.phone.trim())) {
      errs.phone = 'Please enter a valid phone number.';
    }
    if (!formData.buildingId) {
      errs.buildingId = 'Please select an assigned building.';
    }
    if (!formData.flatId) {
      errs.flatId = 'Please select an assigned flat/unit.';
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
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        buildingId: formData.buildingId,
        flatId: formData.flatId,
        occupancyStatus: formData.occupancyStatus,
        emergencyContact: formData.emergencyContact.trim() || undefined,
        status: formData.status,
      };

      if (isEdit) {
        await updateResident(id, payload);
        toast.success(`Resident "${payload.name}" updated successfully.`);
      } else {
        await createResident(payload);
        toast.success(
          `Resident "${payload.name}" added successfully. Invitation dispatched to ${payload.email}.`,
        );
      }

      navigate(ROUTES.ADMIN.RESIDENTS);
    } catch (err) {
      const msg = err.message || `Failed to ${isEdit ? 'update' : 'invite'} resident.`;
      if (
        err.response?.status === 409 ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('duplicate')
      ) {
        setErrors((prev) => ({
          ...prev,
          email: 'A user or resident with this email address already exists.',
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
        <PageHeader title={isEdit ? 'Edit Resident' : 'Invite Resident'} />
        <Card className="p-12">
          <PageLoader message="Loading buildings and unit options..." />
        </Card>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title="Resident Profile" />
        <Card className="p-8">
          <ErrorState
            title="Unable to Load Data"
            description={fetchError}
            onRetry={() => navigate(ROUTES.ADMIN.RESIDENTS)}
          />
        </Card>
      </div>
    );
  }

  const buildingOptions = [
    { value: '', label: 'Select Building' },
    ...buildings.map((b) => ({
      value: b.id || b._id,
      label: `${b.name} (${b.code || 'NO-CODE'})`,
    })),
  ];

  const flatOptions = [
    { value: '', label: loadingFlats ? 'Loading flats...' : 'Select Flat / Unit' },
    ...flats.map((f) => ({
      value: f.id || f._id,
      label: `Flat ${f.flatNumber || f.number || 'Unit'} (Floor ${f.floorNumber ?? f.floor ?? '—'}) - ${f.occupancyStatus || 'vacant'}`,
    })),
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title={isEdit ? `Edit Resident: ${formData.name || 'Profile'}` : 'Invite New Resident'}
        subtitle={
          isEdit
            ? 'Update contact details, assigned residence, and account status.'
            : 'Send a secure email invitation to assign a resident to an apartment unit.'
        }
        breadcrumbs={[
          { label: 'Dashboard', href: ROUTES.ADMIN.DASHBOARD },
          { label: 'Residents', href: ROUTES.ADMIN.RESIDENTS },
          { label: isEdit ? 'Edit Resident' : 'New Invitation' },
        ]}
      />

      {/* Security notice regarding invitations */}
      {!isEdit && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
          <MailCheck size={20} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-800 leading-relaxed">
            <p className="font-semibold text-sky-900 mb-0.5">Secure Invitation Workflow</p>
            An invitation email containing a secure link will be dispatched to the resident.
            They will set their own confidential password upon accepting the invitation. No plain-text
            passwords are created or stored.
          </div>
        </div>
      )}

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Full Name */}
          <Input
            label="Full Name"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Eleanor Vance"
            error={errors.name}
            required
            autoFocus
            iconLeft={User}
          />

          {/* Email */}
          <Input
            label="Email Address"
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="e.g. eleanor.vance@example.com"
            helperText="The resident will use this email address to receive invitations and sign in."
            error={errors.email}
            required
            iconLeft={Mail}
          />

          {/* Phone */}
          <Input
            label="Phone Number"
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="e.g. +1 555-0199"
            error={errors.phone}
            iconLeft={Phone}
          />

          {/* Assigned Building & Flat Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="buildingId" className="block text-xs font-medium text-slate-700 mb-1">
                Building / Tower <span className="text-red-500">*</span>
              </label>
              <Select
                id="buildingId"
                name="buildingId"
                value={formData.buildingId}
                onChange={handleBuildingChange}
                options={buildingOptions}
                disabled={buildings.length === 0}
              />
              {errors.buildingId && (
                <p className="mt-1 text-xs text-red-600">{errors.buildingId}</p>
              )}
            </div>

            <div>
              <label htmlFor="flatId" className="block text-xs font-medium text-slate-700 mb-1">
                Flat / Unit <span className="text-red-500">*</span>
              </label>
              <Select
                id="flatId"
                name="flatId"
                value={formData.flatId}
                onChange={handleChange}
                options={flatOptions}
                disabled={!formData.buildingId || loadingFlats}
              />
              {errors.flatId && (
                <p className="mt-1 text-xs text-red-600">{errors.flatId}</p>
              )}
              {formData.buildingId && flats.length === 0 && !loadingFlats && (
                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                  <Info size={12} />
                  No units available in this building.
                </p>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <Input
            label="Emergency Contact / Notes (Optional)"
            id="emergencyContact"
            name="emergencyContact"
            value={formData.emergencyContact}
            onChange={handleChange}
            placeholder="e.g. Jane Vance (+1 555-0122)"
          />

          {/* Occupancy and Account Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="occupancyStatus" className="block text-xs font-medium text-slate-700 mb-1">
                Occupancy Status
              </label>
              <Select
                id="occupancyStatus"
                name="occupancyStatus"
                value={formData.occupancyStatus}
                onChange={handleChange}
                options={OCCUPANCY_OPTIONS}
              />
            </div>

            {isEdit && (
              <div>
                <label htmlFor="status" className="block text-xs font-medium text-slate-700 mb-1">
                  Account Status
                </label>
                <Select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={STATUS_OPTIONS}
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(ROUTES.ADMIN.RESIDENTS)}
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
              {isEdit ? 'Save Changes' : 'Register Resident'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
