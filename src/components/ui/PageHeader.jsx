import Breadcrumbs from './Breadcrumbs';

/**
 * PageHeader
 *
 * @param {string}  title       - Page title (rendered as h1)
 * @param {string}  [subtitle]  - Optional description below title
 * @param {Array}   [breadcrumbs] - [{label, href?}]
 * @param {ReactNode} [actions] - Buttons / controls placed in the top-right
 * @param {string}  [className]
 */
function PageHeader({ title, subtitle, breadcrumbs, actions, className = '' }) {
  return (
    <div className={`mb-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} className="mb-2" />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
