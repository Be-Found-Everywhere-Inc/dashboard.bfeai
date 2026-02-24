import type { Handler, HandlerResponse } from "@netlify/functions";
import { jsonResponse, HttpError } from "./utils/http";
import {
  stripe,
  createPublicTrialCheckoutSession,
  checkTrialEligibility,
  checkDualTrialEligibility,
  createDualTrialCheckoutSession,
  getUserIdFromStripeCustomer,
} from "./utils/stripe";
import { findSubscriptionPlan } from "../../config/plans";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Rate limiting: 5 requests/hour/IP
// ---------------------------------------------------------------------------

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------------------------------------------------------------------------
// Valid app keys
// ---------------------------------------------------------------------------

const VALID_APP_KEYS = new Set(["keywords", "labs"]);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";

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

  if (event.httpMethod !== "POST") {
    return withCors(jsonResponse(405, { error: "Method not allowed" }), cors);
  }

  try {
    // Rate limiting
    if (rateLimiter) {
      const ip =
        event.headers["x-forwarded-for"]?.split(",")[0].trim() ??
        event.headers["x-real-ip"] ??
        event.headers["cf-connecting-ip"] ??
        "unknown";

      const { success } = await rateLimiter.limit(ip);
      if (!success) {
        return withCors(jsonResponse(429, { error: "Too many requests. Try again later." }), cors);
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

    // If email provided, check for existing Stripe customer
    let existingCustomerId: string | undefined;
    let existingUserId: string | undefined;

    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 });

      if (existing.data.length > 0) {
        existingCustomerId = existing.data[0].id;
        const userId = await getUserIdFromStripeCustomer(existingCustomerId);
        if (userId) existingUserId = userId;
      }
    }

    // Dual trial flow
    if (dualTrial) {
      // Check eligibility if we have a known user
      if (existingUserId && existingCustomerId) {
        const eligibility = await checkDualTrialEligibility(existingUserId, existingCustomerId);
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
        customerId: existingCustomerId,
        customerEmail: existingCustomerId ? undefined : email,
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
      if (existingUserId && existingCustomerId) {
        const eligibility = await checkTrialEligibility(existingUserId, appKey!, existingCustomerId);
        if (!eligibility.eligible) {
          return withCors(
            jsonResponse(409, { error: `Not eligible for trial: ${eligibility.reason}` }),
            cors
          );
        }
      }

      const session = await createPublicTrialCheckoutSession({
        customerId: existingCustomerId,
        customerEmail: existingCustomerId ? undefined : email,
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

    const sessionParams: Record<string, unknown> = {
      mode: "subscription" as const,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { type: "subscription", app_key: appKey, flow: "unauthenticated" },
      subscription_data: { metadata: { app_key: appKey } },
    };

    if (existingCustomerId) {
      sessionParams.customer = existingCustomerId;
    } else if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return withCors(jsonResponse(200, { url: session.url }), cors);
  } catch (err) {
    if (err instanceof HttpError) {
      return withCors(jsonResponse(err.statusCode, { error: err.message }), cors);
    }
    console.error("[stripe-checkout-public] Unexpected error:", err);
    return withCors(jsonResponse(500, { error: "Internal server error" }), cors);
  }
};

function withCors(response: HandlerResponse, cors: Record<string, string>): HandlerResponse {
  return {
    ...response,
    headers: { ...response.headers, ...cors },
  };
}
