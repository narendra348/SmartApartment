import { Router } from 'express';
import {
  authenticate,
  requireSuperAdmin,
  requireAdmin,
  requireResident,
  requireStaff,
} from '../middleware/auth.middleware.js';
import {
  getSuperAdminDashboard,
  getAdminDashboard,
  getResidentDashboard,
  getStaffDashboard,
} from '../controllers/dashboard.controller.js';

const router = Router();

// GET /api/v1/dashboard/super-admin (Protected: Super Admin only)
router.get('/super-admin', authenticate, requireSuperAdmin, getSuperAdminDashboard);

// GET /api/v1/dashboard/admin (Protected: Apartment Admin or Super Admin)
router.get('/admin', authenticate, requireAdmin, getAdminDashboard);

// GET /api/v1/dashboard/resident (Protected: Resident)
router.get('/resident', authenticate, requireResident, getResidentDashboard);

// GET /api/v1/dashboard/staff (Protected: Maintenance Staff)
router.get('/staff', authenticate, requireStaff, getStaffDashboard);

export default router;
