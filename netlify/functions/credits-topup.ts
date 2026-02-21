import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { getOrCreateStripeCustomer, createTopUpCheckoutSession } from "./utils/stripe";
import { getStripeEnv } from "../../src/lib/stripe-env";

type TopUpPack = {
  priceId: string;
  credits: number;
  name: string;
};

const TOP_UP_PACKS: Record<string, TopUpPack> = {
  starter: {
    priceId: getStripeEnv("STRIPE_PRICE_TOPUP_STARTER", "price_topup_starter"),
    credits: 75,
    name: "Starter Boost",
  },
  builder: {
    priceId: getStripeEnv("STRIPE_PRICE_TOPUP_BUILDER", "price_topup_builder"),
    credits: 270,
    name: "Builder Pack",
  },
  power: {
    priceId: getStripeEnv("STRIPE_PRICE_TOPUP_POWER", "price_topup_power"),
    credits: 980,
    name: "Power Pack",
  },
  pro: {
    priceId: getStripeEnv("STRIPE_PRICE_TOPUP_PRO", "price_topup_pro"),
    credits: 2500,
    name: "Pro Pack",
  },
  max: {
    priceId: getStripeEnv("STRIPE_PRICE_TOPUP_MAX", "price_topup_max"),
    credits: 5250,
    name: "Max Pack",
  },
};

const SUCCESS_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL
  ? `${process.env.NEXT_PUBLIC_PAYMENTS_URL}/credits?topup=success`
  : "https://payments.bfeai.com/credits?topup=success";
const CANCEL_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL
  ? `${process.env.NEXT_PUBLIC_PAYMENTS_URL}/credits?topup=cancelled`
  : "https://payments.bfeai.com/credits?topup=cancelled";

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
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

  const pack = TOP_UP_PACKS[body.packKey];
  if (!pack) {
    throw new HttpError(400, `Unknown pack: ${body.packKey}. Valid packs: ${Object.keys(TOP_UP_PACKS).join(", ")}`);
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

  return jsonResponse(200, { url: session.url });
});
