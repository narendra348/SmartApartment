import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getResidents,
  getResidentById,
  createResident,
  updateResident,
  reassignResidentFlat,
  resendResidentInvitation,
  deleteResident,
} from '../controllers/resident.controller.js';

const router = Router();

// Apartment Admin and Super Admin access only
router.use(authenticate, requireAdmin);

router.get('/', getResidents);
router.get('/:id', getResidentById);
router.post('/', createResident);
router.put('/:id', updateResident);
router.put('/:id/reassign', reassignResidentFlat);
router.post('/:id/resend-invitation', resendResidentInvitation);
router.delete('/:id', deleteResident);

export default router;
