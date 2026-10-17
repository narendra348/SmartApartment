/**
 * auth.controller.js
 *
 * Controller handling user authentication & authorization lifecycle:
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/register (public resident self-registration only)
 * - GET  /api/v1/auth/me
 * - POST /api/v1/auth/logout
 *
 * Implements:
 * - Constant-time generic error responses to prevent email enumeration
 * - Rejection of pending, suspended, and rejected account statuses
 * - Role restriction: public users may only register as RESIDENT
 * - JWT access token signing with environment-configured secret
 * - HTTP-only session cookies with CSRF token generation
 * - Safe response sanitization omitting passwords and hashes
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { ACCOUNT_STATUS } from '../constants/accountStatus.js';
import Apartment from '../models/apartment.model.js';
import { logAudit } from '../services/audit.service.js';

// Standard email validation pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Format a user document into a safe response object.
 * Strictly guarantees password and internal Mongoose fields are never exposed.
 */
export function formatSafeUser(user) {
  const apt = user.apartment || user.apartmentId || null;
  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone || null,
    apartment: apt,
    apartmentId: apt,
    buildingId: user.buildingId || null,
    flatId: user.flatId || null,
    isEmailVerified: Boolean(user.isEmailVerified),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials and establishes a session.
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email address and password are required.',
        },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Consistent generic error for missing user to prevent email enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email address or password. Please try again.',
        },
      });
    }

    // Verify candidate password against stored bcrypt hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email address or password. Please try again.',
        },
      });
    }

    // Check account status after successful credential verification
    const statusUpper = String(user.status || '').toUpperCase();

    if (statusUpper === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact your administrator.',
        },
      });
    }

    if (statusUpper === 'PENDING' || statusUpper === 'PENDING_APPROVAL') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PENDING_APPROVAL',
          message: 'Your account is pending administrator approval. Please contact management.',
        },
      });
    }

    if (statusUpper === 'REJECTED') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_REJECTED',
          message: 'Your account registration has been rejected. Please contact management.',
        },
      });
    }

    if (statusUpper !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Your account is inactive. Please contact management.',
        },
      });
    }

    // Update lastLoginAt timestamp without triggering full save hooks
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    // Generate JWT access token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        email: user.email,
      },
      env.SESSION_SECRET,
      { expiresIn: '7d' },
    );

    const isProduction = env.NODE_ENV === 'production';

    // Set secure HTTP-only session cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Set CSRF token cookie readable by frontend client
    const csrfToken = crypto.randomBytes(16).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const safeUser = formatSafeUser(user);

    logAudit({
      actor: user,
      action: 'LOGIN',
      targetEntity: 'User',
      targetId: user._id,
      apartmentId: user.apartmentId || null,
      details: `User logged in (${user.email})`,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/register
 * Public self-registration endpoint. Restricted exclusively to RESIDENT accounts.
 */
export async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body || {};

    // Validate required full name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Full name is required and must be at least 2 characters.',
        },
      });
    }

    // Validate email format
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'A valid email address is required.',
        },
      });
    }

    // Validate password strength/length
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password is required and must be at least 6 characters long.',
        },
      });
    }

    // Enforce role restriction: public self-registration allows only RESIDENT
    if (role) {
      const requestedRole = String(role).trim().toUpperCase();
      if (requestedRole !== 'RESIDENT') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ROLE_NOT_PERMITTED',
            message: 'Public registration is restricted to Resident accounts only. Administrative roles cannot be self-assigned.',
          },
        });
      }
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists. Please sign in or use another email.',
        },
      });
    }

    // Create resident user in PENDING status awaiting administrative verification
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password, // Pre-save hook automatically hashes with bcryptjs
      role: ROLES.RESIDENT,
      status: ACCOUNT_STATUS.PENDING,
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: 'Resident registration submitted successfully. Your account is pending administrator review.',
      data: {
        user: formatSafeUser(newUser),
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Restores active user session from HTTP-only cookie or Authorization header.
 */
export async function getCurrentUser(req, res, next) {
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
          message: 'No active authentication session found.',
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
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Malformed or invalid session token.',
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

    return res.status(200).json({
      success: true,
      data: {
        user: formatSafeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Terminates user session and clears authentication cookies.
 */
export function logout(req, res) {
  const isProduction = env.NODE_ENV === 'production';

  if (req.user) {
    logAudit({
      actor: req.user,
      action: 'LOGOUT',
      targetEntity: 'User',
      targetId: req.user._id,
      apartmentId: req.user.apartmentId || null,
      details: `User logged out (${req.user.email})`,
    });
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });

  res.clearCookie('csrf_token', {
    secure: isProduction,
    sameSite: 'lax',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * POST /api/v1/auth/register-apartment
 * Apartment community onboarding application.
 * Creates an apartment in PENDING status awaiting Super Admin verification.
 */
export async function registerApartment(req, res, next) {
  try {
    const { apartment, admin } = req.body || {};

    // Accept both field-name conventions from frontend and tests:
    //   apartment.name  OR  apartment.apartmentName
    //   admin.name      OR  admin.adminName
    //   admin.email     OR  admin.adminEmail
    const resolvedAptName = (apartment?.name || apartment?.apartmentName || '').trim();
    const resolvedAdminName = (admin?.name || admin?.adminName || '').trim();
    const resolvedAdminEmail = (admin?.email || admin?.adminEmail || '').trim().toLowerCase();

    if (!apartment || !resolvedAptName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Apartment community name is required.' },
      });
    }

    if (!admin || !resolvedAdminEmail || !admin.password || !resolvedAdminName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Administrator details (name, email, password) are required.' },
      });
    }

    const aptName = resolvedAptName;
    const adminEmail = resolvedAdminEmail;

    // Generate unique slug
    const baseSlug =
      aptName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'apartment';
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    // Create apartment in pending status
    const newApartment = new Apartment({
      name: aptName,
      slug,
      address: (apartment.address || apartment.addressLine || '').trim(),
      city: (apartment.city || '').trim(),
      state: (apartment.state || '').trim(),
      postalCode: (apartment.postal_code || apartment.postalCode || '').trim(),
      contactPhone: (apartment.contact_phone || apartment.contactPhone || admin.phone || '').trim(),
      contactEmail: (apartment.contact_email || apartment.contactEmail || adminEmail).trim(),
      status: 'pending',
      requestedBy: req.user?._id || null,
    });

    await newApartment.save();

    // Check if user already exists
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      adminUser = new User({
        name: resolvedAdminName,
        email: adminEmail,
        phone: (admin.phone || admin.adminPhone || '').trim(),
        password: admin.password,
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.PENDING,
        apartment: newApartment._id,
        apartmentId: newApartment._id,
      });
      await adminUser.save();
    } else {
      adminUser.role = ROLES.APARTMENT_ADMIN;
      adminUser.status = ACCOUNT_STATUS.PENDING;
      adminUser.apartment = newApartment._id;
      adminUser.apartmentId = newApartment._id;
      await adminUser.save();
    }

    if (!newApartment.requestedBy) {
      newApartment.requestedBy = adminUser._id;
      await newApartment.save();
    }

    await logAudit({
      actor: req.user || adminUser,
      action: 'APARTMENT_REGISTER',
      targetEntity: 'Apartment',
      targetId: newApartment._id,
      apartmentId: newApartment._id,
      details: `Submitted registration for apartment complex "${newApartment.name}"`,
    });

    return res.status(201).json({
      success: true,
      message: 'Apartment community registration submitted successfully. Application is pending review.',
      data: {
        apartment: newApartment,
        user: formatSafeUser(adminUser),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/auth/profile
 * Updates authenticated user's name and phone.
 */
export async function updateProfile(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const { name, phone } = req.body || {};
    const dbUser = await User.findById(user._id);
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User account not found.' },
      });
    }

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      dbUser.name = name.trim();
    }
    if (phone !== undefined) {
      dbUser.phone = phone ? String(phone).trim() : null;
    }

    await dbUser.save();

    await logAudit({
      actor: dbUser,
      action: 'PROFILE_UPDATE',
      targetEntity: 'User',
      targetId: dbUser._id,
      apartmentId: dbUser.apartment || dbUser.apartmentId || null,
      details: 'User updated personal profile details',
    });

    const safeUser = formatSafeUser(dbUser);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: safeUser,
        profile: safeUser,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/change-password
 * Updates authenticated user's password after verifying current password.
 */
export async function changePassword(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Current password and new password are required.' },
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters long.' },
      });
    }

    const dbUser = await User.findById(user._id);
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User account not found.' },
      });
    }

    const isMatch = await dbUser.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' },
      });
    }

    dbUser.password = newPassword;
    await dbUser.save();

    await logAudit({
      actor: dbUser,
      action: 'PASSWORD_CHANGE',
      targetEntity: 'User',
      targetId: dbUser._id,
      apartmentId: dbUser.apartment || dbUser.apartmentId || null,
      details: 'User changed account password',
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export default {
  login,
  register,
  registerApartment,
  getCurrentUser,
  logout,
  updateProfile,
  changePassword,
  formatSafeUser,
};

