// Session management utilities

import crypto from "crypto";
import { JWTService } from "./jwt";
import { CookieService } from "./cookies";
import { createAdminClient } from "../supabase/admin";

export interface SessionInfo {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
}

export class SessionManager {
  /**
   * Generate device fingerprint for session security
   * Combines user agent, accept language, and accept encoding
   */
  static generateFingerprint(req: Request): string {
    const userAgent = req.headers.get("user-agent") || "";
    const acceptLanguage = req.headers.get("accept-language") || "";
    const acceptEncoding = req.headers.get("accept-encoding") || "";

    return crypto
      .createHash("sha256")
      .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}`)
      .digest("hex");
  }

  /**
   * Create new session for user
   * Returns SSO token to be set in cookie
   */
  static async createSession(
    userId: string,
    email: string,
    role: string = "user"
  ): Promise<string> {
    // Generate SSO token
    const token = JWTService.generateSSOToken(userId, email, role);

    // Store session in database for tracking
    const supabase = createAdminClient();
    await supabase.from("user_sessions").insert({
      user_id: userId,
      session_id: crypto.randomBytes(16).toString("hex"),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_active: new Date().toISOString(),
    });

    return token;
  }

  /**
   * Validate existing session
   * Returns user info if valid, null if invalid
   */
  static async validateSession(): Promise<{
    userId: string;
    email: string;
    role: string;
  } | null> {
    try {
      // Get token from cookie
      const token = await CookieService.getSessionCookie();
      if (!token) return null;

      // Verify token
      const payload = JWTService.verifySSOToken(token);

      // Update last active timestamp
      const supabase = createAdminClient();
      await supabase
        .from("user_sessions")
        .update({ last_active: new Date().toISOString() })
        .eq("user_id", payload.userId);

      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Destroy session (logout)
   */
  static async destroySession(userId?: string): Promise<void> {
    // Clear cookies
    await CookieService.clearSessionCookie();
    await CookieService.clearRefreshTokenCookie();

    // Remove from database if userId provided
    if (userId) {
      const supabase = createAdminClient();
      await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", userId);
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((session) => ({
      userId: session.user_id,
      email: session.email || "",
      role: session.role || "user",
      sessionId: session.session_id,
      createdAt: new Date(session.created_at),
      expiresAt: new Date(session.expires_at),
    }));
  }

  /**
   * Invalidate specific session
   */
  static async invalidateSession(sessionId: string): Promise<void> {
    const supabase = createAdminClient();
    await supabase
      .from("user_sessions")
      .delete()
      .eq("session_id", sessionId);
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  static async cleanupExpiredSessions(): Promise<void> {
    const supabase = createAdminClient();
    await supabase
      .from("user_sessions")
      .delete()
      .lt("expires_at", new Date().toISOString());
  }
}
