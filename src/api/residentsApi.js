/**
 * residentsApi.js
 *
 * Dedicated API service for Apartment Admin residents management:
 * - Listing residents with search, filters (building, account status, invitation status), and pagination
 * - Getting resident details
 * - Adding or inviting a resident
 * - Updating resident profile details
 * - Reassigning a resident to another flat
 * - Resending resident invitation
 * - Removing a resident
 *
 * Uses the centralized Axios client with withCredentials: true.
 * Connects directly to backend endpoints without mock data.
 */

import client from './client';

// Helper to normalize response shapes
function normalizeListResponse(responseData) {
  if (!responseData) {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }

  // If array directly
  if (Array.isArray(responseData)) {
    return { items: responseData, total: responseData.length, page: 1, totalPages: 1 };
  }

  const data = responseData.data ?? responseData;

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

  const items =
    data.residents ||
    data.users ||
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

/**
 * List residents with search, building filter, status filter, and pagination
 * Endpoint: GET /admin/residents
 */
export async function getResidents(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();
  if (params.buildingId && params.buildingId !== 'all') query.buildingId = params.buildingId;
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.invitationStatus && params.invitationStatus !== 'all') {
    query.invitationStatus = params.invitationStatus;
  }
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  const response = await client.get('/admin/residents', { params: query });
  return normalizeListResponse(response.data);
}

/**
 * Get resident details by ID
 * Endpoint: GET /admin/residents/:id
 */
export async function getResidentById(id) {
  if (!id) throw new Error('Resident ID is required');
  const response = await client.get(`/admin/residents/${id}`);
  return response.data?.data ?? response.data;
}

/**
 * Add or invite a resident
 * Endpoint: POST /admin/residents
 */
export async function createResident(payload) {
  const response = await client.post('/admin/residents', payload);
  return response.data?.data ?? response.data;
}

/**
 * Update resident details
 * Endpoint: PUT /admin/residents/:id
 */
export async function updateResident(id, payload) {
  if (!id) throw new Error('Resident ID is required');
  const response = await client.put(`/admin/residents/${id}`, payload);
  return response.data?.data ?? response.data;
}

/**
 * Reassign resident to another flat / unit
 * Endpoint: PUT /admin/residents/:id/reassign
 */
export async function reassignResidentFlat(id, { buildingId, flatId }) {
  if (!id) throw new Error('Resident ID is required');
  try {
    const response = await client.put(`/admin/residents/${id}/reassign`, {
      buildingId,
      flatId,
    });
    return response.data?.data ?? response.data;
  } catch (err) {
    // Fallback: If dedicated reassign endpoint is 404, try standard PUT /admin/residents/:id
    if (err.response?.status === 404) {
      const response = await client.put(`/admin/residents/${id}`, {
        buildingId,
        flatId,
      });
      return response.data?.data ?? response.data;
    }
    throw err;
  }
}

/**
 * Resend invitation email to resident
 * Endpoint: POST /admin/residents/:id/resend-invitation
 */
export async function resendResidentInvitation(id) {
  if (!id) throw new Error('Resident ID is required');
  const response = await client.post(`/admin/residents/${id}/resend-invitation`);
  return response.data;
}

/**
 * Remove or deactivate resident
 * Endpoint: DELETE /admin/residents/:id
 */
export async function deleteResident(id) {
  if (!id) throw new Error('Resident ID is required');
  const response = await client.delete(`/admin/residents/${id}`);
  return response.data;
}
