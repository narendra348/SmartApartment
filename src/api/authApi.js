/**
 * authApi.js
 *
 * All authentication-related API calls go through this service.
 * Payload mapping is centralised here — components only pass domain objects.
 *
 * The backend contract assumed:
 *   POST /auth/login              → { success, message, data: { user } }
 *   POST /auth/logout             → { success, message }
 *   GET  /auth/me                 → { success, data: { user } }
 *   POST /auth/register-apartment → { success, message, data: { ... } }
 *   POST /auth/accept-invitation  → { success, message }
 *
 * The service normalises the response so callers always receive a plain user
 * object or throw a plain Error — never raw Axios internals.
 */

import client from './client';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the user object from a variety of backend response shapes.
 * Handles both { data: { user } } and { data: { ...user fields } }.
 */
function extractUser(responseData) {
  if (!responseData) return null;

  // Shape: { data: { user: { ... } } }
  if (responseData.data?.user && typeof responseData.data.user === 'object') {
    return responseData.data.user;
  }

  // Shape: { data: { id, email, role, ... } }
  if (responseData.data && typeof responseData.data === 'object') {
    const d = responseData.data;
    if (d.id || d._id || d.email) {
      return d;
    }
  }

  // Shape: { user: { ... } } (flat, no data wrapper)
  if (responseData.user && typeof responseData.user === 'object') {
    return responseData.user;
  }

  return null;
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

/**
 * Submit login credentials.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: object }>}
 */
export async function login({ email, password }) {
  const response = await client.post('/auth/login', { email, password });
  const user = extractUser(response.data);
  return { user, raw: response.data };
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

/**
 * Terminate the server session.
 * @returns {Promise<void>}
 */
export async function logout() {
  await client.post('/auth/logout');
}

// ---------------------------------------------------------------------------
// getCurrentUser (/auth/me)
// ---------------------------------------------------------------------------

/**
 * Fetch the currently authenticated user from the session cookie.
 * @returns {Promise<object|null>}  null if unauthenticated
 */
export async function getCurrentUser() {
  const response = await client.get('/auth/me');
  return extractUser(response.data);
}

// ---------------------------------------------------------------------------
// registerApartment
// ---------------------------------------------------------------------------

/**
 * Submit an apartment registration request.
 *
 * @param {{
 *   apartmentName: string,
 *   addressLine: string,
 *   city: string,
 *   state: string,
 *   postalCode: string,
 *   contactPhone: string,
 *   contactEmail: string,
 *   adminName: string,
 *   adminEmail: string,
 *   adminPhone: string,
 *   password: string,
 * }} formData
 * @returns {Promise<{ message: string, data: object }>}
 */
export async function registerApartment(formData) {
  // Build the payload in the shape the backend expects.
  // Adjust field names here if the backend contract differs.
  const payload = {
    apartment: {
      name: formData.apartmentName,
      address: formData.addressLine,
      city: formData.city,
      state: formData.state,
      postal_code: formData.postalCode,
      contact_phone: formData.contactPhone,
      contact_email: formData.contactEmail,
    },
    admin: {
      name: formData.adminName,
      email: formData.adminEmail,
      phone: formData.adminPhone,
      password: formData.password,
    },
  };

  const response = await client.post('/auth/register-apartment', payload);
  return {
    message: response.data?.message ?? 'Registration request submitted.',
    data: response.data?.data ?? null,
  };
}

// ---------------------------------------------------------------------------
// acceptInvitation
// ---------------------------------------------------------------------------

/**
 * Accept an invitation using the token from the URL query string.
 *
 * @param {{ token: string, password: string }} params
 * @returns {Promise<{ message: string, user: object|null }>}
 */
export async function acceptInvitation({ token, password }) {
  const payload = { token, password };
  const response = await client.post('/auth/accept-invitation', payload);

  const user = extractUser(response.data);
  return {
    message: response.data?.message ?? 'Invitation accepted.',
    user,
  };
}
