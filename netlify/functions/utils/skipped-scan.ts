import { supabaseAdmin } from "./supabase-admin";

/**
 * Stamp `user_credits.last_skipped_scan_at` to now for the given user.
 *
 * Called by scheduled-scan Netlify Functions (LABS today, others later) when
 * a scheduled run is short on credits. The dashboard reads this column to
 * surface the "scheduled scan skipped — top up" banner. Errors are logged
 * and swallowed so the calling scheduler can continue with other users.
 */
export async function markScheduledScanSkipped(userId: string): Promise<void> {
  const now = new Date().toISOString();
  // `.select("user_id")` makes UPDATE return matched rows so we can detect
  // the silent 0-row case (no user_credits row for this user — banner will
  // never show). We pick a single column to keep payload size minimal.
  const { data, error } = await supabaseAdmin
    .from("user_credits")
    .update({ last_skipped_scan_at: now, updated_at: now })
    .eq("user_id", userId)
    .select("user_id");

  if (error) {
    console.error("[skipped-scan] failed to mark", {
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (!data || data.length === 0) {
    console.warn(
      "[skipped-scan] no user_credits row for user — banner will never show",
      { userId }
    );
  }
}
