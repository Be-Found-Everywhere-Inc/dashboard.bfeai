import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createDualTrialCheckoutSession,
  checkDualTrialEligibility,
} from "./utils/stripe";
import { findSubscriptionPlan } from "../../config/plans";
import { getStripeEnv } from "../../lib/stripe-env";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";

const SUCCESS_URL = `${DASHBOARD_URL}/?checkout=success`;
const TRIAL_SUCCESS_URL = `${DASHBOARD_URL}/?checkout=trial-success`;
const CANCEL_URL = `${DASHBOARD_URL}/?checkout=cancelled`;

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

  // Parse request body
  let appKey = "keywords";
  let tier: string | undefined;
  let billingPeriod: "monthly" | "yearly" = "monthly";
  let trial = false;
  let dualTrial = false;

  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.appKey) appKey = body.appKey;
      if (body.tier) tier = body.tier;
      if (body.billingPeriod === "yearly") billingPeriod = "yearly";
      if (body.trial === true) trial = true;
      if (body.dualTrial === true) dualTrial = true;
    } catch {
      // If body parsing fails, use defaults (backwards compatible)
    }
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  // Dual trial flow (also handles legacy `trial` param for backward compat)
  if (dualTrial || trial) {
    const eligibility = await checkDualTrialEligibility(user.id, customerId);
    if (!eligibility.eligible) {
      throw new HttpError(409, `Not eligible for trial: ${eligibility.reason}`);
    }

    const session = await createDualTrialCheckoutSession({
      customerId,
      userId: user.id,
      successUrl: TRIAL_SUCCESS_URL,
      cancelUrl: CANCEL_URL,
    });

    return jsonResponse(200, { url: session.url });
  }

  // Regular subscription checkout flow
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

  const session = await createCheckoutSession(
    customerId,
    priceId,
    appKey,
    SUCCESS_URL,
    CANCEL_URL
  );

  return jsonResponse(200, { url: session.url });
});
