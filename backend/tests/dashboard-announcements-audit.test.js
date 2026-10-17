/**
 * dashboard-announcements-audit.test.js
 *
 * Comprehensive integration tests for:
 * 1. Announcements (Admin CRUD, publish/archive toggle, resident & staff feeds, audience isolation, apartment multi-tenancy)
 * 2. Dashboard Statistics (Super Admin, Apartment Admin, Resident, Staff) with real MongoDB calculations and zero counts
 * 3. Reports (Complaints report, Occupancy report, apartment isolation)
 * 4. Audit Logs (Super Admin access, filters, pagination, search, non-admin 403 restrictions)
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
import Bill from '../src/models/bill.model.js';
import Payment from '../src/models/payment.model.js';
import Expense from '../src/models/expense.model.js';
import Complaint from '../src/models/complaint.model.js';
import WorkOrder from '../src/models/work-order.model.js';
import Announcement from '../src/models/announcement.model.js';
import AuditLog from '../src/models/audit-log.model.js';
import { ROLES } from '../src/constants/roles.js';
import { ACCOUNT_STATUS } from '../src/constants/accountStatus.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

describe('SmartApartment Announcements, Dashboard, Reports & Audit Logs Integration Tests', () => {
  let server;
  let baseUrl;
  let dbConnected = false;

  const testTs = Date.now();
  let superAdminCookie = '';
  let admin1Cookie = '';
  let admin2Cookie = '';
  let resident1Cookie = '';
  let resident2Cookie = '';
  let staffCookie = '';

  let apt1Id = null;
  let apt2Id = null;
  let bld1Id = null;
  let flat1Id = null;
  let flat2Id = null;

  let superAdminUser = null;
  let admin1User = null;
  let admin2User = null;
  let resident1User = null;
  let resident2User = null;
  let staffUser = null;

  let testAnnouncementId = null;

  before(async () => {
    dbConnected = await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    if (dbConnected) {
      // 1. Create Apartments
      const apt1 = new Apartment({
        name: `Royal Palms ${testTs}`,
        slug: `royal-palms-${testTs}`,
        address: '100 Palm Avenue',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        contactEmail: `admin1_${testTs}@palms.demo`,
        status: 'approved',
      });
      await apt1.save();
      apt1Id = apt1._id;

      const apt2 = new Apartment({
        name: `Ocean Breeze ${testTs}`,
        slug: `ocean-breeze-${testTs}`,
        address: '200 Coastal Road',
        city: 'Goa',
        state: 'Goa',
        postalCode: '403001',
        contactEmail: `admin2_${testTs}@ocean.demo`,
        status: 'approved',
      });
      await apt2.save();
      apt2Id = apt2._id;

      // 2. Create Building & Flats for Apt 1
      const bld1 = new Building({
        apartmentId: apt1Id,
        name: `Tower Alpha ${testTs}`,
      });
      await bld1.save();
      bld1Id = bld1._id;

      const flat1 = new Flat({
        apartmentId: apt1Id,
        buildingId: bld1Id,
        number: `101-${testTs}`,
        floor: 1,
        squareFeet: 1100,
        status: 'occupied',
      });
      await flat1.save();
      flat1Id = flat1._id;

      const flat2 = new Flat({
        apartmentId: apt1Id,
        buildingId: bld1Id,
        number: `102-${testTs}`,
        floor: 1,
        squareFeet: 1300,
        status: 'vacant',
      });
      await flat2.save();
      flat2Id = flat2._id;

      // 3. Create Users
      // Super Admin
      superAdminUser = new User({
        name: 'Platform SuperAdmin',
        email: `superadmin_${testTs}@system.test`,
        password: 'Password123!',
        role: ROLES.SUPER_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
      });
      await superAdminUser.save();

      // Apt 1 Admin
      admin1User = new User({
        name: 'Apt1 Admin',
        email: `admin1_${testTs}@palms.test`,
        password: 'Password123!',
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt1Id,
        apartmentId: apt1Id,
      });
      await admin1User.save();

      // Apt 2 Admin
      admin2User = new User({
        name: 'Apt2 Admin',
        email: `admin2_${testTs}@ocean.test`,
        password: 'Password123!',
        role: ROLES.APARTMENT_ADMIN,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt2Id,
        apartmentId: apt2Id,
      });
      await admin2User.save();

      // Resident 1 in Apt 1 Flat 1
      resident1User = new User({
        name: 'Resident One',
        email: `resident1_${testTs}@palms.test`,
        password: 'Password123!',
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt1Id,
        apartmentId: apt1Id,
        flatId: flat1Id,
      });
      await resident1User.save();
      await Membership.create({
        apartmentId: apt1Id,
        userId: resident1User._id,
        role: ROLES.RESIDENT,
        flatId: flat1Id,
        status: 'active',
      });

      // Resident 2 in Apt 2
      resident2User = new User({
        name: 'Resident Two',
        email: `resident2_${testTs}@ocean.test`,
        password: 'Password123!',
        role: ROLES.RESIDENT,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt2Id,
        apartmentId: apt2Id,
      });
      await resident2User.save();
      await Membership.create({
        apartmentId: apt2Id,
        userId: resident2User._id,
        role: ROLES.RESIDENT,
        status: 'active',
      });

      // Maintenance Staff in Apt 1
      staffUser = new User({
        name: 'Staff Charlie',
        email: `staff_${testTs}@palms.test`,
        password: 'Password123!',
        role: ROLES.MAINTENANCE_STAFF,
        status: ACCOUNT_STATUS.ACTIVE,
        apartment: apt1Id,
        apartmentId: apt1Id,
      });
      await staffUser.save();
      await Membership.create({
        apartmentId: apt1Id,
        userId: staffUser._id,
        role: 'staff',
        status: 'active',
      });

      // 4. Create sample Complaint & Work Order for dashboard counts
      const sampleComplaint = await Complaint.create({
        apartmentId: apt1Id,
        flatId: flat1Id,
        requestedBy: resident1User._id,
        subject: `Leaking faucet in kitchen ${testTs}`,
        description: 'Water dripping continuously',
        category: 'plumbing',
        priority: 'high',
        status: 'in_progress',
        assignedTo: staffUser._id,
      });

      await WorkOrder.create({
        apartmentId: apt1Id,
        flatId: flat1Id,
        buildingId: bld1Id,
        complaintId: sampleComplaint._id,
        title: `Repair faucet ${testTs}`,
        description: 'Replace valve cartridge',
        category: 'plumbing',
        priority: 'high',
        status: 'in_progress',
        assignedTo: staffUser._id,
        assignedStaff: staffUser._id,
        createdBy: admin1User._id,
      });

      // 5. Create sample Bill and Payment for billing counts
      const sampleBill = await Bill.create({
        apartmentId: apt1Id,
        flatId: flat1Id,
        residentId: resident1User._id,
        billNumber: `BILL-${testTs}-01`,
        billingPeriod: '2026-10',
        dueDate: new Date(Date.now() + 86400000 * 7),
        subtotalPaise: 250000,
        totalPaise: 250000,
        paidPaise: 100000,
        status: 'partially_paid',
        items: [{ title: 'Maintenance', amountPaise: 250000 }],
        createdBy: admin1User._id,
      });

      await Payment.create({
        apartmentId: apt1Id,
        billId: sampleBill._id,
        payerId: resident1User._id,
        flatId: flat1Id,
        amountPaise: 100000,
        paymentMethod: 'upi',
        referenceNumber: `UPI-${testTs}`,
        status: 'verified',
        paymentDate: new Date(),
        verifiedBy: admin1User._id,
        verifiedAt: new Date(),
      });

      // Log in users to get authentication cookies
      superAdminCookie = await loginAndGetCookie(`superadmin_${testTs}@system.test`, 'Password123!');
      admin1Cookie = await loginAndGetCookie(`admin1_${testTs}@palms.test`, 'Password123!');
      admin2Cookie = await loginAndGetCookie(`admin2_${testTs}@ocean.test`, 'Password123!');
      resident1Cookie = await loginAndGetCookie(`resident1_${testTs}@palms.test`, 'Password123!');
      resident2Cookie = await loginAndGetCookie(`resident2_${testTs}@ocean.test`, 'Password123!');
      staffCookie = await loginAndGetCookie(`staff_${testTs}@palms.test`, 'Password123!');
    }
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (dbConnected) {
      await Announcement.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await AuditLog.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await AuditLog.deleteMany({ actorEmail: new RegExp(testTs) });
      await WorkOrder.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Complaint.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Payment.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
      await Bill.deleteMany({ apartmentId: { $in: [apt1Id, apt2Id] } });
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
  // 1. ANNOUNCEMENTS MODULE
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Announcements Module', () => {
    it('Admin can create a new announcement (draft status)', async () => {
      const res = await fetch(`${baseUrl}/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin1Cookie,
        },
        body: JSON.stringify({
          title: `Annual Maintenance Schedule ${testTs}`,
          content: 'Water supply will be temporarily shut off tomorrow from 2PM to 5PM.',
          audience: 'all',
          category: 'maintenance',
          priority: 'urgent',
          status: 'draft',
          isPublished: false,
        }),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data._id);
      assert.strictEqual(json.data.title, `Annual Maintenance Schedule ${testTs}`);
      assert.strictEqual(json.data.status, 'draft');
      assert.strictEqual(json.data.isPublished, false);

      testAnnouncementId = json.data._id;
    });

    it('Rejects announcement creation with missing title or content', async () => {
      const res = await fetch(`${baseUrl}/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin1Cookie,
        },
        body: JSON.stringify({
          title: '',
          content: '',
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });

    it('Admin can list announcements with pagination and filter', async () => {
      const res = await fetch(`${baseUrl}/admin/announcements?status=draft`, {
        headers: { Cookie: admin1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      // Response shape: items/announcements at top-level (outside data object)
      const items = json.items || json.data?.items || json.announcements || (Array.isArray(json.data) ? json.data : []);
      assert.ok(Array.isArray(items), `Expected items array, got: ${JSON.stringify(Object.keys(json))}`);
      assert.ok(json.total >= 1 || json.data?.total >= 1);
    });

    it('Admin can get announcement details by ID', async () => {
      const res = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}`, {
        headers: { Cookie: admin1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data._id, testAnnouncementId);
      assert.ok(json.data.content.includes('Water supply'));
    });

    it('Unpublished announcement is NOT visible to residents', async () => {
      const res = await fetch(`${baseUrl}/resident/announcements`, {
        headers: { Cookie: resident1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const items = json.data.items || json.data.announcements || [];
      const found = items.find((a) => a._id === testAnnouncementId || a.id === testAnnouncementId);
      assert.strictEqual(found, undefined, 'Unpublished draft announcement must not be exposed to residents');
    });

    it('Resident cannot view unpublished announcement directly by ID', async () => {
      const res = await fetch(`${baseUrl}/resident/announcements/${testAnnouncementId}`, {
        headers: { Cookie: resident1Cookie },
      });

      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    it('Admin can publish the announcement via toggle endpoint', async () => {
      const res = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin1Cookie,
        },
        body: JSON.stringify({ isPublished: true, status: 'published' }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.isPublished, true);
      assert.strictEqual(json.data.status, 'published');
    });

    it('Published announcement is now visible in resident feed', async () => {
      const res = await fetch(`${baseUrl}/resident/announcements`, {
        headers: { Cookie: resident1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const items = json.items || json.data?.items || json.announcements || (Array.isArray(json.data) ? json.data : []);
      const found = items.find((a) => String(a._id || a.id) === String(testAnnouncementId));
      assert.ok(found, `Published announcement should be present in resident feed. Got ${items.length} items`);
      assert.strictEqual(found.title, `Annual Maintenance Schedule ${testTs}`);
    });

    it('Staff can see published announcement targeted to "all"', async () => {
      const res = await fetch(`${baseUrl}/staff/announcements`, {
        headers: { Cookie: staffCookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const items = json.items || json.data?.items || json.announcements || (Array.isArray(json.data) ? json.data : []);
      const found = items.find((a) => String(a._id || a.id) === String(testAnnouncementId));
      assert.ok(found, `Staff should see announcements with audience="all". Got ${items.length} items`);
    });

    it('Audience isolation: Staff does NOT see announcements targeted only to "residents"', async () => {
      // Create resident-only announcement
      const createRes = await fetch(`${baseUrl}/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin1Cookie,
        },
        body: JSON.stringify({
          title: `Residents AGM ${testTs}`,
          content: 'Annual general meeting for residents only.',
          audience: 'residents',
          status: 'published',
          isPublished: true,
        }),
      });
      assert.strictEqual(createRes.status, 201);
      const createdJson = await createRes.json();
      const resOnlyId = String(createdJson.data._id || createdJson.data.id);

      // Staff feed check — staff must not see resident-only announcements
      const staffRes = await fetch(`${baseUrl}/staff/announcements`, {
        headers: { Cookie: staffCookie },
      });
      const staffJson = await staffRes.json();
      const staffItems = staffJson.items || staffJson.data?.items || staffJson.announcements || (Array.isArray(staffJson.data) ? staffJson.data : []);
      const staffFound = staffItems.find((a) => String(a._id || a.id) === resOnlyId);
      assert.strictEqual(staffFound, undefined, 'Staff must not receive resident-only announcements');

      // Resident feed check — residents must see resident-audience announcements
      const residentRes = await fetch(`${baseUrl}/resident/announcements`, {
        headers: { Cookie: resident1Cookie },
      });
      const residentJson = await residentRes.json();
      const resItems = residentJson.items || residentJson.data?.items || residentJson.announcements || (Array.isArray(residentJson.data) ? residentJson.data : []);
      const residentFound = resItems.find((a) => String(a._id || a.id) === resOnlyId);
      assert.ok(residentFound, `Resident must receive resident-only announcements. Got ${resItems.length} items with ids: ${resItems.slice(0,3).map(i=>String(i._id||i.id)).join(',')}`);
    });

    it('Cross-apartment isolation: Admin from Apt 2 cannot see or edit Apt 1 announcements', async () => {
      // Admin 2 (authorized admin, but different apartment) gets 403 (Forbidden) trying to access Apt 1 announcement
      const getRes = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}`, {
        headers: { Cookie: admin2Cookie },
      });
      assert.ok([403, 404].includes(getRes.status), `Expected 403 or 404, got ${getRes.status}`);

      // Admin 2 tries to update Apt 1 announcement
      const putRes = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: admin2Cookie,
        },
        body: JSON.stringify({ title: 'Hacked Title' }),
      });
      assert.ok([403, 404].includes(putRes.status), `Expected 403 or 404, got ${putRes.status}`);

      // Resident 2 (Apt 2) does not see Apt 1 announcements in their feed
      const resFeed = await fetch(`${baseUrl}/resident/announcements`, {
        headers: { Cookie: resident2Cookie },
      });
      const feedJson = await resFeed.json();
      const items = feedJson.items || feedJson.data?.items || feedJson.announcements || (Array.isArray(feedJson.data) ? feedJson.data : []);
      const found = items.find((a) => String(a._id || a.id) === String(testAnnouncementId));
      assert.strictEqual(found, undefined, 'Resident in Apt 2 must not see Apt 1 announcements');
    });

    it('Resident cannot create or delete announcements (Forbidden 403)', async () => {
      const postRes = await fetch(`${baseUrl}/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: resident1Cookie,
        },
        body: JSON.stringify({ title: 'Unauthorized', content: 'Hack' }),
      });
      assert.strictEqual(postRes.status, 403);

      const delRes = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}`, {
        method: 'DELETE',
        headers: { Cookie: resident1Cookie },
      });
      assert.strictEqual(delRes.status, 403);
    });

    it('Admin can delete an announcement', async () => {
      const delRes = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}`, {
        method: 'DELETE',
        headers: { Cookie: admin1Cookie },
      });
      assert.strictEqual(delRes.status, 200);

      // Verify it is gone
      const getRes = await fetch(`${baseUrl}/admin/announcements/${testAnnouncementId}`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.strictEqual(getRes.status, 404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DASHBOARD STATISTICS MODULE
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Dashboard Statistics Module', () => {
    it('Super Admin Dashboard returns platform-wide aggregated database statistics', async () => {
      const res = await fetch(`${baseUrl}/dashboard/super-admin`, {
        headers: { Cookie: superAdminCookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.totalApartments >= 2);
      assert.ok(json.data.approvedApartments >= 2);
      assert.ok(json.data.totalUsers >= 5);
      assert.ok(json.data.totalFlats >= 2);
      assert.ok(Array.isArray(json.data.chartData));
      assert.ok(Array.isArray(json.data.pendingList));
    });

    it('Apartment Admin Dashboard returns accurate live MongoDB counts and balances', async () => {
      const res = await fetch(`${baseUrl}/dashboard/admin`, {
        headers: { Cookie: admin1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.data;

      // Check structure
      assert.strictEqual(typeof data.totalFlats, 'number');
      assert.strictEqual(typeof data.occupiedFlats, 'number');
      assert.strictEqual(typeof data.totalCollections, 'number');
      assert.strictEqual(typeof data.outstandingBalance, 'number');
      assert.strictEqual(typeof data.openComplaintsCount, 'number');
      assert.strictEqual(typeof data.activeWorkOrdersCount, 'number');
      assert.ok(Array.isArray(data.collectionTrends));
      assert.ok(Array.isArray(data.recentPayments));
      assert.ok(Array.isArray(data.recentComplaints));

      // Check verified values against seeded data
      assert.strictEqual(data.totalFlats, 2);
      assert.strictEqual(data.occupiedFlats, 1);
      assert.strictEqual(data.totalCollections, 1000); // ₹1000 verified payment
      assert.strictEqual(data.outstandingBalance, 1500); // 2500 - 1000 = ₹1500 outstanding
      assert.ok(data.openComplaintsCount >= 1);
      assert.ok(data.activeWorkOrdersCount >= 1);
    });

    it('Resident Dashboard returns personal flat info, dues, latest bill, and announcements', async () => {
      const res = await fetch(`${baseUrl}/dashboard/resident`, {
        headers: { Cookie: resident1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.data;

      assert.strictEqual(typeof data.outstandingBalance, 'number');
      assert.strictEqual(data.outstandingBalance, 1500); // ₹1500 remaining on bill
      assert.ok(data.latestBill);
      assert.strictEqual(data.latestBill.billNumber, `BILL-${testTs}-01`);
      assert.ok(data.flatInfo);
      assert.strictEqual(data.flatInfo.flatNumber, `101-${testTs}`);
      assert.ok(Array.isArray(data.recentPayments));
      assert.ok(Array.isArray(data.recentAnnouncements));
    });

    it('Maintenance Staff Dashboard returns assigned work order counts and task list', async () => {
      const res = await fetch(`${baseUrl}/dashboard/staff`, {
        headers: { Cookie: staffCookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.data;

      assert.ok(data.assignedOrdersCount >= 1);
      assert.ok(data.inProgressOrdersCount >= 1);
      assert.ok(Array.isArray(data.recentAssignments));
      assert.ok(data.recentAssignments.length >= 1);
      assert.strictEqual(data.recentAssignments[0].priority, 'high');
    });

    it('Empty Apartment Admin Dashboard returns clean zero counts without errors', async () => {
      const res = await fetch(`${baseUrl}/dashboard/admin`, {
        headers: { Cookie: admin2Cookie }, // Apt 2 has no flats, bills, or complaints
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.data;

      assert.strictEqual(data.totalFlats, 0);
      assert.strictEqual(data.occupiedFlats, 0);
      assert.strictEqual(data.totalCollections, 0);
      assert.strictEqual(data.outstandingBalance, 0);
      assert.strictEqual(data.openComplaintsCount, 0);
      assert.strictEqual(data.activeWorkOrdersCount, 0);
      assert.deepStrictEqual(data.collectionTrends, []);
      assert.deepStrictEqual(data.recentPayments, []);
      assert.deepStrictEqual(data.recentComplaints, []);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. REPORTS MODULE
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Reports Module', () => {
    it('Admin can retrieve Complaints Report with status and category breakdown', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/complaints`, {
        headers: { Cookie: admin1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.data;

      assert.ok(data.totalComplaints >= 1);
      assert.ok(Array.isArray(data.byStatus));
      assert.ok(Array.isArray(data.byCategory));
      assert.ok(Array.isArray(data.byPriority));
      assert.ok(Array.isArray(data.items));
      assert.strictEqual(typeof data.resolutionRate, 'number');
    });

    it('Admin can retrieve Occupancy Report with building breakdown and rate', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/occupancy`, {
        headers: { Cookie: admin1Cookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const data = json.data;

      assert.strictEqual(data.totalFlats, 2);
      assert.strictEqual(data.occupiedCount, 1);
      assert.strictEqual(data.vacantCount, 1);
      assert.strictEqual(data.occupancyRate, 50); // 1 occupied of 2 = 50%
      assert.ok(Array.isArray(data.byBuilding));
      assert.strictEqual(data.byBuilding.length, 1);
      assert.strictEqual(data.byBuilding[0].total, 2);
    });

    it('Ordinary residents cannot access Admin Reports (Forbidden 403)', async () => {
      const res = await fetch(`${baseUrl}/admin/reports/occupancy`, {
        headers: { Cookie: resident1Cookie },
      });

      assert.strictEqual(res.status, 403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. AUDIT LOGS MODULE
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Audit Logs Module', () => {
    it('Super Admin can fetch audit logs matching frontend normalizeListResponse shape', async () => {
      const res = await fetch(`${baseUrl}/super-admin/audit-logs?page=1&limit=10`, {
        headers: { Cookie: superAdminCookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.items || json.data.logs);
      assert.strictEqual(typeof json.data.total, 'number');
      assert.strictEqual(json.data.page, 1);
      assert.strictEqual(json.data.limit, 10);
      assert.strictEqual(typeof json.data.totalPages, 'number');

      // Verify log entries have frontend-compatible virtual attributes
      const logs = json.data.items || json.data.logs;
      if (logs.length > 0) {
        const log = logs[0];
        assert.ok(log.actor || log.actorEmail);
        assert.ok(log.action);
        assert.ok(log.target || log.targetEntity);
        assert.ok(log.createdAt || log.timestamp);
      }
    });

    it('Super Admin can filter audit logs by action and search text', async () => {
      // Add a distinctive audit entry directly or via login
      await AuditLog.create({
        actorEmail: `special_${testTs}@test.com`,
        action: 'ANNOUNCEMENT_CREATE',
        targetEntity: 'Announcement',
        targetId: 'ann-123',
        details: `Created critical fire drill announcement ${testTs}`,
        status: 'SUCCESS',
      });

      const res = await fetch(`${baseUrl}/super-admin/audit-logs?search=${testTs}&action=ANNOUNCEMENT_CREATE`, {
        headers: { Cookie: superAdminCookie },
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      const items = json.data.items || json.data.logs;
      assert.ok(items.length >= 1);
      assert.strictEqual(items[0].action, 'ANNOUNCEMENT_CREATE');
      assert.ok(items[0].details.includes(String(testTs)));
    });

    it('Apartment Admins and Residents are forbidden from accessing Super Admin audit logs (403)', async () => {
      const adminRes = await fetch(`${baseUrl}/super-admin/audit-logs`, {
        headers: { Cookie: admin1Cookie },
      });
      assert.strictEqual(adminRes.status, 403);

      const residentRes = await fetch(`${baseUrl}/super-admin/audit-logs`, {
        headers: { Cookie: resident1Cookie },
      });
      assert.strictEqual(residentRes.status, 403);
    });

    it('Unauthenticated requests to audit logs are rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/super-admin/audit-logs`);
      assert.strictEqual(res.status, 401);
    });
  });
});
