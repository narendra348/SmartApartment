/**
 * flatsApi.js
 *
 * Dedicated API service for Apartment Admin flats/units management:
 * - Listing flats with search, building filtering, occupancy status filtering, and pagination
 * - Getting flat details
 * - Creating flats
 * - Updating flats
 * - Deleting flats
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
    data.flats ||
    data.units ||
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
 * List flats with optional search, building filter, occupancy status filter, and pagination
 * Endpoint: GET /admin/flats
 */
export async function getFlats(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();
  if (params.buildingId && params.buildingId !== 'all') query.buildingId = params.buildingId;
  if (params.occupancyStatus && params.occupancyStatus !== 'all') {
    query.occupancyStatus = params.occupancyStatus;
  }

  const response = await client.get('/admin/flats', { params: query });
  return normalizeListResponse(response.data);
}

/**
 * Get flat details by ID
 * Endpoint: GET /admin/flats/:id
 */
export async function getFlatById(id) {
  if (!id) throw new Error('Flat ID is required');
  const response = await client.get(`/admin/flats/${id}`);
  return response.data?.data ?? response.data;
}

/**
 * Create a new flat
 * Endpoint: POST /admin/flats
 */
export async function createFlat(payload) {
  const response = await client.post('/admin/flats', payload);
  return response.data?.data ?? response.data;
}

/**
 * Update an existing flat
 * Endpoint: PUT /admin/flats/:id
 */
export async function updateFlat(id, payload) {
  if (!id) throw new Error('Flat ID is required');
  const response = await client.put(`/admin/flats/${id}`, payload);
  return response.data?.data ?? response.data;
}

/**
 * Delete a flat
 * Endpoint: DELETE /admin/flats/:id
 */
export async function deleteFlat(id) {
  if (!id) throw new Error('Flat ID is required');
  const response = await client.delete(`/admin/flats/${id}`);
  return response.data;
}
