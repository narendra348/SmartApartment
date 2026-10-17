import { forwardRef, isValidElement, createElement } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANT_CLASSES = {
  primary:
    'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 focus-visible:ring-sky-500',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
  ghost:
    'text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400',
  link:
    'text-sky-600 underline-offset-4 hover:underline focus-visible:ring-sky-500',
};

const SIZE_CLASSES = {
  xs: 'h-7 px-2.5 text-xs gap-1',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2',
};

const ICON_SIZES = {
  xs: 12,
  sm: 14,
  md: 15,
  lg: 16,
};

function renderButtonIcon(icon, size) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  const iconSize = ICON_SIZES[size] ?? 15;
  return createElement(icon, { size: iconSize, 'aria-hidden': true, className: 'shrink-0' });
}

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    iconLeft = null,
    iconRight = null,
    fullWidth = false,
    className = '',
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={[
        'inline-flex items-center justify-center font-medium rounded-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <Loader2 className="animate-spin shrink-0" size={14} aria-hidden="true" />
      ) : (
        renderButtonIcon(iconLeft, size)
      )}
      {children}
      {!loading && renderButtonIcon(iconRight, size)}
    </button>
  );
});

export default Button;
