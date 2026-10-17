/**
 * Format a number as Indian Rupees.
 * @param {number} amount - The amount in rupees.
 * @param {object} [options] - Intl.NumberFormat options overrides.
 * @returns {string}
 */
export function formatCurrency(amount, options = {}) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/**
 * Format a number as compact Indian Rupees (e.g. ₹1.2L).
 */
export function formatCurrencyCompact(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}
