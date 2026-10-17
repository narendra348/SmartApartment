import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);

    if (left > 1) {
      pages.push(1);
      if (left > 2) pages.push('...');
    }
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages) {
      if (right < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  const btnBase =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
  const btnActive = 'bg-sky-600 text-white pointer-events-none';
  const btnInactive = 'text-slate-600 hover:bg-slate-100';
  const btnDisabled = 'text-slate-300 cursor-not-allowed';

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center gap-1 ${className}`}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={`${btnBase} ${page === 1 ? btnDisabled : btnInactive}`}
      >
        <ChevronLeft size={15} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={`${btnBase} text-slate-400 cursor-default`}>
            <MoreHorizontal size={14} />
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={`${btnBase} ${page === totalPages ? btnDisabled : btnInactive}`}
      >
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}

export default Pagination;
