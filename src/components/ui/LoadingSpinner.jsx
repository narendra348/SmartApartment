import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 20, className = '' }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-sky-600 ${className}`}
      aria-label="Loading"
      role="status"
    />
  );
}

export function PageLoader({ message = 'Loading…' }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-64 gap-3 text-slate-500"
      role="status"
      aria-label={message}
    >
      <LoadingSpinner size={32} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
