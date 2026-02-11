/**
 * In-memory sliding-window rate limiter.
 * Keys by IP address. Fine for single-instance deployments (Vercel);
 * swap for Upstash/Redis if horizontal scaling is needed.
 */

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the client can retry (only set when blocked) */
  retryAfter?: number;
}

const CLEANUP_INTERVAL_MS = 60_000; // purge expired entries every minute

export function createRateLimiter(config: RateLimitConfig) {
  const { limit, windowMs } = config;
  const windows = new Map<string, number[]>();

  // Periodic cleanup to prevent memory leaks from stale IPs
  const cleanup = setInterval(() => {
    const now = Date.now();
    const cutoff = now - windowMs;
    for (const [key, timestamps] of windows) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        windows.delete(key);
      } else {
        windows.set(key, valid);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow GC if the module is unloaded
  if (typeof cleanup === 'object' && 'unref' in cleanup) {
    cleanup.unref();
  }

  return {
    check(request: Request): RateLimitResult {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'anonymous';

      const now = Date.now();
      const cutoff = now - windowMs;

      let timestamps = windows.get(ip) || [];
      timestamps = timestamps.filter((t) => t > cutoff);

      if (timestamps.length >= limit) {
        const oldestInWindow = timestamps[0];
        const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
        windows.set(ip, timestamps);
        return { allowed: false, retryAfter };
      }

      timestamps.push(now);
      windows.set(ip, timestamps);
      return { allowed: true };
    },
  };
}
