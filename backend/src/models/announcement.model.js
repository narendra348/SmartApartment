/**
 * announcement.model.js
 *
 * Mongoose schema and model for Community Announcements and Notices.
 * Admins publish announcements for residents and maintenance staff.
 * Scoped strictly to an Apartment community.
 */

import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment association is required.'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required.'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters.'],
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required.'],
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters.'],
    },
    audience: {
      type: String,
      enum: {
        values: ['all', 'residents', 'staff'],
        message: '{VALUE} is not a valid audience target.',
      },
      default: 'all',
      lowercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: ['general', 'maintenance', 'event', 'security', 'emergency', 'other'],
        message: '{VALUE} is not a valid category.',
      },
      default: 'general',
      lowercase: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['normal', 'high', 'urgent'],
        message: '{VALUE} is not a valid priority.',
      },
      default: 'normal',
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: '{VALUE} is not a valid status.',
      },
      default: 'published',
      lowercase: true,
      trim: true,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required.'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual alias: body -> content (for frontend callers using .body or .message)
announcementSchema.virtual('body').get(function () {
  return this.content;
});

announcementSchema.virtual('message').get(function () {
  return this.content;
});

// Indexes
announcementSchema.index({ apartmentId: 1, status: 1, audience: 1 });
announcementSchema.index({ apartmentId: 1, createdAt: -1 });

const Announcement =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

export default Announcement;
