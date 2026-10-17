/**
 * dashboard.controller.js
 *
 * Real database-backed statistics for all role-specific dashboards:
 * - Super Admin: Platform-wide aggregations & pending approvals
 * - Apartment Admin: Scoped apartment counts, billing/collections, complaints, work orders
 * - Resident: Scoped personal flat dues, latest bill, payment history, open complaints
 * - Maintenance Staff: Assigned work order metrics and active tasks
 */

import Apartment from '../models/apartment.model.js';
import Building from '../models/building.model.js';
import Flat from '../models/flat.model.js';
import User from '../models/User.js';
import Membership from '../models/membership.model.js';
import Bill from '../models/bill.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import Complaint from '../models/complaint.model.js';
import WorkOrder from '../models/work-order.model.js';
import Announcement from '../models/announcement.model.js';

function canonicalRole(role) {
  const MAP = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    super_admin: 'SUPER_ADMIN',
    APARTMENT_ADMIN: 'APARTMENT_ADMIN',
    admin: 'APARTMENT_ADMIN',
    RESIDENT: 'RESIDENT',
    resident: 'RESIDENT',
    MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',
    staff: 'MAINTENANCE_STAFF',
  };
  return MAP[role] || String(role || '').toUpperCase();
}

function isSuperAdmin(user) {
  return canonicalRole(user?.role) === 'SUPER_ADMIN';
}

function getApartmentId(user, queryId) {
  if (isSuperAdmin(user) && queryId) return queryId;
  return user?.apartmentId || user?.apartment || null;
}

/**
 * GET /api/v1/dashboard/super-admin
 * Platform-wide aggregation metrics for Super Admin.
 */
export async function getSuperAdminDashboard(req, res, next) {
  try {
    const [
      totalApartments,
      pendingApartments,
      approvedApartments,
      suspendedApartments,
      totalUsers,
      totalFlats,
      pendingListDocs,
    ] = await Promise.all([
      Apartment.countDocuments(),
      Apartment.countDocuments({ status: 'pending' }),
      Apartment.countDocuments({ status: 'approved' }),
      Apartment.countDocuments({ status: 'suspended' }),
      User.countDocuments(),
      Flat.countDocuments(),
      Apartment.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const pendingList = pendingListDocs.map((apt) => ({
      id: apt._id.toString(),
      _id: apt._id.toString(),
      name: apt.name,
      adminEmail: apt.contactEmail || '',
      email: apt.contactEmail || '',
      createdAt: apt.createdAt,
      status: apt.status,
    }));

    const chartData = [
      { name: 'Approved', count: approvedApartments },
      { name: 'Pending', count: pendingApartments },
      { name: 'Suspended', count: suspendedApartments },
    ];

    return res.status(200).json({
      success: true,
      data: {
        totalApartments,
        pendingApartments,
        approvedApartments,
        suspendedApartments,
        totalUsers,
        totalFlats,
        pendingList,
        chartData,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/dashboard/admin
 * Apartment Admin metrics derived live from MongoDB for their apartment.
 */
export async function getAdminDashboard(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);

    if (!apartmentId) {
      return res.status(200).json({
        success: true,
        data: {
          totalFlats: 0,
          occupiedFlats: 0,
          totalCollections: 0,
          outstandingBalance: 0,
          pendingPaymentsCount: 0,
          pendingBillsCount: 0,
          billsIssuedCount: 0,
          openComplaintsCount: 0,
          activeWorkOrdersCount: 0,
          collectionTrends: [],
          recentPayments: [],
          recentComplaints: [],
        },
      });
    }

    const aptFilter = { apartmentId };

    const [
      totalFlats,
      occupiedFlats,
      collectionsAgg,
      outstandingAgg,
      pendingPaymentsCount,
      pendingBillsCount,
      billsIssuedCount,
      openComplaintsCount,
      activeWorkOrdersCount,
      recentPaymentsDocs,
      recentComplaintsDocs,
      verifiedPaymentsDocs,
    ] = await Promise.all([
      Flat.countDocuments({ ...aptFilter, isArchived: { $ne: true } }),
      Flat.countDocuments({ ...aptFilter, status: 'occupied', isArchived: { $ne: true } }),
      Payment.aggregate([
        { $match: { apartmentId, status: 'verified' } },
        { $group: { _id: null, sum: { $sum: '$amountPaise' } } },
      ]),
      Bill.aggregate([
        {
          $match: {
            apartmentId,
            status: { $in: ['unpaid', 'partially_paid', 'overdue'] },
          },
        },
        {
          $group: {
            _id: null,
            sum: { $sum: { $subtract: ['$totalPaise', '$paidPaise'] } },
          },
        },
      ]),
      Payment.countDocuments({ ...aptFilter, status: 'pending' }),
      Bill.countDocuments({
        ...aptFilter,
        status: { $in: ['unpaid', 'partially_paid', 'overdue'] },
      }),
      Bill.countDocuments(aptFilter),
      Complaint.countDocuments({
        ...aptFilter,
        status: { $in: ['open', 'in_progress', 'assigned', 'pending'] },
      }),
      WorkOrder.countDocuments({
        ...aptFilter,
        status: { $in: ['open', 'in_progress', 'assigned', 'pending'] },
      }),
      Payment.find({ ...aptFilter, status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('payerId', 'name email')
        .populate('flatId', 'number')
        .lean({ virtuals: true }),
      Complaint.find({
        ...aptFilter,
        status: { $in: ['open', 'in_progress', 'assigned', 'pending'] },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('flatId', 'number')
        .lean(),
      Payment.find({ apartmentId, status: 'verified' })
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(100)
        .lean({ virtuals: true }),
    ]);

    const totalCollections = Number(((collectionsAgg[0]?.sum || 0) / 100).toFixed(2));
    const outstandingBalance = Number(((outstandingAgg[0]?.sum || 0) / 100).toFixed(2));

    // Format recent payments for dashboard preview
    const recentPayments = recentPaymentsDocs.map((p) => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      amount: p.amount || Number((p.amountPaise / 100).toFixed(2)),
      residentName: p.payerId?.name || '',
      flatNumber: p.flatId?.number || '',
      referenceNumber: p.referenceNumber || '',
      paymentMethod: p.paymentMethod || 'other',
      createdAt: p.createdAt,
    }));

    // Format recent complaints for dashboard preview
    const recentComplaints = recentComplaintsDocs.map((c) => ({
      id: c._id.toString(),
      _id: c._id.toString(),
      title: c.subject || c.title || 'Complaint',
      flatNumber: c.flatId?.number || '',
      priority: c.priority || 'normal',
      status: c.status || 'open',
      createdAt: c.createdAt,
    }));

    // Group verified payments by month for collection trends chart
    const monthMap = {};
    verifiedPaymentsDocs.forEach((p) => {
      const d = p.paymentDate || p.createdAt;
      if (d) {
        const monthKey = new Date(d).toLocaleDateString('en-IN', {
          month: 'short',
          year: '2-digit',
        });
        monthMap[monthKey] = (monthMap[monthKey] || 0) + (p.amount || p.amountPaise / 100);
      }
    });

    const collectionTrends = Object.entries(monthMap).map(([month, amount]) => ({
      month,
      amount: Number(amount.toFixed(2)),
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalFlats,
        occupiedFlats,
        totalCollections,
        outstandingBalance,
        pendingPaymentsCount,
        pendingBillsCount,
        billsIssuedCount,
        openComplaintsCount,
        activeWorkOrdersCount,
        collectionTrends,
        recentPayments,
        recentComplaints,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/dashboard/resident
 * Authenticated resident portal dashboard metrics.
 */
export async function getResidentDashboard(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, null);

    // Identify flat & building
    let buildingName = '—';
    let flatNumber = '—';
    let userFlatId = user.flatId || null;

    if (!userFlatId && apartmentId) {
      const membership = await Membership.findOne({
        userId: user._id,
        apartmentId,
        status: 'active',
      }).lean();
      if (membership?.flatId) {
        userFlatId = membership.flatId;
      }
    }

    if (userFlatId) {
      const flat = await Flat.findById(userFlatId).populate('buildingId', 'name').lean();
      if (flat) {
        flatNumber = flat.number;
        buildingName = flat.buildingId?.name || '—';
      }
    } else if (user.buildingId) {
      const bldg = await Building.findById(user.buildingId).lean();
      if (bldg) buildingName = bldg.name;
    }

    // Bills and dues queries
    const billFilter = {
      $or: [
        { residentId: user._id },
        ...(userFlatId ? [{ flatId: userFlatId }] : []),
      ],
    };
    if (apartmentId) billFilter.apartmentId = apartmentId;

    const [
      outstandingAgg,
      latestBillDoc,
      openComplaintsCount,
      recentPaymentsDocs,
      recentAnnouncementsDocs,
    ] = await Promise.all([
      Bill.aggregate([
        {
          $match: {
            ...billFilter,
            status: { $in: ['unpaid', 'partially_paid', 'overdue'] },
          },
        },
        {
          $group: {
            _id: null,
            sum: { $sum: { $subtract: ['$totalPaise', '$paidPaise'] } },
          },
        },
      ]),
      Bill.findOne(billFilter)
        .sort({ dueDate: -1, createdAt: -1 })
        .lean({ virtuals: true }),
      Complaint.countDocuments({
        requestedBy: user._id,
        status: { $in: ['open', 'in_progress', 'assigned', 'pending'] },
      }),
      Payment.find({ payerId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean({ virtuals: true }),
      apartmentId
        ? Announcement.find({
            apartmentId,
            status: 'published',
            isPublished: true,
            audience: { $in: ['all', 'residents'] },
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
          })
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(5)
            .lean({ virtuals: true })
        : Promise.resolve([]),
    ]);

    const outstandingBalance = Number(((outstandingAgg[0]?.sum || 0) / 100).toFixed(2));

    const latestBill = latestBillDoc
      ? {
          id: latestBillDoc._id.toString(),
          _id: latestBillDoc._id.toString(),
          billNumber: latestBillDoc.billNumber,
          billingPeriod: latestBillDoc.billingPeriod,
          amount: latestBillDoc.totalAmount || Number((latestBillDoc.totalPaise / 100).toFixed(2)),
          totalAmount: latestBillDoc.totalAmount || Number((latestBillDoc.totalPaise / 100).toFixed(2)),
          dueDate: latestBillDoc.dueDate
            ? new Date(latestBillDoc.dueDate).toLocaleDateString()
            : null,
          status: latestBillDoc.status,
        }
      : null;

    const recentPayments = recentPaymentsDocs.map((p) => ({
      id: p._id.toString(),
      _id: p._id.toString(),
      amount: p.amount || Number((p.amountPaise / 100).toFixed(2)),
      paymentMethod: p.paymentMethod || 'Bank Transfer',
      referenceNumber: p.referenceNumber || 'N/A',
      status: p.status || 'pending',
      createdAt: p.createdAt,
    }));

    const recentAnnouncements = recentAnnouncementsDocs.map((a) => ({
      id: a._id.toString(),
      _id: a._id.toString(),
      title: a.title,
      content: a.content,
      message: a.content,
      priority: a.priority || 'normal',
      createdAt: a.publishedAt || a.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        outstandingBalance,
        latestBill,
        openComplaintsCount,
        recentPayments,
        recentAnnouncements,
        flatInfo: {
          buildingName,
          flatNumber,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/dashboard/staff
 * Maintenance staff work orders and assigned task metrics.
 */
export async function getStaffDashboard(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, null);

    const taskFilter = {
      $or: [
        { assignedTo: user._id },
        { assignedStaff: user._id },
      ],
    };
    if (apartmentId) taskFilter.apartmentId = apartmentId;

    const [
      assignedOrdersCount,
      inProgressOrdersCount,
      completedOrdersCount,
      recentAssignmentsDocs,
    ] = await Promise.all([
      WorkOrder.countDocuments(taskFilter),
      WorkOrder.countDocuments({
        ...taskFilter,
        status: { $in: ['in_progress', 'assigned'] },
      }),
      WorkOrder.countDocuments({
        ...taskFilter,
        status: { $in: ['resolved', 'completed', 'closed'] },
      }),
      WorkOrder.find(taskFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('flatId', 'number')
        .populate('buildingId', 'name')
        .lean(),
    ]);

    const recentAssignments = recentAssignmentsDocs.map((w) => ({
      id: w._id.toString(),
      _id: w._id.toString(),
      title: w.title || w.description || 'Maintenance Task',
      issue: w.title || w.description || 'Maintenance Task',
      location: w.buildingId?.name
        ? `${w.buildingId.name} · Flat ${w.flatId?.number || '—'}`
        : `Flat ${w.flatId?.number || 'Common Area'}`,
      flatNumber: w.flatId?.number || '',
      priority: w.priority || 'normal',
      status: w.status || 'open',
      createdAt: w.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: {
        assignedOrdersCount,
        assignedTasksCount: assignedOrdersCount,
        inProgressOrdersCount,
        inProgressCount: inProgressOrdersCount,
        completedOrdersCount,
        completedCount: completedOrdersCount,
        recentAssignments,
        recentWorkOrders: recentAssignments,
      },
    });
  } catch (err) {
    next(err);
  }
}
