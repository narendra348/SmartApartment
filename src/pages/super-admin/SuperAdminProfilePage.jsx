import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { getSuperAdminProfile, updateSuperAdminProfile } from '../../api/superAdminApi';

export default function SuperAdminProfilePage() {
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const profile = await getSuperAdminProfile();
        const activeUser = profile || user;
        if (activeUser) {
          setFormData({
            name: activeUser.name || '',
            email: activeUser.email || '',
            phone: activeUser.phone || '',
          });
        }
      } catch (err) {
        // Fallback to in-memory user
        if (user) {
          setFormData({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
          });
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required.';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please provide a valid email address.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await updateSuperAdminProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
      });
      await refreshUser();
      toast.success('Super Admin profile updated successfully!');
    } catch (err) {
      toast.error(
        err.message ||
          'Failed to update profile. Server endpoint PUT /super-admin/profile may not be available.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Super Admin Profile" />
        <Card className="p-12">
          <PageLoader message="Loading profile details..." />
        </Card>
      </div>
    );
  }

  const initial = (formData.name || formData.email || 'S')
    .charAt(0)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Super Admin Profile"
        subtitle="Manage your platform administrative credentials and profile details."
        breadcrumbs={[
          { label: 'Dashboard', href: '/super-admin/dashboard' },
          { label: 'Profile' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Summary Card */}
        <Card className="p-6 md:col-span-1 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-sky-600 text-white flex items-center justify-center text-2xl font-bold shadow-md mb-4">
            {initial}
          </div>
          <h2 className="text-base font-bold text-slate-800 leading-tight">
            {formData.name || 'Super Administrator'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-full">
            {formData.email}
          </p>

          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
            <Shield size={13} />
            <span>Platform Super Admin</span>
          </div>

          <div className="w-full mt-6 pt-5 border-t border-slate-100 text-left space-y-2.5 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Account Status:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Role:</span>
              <span className="font-mono text-slate-700 uppercase">
                {user?.role || 'SUPER_ADMIN'}
              </span>
            </div>
            {user?.createdAt && (
              <div className="flex items-center justify-between">
                <span>Member Since:</span>
                <span className="text-slate-700">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Edit Form */}
        <Card className="p-6 md:col-span-2">
          <Card.Header>
            <Card.Title>Account Information</Card.Title>
          </Card.Header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Full Name"
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                error={errors.name}
                required
                placeholder="Enter your full name"
                iconLeft={User}
              />
            </div>

            <div>
              <Input
                label="Email Address"
                id="email"
                name="email"
                type="email"
                value={formData.email}
                disabled
                helperText="Email changes require server administrator authorization."
                iconLeft={Mail}
              />
            </div>

            <div>
              <Input
                label="Contact Phone"
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, phone: e.target.value }));
                }}
                placeholder="+91 98765 43210"
                iconLeft={Phone}
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={saving}
                iconLeft={Save}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
