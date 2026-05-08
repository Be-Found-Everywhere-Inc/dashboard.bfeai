import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";

/**
 * POST /.netlify/functions/credits-skipped-scan-dismiss
 *
 * Marks the "scheduled scan skipped" banner as dismissed for the current
 * user by stamping `user_credits.last_skipped_scan_dismissed_at = now()`.
 * The dashboard hides the banner whenever
 * `last_skipped_scan_dismissed_at >= last_skipped_scan_at`.
 */
export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
  }

  const { user } = await requireAuth(event);
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("user_credits")
    .update({ last_skipped_scan_dismissed_at: now, updated_at: now })
    .eq("user_id", user.id);

  if (error) {
    return jsonResponse(500, { error: "Failed to dismiss banner" }, event);
  }

  return jsonResponse(200, { ok: true }, event);
});
