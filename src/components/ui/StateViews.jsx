import { Inbox, AlertCircle } from 'lucide-react';
import Button from './Button';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No data found',
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-400">
        <Icon size={24} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {action && (
        <Button
          variant={action.variant ?? 'primary'}
          size="sm"
          onClick={action.onClick}
          iconLeft={action.icon}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading data. Please try again.',
  onRetry,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 text-red-500">
        <AlertCircle size={24} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
