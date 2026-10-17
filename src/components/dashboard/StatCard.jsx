/**
 * StatCard
 * Standard KPI card used across dashboards.
 * Clean, restrained SaaS design adhering to navy/slate palette.
 */
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = 'neutral', // 'positive' | 'negative' | 'neutral'
  color = 'blue', // 'blue' | 'emerald' | 'amber' | 'violet' | 'slate'
  loading = false,
  onClick,
}) {
  const colorStyles = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
    },
    violet: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100',
    },
    slate: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
    },
  };

  const style = colorStyles[color] || colorStyles.blue;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="w-10 h-10 rounded-lg bg-slate-200" />
        </div>
        <div className="h-7 bg-slate-200 rounded w-16 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-32" />
      </div>
    );
  }

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm transition-all duration-200 text-left ${
        onClick ? 'hover:border-slate-300 hover:shadow cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}
          >
            <Icon size={20} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              trendType === 'positive'
                ? 'bg-emerald-50 text-emerald-700'
                : trendType === 'negative'
                ? 'bg-red-50 text-red-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 truncate">{subtitle}</p>
      )}
    </Wrapper>
  );
}

export default StatCard;
