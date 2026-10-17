/**
 * announcement.controller.js
 *
 * Controller for Apartment Community Announcements & Notices.
 * Handles:
 * - Admin CRUD, publishing, and target audience control
 * - Resident announcement feed (published only, audience: all | residents)
 * - Staff announcement feed (published only, audience: all | staff)
 * - Strict multi-tenant apartment boundary enforcement
 */

import mongoose from 'mongoose';
import Announcement from '../models/announcement.model.js';
import { logAudit } from '../services/audit.service.js';

function canonicalRole(role) {
  const MAP = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    super_admin: 'SUPER_ADMIN',
    APARTMENT_ADMIN: 'APARTMENT_ADMIN',
    admin: 'APARTMENT_ADMIN',
    RESIDENT: 'RESIDENT',
    resident: 'RESIDENT',
    MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',
    staff: 'MAINTENANCE_STAFF',
  };
  return MAP[role] || String(role || '').toUpperCase();
}

function isSuperAdmin(user) {
  return canonicalRole(user?.role) === 'SUPER_ADMIN';
}

function getApartmentId(user, queryId) {
  if (isSuperAdmin(user) && queryId) return queryId;
  return user?.apartmentId || user?.apartment || null;
}

function paginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  return { page, limit };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/announcements */
export async function listAdminAnnouncements(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: [],
        announcements: [],
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    }

    const { page, limit } = paginationParams(req.query);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim().toLowerCase();
    const audience = (req.query.audience || '').trim().toLowerCase();

    const filter = { apartmentId };

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (audience && audience !== 'all') {
      filter.audience = audience;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, items] = await Promise.all([
      Announcement.countDocuments(filter),
      Announcement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean({ virtuals: true }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: items,
      announcements: items,
      items,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/admin/announcements */
export async function createAnnouncement(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, req.body.apartmentId);

    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'APARTMENT_REQUIRED', message: 'Apartment association is required.' },
      });
    }

    const {
      title,
      content,
      body,
      audience = 'all',
      category = 'general',
      priority = 'normal',
      status = 'published',
      isPublished,
      expiresAt,
    } = req.body || {};

    const textContent = (content || body || '').trim();
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Announcement title is required.' },
      });
    }
    if (!textContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Announcement content is required.' },
      });
    }

    const published = isPublished !== undefined ? Boolean(isPublished) : status === 'published';
    const finalStatus = published ? 'published' : (status === 'archived' ? 'archived' : 'draft');

    const announcement = await Announcement.create({
      apartmentId,
      title: title.trim(),
      content: textContent,
      audience: audience.toLowerCase().trim(),
      category: category.toLowerCase().trim(),
      priority: priority.toLowerCase().trim(),
      status: finalStatus,
      isPublished: published,
      publishedAt: published ? new Date() : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: user._id,
    });

    logAudit({
      actor: user,
      action: 'ANNOUNCEMENT_CREATE',
      targetEntity: 'Announcement',
      targetId: announcement._id,
      apartmentId,
      details: `Created announcement "${announcement.title}" (${finalStatus})`,
    });

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully.',
      data: announcement,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') },
      });
    }
    next(err);
  }
}

/** GET /api/v1/admin/announcements/:id  (also handles resident & staff detail) */
export async function getAnnouncementById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid announcement ID.' },
      });
    }

    const doc = await Announcement.findById(id)
      .populate('createdBy', 'name email')
      .lean({ virtuals: true });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
      });
    }

    const user = req.user;
    const userAptId = getApartmentId(user, null);

    // Cross-apartment boundary check
    if (!isSuperAdmin(user) && userAptId && !doc.apartmentId.equals(userAptId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied. Announcement belongs to another apartment.' },
      });
    }

    const role = canonicalRole(user.role);

    // Non-admins can only view published announcements meant for their audience
    if (role === 'RESIDENT' || role === 'MAINTENANCE_STAFF') {
      if (doc.status !== 'published' || !doc.isPublished) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Announcement not available.' },
        });
      }

      if (role === 'RESIDENT' && doc.audience === 'staff') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This announcement is designated for maintenance staff only.' },
        });
      }

      if (role === 'MAINTENANCE_STAFF' && doc.audience === 'residents') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This announcement is designated for residents only.' },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: doc,
      announcement: doc,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/admin/announcements/:id and PATCH */
export async function updateAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid announcement ID.' },
      });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
      });
    }

    const userAptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && userAptId && !announcement.apartmentId.equals(userAptId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    const {
      title,
      content,
      body,
      audience,
      category,
      priority,
      status,
      isPublished,
      expiresAt,
    } = req.body || {};

    if (title !== undefined) announcement.title = title.trim();
    if (content !== undefined) announcement.content = content.trim();
    if (body !== undefined && content === undefined) announcement.content = body.trim();
    if (audience !== undefined) announcement.audience = audience.toLowerCase().trim();
    if (category !== undefined) announcement.category = category.toLowerCase().trim();
    if (priority !== undefined) announcement.priority = priority.toLowerCase().trim();

    if (status !== undefined) {
      announcement.status = status.toLowerCase().trim();
      announcement.isPublished = announcement.status === 'published';
      if (announcement.isPublished && !announcement.publishedAt) {
        announcement.publishedAt = new Date();
      }
    }

    if (isPublished !== undefined) {
      announcement.isPublished = Boolean(isPublished);
      announcement.status = announcement.isPublished ? 'published' : 'draft';
      if (announcement.isPublished && !announcement.publishedAt) {
        announcement.publishedAt = new Date();
      }
    }

    if (expiresAt !== undefined) {
      announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    await announcement.save();

    logAudit({
      actor: req.user,
      action: 'ANNOUNCEMENT_UPDATE',
      targetEntity: 'Announcement',
      targetId: announcement._id,
      apartmentId: announcement.apartmentId,
      details: `Updated announcement "${announcement.title}" (${announcement.status})`,
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully.',
      data: announcement,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') },
      });
    }
    next(err);
  }
}

/** PATCH /api/v1/admin/announcements/:id/publish */
export async function togglePublishAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid announcement ID.' },
      });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
      });
    }

    const userAptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && userAptId && !announcement.apartmentId.equals(userAptId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    const { isPublished, status } = req.body || {};
    const shouldPublish = isPublished !== undefined ? Boolean(isPublished) : status === 'published';

    announcement.isPublished = shouldPublish;
    announcement.status = shouldPublish ? 'published' : 'draft';
    if (shouldPublish) {
      announcement.publishedAt = new Date();
    }

    await announcement.save();

    logAudit({
      actor: req.user,
      action: shouldPublish ? 'ANNOUNCEMENT_PUBLISH' : 'ANNOUNCEMENT_UNPUBLISH',
      targetEntity: 'Announcement',
      targetId: announcement._id,
      apartmentId: announcement.apartmentId,
      details: `${shouldPublish ? 'Published' : 'Unpublished'} announcement "${announcement.title}"`,
    });

    return res.status(200).json({
      success: true,
      message: `Announcement ${shouldPublish ? 'published' : 'unpublished'} successfully.`,
      data: announcement,
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/admin/announcements/:id */
export async function deleteAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid announcement ID.' },
      });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
      });
    }

    const userAptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && userAptId && !announcement.apartmentId.equals(userAptId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied.' },
      });
    }

    await Announcement.findByIdAndDelete(id);

    logAudit({
      actor: req.user,
      action: 'ANNOUNCEMENT_DELETE',
      targetEntity: 'Announcement',
      targetId: id,
      apartmentId: announcement.apartmentId,
      details: `Deleted announcement "${announcement.title}"`,
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESIDENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/resident/announcements */
export async function listResidentAnnouncements(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, null);
    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: [],
        announcements: [],
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    }

    const { page, limit } = paginationParams(req.query);
    const search = (req.query.search || '').trim();

    const now = new Date();
    const filter = {
      apartmentId,
      status: 'published',
      isPublished: true,
      audience: { $in: ['all', 'residents'] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    if (search) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    const [total, items] = await Promise.all([
      Announcement.countDocuments(filter),
      Announcement.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name')
        .lean({ virtuals: true }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: items,
      announcements: items,
      items,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/staff/announcements */
export async function listStaffAnnouncements(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, null);
    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: [],
        announcements: [],
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    }

    const { page, limit } = paginationParams(req.query);
    const search = (req.query.search || '').trim();

    const now = new Date();
    const filter = {
      apartmentId,
      status: 'published',
      isPublished: true,
      audience: { $in: ['all', 'staff'] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    if (search) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { content: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    const [total, items] = await Promise.all([
      Announcement.countDocuments(filter),
      Announcement.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name')
        .lean({ virtuals: true }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: items,
      announcements: items,
      items,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}
