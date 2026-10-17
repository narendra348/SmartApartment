/**
 * superAdminApi.js
 *
 * Dedicated API service layer for Super Admin operations:
 * - Listing all apartments with filtering & pagination
 * - Pending apartment onboarding applications
 * - Apartment detail retrieval
 * - Application approval & rejection
 * - Suspension & reactivation
 * - System audit logs
 * - Super admin profile retrieval and updating
 *
 * Connects directly to the backend via the centralized Axios client.
 * Does not fabricate sample data or mock success responses.
 */

import client from './client';

// ---------------------------------------------------------------------------
// Helpers for normalizing response shapes
// ---------------------------------------------------------------------------

function normalizeListResponse(responseData, listKey = 'apartments') {
  if (!responseData) {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }

  // If response is already an array
  if (Array.isArray(responseData)) {
    return { items: responseData, total: responseData.length, page: 1, totalPages: 1 };
  }

  const data = responseData.data ?? responseData;

  // If data itself is an array
  if (Array.isArray(data)) {
    const total = responseData.total ?? responseData.count ?? data.length;
    const page = responseData.page ?? 1;
    const limit = responseData.limit ?? 10;
    return {
      items: data,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Object with items/apartments/logs array
  const items =
    data[listKey] ||
    data.items ||
    data.results ||
    data.rows ||
    (Array.isArray(data) ? data : []);

  const total =
    data.total ??
    data.count ??
    data.totalCount ??
    responseData.total ??
    items.length;

  const page = data.page ?? responseData.page ?? 1;
  const limit = data.limit ?? responseData.limit ?? 10;
  const totalPages =
    data.totalPages ??
    data.pages ??
    (Math.ceil(total / limit) || 1);

  return {
    items: Array.isArray(items) ? items : [],
    total: typeof total === 'number' ? total : 0,
    page: typeof page === 'number' ? page : 1,
    totalPages: typeof totalPages === 'number' ? totalPages : 1,
  };
}

// ---------------------------------------------------------------------------
// 1. Apartments
// ---------------------------------------------------------------------------

/**
 * Fetch all registered apartments with filtering and pagination
 * Endpoint: GET /super-admin/apartments
 */
export async function getApartments(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();
  if (params.status && params.status !== 'all') query.status = params.status;

  const response = await client.get('/super-admin/apartments', { params: query });
  return normalizeListResponse(response.data, 'apartments');
}

/**
 * Fetch apartments awaiting approval
 * Endpoint: GET /super-admin/apartments/pending (or GET /super-admin/apartments?status=pending)
 */
export async function getPendingApartments(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();

  try {
    const response = await client.get('/super-admin/apartments/pending', { params: query });
    return normalizeListResponse(response.data, 'apartments');
  } catch (err) {
    // If dedicated /pending route returns 404, fallback to /apartments?status=pending
    if (err.status === 404) {
      const fallbackQuery = { ...query, status: 'pending' };
      const fallbackResponse = await client.get('/super-admin/apartments', { params: fallbackQuery });
      return normalizeListResponse(fallbackResponse.data, 'apartments');
    }
    throw err;
  }
}

/**
 * Fetch specific apartment details by ID
 * Endpoint: GET /super-admin/apartments/:id
 */
export async function getApartmentById(id) {
  if (!id) throw new Error('Apartment ID is required');
  const response = await client.get(`/super-admin/apartments/${id}`);
  return response.data?.data ?? response.data;
}

/**
 * Approve a pending apartment application
 * Endpoint: POST /super-admin/apartments/:id/approve
 */
export async function approveApartment(id) {
  if (!id) throw new Error('Apartment ID is required');
  const response = await client.post(`/super-admin/apartments/${id}/approve`);
  return response.data;
}

/**
 * Reject a pending apartment application
 * Endpoint: POST /super-admin/apartments/:id/reject
 */
export async function rejectApartment(id, reason = '') {
  if (!id) throw new Error('Apartment ID is required');
  const payload = { reason: reason ? reason.trim() : undefined };
  const response = await client.post(`/super-admin/apartments/${id}/reject`, payload);
  return response.data;
}

/**
 * Suspend an active apartment complex
 * Endpoint: POST /super-admin/apartments/:id/suspend
 */
export async function suspendApartment(id, reason = '') {
  if (!id) throw new Error('Apartment ID is required');
  const payload = { reason: reason ? reason.trim() : undefined };
  const response = await client.post(`/super-admin/apartments/${id}/suspend`, payload);
  return response.data;
}

/**
 * Reactivate a suspended apartment complex
 * Endpoint: POST /super-admin/apartments/:id/reactivate
 */
export async function reactivateApartment(id) {
  if (!id) throw new Error('Apartment ID is required');
  const response = await client.post(`/super-admin/apartments/${id}/reactivate`);
  return response.data;
}

// ---------------------------------------------------------------------------
// 2. Audit Logs
// ---------------------------------------------------------------------------

/**
 * Fetch searchable system audit logs
 * Endpoint: GET /super-admin/audit-logs
 */
export async function getAuditLogs(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();
  if (params.action && params.action !== 'all') query.action = params.action;
  if (params.status && params.status !== 'all') query.status = params.status;

  const response = await client.get('/super-admin/audit-logs', { params: query });
  return normalizeListResponse(response.data, 'logs');
}

// ---------------------------------------------------------------------------
// 3. Super Admin Profile
// ---------------------------------------------------------------------------

/**
 * Fetch super admin profile details
 * Endpoint: GET /super-admin/profile (fallback: GET /auth/me)
 */
export async function getSuperAdminProfile() {
  try {
    const response = await client.get('/super-admin/profile');
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.status === 404) {
      // Fallback to /auth/me
      const meResponse = await client.get('/auth/me');
      return meResponse.data?.data?.user ?? meResponse.data?.data ?? meResponse.data;
    }
    throw err;
  }
}

/**
 * Update super admin profile details
 * Endpoint: PUT /super-admin/profile (or PATCH)
 */
export async function updateSuperAdminProfile(payload) {
  const response = await client.put('/super-admin/profile', payload);
  return response.data?.data ?? response.data;
}
