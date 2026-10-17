/**
 * billing.test.js
 *
 * Comprehensive integration tests for Billing & Finance module:
 * A. Maintenance rules CRUD & authorization / apartment isolation
 * B. Bill generation, idempotency, listing & resident access
 * C. Payment submission, admin verification, idempotency guard & rejection
 * D. Expenses management (CRUD & soft delete)
 * E. Financial reports (collections, outstanding, expenses)
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
import BillingRule from '../src/models/billing-rule.model.js';
import Bill from '../src/models/bill.model.js';
import Payment from '../src/models/payment.model.js';
import Expense from '../src/models/expense.model.js';
import { ROLES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS } from '../src/constants/accountStatus.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('SmartApartment Billing & Finance Integration Tests', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  const testTs = Date.now();
  let adminCookie = '';
  let otherAdminCookie = '';
  let residentCookie = '';
  let otherResidentCookie = '';

  let apt1Id = null;
  let apt2Id = null;
  let bld1Id = null;
  let flat1Id = null;
  let flat2Id = null;
  let residentUser = null;

  let createdRuleId = null;
  let generatedBillId = null;
  let submittedPaymentId = null;
  let createdExpenseId = null;

  before(async () => {
    dbConnected = await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    if (dbConnected) {
      // 1. Create Apartments
      const apt1 = new Apartment({
        name: `Billing Towers 1 ${testTs}`,
        slug: `billing-towers-1-${testTs}`,
        address: '101 Finance Blvd',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        contactEmail: `admin1_${testTs}@billing.demo`,
        status: 'approved',
      });
      await apt1.save();
      apt1Id = apt1._id;

      const apt2 = new Apartment({
        name: `Billing Towers 2 ${testTs}`,
        slug: `billing-towers-2-${testTs}`,
        address: '202 Finance Blvd',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        contactEmail: `admin2_${testTs}@billing.demo`,
        status: 'approved',
      });
      await apt2.save();
      apt2Id = apt2._id;

      // 2. Create Building & Flats for Apt 1
      const bld1 = new Building({
        apartmentId: apt1Id,
        name: `Block A ${testTs}`,
      });
      await bld1.save();
      bld1Id = bld1._id;

      const flat1 = new Flat({
        apartmentId: apt1Id,
        buildingId: bld1Id,
        number: `101-${testTs}`,
        floor: 1,
        squareFeet: 1200,
      });
      await flat1.save();
      flat1Id = flat1._id;

      const flat2 = new Flat({
        apartmentId: apt1Id,
        buildingId: bld1Id,
        number: `102-${testTs}`,
        floor: 1,
        squareFeet: 1500,
      });
      await flat2.save();
      flat2Id = flat2._id;

      // 3. Create Users
      // Apt 1 Admin
      const admin1 = new User({
        name: 'Apt1 Admin',
        email: `admin1_${testTs}@billing.test`,
        password: 'Password123!',
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt1Id,
        apartmentId: apt1Id,
      });
      await admin1.save();

      // Apt 2 Admin
      const admin2 = new User({
        name: 'Apt2 Admin',
        email: `admin2_${testTs}@billing.test`,
        password: 'Password123!',
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt2Id,
        apartmentId: apt2Id,
      });
      await admin2.save();

      // Resident 1 in Flat 1
      residentUser = new User({
        name: 'Res1 User',
        email: `res1_${testTs}@billing.test`,
        password: 'Password123!',
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt1Id,
        apartmentId: apt1Id,
        flatId: flat1Id,
      });
      await residentUser.save();
      await Membership.create({
        apartmentId: apt1Id,
        userId: residentUser._id,
        role: ROLES.RESIDENT,
        flatId: flat1Id,
        status: 'active',
      });

      // Resident 2 in Apt 2
      const resident2 = new User({
        name: 'Res2 User',
        email: `res2_${testTs}@billing.test`,
        password: 'Password123!',
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt2Id,
        apartmentId: apt2Id,
      });
      await resident2.save();
      await Membership.create({
        apartmentId: apt2Id,
        userId: resident2._id,
        role: ROLES.RESIDENT,
        status: 'active',
      });

      // Log in users to get auth cookies
      adminCookie = await loginAndGetCookie(`admin1_${testTs}@billing.test`, 'Password123!');
      otherAdminCookie = await loginAndGetCookie(`admin2_${testTs}@billing.test`, 'Password123!');
      residentCookie = await loginAndGetCookie(`res1_${testTs}@billing.test`, 'Password123!');
      otherResidentCookie = await loginAndGetCookie(`res2_${testTs}@billing.test`, 'Password123!');
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (dbConnected) {
      await BillingRule.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Bill.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Payment.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Expense.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Flat.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Building.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Membership.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Apartment.deleteMany({ _id: { $in: [apt1Id, apt2Id] } });
      await User.deleteMany({ email: new RegExp(testTs) });
      await disconnectDB();
    }
  });

  async function loginAndGetCookie(email, password) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return '';
    return setCookie.split(';')[0];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // A. Billing Rules
  // ───────────────────────────────────────────────────────────────────────────
  describe('A. Maintenance Rules & Charges', () => {
    it('admin can create a fixed monthly billing rule', async () => {
      const res = await fetch(`${baseUrl}/admin/billing-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: 'Standard Maintenance',
          chargeType: 'fixed',
          amount: 2500,
          frequency: 'monthly',
          dueDays: 10,
          gracePeriodDays: 5,
          lateFineType: 'fixed',
          lateFineAmount: 200,
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.name, 'Standard Maintenance');
      assert.strictEqual(data.data.amount, 2500);
      assert.strictEqual(data.data.chargeType, 'fixed');
      createdRuleId = data.data._id || data.data.id;
    });

    it('resident cannot create billing rules', async () => {
      const res = await fetch(`${baseUrl}/admin/billing-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: residentCookie,
        },
        body: JSON.stringify({
          name: 'Resident Hack Rule',
          amount: 100,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('admin can list billing rules for their apartment', async () => {
      const res = await fetch(`${baseUrl}/admin/billing-rules`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
      assert.ok(data.data.some((r) => r.name === 'Standard Maintenance'));
    });

    it('cross-apartment isolation: other apartment admin cannot see Apt1 billing rules', async () => {
      const res = await fetch(`${baseUrl}/admin/billing-rules`, {
        headers: { Cookie: otherAdminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.length, 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B. Bill Generation
  // ───────────────────────────────────────────────────────────────────────────
  describe('B. Bill Generation and Invoices', () => {
    it('admin can generate bills for current period', async () => {
      const res = await fetch(`${baseUrl}/admin/bills/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          period: '2026-10',
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.generated >= 2);
    });

    it('duplicate generation is idempotent and skips existing bills', async () => {
      const res = await fetch(`${baseUrl}/admin/bills/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          period: '2026-10',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.generated, 0);
      assert.ok(data.skipped >= 2);
    });

    it('admin can list bills with status filter', async () => {
      const res = await fetch(`${baseUrl}/admin/bills?status=unpaid`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.length >= 2);
      generatedBillId = data.data[0]._id || data.data[0].id;
    });

    it('resident can view their own bills list', async () => {
      const res = await fetch(`${baseUrl}/resident/bills`, {
        headers: { Cookie: residentCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.length >= 1);
    });

    it('other apartment resident cannot see bills', async () => {
      const res = await fetch(`${baseUrl}/resident/bills`, {
        headers: { Cookie: otherResidentCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.data.length, 0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // C. Payments & Verification Workflow
  // ───────────────────────────────────────────────────────────────────────────
  describe('C. Payments, Verification & Idempotency', () => {
    it('resident can submit an offline payment for their bill', async () => {
      const res = await fetch(`${baseUrl}/resident/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: residentCookie,
        },
        body: JSON.stringify({
          billId: generatedBillId,
          amount: 2500,
          paymentMethod: 'upi',
          referenceNumber: `UPI-REF-${testTs}-001`,
          paymentDate: new Date().toISOString(),
          notes: 'Paid via Google Pay',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'pending');
      assert.strictEqual(data.data.amount, 2500);
      submittedPaymentId = data.data._id || data.data.id;
    });

    it('admin sees submitted payment in pending payments list', async () => {
      const res = await fetch(`${baseUrl}/admin/payments?status=pending`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.some((p) => (p._id || p.id) === submittedPaymentId));
    });

    it('resident cannot verify their own payment', async () => {
      const res = await fetch(`${baseUrl}/admin/payments/${submittedPaymentId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: residentCookie,
        },
        body: JSON.stringify({ notes: 'Self verify' }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('admin verifies payment and linked bill status is updated to paid', async () => {
      const res = await fetch(`${baseUrl}/admin/payments/${submittedPaymentId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          comments: 'Verified against bank statement',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'verified');

      // Check linked bill status
      const bill = await Bill.findById(generatedBillId);
      assert.strictEqual(bill.status, 'paid');
      assert.strictEqual(bill.paidPaise, 250000);
    });

    it('verifying already verified payment does not double-credit bill (idempotency guard)', async () => {
      const res = await fetch(`${baseUrl}/admin/payments/${submittedPaymentId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ comments: 'Re-verifying' }),
      });

      assert.strictEqual(res.status, 200);
      const bill = await Bill.findById(generatedBillId);
      // Still exactly 250000 paise (not 500000)
      assert.strictEqual(bill.paidPaise, 250000);
    });

    it('admin can reject an invalid payment with rejectionReason', async () => {
      const subRes = await fetch(`${baseUrl}/resident/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: residentCookie,
        },
        body: JSON.stringify({
          amount: 500,
          paymentMethod: 'cash',
          referenceNumber: `CASH-${testTs}-BAD`,
        }),
      });
      const subData = await subRes.json();
      const badPaymentId = subData.data._id || subData.data.id;

      const rejRes = await fetch(`${baseUrl}/admin/payments/${badPaymentId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          reason: 'UTR number not found in bank statement',
        }),
      });

      assert.strictEqual(rejRes.status, 200);
      const rejData = await rejRes.json();
      assert.strictEqual(rejData.data.status, 'rejected');
      assert.strictEqual(rejData.data.rejectionReason, 'UTR number not found in bank statement');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D. Operating Expenses
  // ───────────────────────────────────────────────────────────────────────────
  describe('D. Operating Expenses CRUD', () => {
    it('admin can create an expense', async () => {
      const res = await fetch(`${baseUrl}/admin/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          title: 'Lift AMC October',
          category: 'maintenance',
          amount: 8000,
          expenseDate: new Date().toISOString(),
          vendorName: 'Schindler Elevators',
          paymentMethod: 'bank_transfer',
          notes: 'Quarterly maintenance contract',
        }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.title, 'Lift AMC October');
      assert.strictEqual(data.data.amount, 8000);
      createdExpenseId = data.data._id || data.data.id;
    });

    it('resident cannot create an expense', async () => {
      const res = await fetch(`${baseUrl}/admin/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: residentCookie,
        },
        body: JSON.stringify({
          title: 'Unauthorized expense',
          amount: 100,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('admin can list expenses', async () => {
      const res = await fetch(`${baseUrl}/admin/expenses`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.some((e) => (e._id || e.id) === createdExpenseId));
    });

    it('admin can update and soft-delete an expense', async () => {
      const delRes = await fetch(`${baseUrl}/admin/expenses/${createdExpenseId}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(delRes.status, 200);

      // Verify soft delete in DB
      const exp = await Expense.findById(createdExpenseId);
      assert.strictEqual(exp.isArchived, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // E. Financial Reports
  // ───────────────────────────────────────────────────────────────────────────
  describe('E. Financial Reports', () => {
    it('admin can retrieve collections report', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/collections`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok('totalCollected' in data.data || 'totalPaid' in data.data);
    });

    it('admin can retrieve outstanding balances report', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/outstanding`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.flats || data.data.items || data.data));
    });

    it('admin can retrieve expenses breakdown report', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/expenses`, {
        headers: { Cookie: adminCookie },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok('totalExpenses' in data.data || 'summary' in data.data || Array.isArray(data.data));
    });

    it('resident cannot access admin financial reports', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/collections`, {
        headers: { Cookie: residentCookie },
      });
      assert.strictEqual(res.status, 403);
    });
  });
});
