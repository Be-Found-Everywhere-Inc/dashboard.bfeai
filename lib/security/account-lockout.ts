/**
 * Account Lockout Protection
 * Prevents brute force attacks by locking accounts after failed login attempts
 */

interface FailedAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

// In-memory store for failed attempts (use Redis in production)
const failedAttempts = new Map<string, FailedAttempt>();

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if an account is locked
 */
export function isAccountLocked(identifier: string): boolean {
  const attempt = failedAttempts.get(identifier);

  if (!attempt || !attempt.lockedUntil) {
    return false;
  }

  // Check if lockout period has expired
  if (Date.now() > attempt.lockedUntil) {
    // Reset after lockout expires
    failedAttempts.delete(identifier);
    return false;
  }

  return true;
}

/**
 * Get time remaining until account unlock (in seconds)
 */
export function getLockoutTimeRemaining(identifier: string): number {
  const attempt = failedAttempts.get(identifier);

  if (!attempt || !attempt.lockedUntil) {
    return 0;
  }

  const remaining = Math.max(0, attempt.lockedUntil - Date.now());
  return Math.ceil(remaining / 1000);
}

/**
 * Record a failed login attempt
 * Returns whether the account is now locked
 */
export function recordFailedAttempt(identifier: string): {
  isLocked: boolean;
  attemptsRemaining: number;
  lockoutTimeRemaining?: number;
} {
  const now = Date.now();
  const existing = failedAttempts.get(identifier);

  // Reset if outside the attempt window
  if (existing && now - existing.lastAttempt > ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(identifier);
  }

  const current = failedAttempts.get(identifier) || {
    count: 0,
    lastAttempt: now,
  };

  current.count += 1;
  current.lastAttempt = now;

  // Lock account if max attempts exceeded
  if (current.count >= MAX_FAILED_ATTEMPTS) {
    current.lockedUntil = now + LOCKOUT_DURATION_MS;
    failedAttempts.set(identifier, current);

    return {
      isLocked: true,
      attemptsRemaining: 0,
      lockoutTimeRemaining: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  failedAttempts.set(identifier, current);

  return {
    isLocked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - current.count,
  };
}

/**
 * Clear failed attempts for an identifier (on successful login)
 */
export function clearFailedAttempts(identifier: string): void {
  failedAttempts.delete(identifier);
}

/**
 * Get failed attempt count for an identifier
 */
export function getFailedAttemptCount(identifier: string): number {
  const attempt = failedAttempts.get(identifier);
  return attempt?.count || 0;
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();

  for (const [key, attempt] of failedAttempts.entries()) {
    // Remove if lockout has expired
    if (attempt.lockedUntil && now > attempt.lockedUntil) {
      failedAttempts.delete(key);
      continue;
    }

    // Remove if last attempt was too long ago
    if (now - attempt.lastAttempt > ATTEMPT_WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
