import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationAsRead);
router.put('/:id/read', markNotificationAsRead);
router.post('/read-all', markAllNotificationsAsRead);
router.patch('/read-all', markAllNotificationsAsRead);

export default router;
