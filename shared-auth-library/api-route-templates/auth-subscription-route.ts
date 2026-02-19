// Template: GET /api/auth/subscription
// Co-founders: Copy this to your app at src/app/api/auth/subscription/route.ts
//
// Server-side endpoint that queries app_subscriptions directly from Supabase.
// Replaces client-side subscription fetching which failed because the
// bfeai_session cookie is httpOnly and not accessible via JavaScript.
//
// Returns { subscriptions: Record<string, Subscription> } matching the
// format expected by AuthProvider.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/bfeai-auth/server";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ subscriptions: {} });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rows, error } = await supabase
      .from("app_subscriptions")
      .select(
        "id, app_key, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end"
      )
      .eq("user_id", user.userId);

    if (error) {
      console.error("[/api/auth/subscription] Query error:", error);
      return NextResponse.json({ subscriptions: {} });
    }

    const subscriptions: Record<string, object> = {};

    for (const row of rows ?? []) {
      subscriptions[row.app_key] = {
        id: row.stripe_subscription_id || row.id,
        userId: user.userId,
        appName: row.app_key,
        status: mapStatus(row.status),
        planId: row.stripe_price_id || "",
        currentPeriodStart: row.current_period_start || "",
        currentPeriodEnd: row.current_period_end || "",
        cancelAtPeriodEnd: row.cancel_at_period_end || false,
      };
    }

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("[/api/auth/subscription] Error:", error);
    return NextResponse.json({ subscriptions: {} });
  }
}

function mapStatus(
  status: string
): "active" | "cancelled" | "expired" | "trialing" | "past_due" {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "paused":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return "expired";
    default:
      return "expired";
  }
}
