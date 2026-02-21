import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";
import { stripe, getOrCreateStripeCustomer } from "./utils/stripe";

type RequestBody = {
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
};

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const { user } = await requireAuth(event);

  let body: RequestBody;
  try {
    body = event.body ? (JSON.parse(event.body) as RequestBody) : {};
  } catch (error) {
    throw new HttpError(400, "Invalid JSON body", error instanceof Error ? error.message : undefined);
  }

  console.log("Updating profile", {
    userId: user.id,
    updates: Object.keys(body),
  });

  // Update Supabase user metadata (for first_name and last_name)
  if (body.firstName !== undefined || body.lastName !== undefined) {
    const metadata: Record<string, string> = {};
    if (body.firstName !== undefined) metadata.first_name = body.firstName;
    if (body.lastName !== undefined) metadata.last_name = body.lastName;

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: metadata,
    });

    if (authError) {
      console.error("Failed to update user metadata", authError);
      throw new HttpError(500, "Failed to update user metadata");
    }
  }

  // Update user_settings table (for company and phone)
  if (body.company !== undefined || body.phone !== undefined) {
    const updates: Record<string, string | null> = {};
    if (body.company !== undefined) updates.company = body.company || null;
    if (body.phone !== undefined) updates.phone = body.phone || null;

    const { error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .upsert({
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (settingsError) {
      console.error("Failed to update user_settings", settingsError);
      throw new HttpError(500, "Failed to update user settings");
    }
  }

  // Sync to Stripe customer (best-effort, don't fail the request)
  try {
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email ?? "",
      [body.firstName, body.lastName].filter(Boolean).join(" ") || undefined
    );

    const stripeUpdates: Record<string, string | undefined> = {};
    const name = [body.firstName, body.lastName].filter(Boolean).join(" ");
    if (name) stripeUpdates.name = name;
    if (body.phone !== undefined) stripeUpdates.phone = body.phone || undefined;

    if (Object.keys(stripeUpdates).length > 0) {
      await stripe.customers.update(customerId, stripeUpdates);
    }
  } catch (error) {
    console.error("Failed to sync to Stripe", error);
    // Don't throw - profile update was successful, Stripe sync is secondary
  }

  return jsonResponse(200, {
    success: true,
    message: "Profile updated successfully",
    profile: {
      firstName: body.firstName,
      lastName: body.lastName,
      company: body.company,
      phone: body.phone,
    },
  });
});
