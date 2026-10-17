const STATUS_CONFIG = {
  // Generic
  active:       { label: 'Active',        className: 'bg-green-100 text-green-700' },
  inactive:     { label: 'Inactive',      className: 'bg-slate-100 text-slate-600' },

  // Maintenance
  pending:      { label: 'Pending',       className: 'bg-amber-100 text-amber-700' },
  in_progress:  { label: 'In Progress',   className: 'bg-sky-100 text-sky-700' },
  resolved:     { label: 'Resolved',      className: 'bg-green-100 text-green-700' },
  closed:       { label: 'Closed',        className: 'bg-slate-100 text-slate-600' },
  cancelled:    { label: 'Cancelled',     className: 'bg-red-100 text-red-600' },

  // Billing
  paid:          { label: 'Paid',          className: 'bg-green-100 text-green-700' },
  overdue:       { label: 'Overdue',       className: 'bg-red-100 text-red-600' },
  partially_paid:{ label: 'Partial',       className: 'bg-amber-100 text-amber-700' },

  // Apartments / Applications
  approved:     { label: 'Approved',      className: 'bg-emerald-100 text-emerald-700' },
  rejected:     { label: 'Rejected',      className: 'bg-rose-100 text-rose-700' },

  // Occupancy
  occupied:     { label: 'Occupied',      className: 'bg-emerald-100 text-emerald-700' },
  vacant:       { label: 'Vacant',        className: 'bg-sky-100 text-sky-700' },
  reserved:     { label: 'Reserved',      className: 'bg-amber-100 text-amber-700' },
  under_maintenance: { label: 'Maintenance', className: 'bg-purple-100 text-purple-700' },

  // Users & Invitations
  verified:     { label: 'Verified',      className: 'bg-green-100 text-green-700' },
  unverified:   { label: 'Unverified',    className: 'bg-amber-100 text-amber-700' },
  suspended:    { label: 'Suspended',     className: 'bg-red-100 text-red-600' },
  invited:      { label: 'Invited',       className: 'bg-indigo-100 text-indigo-700' },
  accepted:     { label: 'Accepted',      className: 'bg-emerald-100 text-emerald-700' },
  expired:      { label: 'Expired',       className: 'bg-slate-100 text-slate-500' },
  revoked:      { label: 'Revoked',       className: 'bg-rose-100 text-rose-700' },
};

function StatusBadge({ status, label: labelOverride, className = '' }) {
  const normKey = (status || '').toLowerCase().replace(/-/g, '_');
  const config = STATUS_CONFIG[normKey] ?? {
    label: labelOverride ?? status ?? 'Unknown',
    className: 'bg-slate-100 text-slate-600',
  };

  const displayLabel = labelOverride ?? config.label;

  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
