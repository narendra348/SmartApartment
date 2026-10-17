/**
 * payment.model.js
 *
 * Manual payment submission record.
 * Created by a resident when they make an offline payment.
 * Transitions: pending → verified | rejected (admin action).
 *
 * A confirmed (verified) payment atomically updates the linked Bill's
 * paidPaise and status. Rejected payments preserve history without
 * touching the bill balance.
 */

import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    // Multi-tenant
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
    },
    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flat',
      default: null,
    },

    // People
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payer reference is required.'],
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Linked bill (optional — resident may pay without a specific bill)
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
      index: true,
    },
    // Manual bill number supplied by resident if no billId
    billNumber: {
      type: String,
      trim: true,
      default: '',
    },

    // Amount stored in paise (integer)
    amountPaise: {
      type: Number,
      required: [true, 'Payment amount is required.'],
      min: [1, 'Amount must be at least ₹0.01.'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be stored as integer paise.',
      },
    },

    // Payment details
    paymentMethod: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: ['upi', 'bank_transfer', 'cash', 'cheque', 'other'],
        message: '{VALUE} is not a valid payment method.',
      },
      required: [true, 'Payment method is required.'],
    },
    referenceNumber: {
      type: String,
      trim: true,
      required: [true, 'Transaction/reference number is required.'],
      minlength: [4, 'Reference number must be at least 4 characters.'],
      maxlength: [100, 'Reference number cannot exceed 100 characters.'],
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required.'],
    },

    // Resident notes / additional info
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Notes cannot exceed 1000 characters.'],
    },

    // Proof of payment (URL if uploaded, not stored in DB itself)
    proofUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Workflow status
    status: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: ['pending', 'verified', 'rejected'],
        message: '{VALUE} is not a valid payment status.',
      },
      default: 'pending',
      index: true,
    },

    // Admin verification fields
    verificationComments: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },

    // Idempotency guard: marks if this payment has already been applied to a bill
    appliedToBill: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtuals (rupee amounts) ──────────────────────────────────────────────────
paymentSchema.virtual('amount').get(function () {
  return Number((this.amountPaise / 100).toFixed(2));
});

// Convenience aliases used by frontend
paymentSchema.virtual('transactionId').get(function () {
  return this.referenceNumber;
});
paymentSchema.virtual('utrNumber').get(function () {
  return this.referenceNumber;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// Idempotency: prevent duplicate submissions of the same reference number within an apartment
paymentSchema.index(
  { apartmentId: 1, referenceNumber: 1 },
  { unique: true, sparse: true, name: 'unique_payment_reference_per_apartment' },
);
paymentSchema.index({ apartmentId: 1, status: 1 });
paymentSchema.index({ payerId: 1, status: 1 });
paymentSchema.index({ apartmentId: 1, paymentDate: -1 });
paymentSchema.index({ createdAt: -1 });

const Payment =
  mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

export default Payment;
