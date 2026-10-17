/**
 * membership.model.js
 *
 * Mongoose schema and model for Apartment Memberships.
 * Explicitly links users to apartments, buildings, and specific flats.
 * Separates user account authentication state from apartment-level membership approval.
 */

import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required.'],
      index: true,
    },
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment reference is required.'],
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
    role: {
      type: String,
      enum: ['resident', 'admin', 'staff', 'owner', 'tenant'],
      default: 'resident',
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'approved', 'rejected', 'suspended', 'inactive'],
      default: 'active',
      lowercase: true,
      index: true,
    },
    occupancyType: {
      type: String,
      enum: ['owner', 'tenant', 'family_member', 'other'],
      default: 'tenant',
      lowercase: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Enforce unique membership per user per apartment
membershipSchema.index({ userId: 1, apartmentId: 1 }, { unique: true });
membershipSchema.index({ apartmentId: 1, status: 1 });
membershipSchema.index({ apartmentId: 1, buildingId: 1 });

const Membership = mongoose.models.Membership || mongoose.model('Membership', membershipSchema);

export default Membership;
