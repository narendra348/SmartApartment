/**
 * AcceptInvitationPage.jsx
 *
 * Page for residents and staff to accept their invitation and set a password.
 *
 * - Reads the invitation token from `?token=...` URL query parameter.
 * - Submits to POST /auth/accept-invitation.
 * - Does NOT log or expose the token.
 * - Handles expired, invalid, or already-used invitations clearly.
 * - Redirects to /login after success (backend must explicitly grant a session
 *   for an automatic login; otherwise we show a success screen and link to login).
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  MailOpen,
  ShieldAlert,
} from 'lucide-react';
import { acceptInvitation } from '../../api/authApi';
import { ROUTES, APP_NAME } from '../../constants';
import { useAuth } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const invitationSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
      .regex(/[0-9]/, 'Password must include at least one number.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

// ---------------------------------------------------------------------------
// Missing token screen
// ---------------------------------------------------------------------------
function MissingTokenScreen() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <ShieldAlert size={26} className="text-amber-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-800">Invalid Invitation Link</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            This invitation link is missing a required token. Please check your email for the
            original invitation link and try again.
          </p>
        </div>
        <Link
          to={ROUTES.LOGIN}
          className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------
function SuccessScreen({ message, autoLoggedIn }) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-800">
            {autoLoggedIn ? 'Welcome aboard!' : 'Invitation Accepted!'}
          </h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            {message ||
              'Your account has been activated. You can now sign in with your email and the password you just set.'}
          </p>
        </div>
        <Link
          to={ROUTES.LOGIN}
          className="inline-flex items-center justify-center h-9 px-5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getDashboardRoute } = useAuth();

  // Read token from query string — never expose it in logs or UI
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [successState, setSuccessState] = useState(null); // { message, autoLoggedIn }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(invitationSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Guard: token is required
  if (!token) {
    return <MissingTokenScreen />;
  }

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      // Token is sent to the backend but never echoed in the UI or logs.
      const { message, user } = await acceptInvitation({
        token,
        password: values.password,
      });

      if (user) {
        // Backend returned a user → session established; redirect to dashboard.
        // (Only do this if the backend explicitly creates a session on invitation acceptance.)
        setSuccessState({ message, autoLoggedIn: true });
        // Small delay so the success screen is visible before redirect
        setTimeout(() => navigate(getDashboardRoute(user.role), { replace: true }), 1500);
      } else {
        // No session returned — show success and prompt user to log in.
        setSuccessState({ message, autoLoggedIn: false });
      }
    } catch (err) {
      // Clear passwords on any error
      setValue('password', '');
      setValue('confirmPassword', '');

      const msg = err.message ?? '';
      if (
        err.status === 410 ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('invalid token') ||
        msg.toLowerCase().includes('used')
      ) {
        setServerError(
          'This invitation link has expired or has already been used. Please contact your administrator for a new invitation.',
        );
      } else if (!navigator.onLine || err.status == null) {
        setServerError('Unable to reach the server. Please check your connection and try again.');
      } else {
        setServerError(msg || 'Could not accept the invitation. Please try again or contact support.');
      }
    }
  };

  if (successState) {
    return <SuccessScreen message={successState.message} autoLoggedIn={successState.autoLoggedIn} />;
  }

  const disabled = isSubmitting;

  return (
    <div className="w-full max-w-[420px]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-8 py-7 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg">
            <MailOpen size={20} className="text-white" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-white">{APP_NAME}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Accept Your Invitation</p>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-800">Set Your Password</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Create a secure password to activate your account.
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-5 text-sm text-red-700"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          <form
            id="accept-invitation-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {/* New password */}
            <div className="flex flex-col gap-1">
              <label htmlFor="inv-password" className="text-sm font-medium text-slate-700">
                New Password <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="inv-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'inv-password-error' : undefined}
                  disabled={disabled}
                  className={[
                    'w-full h-10 pl-3 pr-10 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors',
                    'disabled:bg-slate-50 disabled:cursor-not-allowed',
                    errors.password ? 'border-red-400' : 'border-slate-200',
                  ].join(' ')}
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p id="inv-password-error" className="text-xs text-red-500" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1">
              <label htmlFor="inv-confirm-password" className="text-sm font-medium text-slate-700">
                Confirm Password <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="inv-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'inv-confirm-password-error' : undefined}
                  disabled={disabled}
                  className={[
                    'w-full h-10 pl-3 pr-10 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors',
                    'disabled:bg-slate-50 disabled:cursor-not-allowed',
                    errors.confirmPassword ? 'border-red-400' : 'border-slate-200',
                  ].join(' ')}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p id="inv-confirm-password-error" className="text-xs text-red-500" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <p className="text-xs text-slate-400">
              Minimum 8 characters with at least one uppercase letter and one number.
            </p>

            {/* Submit */}
            <button
              type="submit"
              form="accept-invitation-form"
              disabled={disabled}
              aria-busy={isSubmitting}
              className={[
                'w-full h-10 flex items-center justify-center gap-2',
                'bg-sky-600 hover:bg-sky-700 active:bg-sky-800',
                'text-white text-sm font-medium rounded-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                'transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Activating Account…
                </>
              ) : (
                'Activate My Account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            <Link
              to={ROUTES.LOGIN}
              className="text-sky-600 font-medium hover:text-sky-700 hover:underline transition-colors"
            >
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
