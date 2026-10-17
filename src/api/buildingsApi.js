/**
 * buildingsApi.js
 *
 * Dedicated API service for Apartment Admin building management:
 * - Listing buildings with search, filter, and pagination
 * - Getting building details
 * - Creating buildings
 * - Updating buildings
 * - Deleting buildings
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
    data.buildings ||
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
 * List buildings with optional search, status filtering, and pagination
 * Endpoint: GET /admin/buildings
 */
export async function getBuildings(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();
  if (params.status && params.status !== 'all') query.status = params.status;

  const response = await client.get('/admin/buildings', { params: query });
  return normalizeListResponse(response.data);
}

/**
 * Get building details by ID
 * Endpoint: GET /admin/buildings/:id
 */
export async function getBuildingById(id) {
  if (!id) throw new Error('Building ID is required');
  const response = await client.get(`/admin/buildings/${id}`);
  return response.data?.data ?? response.data;
}

/**
 * Create a new building
 * Endpoint: POST /admin/buildings
 */
export async function createBuilding(payload) {
  const response = await client.post('/admin/buildings', payload);
  return response.data?.data ?? response.data;
}

/**
 * Update an existing building
 * Endpoint: PUT /admin/buildings/:id
 */
export async function updateBuilding(id, payload) {
  if (!id) throw new Error('Building ID is required');
  const response = await client.put(`/admin/buildings/${id}`, payload);
  return response.data?.data ?? response.data;
}

/**
 * Delete a building
 * Endpoint: DELETE /admin/buildings/:id
 */
export async function deleteBuilding(id) {
  if (!id) throw new Error('Building ID is required');
  const response = await client.delete(`/admin/buildings/${id}`);
  return response.data;
}
