/**
 * billing.routes.js
 *
 * All billing and finance routes.
 * Mounted paths match what the frontend expects exactly:
 *
 *   /api/v1/admin/billing-rules   — CRUD for billing rules
 *   /api/v1/admin/bills           — Bill list, detail, generate
 *   /api/v1/resident/bills        — Resident's own bills
 *   /api/v1/admin/payments        — Admin payment list/detail/verify/reject
 *   /api/v1/resident/payments     — Resident submit + list own
 *   /api/v1/admin/expenses        — Expense CRUD
 *   /api/v1/admin/reports/*       — Financial reports
 */

import { Router } from 'express';
import { authenticate, requireAdmin, requireResident, requireRole } from '../middleware/auth.middleware.js';
import {
  // Billing Rules
  listBillingRules,
  createBillingRule,
  updateBillingRule,
  // Bills
  listBills,
  listResidentBills,
  getBillById,
  generateBills,
  // Payments
  listPayments,
  getPaymentById,
  submitPayment,
  listResidentPayments,
  verifyPayment,
  rejectPayment,
  // Expenses
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  // Reports
  collectionsReport,
  outstandingReport,
  expensesReport,
  complaintsReport,
  occupancyReport,
} from '../controllers/billing.controller.js';

// ── Admin: Billing Rules ──────────────────────────────────────────────────────
export const billingRulesRouter = Router();
billingRulesRouter.use(authenticate, requireAdmin);
billingRulesRouter.get('/', listBillingRules);
billingRulesRouter.post('/', createBillingRule);
billingRulesRouter.put('/:id', updateBillingRule);

// ── Admin: Bills ──────────────────────────────────────────────────────────────
export const adminBillsRouter = Router();
adminBillsRouter.use(authenticate, requireAdmin);
adminBillsRouter.get('/', listBills);
adminBillsRouter.post('/generate', generateBills);
adminBillsRouter.get('/:id', getBillById);

// ── Resident: Bills ───────────────────────────────────────────────────────────
export const residentBillsRouter = Router();
residentBillsRouter.use(authenticate, requireResident);
residentBillsRouter.get('/', listResidentBills);
residentBillsRouter.get('/:id', getBillById);

// ── Admin: Payments ───────────────────────────────────────────────────────────
export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(authenticate, requireAdmin);
adminPaymentsRouter.get('/', listPayments);
adminPaymentsRouter.get('/:id', getPaymentById);
adminPaymentsRouter.put('/:id/verify', verifyPayment);
adminPaymentsRouter.patch('/:id/status', async (req, res, next) => {
  // Fallback used by frontend: route to verify or reject based on status field
  if (req.body?.status === 'verified') return verifyPayment(req, res, next);
  if (req.body?.status === 'rejected') return rejectPayment(req, res, next);
  next();
});
adminPaymentsRouter.patch('/:id', async (req, res, next) => {
  if (req.body?.status === 'verified') return verifyPayment(req, res, next);
  if (req.body?.status === 'rejected') return rejectPayment(req, res, next);
  next();
});
adminPaymentsRouter.put('/:id/reject', rejectPayment);

// ── Resident: Payments ────────────────────────────────────────────────────────
export const residentPaymentsRouter = Router();
residentPaymentsRouter.use(authenticate, requireResident);
residentPaymentsRouter.get('/', listResidentPayments);
residentPaymentsRouter.post('/', submitPayment);
residentPaymentsRouter.get('/:id', getPaymentById);

// ── Admin: Expenses ───────────────────────────────────────────────────────────
export const adminExpensesRouter = Router();
adminExpensesRouter.use(authenticate, requireAdmin);
adminExpensesRouter.get('/', listExpenses);
adminExpensesRouter.post('/', createExpense);
adminExpensesRouter.put('/:id', updateExpense);
adminExpensesRouter.delete('/:id', deleteExpense);

// ── Admin: Reports ────────────────────────────────────────────────────────────
export const adminReportsRouter = Router();
adminReportsRouter.use(authenticate, requireAdmin);
adminReportsRouter.get('/collections', collectionsReport);
adminReportsRouter.get('/outstanding', outstandingReport);
adminReportsRouter.get('/expenses', expensesReport);
adminReportsRouter.get('/complaints', complaintsReport);
adminReportsRouter.get('/maintenance', complaintsReport);
adminReportsRouter.get('/occupancy', occupancyReport);

export default billingRulesRouter;
