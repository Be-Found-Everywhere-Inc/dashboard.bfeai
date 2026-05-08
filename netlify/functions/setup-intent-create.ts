import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
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
 * Try to resolve the customer's existing default payment method.
 * Returns { last4, brand } for a valid, non-expired card; null otherwise.
 * Never throws — all Stripe errors fall through to null.
 */
const resolveExistingPm = async (customerId: string): Promise<ExistingPm | null> => {
  try {
    const customer = await stripe.customers.retrieve(customerId);

    // Deleted customers or customers without invoice_settings
    if (!customer || (customer as { deleted?: boolean }).deleted) return null;

    const defaultPmId = (customer as { invoice_settings?: { default_payment_method?: unknown } })
      .invoice_settings?.default_payment_method;

    if (!defaultPmId || typeof defaultPmId !== "string") return null;

    const pm = await stripe.paymentMethods.retrieve(defaultPmId);

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

  const existing_pm = await resolveExistingPm(customerId);

  const setupIntent = await stripe.setupIntents.create({
    usage: "off_session",
    customer: customerId,
    payment_method_types: ["card"],
  });

  return jsonResponse(
    200,
    { client_secret: setupIntent.client_secret, existing_pm },
    event,
  );
});
