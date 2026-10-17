import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * @param {Array<{label: string, href?: string}>} items
 */
function Breadcrumbs({ items = [], className = '' }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center flex-wrap gap-1 ${className}`}>
      <ol className="flex items-center flex-wrap gap-1 list-none m-0 p-0">
        <li className="flex items-center">
          <Link
            to="/"
            aria-label="Home"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Home size={13} />
          </Link>
        </li>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1">
              <ChevronRight size={12} className="text-slate-300" aria-hidden="true" />
              {isLast || !item.href ? (
                <span
                  className={`text-xs font-medium ${
                    isLast ? 'text-slate-700' : 'text-slate-400'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
