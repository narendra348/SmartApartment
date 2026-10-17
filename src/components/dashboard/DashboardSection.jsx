/**
 * DashboardSection
 * Structured card container for dashboard tables, lists, and charts.
 */
function DashboardSection({
  title,
  subtitle,
  actions,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = 'p-5',
}) {
  return (
    <section
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {(title || subtitle || actions) && (
        <div
          className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap ${headerClassName}`}
        >
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-800 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export default DashboardSection;
