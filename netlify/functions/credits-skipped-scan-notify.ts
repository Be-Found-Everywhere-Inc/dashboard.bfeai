import { withErrorHandling, jsonResponse } from "./utils/http";
import { supabaseAdmin } from "./utils/supabase-admin";
import { markScheduledScanSkipped } from "./utils/skipped-scan";
import { shouldSendEmail } from "./utils/email-throttle";
import { sendEmail } from "./utils/email";
import { renderScheduledScanSkippedEmail } from "./utils/email-templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";

/**
 * POST /.netlify/functions/credits-skipped-scan-notify
 *
 * Internal endpoint called by consumer-app scheduled-scan paths (LABS today,
 * others later) when a scheduled run is skipped because the user is short on
 * credits. The endpoint:
 *
 *   1. Stamps `user_credits.last_skipped_scan_at` so the dashboard banner
 *      shows on the next visit.
 *   2. Fires a one-per-24h "scheduled scan skipped — top up to resume" email
 *      via Resend, gated by the Upstash-backed shouldSendEmail() throttle.
 *
 * Auth: shared-secret bearer token in the Authorization header
 * (`Authorization: Bearer ${INTERNAL_API_TOKEN}`). The auth check runs BEFORE
 * the method check intentionally — unauthenticated callers should never even
 * learn the method is wrong.
 *
 * Required env: INTERNAL_API_TOKEN (must match the value the consumer apps
 * send). NEXT_PUBLIC_APP_URL is optional and defaults to dashboard.bfeai.com.
 *
 * Body: { userId, appName, requiredCredits, availableCredits }
 */
export const handler = withErrorHandling(async (event) => {
  const expected = process.env.INTERNAL_API_TOKEN;
  const auth = event.headers?.authorization ?? event.headers?.Authorization;
  if (!expected || !auth || auth !== `Bearer ${expected}`) {
    return jsonResponse(401, { error: "Unauthorized" }, event);
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
  }

  let body: {
    userId?: string;
    appName?: string;
    requiredCredits?: number;
    availableCredits?: number;
  };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" }, event);
  }
  if (
    !body.userId ||
    !body.appName ||
    body.requiredCredits == null ||
    body.availableCredits == null
  ) {
    return jsonResponse(
      400,
      {
        error: "userId, appName, requiredCredits, availableCredits required",
      },
      event
    );
  }

  // Always mark the skip — banner data is more important than the email.
  await markScheduledScanSkipped(body.userId);

  const allowSend = await shouldSendEmail(
    body.userId,
    "scheduled_scan_skipped_low_credits"
  );
  if (!allowSend) {
    return jsonResponse(
      200,
      { ok: true, emailed: false, reason: "throttled" },
      event
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, first_name")
    .eq("id", body.userId)
    .maybeSingle();

  if (!profile?.email) {
    return jsonResponse(
      200,
      { ok: true, emailed: false, reason: "no_email" },
      event
    );
  }

  const { subject, html, text } = renderScheduledScanSkippedEmail({
    firstName: profile.first_name ?? undefined,
    appName: body.appName,
    requiredCredits: body.requiredCredits,
    availableCredits: body.availableCredits,
    creditsUrl: `${APP_URL}/credits`,
  });

  await sendEmail({ to: profile.email, subject, html, text });

  return jsonResponse(200, { ok: true, emailed: true }, event);
});
