/**
 * super-admin.controller.js
 *
 * Dedicated controller for Super Admin platform administration:
 * - Reviewing and onboarding apartment communities (approve, reject, suspend, reactivate)
 * - Apartment directory listing with search, filters, and pagination
 * - Accessing comprehensive system audit logs
 * - Super Admin profile management
 */

import mongoose from 'mongoose';
import Apartment from '../models/apartment.model.js';
import User from '../models/User.js';
import AuditLog from '../models/audit-log.model.js';
import { logAudit } from '../services/audit.service.js';
import { formatSafeUser } from './auth.controller.js';

/**
 * GET /api/v1/super-admin/apartments
 * List all registered apartments with search, status filtering, and pagination.
 */
export async function getApartments(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim().toLowerCase();

    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, apartments] = await Promise.all([
      Apartment.countDocuments(filter),
      Apartment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        apartments,
        items: apartments,
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/super-admin/apartments/pending
 * List apartments awaiting review and onboarding approval.
 */
export async function getPendingApartments(req, res, next) {
  req.query.status = 'pending';
  return getApartments(req, res, next);
}

/**
 * GET /api/v1/super-admin/apartments/:id
 * Retrieve apartment details by ID.
 */
export async function getApartmentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid apartment ID format.' },
      });
    }

    const apartment = await Apartment.findById(id).lean();
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Apartment complex not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: apartment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/super-admin/apartments/:id/approve
 * Approves a pending apartment application.
 * Activates the community and associated administrator account idempotently.
 */
export async function approveApartment(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid apartment ID format.' },
      });
    }

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Apartment complex not found.' },
      });
    }

    // Idempotent approval
    if (apartment.status === 'approved') {
      return res.status(200).json({
        success: true,
        message: 'Apartment is already approved and active.',
        data: apartment,
      });
    }

    apartment.status = 'approved';
    apartment.reviewedBy = req.user._id;
    apartment.reviewedAt = new Date();
    apartment.rejectionReason = null;
    await apartment.save();

    // Activate the requesting user or admin associated with this apartment
    if (apartment.requestedBy) {
      await User.updateOne(
        { _id: apartment.requestedBy },
        { $set: { status: 'ACTIVE', apartment: apartment._id, apartmentId: apartment._id } },
      );
    }

    // Also activate any admin account registered with the apartment's contact email
    if (apartment.contactEmail) {
      await User.updateMany(
        { email: apartment.contactEmail.toLowerCase() },
        { $set: { status: 'ACTIVE', apartment: apartment._id, apartmentId: apartment._id } },
      );
    }

    await logAudit({
      actor: req.user,
      action: 'APARTMENT_APPROVE',
      targetEntity: 'Apartment',
      targetId: apartment._id,
      apartmentId: apartment._id,
      details: `Approved apartment complex "${apartment.name}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Apartment "${apartment.name}" approved successfully.`,
      data: apartment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/super-admin/apartments/:id/reject
 * Rejects a pending apartment onboarding application.
 */
export async function rejectApartment(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid apartment ID format.' },
      });
    }

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Apartment complex not found.' },
      });
    }

    const rejectionReason = (reason || '').trim() || 'Rejected by platform administrator.';

    apartment.status = 'rejected';
    apartment.rejectionReason = rejectionReason;
    apartment.reviewedBy = req.user._id;
    apartment.reviewedAt = new Date();
    await apartment.save();

    await logAudit({
      actor: req.user,
      action: 'APARTMENT_REJECT',
      targetEntity: 'Apartment',
      targetId: apartment._id,
      apartmentId: apartment._id,
      details: `Rejected apartment application "${apartment.name}". Reason: ${rejectionReason}`,
    });

    return res.status(200).json({
      success: true,
      message: `Apartment "${apartment.name}" rejected.`,
      data: apartment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/super-admin/apartments/:id/suspend
 * Suspends an active apartment complex.
 */
export async function suspendApartment(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid apartment ID format.' },
      });
    }

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Apartment complex not found.' },
      });
    }

    const suspensionReason = (reason || '').trim() || 'Suspended by platform administrator.';

    apartment.status = 'suspended';
    apartment.suspensionReason = suspensionReason;
    await apartment.save();

    await logAudit({
      actor: req.user,
      action: 'APARTMENT_SUSPEND',
      targetEntity: 'Apartment',
      targetId: apartment._id,
      apartmentId: apartment._id,
      details: `Suspended apartment complex "${apartment.name}". Reason: ${suspensionReason}`,
    });

    return res.status(200).json({
      success: true,
      message: `Apartment "${apartment.name}" suspended.`,
      data: apartment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/super-admin/apartments/:id/reactivate
 * Reactivates a suspended apartment complex.
 */
export async function reactivateApartment(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid apartment ID format.' },
      });
    }

    const apartment = await Apartment.findById(id);
    if (!apartment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Apartment complex not found.' },
      });
    }

    apartment.status = 'approved';
    apartment.suspensionReason = null;
    await apartment.save();

    await logAudit({
      actor: req.user,
      action: 'APARTMENT_REACTIVATE',
      targetEntity: 'Apartment',
      targetId: apartment._id,
      apartmentId: apartment._id,
      details: `Reactivated apartment complex "${apartment.name}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Apartment "${apartment.name}" reactivated successfully.`,
      data: apartment,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/super-admin/audit-logs
 * Searchable, filterable audit log records with date range, action, and entity filters.
 */
export async function getAuditLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 15));
    const search = (req.query.search || '').trim();
    const action = (req.query.action || '').trim().toUpperCase();
    const status = (req.query.status || '').trim().toUpperCase();
    const targetEntity = (req.query.resource || req.query.targetEntity || '').trim();
    const actorEmail = (req.query.actor || req.query.actorEmail || '').trim();
    const apartmentId = req.query.apartmentId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (action && action !== 'ALL') {
      filter.action = action;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (targetEntity && targetEntity !== 'ALL') {
      filter.targetEntity = { $regex: new RegExp(`^${targetEntity}$`, 'i') };
    }

    if (actorEmail) {
      filter.actorEmail = { $regex: actorEmail, $options: 'i' };
    }

    if (apartmentId && mongoose.Types.ObjectId.isValid(apartmentId)) {
      filter.apartmentId = apartmentId;
    }

    if (startDate) {
      filter.createdAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      filter.createdAt = { ...(filter.createdAt || {}), $lte: new Date(endDate) };
    }

    if (search) {
      filter.$or = [
        { details: { $regex: search, $options: 'i' } },
        { actorEmail: { $regex: search, $options: 'i' } },
        { targetEntity: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, rawLogs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const logs = rawLogs.map((l) => ({
      ...l,
      id: l._id.toString(),
      actor: l.actorEmail || 'System',
      target: l.targetEntity + (l.targetId ? ` (${l.targetId})` : ''),
      description: l.details || '',
      timestamp: l.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        logs,
        items: logs,
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/super-admin/profile
 * Super admin profile inspection.
 */
export async function getSuperAdminProfile(req, res) {
  return res.status(200).json({
    success: true,
    data: formatSafeUser(req.user),
  });
}

/**
 * PUT /api/v1/super-admin/profile
 * Super admin profile updating.
 */
export async function updateSuperAdminProfile(req, res, next) {
  try {
    const { name, phone } = req.body || {};

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      req.user.name = name.trim();
    }
    if (phone !== undefined) {
      req.user.phone = phone ? String(phone).trim() : null;
    }

    await req.user.save();

    await logAudit({
      actor: req.user,
      action: 'PROFILE_UPDATE',
      targetEntity: 'User',
      targetId: req.user._id,
      details: 'Super Admin updated profile details',
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: formatSafeUser(req.user),
    });
  } catch (err) {
    next(err);
  }
}
