import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL ?? "",
  token: process.env.UPSTASH_REDIS_TOKEN ?? "",
});

const TTL_SECONDS = 86400; // 24h

/**
 * Atomic per-user, per-email-type throttle. Returns true the first time
 * called within the TTL window, false on subsequent calls. Fails open
 * (returns true) when Redis is unreachable so users still get notified
 * during partial outages.
 *
 * Implementation: SET key value NX EX 86400 — Upstash returns "OK" only
 * if the key did not exist; null otherwise.
 */
export async function shouldSendEmail(
  userId: string,
  emailType: string
): Promise<boolean> {
  const key = `email_throttle:${userId}:${emailType}`;
  try {
    const result = await redis.set(key, "1", { nx: true, ex: TTL_SECONDS });
    return result === "OK";
  } catch (err) {
    console.error("[email-throttle] redis error", err);
    return true; // fail open
  }
}
