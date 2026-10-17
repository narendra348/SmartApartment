import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Building,
  Save,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import PasswordChangeSection from '../../../components/profile/PasswordChangeSection';
import { useAuth } from '../../../context/AuthContext';
import { getProfile, updateProfile } from '../../../api/profileApi';

export default function AdminProfilePage() {
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

    getProfile('admin')
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
        'admin',
      );

      toast.success('Profile details updated successfully!');
      if (refreshUser) await refreshUser();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const apartmentName =
    profileMeta?.apartmentName ||
    profileMeta?.apartment?.name ||
    user?.apartmentName ||
    'Smart Apartment Community';

  const roleTitle = 'Apartment Administrator';

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Administrator Profile" />
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200">
          <PageLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administrator Profile"
        subtitle="Manage your contact details, security credentials, and building administration preferences"
        icon={<User size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editable Profile Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Personal Information</h3>
                <p className="text-xs text-slate-500">
                  Update your contact details visible to staff and system notifications
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                required
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                }}
                error={errors.name}
                disabled={saving}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  required
                  placeholder="admin@smartapartment.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, email: e.target.value }));
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  error={errors.email}
                  disabled={saving}
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
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  iconLeft={Save}
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Account Security (Password Change) */}
          <PasswordChangeSection />
        </div>

        {/* Right Column: Protected Authorization Info */}
        <div className="space-y-6">
          <Card className="p-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield size={16} />
              Authorization & Role
            </h4>

            <div className="space-y-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-400 block mb-0.5">Assigned Role</span>
                <span className="font-semibold text-slate-800">{roleTitle}</span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Full administrative permissions for resident billing, complaints, and facility rules.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-400 block mb-0.5">Apartment Community</span>
                <span className="font-semibold text-slate-800">{apartmentName}</span>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Tenant Isolation: Authorized only within this apartment domain.
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-400 block mb-0.5">Account Status</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-xs mt-0.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Active Administrator
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
