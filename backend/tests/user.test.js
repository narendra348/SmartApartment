/**
 * user.test.js
 *
 * Focused tests for User model, password hashing utility, role/status constants,
 * and security protections against password exposure.
 * Uses Node.js native test runner (node:test, node:assert/strict).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { ROLES, ROLE_VALUES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS, ACCOUNT_STATUS_VALUES } from '../src/constants/accountStatus.js';
import { hashPassword, comparePassword, isHashedPassword } from '../src/utils/password.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('1. Role and Status Constants', () => {
  it('should define exactly the four required system roles', () => {
    assert.deepEqual(ROLE_VALUES, [
      'SUPER_ADMIN',
      'APARTMENT_ADMIN',
      'RESIDENT',
      'MAINTENANCE_STAFF',
    ]);
    assert.equal(ROLES.SUPER_ADMIN, 'SUPER_ADMIN');
    assert.equal(ROLES.APARTMENT_ADMIN, 'APARTMENT_ADMIN');
    assert.equal(ROLES.RESIDENT, 'RESIDENT');
    assert.equal(ROLES.MAINTENANCE_STAFF, 'MAINTENANCE_STAFF');
  });

  it('should define exactly the four required account statuses', () => {
    assert.deepEqual(ACCOUNT_STATUS_VALUES, [
      'PENDING',
      'ACTIVE',
      'SUSPENDED',
      'REJECTED',
    ]);
    assert.equal(ACCOUNT_STATUS.PENDING, 'PENDING');
    assert.equal(ACCOUNT_STATUS.ACTIVE, 'ACTIVE');
    assert.equal(ACCOUNT_STATUS.SUSPENDED, 'SUSPENDED');
    assert.equal(ACCOUNT_STATUS.REJECTED, 'REJECTED');
  });
});

describe('2. Password Security Utilities', () => {
  const plain = 'SecretPass@2026';

  it('should hash a plaintext password producing a valid bcrypt hash different from plaintext', async () => {
    const hash = await hashPassword(plain);
    assert.notEqual(hash, plain);
    assert.ok(isHashedPassword(hash), 'Result must be a valid bcrypt hash');
    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
  });

  it('should reject hashing empty or non-string inputs', async () => {
    await assert.rejects(async () => hashPassword(''), /valid non-empty/);
    await assert.rejects(async () => hashPassword(null), /valid non-empty/);
  });

  it('should correctly verify a valid password against its hash', async () => {
    const hash = await hashPassword(plain);
    const isValid = await comparePassword(plain, hash);
    assert.equal(isValid, true);
  });

  it('should fail verification when candidate password is incorrect', async () => {
    const hash = await hashPassword(plain);
    const isValid = await comparePassword('WrongPassword@999', hash);
    assert.equal(isValid, false);
  });

  it('should fail comparison gracefully on empty or malformed inputs without throwing', async () => {
    assert.equal(await comparePassword('', 'some-hash'), false);
    assert.equal(await comparePassword('pass', ''), false);
    assert.equal(await comparePassword(null, null), false);
  });
});

describe('3. User Model Schema Validation', () => {
  it('should pass validation for valid user data', async () => {
    const user = new User({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      password: 'HashedPasswordPlaceHolderOrPlain',
      role: ROLES.APARTMENT_ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
    });

    await user.validate();
    assert.ok(true);
  });

  it('should normalize email to lowercase', () => {
    const user = new User({
      name: 'John Smith',
      email: 'JOHN.SMITH@EXAMPLE.COM',
      password: 'SomePassword123',
      role: ROLES.RESIDENT,
    });

    assert.equal(user.email, 'john.smith@example.com');
  });

  it('should reject invalid email formats', async () => {
    const invalidEmails = ['plainaddress', 'missingat.com', 'user@', '@domain.com', 'user @domain.com'];

    for (const email of invalidEmails) {
      const user = new User({
        name: 'Invalid Email User',
        email,
        password: 'Password123',
        role: ROLES.RESIDENT,
      });

      await assert.rejects(
        async () => user.validate(),
        (err) => err && err.errors && err.errors.email !== undefined,
        `Expected validation error for email: ${email}`,
      );
    }
  });

  it('should reject unsupported roles', async () => {
    const invalidRoles = ['INVALID_ROLE', 'GUEST', 'super_admin', 'root'];

    for (const role of invalidRoles) {
      const user = new User({
        name: 'Role Test User',
        email: 'roletest@example.com',
        password: 'Password123',
        role,
      });

      await assert.rejects(
        async () => user.validate(),
        (err) => err && err.errors && err.errors.role !== undefined,
        `Expected error for unsupported role: ${role}`,
      );
    }
  });

  it('should reject unsupported account statuses', async () => {
    const invalidStatuses = ['INVALID_STATUS', 'ARCHIVED', 'DELETED'];

    for (const status of invalidStatuses) {
      const user = new User({
        name: 'Status Test User',
        email: 'statustest@example.com',
        password: 'Password123',
        role: ROLES.RESIDENT,
        status,
      });

      await assert.rejects(
        async () => user.validate(),
        (err) => err && err.errors && err.errors.status !== undefined,
        `Expected error for unsupported status: ${status}`,
      );
    }
  });

  it('should default status to PENDING and isEmailVerified to false', () => {
    const user = new User({
      name: 'Default Test',
      email: 'default@example.com',
      password: 'Password123',
      role: ROLES.MAINTENANCE_STAFF,
    });

    assert.equal(user.status, ACCOUNT_STATUS.PENDING);
    assert.equal(user.isEmailVerified, false);
    assert.equal(user.lastLoginAt, null);
    assert.equal(user.apartment, null);
  });
});

describe('4. Password Exposure Prevention & Serialization', () => {
  it('should strip password from JSON serialization (toJSON and JSON.stringify)', () => {
    const user = new User({
      name: 'Safe User',
      email: 'safe@example.com',
      password: 'SuperSecretHash123',
      role: ROLES.RESIDENT,
      status: ACCOUNT_STATUS.ACTIVE,
    });

    const json = user.toJSON();
    assert.equal(json.password, undefined);
    assert.equal(json.__v, undefined);

    const serialized = JSON.parse(JSON.stringify(user));
    assert.equal(serialized.password, undefined);
    assert.equal(serialized.__v, undefined);
    assert.equal(serialized.name, 'Safe User');
    assert.equal(serialized.email, 'safe@example.com');
  });

  it('should strip password from toObject() and toSafeObject()', () => {
    const user = new User({
      name: 'Object User',
      email: 'object@example.com',
      password: 'SuperSecretHash123',
      role: ROLES.SUPER_ADMIN,
    });

    const plainObj = user.toObject();
    assert.equal(plainObj.password, undefined);

    const safeObj = user.toSafeObject();
    assert.equal(safeObj.password, undefined);
    assert.equal(safeObj.email, 'object@example.com');
  });
});

describe('5. Real MongoDB Integration Tests', () => {
  let dbConnected = false;
  const testEmail = `test_prompt3_${Date.now()}@example.com`;
  const rawPassword = 'Prompt3@IntegrationTestPassword';

  before(async () => {
    dbConnected = await connectDB();
  });

  after(async () => {
    if (dbConnected) {
      await User.deleteOne({ email: testEmail });
      await disconnectDB();
    }
  });

  it('should save a user to MongoDB, automatically hashing plaintext password via pre-save hook', async () => {
    if (!dbConnected) {
      console.warn('Skipping MongoDB integration test: database connection not available.');
      return;
    }

    const user = new User({
      name: 'Integration User',
      email: testEmail,
      password: rawPassword, // Plaintext passed
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
    });

    await user.save();

    // Verify stored password in MongoDB is hashed and not plaintext
    assert.notEqual(user.password, rawPassword);
    assert.ok(isHashedPassword(user.password));

    // Verify comparePassword instance method works
    const isMatch = await user.comparePassword(rawPassword);
    assert.equal(isMatch, true);

    const isWrongMatch = await user.comparePassword('WrongPassword');
    assert.equal(isWrongMatch, false);

    // Verify JSON response excludes password
    const jsonOutput = JSON.parse(JSON.stringify(user));
    assert.equal(jsonOutput.password, undefined);
  });

  it('should enforce unique email constraint on MongoDB', async () => {
    if (!dbConnected) {
      return;
    }

    const duplicateUser = new User({
      name: 'Duplicate User',
      email: testEmail,
      password: 'AnotherPassword123',
      role: ROLES.RESIDENT,
    });

    await assert.rejects(async () => {
      await duplicateUser.save();
    }, /E11000 duplicate key error/);
  });

  it('should support phone, specialization, flatId, buildingId, and synchronize apartment & apartmentId', async () => {
    if (!dbConnected) {
      return;
    }

    const aptId = new mongoose.Types.ObjectId();
    const buildId = new mongoose.Types.ObjectId();
    const flatId = new mongoose.Types.ObjectId();
    const staffEmail = `test_staff_${Date.now()}@example.com`;

    const staffUser = new User({
      name: 'Maintenance Specialist',
      email: staffEmail,
      password: 'StaffPassword@123',
      role: ROLES.MAINTENANCE_STAFF,
      status: ACCOUNT_STATUS.ACTIVE,
      phone: '+91 99999 11111',
      apartmentId: aptId,
      buildingId: buildId,
      flatId: flatId,
      specialization: 'Electrical & Plumbing',
    });

    await staffUser.save();

    assert.equal(staffUser.phone, '+91 99999 11111');
    assert.equal(staffUser.specialization, 'Electrical & Plumbing');
    assert.equal(staffUser.apartmentId.toString(), aptId.toString());
    assert.equal(staffUser.apartment.toString(), aptId.toString(), 'apartment and apartmentId must be synchronized');
    assert.equal(staffUser.buildingId.toString(), buildId.toString());
    assert.equal(staffUser.flatId.toString(), flatId.toString());

    await User.deleteOne({ email: staffEmail });
  });
});

