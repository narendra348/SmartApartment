/**
 * User.js
 *
 * Mongoose model for User accounts in SmartApartment.
 *
 * Implements:
 * - Strict role and status validation matching defined constants
 * - Email format validation and lowercase normalization
 * - Unique email indexing
 * - Automatic password hashing on save via bcryptjs
 * - Safe JSON/Object serialization (password hash is automatically stripped)
 * - Safe password comparison instance method
 */

import mongoose from 'mongoose';
import { ROLES, ROLE_VALUES } from '../constants/roles.js';
import { ACCOUNT_STATUS, ACCOUNT_STATUS_VALUES } from '../constants/accountStatus.js';
import { hashPassword, comparePassword, isHashedPassword } from '../utils/password.js';

// Standard email format validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required.'],
      trim: true,
      minlength: [2, 'User name must be at least 2 characters.'],
      maxlength: [100, 'User name cannot exceed 100 characters.'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required.'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (value) {
          return typeof value === 'string' && EMAIL_REGEX.test(value.trim());
        },
        message: (props) => `'${props.value}' is not a valid email address.`,
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required.'],
    },
    role: {
      type: String,
      required: [true, 'Role is required.'],
      enum: {
        values: ROLE_VALUES,
        message: '{VALUE} is not a valid role. Allowed roles: ' + ROLE_VALUES.join(', '),
      },
    },
    status: {
      type: String,
      required: [true, 'Account status is required.'],
      enum: {
        values: ACCOUNT_STATUS_VALUES,
        message: '{VALUE} is not a valid account status. Allowed statuses: ' + ACCOUNT_STATUS_VALUES.join(', '),
      },
      default: ACCOUNT_STATUS.PENDING,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      default: null,
      index: true,
    },
    apartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Apartment',
      default: null,
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
    specialization: {
      type: String,
      trim: true,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ── Pre-Validate Hook: Synchronize apartment & apartmentId ─────────────────────
userSchema.pre('validate', function () {
  if (this.apartmentId && !this.apartment) {
    this.apartment = this.apartmentId;
  } else if (this.apartment && !this.apartmentId) {
    this.apartmentId = this.apartment;
  }
});

// ── Compound Indexes for Multi-Tenant Scoping ──────────────────────────────────
userSchema.index({ apartmentId: 1, role: 1 });
userSchema.index({ apartmentId: 1, status: 1 });
userSchema.index({ apartment: 1, role: 1 });


// ── Pre-Save Hook: Password Hashing ──────────────────────────────────────────
// Ensures passwords are never stored in plaintext. If modified and not already hashed,
// hashes with bcryptjs automatically before saving to MongoDB.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  // Prevent re-hashing if already a valid bcrypt hash
  if (isHashedPassword(this.password)) {
    return;
  }

  this.password = await hashPassword(this.password);
});

// ── Instance Methods ────────────────────────────────────────────────────────
/**
 * Compares candidate plaintext password with the stored hash.
 * Handles cases where password was excluded in a projection query by refetching safely.
 *
 * @param {string} candidatePassword - Plaintext candidate to test
 * @returns {Promise<boolean>} True if matching, false otherwise
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  let storedHash = this.password;

  if (!storedHash && this._id) {
    const userWithPassword = await this.constructor.findById(this._id).select('+password');
    storedHash = userWithPassword?.password;
  }

  if (!storedHash) {
    return false;
  }

  return comparePassword(candidatePassword, storedHash);
};

/**
 * Returns a safe object representation excluding sensitive fields.
 *
 * @returns {object} Safe user object without password
 */
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// ── Password Exposure Protection ─────────────────────────────────────────────
// Exclude password and internal Mongoose version from all JSON responses and objects
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

userSchema.set('toObject', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
