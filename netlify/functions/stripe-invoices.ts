import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth } from "./utils/supabase-admin";
import { getOrCreateStripeCustomer, getInvoices } from "./utils/stripe";

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
  const invoices = await getInvoices(customerId, 50);

  return jsonResponse(200, {
    invoices: invoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      total: (inv.amount_paid ?? 0) / 100,
      currency: inv.currency,
      date: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      description: inv.description ?? null,
      invoiceUrl: inv.hosted_invoice_url ?? null,
      pdfUrl: inv.invoice_pdf ?? null,
    })),
  });
});
