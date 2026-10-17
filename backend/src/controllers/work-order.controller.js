/**
 * work-order.controller.js
 *
 * Handles Work Order CRUD for:
 *   APARTMENT_ADMIN / SUPER_ADMIN  → /api/v1/admin/work-orders
 *   MAINTENANCE_STAFF              → /api/v1/admin/work-orders (scoped to assigned)
 *
 * Authorization:
 *   - Admins create, list, and manage all work orders in their apartment.
 *   - Staff can only list and update work orders assigned to them.
 *   - Duplicate work order per complaint is rejected (unique index + runtime check).
 *   - All queries are scoped to the actor's apartmentId.
 */

import mongoose from 'mongoose';
import WorkOrder from '../models/work-order.model.js';
import Complaint from '../models/complaint.model.js';
import User from '../models/User.js';
import { logAudit } from '../services/audit.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function canonicalRole(role) {
  const MAP = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    super_admin: 'SUPER_ADMIN',
    APARTMENT_ADMIN: 'APARTMENT_ADMIN',
    admin: 'APARTMENT_ADMIN',
    APARTMENT_ADMIN: 'APARTMENT_ADMIN',
    RESIDENT: 'RESIDENT',
    resident: 'RESIDENT',
    MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',
    staff: 'MAINTENANCE_STAFF',
  };
  return MAP[role] || String(role || '').toUpperCase();
}

function isSuperAdmin(user) { return canonicalRole(user.role) === 'SUPER_ADMIN'; }
function isAdmin(user) {
  const r = canonicalRole(user.role);
  return r === 'APARTMENT_ADMIN' || r === 'SUPER_ADMIN';
}
function isStaff(user) { return canonicalRole(user.role) === 'MAINTENANCE_STAFF'; }

function getApartmentId(user, queryApartmentId) {
  if (isSuperAdmin(user) && queryApartmentId) return queryApartmentId;
  return user.apartmentId || user.apartment || null;
}

function formatWorkOrder(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.assignedToName = obj.assignedTo?.name || '';
  obj.createdByName = obj.createdBy?.name || '';
  obj.sourceTicket = obj.complaintId?.ticketNumber || '';
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST  GET /api/v1/admin/work-orders
// ─────────────────────────────────────────────────────────────────────────────
export async function listWorkOrders(req, res, next) {
  try {
    const user = req.user;
    const q = req.query;
    const apartmentId = getApartmentId(user, q.apartmentId);

    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(q.limit, 10) || 10));
    const status = (q.status || '').trim().toLowerCase();

    const filter = {};
    if (apartmentId) filter.apartmentId = apartmentId;
    if (isStaff(user)) filter.assignedTo = user._id;
    if (status && status !== 'all') filter.status = status;

    const [total, workOrders] = await Promise.all([
      WorkOrder.countDocuments(filter),
      WorkOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name')
        .populate('complaintId', 'ticketNumber subject')
        .lean(),
    ]);

    const items = workOrders.map((w) => {
      w.assignedToName = w.assignedTo?.name || '';
      w.createdByName = w.createdBy?.name || '';
      w.sourceTicket = w.complaintId?.ticketNumber || '';
      return w;
    });

    return res.status(200).json({
      success: true,
      data: {
        workOrders: items,
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE  GET /api/v1/admin/work-orders/:id
// ─────────────────────────────────────────────────────────────────────────────
export async function getWorkOrderById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid work order ID format.' },
      });
    }

    const workOrder = await WorkOrder.findById(id)
      .populate('assignedTo', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('complaintId', 'ticketNumber subject status');

    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work order not found.' },
      });
    }

    const user = req.user;
    const apartmentId = getApartmentId(user, null);

    if (!isSuperAdmin(user) && apartmentId) {
      if (!workOrder.apartmentId.equals(apartmentId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access to this work order is not permitted.' },
        });
      }
    }

    if (
      isStaff(user) &&
      workOrder.assignedTo &&
      !workOrder.assignedTo._id.equals(user._id)
    ) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only view work orders assigned to you.' },
      });
    }

    return res.status(200).json({ success: true, data: formatWorkOrder(workOrder) });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  POST /api/v1/admin/work-orders  (Admin only)
// Body: { title, description, category, priority, assignedTo, dueDate,
//         complaintId?, buildingId?, flatId? }
// ─────────────────────────────────────────────────────────────────────────────
export async function createWorkOrder(req, res, next) {
  try {
    const user = req.user;
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

    const {
      title,
      description,
      category,
      priority,
      assignedTo,
      dueDate,
      complaintId,
      buildingId,
      flatId,
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Work order title is required.' },
      });
    }

    // If linked to a complaint, verify it belongs to this apartment and no duplicate exists
    let linkedComplaint = null;
    if (complaintId) {
      if (!mongoose.Types.ObjectId.isValid(complaintId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid complaint ID.' },
        });
      }

      linkedComplaint = await Complaint.findById(complaintId);
      if (!linkedComplaint) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Source complaint not found.' },
        });
      }

      if (!linkedComplaint.apartmentId.equals(apartmentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CROSS_TENANT_ERROR',
            message: 'Source complaint does not belong to your apartment.',
          },
        });
      }

      // Prevent duplicate work order for the same complaint
      const existing = await WorkOrder.findOne({ complaintId });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_WORK_ORDER',
            message: `A work order (${existing.orderNumber}) already exists for this complaint.`,
          },
        });
      }
    }

    // Validate assigned staff
    let assignedStaff = null;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      assignedStaff = await User.findById(assignedTo);
      if (!assignedStaff) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Assigned staff user not found.' },
        });
      }
      const staffRole = canonicalRole(assignedStaff.role);
      if (staffRole !== 'MAINTENANCE_STAFF') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STAFF',
            message: 'The assigned user must be a Maintenance Staff member.',
          },
        });
      }
      const staffApt = assignedStaff.apartmentId || assignedStaff.apartment;
      if (staffApt && !staffApt.equals(apartmentId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CROSS_TENANT_ERROR',
            message: 'Staff member must belong to the same apartment community.',
          },
        });
      }
    }

    const workOrder = new WorkOrder({
      title: title.trim(),
      description: (description || '').trim(),
      category: category || 'other',
      priority: priority || 'medium',
      apartmentId,
      buildingId: buildingId && mongoose.Types.ObjectId.isValid(buildingId) ? buildingId : null,
      flatId: flatId && mongoose.Types.ObjectId.isValid(flatId) ? flatId : null,
      complaintId: linkedComplaint ? linkedComplaint._id : null,
      createdBy: user._id,
      assignedTo: assignedStaff ? assignedStaff._id : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      progressHistory: [
        {
          changedBy: user._id,
          changedByName: user.name || '',
          changedByRole: user.role || '',
          fromStatus: null,
          toStatus: 'pending',
          note: 'Work order created.',
        },
      ],
    });

    await workOrder.save();

    // Update source complaint with work order link
    if (linkedComplaint) {
      linkedComplaint.workOrderId = workOrder._id;
      await linkedComplaint.save();
    }

    logAudit({
      actor: user,
      action: 'WORK_ORDER_CREATE',
      targetEntity: 'WorkOrder',
      targetId: workOrder._id,
      apartmentId,
      details: `Created work order "${workOrder.title}" (${workOrder.orderNumber})`,
    });

    const populated = await WorkOrder.findById(workOrder._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .populate('complaintId', 'ticketNumber subject');

    return res.status(201).json({
      success: true,
      message: 'Work order created successfully.',
      data: formatWorkOrder(populated),
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.complaintId) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_WORK_ORDER',
          message: 'A work order already exists for this complaint.',
        },
      });
    }
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
// UPDATE  PUT /api/v1/admin/work-orders/:id
// Admin: all fields
// Staff: status (in_progress/resolved) + completionNotes only
// ─────────────────────────────────────────────────────────────────────────────
export async function updateWorkOrder(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid work order ID format.' },
      });
    }

    const workOrder = await WorkOrder.findById(id);
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Work order not found.' },
      });
    }

    const user = req.user;
    const apartmentId = getApartmentId(user, null);

    if (!isSuperAdmin(user) && apartmentId) {
      if (!workOrder.apartmentId.equals(apartmentId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access to this work order is not permitted.' },
        });
      }
    }

    if (isStaff(user)) {
      if (!workOrder.assignedTo || !workOrder.assignedTo.equals(user._id)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only update work orders assigned to you.',
          },
        });
      }
    }

    const { status, priority, assignedTo, dueDate, completionNotes } = req.body || {};
    const oldStatus = workOrder.status;
    let changed = false;

    if (status && status !== oldStatus) {
      const allowed = ['pending', 'in_progress', 'resolved', 'closed', 'cancelled'];
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
      workOrder.progressHistory.push({
        changedBy: user._id,
        changedByName: user.name || '',
        changedByRole: user.role || '',
        fromStatus: oldStatus,
        toStatus: status,
        note: req.body.statusNote || '',
      });
      workOrder.status = status;
      if (status === 'resolved') workOrder.completedAt = new Date();
      changed = true;
    }

    if (isAdmin(user)) {
      if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
        workOrder.priority = priority;
        changed = true;
      }
      if (dueDate !== undefined) {
        workOrder.dueDate = dueDate ? new Date(dueDate) : null;
        changed = true;
      }
      if (assignedTo !== undefined) {
        if (!assignedTo) {
          workOrder.assignedTo = null;
          changed = true;
        } else if (mongoose.Types.ObjectId.isValid(assignedTo)) {
          const staffUser = await User.findById(assignedTo);
          if (!staffUser || canonicalRole(staffUser.role) !== 'MAINTENANCE_STAFF') {
            return res.status(400).json({
              success: false,
              error: { code: 'INVALID_STAFF', message: 'Assigned user must be Maintenance Staff.' },
            });
          }
          workOrder.assignedTo = staffUser._id;
          changed = true;
        }
      }
    }

    if (completionNotes !== undefined) {
      workOrder.completionNotes = String(completionNotes || '').trim();
      changed = true;
    }

    if (!changed) {
      return res.status(200).json({
        success: true,
        message: 'No changes detected.',
        data: formatWorkOrder(workOrder),
      });
    }

    await workOrder.save();

    logAudit({
      actor: user,
      action: 'WORK_ORDER_UPDATE',
      targetEntity: 'WorkOrder',
      targetId: workOrder._id,
      apartmentId: workOrder.apartmentId,
      details: `Updated work order "${workOrder.title}" — status: ${workOrder.status}`,
    });

    const populated = await WorkOrder.findById(workOrder._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name')
      .populate('complaintId', 'ticketNumber subject');

    return res.status(200).json({
      success: true,
      message: 'Work order updated successfully.',
      data: formatWorkOrder(populated),
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
