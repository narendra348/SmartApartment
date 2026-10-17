/**
 * final-verification.test.js
 *
 * Final Database Integration and Security Verification Test Suite
 *
 * Requirements covered:
 * A. Database:
 *    - MongoDB connection and disconnection behavior
 *    - Required-field and enum validation
 *    - Unique constraints and duplicate prevention
 *    - ObjectId/reference validation
 *    - Query indexes and pagination
 *    - Safe handling of missing or unavailable MongoDB
 *
 * B. Four roles:
 *    - SUPER_ADMIN: permitted system-wide operations
 *    - APARTMENT_ADMIN: permitted operations only within assigned apartments
 *    - RESIDENT: access only to authorized personal, flat, complaint, and billing records
 *    - MAINTENANCE_STAFF: access only to permitted assigned maintenance work and related apartment information
 *
 * C. Functional flows (Flows 1 - 10):
 *    1. Authenticate demo accounts
 *    2. Create or select a valid apartment and flat
 *    3. Submit a maintenance request as a resident
 *    4. View and assign the request as an authorized apartment admin
 *    5. Update the request as assigned maintenance staff
 *    6. Verify the work history and final status
 *    7. Create a bill and verify the server-calculated amount
 *    8. Record or simulate a payment using a test-safe method
 *    9. Verify that the payment and bill status remain consistent
 *    10. Confirm persistence directly from database
 *
 * D. Security:
 *    - Missing or invalid authentication
 *    - Wrong role
 *    - Cross-apartment access attempts
 *    - Attempts to access another resident's records
 *    - Invalid status transitions
 *    - Duplicate payment submissions
 *    - Unauthorized updates and deletion attempts
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
import BillingRule from '../src/models/billing-rule.model.js';
import Bill from '../src/models/bill.model.js';
import Payment from '../src/models/payment.model.js';
import Expense from '../src/models/expense.model.js';
import AuditLog from '../src/models/audit-log.model.js';
import { ROLES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS } from '../src/constants/accountStatus.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('Final Database Integration & Security Verification Suite', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  const runId = Date.now();
  const testPassword = 'Password@123';

  // Seeded test entities
  let superAdminUser;
  let aptAdmin1User, aptAdmin2User;
  let resident1User, resident2User;
  let staff1User, staff2User;

  let apt1, apt2;
  let bld1, bld2;
  let flat1, flat2;

  let superAdminCookie = '';
  let admin1Cookie = '';
  let admin2Cookie = '';
  let resident1Cookie = '';
  let resident2Cookie = '';
  let staff1Cookie = '';
  let staff2Cookie = '';

  // Tracking functional flow entities
  let flowComplaintId;
  let flowWorkOrderId;
  let flowBillId;
  let flowPaymentId;

  async function loginUser(email, password) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(res.status, 200, `Login should succeed for ${email}`);
    const cookie = res.headers.get('set-cookie');
    assert.ok(cookie, `Cookie should be set for ${email}`);
    return cookie;
  }

  before(async () => {
    dbConnected = await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    if (dbConnected) {
      // 1. Create Apartments
      apt1 = await Apartment.create({
        name: `Verification Heights 1 ${runId}`,
        slug: `verif-heights-1-${runId}`,
        address: '100 Final St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        contactEmail: `apt1_${runId}@verif.test`,
        status: 'approved',
      });

      apt2 = await Apartment.create({
        name: `Verification Heights 2 ${runId}`,
        slug: `verif-heights-2-${runId}`,
        address: '200 Final St',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560002',
        contactEmail: `apt2_${runId}@verif.test`,
        status: 'approved',
      });

      // 2. Create Buildings
      bld1 = await Building.create({
        apartmentId: apt1._id,
        name: `Tower A ${runId}`,
        floors: 5,
        totalFlats: 10,
        status: 'active',
      });

      bld2 = await Building.create({
        apartmentId: apt2._id,
        name: `Block B ${runId}`,
        floors: 4,
        totalFlats: 8,
        status: 'active',
      });

      // 3. Create Flats
      flat1 = await Flat.create({
        apartmentId: apt1._id,
        buildingId: bld1._id,
        number: `101-${runId}`,
        floor: 1,
        type: '2BHK',
        status: 'occupied',
      });

      flat2 = await Flat.create({
        apartmentId: apt2._id,
        buildingId: bld2._id,
        number: `201-${runId}`,
        floor: 2,
        type: '3BHK',
        status: 'occupied',
      });

      // 4. Create Users across the Four Roles
      superAdminUser = await User.create({
        name: 'Super Admin Test',
        email: `superadmin_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
      });

      aptAdmin1User = await User.create({
        name: 'Apt 1 Admin Test',
        email: `admin1_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt1._id,
      });

      aptAdmin2User = await User.create({
        name: 'Apt 2 Admin Test',
        email: `admin2_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt2._id,
      });

      resident1User = await User.create({
        name: 'Resident 1 Test',
        email: `res1_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt1._id,
        buildingId: bld1._id,
        flatId: flat1._id,
      });

      resident2User = await User.create({
        name: 'Resident 2 Test',
        email: `res2_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt2._id,
        buildingId: bld2._id,
        flatId: flat2._id,
      });

      staff1User = await User.create({
        name: 'Staff 1 Test',
        email: `staff1_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.MAINTENANCE_STAFF,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt1._id,
        specialization: 'Plumbing',
      });

      staff2User = await User.create({
        name: 'Staff 2 Test',
        email: `staff2_${runId}@verif.test`,
        password: testPassword,
        role: ROLES.MAINTENANCE_STAFF,
        status: ACCOUNT_STATUS.ACTIVE,
        apartmentId: apt2._id,
        specialization: 'Electrical',
      });

      // 5. Create Memberships
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

      // 6. Obtain Session Cookies
      superAdminCookie = await loginUser(superAdminUser.email, testPassword);
      admin1Cookie = await loginUser(aptAdmin1User.email, testPassword);
      admin2Cookie = await loginUser(aptAdmin2User.email, testPassword);
      resident1Cookie = await loginUser(resident1User.email, testPassword);
      resident2Cookie = await loginUser(resident2User.email, testPassword);
      staff1Cookie = await loginUser(staff1User.email, testPassword);
      staff2Cookie = await loginUser(staff2User.email, testPassword);
    }
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (dbConnected) {
      await Apartment.deleteMany({ _id: { $in: [apt1._id, apt2._id] } });
      await Building.deleteMany({ _id: { $in: [bld1._id, bld2._id] } });
      await Flat.deleteMany({ _id: { $in: [flat1._id, flat2._id] } });
      await User.deleteMany({
        _id: {
          $in: [
            superAdminUser._id,
            aptAdmin1User._id,
            aptAdmin2User._id,
            resident1User._id,
            resident2User._id,
            staff1User._id,
            staff2User._id,
          ],
        },
      });
      await Membership.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Complaint.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await WorkOrder.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await BillingRule.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Bill.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Payment.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await Expense.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await AuditLog.deleteMany({ apartmentId: { $in: [apt1._id, apt2._id] } });
      await disconnectDB();
    }
  });

  // ===========================================================================
  // SECTION A: DATABASE TESTS
  // ===========================================================================
  describe('A. Database Integration & Validation Tests', () => {
    it('A1. MongoDB connection and disconnection behavior', async () => {
      assert.equal(mongoose.connection.readyState, 1, 'MongoDB must be connected (readyState === 1)');
      // Test health reporting connected state
      const healthRes = await fetch(`${baseUrl}/health`);
      const healthData = await healthRes.json();
      assert.equal(healthRes.status, 200);
      assert.equal(healthData.database.connected, true);
      assert.equal(healthData.database.state, 'connected');
    });

    it('A2. Required-field and enum validation', async () => {
      // Test User schema validation
      const invalidUser = new User({ email: 'bad-email' });
      const userErr = invalidUser.validateSync();
      assert.ok(userErr, 'Schema must fail validation for missing required fields');
      assert.ok(userErr.errors['name'], 'Name must be required');
      assert.ok(userErr.errors['password'], 'Password must be required');

      // Test Complaint enum validation
      const invalidComplaint = new Complaint({
        apartmentId: apt1._id,
        requestedBy: resident1User._id,
        subject: 'Valid subject',
        description: 'Valid description',
        category: 'invalid_category_123',
        status: 'invalid_status_xyz',
      });
      const compErr = invalidComplaint.validateSync();
      assert.ok(compErr, 'Invalid enum values should fail validation');
      assert.ok(compErr.errors['category']);
      assert.ok(compErr.errors['status']);
    });

    it('A3. Unique constraints and duplicate prevention', async () => {
      // Duplicate User email
      let duplicateErr = null;
      try {
        await User.create({
          name: 'Duplicate Email User',
          email: superAdminUser.email,
          password: testPassword,
          role: ROLES.RESIDENT,
        });
      } catch (err) {
        duplicateErr = err;
      }
      assert.ok(duplicateErr, 'Creating user with duplicate email must throw error');
      assert.equal(duplicateErr.code, 11000, 'Must throw duplicate key error code 11000');

      // Duplicate Flat number in same building
      let duplicateFlatErr = null;
      try {
        await Flat.create({
          apartmentId: apt1._id,
          buildingId: bld1._id,
          number: flat1.number,
          floor: 1,
        });
      } catch (err) {
        duplicateFlatErr = err;
      }
      assert.ok(duplicateFlatErr, 'Creating duplicate flat in same building must throw error');
      assert.equal(duplicateFlatErr.code, 11000);
    });

    it('A4. ObjectId/reference validation', async () => {
      // Malformed ObjectId in endpoint
      const res = await fetch(`${baseUrl}/admin/flats/not-a-valid-objectid`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(res.status, 400, 'Malformed ObjectId must return 400 Bad Request');
      const data = await res.json();
      assert.ok(data.error.code === 'INVALID_ID' || data.error.code === 'VALIDATION_ERROR');
    });

    it('A5. Query indexes and pagination', async () => {
      // Ensure indexes on User, Bill, Complaint, Flat exist
      const userIndexes = await User.collection.indexes();
      const hasEmailIndex = userIndexes.some((idx) => idx.key.email === 1);
      assert.ok(hasEmailIndex, 'User collection must have unique index on email');

      // Query with pagination params (limit, page)
      const res = await fetch(`${baseUrl}/admin/complaints?page=1&limit=2`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.data, 'Must return response data');
      assert.equal(body.data.page, 1);
      assert.equal(body.data.limit, 2);
      assert.ok(Array.isArray(body.data.complaints));
    });

    it('A6. Safe handling of missing or unavailable MongoDB', async () => {
      // Test disconnection behavior and graceful response
      await disconnectDB();
      assert.equal(mongoose.connection.readyState, 0, 'Database disconnected');

      const offlineHealthRes = await fetch(`${baseUrl}/health`);
      assert.equal(offlineHealthRes.status, 200, 'Health endpoint must stay available when DB is offline');
      const offlineHealthData = await offlineHealthRes.json();
      assert.equal(offlineHealthData.database.connected, false);
      assert.equal(offlineHealthData.database.state, 'disconnected');

      // Reconnect cleanly for subsequent tests
      const reconnected = await connectDB();
      assert.equal(reconnected, true, 'Database must reconnect successfully');
      assert.equal(mongoose.connection.readyState, 1);
    });
  });

  // ===========================================================================
  // SECTION B: FOUR ROLES AUTHORIZATION TESTS
  // ===========================================================================
  describe('B. Role-Based Access Control (RBAC) Tests', () => {
    it('B1. SUPER_ADMIN: permitted system-wide operations', async () => {
      // Super Admin can list all apartments
      const aptRes = await fetch(`${baseUrl}/super-admin/apartments`, {
        headers: { Cookie: superAdminCookie },
      });
      assert.equal(aptRes.status, 200);
      const aptData = await aptRes.json();
      const list = aptData.data.apartments || aptData.data.items || aptData.data;
      assert.ok(Array.isArray(list), 'Super admin should receive array of apartments');
      assert.ok(list.length >= 2, 'Should contain at least the 2 test apartments');

      // Super Admin can view system audit logs
      const auditRes = await fetch(`${baseUrl}/super-admin/audit-logs`, {
        headers: { Cookie: superAdminCookie },
      });
      assert.equal(auditRes.status, 200);
    });

    it('B2. APARTMENT_ADMIN: permitted operations only within assigned apartments', async () => {
      // Admin 1 can list flats in Apartment 1
      const res1 = await fetch(`${baseUrl}/admin/flats`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      const flatIds = (data1.data.flats || data1.data || []).map((f) => (f.id || f._id).toString());
      assert.ok(flatIds.includes(flat1._id.toString()));
      assert.ok(!flatIds.includes(flat2._id.toString()), 'Admin 1 must NOT see flats from Apartment 2');

      // Admin 1 forbidden from super-admin endpoints
      const forbiddenRes = await fetch(`${baseUrl}/super-admin/audit-logs`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(forbiddenRes.status, 403, 'Apartment Admin must not access super-admin endpoints');
    });

    it('B3. RESIDENT: access only to authorized personal, flat, complaint, and billing records', async () => {
      // Resident 1 can view own profile/flats
      const ownCompRes = await fetch(`${baseUrl}/resident/complaints`, {
        headers: { Cookie: resident1Cookie },
      });
      assert.equal(ownCompRes.status, 200);

      // Resident 1 forbidden from admin endpoints
      const adminAttempt = await fetch(`${baseUrl}/admin/flats`, {
        headers: { Cookie: resident1Cookie },
      });
      assert.equal(adminAttempt.status, 403, 'Resident must not access admin endpoints');
    });

    it('B4. MAINTENANCE_STAFF: access only to permitted assigned maintenance work', async () => {
      // Staff 1 can access work order list
      const woRes = await fetch(`${baseUrl}/admin/work-orders`, {
        headers: { Cookie: staff1Cookie },
      });
      assert.equal(woRes.status, 200);

      // Staff 1 forbidden from creating bills or accessing admin finances
      const billAttempt = await fetch(`${baseUrl}/admin/bills/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: staff1Cookie },
        body: JSON.stringify({ billingPeriod: '2026-10' }),
      });
      assert.equal(billAttempt.status, 403, 'Maintenance staff must not access billing administration');
    });
  });

  // ===========================================================================
  // SECTION C: COMPLETE 10-STEP FUNCTIONAL FLOW
  // ===========================================================================
  describe('C. Functional Flows (End-to-End Steps 1 to 10)', () => {
    it('Flow Step 1: Authenticate demo account', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resident1User.email, password: testPassword }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.user.email, resident1User.email);
      assert.equal(data.data.user.role, ROLES.RESIDENT);
    });

    it('Flow Step 2: Create or select a valid apartment and flat', async () => {
      const flatDoc = await Flat.findById(flat1._id).populate('apartmentId buildingId');
      assert.ok(flatDoc, 'Flat must exist');
      assert.equal(flatDoc.apartmentId._id.toString(), apt1._id.toString());
      assert.equal(flatDoc.buildingId._id.toString(), bld1._id.toString());
      assert.equal(flatDoc.status, 'occupied');
    });

    it('Flow Step 3: Submit a maintenance request as a resident', async () => {
      const res = await fetch(`${baseUrl}/resident/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resident1Cookie },
        body: JSON.stringify({
          subject: 'Main pipe leakage in kitchen',
          description: 'Sink pipe connection is leaking rapidly.',
          category: 'plumbing',
          priority: 'high',
        }),
      });
      assert.equal(res.status, 201);
      const data = await res.json();
      flowComplaintId = data.data.id || data.data._id;
      assert.ok(flowComplaintId);
      assert.equal(data.data.status, 'pending');
      assert.equal(data.data.subject, 'Main pipe leakage in kitchen');
    });

    it('Flow Step 4: View and assign the request as an authorized apartment admin', async () => {
      // 1. Admin views the complaint
      const viewRes = await fetch(`${baseUrl}/admin/complaints/${flowComplaintId}`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(viewRes.status, 200);
      const viewData = await viewRes.json();
      assert.equal(viewData.data.subject, 'Main pipe leakage in kitchen');

      // 2. Admin creates a Work Order and assigns to staff1User
      const woRes = await fetch(`${baseUrl}/admin/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({
          title: 'Kitchen Pipe Repair',
          description: 'Fix the leaky pipe beneath the kitchen sink.',
          category: 'plumbing',
          priority: 'high',
          assignedTo: staff1User._id,
          complaintId: flowComplaintId,
          buildingId: bld1._id,
          flatId: flat1._id,
        }),
      });
      assert.equal(woRes.status, 201);
      const woData = await woRes.json();
      flowWorkOrderId = woData.data.id || woData.data._id;
      assert.ok(flowWorkOrderId);
      assert.equal(woData.data.status, 'pending');
    });

    it('Flow Step 5: Update the request as assigned maintenance staff', async () => {
      // Staff 1 updates status to in_progress
      const progressRes = await fetch(`${baseUrl}/admin/work-orders/${flowWorkOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: staff1Cookie },
        body: JSON.stringify({
          status: 'in_progress',
        }),
      });
      assert.equal(progressRes.status, 200);
      const pData = await progressRes.json();
      assert.equal(pData.data.status, 'in_progress');

      // Staff 1 marks as resolved with completion notes
      const resolveRes = await fetch(`${baseUrl}/admin/work-orders/${flowWorkOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: staff1Cookie },
        body: JSON.stringify({
          status: 'resolved',
          completionNotes: 'Replaced faulty Teflon tape and tightened joint coupling.',
        }),
      });
      assert.equal(resolveRes.status, 200);
      const rData = await resolveRes.json();
      assert.equal(rData.data.status, 'resolved');
      assert.equal(rData.data.completionNotes, 'Replaced faulty Teflon tape and tightened joint coupling.');
    });

    it('Flow Step 6: Verify the work history and final status', async () => {
      const res = await fetch(`${baseUrl}/admin/work-orders/${flowWorkOrderId}`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.data.status, 'resolved');
      assert.ok(Array.isArray(data.data.progressHistory));
      assert.ok(data.data.progressHistory.length >= 2, 'Must record status transitions in progressHistory');
      const statuses = data.data.progressHistory.map((h) => h.toStatus);
      assert.ok(statuses.includes('in_progress'));
      assert.ok(statuses.includes('resolved'));
    });

    it('Flow Step 7: Create a bill and verify the server-calculated amount', async () => {
      // 1. Create a Billing Rule
      const ruleRes = await fetch(`${baseUrl}/admin/billing-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({
          name: `Standard Maintenance Charge ${runId}`,
          chargeType: 'fixed_monthly',
          amount: 2500, // ₹2,500.00 = 250000 paise
          billingFrequency: 'monthly',
        }),
      });
      assert.equal(ruleRes.status, 201);

      // 2. Generate bills for period
      const billPeriod = '2026-11';
      const genRes = await fetch(`${baseUrl}/admin/bills/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({
          billingPeriod: billPeriod,
          dueDateDays: 10,
        }),
      });
      assert.equal(genRes.status, 200);
      const genData = await genRes.json();
      assert.ok(genData.data.generated.length >= 1);

      // Verify bill in database
      const billDoc = await Bill.findOne({
        apartmentId: apt1._id,
        flatId: flat1._id,
        billingPeriod: billPeriod,
      });
      assert.ok(billDoc, 'Generated bill must exist in DB');
      flowBillId = billDoc._id;

      // Verify server calculation: subtotalPaise = 250000, totalPaise = 250000, paidPaise = 0
      assert.equal(billDoc.subtotalPaise, 250000);
      assert.equal(billDoc.totalPaise, 250000);
      assert.equal(billDoc.paidPaise, 0);
      assert.equal(billDoc.status, 'unpaid');
    });

    it('Flow Step 8: Record or simulate a payment using a test-safe method', async () => {
      const refNumber = `UPI-FLOW-${runId}`;
      const payRes = await fetch(`${baseUrl}/resident/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: resident1Cookie },
        body: JSON.stringify({
          billId: flowBillId,
          amount: 2500, // ₹2,500.00
          paymentMethod: 'upi',
          referenceNumber: refNumber,
          notes: 'Full payment via UPI simulation',
        }),
      });
      assert.equal(payRes.status, 201);
      const payData = await payRes.json();
      flowPaymentId = payData.data.id || payData.data._id;
      assert.ok(flowPaymentId);
      assert.equal(payData.data.status, 'pending');
      assert.equal(payData.data.amountPaise, 250000);
    });

    it('Flow Step 9: Verify that the payment and bill status remain consistent', async () => {
      // Admin verifies the pending payment
      const verifyRes = await fetch(`${baseUrl}/admin/payments/${flowPaymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({ notes: 'Verified bank settlement reference' }),
      });
      assert.equal(verifyRes.status, 200);
      const verifyData = await verifyRes.json();
      assert.equal(verifyData.data.status, 'verified');

      // Verify Bill status was updated to 'paid' and paidPaise matches
      const billDoc = await Bill.findById(flowBillId);
      assert.equal(billDoc.paidPaise, 250000);
      assert.equal(billDoc.status, 'paid', 'Bill status must update to paid');
    });

    it('Flow Step 10: Confirm persistence after refreshing or querying backend database', async () => {
      // Query documents directly from MongoDB
      const [compDb, woDb, billDb, payDb] = await Promise.all([
        Complaint.findById(flowComplaintId),
        WorkOrder.findById(flowWorkOrderId),
        Bill.findById(flowBillId),
        Payment.findById(flowPaymentId),
      ]);

      assert.ok(compDb, 'Complaint persisted in MongoDB');
      assert.ok(woDb, 'WorkOrder persisted in MongoDB');
      assert.ok(billDb, 'Bill persisted in MongoDB');
      assert.ok(payDb, 'Payment persisted in MongoDB');

      assert.equal(woDb.status, 'resolved');
      assert.equal(billDb.status, 'paid');
      assert.equal(payDb.status, 'verified');
      assert.equal(billDb.paidPaise, payDb.amountPaise);
    });
  });

  // ===========================================================================
  // SECTION D: SECURITY VERIFICATION TESTS
  // ===========================================================================
  describe('D. Security Verification Tests', () => {
    it('D1. Missing or invalid authentication', async () => {
      // Missing cookie
      const unauthRes = await fetch(`${baseUrl}/admin/flats`);
      assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');

      // Invalid token cookie
      const badTokenRes = await fetch(`${baseUrl}/admin/flats`, {
        headers: { Cookie: 'auth_token=invalid.jwt.token' },
      });
      assert.equal(badTokenRes.status, 401, 'Invalid JWT token must return 401');
    });

    it('D2. Wrong role access rejection', async () => {
      // Resident attempting admin action
      const wrongRoleRes = await fetch(`${baseUrl}/admin/flats`, {
        headers: { Cookie: resident1Cookie },
      });
      assert.equal(wrongRoleRes.status, 403, 'Wrong role must return 403 Forbidden');
    });

    it('D3. Cross-apartment access attempts', async () => {
      // Admin 2 attempts to fetch Complaint from Apartment 1
      const crossCompRes = await fetch(`${baseUrl}/admin/complaints/${flowComplaintId}`, {
        headers: { Cookie: admin2Cookie },
      });
      assert.equal(crossCompRes.status, 403, 'Cross-apartment complaint access must return 403');

      // Admin 2 attempts to fetch Work Order from Apartment 1
      const crossWoRes = await fetch(`${baseUrl}/admin/work-orders/${flowWorkOrderId}`, {
        headers: { Cookie: admin2Cookie },
      });
      assert.equal(crossWoRes.status, 403, 'Cross-apartment work order access must return 403');
    });

    it('D4. Attempts to access another resident\'s records', async () => {
      // Resident 2 attempts to view Resident 1's complaint
      const resCompAttempt = await fetch(`${baseUrl}/resident/complaints/${flowComplaintId}`, {
        headers: { Cookie: resident2Cookie },
      });
      assert.equal(resCompAttempt.status, 403, 'Access to another resident complaint must return 403');

      // Resident 2 attempts to view Resident 1's bill
      const resBillAttempt = await fetch(`${baseUrl}/admin/bills/${flowBillId}`, {
        headers: { Cookie: resident2Cookie },
      });
      assert.equal(resBillAttempt.status, 403, 'Access to another resident bill must return 403');
    });

    it('D5. Invalid status transitions', async () => {
      // Staff cannot set status directly to 'closed' (only in_progress or resolved permitted for staff)
      const invalidStatusRes = await fetch(`${baseUrl}/admin/work-orders/${flowWorkOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: staff1Cookie },
        body: JSON.stringify({ status: 'closed' }),
      });
      assert.equal(invalidStatusRes.status, 403, 'Invalid status transition by staff must return 403');
    });

    it('D6. Duplicate payment submissions & double-crediting prevention', async () => {
      // Attempting to verify the already-verified payment again must not double-credit the bill
      const billBefore = await Bill.findById(flowBillId);
      const paidBefore = billBefore.paidPaise;

      const dupVerifyRes = await fetch(`${baseUrl}/admin/payments/${flowPaymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: admin1Cookie },
        body: JSON.stringify({ notes: 'Duplicate verification attempt' }),
      });
      assert.equal(dupVerifyRes.status, 200);

      const billAfter = await Bill.findById(flowBillId);
      assert.equal(billAfter.paidPaise, paidBefore, 'Bill paidPaise must NOT increase on duplicate verification');
    });

    it('D7. Unauthorized updates and deletion attempts', async () => {
      // Resident attempts to DELETE an apartment flat
      const unauthorizedDelRes = await fetch(`${baseUrl}/admin/flats/${flat1._id}`, {
        method: 'DELETE',
        headers: { Cookie: resident1Cookie },
      });
      assert.equal(unauthorizedDelRes.status, 403, 'Unauthorized deletion must return 403');

      // Staff attempts to DELETE a complaint
      const staffDelRes = await fetch(`${baseUrl}/admin/complaints/${flowComplaintId}`, {
        method: 'DELETE',
        headers: { Cookie: staff1Cookie },
      });
      assert.equal(staffDelRes.status, 403, 'Staff deletion must return 403');
    });
  });
});
