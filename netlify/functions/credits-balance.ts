import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { getBalance } from "./utils/credits";

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);
  const balance = await getBalance(user.id);

  return jsonResponse(200, balance);
});
