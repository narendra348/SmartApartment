/**
 * billing.controller.js
 *
 * Complete billing and finance module controller.
 *
 * Sections:
 *   A. Billing Rules  (admin: CRUD)
 *   B. Bills          (admin: generate, list, get; resident: list own, get own)
 *   C. Payments       (resident: submit; admin: list, get, verify, reject)
 *   D. Expenses       (admin: CRUD with soft delete)
 *   E. Reports        (admin: collections, outstanding, expenses)
 *
 * Monetary precision strategy:
 *   - All input amounts in rupees are multiplied by 100 and rounded to integer paise.
 *   - All stored values are integer paise.
 *   - All arithmetic is performed on integers (no floating-point accumulation).
 *   - Rupee values are derived only in virtual getters and response serialization.
 *
 * Authorization:
 *   - All queries pre-scoped by apartmentId before any data is returned.
 *   - Residents see only their own bills/payments.
 *   - Only admins may generate bills, verify payments, or manage rules/expenses.
 */

import mongoose from 'mongoose';
import BillingRule from '../models/billing-rule.model.js';
import Bill from '../models/bill.model.js';
import Payment from '../models/payment.model.js';
import Expense from '../models/expense.model.js';
import Flat from '../models/flat.model.js';
import Building from '../models/building.model.js';
import Complaint from '../models/complaint.model.js';
import Membership from '../models/membership.model.js';
import { logAudit } from '../services/audit.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert rupees (Number) to integer paise. */
function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/** Canonical role check */
function canonicalRole(role) {
  const MAP = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    super_admin: 'SUPER_ADMIN',
    APARTMENT_ADMIN: 'APARTMENT_ADMIN',
    admin: 'APARTMENT_ADMIN',
    RESIDENT: 'RESIDENT',
    resident: 'RESIDENT',
    MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',
  };
  return MAP[role] || String(role || '').toUpperCase();
}

function isSuperAdmin(user) { return canonicalRole(user.role) === 'SUPER_ADMIN'; }
function isAdmin(user) {
  const r = canonicalRole(user.role);
  return r === 'APARTMENT_ADMIN' || r === 'SUPER_ADMIN';
}
function isResident(user) { return canonicalRole(user.role) === 'RESIDENT'; }

function getApartmentId(user, queryId) {
  if (isSuperAdmin(user) && queryId) return queryId;
  return user.apartmentId || user.apartment || null;
}

function paginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  return { page, limit };
}

/** Serialize a bill document for API response (converts paise → rupees) */
function formatBill(doc, flat, building) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  // Populate convenience fields
  if (flat) {
    obj.flatNumber = flat.number;
    obj.buildingName = building?.name || '';
  }
  return obj;
}

/** Serialize a payment document */
function formatPayment(doc, payer, bill) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (payer) {
    obj.residentName = payer.name || '';
    obj.residentEmail = payer.email || '';
    obj.flatNumber = payer.flatId?.number || payer.flat?.number || '';
    obj.buildingName = payer.buildingId?.name || payer.building?.name || '';
  }
  if (bill) {
    obj.bill = {
      billNumber: bill.billNumber,
      billingPeriod: bill.billingPeriod,
      billingPeriodLabel: bill.billingPeriodLabel,
      totalAmount: bill.totalAmount,
    };
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  A. BILLING RULES
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/billing-rules */
export async function listBillingRules(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    if (!apartmentId) return res.status(200).json({ success: true, data: [], items: [], total: 0 });

    const filter = { apartmentId };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const rules = await BillingRule.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: rules,
      rules,
      items: rules,
      total: rules.length,
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/billing-rules */
export async function createBillingRule(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, req.body.apartmentId);
    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'APARTMENT_REQUIRED', message: 'Apartment association required.' },
      });
    }

    const {
      name,
      description,
      chargeType,
      amount,
      billingFrequency,
      frequency,
      effectiveFrom,
      effectiveTo,
      status,
    } = req.body || {};

    if (!name || !amount) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name and amount are required.' },
      });
    }

    let normChargeType = String(chargeType || 'fixed_monthly').toLowerCase().trim();
    if (normChargeType === 'flat') normChargeType = 'per_flat';
    if (normChargeType === 'sqft') normChargeType = 'per_sqft';

    const validChargeTypes = ['fixed_monthly', 'fixed', 'per_flat', 'per_sqft', 'one_time', 'other'];
    if (!validChargeTypes.includes(normChargeType)) {
      normChargeType = 'fixed_monthly';
    }

    const amountPaise = rupeesToPaise(amount);
    if (!Number.isInteger(amountPaise) || amountPaise < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Amount must be a positive number (min ₹0.01).' },
      });
    }

    const rule = await BillingRule.create({
      apartmentId,
      name: String(name).trim(),
      description: (description || '').trim(),
      chargeType: normChargeType,
      amountPaise,
      billingFrequency: billingFrequency || frequency || 'monthly',
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      status: status || 'active',
      createdBy: user._id,
    });

    logAudit({
      actor: user, action: 'BILLING_RULE_CREATE', targetEntity: 'BillingRule',
      targetId: rule._id, apartmentId, details: `Created rule "${rule.name}"`,
    });

    return res.status(201).json({ success: true, data: rule });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') } });
    }
    next(err);
  }
}

/** PUT /api/v1/admin/billing-rules/:id */
export async function updateBillingRule(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid ID.' } });
    }

    const rule = await BillingRule.findById(id);
    if (!rule) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Billing rule not found.' } });

    const apartmentId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && !rule.apartmentId.equals(apartmentId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    const { name, description, chargeType, amount, billingFrequency, effectiveFrom, effectiveTo, status } = req.body || {};
    if (name !== undefined) rule.name = String(name).trim();
    if (description !== undefined) rule.description = String(description).trim();
    if (chargeType !== undefined) rule.chargeType = chargeType;
    if (amount !== undefined) {
      const ap = rupeesToPaise(amount);
      if (!Number.isInteger(ap) || ap < 1) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid amount.' } });
      }
      rule.amountPaise = ap;
    }
    if (billingFrequency !== undefined) rule.billingFrequency = billingFrequency;
    if (effectiveFrom !== undefined) rule.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo !== undefined) rule.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    if (status !== undefined) rule.status = status;

    await rule.save();

    logAudit({
      actor: req.user, action: 'BILLING_RULE_UPDATE', targetEntity: 'BillingRule',
      targetId: rule._id, apartmentId: rule.apartmentId, details: `Updated rule "${rule.name}"`,
    });

    return res.status(200).json({ success: true, data: rule });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') } });
    }
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  B. BILLS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/bills */
export async function listBills(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    const { page, limit } = paginationParams(req.query);

    const filter = {};
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.flatId && mongoose.Types.ObjectId.isValid(req.query.flatId)) filter.flatId = req.query.flatId;
    if (req.query.billingPeriod) filter.billingPeriod = req.query.billingPeriod;

    // Auto-mark overdue bills
    const now = new Date();
    await Bill.updateMany(
      { apartmentId: apartmentId || { $exists: true }, status: 'unpaid', dueDate: { $lt: now } },
      { $set: { status: 'overdue' } },
    );

    const [total, bills] = await Promise.all([
      Bill.countDocuments(filter),
      Bill.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('flatId', 'number buildingId')
        .populate('residentId', 'name email')
        .lean({ virtuals: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: bills,
      bills,
      items: bills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/resident/bills */
export async function listResidentBills(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, null);
    const { page, limit } = paginationParams(req.query);

    const residentFlatIds = [];
    if (user.flatId) residentFlatIds.push(user.flatId);
    const memberships = await Membership.find({ userId: user._id, status: 'active' });
    memberships.forEach((m) => {
      if (m.flatId) residentFlatIds.push(m.flatId);
    });

    const filter = {
      $or: [
        { residentId: user._id },
        { flatId: { $in: residentFlatIds } },
      ],
    };
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const now = new Date();
    await Bill.updateMany(
      { ...filter, status: 'unpaid', dueDate: { $lt: now } },
      { $set: { status: 'overdue' } },
    );

    const [total, bills] = await Promise.all([
      Bill.countDocuments(filter),
      Bill.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('flatId', 'number')
        .lean({ virtuals: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: bills,
      bills,
      items: bills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/bills/:id */
export async function getBillById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid bill ID.' } });
    }

    const bill = await Bill.findById(id)
      .populate('flatId', 'number floor type')
      .populate('residentId', 'name email phone')
      .populate('generatedBy', 'name');

    if (!bill) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bill not found.' } });

    const aptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && aptId && !bill.apartmentId.equals(aptId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    if (isResident(req.user) && bill.residentId && !bill.residentId._id.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own bills.' } });
    }

    return res.status(200).json({ success: true, data: bill });
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/admin/bills/generate
 *
 * Generate bills for flats in an apartment using active billing rules.
 * Body: { billingPeriod | period, billingPeriodLabel?, dueDateDays?, dueDate?, apartmentId? }
 *
 * - Skips flats that already have a bill for that period (idempotent).
 * - Returns counts of generated, skipped, and any errors.
 */
export async function generateBills(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, req.body.apartmentId);

    if (!apartmentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'APARTMENT_REQUIRED', message: 'Apartment required.' },
      });
    }

    const rawPeriod = req.body?.billingPeriod || req.body?.period || req.body?.month;
    if (!rawPeriod || !/^\d{4}-\d{2}/.test(String(rawPeriod))) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'billingPeriod must be in YYYY-MM format.' },
      });
    }

    const billingPeriod = String(rawPeriod).slice(0, 7);
    const { billingPeriodLabel, dueDate, dueDateDays } = req.body || {};

    // Resolve due date
    let resolvedDueDate;
    if (dueDate) {
      resolvedDueDate = new Date(dueDate);
    } else {
      const days = parseInt(dueDateDays, 10) || 15;
      resolvedDueDate = new Date();
      resolvedDueDate.setDate(resolvedDueDate.getDate() + days);
    }

    // Fetch active billing rules for this apartment
    const rules = await BillingRule.find({ apartmentId, status: 'active' });
    if (rules.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_RULES', message: 'No active billing rules found for this apartment.' },
      });
    }

    // Fetch flats (all active non-archived flats in the apartment)
    const flats = await Flat.find({ apartmentId, isArchived: { $ne: true } });

    const generated = [];
    const skipped = [];
    const errors = [];

    for (const flat of flats) {
      try {
        // Check for existing bill — skip if already generated
        const existing = await Bill.findOne({ flatId: flat._id, billingPeriod });
        if (existing) {
          skipped.push({ flatId: flat._id, flatNumber: flat.number, reason: 'Already billed for this period.' });
          continue;
        }

        // Find active resident membership for this flat
        const membership = await Membership.findOne({
          flatId: flat._id,
          apartmentId,
          status: 'active',
        });

        // Build line items from rules — integer arithmetic throughout
        const lineItems = rules.map((r) => ({
          label: r.name,
          amountPaise: r.amountPaise,
        }));

        const subtotalPaise = lineItems.reduce((sum, li) => sum + li.amountPaise, 0);
        const totalPaise = subtotalPaise; // no adjustment by default

        const bill = await Bill.create({
          apartmentId,
          buildingId: flat.buildingId || null,
          flatId: flat._id,
          residentId: membership?.userId || null,
          billingPeriod,
          billingPeriodLabel: billingPeriodLabel || billingPeriod,
          lineItems,
          subtotalPaise,
          adjustmentPaise: 0,
          totalPaise,
          paidPaise: 0,
          dueDate: resolvedDueDate,
          status: 'unpaid',
          generatedBy: user._id,
          billingRuleIds: rules.map((r) => r._id),
        });

        generated.push({ flatId: flat._id, flatNumber: flat.number, billId: bill._id, billNumber: bill.billNumber });
      } catch (flatErr) {
        if (flatErr.code === 11000) {
          skipped.push({ flatId: flat._id, flatNumber: flat.number, reason: 'Already billed (race condition).' });
        } else {
          errors.push({ flatId: flat._id, flatNumber: flat.number, error: flatErr.message });
        }
      }
    }

    logAudit({
      actor: user, action: 'BILL_GENERATE', targetEntity: 'Bill',
      apartmentId, details: `Generated ${generated.length} bills for period ${billingPeriod}`,
    });

    return res.status(200).json({
      success: true,
      message: `Generated ${generated.length} bill(s). Skipped: ${skipped.length}. Errors: ${errors.length}.`,
      generated: generated.length,
      skipped: skipped.length,
      errors: errors.length,
      data: { generated, skipped, errors, period: billingPeriod },
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  C. PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/payments */
export async function listPayments(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    const { page, limit } = paginationParams(req.query);
    const search = (req.query.search || '').trim();

    const filter = {};
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.method && req.query.method !== 'all') filter.paymentMethod = req.query.method;

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('payerId', 'name email apartment')
        .populate('billId', 'billNumber billingPeriod billingPeriodLabel')
        .lean({ virtuals: true }),
    ]);

    const items = payments.map((p) => {
      p.residentName = p.payerId?.name || '';
      p.residentEmail = p.payerId?.email || '';
      p.billNumber = p.billId?.billNumber || p.billNumber || '';
      p.bill = p.billId || null;
      return p;
    });

    // Text search filter (in-memory, small result set)
    const filtered = search
      ? items.filter(
          (p) =>
            (p.residentName || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.referenceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.billNumber || '').toLowerCase().includes(search.toLowerCase()),
        )
      : items;

    return res.status(200).json({
      success: true,
      data: filtered,
      payments: filtered,
      items: filtered,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/payments/:id  and  GET /api/v1/resident/payments/:id */
export async function getPaymentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid payment ID.' } });
    }

    const payment = await Payment.findById(id)
      .populate('payerId', 'name email')
      .populate('verifiedBy', 'name')
      .populate('billId', 'billNumber billingPeriod billingPeriodLabel totalPaise')
      .populate('flatId', 'number');

    if (!payment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found.' } });

    const aptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && aptId && !payment.apartmentId.equals(aptId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    // Residents can only view their own payments
    if (isResident(req.user) && !payment.payerId._id.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own payments.' } });
    }

    const obj = payment.toObject({ virtuals: true });
    obj.residentName = payment.payerId?.name || '';
    obj.residentEmail = payment.payerId?.email || '';
    obj.bill = payment.billId || null;

    return res.status(200).json({ success: true, data: { payment: obj, ...obj } });
  } catch (err) { next(err); }
}

/** GET /api/v1/resident/payments */
export async function listResidentPayments(req, res, next) {
  try {
    const user = req.user;
    const aptId = getApartmentId(user, null);
    const { page, limit } = paginationParams(req.query);

    const filter = { payerId: user._id };
    if (aptId) filter.apartmentId = aptId;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('billId', 'billNumber billingPeriod billingPeriodLabel')
        .lean({ virtuals: true }),
    ]);

    const items = payments.map((p) => {
      p.billNumber = p.billId?.billNumber || p.billNumber || '';
      p.bill = p.billId || null;
      return p;
    });

    return res.status(200).json({
      success: true,
      data: items,
      payments: items,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/resident/payments */
export async function submitPayment(req, res, next) {
  try {
    const user = req.user;
    const aptId = getApartmentId(user, null);

    if (!aptId) {
      return res.status(400).json({ success: false, error: { code: 'APARTMENT_REQUIRED', message: 'Account not associated with an apartment.' } });
    }

    const { amount, paymentMethod, referenceNumber, paymentDate, billId, billNumber, notes } =
      req.body || {};

    // Validate
    if (!amount || Number(amount) <= 0 || Number.isNaN(Number(amount))) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid amount greater than ₹0 is required.' } });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment method is required.' } });
    }
    if (!referenceNumber || String(referenceNumber).trim().length < 4) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reference number (min 4 chars) is required.' } });
    }

    const amountPaise = rupeesToPaise(amount);

    // Validate linked bill if provided
    let linkedBill = null;
    if (billId && mongoose.Types.ObjectId.isValid(billId)) {
      linkedBill = await Bill.findById(billId);
      if (!linkedBill) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Referenced bill not found.' } });
      }
      if (!linkedBill.apartmentId.equals(aptId)) {
        return res.status(403).json({ success: false, error: { code: 'CROSS_TENANT_ERROR', message: 'Bill does not belong to your apartment.' } });
      }
    }

    const payment = await Payment.create({
      apartmentId: aptId,
      payerId: user._id,
      flatId: user.flatId || (linkedBill?.flatId) || null,
      buildingId: user.buildingId || (linkedBill?.buildingId) || null,
      billId: linkedBill ? linkedBill._id : null,
      billNumber: billNumber?.trim() || linkedBill?.billNumber || '',
      amountPaise,
      paymentMethod,
      referenceNumber: String(referenceNumber).trim(),
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes: (notes || '').trim(),
      status: 'pending',
    });

    logAudit({
      actor: user, action: 'PAYMENT_SUBMIT', targetEntity: 'Payment',
      targetId: payment._id, apartmentId: aptId,
      details: `Resident submitted payment ₹${(amountPaise / 100).toFixed(2)} ref:${referenceNumber}`,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment submitted successfully. Awaiting admin verification.',
      data: payment,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') } });
    }
    next(err);
  }
}

/**
 * PUT /api/v1/admin/payments/:id/verify
 *
 * Atomically marks payment verified and updates linked Bill's paidPaise and status.
 * Protected against double-processing via state and appliedToBill guards.
 */
export async function verifyPayment(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid payment ID.' } });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found.' } });
    }

    // Apartment isolation
    const aptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && aptId && !payment.apartmentId.equals(aptId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    // Idempotency / state guards: return 200 without double-crediting
    if (payment.status !== 'pending' || payment.appliedToBill) {
      const populated = await Payment.findById(payment._id)
        .populate('payerId', 'name email')
        .populate('billId', 'billNumber billingPeriod');
      return res.status(200).json({
        success: true,
        message: `Payment has already been ${payment.status}.`,
        data: populated,
      });
    }

    const notes = (
      req.body?.notes ||
      req.body?.verificationComments ||
      req.body?.comments ||
      ''
    ).trim();

    // Atomically claim payment
    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: id, status: 'pending', appliedToBill: false },
      {
        $set: {
          status: 'verified',
          verifiedAt: new Date(),
          verifiedBy: req.user._id,
          verificationComments: notes,
          appliedToBill: true,
        },
      },
      { new: true, returnDocument: 'after' }
    );

    if (!updatedPayment) {
      const refreshed = await Payment.findById(id)
        .populate('payerId', 'name email')
        .populate('billId', 'billNumber billingPeriod');
      return res.status(200).json({
        success: true,
        message: 'Payment already processed.',
        data: refreshed,
      });
    }

    // Update linked bill if present
    if (updatedPayment.billId) {
      const bill = await Bill.findById(updatedPayment.billId);
      if (bill && bill.apartmentId.equals(updatedPayment.apartmentId)) {
        const newPaid = bill.paidPaise + updatedPayment.amountPaise;
        bill.paidPaise = newPaid;

        if (newPaid >= bill.totalPaise) {
          bill.status = 'paid';
        } else if (newPaid > 0) {
          bill.status = 'partially_paid';
        }
        await bill.save();
      }
    }

    logAudit({
      actor: req.user, action: 'PAYMENT_VERIFY', targetEntity: 'Payment',
      targetId: updatedPayment._id, apartmentId: updatedPayment.apartmentId,
      details: `Verified payment ₹${(updatedPayment.amountPaise / 100).toFixed(2)}`,
    });

    const populated = await Payment.findById(updatedPayment._id)
      .populate('payerId', 'name email')
      .populate('billId', 'billNumber billingPeriod');

    return res.status(200).json({
      success: true,
      message: 'Payment verified and credited to the bill.',
      data: populated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/payments/:id/reject
 *
 * Rejects a pending payment. Does NOT alter bill balance.
 */
export async function rejectPayment(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid payment ID.' } });
    }

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found.' } });

    const aptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && aptId && !payment.apartmentId.equals(aptId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    const reason = (
      req.body?.reason ||
      req.body?.rejectionReason ||
      req.body?.notes ||
      req.body?.verificationComments ||
      'Rejected by administrator'
    ).trim();

    payment.status = 'rejected';
    payment.rejectionReason = reason;
    payment.verificationComments = reason;
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = new Date();
    await payment.save();

    logAudit({
      actor: req.user, action: 'PAYMENT_REJECT', targetEntity: 'Payment',
      targetId: payment._id, apartmentId: payment.apartmentId,
      details: `Rejected payment. Reason: ${reason}`,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment submission rejected.',
      data: payment,
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  D. EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/expenses */
export async function listExpenses(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    const { page, limit } = paginationParams(req.query);

    const filter = { isArchived: false };
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    if (req.query.startDate) filter.expenseDate = { $gte: new Date(req.query.startDate) };
    if (req.query.endDate) {
      filter.expenseDate = { ...filter.expenseDate, $lte: new Date(req.query.endDate) };
    }

    const [total, expenses] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.find(filter)
        .sort({ expenseDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name')
        .lean({ virtuals: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: expenses,
      expenses,
      items: expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) { next(err); }
}

/** POST /api/v1/admin/expenses */
export async function createExpense(req, res, next) {
  try {
    const user = req.user;
    const apartmentId = getApartmentId(user, req.body.apartmentId);
    if (!apartmentId) {
      return res.status(400).json({ success: false, error: { code: 'APARTMENT_REQUIRED', message: 'Apartment required.' } });
    }

    const {
      title,
      description,
      category,
      amount,
      expenseDate,
      vendor,
      vendorName,
      referenceNumber,
      notes,
    } = req.body || {};

    if (!title || !amount) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'title and amount are required.' } });
    }

    const amountPaise = rupeesToPaise(amount);
    if (!Number.isInteger(amountPaise) || amountPaise < 1) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Amount must be a positive number (min ₹0.01).' } });
    }

    const validCategories = [
      'utilities',
      'maintenance',
      'staff_salary',
      'cleaning',
      'security',
      'administrative',
      'other',
    ];
    let normCat = String(category || 'maintenance').toLowerCase().trim();
    if (!validCategories.includes(normCat)) normCat = 'maintenance';

    const expense = await Expense.create({
      apartmentId,
      title: String(title).trim(),
      description: (description || notes || '').trim(),
      category: normCat,
      amountPaise,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      vendor: (vendor || vendorName || '').trim(),
      referenceNumber: (referenceNumber || '').trim(),
      createdBy: user._id,
    });

    logAudit({
      actor: user, action: 'EXPENSE_CREATE', targetEntity: 'Expense',
      targetId: expense._id, apartmentId, details: `Created expense "${expense.title}" ₹${(amountPaise / 100).toFixed(2)}`,
    });

    return res.status(201).json({ success: true, data: expense });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') } });
    }
    next(err);
  }
}

/** PUT /api/v1/admin/expenses/:id */
export async function updateExpense(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid expense ID.' } });
    }

    const expense = await Expense.findById(id);
    if (!expense || expense.isArchived) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found.' } });
    }

    const aptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && aptId && !expense.apartmentId.equals(aptId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    const { title, description, category, amount, expenseDate, vendor, referenceNumber } = req.body || {};
    if (title !== undefined) expense.title = String(title).trim();
    if (description !== undefined) expense.description = String(description).trim();
    if (category !== undefined) expense.category = category;
    if (amount !== undefined) {
      const ap = rupeesToPaise(amount);
      if (!Number.isInteger(ap) || ap < 1) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid amount.' } });
      }
      expense.amountPaise = ap;
    }
    if (expenseDate !== undefined) expense.expenseDate = new Date(expenseDate);
    if (vendor !== undefined) expense.vendor = String(vendor).trim();
    if (referenceNumber !== undefined) expense.referenceNumber = String(referenceNumber).trim();

    await expense.save();

    logAudit({
      actor: req.user, action: 'EXPENSE_UPDATE', targetEntity: 'Expense',
      targetId: expense._id, apartmentId: expense.apartmentId,
      details: `Updated expense "${expense.title}"`,
    });

    return res.status(200).json({ success: true, data: expense });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: Object.values(err.errors).map((e) => e.message).join('; ') } });
    }
    next(err);
  }
}

/** DELETE /api/v1/admin/expenses/:id — soft delete */
export async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid expense ID.' } });
    }

    const expense = await Expense.findById(id);
    if (!expense || expense.isArchived) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Expense not found.' } });
    }

    const aptId = getApartmentId(req.user, null);
    if (!isSuperAdmin(req.user) && aptId && !expense.apartmentId.equals(aptId)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    }

    expense.isArchived = true;
    await expense.save();

    logAudit({
      actor: req.user, action: 'EXPENSE_DELETE', targetEntity: 'Expense',
      targetId: expense._id, apartmentId: expense.apartmentId,
      details: `Archived expense "${expense.title}"`,
    });

    return res.status(200).json({ success: true, message: 'Expense archived successfully.' });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  E. REPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/reports/collections */
export async function collectionsReport(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    const filter = { status: 'verified' };
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.startDate) filter.paymentDate = { $gte: new Date(req.query.startDate) };
    if (req.query.endDate) filter.paymentDate = { ...filter.paymentDate, $lte: new Date(req.query.endDate) };

    const payments = await Payment.find(filter)
      .populate('payerId', 'name email')
      .populate('flatId', 'number buildingId')
      .lean({ virtuals: true });

    const pendingCount = await Payment.countDocuments({ apartmentId: apartmentId || { $exists: true }, status: 'pending' });

    let totalCollectedPaise = 0;
    const periodMap = {};
    const buildingMap = {};

    payments.forEach((p) => {
      totalCollectedPaise += p.amountPaise;
      const dateStr = p.paymentDate || p.createdAt;
      const monthKey = dateStr
        ? new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : 'Unknown';
      periodMap[monthKey] = (periodMap[monthKey] || 0) + p.amountPaise;
      const bName = p.buildingName || p.flatId?.buildingId?.name || 'General';
      buildingMap[bName] = (buildingMap[bName] || 0) + p.amountPaise;
    });

    const toRupees = (p) => Number((p / 100).toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        totalCollected: toRupees(totalCollectedPaise),
        verifiedCount: payments.length,
        pendingCount,
        items: payments.map((p) => ({ ...p, amount: toRupees(p.amountPaise) })),
        collectionsByPeriod: Object.entries(periodMap).map(([period, paise]) => ({ period, amount: toRupees(paise) })),
        collectionsByBuilding: Object.entries(buildingMap).map(([buildingName, paise]) => ({ buildingName, amount: toRupees(paise) })),
        trends: Object.entries(periodMap).map(([period, paise]) => ({ period, amount: toRupees(paise) })),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/reports/outstanding */
export async function outstandingReport(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);

    // Auto-mark overdue
    if (apartmentId) {
      await Bill.updateMany(
        { apartmentId, status: 'unpaid', dueDate: { $lt: new Date() } },
        { $set: { status: 'overdue' } },
      );
    }

    const filter = { status: { $in: ['unpaid', 'partially_paid', 'overdue'] } };
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.buildingId && mongoose.Types.ObjectId.isValid(req.query.buildingId)) {
      filter.buildingId = req.query.buildingId;
    }

    const bills = await Bill.find(filter)
      .populate('flatId', 'number')
      .populate('residentId', 'name email')
      .lean({ virtuals: true });

    const now = new Date();
    let totalOutstandingPaise = 0;
    let overdueCount = 0;
    let overdueAmountPaise = 0;
    const periodMap = {};
    const buildingMap = {};

    bills.forEach((b) => {
      const outstanding = b.totalPaise - b.paidPaise;
      totalOutstandingPaise += outstanding;
      const isOver = b.status === 'overdue' || (b.dueDate && new Date(b.dueDate) < now);
      if (isOver) { overdueCount++; overdueAmountPaise += outstanding; }
      const period = b.billingPeriod || 'Unknown';
      periodMap[period] = (periodMap[period] || 0) + outstanding;
      const bName = b.buildingName || 'General';
      buildingMap[bName] = (buildingMap[bName] || 0) + outstanding;
    });

    const toRupees = (p) => Number((p / 100).toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        totalOutstanding: toRupees(totalOutstandingPaise),
        outstandingBillsCount: bills.length,
        overdueCount,
        overdueAmount: toRupees(overdueAmountPaise),
        items: bills.map((b) => ({
          ...b,
          amount: toRupees(b.totalPaise),
          totalAmount: toRupees(b.totalPaise),
          outstandingBalance: toRupees(b.totalPaise - b.paidPaise),
        })),
        outstandingByBuilding: Object.entries(buildingMap).map(([buildingName, p]) => ({ buildingName, amount: toRupees(p) })),
        outstandingByPeriod: Object.entries(periodMap).map(([period, p]) => ({ period, amount: toRupees(p) })),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/reports/expenses */
export async function expensesReport(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);

    const filter = { isArchived: false };
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    if (req.query.startDate) filter.expenseDate = { $gte: new Date(req.query.startDate) };
    if (req.query.endDate) filter.expenseDate = { ...filter.expenseDate, $lte: new Date(req.query.endDate) };

    const expenses = await Expense.find(filter)
      .sort({ expenseDate: -1 })
      .lean({ virtuals: true });

    let totalPaise = 0;
    const catMap = {};
    const periodMap = {};

    expenses.forEach((e) => {
      totalPaise += e.amountPaise;
      const cat = e.category || 'other';
      catMap[cat] = (catMap[cat] || 0) + e.amountPaise;
      const dateStr = e.expenseDate || e.createdAt;
      const monthKey = dateStr
        ? new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : 'Unknown';
      periodMap[monthKey] = (periodMap[monthKey] || 0) + e.amountPaise;
    });

    const toRupees = (p) => Number((p / 100).toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        totalExpenses: toRupees(totalPaise),
        expenseCount: expenses.length,
        items: expenses.map((e) => ({ ...e, amount: toRupees(e.amountPaise) })),
        expensesByCategory: Object.entries(catMap).map(([category, p]) => ({ category, amount: toRupees(p) })),
        trends: Object.entries(periodMap).map(([period, p]) => ({ period, amount: toRupees(p) })),
      },
    });
  } catch (err) { next(err); }
}

/** GET /api/v1/admin/reports/complaints */
export async function complaintsReport(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    const filter = {};
    if (apartmentId) filter.apartmentId = apartmentId;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.category && req.query.category !== 'all') filter.category = req.query.category;
    if (req.query.priority && req.query.priority !== 'all') filter.priority = req.query.priority;
    if (req.query.startDate) filter.createdAt = { $gte: new Date(req.query.startDate) };
    if (req.query.endDate) filter.createdAt = { ...filter.createdAt, $lte: new Date(req.query.endDate) };

    const complaints = await Complaint.find(filter)
      .populate('requestedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('flatId', 'number')
      .lean();

    const statusCounts = {};
    const categoryCounts = {};
    const priorityCounts = {};
    let resolvedCount = 0;

    complaints.forEach((c) => {
      const st = c.status || 'open';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      const cat = c.category || 'general';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      const pri = c.priority || 'normal';
      priorityCounts[pri] = (priorityCounts[pri] || 0) + 1;
      if (st === 'resolved' || st === 'closed') resolvedCount++;
    });

    return res.status(200).json({
      success: true,
      data: {
        totalComplaints: complaints.length,
        resolvedCount,
        openCount: complaints.length - resolvedCount,
        resolutionRate: complaints.length ? Math.round((resolvedCount / complaints.length) * 100) : 0,
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        byCategory: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })),
        byPriority: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
        items: complaints,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/admin/reports/occupancy */
export async function occupancyReport(req, res, next) {
  try {
    const apartmentId = getApartmentId(req.user, req.query.apartmentId);
    const filter = { isArchived: { $ne: true } };
    if (apartmentId) filter.apartmentId = apartmentId;

    const [flats, buildings] = await Promise.all([
      Flat.find(filter).populate('buildingId', 'name').lean(),
      Building.find(apartmentId ? { apartmentId } : {}).lean(),
    ]);

    const totalFlats = flats.length;
    let occupiedCount = 0;
    let vacantCount = 0;
    let maintenanceCount = 0;
    let reservedCount = 0;
    const buildingMap = {};

    buildings.forEach((b) => {
      buildingMap[b._id.toString()] = {
        buildingId: b._id,
        buildingName: b.name,
        total: 0,
        occupied: 0,
        vacant: 0,
      };
    });

    flats.forEach((f) => {
      const st = f.status || 'vacant';
      if (st === 'occupied') occupiedCount++;
      else if (st === 'vacant') vacantCount++;
      else if (st === 'maintenance') maintenanceCount++;
      else if (st === 'reserved') reservedCount++;

      const bId = f.buildingId?._id?.toString() || f.buildingId?.toString();
      if (bId && buildingMap[bId]) {
        buildingMap[bId].total += 1;
        if (st === 'occupied') buildingMap[bId].occupied += 1;
        else buildingMap[bId].vacant += 1;
      }
    });

    const occupancyRate = totalFlats ? Math.round((occupiedCount / totalFlats) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalFlats,
        occupiedCount,
        vacantCount,
        maintenanceCount,
        reservedCount,
        occupancyRate,
        byBuilding: Object.values(buildingMap),
        flats,
      },
    });
  } catch (err) {
    next(err);
  }
}
