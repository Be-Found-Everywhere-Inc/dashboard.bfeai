import type { Handler } from "@netlify/functions";
import { withErrorHandling, jsonResponse } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import { TOPUP_PACKS } from "../../config/plans";
import { isAutoTopUpBetaUser } from "../../lib/feature-flags";

/** Smallest pack price in cents — cap must be >= this to make sense */
const MIN_CAP_CENTS = Math.min(
  ...Object.values(TOPUP_PACKS).map((p) => p.priceCents)
);

type BillingUpdateBody = {
  auto_topup_enabled?: boolean;
  auto_topup_pack_key?: string;
  auto_topup_monthly_cap_cents?: number;
  auto_topup_payment_method_id?: string;
};

export const handler: Handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "PATCH") {
    return jsonResponse(405, { error: "Method not allowed" }, event);
  }

  const { user } = await requireAuth(event);

  if (!isAutoTopUpBetaUser(user.id)) {
    return jsonResponse(
      403,
      { error: "Auto-topup not available for this account" },
      event
    );
  }

  const body = JSON.parse(event.body ?? "{}") as BillingUpdateBody;

  // ---------------------------------------------------------------------------
  // Build the update payload from provided fields only
  // ---------------------------------------------------------------------------
  const update: Record<string, unknown> = {};

  // Toggle handling — must happen before the "no fields" check so the
  // side-effect field (disabled_reason) is counted.
  if (body.auto_topup_enabled === true) {
    update.auto_topup_enabled = true;
    update.auto_topup_disabled_reason = null;
  } else if (body.auto_topup_enabled === false) {
    update.auto_topup_enabled = false;
    update.auto_topup_disabled_reason = "user_disabled";
  }

  // pack_key validation
  if (body.auto_topup_pack_key !== undefined) {
    if (!(body.auto_topup_pack_key in TOPUP_PACKS)) {
      return jsonResponse(
        400,
        { error: "Invalid auto_topup_pack_key" },
        event
      );
    }
    update.auto_topup_pack_key = body.auto_topup_pack_key;
  }

  // monthly cap validation
  if (body.auto_topup_monthly_cap_cents !== undefined) {
    if (body.auto_topup_monthly_cap_cents < MIN_CAP_CENTS) {
      return jsonResponse(
        400,
        {
          error: `auto_topup_monthly_cap_cents must be >= ${MIN_CAP_CENTS} (smallest pack price)`,
        },
        event
      );
    }
    update.auto_topup_monthly_cap_cents = body.auto_topup_monthly_cap_cents;
  }

  // payment method — accepted as-is (came from a successful SetupIntent)
  if (body.auto_topup_payment_method_id !== undefined) {
    update.auto_topup_payment_method_id = body.auto_topup_payment_method_id;
  }

  if (Object.keys(update).length === 0) {
    return jsonResponse(400, { error: "No fields to update" }, event);
  }

  // ---------------------------------------------------------------------------
  // Persist
  // ---------------------------------------------------------------------------
  const { error: dbError } = await supabaseAdmin
    .from("user_credits")
    .update(update)
    .eq("user_id", user.id);

  if (dbError) {
    return jsonResponse(500, { error: dbError.message }, event);
  }

  return jsonResponse(200, { ok: true }, event);
});
