/**
 * not-found.middleware.js
 *
 * 404 handler for routes that do not match any defined endpoints.
 * Returns consistent JSON response.
 */
export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}
