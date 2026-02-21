import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { getOrCreateStripeCustomer, createCheckoutSession, createTrialCheckoutSession, checkTrialEligibility } from "./utils/stripe";
import { findSubscriptionPlan } from "../../config/plans";
import { getStripeEnv } from "../../lib/stripe-env";

const SUCCESS_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL
  ? `${process.env.NEXT_PUBLIC_PAYMENTS_URL}/?checkout=success`
  : "https://payments.bfeai.com/?checkout=success";
const TRIAL_SUCCESS_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL
  ? `${process.env.NEXT_PUBLIC_PAYMENTS_URL}/?checkout=trial-success`
  : "https://payments.bfeai.com/?checkout=trial-success";
const CANCEL_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL
  ? `${process.env.NEXT_PUBLIC_PAYMENTS_URL}/?checkout=cancelled`
  : "https://payments.bfeai.com/?checkout=cancelled";

// Legacy fallback for existing Keywords-only flow
const LEGACY_KEYWORDS_PRICE_ID = getStripeEnv("STRIPE_PRICE_KEYWORDS_MONTHLY");

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);
  const email = user.email ?? "";

  if (!email) {
    throw new HttpError(400, "User email is required for checkout");
  }

  // Parse request body for appKey and tier
  let appKey = "keywords";
  let tier: string | undefined;
  let billingPeriod: "monthly" | "yearly" = "monthly";
  let trial = false;

  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.appKey) appKey = body.appKey;
      if (body.tier) tier = body.tier;
      if (body.billingPeriod === "yearly") billingPeriod = "yearly";
      if (body.trial === true) trial = true;
    } catch {
      // If body parsing fails, use defaults (backwards compatible)
    }
  }

  // Look up the plan and its Stripe Price ID
  const plan = findSubscriptionPlan(appKey, tier);
  let priceId: string;

  if (plan) {
    priceId = billingPeriod === "yearly"
      ? plan.stripePriceIdYearly
      : plan.stripePriceIdMonthly;
  } else {
    priceId = "";
  }

  // Fall back to legacy env var for Keywords (backwards compatible)
  if (!priceId && appKey === "keywords") {
    priceId = LEGACY_KEYWORDS_PRICE_ID;
  }

  if (!priceId) {
    throw new HttpError(400, `No Stripe Price ID configured for ${appKey}${tier ? `:${tier}` : ""}`);
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  // Trial flow
  if (trial) {
    const eligibility = await checkTrialEligibility(user.id, appKey, customerId);
    if (!eligibility.eligible) {
      throw new HttpError(409, `Not eligible for trial: ${eligibility.reason}`);
    }

    const session = await createTrialCheckoutSession(
      customerId,
      priceId,
      appKey,
      TRIAL_SUCCESS_URL,
      CANCEL_URL
    );

    return jsonResponse(200, { url: session.url });
  }

  // Regular checkout flow
  const session = await createCheckoutSession(
    customerId,
    priceId,
    appKey,
    SUCCESS_URL,
    CANCEL_URL
  );

  return jsonResponse(200, { url: session.url });
});
