/**
 * maintenanceApi.js
 *
 * Dedicated API service for Maintenance Requests & Complaints:
 * - Listing requests with search, status/priority/category/building filters, and pagination
 * - Getting a single request with its history/comments
 * - Submitting a new request
 * - Updating request status (admin role)
 * - Adding a comment / note to a request
 * - Deleting a request (admin only)
 *
 * Uses the centralized Axios client with withCredentials: true.
 * Connects directly to backend endpoints without mock data.
 */

import client from './client';

// ---------------------------------------------------------------------------
// Response normalizer (matches shape used across the project)
// ---------------------------------------------------------------------------
function normalizeListResponse(responseData) {
  if (!responseData) {
    return { items: [], total: 0, page: 1, totalPages: 1 };
  }

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
    data.complaints ||
    data.maintenance_requests ||
    data.maintenanceRequests ||
    data.requests ||
    data.tickets ||
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
 * List maintenance requests / complaints
 * Admin  → GET /admin/complaints
 * Resident → GET /resident/complaints
 */
export async function getMaintenanceRequests(params = {}, role = 'admin') {
  const basePath = role === 'resident' ? '/resident/complaints' : '/admin/complaints';
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.search) query.search = params.search.trim();
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.priority && params.priority !== 'all') query.priority = params.priority;
  if (params.category && params.category !== 'all') query.category = params.category;
  if (params.buildingId && params.buildingId !== 'all') query.buildingId = params.buildingId;
  if (params.flatId && params.flatId !== 'all') query.flatId = params.flatId;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  const response = await client.get(basePath, { params: query });
  return normalizeListResponse(response.data);
}

/**
 * Get a single maintenance request by ID (includes history/comments if backend supports it)
 * Admin  → GET /admin/complaints/:id
 * Resident → GET /resident/complaints/:id
 */
export async function getMaintenanceRequestById(id, role = 'admin') {
  if (!id) throw new Error('Request ID is required');
  const basePath =
    role === 'resident' ? `/resident/complaints/${id}` : `/admin/complaints/${id}`;
  const response = await client.get(basePath);
  return response.data?.data ?? response.data;
}

/**
 * Submit a new maintenance request
 * Admin  → POST /admin/complaints
 * Resident → POST /resident/complaints
 *
 * payload: { subject, description, category, priority, buildingId, flatId }
 */
export async function createMaintenanceRequest(payload, role = 'admin') {
  const basePath = role === 'resident' ? '/resident/complaints' : '/admin/complaints';
  const response = await client.post(basePath, payload);
  return response.data?.data ?? response.data;
}

/**
 * Update a request's status or details (admin/staff)
 * PUT /admin/complaints/:id
 *
 * payload: { status, priority, assignedTo?, resolutionNotes? }
 */
export async function updateMaintenanceRequest(id, payload) {
  if (!id) throw new Error('Request ID is required');
  const response = await client.put(`/admin/complaints/${id}`, payload);
  return response.data?.data ?? response.data;
}

/**
 * Add a comment / note to a request
 * POST /admin/complaints/:id/comments
 * Falls back to PATCH /admin/complaints/:id if dedicated endpoint returns 404.
 */
export async function addMaintenanceComment(id, comment, role = 'admin') {
  if (!id) throw new Error('Request ID is required');
  const basePath =
    role === 'resident'
      ? `/resident/complaints/${id}/comments`
      : `/admin/complaints/${id}/comments`;
  try {
    const response = await client.post(basePath, { comment });
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404) {
      const response = await client.patch(`/admin/complaints/${id}`, { comment });
      return response.data?.data ?? response.data;
    }
    throw err;
  }
}

/**
 * Delete a maintenance request (admin only)
 * DELETE /admin/complaints/:id
 */
export async function deleteMaintenanceRequest(id) {
  if (!id) throw new Error('Request ID is required');
  const response = await client.delete(`/admin/complaints/${id}`);
  return response.data;
}
