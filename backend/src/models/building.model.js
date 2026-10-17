/**
 * building.model.js
 *
 * Mongoose schema and model for Apartment Buildings/Blocks.
 * Belongs exclusively to an Apartment complex.
 */

import mongoose from 'mongoose';

const buildingSchema = new mongoose.Schema(
  {
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment association is required.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Building/Block name is required.'],
      trim: true,
      maxlength: [100, 'Building name cannot exceed 100 characters.'],
    },
    floors: {
      type: Number,
      default: 1,
      min: [1, 'Must have at least 1 floor.'],
    },
    totalFlats: {
      type: Number,
      default: 1,
      min: [0, 'Total flats cannot be negative.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      lowercase: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Enforce unique building name within the same apartment complex
buildingSchema.index({ apartmentId: 1, name: 1 }, { unique: true });

const Building = mongoose.models.Building || mongoose.model('Building', buildingSchema);

export default Building;
