/**
 * accountStatus.js
 *
 * System-wide user account status constants and validation arrays.
 */

export const ACCOUNT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
});

export const ACCOUNT_STATUS_VALUES = Object.freeze(Object.values(ACCOUNT_STATUS));

export default ACCOUNT_STATUS;
