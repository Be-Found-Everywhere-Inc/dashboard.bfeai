import type { Handler } from "@netlify/functions";
import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import { stripe } from "./utils/stripe";
import { TOPUP_PACKS, type TopUpPackKey } from "../../config/plans";
import { allocateTopUpCredits } from "./utils/credits";
import { sendEmail } from "./utils/email";
import { shouldSendEmail } from "./utils/email-throttle";
import {
  renderAutoTopUpRequiresAuthEmail,
  renderAutoTopUpCardDeclinedEmail,
} from "./utils/email-templates";
import { isAutoTopUpBetaUser } from "../../lib/feature-flags";

const DASH_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://dashboard.bfeai.com";

export function buildIdempotencyKey(
  userId: string,
  packKey: string,
  when: Date
): string {
  const yyyy = when.getUTCFullYear();
  const mm = String(when.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(when.getUTCDate()).padStart(2, "0");
  return `auto-topup:${userId}:${yyyy}-${mm}-${dd}:${packKey}`;
}

export const handler: Handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
  }

  // Wave 3.1: dual auth path. Browser callers use the bfeai_session cookie
  // (requireAuth). Cross-app server callers (consumer-app proxies that
  // intercept 402s and trigger silent auto-topup) use Authorization: Bearer
  // INTERNAL_API_TOKEN + an X-User-Id header naming the user being charged.
  const authHeader =
    event.headers["authorization"] ?? event.headers["Authorization"] ?? "";
  const internalToken = process.env.INTERNAL_API_TOKEN;
  const isInternalCall =
    typeof internalToken === "string" &&
    internalToken.length > 0 &&
    authHeader === `Bearer ${internalToken}`;

  let userId: string;
  let userEmail = "";
  if (isInternalCall) {
    const headerUserId =
      event.headers["x-user-id"] ?? event.headers["X-User-Id"] ?? "";
    if (!headerUserId || typeof headerUserId !== "string") {
      return jsonResponse(
        400,
        { error: "X-User-Id header required for internal calls" },
        event
      );
    }
    userId = headerUserId;
    const { data: lookupProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    userEmail = lookupProfile?.email ?? "";
  } else {
    const { user } = await requireAuth(event);
    userId = user.id;
    userEmail = user.email ?? "";
  }

  if (!isAutoTopUpBetaUser(userId)) {
    return jsonResponse(
      403,
      { error: "Auto-topup not available for this account" },
      event
    );
  }

  const body = JSON.parse(event.body ?? "{}") as { pack_key?: TopUpPackKey };
  let packKey = body.pack_key;

  // Load user_credits row (auto_topup_pack_key included so we can fall back
  // to the saved pack when callers omit pack_key — Wave 3.1 proxies do).
  const { data: creditsRow, error: creditsErr } = await supabaseAdmin
    .from("user_credits")
    .select(
      "auto_topup_enabled, auto_topup_disabled_reason, auto_topup_payment_method_id, auto_topup_monthly_cap_cents, auto_topup_pack_key"
    )
    .eq("user_id", userId)
    .single();

  if (creditsErr || !creditsRow) {
    return jsonResponse(404, { error: "No user_credits row" }, event);
  }

  // Pre-condition gates
  if (
    !creditsRow.auto_topup_enabled ||
    creditsRow.auto_topup_disabled_reason !== null
  ) {
    return jsonResponse(409, {
      error: "Auto-topup not active",
      reason: creditsRow.auto_topup_disabled_reason ?? "not_enrolled",
    }, event);
  }

  if (!creditsRow.auto_topup_payment_method_id) {
    return jsonResponse(409, {
      error: "No payment method on file",
      reason: "no_payment_method",
    }, event);
  }

  // Resolve pack: explicit body.pack_key wins, else fall back to the
  // user's saved auto_topup_pack_key from settings.
  if (!packKey) {
    packKey = (creditsRow.auto_topup_pack_key ?? undefined) as
      | TopUpPackKey
      | undefined;
  }
  if (!packKey || !(packKey in TOPUP_PACKS)) {
    return jsonResponse(400, { error: "Invalid or missing pack_key" }, event);
  }
  const pack = TOPUP_PACKS[packKey];

  if (pack.priceCents > creditsRow.auto_topup_monthly_cap_cents) {
    return jsonResponse(409, {
      error: "Pack exceeds monthly cap",
      reason: "pack_exceeds_cap",
    }, event);
  }

  const { data: mtdRows } = await supabaseAdmin.rpc("mtd_auto_topup_cents", {
    p_user_id: userId,
  });
  const mtdCents =
    (mtdRows as { mtd_cents: number }[] | null)?.[0]?.mtd_cents ?? 0;

  if (mtdCents + pack.priceCents > creditsRow.auto_topup_monthly_cap_cents) {
    return jsonResponse(409, {
      error: "Monthly cap reached",
      reason: "cap_reached",
    }, event);
  }

  // Resolve Stripe customer (full_name used for the auto-topup email greeting;
  // profiles has no first_name column — referencing it errors the entire
  // SELECT, which is why this used to spuriously return no_customer for
  // every caller until the column name was fixed).
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .single();
  const firstName = profile?.full_name?.split(" ")[0];

  const customerId = profile?.stripe_customer_id;
  if (!customerId) {
    return jsonResponse(409, {
      error: "No Stripe customer",
      reason: "no_customer",
    }, event);
  }

  // Off-session PaymentIntent with idempotency
  const idempotencyKey = buildIdempotencyKey(userId, packKey, new Date());

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: pack.priceCents,
        currency: "usd",
        customer: customerId,
        payment_method: creditsRow.auto_topup_payment_method_id,
        confirm: true,
        off_session: true,
        metadata: {
          pack_key: packKey,
          type: "auto_topup",
          user_id: userId,
        },
      },
      { idempotencyKey }
    );

    if (pi.status === "succeeded") {
      await allocateTopUpCredits(userId, pack.credits, pack.name, pi.id, {
        autoTopup: true,
        priceCents: pack.priceCents,
      });
      return jsonResponse(
        200,
        {
          ok: true,
          credits_added: pack.credits,
          payment_intent_id: pi.id,
        },
        event
      );
    }

    if (pi.status === "requires_action") {
      await disableAutoTopUp(userId, "requires_authentication");
      await maybeSendEmail(
        { id: userId, email: userEmail },
        firstName,
        "auto_topup_requires_authentication",
        pack
      );
      return jsonResponse(409, {
        error: "requires_action",
        reason: "requires_authentication",
      }, event);
    }

    return jsonResponse(409, {
      error: `unexpected_pi_status:${pi.status}`,
    }, event);
  } catch (err: unknown) {
    const stripeErr = err as {
      code?: string;
      type?: string;
      decline_code?: string;
    };

    if (stripeErr?.code === "card_declined" || stripeErr?.decline_code) {
      await disableAutoTopUp(userId, "card_declined");
      await maybeSendEmail(
        { id: userId, email: userEmail },
        firstName,
        "auto_topup_card_declined",
        pack
      );
      return jsonResponse(409, {
        error: "card_declined",
        reason: "card_declined",
      }, event);
    }

    if (
      stripeErr?.code === "idempotency_key_in_use" ||
      stripeErr?.code === "idempotency_violation"
    ) {
      return jsonResponse(200, { ok: true, idempotent_replay: true }, event);
    }

    if (
      stripeErr?.type === "StripeConnectionError" ||
      stripeErr?.type === "StripeAPIError"
    ) {
      console.error("[auto-topup-charge] transient stripe error", err);
      return jsonResponse(503, { error: "stripe_transient" }, event);
    }

    console.error("[auto-topup-charge] unexpected error", err);
    return jsonResponse(500, { error: "internal" }, event);
  }
});

async function disableAutoTopUp(userId: string, reason: string): Promise<void> {
  await supabaseAdmin
    .from("user_credits")
    .update({
      auto_topup_enabled: false,
      auto_topup_disabled_reason: reason,
    })
    .eq("user_id", userId);
}

async function maybeSendEmail(
  user: { id: string; email: string },
  firstName: string | undefined,
  emailType:
    | "auto_topup_requires_authentication"
    | "auto_topup_card_declined",
  pack: { name: string; priceCents: number }
): Promise<void> {
  const ok = await shouldSendEmail(user.id, emailType);
  if (!ok) return;

  const data = {
    firstName,
    packName: pack.name,
    packPriceCents: pack.priceCents,
    creditsUrl: `${DASH_URL}/credits`,
  };

  const rendered =
    emailType === "auto_topup_requires_authentication"
      ? renderAutoTopUpRequiresAuthEmail(data)
      : renderAutoTopUpCardDeclinedEmail(data);

  await sendEmail({
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
