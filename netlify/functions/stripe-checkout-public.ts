import type { Handler, HandlerResponse } from "@netlify/functions";
import { jsonResponse, HttpError } from "./utils/http";
import {
  stripe,
  createPublicTrialCheckoutSession,
  checkTrialEligibility,
  checkDualTrialEligibility,
  createDualTrialCheckoutSession,
  getUserIdFromStripeCustomer,
  getOrCreateStripeCustomerByEmail,
} from "./utils/stripe";
import {
  findSubscriptionPlan,
  findBundlePlan,
  BUNDLE_PLANS,
  DUAL_TRIAL_SETUP_FEE_PRICE_ID,
} from "../../config/plans";
import { getStripeEnv } from "../../lib/stripe-env";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type Stripe from "stripe";

const TRIAL_SETUP_FEE_PRICE_ID = getStripeEnv("STRIPE_PRICE_TRIAL_SETUP_FEE");

// ---------------------------------------------------------------------------
// Rate limiting: 5 requests/hour/IP (allowlisted IPs bypass)
// ---------------------------------------------------------------------------

const RATE_LIMIT_ALLOWLIST = new Set(
  (process.env.RATE_LIMIT_ALLOWLIST_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);

const isUpstashConfigured =
  process.env.UPSTASH_REDIS_URL &&
  process.env.UPSTASH_REDIS_TOKEN &&
  process.env.UPSTASH_REDIS_URL.startsWith("https://") &&
  !process.env.UPSTASH_REDIS_URL.includes("your_upstash");

const rateLimiter = isUpstashConfigured
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_URL!,
        token: process.env.UPSTASH_REDIS_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      analytics: true,
      prefix: "ratelimit:public-checkout",
    })
  : null;

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://dashboard.bfeai.com",
  "https://bfeai.com",
  "https://www.bfeai.com",
];

function corsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------------------------------------------------------------------------
// Valid app keys + plan slugs
// ---------------------------------------------------------------------------

const VALID_APP_KEYS = new Set(["keywords", "labs"]);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";
const SUCCESS_URL = `${DASHBOARD_URL}/?checkout=success`;
const TRIAL_SUCCESS_URL = `${DASHBOARD_URL}/?checkout=trial-success`;
const CANCEL_URL = `${DASHBOARD_URL}/?checkout=cancelled`;

/**
 * Valid plan slugs for GET ?plan= parameter.
 * Each maps to a Stripe Checkout session configuration.
 */
const VALID_PLANS = new Set([
  "keywords-trial",   // $1 Keywords 7-day trial
  "labs-trial",        // $1 LABS 7-day trial
  "bundle-trial",      // $2 Keywords + LABS 7-day trial
  "keywords",          // $29/mo Keywords subscription
  "labs",              // $29/mo LABS subscription
  ...BUNDLE_PLANS.map((b) => b.slug),  // bundle slugs (config-driven)
]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
  const origin = event.headers.origin ?? event.headers.Origin;
  const cors = corsHeaders(origin);

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  // -------------------------------------------------------------------------
  // GET: Direct checkout links for WordPress CTA buttons
  // Usage: ?plan=keywords-trial | labs-trial | bundle-trial | keywords | labs | bundle
  // No login required — Stripe collects email, webhook provisions BFEAI account.
  // -------------------------------------------------------------------------
  if (event.httpMethod === "GET") {
    return handleGetCheckout(event, cors);
  }

  // -------------------------------------------------------------------------
  // POST: Programmatic checkout (existing flow — requires email in JSON body)
  // -------------------------------------------------------------------------
  if (event.httpMethod === "POST") {
    return handlePostCheckout(event, cors);
  }

  return withCors(jsonResponse(405, { error: "Method not allowed" }), cors);
};

// ---------------------------------------------------------------------------
// GET handler: direct redirect to Stripe Checkout (no login, no email needed)
// ---------------------------------------------------------------------------

async function handleGetCheckout(
  event: Parameters<Handler>[0],
  cors: Record<string, string>
): Promise<HandlerResponse> {
  try {
    // Rate limiting (allowlisted IPs bypass)
    if (rateLimiter) {
      const ip =
        event.headers["x-forwarded-for"]?.split(",")[0].trim() ??
        event.headers["x-real-ip"] ??
        event.headers["cf-connecting-ip"] ??
        "unknown";

      if (!RATE_LIMIT_ALLOWLIST.has(ip)) {
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
          return {
            statusCode: 429,
            headers: { "Content-Type": "text/plain" },
            body: "Too many requests. Please try again later.",
          };
        }
      }
    }

    const plan = event.queryStringParameters?.plan;

    if (!plan || !VALID_PLANS.has(plan)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain" },
        body: `Invalid plan. Valid plans: ${[...VALID_PLANS].join(", ")}`,
      };
    }

    const session = await createCheckoutSessionForPlan(plan);

    if (!session.url) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        body: "Failed to create checkout session",
      };
    }

    // 303 redirect to Stripe Checkout
    return {
      statusCode: 303,
      headers: { Location: session.url },
      body: "",
    };
  } catch (err) {
    console.error("[stripe-checkout-public] GET error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Internal server error",
    };
  }
}

/**
 * Create a Stripe Checkout session for a given plan slug.
 * No customer is passed — Stripe collects email on the checkout page.
 * The webhook (handleCheckoutCompleted) provisions the BFEAI account
 * using metadata.flow: "unauthenticated".
 */
async function createCheckoutSessionForPlan(plan: string): Promise<Stripe.Checkout.Session> {
  switch (plan) {
    // ----- Single-app trials ($1 + 7-day trial) -----
    case "keywords-trial":
    case "labs-trial": {
      const appKey = plan === "keywords-trial" ? "keywords" : "labs";
      const sub = findSubscriptionPlan(appKey);
      const recurringPriceId = sub?.stripePriceIdMonthly;

      if (!recurringPriceId) {
        throw new HttpError(500, `No price configured for ${appKey}`);
      }

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        { price: recurringPriceId, quantity: 1 },
      ];
      if (TRIAL_SETUP_FEE_PRICE_ID) {
        lineItems.push({ price: TRIAL_SETUP_FEE_PRICE_ID, quantity: 1 });
      }

      return stripe.checkout.sessions.create({
        mode: "subscription",
        allow_promotion_codes: true,
        line_items: lineItems,
        subscription_data: {
          trial_period_days: 7,
          metadata: { app_key: appKey },
        },
        metadata: { type: "trial", app_key: appKey, flow: "unauthenticated" },
        success_url: TRIAL_SUCCESS_URL,
        cancel_url: CANCEL_URL,
      });
    }

    // ----- Bundle trial ($2 setup fee + $49/mo bundle with 7-day trial) -----
    case "bundle-trial": {
      const bundlePlan = findBundlePlan("bundle");
      if (!bundlePlan?.stripePriceIdMonthly) {
        throw new HttpError(500, "Bundle price not configured");
      }

      const bundleLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        { price: bundlePlan.stripePriceIdMonthly, quantity: 1 },
      ];
      if (DUAL_TRIAL_SETUP_FEE_PRICE_ID) {
        bundleLineItems.push({ price: DUAL_TRIAL_SETUP_FEE_PRICE_ID, quantity: 1 });
      }

      return stripe.checkout.sessions.create({
        mode: "subscription",
        allow_promotion_codes: true,
        line_items: bundleLineItems,
        subscription_data: {
          trial_period_days: 7,
          metadata: { type: "bundle", app_keys: bundlePlan.appKeys.join(",") },
        },
        metadata: { type: "bundle_trial", flow: "unauthenticated" },
        success_url: TRIAL_SUCCESS_URL,
        cancel_url: CANCEL_URL,
      });
    }

    // ----- Regular subscriptions ($29/mo) -----
    case "keywords":
    case "labs": {
      const sub = findSubscriptionPlan(plan);
      const priceId = sub?.stripePriceIdMonthly;

      if (!priceId) {
        throw new HttpError(500, `No price configured for ${plan}`);
      }

      return stripe.checkout.sessions.create({
        mode: "subscription",
        allow_promotion_codes: true,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: { app_key: plan },
        },
        metadata: { type: "subscription", app_key: plan, flow: "unauthenticated" },
        success_url: SUCCESS_URL,
        cancel_url: CANCEL_URL,
      });
    }

    default: {
      // ----- Bundle subscription (config-driven, single price + promo codes) -----
      const bundlePlan = findBundlePlan(plan);
      if (bundlePlan) {
        if (!bundlePlan.stripePriceIdMonthly) {
          throw new HttpError(500, `No price configured for bundle "${bundlePlan.slug}"`);
        }

        return stripe.checkout.sessions.create({
          mode: "subscription",
          allow_promotion_codes: true,
          line_items: [{ price: bundlePlan.stripePriceIdMonthly, quantity: 1 }],
          subscription_data: {
            metadata: { type: "bundle", app_keys: bundlePlan.appKeys.join(",") },
          },
          metadata: { type: "bundle", flow: "unauthenticated" },
          success_url: SUCCESS_URL,
          cancel_url: CANCEL_URL,
        });
      }

      throw new HttpError(400, `Unknown plan: ${plan}`);
    }
  }
}

// ---------------------------------------------------------------------------
// POST handler: existing programmatic checkout (requires email in body)
// ---------------------------------------------------------------------------

async function handlePostCheckout(
  event: Parameters<Handler>[0],
  cors: Record<string, string>
): Promise<HandlerResponse> {
  try {
    // Rate limiting (allowlisted IPs bypass)
    if (rateLimiter) {
      const ip =
        event.headers["x-forwarded-for"]?.split(",")[0].trim() ??
        event.headers["x-real-ip"] ??
        event.headers["cf-connecting-ip"] ??
        "unknown";

      if (!RATE_LIMIT_ALLOWLIST.has(ip)) {
        const { success } = await rateLimiter.limit(ip);
        if (!success) {
          return withCors(jsonResponse(429, { error: "Too many requests. Try again later." }), cors);
        }
      }
    }

    // Parse body
    if (!event.body) {
      return withCors(jsonResponse(400, { error: "Missing request body" }), cors);
    }

    let appKey: string | undefined;
    let tier: string | undefined;
    let billingPeriod: "monthly" | "yearly" = "monthly";
    let email: string | undefined;
    let trial = false;
    let dualTrial = false;

    try {
      const body = JSON.parse(event.body);
      appKey = body.appKey;
      tier = body.tier;
      if (body.billingPeriod === "yearly") billingPeriod = "yearly";
      email = body.email?.trim()?.toLowerCase();
      if (body.trial === true) trial = true;
      if (body.dualTrial === true) dualTrial = true;
    } catch {
      return withCors(jsonResponse(400, { error: "Invalid JSON body" }), cors);
    }

    // Dual trial doesn't require appKey; everything else does
    if (!dualTrial && (!appKey || !VALID_APP_KEYS.has(appKey))) {
      return withCors(jsonResponse(400, { error: `Invalid appKey. Must be one of: ${[...VALID_APP_KEYS].join(", ")}` }), cors);
    }

    // Always pre-create the Stripe customer before creating checkout sessions.
    // Never use customer_email on sessions — Stripe auto-creates a second
    // customer object when customer_email is used, causing duplicates.
    let customerId: string | undefined;
    let existingUserId: string | undefined;

    if (email) {
      customerId = await getOrCreateStripeCustomerByEmail(email);
      const userId = await getUserIdFromStripeCustomer(customerId);
      if (userId) existingUserId = userId;
    }

    if (!customerId) {
      return withCors(jsonResponse(400, { error: "Email is required for checkout" }), cors);
    }

    // Dual/bundle trial flow
    if (dualTrial) {
      // Check eligibility if we have a known user
      if (existingUserId) {
        const eligibility = await checkDualTrialEligibility(existingUserId, customerId);
        if (!eligibility.eligible) {
          return withCors(
            jsonResponse(409, { error: `Not eligible for trial: ${eligibility.reason}` }),
            cors
          );
        }
      }

      const successUrl = `${DASHBOARD_URL}/?checkout=trial-success`;
      const cancelUrl = `${DASHBOARD_URL}/?checkout=cancelled`;

      const session = await createDualTrialCheckoutSession({
        customerId,
        userId: existingUserId,
        successUrl,
        cancelUrl,
        flow: "unauthenticated",
      });

      return withCors(jsonResponse(200, { url: session.url }), cors);
    }

    // Single-app trial flow ($1 setup + 7-day trial)
    if (trial) {
      const plan = findSubscriptionPlan(appKey!, tier);
      const recurringPriceId = plan?.stripePriceIdMonthly;

      if (!recurringPriceId) {
        return withCors(jsonResponse(500, { error: `No price configured for ${appKey}` }), cors);
      }

      const successUrl = `${DASHBOARD_URL}/try/${appKey}?checkout=success`;
      const cancelUrl = `${DASHBOARD_URL}/try/${appKey}?checkout=cancelled`;

      // Check single-app trial eligibility if we have a known user
      if (existingUserId) {
        const eligibility = await checkTrialEligibility(existingUserId, appKey!, customerId);
        if (!eligibility.eligible) {
          return withCors(
            jsonResponse(409, { error: `Not eligible for trial: ${eligibility.reason}` }),
            cors
          );
        }
      }

      const session = await createPublicTrialCheckoutSession({
        customerId,
        recurringPriceId,
        appKey: appKey!,
        successUrl,
        cancelUrl,
      });

      return withCors(jsonResponse(200, { url: session.url }), cors);
    }

    // Regular subscription checkout (no trial)
    const plan = findSubscriptionPlan(appKey!, tier);
    const priceId = plan
      ? (billingPeriod === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly)
      : "";

    if (!priceId) {
      return withCors(jsonResponse(400, { error: `No price configured for ${appKey}${tier ? `:${tier}` : ""}` }), cors);
    }

    const successUrl = `${DASHBOARD_URL}/?checkout=success`;
    const cancelUrl = `${DASHBOARD_URL}/?checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { type: "subscription", app_key: appKey!, flow: "unauthenticated" },
      subscription_data: { metadata: { app_key: appKey! } },
    });

    return withCors(jsonResponse(200, { url: session.url }), cors);
  } catch (err) {
    if (err instanceof HttpError) {
      return withCors(jsonResponse(err.statusCode, { error: err.message }), cors);
    }
    console.error("[stripe-checkout-public] Unexpected error:", err);
    return withCors(jsonResponse(500, { error: "Internal server error" }), cors);
  }
}

function withCors(response: HandlerResponse, cors: Record<string, string>): HandlerResponse {
  return {
    ...response,
    headers: { ...response.headers, ...cors },
  };
}
