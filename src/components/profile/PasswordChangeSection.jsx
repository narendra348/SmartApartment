import { useState } from 'react';
import { Lock, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { changePassword } from '../../api/profileApi';

export default function PasswordChangeSection() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.currentPassword) {
      errs.currentPassword = 'Current password is required';
    }
    if (!form.newPassword) {
      errs.newPassword = 'New password is required';
    } else if (form.newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters long';
    }
    if (form.newPassword && form.newPassword === form.currentPassword) {
      errs.newPassword = 'New password cannot be the same as current password';
    }
    if (form.confirmPassword !== form.newPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;

    setSaving(true);
    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      toast.success('Password changed successfully!');
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setErrors({});
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to change password. Please verify your current password.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <Lock size={20} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Account Security</h3>
          <p className="text-xs text-slate-500">
            Update your authentication password to maintain account security
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <Input
          label="Current Password"
          type="password"
          required
          placeholder="••••••••"
          value={form.currentPassword}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, currentPassword: e.target.value }));
            if (errors.currentPassword) {
              setErrors((prev) => ({ ...prev, currentPassword: null }));
            }
          }}
          error={errors.currentPassword}
          disabled={saving}
          autoComplete="current-password"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="New Password"
            type="password"
            required
            placeholder="At least 8 characters"
            value={form.newPassword}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, newPassword: e.target.value }));
              if (errors.newPassword) {
                setErrors((prev) => ({ ...prev, newPassword: null }));
              }
            }}
            error={errors.newPassword}
            disabled={saving}
            autoComplete="new-password"
            helperText="Min. 8 characters"
          />

          <Input
            label="Confirm New Password"
            type="password"
            required
            placeholder="Repeat new password"
            value={form.confirmPassword}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: null }));
              }
            }}
            error={errors.confirmPassword}
            disabled={saving}
            autoComplete="new-password"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            loading={saving}
            iconLeft={Check}
          >
            Update Password
          </Button>
        </div>
      </form>
    </Card>
  );
}
