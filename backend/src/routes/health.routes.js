import { Router } from 'express';
import { isDbConnected, getDbState } from '../config/database.js';

const router = Router();

/**
 * GET /api/v1/health
 *
 * Public health check endpoint indicating that the Express server is operational.
 * Accurately reports database connection status without leaking credentials.
 */
router.get('/', (_req, res) => {
  const dbConnected = isDbConnected();

  res.status(200).json({
    status: 'ok',
    message: 'SmartApartment Express server is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      connected: dbConnected,
      state: getDbState(),
    },
  });
});

export default router;
