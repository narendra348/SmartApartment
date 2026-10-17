/**
 * bill.model.js
 *
 * Persistent invoice/bill linked to a flat and billing period.
 * All monetary fields stored as integer paise (1 INR = 100 paise).
 * Virtual getters expose rupee values to the API layer.
 *
 * States: unpaid → partially_paid → paid | overdue
 */

import mongoose from 'mongoose';

// ── Line item subdocument ────────────────────────────────────────────────────
const lineItemSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    amountPaise: {
      type: Number,
      required: true,
      min: [0, 'Line item amount cannot be negative.'],
      validate: { validator: Number.isInteger, message: 'Must be integer paise.' },
    },
  },
  { _id: false },
);

// ── Bill schema ──────────────────────────────────────────────────────────────
const billSchema = new mongoose.Schema(
  {
    // Human-readable bill number
    billNumber: {
      type: String,
      unique: true,
      sparse: true,
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
    },
    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flat',
      required: [true, 'Flat association is required.'],
      index: true,
    },
    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Billing period — e.g. "2025-10" (YYYY-MM) or "2025-Q3"
    billingPeriod: {
      type: String,
      required: [true, 'Billing period is required.'],
      trim: true,
      index: true,
    },
    // Friendly label shown to users
    billingPeriodLabel: {
      type: String,
      trim: true,
      default: '',
    },

    // Line items (breakdown of charges)
    lineItems: [lineItemSchema],

    // Monetary fields — all integer paise
    subtotalPaise: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative.'],
      validate: { validator: Number.isInteger, message: 'Must be integer paise.' },
    },
    adjustmentPaise: {
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: 'Must be integer paise.' },
    },
    totalPaise: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative.'],
      validate: { validator: Number.isInteger, message: 'Must be integer paise.' },
    },
    paidPaise: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative.'],
      validate: { validator: Number.isInteger, message: 'Must be integer paise.' },
    },

    // Dates
    dueDate: {
      type: Date,
      required: [true, 'Due date is required.'],
    },
    generatedAt: {
      type: Date,
      default: () => new Date(),
    },

    // Status
    status: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: ['unpaid', 'partially_paid', 'paid', 'overdue', 'waived', 'cancelled'],
        message: '{VALUE} is not a valid bill status.',
      },
      default: 'unpaid',
      index: true,
    },

    // Audit / notes
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    billingRuleIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BillingRule',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Auto-generate bill number ─────────────────────────────────────────────────
billSchema.pre('save', async function () {
  if (!this.billNumber) {
    const count = await mongoose.models.Bill.countDocuments();
    this.billNumber = `BILL-${String(count + 1).padStart(6, '0')}`;
  }
});

// ── Virtuals (rupee amounts for API layer) ────────────────────────────────────
billSchema.virtual('subtotal').get(function () {
  return Number((this.subtotalPaise / 100).toFixed(2));
});
billSchema.virtual('adjustment').get(function () {
  return Number((this.adjustmentPaise / 100).toFixed(2));
});
billSchema.virtual('totalAmount').get(function () {
  return Number((this.totalPaise / 100).toFixed(2));
});
billSchema.virtual('amount').get(function () {
  return Number((this.totalPaise / 100).toFixed(2));
});
billSchema.virtual('amountPaid').get(function () {
  return Number((this.paidPaise / 100).toFixed(2));
});
billSchema.virtual('outstandingBalance').get(function () {
  return Number(((this.totalPaise - this.paidPaise) / 100).toFixed(2));
});
billSchema.virtual('isOverdue').get(function () {
  return (
    this.status === 'overdue' ||
    (this.status !== 'paid' && this.dueDate && new Date() > new Date(this.dueDate))
  );
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// Prevent duplicate bills for the same flat in the same billing period
billSchema.index(
  { flatId: 1, billingPeriod: 1 },
  { unique: true, name: 'unique_flat_billing_period' },
);
billSchema.index({ apartmentId: 1, status: 1 });
billSchema.index({ apartmentId: 1, billingPeriod: 1 });
billSchema.index({ residentId: 1, status: 1 });

const Bill = mongoose.models.Bill || mongoose.model('Bill', billSchema);

export default Bill;
