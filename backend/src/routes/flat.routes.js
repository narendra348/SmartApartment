import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getFlats,
  getFlatById,
  createFlat,
  updateFlat,
  deleteFlat,
} from '../controllers/flat.controller.js';

const router = Router();

// Apartment Admin and Super Admin access only
router.use(authenticate, requireAdmin);

router.get('/', getFlats);
router.get('/:id', getFlatById);
router.post('/', createFlat);
router.put('/:id', updateFlat);
router.delete('/:id', deleteFlat);

export default router;
