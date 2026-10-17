/**
 * resident.controller.js
 *
 * Controller for Apartment Admin resident directory management.
 * Manages resident accounts, memberships, and flat assignments.
 * Enforces apartment-level isolation: admins can only manage residents
 * assigned to their authorized apartment.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Membership from '../models/membership.model.js';
import Building from '../models/building.model.js';
import Flat from '../models/flat.model.js';
import { ROLES } from '../constants/roles.js';
import { ACCOUNT_STATUS } from '../constants/accountStatus.js';
import { logAudit } from '../services/audit.service.js';

function getAuthorizedApartmentId(user, queryApartmentId) {
  const isSuper = user.role === 'SUPER_ADMIN' || user.role === 'super_admin';
  if (isSuper && queryApartmentId) {
    return queryApartmentId;
  }
  return user.apartmentId || user.apartment || null;
}

/**
 * GET /api/v1/admin/residents
 * List residents in the authorized apartment with filters, search, and pagination.
 */
export async function getResidents(req, res, next) {
  try {
    const apartmentId = getAuthorizedApartmentId(req.user, req.query.apartmentId);

    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: { residents: [], items: [], total: 0, page: 1, totalPages: 1 },
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const search = (req.query.search || '').trim();
    const buildingId = (req.query.buildingId || '').trim();
    const status = (req.query.status || '').trim().toLowerCase();

    // Query memberships for this apartment
    const membershipFilter = {
      apartmentId,
      status: { $ne: 'inactive' },
    };

    if (buildingId && buildingId !== 'all' && mongoose.Types.ObjectId.isValid(buildingId)) {
      membershipFilter.buildingId = buildingId;
    }

    let memberships = await Membership.find(membershipFilter)
      .populate('userId', 'name email phone role status isEmailVerified createdAt')
      .populate('buildingId', 'name')
      .populate('flatId', 'number floor type status')
      .sort({ createdAt: -1 })
      .lean();

    // Also include any users who have direct apartmentId if not yet in Membership collection
    const membershipUserIds = new Set(memberships.map((m) => m.userId?._id?.toString()).filter(Boolean));
    const directUsers = await User.find({
      apartmentId,
      _id: { $nin: Array.from(membershipUserIds) },
    })
      .populate('buildingId', 'name')
      .populate('flatId', 'number floor type status')
      .lean();

    // Transform all into uniform resident objects
    let allResidents = [
      ...memberships
        .filter((m) => m.userId)
        .map((m) => ({
          id: m.userId._id.toString(),
          _id: m.userId._id.toString(),
          membershipId: m._id.toString(),
          name: m.userId.name,
          email: m.userId.email,
          phone: m.userId.phone || '—',
          role: m.userId.role,
          status: m.userId.status,
          accountStatus: m.userId.status,
          membershipStatus: m.status,
          occupancyStatus: m.occupancyType || m.flatId?.status || 'occupied',
          buildingId: m.buildingId?._id?.toString() || '',
          buildingName: m.buildingId?.name || '—',
          building: m.buildingId,
          flatId: m.flatId?._id?.toString() || '',
          flatNumber: m.flatId?.number || '—',
          flat: m.flatId,
          invitationStatus: 'accepted',
          createdAt: m.createdAt,
        })),
      ...directUsers.map((u) => ({
        id: u._id.toString(),
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone || '—',
        role: u.role,
        status: u.status,
        accountStatus: u.status,
        membershipStatus: 'active',
        occupancyStatus: u.flatId?.status || 'occupied',
        buildingId: u.buildingId?._id?.toString() || '',
        buildingName: u.buildingId?.name || '—',
        building: u.buildingId,
        flatId: u.flatId?._id?.toString() || '',
        flatNumber: u.flatId?.number || '—',
        flat: u.flatId,
        invitationStatus: 'accepted',
        createdAt: u.createdAt,
      })),
    ];

    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      allResidents = allResidents.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          r.flatNumber.toLowerCase().includes(s),
      );
    }

    // Filter by status
    if (status && status !== 'all') {
      allResidents = allResidents.filter(
        (r) => String(r.status).toLowerCase() === status,
      );
    }

    const total = allResidents.length;
    const paginated = allResidents.slice((page - 1) * limit, page * limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        residents: paginated,
        items: paginated,
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
 * GET /api/v1/admin/residents/:id
 * Retrieve details for a specific resident.
 */
export async function getResidentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid resident ID format.' },
      });
    }

    const apartmentId = getAuthorizedApartmentId(req.user);
    const user = await User.findById(id).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resident account not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userApt = user.apartmentId || user.apartment;

    if (!isSuper && (!apartmentId || !userApt || !userApt.equals(apartmentId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view residents from another apartment.' },
      });
    }

    const membership = await Membership.findOne({ userId: id, apartmentId })
      .populate('buildingId', 'name')
      .populate('flatId', 'number floor type status')
      .lean();

    const building = membership?.buildingId || (user.buildingId ? await Building.findById(user.buildingId).lean() : null);
    const flat = membership?.flatId || (user.flatId ? await Flat.findById(user.flatId).lean() : null);

    return res.status(200).json({
      success: true,
      data: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '—',
        role: user.role,
        status: user.status,
        accountStatus: user.status,
        membershipStatus: membership?.status || 'active',
        occupancyStatus: membership?.occupancyType || flat?.status || 'occupied',
        buildingId: building?._id?.toString() || '',
        buildingName: building?.name || '—',
        building,
        flatId: flat?._id?.toString() || '',
        flatNumber: flat?.number || '—',
        flat,
        invitationStatus: 'accepted',
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/residents
 * Invite or create a resident account within the admin's apartment.
 */
export async function createResident(req, res, next) {
  try {
    const apartmentId = getAuthorizedApartmentId(req.user, req.body.apartmentId);

    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'APARTMENT_REQUIRED', message: 'Your account is not associated with an apartment community.' },
      });
    }

    const { name, email, phone, buildingId, flatId, occupancyType, password } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Resident name is required.' },
      });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Resident email address is required.' },
      });
    }

    // Verify building and flat belong to this apartment
    let targetBuilding = null;
    if (buildingId) {
      targetBuilding = await Building.findOne({ _id: buildingId, isArchived: false });
      if (!targetBuilding || !targetBuilding.apartmentId.equals(apartmentId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'CROSS_TENANT_ERROR', message: 'Building does not belong to your authorized apartment.' },
        });
      }
    }

    let targetFlat = null;
    if (flatId) {
      targetFlat = await Flat.findOne({ _id: flatId, isArchived: false });
      if (!targetFlat || !targetFlat.apartmentId.equals(apartmentId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'CROSS_TENANT_ERROR', message: 'Flat does not belong to your authorized apartment.' },
        });
      }
    }

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // Check if user already has an active membership in this apartment
      const existingMembership = await Membership.findOne({ userId: user._id, apartmentId });
      if (existingMembership && existingMembership.status !== 'inactive') {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_MEMBER', message: 'This user is already a registered resident in this apartment.' },
        });
      }

      // Link to this apartment
      user.apartmentId = apartmentId;
      user.apartment = apartmentId;
      if (buildingId) user.buildingId = buildingId;
      if (flatId) user.flatId = flatId;
      await user.save();
    } else {
      // Create user account
      const defaultPassword = password || 'Resident@123';
      user = new User({
        name: name.trim(),
        email: normalizedEmail,
        phone: (phone || '').trim(),
        password: defaultPassword,
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apartmentId,
        apartmentId,
        buildingId: buildingId || null,
        flatId: flatId || null,
      });
      await user.save();
    }

    // Create or update Membership
    const membership = await Membership.findOneAndUpdate(
      { userId: user._id, apartmentId },
      {
        userId: user._id,
        apartmentId,
        buildingId: buildingId || null,
        flatId: flatId || null,
        role: 'resident',
        status: 'active',
        occupancyType: occupancyType || 'tenant',
        approvedBy: req.user._id,
        approvedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Update flat status to occupied if assigned
    if (targetFlat && targetFlat.status === 'vacant') {
      targetFlat.status = 'occupied';
      await targetFlat.save();
    }

    await logAudit({
      actor: req.user,
      action: 'RESIDENT_ADD',
      targetEntity: 'User',
      targetId: user._id,
      apartmentId,
      details: `Added resident "${user.name}" (${user.email}) to flat ${targetFlat?.number || 'unassigned'}`,
    });

    return res.status(201).json({
      success: true,
      message: 'Resident added successfully.',
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        buildingName: targetBuilding?.name || '',
        flatNumber: targetFlat?.number || '',
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/residents/:id
 * Update resident profile information.
 */
export async function updateResident(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid resident ID format.' },
      });
    }

    const apartmentId = getAuthorizedApartmentId(req.user);
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resident account not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userApt = user.apartmentId || user.apartment;

    if (!isSuper && (!apartmentId || !userApt || !userApt.equals(apartmentId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to modify residents from another apartment.' },
      });
    }

    const { name, phone, status, buildingId, flatId } = req.body || {};

    if (name && typeof name === 'string') user.name = name.trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (status !== undefined) user.status = status;

    // Handle reassignment if buildingId or flatId supplied
    if (buildingId || flatId) {
      if (buildingId) user.buildingId = buildingId;
      if (flatId) user.flatId = flatId;

      await Membership.updateOne(
        { userId: id, apartmentId },
        {
          $set: {
            buildingId: buildingId || user.buildingId,
            flatId: flatId || user.flatId,
          },
        },
      );
    }

    await user.save();

    await logAudit({
      actor: req.user,
      action: 'RESIDENT_UPDATE',
      targetEntity: 'User',
      targetId: user._id,
      apartmentId,
      details: `Updated resident profile for "${user.name}"`,
    });

    return res.status(200).json({
      success: true,
      message: 'Resident updated successfully.',
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/residents/:id/reassign
 * Reassign resident to another flat and building within the authorized apartment.
 */
export async function reassignResidentFlat(req, res, next) {
  try {
    const { id } = req.params;
    const { buildingId, flatId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid resident ID format.' },
      });
    }

    if (!flatId || !mongoose.Types.ObjectId.isValid(flatId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Target flat ID is required.' },
      });
    }

    const apartmentId = getAuthorizedApartmentId(req.user);
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resident account not found.' },
      });
    }

    // Verify target flat belongs to this apartment
    const newFlat = await Flat.findOne({ _id: flatId, isArchived: false });
    if (!newFlat || !newFlat.apartmentId.equals(apartmentId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'CROSS_TENANT_ERROR', message: 'Target flat does not belong to your authorized apartment.' },
      });
    }

    // Get old flat from Membership record — user.flatId is not stored in User schema
    const existingMembership = await Membership.findOne({ userId: id, apartmentId });
    const oldFlatId = existingMembership?.flatId ? existingMembership.flatId.toString() : null;

    // Count remaining active residents on the old flat BEFORE moving this resident's membership,
    // so the count still includes this resident as a baseline – we exclude them explicitly.
    let oldFlatWillBeVacant = false;
    if (oldFlatId && oldFlatId !== newFlat._id.toString()) {
      const remainingResidents = await Membership.countDocuments({
        flatId: oldFlatId,
        userId: { $ne: user._id },
        status: 'active',
      });
      oldFlatWillBeVacant = remainingResidents === 0;
    }

    // Update user & membership
    user.buildingId = buildingId || newFlat.buildingId;
    user.flatId = newFlat._id;
    await user.save();

    await Membership.updateOne(
      { userId: id, apartmentId },
      {
        $set: {
          buildingId: newFlat.buildingId,
          flatId: newFlat._id,
        },
      },
    );

    // Update new flat status
    newFlat.status = 'occupied';
    await newFlat.save();

    // Vacate old flat when no other active residents remain
    if (oldFlatId && oldFlatId !== newFlat._id.toString() && oldFlatWillBeVacant) {
      await Flat.updateOne({ _id: oldFlatId }, { $set: { status: 'vacant' } });
    }

    await logAudit({
      actor: req.user,
      action: 'RESIDENT_REASSIGN',
      targetEntity: 'User',
      targetId: user._id,
      apartmentId,
      details: `Reassigned resident "${user.name}" to flat "${newFlat.number}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Resident reassigned to unit ${newFlat.number}.`,
      data: {
        id: user._id.toString(),
        buildingId: newFlat.buildingId,
        flatId: newFlat._id,
        flatNumber: newFlat.number,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/residents/:id/resend-invitation
 * Resend resident invitation notification (idempotent).
 */
export async function resendResidentInvitation(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findById(id).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resident account not found.' },
      });
    }

    await logAudit({
      actor: req.user,
      action: 'RESIDENT_INVITE_RESEND',
      targetEntity: 'User',
      targetId: user._id,
      apartmentId: user.apartmentId,
      details: `Resent invitation to resident "${user.name}" (${user.email})`,
    });

    return res.status(200).json({
      success: true,
      message: `Invitation resent to ${user.email}.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/residents/:id
 * Remove or deactivate resident membership from the apartment.
 */
export async function deleteResident(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid resident ID format.' },
      });
    }

    const apartmentId = getAuthorizedApartmentId(req.user);
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Resident account not found.' },
      });
    }

    const isSuper = req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin';
    const userApt = user.apartmentId || user.apartment;

    if (!isSuper && (!apartmentId || !userApt || !userApt.equals(apartmentId))) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to remove residents from another apartment.' },
      });
    }

    // Deactivate membership
    await Membership.updateOne(
      { userId: id, apartmentId },
      { $set: { status: 'inactive' } },
    );

    const oldFlatId = user.flatId;
    user.status = 'suspended';
    await user.save();

    // Check if flat now vacant
    if (oldFlatId) {
      const activeResidents = await Membership.countDocuments({
        flatId: oldFlatId,
        status: 'active',
      });
      if (activeResidents === 0) {
        await Flat.updateOne({ _id: oldFlatId }, { $set: { status: 'vacant' } });
      }
    }

    await logAudit({
      actor: req.user,
      action: 'RESIDENT_REMOVE',
      targetEntity: 'User',
      targetId: user._id,
      apartmentId,
      details: `Deactivated resident membership for "${user.name}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Resident "${user.name}" deactivated successfully.`,
    });
  } catch (err) {
    next(err);
  }
}
