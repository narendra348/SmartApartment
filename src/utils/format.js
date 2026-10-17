/**
 * Safely display a value — returns a fallback string if the value is null, undefined, or empty.
 * @param {*} value
 * @param {string} [fallback='—']
 * @returns {string|*}
 */
export function display(value, fallback = '—') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  return value;
}

/**
 * Truncate a string to a given length, appending an ellipsis.
 */
export function truncate(str, maxLength = 60) {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}

/**
 * Capitalise the first letter of a string.
 */
export function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a snake_case or kebab-case string to Title Case.
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
