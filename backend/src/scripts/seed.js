/**
 * seed.js
 *
 * Secure, repeatable database seeder for SmartApartment development and local testing.
 *
 * Configured Roles & Demo Accounts:
 * 1. Platform Super Admin:
 *    - superadmin@smartapartment.demo / SuperAdmin@123 (SUPER_ADMIN, platform-wide)
 *
 * 2. Apartment 1: "Grand Horizon Residences" (slug: grand-horizon-residences)
 *    - admin@smartapartment.demo      / Admin@123      (APARTMENT_ADMIN)
 *    - resident@smartapartment.demo   / Resident@123   (RESIDENT, Tower A · Unit 101)
 *    - staff@smartapartment.demo      / Staff@123      (MAINTENANCE_STAFF, General Maintenance & Plumbing)
 *
 * 3. Apartment 2: "Silverline Heights" (slug: silverline-heights)
 *    - admin2@smartapartment.demo     / Admin2@123     (APARTMENT_ADMIN)
 *    - resident2@smartapartment.demo  / Resident2@123  (RESIDENT, Block B · Unit 201)
 *    - staff2@smartapartment.demo     / Staff2@123     (MAINTENANCE_STAFF, Electrical & HVAC)
 *
 * Operational Dataset (internally consistent & clearly marked as demo data):
 * - Recurring billing rule, active & historical bills with integer paise
 * - Offline payment submissions (verified & pending verification)
 * - Maintenance requests across statuses (pending, in_progress, resolved) with staff work orders
 * - Community announcements (all audience, staff-scoped audience)
 * - Operating expenses (soft-deletable OPEX records)
 * - System audit logs
 *
 * Safety & Invariants:
 * - Production guard: refuses execution if NODE_ENV === 'production'
 * - Idempotent: checks for existing records before creation; rerunning never creates duplicates
 * - Uses application bcrypt password hashing (10 salt rounds)
 * - Preserves existing collections without dropping or resetting the database
 */

import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/database.js';
import User from '../models/User.js';
import Apartment from '../models/apartment.model.js';
import Building from '../models/building.model.js';
import Flat from '../models/flat.model.js';
import Membership from '../models/membership.model.js';
import BillingRule from '../models/billing-rule.model.js';
import Bill from '../models/bill.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import Complaint from '../models/complaint.model.js';
import WorkOrder from '../models/work-order.model.js';
import Announcement from '../models/announcement.model.js';
import AuditLog from '../models/audit-log.model.js';
import { ROLES } from '../constants/roles.js';
import { ACCOUNT_STATUS } from '../constants/accountStatus.js';

// ── Production Safety Guard ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('[SECURITY BLOCK] Refusing to run development demo account seeding in PRODUCTION!');
  process.exit(1);
}

// ── Demo Entities Specification ──────────────────────────────────────────────
export const DEMO_COMMUNITIES = [
  {
    slug: 'grand-horizon-residences',
    name: 'Grand Horizon Residences',
    address: '100 Sunset Boulevard, Sector 4',
    city: 'Metropolis',
    state: 'Karnataka',
    postalCode: '560001',
    contactEmail: 'contact@grandhorizon.demo',
    contactPhone: '+91 98765 99999',
    status: 'approved',
    buildings: [
      {
        name: 'Tower A',
        floors: 10,
        totalFlats: 40,
        flats: [
          { number: '101', floor: 1, type: '2BHK', status: 'occupied' },
          { number: '102', floor: 1, type: '2BHK', status: 'occupied' },
          { number: '103', floor: 1, type: '3BHK', status: 'vacant' },
        ],
      },
    ],
  },
  {
    slug: 'silverline-heights',
    name: 'Silverline Heights',
    address: '200 Metro View Road, Phase 2',
    city: 'Metropolis',
    state: 'Karnataka',
    postalCode: '560002',
    contactEmail: 'contact@silverline.demo',
    contactPhone: '+91 98765 88888',
    status: 'approved',
    buildings: [
      {
        name: 'Block B',
        floors: 8,
        totalFlats: 32,
        flats: [
          { number: '201', floor: 2, type: '3BHK', status: 'occupied' },
          { number: '202', floor: 2, type: '2BHK', status: 'vacant' },
        ],
      },
    ],
  },
];

export const DEMO_CREDENTIALS = [
  {
    email: 'superadmin@smartapartment.demo',
    password: process.env.DEMO_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
    name: 'Platform Super Admin',
    role: ROLES.SUPER_ADMIN,
    phone: '+91 98765 00001',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: null,
  },
  {
    email: 'admin@smartapartment.demo',
    password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@123',
    name: 'Horizon Community Admin',
    role: ROLES.APARTMENT_ADMIN,
    phone: '+91 98765 00002',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: 'grand-horizon-residences',
  },
  {
    email: 'resident@smartapartment.demo',
    password: process.env.DEMO_RESIDENT_PASSWORD || 'Resident@123',
    name: 'Alex Rivera',
    role: ROLES.RESIDENT,
    phone: '+91 98765 00003',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: 'grand-horizon-residences',
    buildingName: 'Tower A',
    flatNumber: '101',
  },
  {
    email: 'staff@smartapartment.demo',
    password: process.env.DEMO_STAFF_PASSWORD || 'Staff@123',
    name: 'Sam Morgan',
    role: ROLES.MAINTENANCE_STAFF,
    phone: '+91 98765 00004',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: 'grand-horizon-residences',
    specialization: 'General Maintenance & Plumbing',
  },
  {
    email: 'admin2@smartapartment.demo',
    password: process.env.DEMO_ADMIN2_PASSWORD || 'Admin2@123',
    name: 'Silverline Property Admin',
    role: ROLES.APARTMENT_ADMIN,
    phone: '+91 98765 00005',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: 'silverline-heights',
  },
  {
    email: 'resident2@smartapartment.demo',
    password: process.env.DEMO_RESIDENT2_PASSWORD || 'Resident2@123',
    name: 'Jordan Lee',
    role: ROLES.RESIDENT,
    phone: '+91 98765 00006',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: 'silverline-heights',
    buildingName: 'Block B',
    flatNumber: '201',
  },
  {
    email: 'staff2@smartapartment.demo',
    password: process.env.DEMO_STAFF2_PASSWORD || 'Staff2@123',
    name: 'Casey Taylor',
    role: ROLES.MAINTENANCE_STAFF,
    phone: '+91 98765 00007',
    status: ACCOUNT_STATUS.ACTIVE,
    apartmentSlug: 'silverline-heights',
    specialization: 'Electrical & HVAC',
  },
];

export async function seedDemoAccounts() {
  console.log('================================================================');
  console.log('       SmartApartment Database Seeder — Multi-Tenant Demo       ');
  console.log('================================================================\n');

  const connected = await connectDB();
  if (!connected) {
    throw new Error('Database connection failed. Cannot proceed with seeding.');
  }

  const apartmentMap = {};
  const buildingMap = {};
  const flatMap = {};
  const userMap = {};

  // ── 1. Communities, Buildings & Flats ──────────────────────────────────────
  console.log('[Phase 1] Ensuring Multi-Tenant Apartment Communities...');

  for (const communitySpec of DEMO_COMMUNITIES) {
    let apt = await Apartment.findOne({ slug: communitySpec.slug });
    if (!apt) {
      apt = await Apartment.create({
        name: communitySpec.name,
        slug: communitySpec.slug,
        address: communitySpec.address,
        city: communitySpec.city,
        state: communitySpec.state,
        postalCode: communitySpec.postalCode,
        contactEmail: communitySpec.contactEmail,
        contactPhone: communitySpec.contactPhone,
        status: communitySpec.status,
      });
      console.log(`[CREATED] Apartment: ${apt.name} (${apt.slug})`);
    } else {
      console.log(`[EXISTS]  Apartment: ${apt.name} (${apt.slug})`);
    }
    apartmentMap[communitySpec.slug] = apt;

    for (const bldSpec of communitySpec.buildings) {
      let bld = await Building.findOne({ apartmentId: apt._id, name: bldSpec.name });
      if (!bld) {
        bld = await Building.create({
          apartmentId: apt._id,
          name: bldSpec.name,
          floors: bldSpec.floors,
          totalFlats: bldSpec.totalFlats,
        });
        console.log(`[CREATED]   Building: ${bld.name} (${apt.name})`);
      } else {
        console.log(`[EXISTS]    Building: ${bld.name} (${apt.name})`);
      }
      buildingMap[`${communitySpec.slug}:${bldSpec.name}`] = bld;

      for (const flatSpec of bldSpec.flats) {
        let flt = await Flat.findOne({
          apartmentId: apt._id,
          buildingId: bld._id,
          number: flatSpec.number,
        });
        if (!flt) {
          flt = await Flat.create({
            apartmentId: apt._id,
            buildingId: bld._id,
            number: flatSpec.number,
            floor: flatSpec.floor,
            type: flatSpec.type,
            status: flatSpec.status,
          });
          console.log(`[CREATED]     Flat: Unit ${flt.number} (${bld.name})`);
        } else {
          console.log(`[EXISTS]      Flat: Unit ${flt.number} (${bld.name})`);
        }
        flatMap[`${communitySpec.slug}:${bldSpec.name}:${flatSpec.number}`] = flt;
      }
    }
  }

  // ── 2. Users & Credentials ─────────────────────────────────────────────────
  console.log('\n[Phase 2] Ensuring Demo Accounts across Roles...');

  for (const cred of DEMO_CREDENTIALS) {
    let user = await User.findOne({ email: cred.email });

    const apt = cred.apartmentSlug ? apartmentMap[cred.apartmentSlug] : null;
    const bldKey = cred.buildingName ? `${cred.apartmentSlug}:${cred.buildingName}` : null;
    const bld = bldKey ? buildingMap[bldKey] : null;
    const fltKey = cred.flatNumber ? `${cred.apartmentSlug}:${cred.buildingName}:${cred.flatNumber}` : null;
    const flt = fltKey ? flatMap[fltKey] : null;

    if (!user) {
      const hashedPassword = await bcrypt.hash(cred.password, 10);
      user = await User.create({
        name: cred.name,
        email: cred.email,
        password: hashedPassword,
        phone: cred.phone,
        role: cred.role,
        status: cred.status,
        apartmentId: apt ? apt._id : null,
        apartment: apt ? apt._id : null,
        buildingId: bld ? bld._id : null,
        flatId: flt ? flt._id : null,
        specialization: cred.specialization || null,
      });
      console.log(`[CREATED] User: ${cred.role.padEnd(18)} ${cred.email}`);
    } else {
      // Ensure relations, role, and status are canonical on user
      let updated = false;
      if (user.role !== cred.role) {
        user.role = cred.role;
        updated = true;
      }
      if (user.status !== cred.status) {
        user.status = cred.status;
        updated = true;
      }
      if (apt && (!user.apartmentId || !user.apartmentId.equals(apt._id))) {
        user.apartmentId = apt._id;
        user.apartment = apt._id;
        updated = true;
      }
      if (bld && (!user.buildingId || !user.buildingId.equals(bld._id))) {
        user.buildingId = bld._id;
        updated = true;
      }
      if (flt && (!user.flatId || !user.flatId.equals(flt._id))) {
        user.flatId = flt._id;
        updated = true;
      }
      if (cred.specialization && user.specialization !== cred.specialization) {
        user.specialization = cred.specialization;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
      console.log(`[EXISTS]  User: ${cred.role.padEnd(18)} ${cred.email}`);
    }
    userMap[cred.email] = user;

    // ── 3. Memberships for Residents ─────────────────────────────────────────
    if (cred.role === ROLES.RESIDENT && apt && flt && bld) {
      let membership = await Membership.findOne({
        userId: user._id,
        apartmentId: apt._id,
      });
      if (!membership) {
        membership = await Membership.create({
          userId: user._id,
          apartmentId: apt._id,
          buildingId: bld._id,
          flatId: flt._id,
          role: 'resident',
          status: 'active',
          occupancyType: 'tenant',
        });
        console.log(`[CREATED]   Membership: ${user.name} -> ${bld.name} Unit ${flt.number}`);
      } else {
        console.log(`[EXISTS]    Membership: ${user.name} -> ${bld.name} Unit ${flt.number}`);
      }
    }
  }

  // ── 4. Billing Rules, Bills & Payments (Grand Horizon Residences) ───────────
  console.log('\n[Phase 3] Ensuring Billing Engine & Demo Invoices...');

  const apt1 = apartmentMap['grand-horizon-residences'];
  const flat101 = flatMap['grand-horizon-residences:Tower A:101'];
  const res1 = userMap['resident@smartapartment.demo'];
  const adm1 = userMap['admin@smartapartment.demo'];
  const stf1 = userMap['staff@smartapartment.demo'];

  // Billing Rule
  let rule = await BillingRule.findOne({
    apartmentId: apt1._id,
    name: 'Standard Maintenance Charge',
  });
  if (!rule) {
    rule = await BillingRule.create({
      apartmentId: apt1._id,
      name: 'Standard Maintenance Charge',
      description: 'Monthly residential flat maintenance charge',
      chargeType: 'fixed_monthly',
      amountPaise: 350000, // ₹3,500.00
      billingFrequency: 'monthly',
      effectiveFrom: new Date('2026-01-01'),
      status: 'active',
      createdBy: adm1._id,
    });
    console.log(`[CREATED] BillingRule: ${rule.name} (₹3,500/month)`);
  } else {
    console.log(`[EXISTS]  BillingRule: ${rule.name}`);
  }

  // Bill 1: Current Unpaid Demo Bill
  let billCurrent = await Bill.findOne({
    flatId: flat101._id,
    billingPeriod: '2026-10',
  });
  if (!billCurrent) {
    billCurrent = await Bill.create({
      billNumber: 'BILL-DEMO-101-202610',
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      residentId: res1._id,
      billingPeriod: '2026-10',
      billingPeriodLabel: 'October 2026',
      lineItems: [{ label: 'Monthly Maintenance Charge', amountPaise: 350000 }],
      subtotalPaise: 350000,
      totalPaise: 350000,
      paidPaise: 0,
      dueDate: new Date('2026-11-10'),
      status: 'unpaid',
      notes: 'Demo Bill: October maintenance cycle (Awaiting payment)',
      generatedBy: adm1._id,
    });
    console.log(`[CREATED] Bill: ${billCurrent.billNumber} (Status: unpaid, ₹3,500)`);
  } else {
    console.log(`[EXISTS]  Bill: ${billCurrent.billNumber}`);
  }

  // Bill 2: Previous Paid Demo Bill
  let billPaid = await Bill.findOne({
    flatId: flat101._id,
    billingPeriod: '2026-09',
  });
  if (!billPaid) {
    billPaid = await Bill.create({
      billNumber: 'BILL-DEMO-101-202609',
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      residentId: res1._id,
      billingPeriod: '2026-09',
      billingPeriodLabel: 'September 2026',
      lineItems: [{ label: 'Monthly Maintenance Charge', amountPaise: 350000 }],
      subtotalPaise: 350000,
      totalPaise: 350000,
      paidPaise: 350000,
      dueDate: new Date('2026-10-10'),
      status: 'paid',
      notes: 'Demo Bill: September maintenance cycle (Fully paid)',
      generatedBy: adm1._id,
    });
    console.log(`[CREATED] Bill: ${billPaid.billNumber} (Status: paid, ₹3,500)`);
  } else {
    console.log(`[EXISTS]  Bill: ${billPaid.billNumber}`);
  }

  // Payment 1: Verified Historical Payment on September Bill
  let pmt1 = await Payment.findOne({
    apartmentId: apt1._id,
    referenceNumber: 'DEMO-UPI-202609-001',
  });
  if (!pmt1) {
    pmt1 = await Payment.create({
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      payerId: res1._id,
      billId: billPaid._id,
      billNumber: billPaid.billNumber,
      amountPaise: 350000,
      paymentMethod: 'upi',
      referenceNumber: 'DEMO-UPI-202609-001',
      paymentDate: new Date('2026-10-05'),
      notes: 'Demo Payment: Paid via Google Pay UPI for Sept maintenance',
      status: 'verified',
      verifiedBy: adm1._id,
      verifiedAt: new Date('2026-10-06'),
      verificationComments: 'Verified against bank settlement statement',
      appliedToBill: true,
    });
    console.log(`[CREATED] Payment: ${pmt1.referenceNumber} (Status: verified, ₹3,500)`);
  } else {
    console.log(`[EXISTS]  Payment: ${pmt1.referenceNumber}`);
  }

  // Payment 2: Pending Offline Payment on October Bill
  let pmt2 = await Payment.findOne({
    apartmentId: apt1._id,
    referenceNumber: 'DEMO-UPI-202610-PENDING',
  });
  if (!pmt2) {
    pmt2 = await Payment.create({
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      payerId: res1._id,
      billId: billCurrent._id,
      billNumber: billCurrent.billNumber,
      amountPaise: 350000,
      paymentMethod: 'upi',
      referenceNumber: 'DEMO-UPI-202610-PENDING',
      paymentDate: new Date(),
      notes: 'Demo Payment: Submitted payment awaiting admin verification',
      status: 'pending',
      appliedToBill: false,
    });
    console.log(`[CREATED] Payment: ${pmt2.referenceNumber} (Status: pending, ₹3,500)`);
  } else {
    console.log(`[EXISTS]  Payment: ${pmt2.referenceNumber}`);
  }

  // ── 5. Maintenance Requests & Work Orders ───────────────────────────────────
  console.log('\n[Phase 4] Ensuring Maintenance Requests & Work Orders...');

  // Complaint 1: Pending
  let comp1 = await Complaint.findOne({
    apartmentId: apt1._id,
    ticketNumber: 'MR-DEMO-00001',
  });
  if (!comp1) {
    comp1 = await Complaint.create({
      ticketNumber: 'MR-DEMO-00001',
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      requestedBy: res1._id,
      subject: 'Low water pressure in kitchen faucet',
      description: 'Water pressure in the kitchen faucet has dropped noticeably since Monday morning.',
      category: 'plumbing',
      priority: 'medium',
      status: 'pending',
    });
    console.log(`[CREATED] Complaint: ${comp1.ticketNumber} (Status: pending)`);
  } else {
    console.log(`[EXISTS]  Complaint: ${comp1.ticketNumber}`);
  }

  // Complaint 2: In Progress (Assigned to Staff)
  let comp2 = await Complaint.findOne({
    apartmentId: apt1._id,
    ticketNumber: 'MR-DEMO-00002',
  });
  if (!comp2) {
    comp2 = await Complaint.create({
      ticketNumber: 'MR-DEMO-00002',
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      requestedBy: res1._id,
      assignedTo: stf1._id,
      subject: 'Balcony light fixture flickering',
      description: 'Outdoor ceiling bulb socket in balcony buzzes and flickers intermittently in evenings.',
      category: 'electrical',
      priority: 'high',
      status: 'in_progress',
    });
    console.log(`[CREATED] Complaint: ${comp2.ticketNumber} (Status: in_progress, assigned to ${stf1.name})`);
  } else {
    console.log(`[EXISTS]  Complaint: ${comp2.ticketNumber}`);
  }

  // Work Order for Complaint 2
  let wo1 = await WorkOrder.findOne({
    apartmentId: apt1._id,
    orderNumber: 'WO-DEMO-00001',
  });
  if (!wo1) {
    wo1 = await WorkOrder.create({
      orderNumber: 'WO-DEMO-00001',
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      complaintId: comp2._id,
      title: 'Repair Balcony Lighting Circuit',
      description: 'Inspect fixture wiring, replace damaged socket, and verify circuit load stability.',
      category: 'electrical',
      priority: 'high',
      status: 'in_progress',
      createdBy: adm1._id,
      assignedTo: stf1._id,
    });
    console.log(`[CREATED] WorkOrder: ${wo1.orderNumber} (Assigned to ${stf1.name})`);
  } else {
    console.log(`[EXISTS]  WorkOrder: ${wo1.orderNumber}`);
  }

  // Complaint 3: Resolved
  let comp3 = await Complaint.findOne({
    apartmentId: apt1._id,
    ticketNumber: 'MR-DEMO-00003',
  });
  if (!comp3) {
    comp3 = await Complaint.create({
      ticketNumber: 'MR-DEMO-00003',
      apartmentId: apt1._id,
      buildingId: flat101.buildingId,
      flatId: flat101._id,
      requestedBy: res1._id,
      assignedTo: stf1._id,
      subject: 'Intercom handset replacement',
      description: 'Front gate visitor buzzer was not connecting to Unit 101.',
      category: 'security',
      priority: 'medium',
      status: 'resolved',
      resolutionNotes: 'Replaced internal handset unit; verified two-way audio with main gate security.',
      resolvedAt: new Date(),
    });
    console.log(`[CREATED] Complaint: ${comp3.ticketNumber} (Status: resolved)`);
  } else {
    console.log(`[EXISTS]  Complaint: ${comp3.ticketNumber}`);
  }

  // Complaint in Apartment 2 (Silverline Heights) for cross-tenant isolation testing
  const apt2 = apartmentMap['silverline-heights'];
  const flat201 = flatMap['silverline-heights:Block B:201'];
  const res2 = userMap['resident2@smartapartment.demo'];

  let comp4 = await Complaint.findOne({
    apartmentId: apt2._id,
    ticketNumber: 'MR-DEMO-20001',
  });
  if (!comp4) {
    comp4 = await Complaint.create({
      ticketNumber: 'MR-DEMO-20001',
      apartmentId: apt2._id,
      buildingId: flat201.buildingId,
      flatId: flat201._id,
      requestedBy: res2._id,
      subject: 'Elevator squeaking sound on 4th floor landing',
      description: 'Noticeable friction noise when main elevator ascends past 4th floor.',
      category: 'structural',
      priority: 'medium',
      status: 'pending',
    });
    console.log(`[CREATED] Complaint: ${comp4.ticketNumber} (Silverline Heights)`);
  } else {
    console.log(`[EXISTS]  Complaint: ${comp4.ticketNumber}`);
  }

  // ── 6. Announcements & Operating Expenses ──────────────────────────────────
  console.log('\n[Phase 5] Ensuring Announcements & Operating Expenses...');

  // Notice 1: Public Community Announcement
  let ann1 = await Announcement.findOne({
    apartmentId: apt1._id,
    title: 'Annual Fire Safety Drill & System Inspection',
  });
  if (!ann1) {
    ann1 = await Announcement.create({
      apartmentId: apt1._id,
      title: 'Annual Fire Safety Drill & System Inspection',
      content: 'The annual community fire safety drill and alarm test will take place this Saturday at 10:00 AM. Please follow staff instructions.',
      audience: 'all',
      category: 'security',
      priority: 'high',
      status: 'published',
      isPublished: true,
      publishedAt: new Date(),
      createdBy: adm1._id,
    });
    console.log(`[CREATED] Announcement: ${ann1.title} (Audience: all)`);
  } else {
    console.log(`[EXISTS]  Announcement: ${ann1.title}`);
  }

  // Notice 2: Staff-Only Announcement
  let ann2 = await Announcement.findOne({
    apartmentId: apt1._id,
    title: 'Quarterly Maintenance Operations Briefing',
  });
  if (!ann2) {
    ann2 = await Announcement.create({
      apartmentId: apt1._id,
      title: 'Quarterly Maintenance Operations Briefing',
      content: 'All maintenance operations staff are required to attend the quarterly safety briefing on Friday morning at 9:00 AM.',
      audience: 'staff',
      category: 'maintenance',
      priority: 'normal',
      status: 'published',
      isPublished: true,
      publishedAt: new Date(),
      createdBy: adm1._id,
    });
    console.log(`[CREATED] Announcement: ${ann2.title} (Audience: staff)`);
  } else {
    console.log(`[EXISTS]  Announcement: ${ann2.title}`);
  }

  // Expense 1
  let exp1 = await Expense.findOne({
    apartmentId: apt1._id,
    referenceNumber: 'EXP-DEMO-2026-001',
  });
  if (!exp1) {
    exp1 = await Expense.create({
      apartmentId: apt1._id,
      title: 'Water Tank Cleaning & Disinfection',
      description: 'Quarterly cleaning and chemical disinfection of overhead and underground water reservoirs.',
      category: 'cleaning',
      amountPaise: 850000, // ₹8,500.00
      expenseDate: new Date('2026-10-01'),
      vendor: 'CleanWater Solutions LLP',
      referenceNumber: 'EXP-DEMO-2026-001',
      createdBy: adm1._id,
    });
    console.log(`[CREATED] Expense: ${exp1.title} (₹8,500)`);
  } else {
    console.log(`[EXISTS]  Expense: ${exp1.title}`);
  }

  // Expense 2
  let exp2 = await Expense.findOne({
    apartmentId: apt1._id,
    referenceNumber: 'EXP-DEMO-2026-002',
  });
  if (!exp2) {
    exp2 = await Expense.create({
      apartmentId: apt1._id,
      title: 'Common Area Electricity Bill - September',
      description: 'Electricity consumption charges for corridors, lifts, water pumps, and compound lighting.',
      category: 'utilities',
      amountPaise: 2450000, // ₹24,500.00
      expenseDate: new Date('2026-10-04'),
      vendor: 'State Power Distribution Corp',
      referenceNumber: 'EXP-DEMO-2026-002',
      createdBy: adm1._id,
    });
    console.log(`[CREATED] Expense: ${exp2.title} (₹24,500)`);
  } else {
    console.log(`[EXISTS]  Expense: ${exp2.title}`);
  }

  // ── 7. Audit Log Sample ────────────────────────────────────────────────────
  let logSample = await AuditLog.findOne({
    action: 'SYSTEM_SEED',
    apartmentId: apt1._id,
  });
  if (!logSample) {
    await AuditLog.create({
      actorId: userMap['superadmin@smartapartment.demo']._id,
      actorEmail: 'superadmin@smartapartment.demo',
      actorRole: 'SUPER_ADMIN',
      action: 'SYSTEM_SEED',
      targetEntity: 'System',
      targetId: 'demo-dataset',
      apartmentId: apt1._id,
      details: 'Initialized development demo dataset across communities',
      status: 'SUCCESS',
    });
  }

  console.log('\n================================================================');
  console.log('       Seeding Completed Successfully (Idempotent Pass)          ');
  console.log('================================================================\n');

  await disconnectDB();
  return {
    communities: Object.keys(apartmentMap).length,
    users: Object.keys(userMap).length,
  };
}

// Direct execution runner
if (process.argv[1]?.endsWith('seed.js')) {
  seedDemoAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL] Seeding failed:', err.message);
      process.exit(1);
    });
}
