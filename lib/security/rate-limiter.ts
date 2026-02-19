// Rate limiting for brute force protection

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client (only if credentials are configured)
let redis: Redis | null = null;

// Check if Upstash is properly configured (not placeholder values)
const isUpstashConfigured =
  process.env.UPSTASH_REDIS_URL &&
  process.env.UPSTASH_REDIS_TOKEN &&
  process.env.UPSTASH_REDIS_URL.startsWith('https://') &&
  !process.env.UPSTASH_REDIS_URL.includes('your_upstash');

if (isUpstashConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
  });
  console.log('✅ Rate limiting enabled with Upstash Redis');
} else {
  console.warn('⚠️  Rate limiting disabled: Upstash Redis not configured');
  console.warn('   Set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN to enable');
}

// Rate limiters for different endpoints
export const rateLimiters = {
  // Login: 5 attempts per 15 minutes per IP
  login: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        analytics: true,
        prefix: "ratelimit:login",
      })
    : null,

  // Signup: 3 attempts per hour per IP
  signup: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        analytics: true,
        prefix: "ratelimit:signup",
      })
    : null,

  // Password reset: 10 attempts per hour per IP
  passwordReset: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        analytics: true,
        prefix: "ratelimit:password-reset",
      })
    : null,

  // API: 100 requests per minute per IP
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "ratelimit:api",
      })
    : null,

  // Data export: 1 per hour per user ID
  dataExport: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, "1 h"),
        analytics: true,
        prefix: "ratelimit:data-export",
      })
    : null,
};

/**
 * Check rate limit for a specific identifier (usually IP address)
 * Returns { success: boolean, remaining: number, reset: Date }
 */
export async function checkRateLimit(
  limiterType: keyof typeof rateLimiters,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: Date }> {
  const limiter = rateLimiters[limiterType];

  // If rate limiter not configured, allow all requests
  if (!limiter) {
    console.warn(
      `[RateLimit] ${limiterType} rate limiter not configured. Allowing request.`
    );
    return { success: true, remaining: 999, reset: new Date() };
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    return {
      success,
      remaining,
      reset: new Date(reset),
    };
  } catch (error) {
    console.error("[RateLimit] Error checking rate limit:", error);
    // On error, allow the request (fail open)
    return { success: true, remaining: 0, reset: new Date() };
  }
}

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string {
  // Check various headers for IP (Netlify, Vercel, Cloudflare, etc.)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfIp = req.headers.get("cf-connecting-ip");

  if (cfIp) return cfIp;
  if (realIp) return realIp;
  if (forwarded) return forwarded.split(",")[0].trim();

  return "unknown";
}
