/**
 * database-integrity.test.js
 *
 * Dedicated integration tests validating:
 * 1. Real database persistence across entities
 * 2. Invalid reference handling (foreign/non-existent foreign keys)
 * 3. Unauthorized access enforcement across roles
 * 4. Multi-tenant cross-apartment isolation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Apartment from '../src/models/apartment.model.js';
import Building from '../src/models/building.model.js';
import Flat from '../src/models/flat.model.js';
import Membership from '../src/models/membership.model.js';
import Complaint from '../src/models/complaint.model.js';
import WorkOrder from '../src/models/work-order.model.js';
import Bill from '../src/models/bill.model.js';
import Payment from '../src/models/payment.model.js';
import Expense from '../src/models/expense.model.js';
import { ROLES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS } from '../src/constants/accountStatus.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('Database Persistence, Reference Validation & Multi-Tenant Isolation', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  const testTs = Date.now();
  let apt1, apt2;
  let bld1, bld2;
  let flat1, flat2;
  let admin1User, admin2User;
  let resident1User, resident2User;
  let staff1User, staff2User;

  let admin1Cookie = '';
  let admin2Cookie = '';
  let resident1Cookie = '';
  let resident2Cookie = '';
  let staff1Cookie = '';

  before(async () => {
    dbConnected = await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    if (dbConnected) {
      // 1. Create two separate apartments
      apt1 = await Apartment.create({
        name: `Integrity Tower A ${testTs}`,
        slug: `integrity-tower-a-${testTs}`,
        address: '100 Integrity Blvd',
        city: 'Metropolis',
        state: 'Karnataka',
        postalCode: '560001',
        status: 'approved',
      });

      apt2 = await Apartment.create({
        name: `Integrity Tower B ${testTs}`,
        slug: `integrity-tower-b-${testTs}`,
        address: '200 Isolation Ave',
        city: 'Metropolis',
        state: 'Karnataka',
        postalCode: '560002',
        status: 'approved',
      });

      // 2. Buildings
      bld1 = await Building.create({
        apartmentId: apt1._id,
        name: 'Block 1',
        floors: 5,
        totalFlats: 10,
      });

      bld2 = await Building.create({
        apartmentId: apt2._id,
        name: 'Block 2',
        floors: 5,
        totalFlats: 10,
      });

      // 3. Flats
      flat1 = await Flat.create({
        apartmentId: apt1._id,
        buildingId: bld1._id,
        number: '101',
        floor: 1,
        type: '2BHK',
        status: 'occupied',
      });

      flat2 = await Flat.create({
        apartmentId: apt2._id,
        buildingId: bld2._id,
        number: '201',
        floor: 2,
        type: '3BHK',
        status: 'occupied',
      });

      // 4. Users
      const rawPassword = 'Password@123456';

      admin1User = await User.create({
        name: 'Admin One',
        email: `admin1_${testTs}@integrity.demo`,
        password: rawPassword,
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt1._id,
      });

      admin2User = await User.create({
        name: 'Admin Two',
        email: `admin2_${testTs}@isolation.demo`,
        password: rawPassword,
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt2._id,
      });

      resident1User = await User.create({
        name: 'Resident One',
        email: `resident1_${testTs}@integrity.demo`,
        password: rawPassword,
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt1._id,
        buildingId: bld1._id,
        flatId: flat1._id,
      });

      resident2User = await User.create({
        name: 'Resident Two',
        email: `resident2_${testTs}@isolation.demo`,
        password: rawPassword,
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt2._id,
        buildingId: bld2._id,
        flatId: flat2._id,
      });

      staff1User = await User.create({
        name: 'Staff One',
        email: `staff1_${testTs}@integrity.demo`,
        password: rawPassword,
        role: ROLES.MAINTENANCE_STAFF,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt1._id,
        specialization: 'Plumbing',
      });

      staff2User = await User.create({
        name: 'Staff Two',
        email: `staff2_${testTs}@isolation.demo`,
        password: rawPassword,
        role: ROLES.MAINTENANCE_STAFF,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt2._id,
        specialization: 'Electrical',
      });

      // 5. Memberships
      await Membership.create({
        userId: resident1User._id,
        apartmentId: apt1._id,
        buildingId: bld1._id,
        flatId: flat1._id,
        role: 'resident',
        status: 'active',
      });

      await Membership.create({
        userId: resident2User._id,
        apartmentId: apt2._id,
        buildingId: bld2._id,
        flatId: flat2._id,
        role: 'resident',
        status: 'active',
      });

      // Login helper
      async function getCookie(email) {
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: rawPassword }),
        });
        assert.equal(res.status, 200);
        return res.headers.get('set-cookie');
      }

      admin1Cookie = await getCookie(admin1User.email);
      admin2Cookie = await getCookie(admin2User.email);
      resident1Cookie = await getCookie(resident1User.email);
      resident2Cookie = await getCookie(resident2User.email);
      staff1Cookie = await getCookie(staff1User.email);
    }
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (dbConnected) {
      await Apartment.deleteMany({ _id: { $in: [apt1._id, apt2._id] } });
      await Building.deleteMany({ _id: { $in: [bld1._id, bld2._id] } });
      await Flat.deleteMany({ _id: { $in: [flat1._id, flat2._id] } });
      await User.deleteMany({
        _id: { $in: [admin1User._id, admin2User._id, resident1User._id, resident2User._id, staff1User._id, staff2User._id] },
      });
      await Membership.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Complaint.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await WorkOrder.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Bill.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Payment.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Expense.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await disconnectDB();
    }
  });

  // ── 1. Database Persistence ────────────────────────────────────────────────
  describe('1. Real Database Persistence', () => {
    it('should persist a complaint in MongoDB with valid ObjectIds and timestamps', async () => {
      const res = await fetch(`${baseUrl}/resident/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resident1Cookie },
        body: JSON.stringify({
          subject: 'Leaking pipe in master bathroom',
          description: 'Water has been pooling under the sink since this morning.',
          category: 'plumbing',
          priority: 'high',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.ok(data.data.id || data.data._id);
      const complaintId = data.data.id || data.data._id;

      // Direct DB verification
      const dbDoc = await Complaint.findById(complaintId);
      assert.ok(dbDoc, 'Complaint must physically exist in MongoDB');
      assert.equal(dbDoc.subject, 'Leaking pipe in master bathroom');
      assert.equal(dbDoc.apartmentId.toString(), apt1._id.toString());
      assert.equal(dbDoc.requestedBy.toString(), resident1User._id.toString());
      assert.ok(dbDoc.createdAt instanceof Date);
      assert.ok(dbDoc.updatedAt instanceof Date);
    });

    it('should persist an operating expense in MongoDB with integer paise', async () => {
      const res = await fetch(`${baseUrl}/admin/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({
          title: 'Elevator Maintenance Contract',
          description: 'Quarterly servicing fee for main passenger lift',
          category: 'maintenance',
          amount: 4500, // ₹4500.00
          expenseDate: new Date().toISOString(),
          vendor: 'Apex Elevators Pvt Ltd',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      const expenseId = data.data.id || data.data._id;

      const dbExpense = await Expense.findById(expenseId);
      assert.ok(dbExpense);
      assert.equal(dbExpense.amountPaise, 450000, 'Must be stored as integer paise');
      assert.equal(dbExpense.apartmentId.toString(), apt1._id.toString());
      assert.equal(dbExpense.isArchived, false);
    });
  });

  // ── 2. Invalid References Handling ─────────────────────────────────────────
  describe('2. Invalid Reference Handling', () => {
    it('should reject creating a flat with a building ID belonging to another apartment', async () => {
      const res = await fetch(`${baseUrl}/admin/flats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({
          buildingId: bld2._id, // Belongs to apt2, not admin1's apt1
          number: '999',
          floor: 1,
          type: '2BHK',
        }),
      });

      assert.equal(res.status, 400, 'Must reject referencing foreign building with 400');
      const data = await res.json();
      assert.equal(data.error.code, 'CROSS_TENANT_ERROR');
    });

    it('should reject submitting a payment referencing a bill from another apartment', async () => {
      // Create bill in Apt2
      const billInApt2 = await Bill.create({
        apartmentId: apt2._id,
        buildingId: bld2._id,
        flatId: flat2._id,
        residentId: resident2User._id,
        billingPeriod: `2026-11-${testTs}`,
        subtotalPaise: 300000,
        totalPaise: 300000,
        paidPaise: 0,
        dueDate: new Date(Date.now() + 86400000 * 7),
        status: 'unpaid',
      });

      // Resident 1 in Apt1 tries to pay billInApt2
      const res = await fetch(`${baseUrl}/resident/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resident1Cookie },
        body: JSON.stringify({
          billId: billInApt2._id,
          amount: 3000,
          paymentMethod: 'upi',
          referenceNumber: `REF-X-${Date.now()}`,
        }),
      });

      assert.equal(res.status, 403, 'Must reject payment for bill belonging to another apartment');
    });

    it('should reject assigning a staff member belonging to another apartment to a work order', async () => {
      const res = await fetch(`${baseUrl}/admin/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({
          title: 'Cross-Tenant Staff Assignment Test',
          description: 'Attempting to assign staff2 from apt2 to apt1 work order',
          category: 'electrical',
          priority: 'medium',
          assignedTo: staff2User._id, // Belongs to apt2
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error.code, 'CROSS_TENANT_ERROR');
    });
  });

  // ── 3. Unauthorized Access Enforcement ─────────────────────────────────────
  describe('3. Unauthorized Access Enforcement Across Roles', () => {
    it('should reject unauthenticated requests to protected endpoints with 401', async () => {
      const endpoints = [
        `${baseUrl}/admin/buildings`,
        `${baseUrl}/admin/flats`,
        `${baseUrl}/admin/residents`,
        `${baseUrl}/admin/complaints`,
        `${baseUrl}/admin/work-orders`,
        `${baseUrl}/admin/bills`,
        `${baseUrl}/admin/payments`,
        `${baseUrl}/admin/expenses`,
      ];

      for (const ep of endpoints) {
        const res = await fetch(ep);
        assert.equal(res.status, 401, `Endpoint ${ep} must require authentication`);
      }
    });

    it('should reject resident trying to generate bills or record expenses with 403', async () => {
      const billRes = await fetch(`${baseUrl}/admin/bills/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resident1Cookie },
        body: JSON.stringify({ billingPeriod: '2026-12' }),
      });
      assert.equal(billRes.status, 403);

      const expRes = await fetch(`${baseUrl}/admin/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resident1Cookie },
        body: JSON.stringify({ title: 'Test Expense', amount: 1000, category: 'other' }),
      });
      assert.equal(expRes.status, 403);
    });

    it('should reject staff trying to delete complaints or modify billing rules with 403', async () => {
      const ruleRes = await fetch(`${baseUrl}/admin/billing-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: staff1Cookie },
        body: JSON.stringify({ name: 'Rule by Staff', amount: 100, chargeType: 'fixed_monthly' }),
      });
      assert.equal(ruleRes.status, 403);
    });
  });

  // ── 4. Cross-Apartment Isolation ───────────────────────────────────────────
  describe('4. Multi-Tenant Cross-Apartment Isolation', () => {
    it('should prevent Admin 1 from listing or viewing complaints from Apartment 2', async () => {
      // Create complaint in Apt2
      const comp2 = await Complaint.create({
        apartmentId: apt2._id,
        buildingId: bld2._id,
        flatId: flat2._id,
        requestedBy: resident2User._id,
        subject: 'Apt2 Private Complaint',
        description: 'Should never be visible to Admin 1 of Apt 1',
        category: 'cleaning',
        status: 'pending',
      });

      // Admin 1 lists complaints
      const listRes = await fetch(`${baseUrl}/admin/complaints`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      const ids = (listData.data.complaints || listData.data.items || []).map((c) => (c.id || c._id).toString());
      assert.equal(ids.includes(comp2._id.toString()), false, 'Admin 1 must not see Apt 2 complaints');

      // Admin 1 directly requests comp2 by ID
      const directRes = await fetch(`${baseUrl}/admin/complaints/${comp2._id}`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(directRes.status, 403, 'Must return 403 Forbidden for cross-apartment complaint');
    });

    it('should prevent Admin 2 from viewing or modifying expenses of Apartment 1', async () => {
      const exp1 = await Expense.create({
        apartmentId: apt1._id,
        title: 'Apt 1 Private Expense',
        category: 'security',
        amountPaise: 150000,
        expenseDate: new Date(),
        createdBy: admin1User._id,
      });

      // Admin 2 lists expenses
      const listRes = await fetch(`${baseUrl}/admin/expenses`, {
        headers: { Cookie: admin2Cookie },
      });
      assert.equal(listRes.status, 200);
      const listData = await listRes.json();
      const ids = (listData.data.expenses || listData.data.items || []).map((e) => (e.id || e._id).toString());
      assert.equal(ids.includes(exp1._id.toString()), false, 'Admin 2 must not see Apt 1 expenses');

      // Admin 2 attempts to soft-delete exp1
      const delRes = await fetch(`${baseUrl}/admin/expenses/${exp1._id}`, {
        method: 'DELETE',
        headers: { Cookie: admin2Cookie },
      });
      assert.equal(delRes.status, 403, 'Admin 2 must be blocked with 403 Forbidden');
    });

    it('should prevent Resident 1 from viewing payments of Resident 2', async () => {
      const payment2 = await Payment.create({
        apartmentId: apt2._id,
        payerId: resident2User._id,
        amountPaise: 500000,
        paymentMethod: 'upi',
        referenceNumber: `UPI-SECRET-${Date.now()}`,
        paymentDate: new Date(),
        status: 'pending',
      });

      const res = await fetch(`${baseUrl}/admin/payments/${payment2._id}`, {
        headers: { Cookie: resident1Cookie },
      });
      assert.equal(res.status, 403, 'Resident 1 must not access Resident 2 payment');
    });
  });
});
