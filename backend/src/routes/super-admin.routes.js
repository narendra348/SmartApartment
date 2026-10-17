import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware.js';
import {
  getApartments,
  getPendingApartments,
  getApartmentById,
  approveApartment,
  rejectApartment,
  suspendApartment,
  reactivateApartment,
  getAuditLogs,
  getSuperAdminProfile,
  updateSuperAdminProfile,
} from '../controllers/super-admin.controller.js';

const router = Router();

// Enforce authentication & Super Admin role globally for all /super-admin routes
router.use(authenticate, requireSuperAdmin);

// Apartment Community Lifecycle & Listing
router.get('/apartments/pending', getPendingApartments);
router.get('/apartments', getApartments);
router.get('/apartments/:id', getApartmentById);
router.post('/apartments/:id/approve', approveApartment);
router.post('/apartments/:id/reject', rejectApartment);
router.post('/apartments/:id/suspend', suspendApartment);
router.post('/apartments/:id/reactivate', reactivateApartment);

// System Audit Logs
router.get('/audit-logs', getAuditLogs);

// Profile
router.get('/profile', getSuperAdminProfile);
router.put('/profile', updateSuperAdminProfile);

export default router;
