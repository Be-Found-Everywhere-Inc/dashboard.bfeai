import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import {
  getOrCreateStripeCustomer,
  getActiveSubscriptions,
  syncAppSubscription,
  getInvoices,
} from "./utils/stripe";
import { getBalance } from "./utils/credits";
import type Stripe from "stripe";

type DbSubscription = {
  id: string;
  app_key: string;
  stripe_subscription_id: string;
  status: string;
  amount_cents: number | null;
  currency: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  paused_at: string | null;
  resume_at: string | null;
  stripe_price_id: string | null;
};

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);
  const email = user.email ?? "";

  if (!email) {
    throw new HttpError(400, "User email is required");
  }

  const customerId = await getOrCreateStripeCustomer(user.id, email);

  // Fetch Stripe subscriptions, invoices, credits, AND DB subscriptions in parallel
  const [stripeSubscriptions, recentInvoices, creditBalance, dbRows] =
    await Promise.all([
      getActiveSubscriptions(customerId),
      getInvoices(customerId, 5),
      getBalance(user.id),
      supabaseAdmin
        .from("app_subscriptions")
        .select(
          "id, app_key, stripe_subscription_id, status, amount_cents, currency, current_period_end, cancel_at_period_end, paused_at, resume_at, stripe_price_id"
        )
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due", "paused"])
        .then((r) => (r.data ?? []) as DbSubscription[]),
    ]);

  // Index Stripe subscriptions by ID for quick lookup
  const stripeSubMap = new Map(stripeSubscriptions.map((s) => [s.id, s]));

  // Sync Stripe-backed subscriptions to DB (use DB app_key if available)
  const dbSubIdMap = new Map(dbRows.map((r) => [r.stripe_subscription_id, r]));
  await Promise.all(
    stripeSubscriptions.map((sub) => {
      const dbRow = dbSubIdMap.get(sub.id);
      const appKey =
        dbRow?.app_key ?? sub.metadata?.app_key ?? "keywords";
      return syncAppSubscription(user.id, sub, appKey);
    })
  );

  // Build unified subscription list from DB (source of truth)
  // Enrich with live Stripe data when a real Stripe subscription exists
  const subscriptions = dbRows.map((dbRow) => {
    const stripeSub = stripeSubMap.get(dbRow.stripe_subscription_id);
    if (stripeSub) {
      return buildFromStripe(stripeSub, dbRow.app_key);
    }
    return buildFromDb(dbRow);
  });

  return jsonResponse(200, {
    customerId,
    subscriptions,
    recentInvoices: recentInvoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      total: (inv.amount_paid ?? 0) / 100,
      currency: inv.currency,
      date: inv.period_end
        ? new Date(inv.period_end * 1000).toISOString()
        : null,
      invoiceUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
    })),
    credits: creditBalance,
  });
});

/** Build subscription summary from live Stripe data. */
function buildFromStripe(subscription: Stripe.Subscription, appKey: string) {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const amount = (item?.price?.unit_amount ?? 0) / 100;
  const isPaused = subscription.pause_collection !== null;

  let periodEnd: string | null = null;
  if (
    subscription.latest_invoice &&
    typeof subscription.latest_invoice === "object"
  ) {
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    if (invoice.period_end) {
      periodEnd = new Date(invoice.period_end * 1000).toISOString();
    }
  }

  return {
    id: subscription.id,
    priceId,
    appKey,
    status: isPaused ? "paused" : subscription.status,
    currency: subscription.currency,
    amount,
    nextBillingDate: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    isPaused,
    resumeAt: subscription.pause_collection?.resumes_at
      ? new Date(
          subscription.pause_collection.resumes_at * 1000
        ).toISOString()
      : null,
    stripeManaged: true,
  };
}

/** Build subscription summary from DB-only record (no Stripe subscription). */
function buildFromDb(row: DbSubscription) {
  const isPaused = row.paused_at !== null;
  return {
    id: row.id,
    priceId: row.stripe_price_id,
    appKey: row.app_key,
    status: isPaused ? "paused" : row.status,
    currency: row.currency ?? "usd",
    amount: row.amount_cents ? row.amount_cents / 100 : 0,
    nextBillingDate: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    isPaused,
    resumeAt: row.resume_at,
    stripeManaged: false,
  };
}
