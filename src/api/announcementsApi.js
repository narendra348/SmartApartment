/**
 * announcementsApi.js
 *
 * Dedicated API service for Announcements:
 * - Admin CRUD, publishing, unpublishing, and target audience management
 * - Resident announcement feed
 * - Staff announcement feed
 *
 * Connects directly to backend endpoints using the centralized Axios client.
 * Does not simulate fake announcements or fake success.
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
    data.announcements ||
    data.notices ||
    data.posts ||
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
 * Fetch announcements list scoped by user role.
 *
 * @param {object} params - { page, limit, search, status, audience, sortBy, sortOrder }
 * @param {'admin'|'resident'|'staff'} role
 * @returns {Promise<{ items: Array, total: number, page: number, totalPages: number }>}
 */
export async function getAnnouncements(params = {}, role = 'admin') {
  let endpoint = '/admin/announcements';
  if (role === 'resident') endpoint = '/resident/announcements';
  if (role === 'staff') endpoint = '/staff/announcements';

  const cleanParams = Object.entries(params).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') {
      acc[k] = v;
    }
    return acc;
  }, {});

  try {
    const response = await client.get(endpoint, { params: cleanParams });
    return normalizeListResponse(response.data);
  } catch (err) {
    // If scoped endpoint returns 404, fallback to generic /announcements
    if (err.response?.status === 404 && endpoint !== '/announcements') {
      try {
        const fallbackRes = await client.get('/announcements', {
          params: { ...cleanParams, role },
        });
        return normalizeListResponse(fallbackRes.data);
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Fetch a single announcement by ID.
 *
 * @param {string|number} id
 * @param {'admin'|'resident'|'staff'} role
 * @returns {Promise<object>}
 */
export async function getAnnouncementById(id, role = 'admin') {
  let endpoint = `/admin/announcements/${id}`;
  if (role === 'resident') endpoint = `/resident/announcements/${id}`;
  if (role === 'staff') endpoint = `/staff/announcements/${id}`;

  try {
    const response = await client.get(endpoint);
    return (
      response.data?.data?.announcement ??
      response.data?.data ??
      response.data?.announcement ??
      response.data
    );
  } catch (err) {
    if (err.response?.status === 404 && endpoint !== `/announcements/${id}`) {
      const fallbackRes = await client.get(`/announcements/${id}`);
      return (
        fallbackRes.data?.data?.announcement ??
        fallbackRes.data?.data ??
        fallbackRes.data
      );
    }
    throw err;
  }
}

/**
 * Create a new announcement (Admin).
 *
 * @param {object} payload - { title, content, audience, expiresAt, status, priority, category }
 * @returns {Promise<object>}
 */
export async function createAnnouncement(payload) {
  const response = await client.post('/admin/announcements', payload);
  return response.data?.data ?? response.data;
}

/**
 * Update an existing announcement (Admin).
 *
 * @param {string|number} id
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function updateAnnouncement(id, payload) {
  try {
    const response = await client.put(`/admin/announcements/${id}`, payload);
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      const patchRes = await client.patch(`/admin/announcements/${id}`, payload);
      return patchRes.data?.data ?? patchRes.data;
    }
    throw err;
  }
}

/**
 * Publish or Unpublish an announcement (Admin).
 *
 * @param {string|number} id
 * @param {boolean} isPublished
 * @returns {Promise<object>}
 */
export async function togglePublishAnnouncement(id, isPublished) {
  const status = isPublished ? 'published' : 'draft';
  try {
    const response = await client.patch(`/admin/announcements/${id}/publish`, {
      isPublished,
      status,
    });
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      return updateAnnouncement(id, {
        isPublished,
        status,
        publishedAt: isPublished ? new Date().toISOString() : null,
      });
    }
    throw err;
  }
}

/**
 * Delete an announcement (Admin).
 *
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export async function deleteAnnouncement(id) {
  await client.delete(`/admin/announcements/${id}`);
}
