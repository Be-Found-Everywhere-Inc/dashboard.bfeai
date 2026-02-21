import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);

  // Fetch or create user_settings row
  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[settings-get] Failed to fetch user_settings:", error);
    return jsonResponse(500, { error: "Failed to fetch settings" });
  }

  if (data) {
    return jsonResponse(200, data);
  }

  // No row exists — create default row
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("user_settings")
    .insert({ user_id: user.id })
    .select()
    .single();

  if (insertError) {
    console.error("[settings-get] Failed to create default settings:", insertError);
    return jsonResponse(500, { error: "Failed to create settings" });
  }

  return jsonResponse(200, inserted);
});
