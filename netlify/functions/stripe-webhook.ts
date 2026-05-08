import type { Handler } from "@netlify/functions";
import { jsonResponse } from "./utils/http";
import {
  constructWebhookEvent,
  isEventProcessed,
  markEventProcessed,
  syncAppSubscription,
  getUserIdFromStripeCustomer,
  updateUserTier,
  stripe,
} from "./utils/stripe";
import { supabaseAdmin } from "./utils/supabase-admin";
import {
  allocateSubscriptionCredits,
  allocateTopUpCredits,
  allocateTrialCredits,
  expireTrialCredits,
  mergeTrialCredits,
  recalculateSubscriptionCap,
  getBalance,
} from "./utils/credits";
import {
  getMonthlyCreditsForSubscription,
  TRIAL_CREDITS,
  findSubscriptionByPriceId,
  findSubscriptionPlan,
  GRANDFATHERED_BUNDLE_SUBSCRIPTION_IDS,
  GRANDFATHERED_BUNDLE_APP_KEYS,
  TOPUP_PACKS,
} from "../../config/plans";
import type { TopUpPackKey } from "../../config/plans";
import { sendTrialReminderEmail, sendWelcomeEmail, sendEmail } from "./utils/email";
import { shouldSendEmail } from "./utils/email-throttle";
import {
  renderAutoTopUpRequiresAuthEmail,
  renderAutoTopUpRefundProcessedEmail,
} from "./utils/email-templates";
import type Stripe from "stripe";

/**
 * Stripe webhook handler.
 * Does NOT use withErrorHandling/requireAuth because Stripe sends raw POST requests.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const signature = event.headers["stripe-signature"];
  if (!signature || !event.body) {
    return jsonResponse(400, { error: "Missing signature or body" });
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = constructWebhookEvent(event.body, signature);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return jsonResponse(400, { error: "Invalid signature" });
  }

  // Idempotency check
  if (await isEventProcessed(stripeEvent.id)) {
    return jsonResponse(200, { received: true, duplicate: true });
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.paused":
        await handleSubscriptionPaused(stripeEvent.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.resumed":
        await handleSubscriptionResumed(stripeEvent.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(stripeEvent.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_action_required":
        await handleInvoiceActionRequired(stripeEvent.data.object as Stripe.Invoice);
        break;

      case "customer.updated":
        await handleCustomerUpdated(stripeEvent.data.object as Stripe.Customer);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(stripeEvent.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.requires_action":
        await handlePaymentIntentRequiresAction(stripeEvent.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(stripeEvent.data.object as Stripe.Charge);
        break;

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${stripeEvent.type}`);
    }

    await markEventProcessed(stripeEvent.id, stripeEvent.type);
  } catch (err) {
    console.error(`[stripe-webhook] Error handling ${stripeEvent.type}:`, err);
    return jsonResponse(500, { error: "Webhook handler error" });
  }

  return jsonResponse(200, { received: true });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Infer app keys from a subscription's price IDs.
 * Used as fallback when subscription metadata hasn't been set yet (e.g. Payment Link checkouts).
 */
function getAppKeysFromPriceIds(subscription: Stripe.Subscription): string[] {
  const appKeys: string[] = [];
  for (const item of subscription.items?.data ?? []) {
    const priceId = typeof item.price === "string" ? item.price : item.price?.id;
    if (priceId) {
      // Check individual app plans
      const plan = findSubscriptionByPriceId(priceId);
      if (plan) {
        appKeys.push(plan.appKey);
      }
    }
  }
  return [...new Set(appKeys)];
}

/**
 * Extract app keys from a subscription.
 * Regular subscriptions have metadata.app_key="keywords" (or "labs").
 * Falls back to price ID detection for Payment Link subscriptions.
 * Wave 1.5 grandfather: 8 legacy bundle subs return ["keywords","labs"] so
 * cancellation/update events propagate to both app_subscriptions rows.
 */
function getAppKeysFromSubscription(subscription: Stripe.Subscription): string[] {
  if (GRANDFATHERED_BUNDLE_SUBSCRIPTION_IDS.has(subscription.id)) {
    return [...GRANDFATHERED_BUNDLE_APP_KEYS];
  }
  if (subscription.metadata?.app_key) {
    return [subscription.metadata.app_key];
  }
  // Fallback: infer from price IDs (Payment Link subscriptions before metadata is set)
  const fromPrices = getAppKeysFromPriceIds(subscription);
  return fromPrices.length > 0 ? fromPrices : ["keywords"];
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id;

  if (!customerId) {
    console.error("[stripe-webhook] No customer on checkout session");
    return;
  }

  let userId = await getUserIdFromStripeCustomer(customerId);

  // Unauthenticated trial flow: auto-provision account if needed
  if (!userId && session.metadata?.flow === "unauthenticated") {
    userId = await provisionUnauthenticatedTrialUser(customerId);
    if (!userId) {
      console.error("[stripe-webhook] Failed to provision user for unauthenticated checkout, customer:", customerId);
      return;
    }
  }

  // Payment Link flow: checkout from Stripe Payment Link (no metadata set)
  if (session.payment_link && !session.metadata?.type) {
    const provisionedUserId = await handlePaymentLinkCheckout(session, customerId, userId);
    if (provisionedUserId) {
      await detectAndTagBetaTester(session, provisionedUserId);
    }
    return;
  }

  if (!userId) {
    console.error("[stripe-webhook] No BFEAI user for Stripe customer:", customerId);
    return;
  }

  const metadataType = session.metadata?.type;

  if (metadataType === "topup") {
    // One-time credit top-up purchase
    const credits = parseInt(session.metadata?.credits ?? "0", 10);
    const packName = session.metadata?.pack_name ?? "Top-up";

    if (credits > 0) {
      await allocateTopUpCredits(userId, credits, packName, session.id);
      console.log(`[stripe-webhook] Allocated ${credits} top-up credits for user ${userId}`);
    }
  } else if (metadataType === "trial") {
    // Legacy single-app trial checkout (kept for backward compat)
    const appKey = session.metadata?.app_key ?? "keywords";
    const trialCredits = TRIAL_CREDITS;

    // Trial ends 7 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    await allocateTrialCredits(userId, trialCredits, appKey, trialEndsAt, session.id);
    console.log(`[stripe-webhook] Allocated ${trialCredits} trial credits for ${appKey}, user ${userId}, expires ${trialEndsAt.toISOString()}`);
  } else {
    // Single-app subscription checkout: allocate initial credits.
    const sessionAppKey = session.metadata?.app_key ?? "keywords";
    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as { id: string } | null)?.id;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncAppSubscription(userId, subscription, sessionAppKey);
      const monthlyCredits = getMonthlyCreditsForSubscription(sessionAppKey);
      const { allocated } = await allocateSubscriptionCredits(
        userId,
        monthlyCredits,
        sessionAppKey,
        `${session.id}:${sessionAppKey}`
      );
      console.log(`[stripe-webhook] Checkout: allocated ${allocated}/${monthlyCredits} credits for ${sessionAppKey}, user ${userId}`);
      await recalculateSubscriptionCap(userId);
    }
    console.log(`[stripe-webhook] Checkout completed for ${sessionAppKey} subscription, user ${userId}`);
  }

  // --- Beta tester auto-tagging via promo code ---
  await detectAndTagBetaTester(session, userId);

  // --- Cancel-other-subs: enforce "one sub per user" rule ---
  const newSubscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : (session.subscription as { id: string } | null)?.id ?? null;
  await cancelOtherActiveSubs(userId, newSubscriptionId);
}

// ---------------------------------------------------------------------------
// Payment Link checkout handling
// ---------------------------------------------------------------------------

/**
 * Handle a checkout that came from a Stripe Payment Link (e.g. WordPress CTA buttons).
 * Payment Links don't carry BFEAI metadata, so we:
 * 1. Auto-provision a BFEAI account from the Stripe customer's email
 * 2. Identify the purchased plan from subscription price IDs
 * 3. Set metadata on the Stripe subscription so future webhook events route correctly
 * 4. Sync the app_subscriptions table immediately
 * 5. For trial subscriptions, allocate trial credits
 *
 * Returns the userId on success, null on failure.
 */
async function handlePaymentLinkCheckout(
  session: Stripe.Checkout.Session,
  customerId: string,
  existingUserId: string | null
): Promise<string | null> {
  let userId = existingUserId;

  // -----------------------------------------------------------------------
  // Subscription mode: regular subs ($29/mo) and trial subs ($1 + 7-day trial)
  // -----------------------------------------------------------------------
  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });

    const appKeys = getAppKeysFromPriceIds(subscription);

    // Set app_key on customer metadata before provisioning (welcome email reads it)
    if (appKeys.length > 0) {
      await stripe.customers.update(customerId, {
        metadata: { app_key: appKeys[0] },
      });
    }

    // Auto-provision BFEAI account if user doesn't exist
    if (!userId) {
      userId = await provisionUnauthenticatedTrialUser(customerId);
      if (!userId) {
        console.error("[stripe-webhook] Failed to provision user for Payment Link checkout, customer:", customerId);
        return null;
      }
    }

    if (appKeys.length === 0) {
      console.warn("[stripe-webhook] Payment Link: no matching plans for subscription:", subscriptionId);
      return userId;
    }

    if (appKeys.length > 1) {
      console.warn(
        `[stripe-webhook] Payment Link sub ${subscriptionId} has ${appKeys.length} app_keys — bundle flow no longer supported, using first: ${appKeys[0]}`
      );
    }

    // Set metadata on subscription so future events route correctly
    const metadata: Record<string, string> = { app_key: appKeys[0], source: "payment_link" };

    await stripe.subscriptions.update(subscriptionId, { metadata });

    // Sync app_subscriptions immediately (don't rely on subscription.updated event timing)
    for (const appKey of appKeys) {
      await syncAppSubscription(userId, subscription, appKey);
    }

    // Trial detection: allocate trial credits if subscription is in trialing state
    if (subscription.status === "trialing" || subscription.trial_end) {
      const trialEndsAt = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      for (const appKey of appKeys) {
        const trialCredits = TRIAL_CREDITS;
        await allocateTrialCredits(userId, trialCredits, appKey, trialEndsAt, `plink_trial_${session.id}`);
      }
      console.log(`[stripe-webhook] Payment Link trial: allocated credits for user ${userId}, apps: ${appKeys.join(",")}, expires: ${trialEndsAt.toISOString()}`);
    } else if (subscription.status === "active") {
      // Active (non-trial) subscription: allocate subscription credits immediately.
      // The invoice.payment_succeeded event may have already fired before the user
      // was provisioned (race condition), so we allocate here as a safety net.
      for (const appKey of appKeys) {
        const monthlyCredits = getMonthlyCreditsForSubscription(appKey);
        const { allocated } = await allocateSubscriptionCredits(
          userId,
          monthlyCredits,
          appKey,
          `plink_checkout_${session.id}:${appKey}`
        );
        console.log(`[stripe-webhook] Payment Link: allocated ${allocated}/${monthlyCredits} subscription credits for ${appKey}, user ${userId}`);
      }
      await recalculateSubscriptionCap(userId);
    }

    console.log(
      `[stripe-webhook] Payment Link: provisioned ${appKeys[0]} ${subscription.status === "trialing" ? "trial " : ""}subscription for user ${userId}, sub: ${subscriptionId}`
    );

    return userId;
  }

  // -----------------------------------------------------------------------
  // Payment mode: legacy path — no longer used post-Wave-1.5
  // -----------------------------------------------------------------------
  if (session.mode === "payment") {
    if (!userId) {
      userId = await provisionUnauthenticatedTrialUser(customerId);
      if (!userId) {
        console.error("[stripe-webhook] Failed to provision user for Payment Link payment, customer:", customerId);
        return null;
      }
    }

    console.warn("[stripe-webhook] Payment Link payment-mode session not handled:", session.id);

    return userId;
  }

  console.warn("[stripe-webhook] Payment Link: unhandled session mode:", session.mode, "session:", session.id);
  return userId;
}

// ---------------------------------------------------------------------------
// Unauthenticated trial provisioning
// ---------------------------------------------------------------------------

const APP_DISPLAY_NAMES: Record<string, string> = {
  keywords: "BFEAI Keywords",
  labs: "BFEAI LABS",
};

/**
 * Auto-provision a BFEAI account for a user who completed checkout without being logged in.
 * Returns the userId on success, null on failure.
 */
async function provisionUnauthenticatedTrialUser(customerId: string): Promise<string | null> {
  try {
    // 1. Get email from Stripe customer
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || !customer.email) {
      console.error("[stripe-webhook] No email on Stripe customer:", customerId);
      return null;
    }
    const email = customer.email;

    // 2. Check if BFEAI account already exists for this email
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId: string;
    let isNewUser = false;

    if (existingProfile) {
      // 3a. Existing account — link Stripe customer, skip welcome email
      userId = existingProfile.id;
      console.log(`[stripe-webhook] Linking existing user ${userId} to Stripe customer ${customerId}`);
    } else {
      // 3b. New user — create account via Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true, // Skip email verification (they confirmed via Stripe)
      });

      if (authError || !authData.user) {
        console.error("[stripe-webhook] Failed to create user:", authError?.message);
        return null;
      }

      userId = authData.user.id;
      isNewUser = true;
      console.log(`[stripe-webhook] Created new user ${userId} for email ${email}`);
    }

    // 4. Upsert profiles with email + stripe_customer_id
    //    (DB trigger from auth.users creates profile row but doesn't set email)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    // 5. Link Stripe customer to BFEAI user
    await stripe.customers.update(customerId, {
      metadata: { bfeai_user_id: userId },
    });

    // 6. Send welcome email with password reset link (new users only)
    if (isNewUser) {
      try {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });

        if (!linkError && linkData?.properties?.action_link) {
          // Replace Supabase's default redirect with our reset-password page
          const resetUrl = new URL(linkData.properties.action_link);
          const token = resetUrl.searchParams.get("token") ?? resetUrl.hash;
          const resetLink = `https://dashboard.bfeai.com/reset-password?token_hash=${encodeURIComponent(token)}&type=recovery`;

          // Determine app name from customer metadata or default
          const appKey = (customer.metadata as Record<string, string>)?.app_key ?? "keywords";
          const appName = APP_DISPLAY_NAMES[appKey] ?? `BFEAI ${appKey}`;
          const plan = findSubscriptionPlan(appKey);

          await sendWelcomeEmail(email, {
            appName,
            resetLink,
            trialDays: 7,
            chargeAmount: plan ? `$${plan.monthlyPrice}/mo` : "$29/mo",
          });
        }
      } catch (err) {
        // Fire-and-forget — user can request password reset manually
        console.warn("[stripe-webhook] Failed to send welcome email:", err);
      }
    }

    return userId;
  } catch (err) {
    console.error("[stripe-webhook] Error provisioning unauthenticated user:", err);
    return null;
  }
}

/**
 * Check if the checkout session used a beta tester promo code (beefy-*-20).
 * If so, upgrade the user's tier to 'beta_tester' (won't overwrite 'founder').
 */
async function detectAndTagBetaTester(
  session: Stripe.Checkout.Session,
  userId: string
): Promise<void> {
  try {
    // Stripe v20: session.discounts is an array, not session.discount
    const discounts = session.discounts;
    if (!discounts || discounts.length === 0) return;

    for (const discount of discounts) {
      const promoRef = discount.promotion_code;
      if (!promoRef) continue;

      // promotion_code may be a string ID (unexpanded) or an object
      let promoCode: string;
      if (typeof promoRef === "string") {
        const promo = await stripe.promotionCodes.retrieve(promoRef);
        promoCode = promo.code;
      } else {
        promoCode = promoRef.code;
      }

      // Match beta tester pattern: starts with "beefy-" and ends with "-20"
      if (/^beefy-.+-20$/.test(promoCode)) {
        await updateUserTier(userId, "beta_tester");
        console.log(`[stripe-webhook] Tagged user ${userId} as beta_tester (promo: ${promoCode})`);
        return; // Only need to tag once
      }
    }
  } catch (err) {
    // Non-critical — log and continue
    console.warn("[stripe-webhook] Error checking promo code for beta tester tagging:", err);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only allocate credits for subscription invoices (not one-time payments)
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  if (!subscriptionRef) return;

  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  if (!userId) {
    console.error("[stripe-webhook] No BFEAI user for Stripe customer:", customerId);
    return;
  }

  // Get appKey from subscription metadata (supports multiple apps)
  const subscriptionId = typeof subscriptionRef === "string"
    ? subscriptionRef
    : (subscriptionRef as { id: string }).id;

  // Wave 1.5 grandfather: 8 legacy bundle subs allocate to BOTH keywords + labs.
  // Skip the rest of this handler — the trial-merge / single-app allocation paths
  // below assume one app_key. Allocate explicitly for both grandfathered apps and return.
  if (GRANDFATHERED_BUNDLE_SUBSCRIPTION_IDS.has(subscriptionId)) {
    for (const appKey of GRANDFATHERED_BUNDLE_APP_KEYS) {
      const monthlyCredits = getMonthlyCreditsForSubscription(appKey);
      const { allocated } = await allocateSubscriptionCredits(
        userId,
        monthlyCredits,
        appKey,
        `${invoice.id}:${appKey}`,
      );
      console.log(
        `[stripe-webhook] Grandfathered bundle: allocated ${allocated}/${monthlyCredits} for ${appKey}, user ${userId} (invoice: ${invoice.id})`,
      );
    }
    await recalculateSubscriptionCap(userId);
    return;
  }

  let appKey = "keywords";
  let priceId: string | undefined;

  try {
    const { stripe } = await import("./utils/stripe");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    appKey = subscription.metadata?.app_key ?? "keywords";

    // Get the price ID from subscription items for credit lookup
    const firstItem = subscription.items?.data?.[0];
    if (firstItem) {
      priceId = typeof firstItem.price === "string" ? firstItem.price : firstItem.price?.id;
    }

    // --- Trial billing_reason checks ---
    const billingReason = invoice.billing_reason;

    if (billingReason === "subscription_create" && subscription.status === "trialing") {
      // This is the $1 setup fee invoice for a trial — do NOT allocate subscription credits
      console.log(`[stripe-webhook] Skipping credit allocation for trial setup fee invoice ${invoice.id}, user ${userId}`);
      return;
    }

    // Check if this is a trial-to-paid conversion (first subscription_cycle after trial)
    if (billingReason === "subscription_cycle") {
      // Merge any remaining trial credits into subscription pool
      const { merged } = await mergeTrialCredits(userId, appKey);
      if (merged > 0) {
        console.log(`[stripe-webhook] Merged ${merged} trial credits into subscription for ${appKey}, user ${userId}`);
      }
    }
  } catch (err) {
    console.warn("[stripe-webhook] Could not retrieve subscription metadata, using defaults:", err);
  }

  // Look up the correct monthly credits for this app/tier
  const monthlyCredits = getMonthlyCreditsForSubscription(appKey, priceId);

  // Allocate monthly subscription credits (respects 3x cap)
  const { allocated } = await allocateSubscriptionCredits(
    userId,
    monthlyCredits,
    appKey,
    invoice.id
  );

  // Ensure cap is in sync after allocation (handles new subscription + renewal)
  await recalculateSubscriptionCap(userId);

  console.log(`[stripe-webhook] Allocated ${allocated}/${monthlyCredits} subscription credits for ${appKey}, user ${userId} (invoice: ${invoice.id})`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  if (!userId) return;

  // Determine app keys — bundle subscriptions cover multiple apps
  const appKeys = getAppKeysFromSubscription(subscription);

  for (const appKey of appKeys) {
    await syncAppSubscription(userId, subscription, appKey);
  }

  // Recalculate credit cap based on all active subscriptions
  const newCap = await recalculateSubscriptionCap(userId);
  console.log(`[stripe-webhook] Recalculated cap for user ${userId}: ${newCap}`);

  // Detect trial ending: subscription was trialing, now is something else
  if (subscription.status !== "trialing" && subscription.trial_end) {
    for (const appKey of appKeys) {
      if (subscription.status === "active") {
        console.log(`[stripe-webhook] Trial converted to active for ${appKey}, user ${userId}`);
      } else {
        await expireTrialCredits(userId, appKey, `Trial ended with status: ${subscription.status}`);
        console.log(`[stripe-webhook] Trial credits expired for ${appKey}, user ${userId}, status: ${subscription.status}`);
      }
    }
  }

  console.log(`[stripe-webhook] Synced subscription ${subscription.id} for user ${userId}, apps: ${appKeys.join(",")}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  if (!userId) return;

  const appKeys = getAppKeysFromSubscription(subscription);
  for (const appKey of appKeys) {
    await syncAppSubscription(userId, subscription, appKey);
  }

  // Recalculate cap
  const newCap = await recalculateSubscriptionCap(userId);
  console.log(`[stripe-webhook] Recalculated cap for user ${userId} after deletion: ${newCap}`);

  console.log(`[stripe-webhook] Subscription ${subscription.id} deleted for user ${userId}, apps: ${appKeys.join(",")}`);
}

async function handleSubscriptionPaused(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  if (!userId) return;

  const appKeys = getAppKeysFromSubscription(subscription);
  for (const appKey of appKeys) {
    await syncAppSubscription(userId, subscription, appKey);
  }

  // Paused subs don't count as active — recalculate cap
  const newCap = await recalculateSubscriptionCap(userId);
  console.log(`[stripe-webhook] Recalculated cap for user ${userId} after pause: ${newCap}`);

  console.log(`[stripe-webhook] Subscription ${subscription.id} paused for user ${userId}, apps: ${appKeys.join(",")}`);
}

async function handleSubscriptionResumed(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  if (!userId) return;

  const appKeys = getAppKeysFromSubscription(subscription);
  for (const appKey of appKeys) {
    await syncAppSubscription(userId, subscription, appKey);
  }

  // Resumed sub is active again — recalculate cap
  const newCap = await recalculateSubscriptionCap(userId);
  console.log(`[stripe-webhook] Recalculated cap for user ${userId} after resume: ${newCap}`);

  console.log(`[stripe-webhook] Subscription ${subscription.id} resumed for user ${userId}, apps: ${appKeys.join(",")}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;

  console.error(
    `[stripe-webhook] Payment failed for user ${userId ?? "unknown"}, ` +
    `invoice ${invoice.id}, subscription ${subscriptionRef ?? "none"}, ` +
    `attempt ${invoice.attempt_count}`
  );

  // Subscription status (past_due) will be synced via customer.subscription.updated event.
  // This handler provides early visibility for logging/monitoring.
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  if (!userId) {
    console.error("[stripe-webhook] No BFEAI user for trial_will_end, customer:", customerId);
    return;
  }

  const appKeys = getAppKeysFromSubscription(subscription);
  const appKey = appKeys[0]; // Primary app for email context

  // Get user email and name from Supabase
  let userEmail = "";
  let userName = "";
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    userEmail = profile?.email ?? "";
    userName = profile?.full_name ?? "there";
  } catch {
    console.warn("[stripe-webhook] Could not fetch profile for trial reminder, user:", userId);
    return;
  }

  if (!userEmail) {
    console.warn("[stripe-webhook] No email for trial reminder, user:", userId);
    return;
  }

  // Determine charge amount from subscription price
  let chargeAmount = "$29/mo"; // default
  const firstItem = subscription.items?.data?.[0];
  if (firstItem) {
    const priceId = typeof firstItem.price === "string" ? firstItem.price : firstItem.price?.id;
    if (priceId) {
      const plan = findSubscriptionByPriceId(priceId);
      if (plan) {
        chargeAmount = `$${plan.monthlyPrice}/mo`;
      }
    }
  }

  // Determine app display name
  const appNames: Record<string, string> = {
    keywords: "BFEAI Keywords",
    labs: "BFEAI LABS",
  };
  const appName = appNames[appKey] ?? `BFEAI ${appKey}`;

  // Calculate charge date from trial_end
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : new Date();
  const chargeDate = trialEnd.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await sendTrialReminderEmail(userEmail, {
    userName,
    appName,
    chargeDate,
    chargeAmount,
    cancellationUrl: "https://dashboard.bfeai.com/billing",
  });

  console.log(`[stripe-webhook] Trial reminder sent for ${appKey}, user ${userId}, trial ends ${chargeDate}`);
}

async function handleInvoiceActionRequired(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const userId = await getUserIdFromStripeCustomer(customerId);
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;

  console.warn(
    `[stripe-webhook] Payment action required (SCA/3DS) for user ${userId ?? "unknown"}, ` +
    `invoice ${invoice.id}, subscription ${subscriptionRef ?? "none"}`
  );

  // The subscription moves to 'incomplete' status until the customer completes authentication.
  // Status sync handled via customer.subscription.updated event.
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  console.log(`[stripe-webhook] customer.updated received for Stripe customer: ${customer.id}, name: "${customer.name}", email: "${customer.email}", phone: "${customer.phone}"`);

  if (customer.deleted) {
    console.log(`[stripe-webhook] customer.updated: customer is deleted, skipping`);
    return;
  }

  // Primary lookup: by stripe_customer_id on profiles
  let userId = await getUserIdFromStripeCustomer(customer.id);
  console.log(`[stripe-webhook] customer.updated: primary lookup (stripe_customer_id) result: ${userId ?? "null"}`);

  // Fallback 1: Stripe customer metadata may have bfeai_user_id
  if (!userId && customer.metadata?.bfeai_user_id) {
    userId = customer.metadata.bfeai_user_id;
    console.log(`[stripe-webhook] customer.updated: found user via metadata: ${userId}`);
    // Backfill the stripe_customer_id on profile for future lookups
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  // Fallback 2: lookup by email
  if (!userId && customer.email) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", customer.email)
      .maybeSingle();
    if (profile) {
      userId = profile.id;
      console.log(`[stripe-webhook] customer.updated: found user via email: ${userId}`);
      // Backfill the stripe_customer_id on profile for future lookups
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
        .eq("id", userId);
    }
  }

  if (!userId) {
    console.error("[stripe-webhook] No BFEAI user for customer.updated:", customer.id, "email:", customer.email);
    return;
  }

  const updates: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };

  if (customer.name) {
    updates.full_name = customer.name;
  }

  // Only write if there's something to sync beyond updated_at
  if (Object.keys(updates).length <= 1) {
    console.log(`[stripe-webhook] customer.updated for user ${userId} — no profile fields to sync (name: "${customer.name}", phone: "${customer.phone}")`);
    return;
  }

  console.log(`[stripe-webhook] customer.updated: writing to profiles for user ${userId}:`, JSON.stringify(updates));

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    console.error(`[stripe-webhook] Failed to sync profile for user ${userId}:`, error);
    return;
  }

  console.log(`[stripe-webhook] Synced billing info to profile for user ${userId}: ${Object.keys(updates).filter(k => k !== "updated_at").join(", ")}`);
}

/**
 * Cancel all OTHER active/trialing/past_due subscriptions for a user when they
 * complete checkout for a new sub. Enforces the "one sub per user" rule.
 *
 * For trialing subs, merges any remaining trial credits into the new sub's
 * subscription pool BEFORE canceling, so they aren't lost via expireTrialCredits.
 */
async function cancelOtherActiveSubs(
  userId: string,
  newSubscriptionId: string | null
): Promise<void> {
  if (!newSubscriptionId) return;

  const { data: otherActiveSubs } = await supabaseAdmin
    .from("app_subscriptions")
    .select("stripe_subscription_id, status, app_key")
    .eq("user_id", userId)
    .neq("stripe_subscription_id", newSubscriptionId)
    .in("status", ["active", "trialing", "past_due"]);

  for (const sub of otherActiveSubs ?? []) {
    if (!sub.stripe_subscription_id) continue;

    // Trial-merge before cancel: prevents expireTrialCredits from zeroing them
    if (sub.status === "trialing") {
      try {
        await mergeTrialCredits(userId, sub.app_key);
        console.log(`[stripe-webhook] Merged trial credits for ${sub.app_key} before canceling sub ${sub.stripe_subscription_id}`);
      } catch (err) {
        console.error(`[stripe-webhook] Trial-merge failed for sub ${sub.stripe_subscription_id}:`, err);
        // Continue with cancellation regardless — better to have the sub canceled than abort
      }
    }

    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id, {
        prorate: false,
        invoice_now: false,
      });
      console.log(`[stripe-webhook] Canceled other sub ${sub.stripe_subscription_id} after new checkout for user ${userId}`);
    } catch (err) {
      console.error(`[stripe-webhook] Failed to cancel other sub ${sub.stripe_subscription_id}:`, err);
      // Continue — partial state is recoverable on next sync
    }
  }
}

// ---------------------------------------------------------------------------
// Wave 3 Auto Top-Up webhook handlers
// ---------------------------------------------------------------------------

/**
 * Handles payment_intent.succeeded for auto_topup payment intents.
 * Idempotent: allocateTopUpCredits deduplicates on reference_id (DB UNIQUE),
 * so if auto-topup-charge.ts already allocated credits synchronously, this is
 * a no-op.
 */
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  if (pi.metadata?.type !== "auto_topup") {
    return;
  }

  const userId = pi.metadata.user_id;
  const packKey = pi.metadata.pack_key as TopUpPackKey | undefined;

  if (!userId || !packKey) {
    console.warn("[stripe-webhook] auto_topup PI missing metadata", pi.id);
    return;
  }

  const pack = TOPUP_PACKS[packKey];
  if (!pack) {
    console.warn("[stripe-webhook] auto_topup PI has unknown pack_key", packKey, pi.id);
    return;
  }

  // Idempotent: allocateTopUpCredits no-ops on duplicate reference_id
  const result = await allocateTopUpCredits(userId, pack.credits, pack.name, pi.id, {
    autoTopup: true,
    priceCents: pack.priceCents,
  });
  console.log(`[stripe-webhook] payment_intent.succeeded auto_topup pi=${pi.id} allocated=${result.allocated}`);
}

/**
 * Handles payment_intent.requires_action for auto_topup payment intents.
 * Disables auto top-up and sends a 3DS/SCA notification email (throttled 24h).
 */
async function handlePaymentIntentRequiresAction(pi: Stripe.PaymentIntent): Promise<void> {
  if (pi.metadata?.type !== "auto_topup") return;

  const userId = pi.metadata.user_id;
  if (!userId) {
    console.warn("[stripe-webhook] requires_action PI missing user_id", pi.id);
    return;
  }

  await supabaseAdmin
    .from("user_credits")
    .update({
      auto_topup_enabled: false,
      auto_topup_disabled_reason: "requires_authentication",
    })
    .eq("user_id", userId);

  // Look up profile for email
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, first_name")
    .eq("id", userId)
    .single();

  if (!profile?.email) return;

  const ok = await shouldSendEmail(userId, "auto_topup_requires_authentication");
  if (!ok) return;

  const packKey = pi.metadata.pack_key as TopUpPackKey | undefined;
  const pack = packKey ? TOPUP_PACKS[packKey] : undefined;
  const dashUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://dashboard.bfeai.com";
  const rendered = renderAutoTopUpRequiresAuthEmail({
    firstName: profile.first_name ?? undefined,
    packName: pack?.name ?? "Top-up",
    packPriceCents: pack?.priceCents ?? 0,
    creditsUrl: `${dashUrl}/credits`,
  });
  await sendEmail({ to: profile.email, ...rendered });
  console.log(`[stripe-webhook] requires_action email sent for user ${userId}, pi=${pi.id}`);
}

/**
 * Handles charge.refunded. Full refunds trigger a credit clawback (topup_balance
 * decremented) and an admin notification. Partial refunds route to admin only.
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const isFullRefund = charge.amount_refunded >= charge.amount_captured;

  if (!isFullRefund) {
    console.warn(`[stripe-webhook] Partial refund detected, charge ${charge.id}; manual handling required`);
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const rendered = renderAutoTopUpRefundProcessedEmail({
        chargeId: charge.id,
        userId: "(partial — see Stripe dashboard)",
        creditsClawedBack: 0,
      });
      await sendEmail({
        to: adminEmail,
        subject: `[BFEAI admin] Partial refund — manual handling: ${charge.id}`,
        html: rendered.html,
        text: rendered.text,
      });
    }
    return;
  }

  // Full refund — find the matching topup_purchase transaction
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn(`[stripe-webhook] Refunded charge has no payment_intent: ${charge.id}`);
    return;
  }

  const { data: txn } = await supabaseAdmin
    .from("credit_transactions")
    .select("user_id, amount, app_key")
    .eq("reference_id", paymentIntentId)
    .eq("type", "topup_purchase")
    .maybeSingle();

  if (!txn) {
    console.warn(`[stripe-webhook] No matching topup_purchase for refunded charge ${charge.id}`);
    return;
  }

  // Decrement topup_balance — brief negative allowed per §4.4 race handling
  const balance = await getBalance(txn.user_id);
  const newTopup = balance.topupBalance - txn.amount;

  await supabaseAdmin
    .from("user_credits")
    .update({ topup_balance: newTopup, updated_at: new Date().toISOString() })
    .eq("user_id", txn.user_id);

  // Audit log
  await supabaseAdmin.from("credit_transactions").insert({
    user_id: txn.user_id,
    amount: -txn.amount,
    balance_after: balance.total - txn.amount,
    pool: "topup",
    type: "refund_clawback",
    description: `Refund clawback for charge ${charge.id}`,
    app_key: txn.app_key ?? null,
    reference_id: `refund_${charge.id}`,
  });

  console.log(`[stripe-webhook] Clawed back ${txn.amount} credits from user ${txn.user_id} for refunded charge ${charge.id}`);

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const rendered = renderAutoTopUpRefundProcessedEmail({
      chargeId: charge.id,
      userId: txn.user_id,
      creditsClawedBack: txn.amount,
    });
    await sendEmail({ to: adminEmail, ...rendered });
  }
}
