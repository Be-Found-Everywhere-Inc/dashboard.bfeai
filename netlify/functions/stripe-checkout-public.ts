import type { Handler, HandlerResponse } from "@netlify/functions";
import { jsonResponse, HttpError } from "./utils/http";
import { stripe } from "./utils/stripe";
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

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";
// Cold checkout completion lands on the marketing thank-you page (separate
// domain, no auth middleware), where the user is told to check their email
// to set a password. The dashboard root is auth-walled and would otherwise
// bounce post-checkout traffic to /login.
const TRIAL_SUCCESS_URL = "https://bfeai.com/thank-you/";
const CANCEL_URL = `${DASHBOARD_URL}/?checkout=cancelled`;
const LITE_TRIAL_REDIRECT_URL = `${DASHBOARD_URL}/apps?trial=true`;

/**
 * Trial tier configuration. Each tier is a $1 setup + 7-day trial that
 * converts to the named monthly plan. The canonical plan slug is
 * `<tier>-trial` (e.g. `lite-trial`, `plus-trial`, `max-trial`).
 */
type TrialTier = "lite" | "plus" | "max";

const TRIAL_TIERS: Record<TrialTier, { priceEnv: string; displayName: string; monthlyPrice: number }> = {
  lite: { priceEnv: "STRIPE_PRICE_LITE_MONTHLY", displayName: "Lite", monthlyPrice: 49 },
  plus: { priceEnv: "STRIPE_PRICE_PLUS_MONTHLY", displayName: "Plus", monthlyPrice: 144 },
  max:  { priceEnv: "STRIPE_PRICE_MAX_MONTHLY",  displayName: "Max",  monthlyPrice: 444 },
};

/**
 * Valid plan slugs for GET ?plan= parameter. Marketing CTAs hit this endpoint
 * directly (no login). Three canonical slugs, one per tier. Legacy slugs
 * below alias to `lite-trial` so existing per-app campaign URLs still convert
 * cold traffic into the entry-level Stripe Checkout.
 */
const VALID_PLANS = new Set<string>(["lite-trial", "plus-trial", "max-trial"]);

const LEGACY_PLAN_SLUGS = new Set([
  // Wave 1 per-app slugs (legacy, marketing CTAs still in wild) — all → lite
  "keywords-trial",
  "labs-trial",
  "keywords",
  "labs",
  // Wave 1.5 removed bundled trial slugs (still live on WordPress CTAs) — all → lite
  "bundle",
  "bundle-trial",
  "dual-trial",
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
  // GET: Direct checkout links for WordPress CTA buttons.
  // Canonical usage: ?plan=lite-trial | plus-trial | max-trial — each is a
  // $1/7-day trial that converts to the matching monthly plan
  // ($49 / $144 / $444). Legacy slugs (bundle-trial, dual-trial,
  // keywords-trial, labs-trial, keywords, labs, bundle) are aliased to
  // lite-trial so existing campaign URLs still convert at the entry tier.
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

    // Legacy per-app slugs are aliases for the unified Lite trial. Previously
    // these 303-redirected to /apps?trial=true, but that path requires auth —
    // so cold ad traffic was bouncing to /login instead of reaching Stripe.
    // Sending unauth visitors straight to Stripe Checkout (which collects email
    // and triggers the unauthenticated webhook provisioning path) is the only
    // way the funnel actually converts.
    const effectivePlan =
      plan && LEGACY_PLAN_SLUGS.has(plan) ? "lite-trial" : plan;

    if (!effectivePlan || !VALID_PLANS.has(effectivePlan)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "text/plain" },
        body: `Invalid plan. Valid plans: ${[...VALID_PLANS].join(", ")}`,
      };
    }

    const session = await createCheckoutSessionForPlan(effectivePlan);

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
 * Canonical slugs: `lite-trial`, `plus-trial`, `max-trial`. Each is a $1
 * setup + 7-day trial that converts to its named monthly plan. The slug's
 * tier is encoded in session metadata so the webhook can route correctly
 * (welcome email copy, plan display name, etc.).
 *
 * No customer is passed — Stripe collects email on the checkout page.
 * The webhook (handleCheckoutCompleted) provisions the BFEAI account
 * using metadata.flow: "unauthenticated".
 */
async function createCheckoutSessionForPlan(plan: string): Promise<Stripe.Checkout.Session> {
  const tierMatch = plan.match(/^(lite|plus|max)-trial$/);
  if (!tierMatch) {
    throw new HttpError(400, `Unknown plan: ${plan}`);
  }

  const tier = tierMatch[1] as TrialTier;
  const config = TRIAL_TIERS[tier];
  const priceId = getStripeEnv(config.priceEnv);

  if (!priceId) {
    throw new HttpError(500, `No price configured for ${config.displayName} plan`);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
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
      metadata: { app_key: "any", tier },
    },
    metadata: { type: "trial", app_key: "any", tier, flow: "unauthenticated" },
    success_url: TRIAL_SUCCESS_URL,
    cancel_url: CANCEL_URL,
  });
}

// ---------------------------------------------------------------------------
// POST handler: existing programmatic checkout (requires email in body)
// ---------------------------------------------------------------------------

async function handlePostCheckout(
  _event: Parameters<Handler>[0],
  cors: Record<string, string>
): Promise<HandlerResponse> {
  // Per-app POST trial checkout has been retired with the unified Lite/Plus/Max
  // model (Wave 1). The only first-party caller (the legacy /try/[appKey] page)
  // now redirects to /apps?trial=true, where authenticated users start the
  // unified trial via the in-app billing hook. Any remaining POST callers
  // should hit GET ?plan=lite-trial or be migrated to the new path.
  return withCors(
    jsonResponse(410, {
      error: "Per-app trial checkout has been retired. Start the unified Lite trial at the redirect URL below.",
      redirectUrl: LITE_TRIAL_REDIRECT_URL,
    }),
    cors,
  );
}

function withCors(response: HandlerResponse, cors: Record<string, string>): HandlerResponse {
  return {
    ...response,
    headers: { ...response.headers, ...cors },
  };
}
