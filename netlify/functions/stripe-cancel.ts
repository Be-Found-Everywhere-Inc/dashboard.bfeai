import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import {
  getOrCreateStripeCustomer,
  getActiveSubscriptions,
  cancelSubscription,
  applyDiscount,
  pauseSubscription,
  syncAppSubscription,
} from "./utils/stripe";
import { allocateRetentionBonus } from "./utils/credits";
import { getStripeEnv } from "../../lib/stripe-env";

type RequestBody = {
  reason: string;
  feedback?: string;
  /** If the user was shown a retention offer, did they accept? */
  acceptOffer?: boolean;
  /** The offer type being accepted/declined */
  offerType?: "discount_3mo" | "discount_1mo" | "pause" | "credits" | "none";
};

// Map cancellation reasons to retention offer types
const REASON_OFFER_MAP: Record<string, { offerType: string; details: Record<string, unknown> }> = {
  too_expensive: {
    offerType: "discount_3mo",
    details: { percent_off: 20, duration_months: 3, coupon_id: getStripeEnv("STRIPE_COUPON_20_OFF_3MO") },
  },
  not_using: {
    offerType: "pause",
    details: { pause_months: 1 },
  },
  missing_features: {
    offerType: "credits",
    details: { credit_amount: 50 },
  },
  switching_competitor: {
    offerType: "discount_1mo",
    details: { percent_off: 25, duration_months: 1, coupon_id: getStripeEnv("STRIPE_COUPON_25_OFF_1MO") },
  },
  technical_issues: {
    offerType: "credits",
    details: { credit_amount: 50 },
  },
  business_changed: {
    offerType: "discount_1mo",
    details: { percent_off: 25, duration_months: 1, coupon_id: getStripeEnv("STRIPE_COUPON_25_OFF_1MO") },
  },
  other: {
    offerType: "none",
    details: {},
  },
};

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);
  const email = user.email ?? "";

  if (!email) {
    throw new HttpError(400, "User email is required");
  }

  let body: RequestBody;
  try {
    body = event.body ? (JSON.parse(event.body) as RequestBody) : ({} as RequestBody);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  if (!body.reason) {
    throw new HttpError(400, "Cancellation reason is required");
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);
  const allSubs = await getActiveSubscriptions(customerId);

  // Find the first active subscription (cancel flow doesn't specify which app yet)
  const subscription = allSubs[0] ?? null;

  if (!subscription) {
    throw new HttpError(400, "No active subscription to cancel");
  }

  const appKey = subscription.metadata?.app_key ?? "keywords";

  // Check if user has already used a retention offer (lifetime limit: 1)
  const { data: existingOffer } = await supabaseAdmin
    .from("cancellation_offers")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();

  const hasUsedOffer = !!existingOffer;
  const reasonConfig = REASON_OFFER_MAP[body.reason] ?? REASON_OFFER_MAP.other;
  const offerAvailable = !hasUsedOffer && reasonConfig.offerType !== "none";

  // Step 1: If this is a request for the offer info (no acceptOffer field)
  if (body.acceptOffer === undefined && offerAvailable) {
    // Create offer record (feedback is saved only when the user completes Step 2 or 3)
    const { data: offer } = await supabaseAdmin
      .from("cancellation_offers")
      .insert({
        user_id: user.id,
        app_key: appKey,
        reason: body.reason,
        offer_type: reasonConfig.offerType,
        offer_details: reasonConfig.details,
        status: "offered",
      })
      .select("id")
      .single();

    return jsonResponse(200, {
      action: "offer",
      offerId: offer?.id,
      offerType: reasonConfig.offerType,
      offerDetails: reasonConfig.details,
      hasUsedOffer: false,
    });
  }

  // Step 2: User accepted the retention offer
  if (body.acceptOffer === true && offerAvailable) {
    const offerId = body.offerType ? await findLatestOfferId(user.id) : null;

    try {
      await applyRetentionOffer(user.id, subscription.id, reasonConfig, appKey);

      // Mark offer as accepted
      if (offerId) {
        await supabaseAdmin
          .from("cancellation_offers")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", offerId);
      }

      await saveFeedback(user.id, appKey, body.reason, body.feedback, offerId, true, false);
      await syncAppSubscription(user.id, subscription, appKey);

      return jsonResponse(200, {
        action: "offer_accepted",
        offerType: reasonConfig.offerType,
        message: getAcceptedMessage(reasonConfig.offerType),
      });
    } catch (err) {
      console.error("[stripe-cancel] Failed to apply retention offer:", err);
      throw new HttpError(500, "Failed to apply retention offer");
    }
  }

  // Step 3: User declined the offer or "Other" reason — proceed with cancellation
  const offerId = await findLatestOfferId(user.id);
  if (offerId) {
    await supabaseAdmin
      .from("cancellation_offers")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", offerId);
  }

  // Cancel at period end
  const cancelled = await cancelSubscription(subscription.id);
  await syncAppSubscription(user.id, cancelled, appKey);
  await saveFeedback(user.id, appKey, body.reason, body.feedback, offerId, false, true);

  return jsonResponse(200, {
    action: "cancelled",
    message: "Subscription will be cancelled at the end of the current billing period",
    subscription: {
      id: cancelled.id,
      status: cancelled.status,
      cancelAtPeriodEnd: cancelled.cancel_at_period_end,
    },
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function applyRetentionOffer(
  userId: string,
  subscriptionId: string,
  config: { offerType: string; details: Record<string, unknown> },
  appKey: string
) {
  switch (config.offerType) {
    case "discount_3mo":
    case "discount_1mo": {
      const couponId = config.details.coupon_id as string;
      if (couponId) {
        await applyDiscount(subscriptionId, couponId);
      }
      break;
    }
    case "pause": {
      await pauseSubscription(subscriptionId);
      break;
    }
    case "credits": {
      const amount = (config.details.credit_amount as number) ?? 50;
      await allocateRetentionBonus(userId, amount);
      break;
    }
  }
}

async function saveFeedback(
  userId: string,
  appKey: string,
  reason: string,
  feedback?: string,
  offerId?: string | null,
  offerAccepted = false,
  didCancel = false
) {
  await supabaseAdmin.from("cancellation_feedback").insert({
    user_id: userId,
    app_key: appKey,
    reason,
    feedback_text: feedback || null,
    offer_id: offerId ?? null,
    offer_accepted: offerAccepted,
    did_cancel: didCancel,
  });
}

async function findLatestOfferId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("cancellation_offers")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "offered")
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

function getAcceptedMessage(offerType: string): string {
  switch (offerType) {
    case "discount_3mo":
      return "Your subscription will continue at 20% off for the next 3 months.";
    case "discount_1mo":
      return "Your subscription will continue at 25% off for the next month.";
    case "pause":
      return "Your subscription has been paused for 1 month. It will resume automatically.";
    case "credits":
      return "50 bonus credits have been added to your account.";
    default:
      return "Your offer has been applied.";
  }
}
