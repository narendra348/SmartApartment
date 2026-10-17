const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a date string or Date object for display.
 * @param {string|Date} date
 * @param {object} [options] - Intl.DateTimeFormat options overrides.
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  if (!date) return '—';

  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: IST_TIMEZONE,
      ...options,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Format a date with time.
 */
export function formatDateTime(date, options = {}) {
  if (!date) return '—';

  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: IST_TIMEZONE,
      ...options,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Format a date as a relative time string (e.g. "2 days ago").
 */
export function formatRelativeTime(date) {
  if (!date) return '—';

  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';

    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;

    return formatDate(date);
  } catch {
    return '—';
  }
}

/**
 * Format a month and year from a date.
 */
export function formatMonthYear(date) {
  if (!date) return '—';

  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: IST_TIMEZONE,
    }).format(d);
  } catch {
    return '—';
  }
}
