/**
 * auth.middleware.js
 *
 * Middleware to authenticate requests via HTTP-only cookie or Bearer token,
 * validate JWT expiration and integrity, verify active user status in database,
 * and authorize access based on system roles.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';

// Canonical role aliases map for normalizing comparisons
const ROLE_CANONICAL_MAP = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  super_admin: 'SUPER_ADMIN',
  APARTMENT_ADMIN: 'APARTMENT_ADMIN',
  admin: 'APARTMENT_ADMIN',
  ADMIN: 'APARTMENT_ADMIN',
  RESIDENT: 'RESIDENT',
  resident: 'RESIDENT',
  MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',
  staff: 'MAINTENANCE_STAFF',
  STAFF: 'MAINTENANCE_STAFF',
};

/**
 * Verifies JWT session token from HTTP-only cookie or Authorization header.
 * Attaches verified active user document to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1].trim()
        : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication session required or not provided.',
        },
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.SESSION_SECRET);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Session token has expired. Please sign in again.',
          },
        });
      }

      if (err instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Malformed or invalid session token.',
          },
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session token verification failed.',
        },
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account associated with this session no longer exists.',
        },
      });
    }

    const statusUpper = String(user.status || '').toUpperCase();
    if (statusUpper !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'User account is not active or has been suspended.',
        },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based authorization middleware factory.
 * Enforces server-side permissions matching allowed role strings.
 *
 * @param {...string} allowedRoles
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = new Set(
    allowedRoles.map((r) => ROLE_CANONICAL_MAP[r] || r.toUpperCase()),
  );

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication session required.',
        },
      });
    }

    const userRoleCanonical =
      ROLE_CANONICAL_MAP[req.user.role] || String(req.user.role || '').toUpperCase();

    if (!normalizedAllowed.has(userRoleCanonical)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: insufficient permissions for this resource.',
        },
      });
    }

    next();
  };
}

export const requireSuperAdmin = requireRole('SUPER_ADMIN');
export const requireAdmin = requireRole('APARTMENT_ADMIN', 'SUPER_ADMIN');
export const requireResident = requireRole('RESIDENT');
export const requireStaff = requireRole('MAINTENANCE_STAFF');

export default {
  authenticate,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  requireResident,
  requireStaff,
};
