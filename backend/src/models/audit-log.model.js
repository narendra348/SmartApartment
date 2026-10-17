/**
 * audit-log.model.js
 *
 * Mongoose schema and model for System Audit Logs.
 * Records administrative operations, apartment onboarding decisions,
 * member approvals, and modifications for compliance and accountability.
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      trim: true,
      default: 'System',
    },
    actorRole: {
      type: String,
      trim: true,
      default: 'SYSTEM',
    },
    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    targetEntity: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetId: {
      type: String,
      trim: true,
      default: null,
    },
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      default: null,
      index: true,
    },
    details: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
      uppercase: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual aliases matching frontend AuditLogsPage expectations
auditLogSchema.virtual('actor').get(function () {
  return this.actorEmail;
});

auditLogSchema.virtual('target').get(function () {
  return this.targetEntity + (this.targetId ? ` (${this.targetId})` : '');
});

auditLogSchema.virtual('description').get(function () {
  return this.details;
});

auditLogSchema.virtual('timestamp').get(function () {
  return this.createdAt;
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ apartmentId: 1, createdAt: -1 });
auditLogSchema.index({ targetEntity: 1, targetId: 1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
