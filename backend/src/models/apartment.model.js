/**
 * apartment.model.js
 *
 * Mongoose schema and model for Apartment Communities.
 * Supports multi-tenant isolation, onboarding approval workflow,
 * and status lifecycle (pending -> approved -> suspended/rejected).
 */

import mongoose from 'mongoose';

const apartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Apartment name is required.'],
      trim: true,
      minlength: [2, 'Apartment name must be at least 2 characters.'],
      maxlength: [150, 'Apartment name cannot exceed 150 characters.'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    postalCode: {
      type: String,
      trim: true,
      default: '',
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    contactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended', 'active', 'inactive'],
      default: 'approved',
      lowercase: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    suspensionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual aliases for frontend field compatibility
apartmentSchema.virtual('postal_code').get(function () {
  return this.postalCode;
});

apartmentSchema.virtual('contact_email').get(function () {
  return this.contactEmail;
});

apartmentSchema.virtual('contact_phone').get(function () {
  return this.contactPhone;
});

// Indexes for lifecycle and onboarding management
apartmentSchema.index({ status: 1 });
apartmentSchema.index({ createdAt: -1 });

const Apartment = mongoose.models.Apartment || mongoose.model('Apartment', apartmentSchema);

export default Apartment;
