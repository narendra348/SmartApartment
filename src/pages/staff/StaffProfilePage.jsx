import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Wrench,
  Save,
  CheckCircle2,
  Calendar,
  Badge,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { PageLoader } from '../../components/ui/LoadingSpinner';
import PasswordChangeSection from '../../components/profile/PasswordChangeSection';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile } from '../../api/profileApi';

export default function StaffProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [errors, setErrors] = useState({});
  const [profileMeta, setProfileMeta] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getProfile('staff')
      .then((data) => {
        if (!isMounted) return;
        const active = data || user;
        setProfileMeta(active);
        setFormData({
          name: active?.name || active?.fullName || '',
          email: active?.email || '',
          phone: active?.phone || active?.contactPhone || '',
        });
      })
      .catch(() => {
        if (!isMounted) return;
        if (user) {
          setProfileMeta(user);
          setFormData({
            name: user.name || user.fullName || '',
            email: user.email || '',
            phone: user.phone || '',
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      errs.name = 'Full name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
      errs.email = 'Please provide a valid email address';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    try {
      await updateProfile(
        {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        },
        'staff',
      );
      toast.success('Profile updated successfully!');
      if (refreshUser) await refreshUser();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const specialization =
    profileMeta?.specialization ||
    profileMeta?.department ||
    user?.specialization ||
    null;

  const employeeId =
    profileMeta?.employeeId ||
    profileMeta?.staffId ||
    user?.employeeId ||
    null;

  const joinedDate =
    profileMeta?.createdAt || profileMeta?.hiredAt || user?.createdAt || null;

  const initial = (formData.name || formData.email || 'S').charAt(0).toUpperCase();

  const roleLabel =
    user?.role === 'MAINTENANCE_STAFF' || user?.role === 'maintenance_staff'
      ? 'Maintenance Staff'
      : 'Maintenance Staff';

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My Profile" />
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200">
          <PageLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal contact information and account security"
        icon={<User size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editable Profile */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Personal Information</h3>
                <p className="text-xs text-slate-500">
                  Update your contact details for work order assignments and communications
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                required
                placeholder="e.g. John Smith"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                }}
                error={errors.name}
                disabled={saving}
                iconLeft={User}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  required
                  placeholder="staff@smartapartment.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, email: e.target.value }));
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  error={errors.email}
                  disabled={saving}
                  iconLeft={Mail}
                />

                <Input
                  label="Contact Phone"
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, phone: e.target.value }));
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: null }));
                  }}
                  error={errors.phone}
                  disabled={saving}
                  iconLeft={Phone}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" loading={saving} iconLeft={Save}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Password change */}
          <PasswordChangeSection />
        </div>

        {/* Right Column: Read-only Staff Info */}
        <div className="space-y-6">
          {/* Avatar card */}
          <Card className="p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-amber-600 text-white flex items-center justify-center text-2xl font-bold shadow-md mb-3">
              {initial}
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">
              {formData.name || 'Staff Member'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-full">{formData.email}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
              <Wrench size={13} />
              <span>{roleLabel}</span>
            </div>
          </Card>

          {/* Staff details */}
          <Card className="p-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Staff Details
            </h4>
            <div className="space-y-3 text-sm">
              {employeeId && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Badge size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Employee ID</span>
                    <span className="font-semibold text-slate-800">{employeeId}</span>
                  </div>
                </div>
              )}
              {specialization && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Wrench size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Specialization</span>
                    <span className="font-semibold text-slate-800">{specialization}</span>
                  </div>
                </div>
              )}
              {joinedDate && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Joined</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(joinedDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Account Status</span>
                  <span className="font-semibold text-emerald-700">Active</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
