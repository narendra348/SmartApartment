/**
 * audit.service.js
 *
 * Centralized audit logging service.
 * Records operational changes across apartments, buildings, flats, and memberships.
 * Non-blocking: audit recording errors are logged without interrupting the primary operation.
 */

import AuditLog from '../models/audit-log.model.js';

/**
 * Record an audit log entry.
 *
 * @param {object} params
 * @param {object} [params.actor] - Current authenticated user (req.user)
 * @param {string} params.action - Action identifier (e.g. 'APARTMENT_APPROVE')
 * @param {string} params.targetEntity - Entity type ('Apartment', 'Building', 'Flat', 'User')
 * @param {string|mongoose.Types.ObjectId} [params.targetId] - Target entity identifier
 * @param {string|mongoose.Types.ObjectId} [params.apartmentId] - Associated apartment
 * @param {string} [params.details] - Description or details of the change
 * @param {'SUCCESS'|'FAILURE'} [params.status] - Outcome
 * @returns {Promise<object|null>} The created audit record
 */
export async function logAudit({
  actor = null,
  action,
  targetEntity,
  targetId = null,
  apartmentId = null,
  details = '',
  status = 'SUCCESS',
}) {
  try {
    const actorId = actor?._id || actor?.id || null;
    const actorEmail = actor?.email || 'System';
    const actorRole = actor?.role ? String(actor.role).toUpperCase() : 'SYSTEM';

    const logEntry = await AuditLog.create({
      actorId,
      actorEmail,
      actorRole,
      action: String(action).toUpperCase(),
      targetEntity,
      targetId: targetId ? String(targetId) : null,
      apartmentId: apartmentId || null,
      details: String(details || ''),
      status: String(status).toUpperCase(),
    });

    return logEntry;
  } catch (err) {
    console.error('[Audit Service Warning] Failed to persist audit log entry:', err.message);
    return null;
  }
}

export default {
  logAudit,
};
