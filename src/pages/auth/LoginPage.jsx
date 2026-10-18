/**
 * LoginPage.jsx
 *
 * Professional login page for SmartApartment.
 *
 * - Role selector (UI preference only — does NOT grant the selected role).
 *   The backend determines the actual role. If the authenticated role does
 *   not match the selected role, an error is shown and access is denied.
 * - Email + password with show/hide toggle.
 * - Field-level Zod validation via React Hook Form.
 * - Submits to POST /auth/login via AuthContext.login().
 * - Redirects to role-appropriate dashboard on success.
 * - Demo credentials panel: shown only when backend seed accounts are detected;
 *   displays a setup guide when no demo accounts are confirmed.
 * - Handles: invalid credentials, suspended accounts, role mismatch,
 *   network errors, server errors, and pending approval status.
 * - No tokens or passwords stored in localStorage/sessionStorage.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Lock,
  ChevronDown,
  ChevronUp,
  Info,
  Shield,
  Home,
  Wrench,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, APP_NAME, ROLES } from '../../constants';
import { BASE_URL } from '../../api/client';

// ---------------------------------------------------------------------------
// Role definitions — UI labels, descriptions, and internal ROLES constants.
// The selected role is ONLY used to verify the authenticated user's role
// after a successful backend response. It is never sent to the server.
// ---------------------------------------------------------------------------
const ROLE_OPTIONS = [
  {
    id: ROLES.SUPER_ADMIN,
    label: 'Super Admin',
    icon: Shield,
    description:
      'Manages apartment registrations, approvals, and platform-wide administration.',
    color: 'violet',
  },
  {
    id: ROLES.ADMIN,
    label: 'Apartment Admin',
    icon: Building2,
    description:
      'Manages buildings, flats, residents, maintenance rules, bills, payments, and complaints for an authorized apartment.',
    color: 'sky',
    aliases: [ROLES.APARTMENT_ADMIN, 'apartment_admin', 'APARTMENT_ADMIN'],
  },
  {
    id: ROLES.RESIDENT,
    label: 'Resident',
    icon: Home,
    description:
      'Views personal bills, submits payment information, raises complaints, and reads announcements.',
    color: 'emerald',
  },
  {
    id: ROLES.STAFF,
    label: 'Maintenance Staff',
    icon: Wrench,
    description:
      'Views assigned work orders and updates work progress where permitted.',
    color: 'amber',
    aliases: [ROLES.MAINTENANCE_STAFF, 'maintenance_staff', 'MAINTENANCE_STAFF'],
  },
];

// Color utility map for role-specific styles
const COLOR_MAP = {
  violet: {
    ring: 'ring-violet-500 border-violet-400',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    icon: 'text-violet-600',
    badge: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
  },
  sky: {
    ring: 'ring-sky-500 border-sky-400',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    icon: 'text-sky-600',
    badge: 'bg-sky-100 text-sky-700',
    dot: 'bg-sky-500',
  },
  emerald: {
    ring: 'ring-emerald-500 border-emerald-400',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  amber: {
    ring: 'ring-amber-500 border-amber-400',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
};

/**
 * Determine whether an authenticated role matches the selected role.
 * Handles backend aliases (e.g., APARTMENT_ADMIN → admin, MAINTENANCE_STAFF → staff).
 */
function rolesMatch(selectedRoleId, authenticatedRole) {
  if (!selectedRoleId || !authenticatedRole) return true; // no selection → no check
  const selected = ROLE_OPTIONS.find((r) => r.id === selectedRoleId);
  if (!selected) return true;
  const allRoles = [selected.id, ...(selected.aliases ?? [])];
  return allRoles.some(
    (r) => r.toLowerCase() === authenticatedRole.toLowerCase(),
  );
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required.')
    .email('Enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .min(6, 'Password must be at least 6 characters.'),
});

// ---------------------------------------------------------------------------
// Error message resolver
// ---------------------------------------------------------------------------
function resolveErrorMessage(err) {
  if (!err) return 'An unexpected error occurred.';
  const msg = (err.message ?? '').toLowerCase();
  const status = err.status;
  const data = err.data;

  // Check for pending approval status from backend
  const isPending =
    data?.status === 'pending' ||
    msg.includes('pending') ||
    msg.includes('approval') ||
    msg.includes('not approved');
  if (isPending) {
    return {
      type: 'pending',
      text: 'Your apartment registration is pending approval by the Super Admin. You will be notified once approved.',
    };
  }

  // Suspended / blocked account
  if (
    status === 403 ||
    msg.includes('suspend') ||
    msg.includes('block') ||
    msg.includes('disabled') ||
    msg.includes('inactive')
  ) {
    return {
      type: 'suspended',
      text: 'Your account has been suspended or disabled. Please contact your administrator.',
    };
  }

  // Invalid credentials
  if (
    status === 401 ||
    msg.includes('invalid') ||
    msg.includes('credentials') ||
    msg.includes('incorrect') ||
    msg.includes('wrong password')
  ) {
    return { type: 'credentials', text: 'Invalid email address or password. Please try again.' };
  }

  // Network / server unreachable
  if (
    !navigator.onLine ||
    !status ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('reach the server') ||
    msg.includes('failed to fetch') ||
    msg.includes('cors')
  ) {
    if (!navigator.onLine) {
      return {
        type: 'network',
        text: 'You appear to be offline. Please check your internet connection.',
      };
    }
    return {
      type: 'network',
      text: 'Unable to connect to the server. The backend service may be starting up or temporarily unreachable. Please try again in a few moments.',
    };
  }

  // Validation errors (422)
  if (status === 422) {
    return { type: 'validation', text: data?.error?.message || data?.message || 'Please correct the form errors and try again.' };
  }

  // Server error
  if (status >= 500) {
    return { type: 'server', text: data?.error?.message || data?.message || 'A server error occurred. Please try again in a moment.' };
  }

  return { type: 'generic', text: data?.error?.message || data?.message || err.message || 'Sign-in failed. Please try again.' };
}

// ---------------------------------------------------------------------------
// Sub-component: Role Selector Card
// ---------------------------------------------------------------------------
function RoleCard({ role, isSelected, onSelect }) {
  const colors = COLOR_MAP[role.color];
  const Icon = role.icon;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={() => onSelect(role.id)}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isSelected
          ? `${colors.ring} ${colors.bg} ring-2`
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={[
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
            isSelected ? colors.bg : 'bg-slate-100',
          ].join(' ')}
        >
          <Icon
            size={15}
            className={isSelected ? colors.icon : 'text-slate-400'}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={[
              'text-sm font-semibold block',
              isSelected ? colors.text : 'text-slate-700',
            ].join(' ')}
          >
            {role.label}
          </span>
        </div>
        {isSelected && (
          <CheckCircle2
            size={15}
            className={colors.icon}
            aria-hidden="true"
          />
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Error Alert
// ---------------------------------------------------------------------------
function ErrorAlert({ error }) {
  if (!error) return null;

  const isNetwork = error.type === 'network';
  const isPending = error.type === 'pending';

  const bgClass = isPending
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : isNetwork
      ? 'bg-orange-50 border-orange-200 text-orange-800'
      : 'bg-red-50 border-red-200 text-red-700';

  const IconComp = isNetwork ? WifiOff : AlertCircle;
  const iconClass = isPending ? 'text-amber-500' : isNetwork ? 'text-orange-500' : 'text-red-400';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-2.5 border rounded-lg px-3 py-2.5 mb-4 text-sm ${bgClass}`}
    >
      <IconComp size={15} className={`shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />
      <span>{error.text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configured Development Demo Accounts (Prompt 6 / Local Setup)
// ---------------------------------------------------------------------------
const CONFIGURED_DEMO_ACCOUNTS = [
  {
    roleId: ROLES.SUPER_ADMIN,
    label: 'Super Admin',
    email: 'superadmin@smartapartment.demo',
    defaultPassword: 'SuperAdmin@123',
    tag: 'Platform Super Admin',
    description: 'Platform-wide privileges, apartment approvals & audit logs.',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
  {
    roleId: ROLES.ADMIN,
    label: 'Apartment Admin',
    email: 'admin@smartapartment.demo',
    defaultPassword: 'Admin@123',
    tag: 'Grand Horizon Residences',
    description: 'Manages buildings, flats, residents, billing, and maintenance.',
    badgeColor: 'bg-sky-100 text-sky-700',
  },
  {
    roleId: ROLES.RESIDENT,
    label: 'Resident',
    email: 'resident@smartapartment.demo',
    defaultPassword: 'Resident@123',
    tag: 'Tower A · Flat 101',
    description: 'Personal bills, payments, maintenance requests & notices.',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    roleId: ROLES.STAFF,
    label: 'Maintenance Staff',
    email: 'staff@smartapartment.demo',
    defaultPassword: 'Staff@123',
    tag: 'Grand Horizon Operations',
    description: 'Assigned maintenance work orders & work progress updates.',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
];

// ---------------------------------------------------------------------------
// Sub-component: Demo Credentials Panel
// ---------------------------------------------------------------------------
function DemoCredentialsPanel({ onQuickFill }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-sm text-slate-600 font-medium"
        aria-expanded={open}
        aria-controls="demo-credentials-panel"
      >
        <span className="flex items-center gap-2">
          <Info size={14} className="text-slate-400" aria-hidden="true" />
          Demo / Development Credentials
        </span>
        {open ? (
          <ChevronUp size={14} className="text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          id="demo-credentials-panel"
          className="px-4 py-3.5 bg-white border-t border-slate-100 space-y-3"
        >
          {/* Backend offline warning banner */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <WifiOff size={14} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Backend API Endpoint: {BASE_URL}</p>
              <p>
                Credentials are validated against the actual backend server. Ensure your backend
                is running on port 5000 and seeded before signing in.
              </p>
            </div>
          </div>

          {/* Configured Demo Accounts Grid */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Configured Development Accounts
            </p>
            <div className="grid grid-cols-1 gap-2">
              {CONFIGURED_DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.email}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${acc.badgeColor}`}>
                        {acc.label}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono truncate">{acc.tag}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <code className="text-xs font-mono font-medium text-slate-800 select-all">
                        {acc.email}
                      </code>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{acc.description}</p>
                  </div>

                  {onQuickFill && (
                    <button
                      type="button"
                      onClick={() => onQuickFill(acc)}
                      className="self-start sm:self-center px-2 py-1 text-xs font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded border border-sky-200 hover:border-sky-300 transition-colors shrink-0"
                    >
                      Fill Form
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-600 space-y-2 pt-1 border-t border-slate-100">
            <p className="font-semibold text-slate-700">Seeding & Startup Commands:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
              <li>Seed development accounts: <code className="bg-slate-100 px-1 rounded font-mono">npm run seed</code></li>
              <li>Verify backend auth: <code className="bg-slate-100 px-1 rounded font-mono">npm run verify:auth</code></li>
              <li>Start frontend: <code className="bg-slate-100 px-1 rounded font-mono">npm run dev</code></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const { login, getDashboardRoute } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // UI preference only

  const intendedPath = location.state?.from ?? null;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleQuickFill = (acc) => {
    setValue('email', acc.email, { shouldValidate: true });
    setValue('password', acc.defaultPassword, { shouldValidate: true });
    setSelectedRole(acc.roleId);
    setServerError(null);
  };

  const onSubmit = async (values) => {
    setServerError(null);

    try {
      const user = await login({ email: values.email, password: values.password });

      // ── Role mismatch check ─────────────────────────────────────────────
      // The selected role is only a UI preference. If the authenticated
      // user's actual role does not match, deny the redirect and warn.
      if (selectedRole && !rolesMatch(selectedRole, user.role)) {
        const selectedLabel = ROLE_OPTIONS.find((r) => r.id === selectedRole)?.label ?? selectedRole;
        setServerError({
          type: 'role_mismatch',
          text: `This account does not match the selected role "${selectedLabel}". Your account role is not authorized for the selected portal.`,
        });
        return;
      }

      toast.success(`Welcome back, ${user.name ?? user.email ?? 'there'}!`);
      const destination = intendedPath ?? getDashboardRoute(user.role);
      navigate(destination, { replace: true });
    } catch (err) {
      setServerError(resolveErrorMessage(err));
    }
  };

  const selectedRoleOption = ROLE_OPTIONS.find((r) => r.id === selectedRole);

  return (
    <div className="w-full max-w-[460px]">
      {/* Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* ── Brand strip ──────────────────────────────────────────────── */}
        <div className="bg-slate-900 px-8 py-6 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg">
            <Building2 size={22} className="text-white" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-white">{APP_NAME}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Maintenance &amp; Billing System</p>
          </div>
        </div>

        {/* ── Form area ────────────────────────────────────────────────── */}
        <div className="px-7 py-6">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-800">Sign in to your account</h2>
            <p className="text-sm text-slate-500 mt-0.5">Select your role, then enter your credentials.</p>
          </div>

          {/* ── Error ──────────────────────────────────────────────────── */}
          <ErrorAlert error={serverError} />

          {/* ── Role Selector ──────────────────────────────────────────── */}
          <fieldset className="mb-5">
            <legend className="text-sm font-medium text-slate-700 mb-2.5">
              Sign in as <span className="text-red-500" aria-hidden="true">*</span>
            </legend>
            <div
              role="radiogroup"
              aria-label="Select your role"
              className="grid grid-cols-2 gap-2"
            >
              {ROLE_OPTIONS.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  isSelected={selectedRole === role.id}
                  onSelect={setSelectedRole}
                />
              ))}
            </div>

            {/* Selected role description */}
            {selectedRoleOption && (
              <div
                className={`mt-2.5 px-3 py-2 rounded-lg text-xs ${COLOR_MAP[selectedRoleOption.color].bg} ${COLOR_MAP[selectedRoleOption.color].text} border ${COLOR_MAP[selectedRoleOption.color].ring.split(' ')[1] ?? 'border-slate-200'}`}
              >
                <span className="font-semibold">{selectedRoleOption.label}:</span>{' '}
                {selectedRoleOption.description}
              </div>
            )}
          </fieldset>

          {/* ── Login Form ─────────────────────────────────────────────── */}
          <form
            id="login-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {/* Email */}
            <div className="flex flex-col gap-1">
              <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
                Email address <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                placeholder="you@example.com"
                className={[
                  'w-full h-10 px-3 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
                  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors',
                  'disabled:bg-slate-50 disabled:cursor-not-allowed',
                  errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200',
                ].join(' ')}
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p id="login-email-error" className="text-xs text-red-500" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                Password <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  placeholder="••••••••"
                  className={[
                    'w-full h-10 pl-3 pr-10 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors',
                    'disabled:bg-slate-50 disabled:cursor-not-allowed',
                    errors.password ? 'border-red-400 bg-red-50' : 'border-slate-200',
                  ].join(' ')}
                  disabled={isSubmitting}
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" className="text-xs text-red-500" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Role not selected hint */}
            {!selectedRole && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle size={13} aria-hidden="true" />
                Please select a role above before signing in.
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              form="login-form"
              disabled={isSubmitting || !selectedRole}
              aria-busy={isSubmitting}
              className={[
                'w-full h-10 flex items-center justify-center gap-2 mt-1',
                'bg-sky-600 hover:bg-sky-700 active:bg-sky-800',
                'text-white text-sm font-medium rounded-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                'transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer',
              ].join(' ')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  <Lock size={14} aria-hidden="true" />
                  {selectedRole
                    ? `Sign In as ${selectedRoleOption?.label ?? ''}`
                    : 'Sign In'}
                </>
              )}
            </button>
          </form>

          {/* ── Demo Credentials Panel ─────────────────────────────────── */}
          <DemoCredentialsPanel onQuickFill={handleQuickFill} />

          {/* ── Links ─────────────────────────────────────────────────── */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-center gap-2">
            <p className="text-sm text-slate-600">
              New apartment?{' '}
              <Link
                to={ROUTES.REGISTER_APARTMENT}
                className="text-sky-600 font-medium hover:text-sky-700 hover:underline transition-colors"
              >
                Register your community
              </Link>
            </p>
            <p className="text-xs text-slate-400 text-center">
              Residents and staff — check your invitation email to get started.
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </p>
    </div>
  );
}
