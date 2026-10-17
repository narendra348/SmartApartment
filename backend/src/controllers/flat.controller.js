/**
 * flat.controller.js
 *
 * Controller for Apartment Admin flats/units management.
 * Enforces apartment boundaries and building associations.
 * Ensures uniqueness of unit numbers within a building block.
 */

import mongoose from 'mongoose';
import Flat from '../models/flat.model.js';
import Building from '../models/building.model.js';
import Membership from '../models/membership.model.js';
import { logAudit } from '../services/audit.service.js';

function getAuthorizedApartmentId(user, queryApartmentId) {
  const isSuper = user.role === 'SUPER_ADMIN' || user.role === 'super_admin';
  if (isSuper && queryApartmentId) {
    return queryApartmentId;
  }
  return user.apartmentId || user.apartment || null;
}

/**
 * GET /api/v1/admin/flats
 * List flats with building filter, occupancy status filter, search, and pagination.
 */
export async function getFlats(req, res, next) {
  try {
    const apartmentId = getAuthorizedApartmentId(req.user, req.query.apartmentId);

    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: { flats: [], items: [], total: 0, page: 1, totalPages: 1 },
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || '').trim();
    const buildingId = (req.query.buildingId || '').trim();
    const occupancyStatus = (req.query.occupancyStatus || '').trim().toLowerCase();

    const filter = { apartmentId, isArchived: false };

    if (buildingId && buildingId !== 'all' && mongoose.Types.ObjectId.isValid(buildingId)) {
      filter.buildingId = buildingId;
    }

    if (occupancyStatus && occupancyStatus !== 'all') {
      filter.status = occupancyStatus;
    }

    if (search) {
      filter.number = { $regex: search, $options: 'i' };
    }

    const [total, rawFlats] = await Promise.all([
      Flat.countDocuments(filter),
      Flat.find(filter)
        .populate('buildingId', 'name')
        .sort({ number: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const flats = rawFlats.map((f) => ({
      ...f,
      id: f._id.toString(),
      buildingName: f.buildingId?.name || '',
      building: f.buildingId,
      occupancyStatus: f.status,
      flatNumber: f.number,
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        flats,
        items: flats,
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
 * GET /api/v1/admin/flats/:id
 * Retrieve flat details by ID.
 */
export async function getFlatById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid flat ID format.' },
      });
    }

    const flat = await Flat.findOne({ _id: id, isArchived: false })
      .populate('buildingId', 'name')
      .lean();

    if (!flat) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Flat unit not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userAptId = req.user.apartmentId || req.user.apartment;

    if (!isSuper && (!userAptId || !flat.apartmentId.equals(userAptId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view units in another apartment.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...flat,
        id: flat._id.toString(),
        buildingName: flat.buildingId?.name || '',
        building: flat.buildingId,
        occupancyStatus: flat.status,
        flatNumber: flat.number,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/flats
 * Create a new flat unit under a building.
 */
export async function createFlat(req, res, next) {
  try {
    const apartmentId = getAuthorizedApartmentId(req.user, req.body.apartmentId);

    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'APARTMENT_REQUIRED', message: 'Your account is not associated with an apartment community.' },
      });
    }

    const { buildingId, number, floor, type, status, rent } = req.body || {};

    if (!buildingId || !mongoose.Types.ObjectId.isValid(buildingId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A valid building association is required.' },
      });
    }

    if (!number || typeof number !== 'string' || !number.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Flat/Unit number is required.' },
      });
    }

    // Verify building belongs to the authorized apartment
    const building = await Building.findOne({ _id: buildingId, isArchived: false });
    if (!building || !building.apartmentId.equals(apartmentId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'CROSS_TENANT_ERROR', message: 'The referenced building does not belong to your authorized apartment.' },
      });
    }

    const normalizedNumber = number.trim();

    // Enforce unique unit number within the building
    const existing = await Flat.findOne({
      buildingId,
      number: { $regex: new RegExp(`^${normalizedNumber}$`, 'i') },
      isArchived: false,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_FLAT', message: `Unit "${normalizedNumber}" already exists in ${building.name}.` },
      });
    }

    const flat = new Flat({
      apartmentId,
      buildingId,
      number: normalizedNumber,
      floor: parseInt(floor, 10) || 1,
      type: type || '2BHK',
      status: (status || 'vacant').toLowerCase(),
      rent: Math.max(0, parseFloat(rent) || 0),
    });

    await flat.save();

    await logAudit({
      actor: req.user,
      action: 'FLAT_CREATE',
      targetEntity: 'Flat',
      targetId: flat._id,
      apartmentId,
      details: `Created unit "${flat.number}" in building "${building.name}"`,
    });

    return res.status(201).json({
      success: true,
      message: 'Flat unit created successfully.',
      data: {
        ...flat.toObject(),
        id: flat._id.toString(),
        buildingName: building.name,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/flats/:id
 * Update flat unit details.
 */
export async function updateFlat(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid flat ID format.' },
      });
    }

    const flat = await Flat.findOne({ _id: id, isArchived: false });
    if (!flat) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Flat unit not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userAptId = req.user.apartmentId || req.user.apartment;

    if (!isSuper && (!userAptId || !flat.apartmentId.equals(userAptId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to modify units in another apartment.' },
      });
    }

    const { buildingId, number, floor, type, status, rent } = req.body || {};

    const targetBuildingId = buildingId || flat.buildingId;

    if (buildingId && !flat.buildingId.equals(buildingId)) {
      const targetBuilding = await Building.findOne({ _id: buildingId, isArchived: false });
      if (!targetBuilding || !targetBuilding.apartmentId.equals(flat.apartmentId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'CROSS_TENANT_ERROR', message: 'Target building does not belong to this apartment.' },
        });
      }
      flat.buildingId = buildingId;
    }

    if (number && number.trim() && number.trim().toLowerCase() !== flat.number.toLowerCase()) {
      const duplicate = await Flat.findOne({
        _id: { $ne: id },
        buildingId: targetBuildingId,
        number: { $regex: new RegExp(`^${number.trim()}$`, 'i') },
        isArchived: false,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_FLAT', message: `Unit "${number.trim()}" already exists in this building block.` },
        });
      }
      flat.number = number.trim();
    }

    if (floor !== undefined) flat.floor = parseInt(floor, 10) || flat.floor;
    if (type !== undefined) flat.type = type;
    if (status !== undefined) flat.status = status.toLowerCase();
    if (rent !== undefined) flat.rent = Math.max(0, parseFloat(rent) || 0);

    await flat.save();

    await logAudit({
      actor: req.user,
      action: 'FLAT_UPDATE',
      targetEntity: 'Flat',
      targetId: flat._id,
      apartmentId: flat.apartmentId,
      details: `Updated flat unit "${flat.number}"`,
    });

    return res.status(200).json({
      success: true,
      message: 'Flat unit updated successfully.',
      data: flat,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/flats/:id
 * Safe archival of a flat.
 */
export async function deleteFlat(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid flat ID format.' },
      });
    }

    const flat = await Flat.findOne({ _id: id, isArchived: false });
    if (!flat) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Flat unit not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userAptId = req.user.apartmentId || req.user.apartment;

    if (!isSuper && (!userAptId || !flat.apartmentId.equals(userAptId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to delete units in another apartment.' },
      });
    }

    // Safe archival preserving history
    flat.isArchived = true;
    flat.status = 'vacant';
    await flat.save();

    await logAudit({
      actor: req.user,
      action: 'FLAT_DELETE',
      targetEntity: 'Flat',
      targetId: flat._id,
      apartmentId: flat.apartmentId,
      details: `Deactivated flat unit "${flat.number}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Flat unit "${flat.number}" deactivated successfully.`,
    });
  } catch (err) {
    next(err);
  }
}
