/**
 * paymentsApi.js
 *
 * Dedicated API service for Manual Payments and Payment Verification:
 * - Resident payment history and submissions
 * - Apartment Admin payment verification & rejection
 * - Bill lookups for payment matching
 *
 * Connects directly to backend endpoints using the centralized Axios client.
 * Does not simulate fake success or fake offline states.
 */

import client from './client';

// ---------------------------------------------------------------------------
// Response normalizer (handles various backend response shapes)
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
    data.payments ||
    data.paymentSubmissions ||
    data.submissions ||
    data.transactions ||
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
 * Fetch list of payments with search, filters, and pagination.
 *
 * @param {object} params
 * @param {'admin'|'resident'} role
 * @returns {Promise<{ items: Array, total: number, page: number, totalPages: number }>}
 */
export async function getPayments(params = {}, role = 'admin') {
  const endpoint = role === 'resident' ? '/resident/payments' : '/admin/payments';

  const cleanParams = Object.entries(params).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') {
      acc[k] = v;
    }
    return acc;
  }, {});

  const response = await client.get(endpoint, { params: cleanParams });
  return normalizeListResponse(response.data);
}

/**
 * Fetch a single payment record by ID.
 *
 * @param {string|number} id
 * @param {'admin'|'resident'} role
 * @returns {Promise<object>}
 */
export async function getPaymentById(id, role = 'admin') {
  const endpoint = role === 'resident' ? `/resident/payments/${id}` : `/admin/payments/${id}`;
  const response = await client.get(endpoint);
  return response.data?.data?.payment ?? response.data?.data ?? response.data?.payment ?? response.data;
}

/**
 * Submit a manual payment record (Resident action).
 * Supports multipart/form-data if a receipt file is provided, otherwise JSON.
 *
 * @param {object|FormData} payload
 * @returns {Promise<object>}
 */
export async function submitPayment(payload) {
  let isFormData = false;
  if (typeof FormData !== 'undefined' && payload instanceof FormData) {
    isFormData = true;
  }

  const config = isFormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : {};

  const response = await client.post('/resident/payments', payload, config);
  return response.data?.data ?? response.data;
}

/**
 * Verify / Approve a payment submission (Admin action).
 *
 * @param {string|number} id
 * @param {object} details - { notes, comments }
 * @returns {Promise<object>}
 */
export async function verifyPayment(id, details = {}) {
  const body = {
    status: 'verified',
    notes: details.notes || details.comments || '',
    verificationComments: details.notes || details.comments || '',
  };

  try {
    const response = await client.put(`/admin/payments/${id}/verify`, body);
    return response.data?.data ?? response.data;
  } catch (err) {
    // Fallback to PATCH /admin/payments/:id or PUT /admin/payments/:id/status
    if (err.response?.status === 404 || err.response?.status === 405) {
      try {
        const fallbackRes = await client.patch(`/admin/payments/${id}/status`, body);
        return fallbackRes.data?.data ?? fallbackRes.data;
      } catch {
        const patchRes = await client.patch(`/admin/payments/${id}`, body);
        return patchRes.data?.data ?? patchRes.data;
      }
    }
    throw err;
  }
}

/**
 * Reject a payment submission with mandatory reason (Admin action).
 *
 * @param {string|number} id
 * @param {object} details - { reason, notes, comments }
 * @returns {Promise<object>}
 */
export async function rejectPayment(id, details = {}) {
  const body = {
    status: 'rejected',
    reason: details.reason || '',
    rejectionReason: details.reason || '',
    notes: details.notes || details.comments || details.reason || '',
    verificationComments: details.reason || details.notes || details.comments || '',
  };

  try {
    const response = await client.put(`/admin/payments/${id}/reject`, body);
    return response.data?.data ?? response.data;
  } catch (err) {
    // Fallback to PATCH /admin/payments/:id/status or PATCH /admin/payments/:id
    if (err.response?.status === 404 || err.response?.status === 405) {
      try {
        const fallbackRes = await client.patch(`/admin/payments/${id}/status`, body);
        return fallbackRes.data?.data ?? fallbackRes.data;
      } catch {
        const patchRes = await client.patch(`/admin/payments/${id}`, body);
        return patchRes.data?.data ?? patchRes.data;
      }
    }
    throw err;
  }
}

/**
 * Fetch resident bills (to allow selecting an outstanding bill).
 *
 * @param {object} params
 * @returns {Promise<Array>}
 */
export async function getResidentBills(params = {}) {
  try {
    const response = await client.get('/resident/bills', { params });
    const normalized = normalizeListResponse(response.data);
    return normalized.items;
  } catch (err) {
    // If endpoint is not yet mounted, return empty array so UI can allow manual entry
    return [];
  }
}
