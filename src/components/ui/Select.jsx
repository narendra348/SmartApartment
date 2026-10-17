import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

const Select = forwardRef(function Select(
  {
    id,
    label,
    helperText,
    error,
    required = false,
    disabled = false,
    placeholder = 'Select…',
    options = [],
    className = '',
    containerClassName = '',
    ...rest
  },
  ref,
) {
  const selectId = id || rest.name;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            hasError
              ? `${selectId}-error`
              : helperText
              ? `${selectId}-helper`
              : undefined
          }
          className={[
            'w-full appearance-none rounded-md border bg-white text-sm text-slate-900',
            'pl-3 pr-8 py-2 h-9',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
            'transition-colors duration-150',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            hasError
              ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
              : 'border-slate-200',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {hasError && (
        <p id={`${selectId}-error`} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${selectId}-helper`} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

export default Select;
