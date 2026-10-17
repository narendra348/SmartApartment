import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Home,
  Building2,
  Save,
  CheckCircle2,
  Calendar,
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

export default function ResidentProfilePage() {
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

    getProfile('resident')
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
        'resident',
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

  const flatNumber =
    profileMeta?.flatNumber ||
    profileMeta?.flat?.number ||
    user?.flatNumber ||
    null;

  const buildingName =
    profileMeta?.buildingName ||
    profileMeta?.building?.name ||
    user?.buildingName ||
    null;

  const joinedDate =
    profileMeta?.createdAt || profileMeta?.registeredAt || user?.createdAt || null;

  const initial = (formData.name || formData.email || 'R').charAt(0).toUpperCase();

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
        subtitle="Manage your personal information and account security"
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
                  Update your contact details used for notifications and communication
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name"
                required
                placeholder="e.g. Jane Doe"
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
                  placeholder="resident@email.com"
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

        {/* Right Column: Read-only Residency Info */}
        <div className="space-y-6">
          {/* Avatar card */}
          <Card className="p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-sky-600 text-white flex items-center justify-center text-2xl font-bold shadow-md mb-3">
              {initial}
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">
              {formData.name || 'Resident'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-full">{formData.email}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 size={13} />
              <span>Active Resident</span>
            </div>
          </Card>

          {/* Residency details */}
          <Card className="p-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Residency Details
            </h4>
            <div className="space-y-3 text-sm">
              {flatNumber && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Home size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Flat Number</span>
                    <span className="font-semibold text-slate-800">{flatNumber}</span>
                  </div>
                </div>
              )}
              {buildingName && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Building2 size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Building</span>
                    <span className="font-semibold text-slate-800">{buildingName}</span>
                  </div>
                </div>
              )}
              {joinedDate && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400 block mb-0.5">Member Since</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(joinedDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
              {!flatNumber && !buildingName && !joinedDate && (
                <p className="text-xs text-slate-400 italic">
                  Residency details are managed by your apartment administrator.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
