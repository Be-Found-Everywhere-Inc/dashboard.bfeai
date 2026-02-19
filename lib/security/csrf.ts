// CSRF (Cross-Site Request Forgery) protection

import crypto from "crypto";
import { cookies } from "next/headers";

const CSRF_TOKEN_NAME = "csrf_token";
const CSRF_TOKEN_LENGTH = 32;

export class CSRFProtection {
  /**
   * Generate a new CSRF token
   */
  static generateToken(): string {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
  }

  /**
   * Set CSRF token in cookie and return it
   * The token should also be included in forms/requests
   */
  static async setToken(): Promise<string> {
    const token = this.generateToken();
    const cookieStore = await cookies();

    cookieStore.set(CSRF_TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return token;
  }

  /**
   * Verify CSRF token from request against cookie
   * Use constant-time comparison to prevent timing attacks
   */
  static async verifyToken(requestToken: string): Promise<boolean> {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;

    if (!cookieToken || !requestToken) {
      return false;
    }

    try {
      // Constant-time comparison
      return crypto.timingSafeEqual(
        Buffer.from(cookieToken),
        Buffer.from(requestToken)
      );
    } catch (error) {
      // Lengths don't match or other error
      return false;
    }
  }

  /**
   * Get current CSRF token from cookie
   */
  static async getToken(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(CSRF_TOKEN_NAME)?.value;
  }
}

/**
 * Middleware to verify CSRF token on mutations
 * Skip for GET, HEAD, OPTIONS requests
 */
export async function verifyCSRF(req: Request): Promise<boolean> {
  // Skip CSRF check for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return true;
  }

  // Get token from header or form data
  const headerToken = req.headers.get("x-csrf-token");

  if (!headerToken) {
    console.warn("[CSRF] Missing CSRF token in request");
    return false;
  }

  return await CSRFProtection.verifyToken(headerToken);
}
