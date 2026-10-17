/**
 * announcement.routes.js
 *
 * Express routes for Announcements:
 * - Admin announcements: /api/v1/admin/announcements
 * - Resident announcements: /api/v1/resident/announcements
 * - Staff announcements: /api/v1/staff/announcements
 * - Generic fallback: /api/v1/announcements
 */

import { Router } from 'express';
import {
  authenticate,
  requireAdmin,
  requireResident,
  requireStaff,
} from '../middleware/auth.middleware.js';
import {
  listAdminAnnouncements,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  togglePublishAnnouncement,
  deleteAnnouncement,
  listResidentAnnouncements,
  listStaffAnnouncements,
} from '../controllers/announcement.controller.js';

// ── Admin Router ─────────────────────────────────────────────────────────────
const adminAnnouncementsRouter = Router();
adminAnnouncementsRouter.use(authenticate, requireAdmin);

adminAnnouncementsRouter.get('/', listAdminAnnouncements);
adminAnnouncementsRouter.post('/', createAnnouncement);
adminAnnouncementsRouter.get('/:id', getAnnouncementById);
adminAnnouncementsRouter.put('/:id', updateAnnouncement);
adminAnnouncementsRouter.patch('/:id', updateAnnouncement);
adminAnnouncementsRouter.patch('/:id/publish', togglePublishAnnouncement);
adminAnnouncementsRouter.delete('/:id', deleteAnnouncement);

// ── Resident Router ──────────────────────────────────────────────────────────
const residentAnnouncementsRouter = Router();
residentAnnouncementsRouter.use(authenticate, requireResident);

residentAnnouncementsRouter.get('/', listResidentAnnouncements);
residentAnnouncementsRouter.get('/:id', getAnnouncementById);

// ── Staff Router ─────────────────────────────────────────────────────────────
const staffAnnouncementsRouter = Router();
staffAnnouncementsRouter.use(authenticate, requireStaff);

staffAnnouncementsRouter.get('/', listStaffAnnouncements);
staffAnnouncementsRouter.get('/:id', getAnnouncementById);

// ── Generic Fallback Router (/api/v1/announcements) ──────────────────────────
const publicAnnouncementsRouter = Router();
publicAnnouncementsRouter.use(authenticate);

publicAnnouncementsRouter.get('/', (req, res, next) => {
  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'RESIDENT') return listResidentAnnouncements(req, res, next);
  if (role === 'MAINTENANCE_STAFF') return listStaffAnnouncements(req, res, next);
  return listAdminAnnouncements(req, res, next);
});
publicAnnouncementsRouter.get('/:id', getAnnouncementById);

export {
  adminAnnouncementsRouter,
  residentAnnouncementsRouter,
  staffAnnouncementsRouter,
  publicAnnouncementsRouter,
};
