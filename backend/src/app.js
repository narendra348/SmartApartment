import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import superAdminRoutes from './routes/super-admin.routes.js';
import buildingRoutes from './routes/building.routes.js';
import flatRoutes from './routes/flat.routes.js';
import residentRoutes from './routes/resident.routes.js';
import {
  adminComplaintRouter,
  residentComplaintRouter,
} from './routes/complaint.routes.js';
import workOrderRoutes from './routes/work-order.routes.js';
import {
  billingRulesRouter,
  adminBillsRouter,
  residentBillsRouter,
  adminPaymentsRouter,
  residentPaymentsRouter,
  adminExpensesRouter,
  adminReportsRouter,
} from './routes/billing.routes.js';
import {
  adminAnnouncementsRouter,
  residentAnnouncementsRouter,
  staffAnnouncementsRouter,
  publicAnnouncementsRouter,
} from './routes/announcement.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { authenticate } from './middleware/auth.middleware.js';
import { getCurrentUser, updateProfile } from './controllers/auth.controller.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// ── Profile Router for role-specific profile endpoints ───────────────────────
const profileRouter = express.Router();
profileRouter.use(authenticate);
profileRouter.get('/', getCurrentUser);
profileRouter.put('/', updateProfile);
profileRouter.patch('/', updateProfile);

// ── CORS Configuration ────────────────────────────────────────────────────────
// Strictly allow credentialed requests from the configured frontend origin(s)
const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const configuredOrigins = rawClientUrl
  .split(',')
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const defaultAllowedOrigins = [
  'https://smart-apartment-indol.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultAllowedOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (e.g. server-to-server, curl, health checks)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      const isAllowed =
        allowedOrigins.includes(normalizedOrigin) ||
        /^https:\/\/smart-apartment[a-z0-9-]*\.vercel\.app$/.test(normalizedOrigin);

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept'],
  }),
);

// ── Body & Cookie Parsers ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── API Routes (Prefix: /api/v1) ─────────────────────────────────────────────
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);
app.use('/api/v1/admin/buildings', buildingRoutes);
app.use('/api/v1/admin/flats', flatRoutes);
app.use('/api/v1/admin/residents', residentRoutes);
// Maintenance requests / complaints — matching frontend API paths exactly
app.use('/api/v1/admin/complaints', adminComplaintRouter);
app.use('/api/v1/resident/complaints', residentComplaintRouter);
// Work orders
app.use('/api/v1/admin/work-orders', workOrderRoutes);
// Billing rules
app.use('/api/v1/admin/billing-rules', billingRulesRouter);
// Bills
app.use('/api/v1/admin/bills', adminBillsRouter);
app.use('/api/v1/resident/bills', residentBillsRouter);
// Payments
app.use('/api/v1/admin/payments', adminPaymentsRouter);
app.use('/api/v1/resident/payments', residentPaymentsRouter);
// Expenses
app.use('/api/v1/admin/expenses', adminExpensesRouter);
// Financial reports
app.use('/api/v1/admin/reports', adminReportsRouter);
// Announcements
app.use('/api/v1/admin/announcements', adminAnnouncementsRouter);
app.use('/api/v1/resident/announcements', residentAnnouncementsRouter);
app.use('/api/v1/staff/announcements', staffAnnouncementsRouter);
app.use('/api/v1/announcements', publicAnnouncementsRouter);

// Role profile routes
app.use('/api/v1/admin/profile', profileRouter);
app.use('/api/v1/resident/profile', profileRouter);
app.use('/api/v1/staff/profile', profileRouter);

// Notifications
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/user/notifications', notificationRoutes);

// ── 404 & Centralized Error Handling ─────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
