/**
 * complaint.routes.js
 *
 * Admin and Resident routes for Maintenance Requests / Complaints.
 *
 * Admin endpoints  (APARTMENT_ADMIN + SUPER_ADMIN + MAINTENANCE_STAFF via scoping):
 *   GET    /api/v1/admin/complaints           - List (admin/staff scoped)
 *   POST   /api/v1/admin/complaints           - Create
 *   GET    /api/v1/admin/complaints/:id       - Get single
 *   PUT    /api/v1/admin/complaints/:id       - Update (admin full, staff limited)
 *   POST   /api/v1/admin/complaints/:id/comments - Add comment
 *   DELETE /api/v1/admin/complaints/:id       - Delete (admin only)
 *
 * Resident endpoints:
 *   GET    /api/v1/resident/complaints        - List own
 *   POST   /api/v1/resident/complaints        - Submit new
 *   GET    /api/v1/resident/complaints/:id    - View own single
 *   POST   /api/v1/resident/complaints/:id/comments - Add comment
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  listComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  addComment,
  deleteComplaint,
} from '../controllers/complaint.controller.js';

// ── Admin/Staff router ────────────────────────────────────────────────────────
export const adminComplaintRouter = Router();

// All admin complaint routes require authentication.
// Apartment admins, super admins, and maintenance staff are all authenticated here;
// the controller itself scopes results per role (staff only sees assigned).
adminComplaintRouter.use(
  authenticate,
  requireRole('APARTMENT_ADMIN', 'SUPER_ADMIN', 'MAINTENANCE_STAFF'),
);

adminComplaintRouter.get('/', listComplaints);
adminComplaintRouter.post('/', createComplaint);
adminComplaintRouter.get('/:id', getComplaintById);
adminComplaintRouter.put('/:id', updateComplaint);
adminComplaintRouter.post('/:id/comments', addComment);
adminComplaintRouter.patch('/:id', addComment); // fallback used by frontend
adminComplaintRouter.delete('/:id', requireRole('APARTMENT_ADMIN', 'SUPER_ADMIN'), deleteComplaint);

// ── Resident router ───────────────────────────────────────────────────────────
export const residentComplaintRouter = Router();

residentComplaintRouter.use(authenticate, requireRole('RESIDENT'));

residentComplaintRouter.get('/', listComplaints);
residentComplaintRouter.post('/', createComplaint);
residentComplaintRouter.get('/:id', getComplaintById);
residentComplaintRouter.post('/:id/comments', addComment);

export default adminComplaintRouter;
