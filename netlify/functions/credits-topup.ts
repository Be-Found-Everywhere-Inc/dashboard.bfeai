import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import { stripe, getOrCreateStripeCustomer, createTopUpCheckoutSession } from "./utils/stripe";
import { allocateTopUpCredits, getBalance } from "./utils/credits";
import { TOPUP_PACKS, type TopUpPackKey } from "../../config/plans";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://dashboard.bfeai.com";
const SUCCESS_URL = `${DASHBOARD_URL}/credits?topup=success`;
const CANCEL_URL = `${DASHBOARD_URL}/credits?topup=cancelled`;

/**
 * Quick-charge idempotency key: per-user, per-pack, per-minute. Prevents
 * double-clicks within a short window from creating two PaymentIntents
 * (which would deduct twice). Stripe holds idempotency keys for 24h.
 */
function buildQuickChargeKey(userId: string, packKey: string, when: Date): string {
  const yyyy = when.getUTCFullYear();
  const mm = String(when.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(when.getUTCDate()).padStart(2, "0");
  const hh = String(when.getUTCHours()).padStart(2, "0");
  const mi = String(when.getUTCMinutes()).padStart(2, "0");
  return `topup-quick:${userId}:${packKey}:${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
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

  const pack = TOPUP_PACKS[body.packKey as TopUpPackKey];
  if (!pack) {
    throw new HttpError(
      400,
      `Unknown pack: ${body.packKey}. Valid packs: ${Object.keys(TOPUP_PACKS).join(", ")}`
    );
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  // ---------------------------------------------------------------------------
  // Quick-charge path: if the user has a saved PM, attempt an off-session
  // PaymentIntent and skip the Stripe Checkout redirect entirely. Falls back to
  // Checkout on any failure (3DS, decline, network) so the user always has a
  // way to complete the purchase.
  // ---------------------------------------------------------------------------
  const { data: creditsRow } = await supabaseAdmin
    .from("user_credits")
    .select("auto_topup_payment_method_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const savedPmId = creditsRow?.auto_topup_payment_method_id ?? null;

  if (savedPmId) {
    try {
      const idempotencyKey = buildQuickChargeKey(user.id, body.packKey, new Date());
      const pi = await stripe.paymentIntents.create(
        {
          amount: pack.priceCents,
          currency: "usd",
          customer: customerId,
          payment_method: savedPmId,
          confirm: true,
          off_session: true,
          metadata: {
            type: "topup_quick",
            pack_key: body.packKey,
            user_id: user.id,
            credits: String(pack.credits),
          },
        },
        { idempotencyKey }
      );

      if (pi.status === "succeeded") {
        await allocateTopUpCredits(user.id, pack.credits, pack.name, pi.id, {
          autoTopup: false,
          priceCents: pack.priceCents,
        });
        const balance = await getBalance(user.id);
        return jsonResponse(
          200,
          {
            ok: true,
            creditsAdded: pack.credits,
            balance: balance.total,
            packName: pack.name,
            paymentIntentId: pi.id,
          },
          event
        );
      }
      // requires_action / unexpected status — fall through to Checkout
      console.warn(
        `[credits-topup] Quick-charge PI ${pi.id} ended in unexpected status ${pi.status}, falling back to Checkout`
      );
    } catch (err: unknown) {
      const stripeErr = err as { code?: string; type?: string };
      if (stripeErr?.code === "idempotency_key_in_use" || stripeErr?.code === "idempotency_violation") {
        // Previous request won; balance should already be updated. Surface success.
        const balance = await getBalance(user.id);
        return jsonResponse(
          200,
          {
            ok: true,
            creditsAdded: pack.credits,
            balance: balance.total,
            packName: pack.name,
            idempotentReplay: true,
          },
          event
        );
      }
      // card_declined, requires_action (3DS), network — fall through to Checkout.
      console.warn(
        "[credits-topup] Quick-charge failed, falling back to Stripe Checkout:",
        err
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback: Stripe Checkout redirect (no saved PM, or quick-charge failed)
  // ---------------------------------------------------------------------------
  const session = await createTopUpCheckoutSession(
    customerId,
    pack.priceId,
    pack.credits,
    pack.name,
    SUCCESS_URL,
    CANCEL_URL
  );

  return jsonResponse(200, { url: session.url }, event);
});
