import Notification from '../models/notification.model.js';

/**
 * GET /api/v1/notifications
 * Lists notifications for the current authenticated user.
 */
export async function getNotifications(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(200).json({
        success: true,
        data: { items: [], total: 0, unreadCount: 0 },
      });
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const aptId = user.apartment || user.apartmentId;

    const query = {
      $or: [
        { userId: user._id },
        ...(aptId ? [{ apartmentId: aptId, userId: null }] : []),
      ],
    };

    if (req.query.unreadOnly === 'true') {
      query.read = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, read: false }),
    ]);

    const formatted = items.map((n) => ({
      ...n,
      id: n._id.toString(),
      read: Boolean(n.read || n.isRead),
      isRead: Boolean(n.read || n.isRead),
    }));

    return res.status(200).json({
      success: true,
      data: {
        items: formatted,
        total,
        unreadCount,
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a notification as read.
 */
export async function markNotificationAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (notification) {
      notification.read = true;
      notification.isRead = true;
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      data: notification || { _id: id, read: true, isRead: true },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/notifications/read-all
 * Marks all notifications for the current user as read.
 */
export async function markAllNotificationsAsRead(req, res, next) {
  try {
    const user = req.user;
    if (user) {
      const aptId = user.apartment || user.apartmentId;
      await Notification.updateMany(
        {
          $or: [
            { userId: user._id },
            ...(aptId ? [{ apartmentId: aptId, userId: null }] : []),
          ],
        },
        { $set: { read: true, isRead: true } },
      );
    }

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
}
