/**
 * notificationsApi.js
 *
 * Dedicated API service for User Notifications:
 * - Listing recent notifications
 * - Getting unread count
 * - Marking notifications as read
 * - Marking all as read
 *
 * Connects directly to backend endpoints using the centralized Axios client.
 * Does not simulate fake notification counts or fabricated items.
 */

import client from './client';

/**
 * Fetch user notifications.
 *
 * @param {object} params - { page, limit, unreadOnly }
 * @returns {Promise<{ items: Array, total: number, unreadCount: number }>}
 */
export async function getNotifications(params = {}) {
  try {
    const response = await client.get('/notifications', { params });
    const data = response.data?.data ?? response.data;

    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (Array.isArray(data?.notifications)) {
      items = data.notifications;
    } else if (Array.isArray(data?.items)) {
      items = data.items;
    }

    const total = data?.total ?? items.length;
    const unreadCount =
      data?.unreadCount ??
      data?.unread_count ??
      items.filter((n) => !n.read && !n.isRead).length;

    return {
      items,
      total,
      unreadCount,
    };
  } catch (err) {
    // If /notifications is not found, try /user/notifications
    if (err.response?.status === 404) {
      try {
        const fallbackRes = await client.get('/user/notifications', { params });
        const fallbackData = fallbackRes.data?.data ?? fallbackRes.data;
        const items = Array.isArray(fallbackData)
          ? fallbackData
          : fallbackData?.notifications || fallbackData?.items || [];
        return {
          items,
          total: items.length,
          unreadCount: items.filter((n) => !n.read && !n.isRead).length,
        };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

/**
 * Mark a single notification as read.
 *
 * @param {string|number} id
 * @returns {Promise<object>}
 */
export async function markNotificationAsRead(id) {
  try {
    const response = await client.patch(`/notifications/${id}/read`);
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      const putRes = await client.put(`/notifications/${id}/read`);
      return putRes.data?.data ?? putRes.data;
    }
    throw err;
  }
}

/**
 * Mark all user notifications as read.
 *
 * @returns {Promise<object>}
 */
export async function markAllNotificationsAsRead() {
  try {
    const response = await client.post('/notifications/read-all');
    return response.data?.data ?? response.data;
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 405) {
      const patchRes = await client.patch('/notifications/read-all');
      return patchRes.data?.data ?? patchRes.data;
    }
    throw err;
  }
}
