// reCAPTCHA verification for bot protection

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number; // For v3
  action?: string; // For v3
  "error-codes"?: string[];
}

/**
 * Verify a reCAPTCHA token with Google's API
 * Works with both reCAPTCHA v2 and v3
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string // For v3 action verification
): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  // If reCAPTCHA is not configured, allow request (graceful degradation)
  if (!secretKey || secretKey.includes("your_recaptcha")) {
    console.warn("[reCAPTCHA] Not configured, skipping verification");
    return { success: true, score: 1.0 };
  }

  if (!token) {
    return { success: false, error: "reCAPTCHA token is required" };
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      console.error("[reCAPTCHA] API request failed:", response.status);
      return { success: false, error: "reCAPTCHA verification failed" };
    }

    const data: RecaptchaVerifyResponse = await response.json();

    if (!data.success) {
      const errorCodes = data["error-codes"]?.join(", ") || "unknown error";
      console.warn("[reCAPTCHA] Verification failed:", errorCodes);
      return { success: false, error: `reCAPTCHA failed: ${errorCodes}` };
    }

    // For v3, check the score (0.0 = bot, 1.0 = human)
    // Recommended threshold is 0.5
    if (data.score !== undefined) {
      const threshold = 0.5;
      if (data.score < threshold) {
        console.warn(`[reCAPTCHA] Low score: ${data.score}`);
        return {
          success: false,
          score: data.score,
          error: "reCAPTCHA score too low",
        };
      }

      // Optionally verify the action matches (v3 only)
      if (expectedAction && data.action !== expectedAction) {
        console.warn(
          `[reCAPTCHA] Action mismatch: expected ${expectedAction}, got ${data.action}`
        );
        return { success: false, error: "reCAPTCHA action mismatch" };
      }

      return { success: true, score: data.score };
    }

    // v2 verification successful
    return { success: true };
  } catch (error) {
    console.error("[reCAPTCHA] Verification error:", error);
    // On error, fail open to prevent blocking legitimate users
    // In high-security scenarios, you might want to fail closed instead
    return { success: true, error: "reCAPTCHA verification error (allowed)" };
  }
}

/**
 * Check if reCAPTCHA is configured and enabled
 */
export function isRecaptchaEnabled(): boolean {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  return !!(
    secretKey &&
    siteKey &&
    !secretKey.includes("your_recaptcha") &&
    !siteKey.includes("your_recaptcha")
  );
}

/**
 * Get the public site key for client-side use
 */
export function getRecaptchaSiteKey(): string | null {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || siteKey.includes("your_recaptcha")) {
    return null;
  }
  return siteKey;
}
