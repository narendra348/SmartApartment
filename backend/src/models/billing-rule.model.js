/**
 * billing-rule.model.js
 *
 * Maintenance charge billing rules configured per apartment by admins.
 * Rules drive bill generation — they define what recurring charges apply
 * to each flat in the apartment community.
 */

import mongoose from 'mongoose';

const billingRuleSchema = new mongoose.Schema(
  {
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment association is required.'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Rule name is required.'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters.'],
    },
    // Charge type drives how the amount is computed per flat
    chargeType: {
      type: String,
      required: [true, 'Charge type is required.'],
      lowercase: true,
      trim: true,
      enum: {
        values: ['fixed_monthly', 'fixed', 'per_flat', 'per_sqft', 'one_time', 'other'],
        message: '{VALUE} is not a valid charge type.',
      },
    },
    // Monetary amount stored as integer paise (1 INR = 100 paise) to avoid float imprecision.
    // Controllers convert from rupees on input and back to rupees on output.
    amountPaise: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [1, 'Amount must be at least ₹0.01.'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be stored as integer paise.',
      },
    },
    billingFrequency: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: ['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time'],
        message: '{VALUE} is not a valid billing frequency.',
      },
      default: 'monthly',
    },
    effectiveFrom: {
      type: Date,
      required: [true, 'Effective from date is required.'],
    },
    effectiveTo: {
      type: Date,
      default: null, // null = no expiry
    },
    status: {
      type: String,
      lowercase: true,
      trim: true,
      enum: { values: ['active', 'inactive'], message: '{VALUE} is not a valid status.' },
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: rupee amount for API responses
billingRuleSchema.virtual('amount').get(function () {
  return Number((this.amountPaise / 100).toFixed(2));
});

billingRuleSchema.index({ apartmentId: 1, status: 1 });

const BillingRule =
  mongoose.models.BillingRule || mongoose.model('BillingRule', billingRuleSchema);

export default BillingRule;
