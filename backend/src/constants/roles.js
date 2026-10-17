/**
 * roles.js
 *
 * System-wide user role constants and validation arrays.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  APARTMENT_ADMIN: 'APARTMENT_ADMIN',
  RESIDENT: 'RESIDENT',
  MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export default ROLES;
