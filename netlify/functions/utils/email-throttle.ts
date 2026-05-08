import { Redis } from "@upstash/redis";

const TTL_SECONDS = 86400; // 24h

const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;
const isConfigured =
  !!redisUrl &&
  !!redisToken &&
  !redisUrl.includes("placeholder") &&
  !redisToken.includes("placeholder");

const redis = isConfigured
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

if (!redis) {
  console.warn(
    "[email-throttle] Upstash not configured — emails will be skipped"
  );
}

/**
 * Atomic per-user, per-email-type throttle. Returns true the first time
 * called within the TTL window, false on subsequent calls.
 *
 * Misconfiguration (missing/placeholder env vars): returns false (fail-CLOSED)
 * so we don't flood users with duplicate emails. Operator must fix Upstash
 * config.
 *
 * Transient Redis error: also returns false (fail-CLOSED). The 24h TTL means
 * users get one email per crisis at worst, never zero — re-attempts in
 * subsequent scheduled-scan runs will succeed once Redis recovers.
 *
 * Implementation: SET key value NX EX 86400 — Upstash returns "OK" only
 * if the key did not exist; null otherwise.
 */
export async function shouldSendEmail(
  userId: string,
  emailType: string
): Promise<boolean> {
  if (!redis) return false;

  const key = `email_throttle:${userId}:${emailType}`;
  try {
    const result = await redis.set(key, "1", { nx: true, ex: TTL_SECONDS });
    return result === "OK";
  } catch (err) {
    console.error("[email-throttle] redis error", err);
    return false; // fail closed — don't flood
  }
}
