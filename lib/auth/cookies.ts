// Cookie management for SSO

import { cookies } from "next/headers";

const COOKIE_NAME = "bfeai_session";
const COOKIE_DOMAIN = ".bfeai.com";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export class CookieService {
  /**
   * Set SSO session cookie for all subdomains
   * This is the critical function that enables SSO across *.bfeai.com
   */
  static async setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, token, {
      domain: COOKIE_DOMAIN, // Leading dot = all subdomains
      httpOnly: true, // Prevent JavaScript access (XSS protection)
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "lax", // CSRF protection
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }

  /**
   * Get session cookie value
   */
  static async getSessionCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value;
  }

  /**
   * Clear session cookie (logout)
   */
  static async clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();

    // Remove from current domain
    cookieStore.delete(COOKIE_NAME);

    // Also set with domain to ensure it's cleared from .bfeai.com
    cookieStore.set(COOKIE_NAME, "", {
      domain: COOKIE_DOMAIN,
      maxAge: 0,
      path: "/",
    });
  }

  /**
   * Set refresh token cookie (httpOnly, more secure)
   */
  static async setRefreshTokenCookie(token: string): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set("bfeai_refresh", token, {
      domain: COOKIE_DOMAIN,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", // Stricter for refresh tokens
      maxAge: COOKIE_MAX_AGE,
      path: "/api/auth", // Only send to auth endpoints
    });
  }

  /**
   * Get refresh token cookie
   */
  static async getRefreshTokenCookie(): Promise<string | undefined> {
    const cookieStore = await cookies();
    return cookieStore.get("bfeai_refresh")?.value;
  }

  /**
   * Clear refresh token cookie
   */
  static async clearRefreshTokenCookie(): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.delete("bfeai_refresh");
    cookieStore.set("bfeai_refresh", "", {
      domain: COOKIE_DOMAIN,
      maxAge: 0,
      path: "/api/auth",
    });
  }
}
