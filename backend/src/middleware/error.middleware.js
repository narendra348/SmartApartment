/**
 * error.middleware.js
 *
 * Centralized Express error handler.
 * Formats errors into consistent JSON responses without leaking internal stack traces.
 */
export function errorHandler(err, req, res, _next) {
  if (err && process.env.NODE_ENV !== 'test') {
    console.error(`[API Error] ${req.method} ${req.originalUrl || req.url}:`, err.message || err);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 600
    ? err.status
    : 500;

  // Never leak internal stack traces to clients
  const message = status === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'An unexpected server error occurred';

  res.status(status).json({
    success: false,
    error: {
      code: err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
      message,
    },
  });
}
