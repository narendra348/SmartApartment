/**
 * profileApi.js
 *
 * Dedicated API service for User Profiles & Account Security:
 * - Fetching profile details across roles (Admin, Resident, Staff, Super Admin)
 * - Updating personal profile details (Name, Phone, Contact preferences)
 * - Changing password with verification
 *
 * Connects directly to backend endpoints using the centralized Axios client.
 * Does not store passwords or tokens in browser storage.
 */

import client from './client';

/**
 * Fetch profile details for the authenticated user.
 *
 * @param {'admin'|'resident'|'staff'|'super_admin'} [role]
 * @returns {Promise<object>}
 */
export async function getProfile(role) {
  let roleEndpoint = '/auth/me';
  if (role === 'admin' || role === 'apartment_admin') roleEndpoint = '/admin/profile';
  else if (role === 'resident') roleEndpoint = '/resident/profile';
  else if (role === 'staff' || role === 'maintenance_staff') roleEndpoint = '/staff/profile';
  else if (role === 'super_admin') roleEndpoint = '/super-admin/profile';

  try {
    const response = await client.get(roleEndpoint);
    return (
      response.data?.data?.user ??
      response.data?.data?.profile ??
      response.data?.data ??
      response.data?.user ??
      response.data
    );
  } catch (err) {
    // If role-specific endpoint is 404, fallback to /auth/me
    if (err.response?.status === 404 && roleEndpoint !== '/auth/me') {
      const meRes = await client.get('/auth/me');
      return (
        meRes.data?.data?.user ??
        meRes.data?.data?.profile ??
        meRes.data?.data ??
        meRes.data?.user ??
        meRes.data
      );
    }
    throw err;
  }
}

/**
 * Update personal profile information.
 * Only sends editable fields supported by the backend (name, phone, etc.).
 * Protected fields like role or apartment ID are never mutated here.
 *
 * @param {object} payload - { name, phone, email }
 * @param {'admin'|'resident'|'staff'|'super_admin'} [role]
 * @returns {Promise<object>}
 */
export async function updateProfile(payload, role) {
  let roleEndpoint = '/auth/profile';
  if (role === 'admin' || role === 'apartment_admin') roleEndpoint = '/admin/profile';
  else if (role === 'resident') roleEndpoint = '/resident/profile';
  else if (role === 'staff' || role === 'maintenance_staff') roleEndpoint = '/staff/profile';
  else if (role === 'super_admin') roleEndpoint = '/super-admin/profile';

  try {
    const response = await client.put(roleEndpoint, payload);
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      try {
        const patchRes = await client.patch(roleEndpoint, payload);
        return patchRes.data?.data ?? patchRes.data;
      } catch {
        const authRes = await client.put('/auth/profile', payload);
        return authRes.data?.data ?? authRes.data;
      }
    }
    throw err;
  }
}

/**
 * Change account password.
 *
 * @param {{ currentPassword: string, newPassword: string }} credentials
 * @returns {Promise<object>}
 */
export async function changePassword({ currentPassword, newPassword }) {
  const payload = { currentPassword, newPassword };

  try {
    const response = await client.post('/auth/change-password', payload);
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      try {
        const putRes = await client.put('/auth/password', payload);
        return putRes.data?.data ?? putRes.data;
      } catch {
        const postRes = await client.post('/auth/password/change', payload);
        return postRes.data?.data ?? postRes.data;
      }
    }
    throw err;
  }
}
