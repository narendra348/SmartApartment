/**
 * work-order.routes.js
 *
 * Routes for Work Orders.
 *
 *   GET    /api/v1/admin/work-orders           - List (admin full / staff scoped)
 *   POST   /api/v1/admin/work-orders           - Create (admin only)
 *   GET    /api/v1/admin/work-orders/:id       - Get single
 *   PUT    /api/v1/admin/work-orders/:id       - Update
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  listWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
} from '../controllers/work-order.controller.js';

const router = Router();

// Authenticate all work order routes
router.use(
  authenticate,
  requireRole('APARTMENT_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'),
);

router.get('/', listWorkOrders);
router.post('/', requireRole('APARTMENT_ADMIN', 'SUPER_ADMIN'), createWorkOrder);
router.get('/:id', getWorkOrderById);
router.put('/:id', updateWorkOrder);

export default router;
