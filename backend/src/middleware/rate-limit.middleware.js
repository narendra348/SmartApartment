/**
 * rate-limit.middleware.js
 *
 * Lightweight in-memory rate limiting middleware.
 * Protects public authentication endpoints from brute-force attempts.
 * Tracks requests per IP address with sliding time windows.
 */

export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 20, // max 20 requests per window
  message = 'Too many requests from this IP address. Please try again after 15 minutes.',
  code = 'RATE_LIMIT_EXCEEDED',
} = {}) {
  const hits = new Map();

  // Periodic cleanup of expired IP tracking entries every 5 minutes
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now - record.startTime > windowMs) {
        hits.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  if (timer.unref) {
    timer.unref(); // Ensure timer does not prevent process exit
  }

  return (req, res, next) => {
    // Bypass in test environment unless explicitly testing rate limits
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const now = Date.now();
    let record = hits.get(ip);

    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetTimeSeconds = Math.ceil((record.startTime + windowMs - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetTimeSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return res.status(429).json({
        success: false,
        error: {
          code,
          message,
        },
      });
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 minutes
});

export default {
  createRateLimiter,
  authRateLimiter,
};
