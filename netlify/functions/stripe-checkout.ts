import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createTrialCheckoutSession,
  checkTrialEligibility,
} from "./utils/stripe";
import { findSubscriptionPlan, LITE_PLAN, PLUS_PLAN, MAX_PLAN, UNIVERSAL_APP_KEY } from "../../config/plans";
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
  let unifiedTrial = false;

  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.appKey) appKey = body.appKey;
      if (body.tier) tier = body.tier;
      if (body.billingPeriod === "yearly") billingPeriod = "yearly";
      if (body.trial === true) trial = true;
      if (body.unifiedTrial === true || body.flow === "unified_trial") unifiedTrial = true;
    } catch {
      // If body parsing fails, use defaults (backwards compatible)
    }
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  // Unified trial flow ($1 setup fee + 7-day trial on Lite, universal app access)
  if (unifiedTrial) {
    const priceId = LITE_PLAN.stripePriceIdMonthly;
    if (!priceId) {
      throw new HttpError(400, "STRIPE_PRICE_LITE_MONTHLY not configured");
    }

    const eligibility = await checkTrialEligibility(user.id, UNIVERSAL_APP_KEY, customerId);
    if (!eligibility.eligible) {
      throw new HttpError(409, `Not eligible for trial: ${eligibility.reason}`);
    }

    const session = await createTrialCheckoutSession(
      customerId,
      priceId,
      UNIVERSAL_APP_KEY,
      TRIAL_SUCCESS_URL,
      CANCEL_URL
    );

    return jsonResponse(200, { url: session.url });
  }

  // Single-app trial flow ($1 setup fee + 7-day trial on one app)
  if (trial) {
    const plan = findSubscriptionPlan(appKey, tier);
    const priceId = plan?.stripePriceIdMonthly || (appKey === "keywords" ? LEGACY_KEYWORDS_PRICE_ID : "");

    if (!priceId) {
      throw new HttpError(400, `No price configured for trial: ${appKey}${tier ? `:${tier}` : ""}`);
    }

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

  // New-tier subscription flow: appKey='any' resolves to Lite/Plus/Max by tier
  let priceId: string = "";
  if (appKey === UNIVERSAL_APP_KEY) {
    const tierPlanMap = { lite: LITE_PLAN, plus: PLUS_PLAN, max: MAX_PLAN } as const;
    const tierPlan = tier && tier in tierPlanMap ? tierPlanMap[tier as keyof typeof tierPlanMap] : null;
    if (!tierPlan) {
      throw new HttpError(400, `Invalid tier for universal plan: ${tier ?? "(none)"}`);
    }
    priceId = tierPlan.stripePriceIdMonthly;
  } else {
    // Legacy per-app subscription flow
    const plan = findSubscriptionPlan(appKey, tier);
    if (plan) {
      priceId = billingPeriod === "yearly"
        ? ("stripePriceIdYearly" in plan ? plan.stripePriceIdYearly : "")
        : plan.stripePriceIdMonthly;
    }
    // Fall back to legacy env var for Keywords (backwards compatible)
    if (!priceId && appKey === "keywords") {
      priceId = LEGACY_KEYWORDS_PRICE_ID;
    }
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
