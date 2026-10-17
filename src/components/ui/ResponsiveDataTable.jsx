import { useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { PageLoader } from './LoadingSpinner';
import { EmptyState, ErrorState } from './StateViews';
import Pagination from './Pagination';

/**
 * ResponsiveDataTable
 *
 * @param {object[]} columns - [{ key, header, render?, sortable?, width?, align? }]
 * @param {object[]} data    - Row data objects
 * @param {string}   keyField - Field used as the React key (default: 'id')
 * @param {boolean}  loading
 * @param {string}   error
 * @param {string}   sortBy
 * @param {'asc'|'desc'} sortDir
 * @param {function} onSort(key)
 * @param {number}   page
 * @param {number}   totalPages
 * @param {function} onPageChange(page)
 * @param {number}   totalItems
 * @param {number}   pageSize
 * @param {object}   emptyState   - Props forwarded to <EmptyState>
 */
function ResponsiveDataTable({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  error = null,
  sortBy = null,
  sortDir = 'asc',
  onSort = null,
  page = 1,
  totalPages = 1,
  onPageChange = null,
  totalItems = null,
  pageSize = null,
  emptyState = {},
  className = '',
}) {
  const tableRef = useRef(null);

  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollLeft = 0;
    }
  }, [page]);

  const renderSortIcon = (col) => {
    if (!col.sortable || !onSort) return null;
    if (sortBy !== col.key) {
      return <ChevronsUpDown size={13} className="text-slate-400 shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ChevronUp size={13} className="text-sky-600 shrink-0" />
    ) : (
      <ChevronDown size={13} className="text-sky-600 shrink-0" />
    );
  };

  const alignClass = (align) => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  if (error) {
    return (
      <ErrorState
        description={error}
        onRetry={undefined}
      />
    );
  }

  if (loading) {
    return <PageLoader message="Loading data…" />;
  }

  if (!data.length) {
    return <EmptyState {...emptyState} />;
  }

  const start = totalItems != null && pageSize != null ? (page - 1) * pageSize + 1 : null;
  const end =
    start != null ? Math.min(start + (data.length - 1), totalItems) : null;

  return (
    <div className={className}>
      {/* Scrollable table wrapper */}
      <div ref={tableRef} className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={[
                    'px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap',
                    alignClass(col.align),
                    col.sortable && onSort
                      ? 'cursor-pointer select-none hover:text-slate-800 transition-colors'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  aria-sort={
                    sortBy === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {renderSortIcon(col)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={row[keyField] ?? idx}
                className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-slate-700 ${alignClass(col.align)}`}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: count + pagination */}
      {(totalItems != null || (totalPages != null && totalPages > 1)) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-slate-100 flex-wrap">
          <p className="text-xs text-slate-500">
            {start != null && end != null
              ? `Showing ${start}–${end} of ${totalItems} results`
              : `Page ${page} of ${totalPages}`}
          </p>
          {onPageChange && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default ResponsiveDataTable;
