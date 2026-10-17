/**
 * flat.model.js
 *
 * Mongoose schema and model for Apartment Flats/Units.
 * Belongs strictly to an Apartment complex and a specific Building/Block.
 */

import mongoose from 'mongoose';

const flatSchema = new mongoose.Schema(
  {
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment association is required.'],
      index: true,
    },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: [true, 'Building association is required.'],
      index: true,
    },
    number: {
      type: String,
      required: [true, 'Flat/Unit number is required.'],
      trim: true,
      maxlength: [50, 'Flat number cannot exceed 50 characters.'],
    },
    floor: {
      type: Number,
      default: 1,
    },
    type: {
      type: String,
      default: '2BHK',
      trim: true,
    },
    status: {
      type: String,
      enum: ['vacant', 'occupied', 'maintenance', 'reserved'],
      default: 'vacant',
      lowercase: true,
      index: true,
    },
    rent: {
      type: Number,
      default: 0,
      min: [0, 'Rent cannot be negative.'],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual aliases for frontend compatibility
flatSchema.virtual('occupancyStatus').get(function () {
  return this.status;
});

flatSchema.virtual('flatNumber').get(function () {
  return this.number;
});

// Enforce unique unit number within the same building block
flatSchema.index({ buildingId: 1, number: 1 }, { unique: true });

const Flat = mongoose.models.Flat || mongoose.model('Flat', flatSchema);

export default Flat;
