import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";

const ALLOWED_FIELDS = [
  "email_invoices",
  "newsletter_opt_in",
  "security_alerts",
  "login_alerts",
  "two_factor_enabled",
  "session_timeout_minutes",
] as const;

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);

  let body: Record<string, unknown>;
  try {
    body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  // Filter to only allowed fields
  const patch: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      patch[field] = body[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, "No valid fields to update");
  }

  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    // If row doesn't exist yet, upsert it
    if (error.code === "PGRST116") {
      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from("user_settings")
        .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (upsertError) {
        console.error("[settings-update] Failed to upsert settings:", upsertError);
        throw new HttpError(500, "Failed to update settings");
      }

      return jsonResponse(200, upserted);
    }

    console.error("[settings-update] Failed to update settings:", error);
    throw new HttpError(500, "Failed to update settings");
  }

  return jsonResponse(200, data);
});
