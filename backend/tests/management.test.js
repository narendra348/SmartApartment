/**
 * management.test.js
 *
 * Comprehensive integration tests for:
 * A. Apartment onboarding and approval
 * B. Apartment management (list, inspect, update, suspend, reactivate)
 * C. Buildings and flats CRUD & multi-tenant isolation
 * D. Memberships and resident accounts
 * E. System audit logs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Apartment from '../src/models/apartment.model.js';
import Building from '../src/models/building.model.js';
import Flat from '../src/models/flat.model.js';
import Membership from '../src/models/membership.model.js';
import AuditLog from '../src/models/audit-log.model.js';
import { ROLES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS } from '../src/constants/accountStatus.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('SmartApartment Management Modules Integration Tests', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  const testTs = Date.now();
  let superAdminCookie = '';
  let apartmentAdminCookie = '';
  let otherAdminCookie = '';
  let residentCookie = '';

  let testApartmentId = null;
  let otherApartmentId = null;
  let testBuildingId = null;
  let testFlatId = null;

  before(async () => {
    dbConnected = await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    if (dbConnected) {
      // 1. Create primary approved test apartment
      const apt1 = new Apartment({
        name: `Test Prime Towers ${testTs}`,
        slug: `test-prime-towers-${testTs}`,
        address: '100 Test St',
        city: 'Metropolis',
        state: 'Karnataka',
        postalCode: '560001',
        contactEmail: `admin_${testTs}@primetowers.demo`,
        status: 'approved',
      });
      await apt1.save();
      testApartmentId = apt1._id;

      // 2. Create second approved test apartment for cross-tenant testing
      const apt2 = new Apartment({
        name: `Other Heights ${testTs}`,
        slug: `other-heights-${testTs}`,
        address: '200 Other Rd',
        city: 'Metropolis',
        state: 'Karnataka',
        postalCode: '560002',
        contactEmail: `other_admin_${testTs}@otherheights.demo`,
        status: 'approved',
      });
      await apt2.save();
      otherApartmentId = apt2._id;

      // 3. Create Super Admin user
      const superAdmin = new User({
        name: 'Super Admin User',
        email: `super_mgmt_${testTs}@smartapartment.demo`,
        password: 'SuperAdmin@123',
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
      });
      await superAdmin.save();

      // 4. Create Apartment Admin for Apt 1
      const aptAdmin = new User({
        name: 'Prime Towers Admin',
        email: `admin_${testTs}@primetowers.demo`,
        password: 'AdminPassword@123',
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: testApartmentId,
        apartmentId: testApartmentId,
      });
      await aptAdmin.save();

      // 5. Create Apartment Admin for Apt 2
      const otherAdmin = new User({
        name: 'Other Heights Admin',
        email: `other_admin_${testTs}@otherheights.demo`,
        password: 'AdminPassword@123',
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: otherApartmentId,
        apartmentId: otherApartmentId,
      });
      await otherAdmin.save();

      // 6. Create Resident
      const resident = new User({
        name: 'Test Resident',
        email: `resident_${testTs}@primetowers.demo`,
        password: 'ResidentPassword@123',
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: testApartmentId,
        apartmentId: testApartmentId,
      });
      await resident.save();

      // Log in users to get session cookies
      const [superRes, adminRes, otherRes, resRes] = await Promise.all([
        fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: superAdmin.email, password: 'SuperAdmin@123' }),
        }),
        fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: aptAdmin.email, password: 'AdminPassword@123' }),
        }),
        fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: otherAdmin.email, password: 'AdminPassword@123' }),
        }),
        fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resident.email, password: 'ResidentPassword@123' }),
        }),
      ]);

      superAdminCookie = superRes.headers.get('set-cookie');
      apartmentAdminCookie = adminRes.headers.get('set-cookie');
      otherAdminCookie = otherRes.headers.get('set-cookie');
      residentCookie = resRes.headers.get('set-cookie');
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (dbConnected) {
      await Apartment.deleteMany({ name: new RegExp(`Test Prime Towers ${testTs}|Other Heights ${testTs}|Onboarded Community ${testTs}`) });
      await Building.deleteMany({ apartmentId: { $in: [testApartmentId, otherApartmentId] } });
      await Flat.deleteMany({ apartmentId: { $in: [testApartmentId, otherApartmentId] } });
      await Membership.deleteMany({ apartmentId: { $in: [testApartmentId, otherApartmentId] } });
      await User.deleteMany({ email: new RegExp(`${testTs}`) });
      await AuditLog.deleteMany({ apartmentId: { $in: [testApartmentId, otherApartmentId] } });
      await disconnectDB();
    }
  });

  // ── A. APARTMENT ONBOARDING AND APPROVAL ──────────────────────────────────
  describe('A. Apartment Onboarding and Approval', () => {
    let pendingAptId = null;

    it('should allow submitting an apartment registration request in pending status', async () => {
      const res = await fetch(`${baseUrl}/auth/register-apartment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: residentCookie, // Submitting user
        },
        body: JSON.stringify({
          apartment: {
            apartmentName: `Onboarded Community ${testTs}`,
            addressLine: '123 New Development Rd',
            city: 'Bangalore',
            state: 'Karnataka',
            postalCode: '560034',
            contactPhone: '+91 98765 43210',
            contactEmail: `contact_${testTs}@onboarded.demo`,
          },
          admin: {
            adminName: 'Applicant Admin',
            adminEmail: `applicant_admin_${testTs}@onboarded.demo`,
            adminPhone: '+91 98765 43210',
            password: 'AdminPassword@123',
          },
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.apartment.status, 'pending');
      pendingAptId = data.data.apartment._id;
    });

    it('should list pending apartments on GET /api/v1/super-admin/apartments/pending', async () => {
      const res = await fetch(`${baseUrl}/super-admin/apartments/pending`, {
        headers: { Cookie: superAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.apartments.some((a) => a._id === pendingAptId || a.id === pendingAptId));
    });

    it('should allow Super Admin to approve the pending apartment and activate it', async () => {
      const res = await fetch(`${baseUrl}/super-admin/apartments/${pendingAptId}/approve`, {
        method: 'POST',
        headers: { Cookie: superAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, 'approved');
      assert.ok(data.data.reviewedAt);

      // Verify idempotent re-approval
      const retryRes = await fetch(`${baseUrl}/super-admin/apartments/${pendingAptId}/approve`, {
        method: 'POST',
        headers: { Cookie: superAdminCookie },
      });
      assert.equal(retryRes.status, 200);
    });

    it('should prevent non-super-admins from approving apartments', async () => {
      const res = await fetch(`${baseUrl}/super-admin/apartments/${pendingAptId}/approve`, {
        method: 'POST',
        headers: { Cookie: apartmentAdminCookie },
      });

      assert.equal(res.status, 403);
    });
  });

  // ── B. APARTMENT MANAGEMENT ───────────────────────────────────────────────
  describe('B. Apartment Management (Super Admin)', () => {
    it('should allow Super Admin to suspend an active apartment', async () => {
      const res = await fetch(`${baseUrl}/super-admin/apartments/${testApartmentId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: superAdminCookie },
        body: JSON.stringify({ reason: 'Payment compliance audit' }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.status, 'suspended');
      assert.equal(data.data.suspensionReason, 'Payment compliance audit');
    });

    it('should allow Super Admin to reactivate a suspended apartment', async () => {
      const res = await fetch(`${baseUrl}/super-admin/apartments/${testApartmentId}/reactivate`, {
        method: 'POST',
        headers: { Cookie: superAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.status, 'approved');
      assert.equal(data.data.suspensionReason, null);
    });

    it('should retrieve apartment details by ID', async () => {
      const res = await fetch(`${baseUrl}/super-admin/apartments/${testApartmentId}`, {
        headers: { Cookie: superAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data._id, testApartmentId.toString());
    });
  });

  // ── C. BUILDINGS AND FLATS ────────────────────────────────────────────────
  describe('C. Buildings and Flats CRUD & Multi-Tenant Boundaries', () => {
    it('should allow apartment admin to create a building block', async () => {
      const res = await fetch(`${baseUrl}/admin/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: apartmentAdminCookie },
        body: JSON.stringify({
          name: 'Block A - Lavender',
          floors: 5,
          totalFlats: 20,
          description: 'Residential tower',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.data.name, 'Block A - Lavender');
      testBuildingId = data.data._id;
    });

    it('should reject creating a duplicate building name within the same apartment', async () => {
      const res = await fetch(`${baseUrl}/admin/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: apartmentAdminCookie },
        body: JSON.stringify({
          name: 'Block A - Lavender',
          floors: 5,
        }),
      });

      assert.equal(res.status, 409);
    });

    it('should allow apartment admin to create a flat unit within their building', async () => {
      const res = await fetch(`${baseUrl}/admin/flats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: apartmentAdminCookie },
        body: JSON.stringify({
          buildingId: testBuildingId,
          number: '101',
          floor: 1,
          type: '2BHK',
          status: 'vacant',
          rent: 25000,
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.data.number, '101');
      assert.equal(data.data.status, 'vacant');
      testFlatId = data.data._id;
    });

    it('should reject creating a flat with duplicate unit number in the same building', async () => {
      const res = await fetch(`${baseUrl}/admin/flats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: apartmentAdminCookie },
        body: JSON.stringify({
          buildingId: testBuildingId,
          number: '101',
          floor: 1,
        }),
      });

      assert.equal(res.status, 409);
    });

    it('should prevent an admin from referencing a building from another apartment', async () => {
      // Other admin attempting to add flat to Apt 1's building
      const res = await fetch(`${baseUrl}/admin/flats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: otherAdminCookie },
        body: JSON.stringify({
          buildingId: testBuildingId,
          number: '202',
          floor: 2,
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error.code, 'CROSS_TENANT_ERROR');
    });

    it('should list only buildings belonging to the admin apartment', async () => {
      const res = await fetch(`${baseUrl}/admin/buildings`, {
        headers: { Cookie: apartmentAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.buildings.every((b) => b.apartmentId === testApartmentId.toString()));
    });
  });

  // ── D. MEMBERSHIPS AND RESIDENT ACCOUNTS ───────────────────────────────────
  describe('D. Memberships and Resident Accounts', () => {
    let addedResidentId = null;

    it('should allow apartment admin to add a resident assigned to a flat', async () => {
      const residentEmail = `new_resident_${testTs}@primetowers.demo`;
      const res = await fetch(`${baseUrl}/admin/residents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: apartmentAdminCookie },
        body: JSON.stringify({
          name: 'Priya Sharma',
          email: residentEmail,
          phone: '+91 91234 56789',
          buildingId: testBuildingId,
          flatId: testFlatId,
          occupancyType: 'tenant',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      addedResidentId = data.data.id;

      // Verify flat occupancy changed to occupied
      const flatDoc = await Flat.findById(testFlatId);
      assert.equal(flatDoc.status, 'occupied');
    });

    it('should allow apartment admin to list residents in their apartment', async () => {
      const res = await fetch(`${baseUrl}/admin/residents`, {
        headers: { Cookie: apartmentAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.residents.length > 0);
      assert.ok(data.data.residents.some((r) => r.id === addedResidentId));
    });

    it('should prevent cross-apartment admin from viewing or managing another apartment residents', async () => {
      const res = await fetch(`${baseUrl}/admin/residents/${addedResidentId}`, {
        headers: { Cookie: otherAdminCookie },
      });

      assert.equal(res.status, 403);
    });

    it('should allow apartment admin to reassign resident to another flat', async () => {
      // Create second flat
      const flat2 = new Flat({
        apartmentId: testApartmentId,
        buildingId: testBuildingId,
        number: '102',
        floor: 1,
        status: 'vacant',
      });
      await flat2.save();

      const res = await fetch(`${baseUrl}/admin/residents/${addedResidentId}/reassign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: apartmentAdminCookie },
        body: JSON.stringify({
          buildingId: testBuildingId,
          flatId: flat2._id,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.flatId, flat2._id.toString());

      // Old flat should now be vacant
      const oldFlat = await Flat.findById(testFlatId);
      assert.equal(oldFlat.status, 'vacant');

      // New flat should now be occupied
      const newFlat = await Flat.findById(flat2._id);
      assert.equal(newFlat.status, 'occupied');
    });
  });

  // ── E. AUDIT LOGS ─────────────────────────────────────────────────────────
  describe('E. System Audit Logs', () => {
    it('should record audit entries and allow Super Admin to query them', async () => {
      const res = await fetch(`${baseUrl}/super-admin/audit-logs`, {
        headers: { Cookie: superAdminCookie },
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.logs.length > 0);
      assert.ok(data.data.logs.some((l) => l.action.includes('APARTMENT') || l.action.includes('BUILDING')));
    });

    it('should reject unauthorized access to audit logs by apartment admins or residents', async () => {
      const res = await fetch(`${baseUrl}/super-admin/audit-logs`, {
        headers: { Cookie: apartmentAdminCookie },
      });

      assert.equal(res.status, 403);
    });
  });
});
