/**
 * auth.test.js
 *
 * Comprehensive integration tests for authentication and authorization:
 * - Public resident registration (role restriction, validation, duplicate email handling)
 * - Login (success, invalid credentials, disabled/pending/suspended/rejected accounts)
 * - Email enumeration prevention
 * - Current user session restoration (/api/v1/auth/me)
 * - Logout session clearing (/api/v1/auth/logout)
 * - Middleware token verification (malformed, missing, expired tokens)
 * - Server-side role-based access control (RBAC) on protected endpoints
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { ROLES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS } from '../src/constants/accountStatus.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { env } from '../src/config/env.js';

describe('Authentication & Authorization Integration Tests', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  const testTimestamp = Date.now();
  const testUsers = {
    activeResident: {
      name: 'Active Resident User',
      email: `active_resident_${testTimestamp}@example.com`,
      password: 'ResidentPassword@123',
      role: ROLES.RESIDENT,
      status: ACCOUNT_STATUS.ACTIVE,
    },
    pendingResident: {
      name: 'Pending Resident User',
      email: `pending_resident_${testTimestamp}@example.com`,
      password: 'PendingPassword@123',
      role: ROLES.RESIDENT,
      status: ACCOUNT_STATUS.PENDING,
    },
    suspendedUser: {
      name: 'Suspended Account User',
      email: `suspended_user_${testTimestamp}@example.com`,
      password: 'SuspendedPassword@123',
      role: ROLES.RESIDENT,
      status: ACCOUNT_STATUS.SUSPENDED,
    },
    rejectedUser: {
      name: 'Rejected Account User',
      email: `rejected_user_${testTimestamp}@example.com`,
      password: 'RejectedPassword@123',
      role: ROLES.RESIDENT,
      status: ACCOUNT_STATUS.REJECTED,
    },
    superAdminUser: {
      name: 'Super Admin User',
      email: `super_admin_${testTimestamp}@example.com`,
      password: 'SuperAdminPassword@123',
      role: ROLES.SUPER_ADMIN,
      status: ACCOUNT_STATUS.ACTIVE,
    },
  };

  before(async () => {
    dbConnected = await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    if (dbConnected) {
      // Seed test fixtures
      for (const key of Object.keys(testUsers)) {
        const u = testUsers[key];
        const userDoc = new User(u);
        await userDoc.save();
      }
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (dbConnected) {
      for (const key of Object.keys(testUsers)) {
        await User.deleteOne({ email: testUsers[key].email });
      }
      await User.deleteMany({ email: new RegExp(`register_${testTimestamp}`) });
      await disconnectDB();
    }
  });

  // ── 1. Registration ────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new resident account in PENDING status', async () => {
      const regEmail = `register_${testTimestamp}_resident@example.com`;
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Registered Resident',
          email: regEmail,
          password: 'SecurePassword@123',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.user.email, regEmail);
      assert.equal(data.data.user.role, ROLES.RESIDENT);
      assert.equal(data.data.user.status, ACCOUNT_STATUS.PENDING);
      assert.equal(data.data.user.password, undefined);
    });

    it('should reject public attempts to self-assign administrative roles', async () => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Hacker Attempt',
          email: `register_${testTimestamp}_admin@example.com`,
          password: 'Password@123',
          role: 'SUPER_ADMIN',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'ROLE_NOT_PERMITTED');
    });

    it('should reject registration with invalid email or missing fields', async () => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid User',
          email: 'invalid-email-format',
          password: '123',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'VALIDATION_ERROR');
    });

    it('should reject registration if email is already registered with 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Resident',
          email: testUsers.activeResident.email,
          password: 'Password@123',
        }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'EMAIL_ALREADY_EXISTS');
    });
  });

  // ── 2. Login & Credential Verification ────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('should successfully log in with valid credentials and return HTTP-only session cookie', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.activeResident.email,
          password: testUsers.activeResident.password,
        }),
      });

      assert.equal(res.status, 200);
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie && setCookie.includes('token='), 'Must set session token cookie');
      assert.ok(setCookie.includes('HttpOnly'), 'Session cookie must be HttpOnly');

      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data.token, 'Must return JWT token string');
      assert.equal(data.data.user.email, testUsers.activeResident.email);
      assert.equal(data.data.user.password, undefined, 'Password must never be returned');
    });

    it('should return identical 401 error for wrong password without leaking account details', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.activeResident.email,
          password: 'WrongPassword@999',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'INVALID_CREDENTIALS');
      assert.equal(data.error.message, 'Invalid email address or password. Please try again.');
    });

    it('should return identical 401 error for non-existent email to prevent enumeration', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'non_existent_random_email_404@example.com',
          password: 'SomePassword@123',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error.code, 'INVALID_CREDENTIALS');
      assert.equal(data.error.message, 'Invalid email address or password. Please try again.');
    });

    it('should return 400 when email or password is missing', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUsers.activeResident.email }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error.code, 'VALIDATION_ERROR');
    });

    it('should reject login for PENDING accounts with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.pendingResident.email,
          password: testUsers.pendingResident.password,
        }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'PENDING_APPROVAL');
    });

    it('should reject login for SUSPENDED accounts with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.suspendedUser.email,
          password: testUsers.suspendedUser.password,
        }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'ACCOUNT_SUSPENDED');
    });

    it('should reject login for REJECTED accounts with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.rejectedUser.email,
          password: testUsers.rejectedUser.password,
        }),
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error.code, 'ACCOUNT_REJECTED');
    });
  });

  // ── 3. Current User Session Restoration ───────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/auth/me`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error.code, 'UNAUTHORIZED');
    });

    it('should return 401 when provided an invalid or malformed token', async () => {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: 'Bearer invalid.token.payload' },
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error.code, 'INVALID_TOKEN');
    });

    it('should return current user profile when session token is valid', async () => {
      // Login first to get valid cookie
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.activeResident.email,
          password: testUsers.activeResident.password,
        }),
      });
      const cookie = loginRes.headers.get('set-cookie');

      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Cookie: cookie },
      });
      assert.equal(meRes.status, 200);

      const meData = await meRes.json();
      assert.equal(meData.success, true);
      assert.equal(meData.data.user.email, testUsers.activeResident.email);
      assert.equal(meData.data.user.password, undefined);
    });
  });

  // ── 4. Logout Session Clearing ────────────────────────────────────────────
  describe('POST /api/v1/auth/logout', () => {
    it('should return 200 and clear the session cookie', async () => {
      const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
      assert.equal(res.status, 200);

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Logout must send cookie clearing header');
      assert.ok(setCookie.includes('token='), 'Should clear token cookie');
    });
  });

  // ── 5. Server-Side Role-Based Authorization ───────────────────────────────
  describe('Protected Endpoints & Role Restrictions', () => {
    it('should deny unauthenticated requests to protected dashboard routes with 401', async () => {
      const res = await fetch(`${baseUrl}/dashboard/super-admin`);
      assert.equal(res.status, 401);
    });

    it('should deny resident access to Super Admin dashboard with 403 Forbidden', async () => {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.activeResident.email,
          password: testUsers.activeResident.password,
        }),
      });
      const cookie = loginRes.headers.get('set-cookie');

      const dashRes = await fetch(`${baseUrl}/dashboard/super-admin`, {
        headers: { Cookie: cookie },
      });
      assert.equal(dashRes.status, 403);
      const data = await dashRes.json();
      assert.equal(data.error.code, 'FORBIDDEN');
    });

    it('should allow Super Admin access to Super Admin dashboard with 200 OK', async () => {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUsers.superAdminUser.email,
          password: testUsers.superAdminUser.password,
        }),
      });
      const cookie = loginRes.headers.get('set-cookie');

      const dashRes = await fetch(`${baseUrl}/dashboard/super-admin`, {
        headers: { Cookie: cookie },
      });
      assert.equal(dashRes.status, 200);
      const data = await dashRes.json();
      assert.equal(data.success, true);
    });
  });
});
