import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { getUsageHistory } from "./utils/credits";

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);

  const limit = parseInt(event.queryStringParameters?.limit ?? "50", 10);
  const offset = parseInt(event.queryStringParameters?.offset ?? "0", 10);

  const result = await getUsageHistory(user.id, limit, offset);

  return jsonResponse(200, result);
});
