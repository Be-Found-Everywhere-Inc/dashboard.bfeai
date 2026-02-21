import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { checkCredits } from "./utils/credits";

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);

  let body: { appKey?: string; operation?: string };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!body.appKey || !body.operation) {
    throw new HttpError(400, "appKey and operation are required");
  }

  const result = await checkCredits(user.id, body.appKey, body.operation);

  return jsonResponse(200, result);
});
