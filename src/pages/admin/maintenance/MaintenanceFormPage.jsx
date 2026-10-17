import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, ChevronLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Select from '../../../components/ui/Select';
import { createMaintenanceRequest } from '../../../api/maintenanceApi';
import { getBuildings } from '../../../api/buildingsApi';
import { getFlats } from '../../../api/flatsApi';
import { ROUTES } from '../../../constants';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category…' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'hvac', label: 'HVAC / AC' },
  { value: 'structural', label: 'Structural' },
  { value: 'other', label: 'Other' },
];

const INITIAL_FORM = {
  subject: '',
  description: '',
  category: '',
  priority: 'medium',
  buildingId: '',
  flatId: '',
};

function validate(form) {
  const errors = {};
  if (!form.subject.trim()) errors.subject = 'Subject is required';
  if (!form.description.trim()) errors.description = 'Description is required';
  if (!form.category) errors.category = 'Category is required';
  return errors;
}

export default function MaintenanceFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [buildings, setBuildings] = useState([]);
  const [flats, setFlats] = useState([]);
  const [loadingFlats, setLoadingFlats] = useState(false);

  useEffect(() => {
    getBuildings({ limit: 100 })
      .then((res) => {
        const list = res?.items ?? (Array.isArray(res) ? res : []);
        setBuildings(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.buildingId) {
      setFlats([]);
      setForm((prev) => ({ ...prev, flatId: '' }));
      return;
    }
    setLoadingFlats(true);
    getFlats({ buildingId: form.buildingId, limit: 200 })
      .then((res) => {
        const list = res?.items ?? (Array.isArray(res) ? res : []);
        setFlats(list);
      })
      .catch(() => setFlats([]))
      .finally(() => setLoadingFlats(false));
  }, [form.buildingId]);

  const buildingOptions = [
    { value: '', label: 'Select building (optional)…' },
    ...buildings.map((b) => ({ value: b._id ?? b.id, label: b.name ?? b.buildingName ?? 'Unnamed' })),
  ];

  const flatOptions = [
    { value: '', label: loadingFlats ? 'Loading…' : 'Select flat (optional)…' },
    ...flats.map((f) => ({
      value: f._id ?? f.id,
      label: `Flat ${f.number ?? f.flatNumber ?? f.name ?? f._id}`,
    })),
  ];

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitted) return; // prevent double submission

    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    const payload = {
      subject: form.subject.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
    };
    if (form.buildingId) payload.buildingId = form.buildingId;
    if (form.flatId) payload.flatId = form.flatId;

    try {
      await createMaintenanceRequest(payload, 'admin');
      setSubmitted(true);
      toast.success('Maintenance request submitted successfully');
      navigate(ROUTES.ADMIN.COMPLAINTS);
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Submission failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader
        title="New Maintenance Request"
        subtitle="Submit a new maintenance complaint or service request"
        icon={<Wrench size={22} />}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.ADMIN.COMPLAINTS)}
        >
          <ChevronLeft size={16} />
          Back
        </Button>
      </PageHeader>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-5 p-6">
            <Input
              id="subject"
              name="subject"
              label="Subject"
              required
              placeholder="e.g. Leaking pipe in bathroom"
              value={form.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              error={errors.subject}
              disabled={submitting}
            />

            <Textarea
              id="description"
              name="description"
              label="Description"
              required
              rows={4}
              placeholder="Provide a detailed description of the issue…"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              error={errors.description}
              disabled={submitting}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.category}
                  onChange={(val) => handleChange('category', val)}
                  options={CATEGORY_OPTIONS}
                  disabled={submitting}
                />
                {errors.category && (
                  <p className="text-xs text-red-500" role="alert">{errors.category}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Priority</label>
                <Select
                  value={form.priority}
                  onChange={(val) => handleChange('priority', val)}
                  options={PRIORITY_OPTIONS}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Building</label>
                <Select
                  value={form.buildingId}
                  onChange={(val) => handleChange('buildingId', val)}
                  options={buildingOptions}
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Flat / Unit</label>
                <Select
                  value={form.flatId}
                  onChange={(val) => handleChange('flatId', val)}
                  options={flatOptions}
                  disabled={submitting || !form.buildingId || loadingFlats}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(ROUTES.ADMIN.COMPLAINTS)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || submitted}
              loading={submitting}
            >
              <Save size={15} />
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
