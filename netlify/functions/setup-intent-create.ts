import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import { stripe, getOrCreateStripeCustomer } from "./utils/stripe";

interface ExistingPm {
  last4: string;
  brand: string;
}

/**
 * Returns true if the card is still valid at the current UTC date.
 */
const isCardActive = (expYear: number, expMonth: number): boolean => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-indexed

  if (expYear > currentYear) return true;
  if (expYear === currentYear && expMonth >= currentMonth) return true;
  return false;
};

/**
 * Resolve a usable PM ID for the user, in order of preference:
 *   1. The customer's `invoice_settings.default_payment_method` (Stripe-canonical default)
 *   2. The user's saved `user_credits.auto_topup_payment_method_id` (Wave 3 fallback —
 *      covers cases where settings-billing-update saved the PM but the customer's
 *      default was never mirrored, e.g. PMs saved before the mirror code shipped)
 *
 * Returns the PM ID or null if neither source has one.
 */
const resolveCandidatePmId = async (
  customerId: string,
  userId: string
): Promise<string | null> => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || (customer as { deleted?: boolean }).deleted) return null;

    const defaultPmId = (customer as { invoice_settings?: { default_payment_method?: unknown } })
      .invoice_settings?.default_payment_method;

    if (defaultPmId && typeof defaultPmId === "string") return defaultPmId;
  } catch {
    // Customer retrieve failed — fall through to DB fallback
  }

  const { data } = await supabaseAdmin
    .from("user_credits")
    .select("auto_topup_payment_method_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.auto_topup_payment_method_id ?? null;
};

/**
 * Try to resolve the customer's existing payment method (default OR saved auto-topup PM).
 * Returns { last4, brand } for a valid, non-expired card; null otherwise.
 * Never throws — all Stripe errors fall through to null.
 */
const resolveExistingPm = async (
  customerId: string,
  userId: string
): Promise<ExistingPm | null> => {
  try {
    const pmId = await resolveCandidatePmId(customerId, userId);
    if (!pmId) return null;

    const pm = await stripe.paymentMethods.retrieve(pmId);

    const card = (pm as { card?: { brand: string; last4: string; exp_year: number; exp_month: number } }).card;
    if (!card) return null;

    if (!isCardActive(card.exp_year, card.exp_month)) return null;

    return { last4: card.last4, brand: card.brand };
  } catch {
    // 404 (detached PM), deleted PM, network error — all treated as "no PM"
    return null;
  }
};

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
  }

  const { user } = await requireAuth(event);
  const email = user.email ?? "";

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  const existing_pm = await resolveExistingPm(customerId, user.id);

  // If we resolved an existing PM, attach it to the SetupIntent so
  // confirmCardSetup(clientSecret) on the client succeeds without re-prompting
  // for card entry. The fallback PM (from user_credits) won't be the customer's
  // default_payment_method until this confirms — settings-billing-update will
  // mirror it on save.
  let pmIdForIntent: string | undefined;
  if (existing_pm) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      const defaultPmId = (customer as { invoice_settings?: { default_payment_method?: unknown } })
        .invoice_settings?.default_payment_method;
      if (defaultPmId && typeof defaultPmId === "string") {
        pmIdForIntent = defaultPmId;
      } else {
        const { data } = await supabaseAdmin
          .from("user_credits")
          .select("auto_topup_payment_method_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.auto_topup_payment_method_id) pmIdForIntent = data.auto_topup_payment_method_id;
      }
    } catch {
      // fall through — SetupIntent without payment_method still works for new card entry
    }
  }

  const setupIntent = await stripe.setupIntents.create({
    usage: "off_session",
    customer: customerId,
    payment_method_types: ["card"],
    ...(pmIdForIntent ? { payment_method: pmIdForIntent } : {}),
  });

  return jsonResponse(
    200,
    { client_secret: setupIntent.client_secret, existing_pm },
    event,
  );
});
