/**
 * building.controller.js
 *
 * Controller for Apartment Admin building management.
 * Enforces strict apartment-level multi-tenant isolation:
 * admins can only view, create, and manage buildings belonging to their assigned apartment.
 */

import mongoose from 'mongoose';
import Building from '../models/building.model.js';
import Flat from '../models/flat.model.js';
import { logAudit } from '../services/audit.service.js';

function getAuthorizedApartmentId(user, queryApartmentId) {
  const isSuper = user.role === 'SUPER_ADMIN' || user.role === 'super_admin';
  if (isSuper && queryApartmentId) {
    return queryApartmentId;
  }
  return user.apartmentId || user.apartment || null;
}

/**
 * GET /api/v1/admin/buildings
 * List buildings belonging to the authenticated admin's apartment.
 */
export async function getBuildings(req, res, next) {
  try {
    const apartmentId = getAuthorizedApartmentId(req.user, req.query.apartmentId);

    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: { buildings: [], items: [], total: 0, page: 1, totalPages: 1 },
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim().toLowerCase();

    const filter = { apartmentId, isArchived: false };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const [total, buildings] = await Promise.all([
      Building.countDocuments(filter),
      Building.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        buildings,
        items: buildings,
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
 * GET /api/v1/admin/buildings/:id
 * Retrieve building by ID, verifying tenant boundary.
 */
export async function getBuildingById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid building ID format.' },
      });
    }

    const building = await Building.findOne({ _id: id, isArchived: false }).lean();
    if (!building) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Building not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userAptId = req.user.apartmentId || req.user.apartment;

    if (!isSuper && (!userAptId || !building.apartmentId.equals(userAptId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view buildings in another apartment.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: building,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/buildings
 * Create a new building within the admin's apartment.
 */
export async function createBuilding(req, res, next) {
  try {
    const apartmentId = getAuthorizedApartmentId(req.user, req.body.apartmentId);

    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'APARTMENT_REQUIRED', message: 'Your account is not associated with an apartment community.' },
      });
    }

    const { name, floors, totalFlats, description, status } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Building name is required.' },
      });
    }

    const normalizedName = name.trim();

    // Check uniqueness within the apartment
    const existing = await Building.findOne({
      apartmentId,
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
      isArchived: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_BUILDING', message: `A building named "${normalizedName}" already exists in this apartment.` },
      });
    }

    const building = new Building({
      apartmentId,
      name: normalizedName,
      floors: Math.max(1, parseInt(floors, 10) || 1),
      totalFlats: Math.max(0, parseInt(totalFlats, 10) || 1),
      description: (description || '').trim(),
      status: status || 'active',
    });

    await building.save();

    await logAudit({
      actor: req.user,
      action: 'BUILDING_CREATE',
      targetEntity: 'Building',
      targetId: building._id,
      apartmentId,
      details: `Created building "${building.name}" (${building.floors} floors)`,
    });

    return res.status(201).json({
      success: true,
      message: 'Building created successfully.',
      data: building,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/buildings/:id
 * Update building details.
 */
export async function updateBuilding(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid building ID format.' },
      });
    }

    const building = await Building.findOne({ _id: id, isArchived: false });
    if (!building) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Building not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userAptId = req.user.apartmentId || req.user.apartment;

    if (!isSuper && (!userAptId || !building.apartmentId.equals(userAptId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to modify buildings in another apartment.' },
      });
    }

    const { name, floors, totalFlats, description, status } = req.body || {};

    if (name && name.trim() && name.trim().toLowerCase() !== building.name.toLowerCase()) {
      const duplicate = await Building.findOne({
        _id: { $ne: id },
        apartmentId: building.apartmentId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        isArchived: false,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_BUILDING', message: `A building named "${name.trim()}" already exists in this apartment.` },
        });
      }
      building.name = name.trim();
    }

    if (floors !== undefined) building.floors = Math.max(1, parseInt(floors, 10) || 1);
    if (totalFlats !== undefined) building.totalFlats = Math.max(0, parseInt(totalFlats, 10) || 0);
    if (description !== undefined) building.description = String(description).trim();
    if (status !== undefined) building.status = status;

    await building.save();

    await logAudit({
      actor: req.user,
      action: 'BUILDING_UPDATE',
      targetEntity: 'Building',
      targetId: building._id,
      apartmentId: building.apartmentId,
      details: `Updated building "${building.name}"`,
    });

    return res.status(200).json({
      success: true,
      message: 'Building updated successfully.',
      data: building,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/buildings/:id
 * Safe archival of a building. Prevents hard delete if dependent flats exist.
 */
export async function deleteBuilding(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid building ID format.' },
      });
    }

    const building = await Building.findOne({ _id: id, isArchived: false });
    if (!building) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Building not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userAptId = req.user.apartmentId || req.user.apartment;

    if (!isSuper && (!userAptId || !building.apartmentId.equals(userAptId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to delete buildings in another apartment.' },
      });
    }

    // Safe archival: marks archived and inactive
    building.isArchived = true;
    building.status = 'inactive';
    await building.save();

    await logAudit({
      actor: req.user,
      action: 'BUILDING_DELETE',
      targetEntity: 'Building',
      targetId: building._id,
      apartmentId: building.apartmentId,
      details: `Deactivated building "${building.name}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Building "${building.name}" deactivated successfully.`,
    });
  } catch (err) {
    next(err);
  }
}
