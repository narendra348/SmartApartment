import { Router } from 'express';
import {
  login,
  register,
  registerApartment,
  getCurrentUser,
  logout,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

// POST /api/v1/auth/login - User credential authentication (rate-limited)
router.post('/login', authRateLimiter, login);

// POST /api/v1/auth/register - Public resident registration (rate-limited)
router.post('/register', authRateLimiter, register);

// POST /api/v1/auth/register-apartment - Apartment onboarding application (rate-limited)
router.post('/register-apartment', authRateLimiter, registerApartment);

// GET /api/v1/auth/me - Session restoration and current user profile
router.get('/me', getCurrentUser);

// GET /api/v1/auth/profile - User profile
router.get('/profile', authenticate, getCurrentUser);

// PUT & PATCH /api/v1/auth/profile - Update user profile
router.put('/profile', authenticate, updateProfile);
router.patch('/profile', authenticate, updateProfile);

// POST & PUT /api/v1/auth/change-password - Change user password
router.post('/change-password', authenticate, changePassword);
router.put('/password', authenticate, changePassword);
router.post('/password/change', authenticate, changePassword);

// POST /api/v1/auth/logout - Session termination and cookie clearing
router.post('/logout', logout);

export default router;
