/**
 * complaint.model.js
 *
 * Unified Mongoose schema for Maintenance Requests and Complaints.
 * Covers the complete lifecycle: submission → review → assignment → resolution.
 *
 * Frontend API paths:
 *   Admin:    GET|POST   /api/v1/admin/complaints
 *             GET|PUT    /api/v1/admin/complaints/:id
 *             POST       /api/v1/admin/complaints/:id/comments
 *             DELETE     /api/v1/admin/complaints/:id
 *   Resident: GET|POST   /api/v1/resident/complaints
 *             GET        /api/v1/resident/complaints/:id
 *             POST       /api/v1/resident/complaints/:id/comments
 *   Staff:    GET        /api/v1/admin/complaints   (scoped to assigned)
 *             PUT        /api/v1/admin/complaints/:id   (limited fields)
 */

import mongoose from 'mongoose';

// ── Subdocument: Comment / Note ───────────────────────────────────────────────
const commentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: { type: String, trim: true, default: '' },
    authorRole: { type: String, trim: true, default: '' },
    comment: {
      type: String,
      required: [true, 'Comment text is required.'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters.'],
    },
  },
  { timestamps: true },
);

// ── Subdocument: Status History Entry ─────────────────────────────────────────
const historySchema = new mongoose.Schema(
  {
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    changedByName: { type: String, trim: true, default: '' },
    changedByRole: { type: String, trim: true, default: '' },
    fromStatus: { type: String, trim: true, default: null },
    toStatus: { type: String, trim: true, default: null },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

// ── Main Complaint Schema ─────────────────────────────────────────────────────
const complaintSchema = new mongoose.Schema(
  {
    // Core content
    subject: {
      type: String,
      required: [true, 'Subject is required.'],
      trim: true,
      minlength: [3, 'Subject must be at least 3 characters.'],
      maxlength: [200, 'Subject cannot exceed 200 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters.'],
      maxlength: [5000, 'Description cannot exceed 5000 characters.'],
    },
    category: {
      type: String,
      required: [true, 'Category is required.'],
      lowercase: true,
      trim: true,
      enum: {
        values: [
          'plumbing',
          'electrical',
          'cleaning',
          'security',
          'pest_control',
          'appliance',
          'hvac',
          'structural',
          'other',
        ],
        message: '{VALUE} is not a valid category.',
      },
    },
    priority: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: '{VALUE} is not a valid priority.',
      },
      default: 'medium',
    },
    status: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: ['pending', 'in_progress', 'resolved', 'closed', 'cancelled'],
        message: '{VALUE} is not a valid status.',
      },
      default: 'pending',
      index: true,
    },

    // Multi-tenant scoping
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment association is required.'],
      index: true,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      default: null,
      index: true,
    },
    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flat',
      default: null,
      index: true,
    },

    // People
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester reference is required.'],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Work order linkage
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      default: null,
    },

    // Resolution
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },

    // Human-readable ticket number
    ticketNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Embedded subdocuments
    comments: [commentSchema],
    statusHistory: [historySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Auto-generate ticket number before first save ─────────────────────────────
complaintSchema.pre('save', async function () {
  if (!this.ticketNumber) {
    const count = await mongoose.models.Complaint.countDocuments();
    this.ticketNumber = `MR-${String(count + 1).padStart(5, '0')}`;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
complaintSchema.index({ apartmentId: 1, status: 1 });
complaintSchema.index({ apartmentId: 1, requestedBy: 1 });
complaintSchema.index({ apartmentId: 1, assignedTo: 1 });
complaintSchema.index({ apartmentId: 1, createdAt: -1 });
complaintSchema.index({ subject: 'text', description: 'text' });

// ── Virtual: title alias ──────────────────────────────────────────────────────
complaintSchema.virtual('title').get(function () {
  return this.subject;
});

const Complaint =
  mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);

export default Complaint;
