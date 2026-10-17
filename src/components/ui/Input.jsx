import { forwardRef, isValidElement, createElement } from 'react';

/**
 * Input component with optional icon adornments.
 *
 * Props:
 *   iconLeft  — lucide-react component reference (e.g. iconLeft={User}) or JSX element
 *   iconRight — same, for the right side
 *   prefix    — text string shown inside the left of the input (superseded by iconLeft)
 *   suffix    — text string shown inside the right of the input (superseded by iconRight)
 */
const Input = forwardRef(function Input(
  {
    id,
    label,
    helperText,
    error,
    required = false,
    disabled = false,
    className = '',
    containerClassName = '',
    prefix = null,
    suffix = null,
    iconLeft = null,
    iconRight = null,
    ...rest
  },
  ref,
) {
  const inputId = id || rest.name;
  const hasError = Boolean(error);

  /**
   * Render an icon that may be:
   *   - A Lucide component reference (e.g. User) -> instantiate via createElement
   *   - A JSX element -> render as-is
   */
  function renderIcon(icon, side) {
    if (!icon) return null;
    const posClass =
      side === 'left'
        ? 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none'
        : 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none';
    const element = isValidElement(icon)
      ? icon
      : createElement(icon, { size: 15, 'aria-hidden': true });
    return <span className={posClass}>{element}</span>;
  }

  const hasLeftAdornment = Boolean(iconLeft || prefix);
  const hasRightAdornment = Boolean(iconRight || suffix);

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Left adornment: icon takes priority over prefix text */}
        {iconLeft
          ? renderIcon(iconLeft, 'left')
          : prefix && (
              <span className="absolute left-3 text-slate-400 text-sm pointer-events-none">
                {prefix}
              </span>
            )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          className={[
            'w-full rounded-md border bg-white text-sm text-slate-900 placeholder-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
            'transition-colors duration-150',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            hasError
              ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
              : 'border-slate-200',
            hasLeftAdornment ? 'pl-8' : 'pl-3',
            hasRightAdornment ? 'pr-8' : 'pr-3',
            'py-2 h-9',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />

        {/* Right adornment: icon takes priority over suffix text */}
        {iconRight
          ? renderIcon(iconRight, 'right')
          : suffix && (
              <span className="absolute right-3 text-slate-400 text-sm pointer-events-none">
                {suffix}
              </span>
            )}
      </div>

      {hasError && (
        <p id={`${inputId}-error`} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${inputId}-helper`} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

export default Input;
