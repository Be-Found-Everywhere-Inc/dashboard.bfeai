import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { getOrCreateStripeCustomer, createTopUpCheckoutSession } from "./utils/stripe";
import { TOPUP_PACKS, type TopUpPackKey } from "../../config/plans";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";
const SUCCESS_URL = `${DASHBOARD_URL}/credits?topup=success`;
const CANCEL_URL = `${DASHBOARD_URL}/credits?topup=cancelled`;

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
  }

  const { user } = await requireAuth(event);
  const email = user.email ?? "";

  if (!email) {
    throw new HttpError(400, "User email is required");
  }

  let body: { packKey?: string };
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!body.packKey) {
    throw new HttpError(400, "packKey is required");
  }

  const pack = TOPUP_PACKS[body.packKey as TopUpPackKey];
  if (!pack) {
    throw new HttpError(
      400,
      `Unknown pack: ${body.packKey}. Valid packs: ${Object.keys(TOPUP_PACKS).join(", ")}`
    );
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  const session = await createTopUpCheckoutSession(
    customerId,
    pack.priceId,
    pack.credits,
    pack.name,
    SUCCESS_URL,
    CANCEL_URL
  );

  return jsonResponse(200, { url: session.url }, event);
});
