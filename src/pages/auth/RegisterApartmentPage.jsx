/**
 * RegisterApartmentPage.jsx
 *
 * Apartment community registration request form.
 *
 * - Submits to POST /auth/register-apartment.
 * - Does NOT auto-grant admin privileges — the registration is a pending request.
 * - Cannot register as SUPER_ADMIN (role is server-assigned).
 * - Preserves form data on recoverable errors; clears passwords on any error.
 * - Shows a success screen only after genuine backend confirmation.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { registerApartment } from '../../api/authApi';
import { ROUTES, APP_NAME } from '../../constants';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const PHONE_RE = /^[+]?[\d\s\-().]{7,15}$/;
const POSTAL_RE = /^\d{4,10}$/;

const registerSchema = z
  .object({
    // Apartment
    apartmentName: z.string().min(2, 'Community name must be at least 2 characters.').max(120),
    addressLine: z.string().min(5, 'Address is required.').max(200),
    city: z.string().min(2, 'City is required.').max(100),
    state: z.string().min(2, 'State is required.').max(100),
    postalCode: z.string().regex(POSTAL_RE, 'Enter a valid postal code (digits only).'),
    contactPhone: z.string().regex(PHONE_RE, 'Enter a valid contact phone number.'),
    contactEmail: z.string().email('Enter a valid contact email.'),

    // Admin
    adminName: z.string().min(2, 'Administrator name is required.').max(120),
    adminEmail: z.string().email('Enter a valid email address.'),
    adminPhone: z.string().regex(PHONE_RE, 'Enter a valid phone number.'),

    // Credentials
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
// Field component
// ---------------------------------------------------------------------------
function Field({ id, label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}{' '}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({ id, error, register, disabled, type = 'text', placeholder, autoComplete }) {
  return (
    <input
      id={id}
      type={type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      disabled={disabled}
      className={[
        'w-full h-9 px-3 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors',
        'disabled:bg-slate-50 disabled:cursor-not-allowed',
        error ? 'border-red-400' : 'border-slate-200',
      ].join(' ')}
      {...register}
    />
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeading({ children }) {
  return (
    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
      <ChevronRight size={14} className="text-sky-500" aria-hidden="true" />
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------
function SuccessScreen({ message }) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Registration Submitted!</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            {message ||
              'Your apartment community registration request has been submitted and is pending approval. You will receive an email once your account is activated.'}
          </p>
        </div>
        <Link
          to={ROUTES.LOGIN}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function RegisterApartmentPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      apartmentName: '',
      addressLine: '',
      city: '',
      state: '',
      postalCode: '',
      contactPhone: '',
      contactEmail: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const { message } = await registerApartment(values);
      setSuccessMessage(message);
    } catch (err) {
      // Clear passwords on error — never preserve them
      setValue('password', '');
      setValue('confirmPassword', '');

      const msg = err.message ?? '';
      if (err.status === 409 || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
        setServerError('An account with this email address already exists. Please sign in or use a different email.');
      } else if (!navigator.onLine || err.status == null) {
        setServerError('Unable to reach the server. Please check your connection and try again.');
      } else {
        setServerError(msg || 'Registration failed. Please review your details and try again.');
      }
    }
  };

  if (successMessage !== null) {
    return <SuccessScreen message={successMessage} />;
  }

  const disabled = isSubmitting;

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">{APP_NAME}</h1>
            <p className="text-xs text-slate-400">Register Your Apartment Community</p>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-800">New Community Registration</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Submit your apartment details for approval. An administrator will review and
              activate your account.
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-6 text-sm text-red-700"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          <form
            id="register-apt-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-7"
          >
            {/* ── Apartment Information ── */}
            <section aria-labelledby="apt-info-heading">
              <SectionHeading id="apt-info-heading">Apartment / Community Information</SectionHeading>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field id="apartmentName" label="Community Name" required error={errors.apartmentName?.message}>
                    <TextInput
                      id="apartmentName"
                      error={errors.apartmentName}
                      register={register('apartmentName')}
                      disabled={disabled}
                      placeholder="e.g. Sunrise Garden Apartments"
                      autoComplete="organization"
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field id="addressLine" label="Address" required error={errors.addressLine?.message}>
                    <TextInput
                      id="addressLine"
                      error={errors.addressLine}
                      register={register('addressLine')}
                      disabled={disabled}
                      placeholder="Street address"
                      autoComplete="street-address"
                    />
                  </Field>
                </div>

                <Field id="city" label="City" required error={errors.city?.message}>
                  <TextInput
                    id="city"
                    error={errors.city}
                    register={register('city')}
                    disabled={disabled}
                    placeholder="City"
                    autoComplete="address-level2"
                  />
                </Field>

                <Field id="state" label="State / Province" required error={errors.state?.message}>
                  <TextInput
                    id="state"
                    error={errors.state}
                    register={register('state')}
                    disabled={disabled}
                    placeholder="State"
                    autoComplete="address-level1"
                  />
                </Field>

                <Field id="postalCode" label="Postal Code" required error={errors.postalCode?.message}>
                  <TextInput
                    id="postalCode"
                    error={errors.postalCode}
                    register={register('postalCode')}
                    disabled={disabled}
                    placeholder="e.g. 400001"
                    autoComplete="postal-code"
                  />
                </Field>

                <Field id="contactPhone" label="Contact Phone" required error={errors.contactPhone?.message}>
                  <TextInput
                    id="contactPhone"
                    type="tel"
                    error={errors.contactPhone}
                    register={register('contactPhone')}
                    disabled={disabled}
                    placeholder="+91 98765 43210"
                    autoComplete="tel"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field id="contactEmail" label="Contact Email" required error={errors.contactEmail?.message}>
                    <TextInput
                      id="contactEmail"
                      type="email"
                      error={errors.contactEmail}
                      register={register('contactEmail')}
                      disabled={disabled}
                      placeholder="office@yourapartment.com"
                      autoComplete="email"
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* ── Administrator Contact ── */}
            <section aria-labelledby="admin-info-heading">
              <SectionHeading id="admin-info-heading">Primary Administrator Contact</SectionHeading>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field id="adminName" label="Full Name" required error={errors.adminName?.message}>
                    <TextInput
                      id="adminName"
                      error={errors.adminName}
                      register={register('adminName')}
                      disabled={disabled}
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                  </Field>
                </div>

                <Field id="adminEmail" label="Email Address" required error={errors.adminEmail?.message}>
                  <TextInput
                    id="adminEmail"
                    type="email"
                    error={errors.adminEmail}
                    register={register('adminEmail')}
                    disabled={disabled}
                    placeholder="admin@yourapartment.com"
                    autoComplete="email"
                  />
                </Field>

                <Field id="adminPhone" label="Phone Number" required error={errors.adminPhone?.message}>
                  <TextInput
                    id="adminPhone"
                    type="tel"
                    error={errors.adminPhone}
                    register={register('adminPhone')}
                    disabled={disabled}
                    placeholder="+91 98765 43210"
                    autoComplete="tel"
                  />
                </Field>
              </div>
            </section>

            {/* ── Account Credentials ── */}
            <section aria-labelledby="creds-heading">
              <SectionHeading id="creds-heading">Account Credentials</SectionHeading>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="password" label="Password" required error={errors.password?.message}>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      disabled={disabled}
                      className={[
                        'w-full h-9 pl-3 pr-10 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
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
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>

                <Field id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword?.message}>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      aria-invalid={Boolean(errors.confirmPassword)}
                      aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                      disabled={disabled}
                      className={[
                        'w-full h-9 pl-3 pr-10 rounded-lg border text-sm text-slate-900 placeholder-slate-400',
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
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Minimum 8 characters, at least one uppercase letter and one number.
              </p>
            </section>

            {/* Submit */}
            <button
              type="submit"
              form="register-apt-form"
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
                  Submitting Registration…
                </>
              ) : (
                'Submit Registration Request'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link
              to={ROUTES.LOGIN}
              className="text-sky-600 font-medium hover:text-sky-700 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
