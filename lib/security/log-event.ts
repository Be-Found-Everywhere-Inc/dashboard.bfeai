/**
 * Shared audit-event logger for dashboard.bfeai.
 *
 * Writes to public.security_events, which is the canonical audit log
 * surfaced in admin.bfeai's Auth Support page.
 *
 * Uses the SERVICE-ROLE client (bypasses RLS). The user-context client
 * (the default from `@/lib/supabase/server`) cannot write to this
 * table — RLS on security_events has SELECT-only policies and no INSERT
 * policy, so anon writes (e.g. for LOGIN_FAILED on a bad-password
 * attempt) silently fail. That's why login/oauth/signup events stopped
 * landing in security_events around 2026-03-10 while logout events
 * continued (logout is also affected when the user has signed out
 * server-side, but historically logout was working when the cookie
 * still had a valid session).
 *
 * Each `logSecurityEvent` call must succeed without affecting the
 * caller's flow — failures are caught and logged to console only.
 */

import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export async function logSecurityEvent(
  eventType: string,
  severity: SecuritySeverity,
  userId: string | null,
  request: NextRequest,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const { error } = await supabase.from("security_events").insert({
      event_type: eventType,
      severity,
      user_id: userId,
      ip_address: ip,
      user_agent: request.headers.get("user-agent") || "unknown",
      details: details ?? null,
    });

    if (error) {
      // Service-role inserts should never hit RLS, so any error here
      // is a real schema/constraint issue worth surfacing in logs.
      console.error(
        "[logSecurityEvent] insert failed:",
        eventType,
        error.message,
      );
    }
  } catch (error) {
    console.error("[logSecurityEvent] unexpected error:", error);
    // Don't fail the request if logging fails — audit log writes
    // should never block the user's flow.
  }
}
