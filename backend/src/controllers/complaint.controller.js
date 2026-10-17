/**
 * complaint.controller.js
 *
 * Handles Maintenance Requests / Complaints for three actor groups:
 *
 *   APARTMENT_ADMIN / SUPER_ADMIN  → /api/v1/admin/complaints
 *   RESIDENT                       → /api/v1/resident/complaints
 *   MAINTENANCE_STAFF              → /api/v1/admin/complaints (scoped to assigned)
 *
 * Authorization rules enforced server-side on every handler:
 *   - All queries are scoped to the actor's apartmentId.
 *   - Residents may only see/create their own submissions.
 *   - Residents cannot change status or assign staff.
 *   - Staff can only update status/add notes to assigned requests.
 *   - Admins manage all requests in their apartment.
 *   - Super Admins have cross-apartment read via query param.
 */

import mongoose from 'mongoose';
import Complaint from '../models/complaint.model.js';
import WorkOrder from '../models/work-order.model.js';
import User from '../models/User.js';
import Building from '../models/building.model.js';
import Flat from '../models/flat.model.js';
import Membership from '../models/membership.model.js';
import { logAudit } from '../services/audit.service.js';
import { ROLES } from '../constants/roles.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function canonicalRole(role) {
  const MAP = {
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
  return MAP[role] || String(role || '').toUpperCase();
}

function isSuperAdmin(user) {
  return canonicalRole(user.role) === 'SUPER_ADMIN';
}
function isAdmin(user) {
  const r = canonicalRole(user.role);
  return r === 'APARTMENT_ADMIN' || r === 'SUPER_ADMIN';
}
function isResident(user) {
  return canonicalRole(user.role) === 'RESIDENT';
}
function isStaff(user) {
  return canonicalRole(user.role) === 'MAINTENANCE_STAFF';
}

function getApartmentId(user, queryApartmentId) {
  if (isSuperAdmin(user) && queryApartmentId) return queryApartmentId;
  return user.apartmentId || user.apartment || null;
}

/**
 * Safely serialize a complaint document for API response.
 * Enriches with populated sub-documents and convenience aliases.
 */
function formatComplaint(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };

  // Convenience aliases the frontend uses
  obj.title = obj.subject;
  obj.residentName = obj.requestedBy?.name || '';
  obj.buildingName = obj.buildingId?.name || '';
  obj.flatNumber = obj.flatId?.number || '';
  obj.assignedToName = obj.assignedTo?.name || '';
  // Ticket number fallback
  obj.ticketNumber = obj.ticketNumber || `#${String(obj._id).slice(-6)}`;
  return obj;
}

// ── Shared list query builder ─────────────────────────────────────────────────

async function buildListQuery(req, scopeOverride = null) {
  const user = req.user;
  const q = req.query;

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(q.limit, 10) || 10));
  const search = (q.search || '').trim();
  const status = (q.status || '').trim().toLowerCase();
  const priority = (q.priority || '').trim().toLowerCase();
  const category = (q.category || '').trim().toLowerCase();
  const buildingId = (q.buildingId || '').trim();
  const flatId = (q.flatId || '').trim();
  const sortBy = q.sortBy || 'createdAt';
  const sortOrder = q.sortOrder === 'asc' ? 1 : -1;

  const apartmentId = scopeOverride || getApartmentId(user, q.apartmentId);

  const filter = {};
  if (apartmentId) filter.apartmentId = apartmentId;

  // Resident only sees their own
  if (isResident(user)) {
    filter.requestedBy = user._id;
  }

  // Staff only sees assigned to them
  if (isStaff(user)) {
    filter.assignedTo = user._id;
  }

  if (status && status !== 'all') filter.status = status;
  if (priority && priority !== 'all') filter.priority = priority;
  if (category && category !== 'all') filter.category = category;
  if (buildingId && mongoose.Types.ObjectId.isValid(buildingId)) {
    filter.buildingId = buildingId;
  }
  if (flatId && mongoose.Types.ObjectId.isValid(flatId)) {
    filter.flatId = flatId;
  }
  if (search) {
    filter.$text = { $search: search };
  }

  const allowedSortFields = {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    priority: 'priority',
    status: 'status',
    subject: 'subject',
  };
  const sortField = allowedSortFields[sortBy] || 'createdAt';

  return { filter, page, limit, sortField, sortOrder };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST  GET /api/v1/admin/complaints
//       GET /api/v1/resident/complaints
// ─────────────────────────────────────────────────────────────────────────────
export async function listComplaints(req, res, next) {
  try {
    const { filter, page, limit, sortField, sortOrder } = await buildListQuery(req);

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('requestedBy', 'name email')
        .populate('assignedTo', 'name email')
        .populate('buildingId', 'name')
        .populate('flatId', 'number')
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const items = complaints.map((c) => {
      c.title = c.subject;
      c.residentName = c.requestedBy?.name || '';
      c.buildingName = c.buildingId?.name || '';
      c.flatNumber = c.flatId?.number || '';
      c.assignedToName = c.assignedTo?.name || '';
      c.ticketNumber = c.ticketNumber || `#${String(c._id).slice(-6)}`;
      return c;
    });

    return res.status(200).json({
      success: true,
      data: {
        complaints: items,
        requests: items,
        items,
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

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE  GET /api/v1/admin/complaints/:id
//             GET /api/v1/resident/complaints/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function getComplaintById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid complaint ID format.' },
      });
    }

    const complaint = await Complaint.findById(id)
      .populate('requestedBy', 'name email phone')
      .populate('assignedTo', 'name email phone')
      .populate('buildingId', 'name')
      .populate('flatId', 'number floor')
      .populate('comments.authorId', 'name role');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const apartmentId = getApartmentId(req.user, req.query.apartmentId);

    // Multi-tenant isolation
    if (!isSuperAdmin(req.user) && apartmentId) {
      if (!complaint.apartmentId.equals(apartmentId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access to this complaint is not permitted.' },
        });
      }
    }

    // Residents can only see their own
    if (isResident(req.user) && !complaint.requestedBy._id.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only view your own complaints.' },
      });
    }

    // Staff can only see assigned ones
    if (
      isStaff(req.user) &&
      complaint.assignedTo &&
      !complaint.assignedTo._id.equals(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access to this work order is not permitted.' },
      });
    }

    const obj = formatComplaint(complaint);
    return res.status(200).json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  POST /api/v1/admin/complaints
//         POST /api/v1/resident/complaints
// ─────────────────────────────────────────────────────────────────────────────
export async function createComplaint(req, res, next) {
  try {
    const user = req.user;
    const { subject, description, category, priority, buildingId, flatId } = req.body || {};

    // Validation
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Subject is required.' },
      });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Description must be at least 10 characters.',
        },
      });
    }
    if (!category) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Category is required.' },
      });
    }

    // Resolve apartment
    const apartmentId = getApartmentId(user, req.body.apartmentId);
    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'APARTMENT_REQUIRED',
          message: 'Your account is not associated with an apartment community.',
        },
      });
    }

    // Validate building/flat belong to same apartment
    if (buildingId && mongoose.Types.ObjectId.isValid(buildingId)) {
      const building = await Building.findOne({ _id: buildingId, isArchived: false });
      if (!building || !building.apartmentId.equals(apartmentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CROSS_TENANT_ERROR',
            message: 'Building does not belong to your apartment.',
          },
        });
      }
    }
    if (flatId && mongoose.Types.ObjectId.isValid(flatId)) {
      const flat = await Flat.findOne({ _id: flatId, isArchived: false });
      if (!flat || !flat.apartmentId.equals(apartmentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CROSS_TENANT_ERROR',
            message: 'Flat does not belong to your apartment.',
          },
        });
      }

      // Resident must be a member of that flat or at least that apartment
      if (isResident(user)) {
        const membership = await Membership.findOne({
          userId: user._id,
          apartmentId,
          status: 'active',
        });
        if (!membership) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'NOT_MEMBER',
              message: 'You are not an active member of this apartment community.',
            },
          });
        }
      }
    }

    const complaint = new Complaint({
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority: priority || 'medium',
      apartmentId,
      buildingId: buildingId && mongoose.Types.ObjectId.isValid(buildingId) ? buildingId : null,
      flatId: flatId && mongoose.Types.ObjectId.isValid(flatId) ? flatId : null,
      requestedBy: user._id,
      statusHistory: [
        {
          changedBy: user._id,
          changedByName: user.name || '',
          changedByRole: user.role || '',
          fromStatus: null,
          toStatus: 'pending',
          note: 'Complaint submitted.',
        },
      ],
    });

    await complaint.save();

    logAudit({
      actor: user,
      action: 'COMPLAINT_CREATE',
      targetEntity: 'Complaint',
      targetId: complaint._id,
      apartmentId,
      details: `Submitted complaint "${complaint.subject}" (${complaint.ticketNumber})`,
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('requestedBy', 'name email')
      .populate('buildingId', 'name')
      .populate('flatId', 'number');

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      data: formatComplaint(populated),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(err.errors)
            .map((e) => e.message)
            .join('; '),
        },
      });
    }
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  PUT /api/v1/admin/complaints/:id
// Admins: status, priority, assignedTo, resolutionNotes
// Staff:  status (in_progress or resolved only), resolutionNotes
// Residents: not permitted via this route
// ─────────────────────────────────────────────────────────────────────────────
export async function updateComplaint(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid complaint ID format.' },
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const user = req.user;
    const apartmentId = getApartmentId(user, req.query.apartmentId);

    // Multi-tenant isolation
    if (!isSuperAdmin(user) && apartmentId) {
      if (!complaint.apartmentId.equals(apartmentId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access to this complaint is not permitted.' },
        });
      }
    }

    // Staff: can only update their assigned complaints
    if (isStaff(user)) {
      if (!complaint.assignedTo || !complaint.assignedTo.equals(user._id)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only update work orders assigned to you.',
          },
        });
      }
    }

    // Residents: cannot update via this endpoint
    if (isResident(user)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Residents cannot update complaint status or assignments.',
        },
      });
    }

    const { status, priority, assignedTo, resolutionNotes } = req.body || {};
    const oldStatus = complaint.status;
    let changed = false;

    // Status transition
    if (status && status !== oldStatus) {
      const allowed = ['pending', 'in_progress', 'resolved', 'closed', 'cancelled'];

      // Staff can only move to in_progress or resolved
      if (isStaff(user) && !['in_progress', 'resolved'].includes(status)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Maintenance staff can only set status to in_progress or resolved.',
          },
        });
      }

      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Invalid status: ${status}` },
        });
      }

      complaint.statusHistory.push({
        changedBy: user._id,
        changedByName: user.name || '',
        changedByRole: user.role || '',
        fromStatus: oldStatus,
        toStatus: status,
        note: req.body.statusNote || '',
      });
      complaint.status = status;
      if (status === 'resolved') {
        complaint.resolvedAt = new Date();
      }
      changed = true;
    }

    // Admin-only fields
    if (isAdmin(user)) {
      if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
        complaint.priority = priority;
        changed = true;
      }

      if (assignedTo !== undefined) {
        if (assignedTo === null || assignedTo === '') {
          complaint.assignedTo = null;
          changed = true;
        } else if (mongoose.Types.ObjectId.isValid(assignedTo)) {
          // Verify the assigned user is MAINTENANCE_STAFF in this apartment
          const staffUser = await User.findById(assignedTo);
          if (!staffUser) {
            return res.status(404).json({
              success: false,
              error: { code: 'NOT_FOUND', message: 'Assigned staff user not found.' },
            });
          }
          if (canonicalRole(staffUser.role) !== 'MAINTENANCE_STAFF') {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_STAFF',
                message: 'The assigned user must be a Maintenance Staff member.',
              },
            });
          }
          const staffApt = staffUser.apartmentId || staffUser.apartment;
          if (
            staffApt &&
            apartmentId &&
            !staffApt.equals(apartmentId)
          ) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'CROSS_TENANT_ERROR',
                message: 'Staff member must belong to the same apartment community.',
              },
            });
          }
          complaint.assignedTo = staffUser._id;

          // Auto-move to in_progress when assigning
          if (complaint.status === 'pending') {
            complaint.statusHistory.push({
              changedBy: user._id,
              changedByName: user.name || '',
              changedByRole: user.role || '',
              fromStatus: complaint.status,
              toStatus: 'in_progress',
              note: `Assigned to ${staffUser.name}.`,
            });
            complaint.status = 'in_progress';
          }
          changed = true;
        }
      }
    }

    if (resolutionNotes !== undefined) {
      complaint.resolutionNotes = String(resolutionNotes || '').trim();
      changed = true;
    }

    if (!changed) {
      return res.status(200).json({
        success: true,
        message: 'No changes detected.',
        data: formatComplaint(complaint),
      });
    }

    await complaint.save();

    logAudit({
      actor: user,
      action: 'COMPLAINT_UPDATE',
      targetEntity: 'Complaint',
      targetId: complaint._id,
      apartmentId: complaint.apartmentId,
      details: `Updated complaint "${complaint.subject}" — status: ${complaint.status}`,
    });

    const populated = await Complaint.findById(complaint._id)
      .populate('requestedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('buildingId', 'name')
      .populate('flatId', 'number');

    return res.status(200).json({
      success: true,
      message: 'Complaint updated successfully.',
      data: formatComplaint(populated),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: Object.values(err.errors)
            .map((e) => e.message)
            .join('; '),
        },
      });
    }
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD COMMENT  POST /api/v1/admin/complaints/:id/comments
//              POST /api/v1/resident/complaints/:id/comments
// ─────────────────────────────────────────────────────────────────────────────
export async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid complaint ID format.' },
      });
    }

    const { comment } = req.body || {};
    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Comment text is required.' },
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const user = req.user;
    const apartmentId = getApartmentId(user, null);

    // Multi-tenant isolation
    if (!isSuperAdmin(user) && apartmentId) {
      if (!complaint.apartmentId.equals(apartmentId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access to this complaint is not permitted.' },
        });
      }
    }

    // Resident can only comment on their own
    if (isResident(user) && !complaint.requestedBy.equals(user._id)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only comment on your own complaints.' },
      });
    }

    // Staff can only comment on assigned
    if (
      isStaff(user) &&
      complaint.assignedTo &&
      !complaint.assignedTo.equals(user._id)
    ) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only comment on assigned work orders.' },
      });
    }

    complaint.comments.push({
      authorId: user._id,
      authorName: user.name || '',
      authorRole: user.role || '',
      comment: comment.trim(),
    });

    await complaint.save();

    const newComment = complaint.comments[complaint.comments.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Note added successfully.',
      data: {
        comment: newComment.comment,
        author: newComment.authorName,
        authorRole: newComment.authorRole,
        createdAt: newComment.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE  DELETE /api/v1/admin/complaints/:id  (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteComplaint(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid complaint ID format.' },
      });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const user = req.user;
    const apartmentId = getApartmentId(user, null);

    if (!isSuperAdmin(user) && apartmentId) {
      if (!complaint.apartmentId.equals(apartmentId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access to this complaint is not permitted.' },
        });
      }
    }

    await Complaint.deleteOne({ _id: id });

    logAudit({
      actor: user,
      action: 'COMPLAINT_DELETE',
      targetEntity: 'Complaint',
      targetId: id,
      apartmentId: complaint.apartmentId,
      details: `Deleted complaint "${complaint.subject}" (${complaint.ticketNumber})`,
    });

    return res.status(200).json({
      success: true,
      message: 'Complaint deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}
