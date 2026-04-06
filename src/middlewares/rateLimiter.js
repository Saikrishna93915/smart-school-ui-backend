/**
 * RATE LIMITING MIDDLEWARE
 * Protects settings endpoints from abuse
 */

import { RateLimitError } from '../utils/ApiError.js';

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

/**
 * Clean up expired entries every 60 seconds
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Create a rate limiter middleware
 * @param {Object} options - Configuration options
 * @param {number} options.requests - Number of requests allowed
 * @param {number} options.perMinutes - Time window in minutes
 * @param {string} options.message - Custom error message
 */
export const createRateLimiter = (options = {}) => {
  const {
    requests = 100,
    perMinutes = 1,
    message = 'Too many requests, please try again later'
  } = options;

  const windowMs = perMinutes * 60 * 1000; // Convert minutes to milliseconds

  return (req, res, next) => {
    // Create a unique key for this user/IP
    const identifier = req.user?.id || req.ip || 'anonymous';
    const key = `${identifier}-${req.baseUrl}${req.path}`;
    
    const now = Date.now();
    const rateLimit = rateLimitStore.get(key);

    // If no existing rate limit data or window has expired
    if (!rateLimit || now > rateLimit.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', requests);
      res.setHeader('X-RateLimit-Remaining', requests - 1);
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      return next();
    }

    // Increment request count
    rateLimit.count += 1;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', requests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, requests - rateLimit.count));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString());

    // Check if limit exceeded
    if (rateLimit.count > requests) {
      const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      throw new RateLimitError(message, retryAfter);
    }

    next();
  };
};

/**
 * Standard rate limiter for most endpoints
 */
export const standardRateLimiter = createRateLimiter({
  requests: 100,
  perMinutes: 1,
  message: 'Too many requests from this user, please try again after a minute'
});

/**
 * Strict rate limiter for sensitive settings updates
 */
export const strictRateLimiter = createRateLimiter({
  requests: 20,
  perMinutes: 1,
  message: 'Too many settings update requests, please try again after a minute'
});

/**
 * Upload rate limiter for file uploads
 */
export const uploadRateLimiter = createRateLimiter({
  requests: 5,
  perMinutes: 1,
  message: 'Too many file upload requests, please try again after a minute'
});
