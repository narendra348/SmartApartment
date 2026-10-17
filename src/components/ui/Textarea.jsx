import { forwardRef } from 'react';

const Textarea = forwardRef(function Textarea(
  {
    id,
    label,
    helperText,
    error,
    required = false,
    disabled = false,
    rows = 4,
    className = '',
    containerClassName = '',
    ...rest
  },
  ref,
) {
  const textareaId = id || rest.name;
  const hasError = Boolean(error);

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={textareaId}
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

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={
          hasError
            ? `${textareaId}-error`
            : helperText
            ? `${textareaId}-helper`
            : undefined
        }
        className={[
          'w-full rounded-md border bg-white text-sm text-slate-900 placeholder-slate-400',
          'px-3 py-2 resize-y',
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
      />

      {hasError && (
        <p id={`${textareaId}-error`} className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${textareaId}-helper`} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

export default Textarea;
