/**
 * expense.model.js
 *
 * Apartment operating expense records.
 * Admins record expenses for accounting/reporting.
 * Soft-deleted (isArchived) to preserve financial history.
 */

import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      required: [true, 'Apartment association is required.'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Expense title is required.'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters.'],
    },
    category: {
      type: String,
      lowercase: true,
      trim: true,
      enum: {
        values: [
          'utilities',
          'maintenance',
          'staff_salary',
          'cleaning',
          'security',
          'administrative',
          'other',
        ],
        message: '{VALUE} is not a valid expense category.',
      },
      required: [true, 'Category is required.'],
    },
    // Amount stored as integer paise
    amountPaise: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [1, 'Amount must be at least ₹0.01.'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be stored as integer paise.',
      },
    },
    expenseDate: {
      type: Date,
      required: [true, 'Expense date is required.'],
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Vendor cannot exceed 200 characters.'],
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Reference cannot exceed 100 characters.'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required.'],
    },
    // Soft delete
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

// Virtual rupee amount
expenseSchema.virtual('amount').get(function () {
  return Number((this.amountPaise / 100).toFixed(2));
});
// Alias used by some frontend paths
expenseSchema.virtual('date').get(function () {
  return this.expenseDate;
});

expenseSchema.index({ apartmentId: 1, expenseDate: -1 });
expenseSchema.index({ apartmentId: 1, category: 1 });

const Expense =
  mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

export default Expense;
