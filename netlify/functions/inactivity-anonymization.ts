import { schedule } from "@netlify/functions";
import { supabaseAdmin } from "./utils/supabase-admin";

/**
 * Scheduled function that runs weekly (Sunday 1:00 AM UTC) to anonymize data
 * for users inactive for 90+ days with no active subscription.
 *
 * Anonymization preserves KPI data (costs, error codes, event types) but
 * NULLs out user_id and PII columns so records can't be linked to individuals.
 *
 * Processes max 50 users per run to stay within function timeout.
 */
const handler = schedule("0 1 * * 0", async () => {
  console.log("[inactivity-anonymization] Starting weekly anonymization run");

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffISO = cutoffDate.toISOString();
    console.log(`[inactivity-anonymization] Inactivity cutoff: ${cutoffISO}`);

    // Step 1: Find users with NO active/trialing subscription
    const { data: inactiveSubscribers, error: subError } = await supabaseAdmin
      .rpc("get_inactive_users_for_anonymization", {
        cutoff_date: cutoffISO,
        max_users: 50,
      });

    // If RPC doesn't exist, fall back to manual query approach
    let candidateUserIds: string[] = [];

    if (subError || !inactiveSubscribers) {
      console.log("[inactivity-anonymization] RPC not available, using fallback query");

      // Get all users who have NO active/trialing subscriptions
      const { data: allUsers, error: usersError } = await supabaseAdmin
        .from("api_costs")
        .select("user_id")
        .not("user_id", "is", null)
        .is("anonymized_at", null)
        .lt("created_at", cutoffISO)
        .limit(200);

      if (usersError) {
        console.error("[inactivity-anonymization] Failed to query api_costs:", usersError);
        return { statusCode: 500, body: JSON.stringify({ error: usersError.message }) };
      }

      // Deduplicate user IDs
      const uniqueUserIds = [...new Set((allUsers ?? []).map((r) => r.user_id as string))];

      // Filter out users with active subscriptions
      for (const userId of uniqueUserIds.slice(0, 50)) {
        const { data: activeSub } = await supabaseAdmin
          .from("app_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .in("status", ["active", "trialing"])
          .limit(1)
          .maybeSingle();

        if (activeSub) continue; // Has active subscription, skip

        // Check for recent activity (last login or API usage within 90 days)
        const { data: recentEvent } = await supabaseAdmin
          .from("security_events")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", cutoffISO)
          .limit(1)
          .maybeSingle();

        if (recentEvent) continue; // Recent activity, skip

        const { data: recentCost } = await supabaseAdmin
          .from("api_costs")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", cutoffISO)
          .limit(1)
          .maybeSingle();

        if (recentCost) continue; // Recent API usage, skip

        candidateUserIds.push(userId);
      }
    } else {
      candidateUserIds = (inactiveSubscribers as { user_id: string }[]).map((r) => r.user_id);
    }

    if (candidateUserIds.length === 0) {
      console.log("[inactivity-anonymization] No inactive users found for anonymization");
      return { statusCode: 200, body: JSON.stringify({ message: "No users to anonymize", anonymized: 0 }) };
    }

    console.log(`[inactivity-anonymization] Found ${candidateUserIds.length} inactive user(s) to anonymize`);

    let totalAnonymized = 0;

    for (const userId of candidateUserIds) {
      try {
        // Anonymize api_costs: NULL user_id, org_id; set anonymized_at
        const { error: costsErr } = await supabaseAdmin
          .from("api_costs")
          .update({ user_id: null, org_id: null, anonymized_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("anonymized_at", null);

        if (costsErr) console.warn(`[inactivity-anonymization] api_costs update error for ${userId}:`, costsErr);

        // Anonymize api_errors: NULL user_id, org_id; set anonymized_at
        const { error: errorsErr } = await supabaseAdmin
          .from("api_errors")
          .update({ user_id: null, org_id: null, anonymized_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("anonymized_at", null);

        if (errorsErr) console.warn(`[inactivity-anonymization] api_errors update error for ${userId}:`, errorsErr);

        // Anonymize security_events: NULL user_id, ip_address, user_agent; set anonymized_at
        const { error: eventsErr } = await supabaseAdmin
          .from("security_events")
          .update({
            user_id: null,
            ip_address: null,
            user_agent: null,
            anonymized_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .is("anonymized_at", null);

        if (eventsErr) console.warn(`[inactivity-anonymization] security_events update error for ${userId}:`, eventsErr);

        // Log lifecycle event
        await supabaseAdmin.from("data_lifecycle_events").insert({
          user_id: null, // anonymized
          event_type: "inactivity_anonymized",
          tables_affected: ["api_costs", "api_errors", "security_events"],
        });

        totalAnonymized++;
        console.log(`[inactivity-anonymization] Anonymized data for user ${userId}`);
      } catch (error) {
        console.error(`[inactivity-anonymization] Error anonymizing user ${userId}:`, error);
        // Continue with next user
      }
    }

    console.log(`[inactivity-anonymization] Complete. Anonymized data for ${totalAnonymized} user(s)`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Inactivity anonymization completed",
        anonymized: totalAnonymized,
        candidates: candidateUserIds.length,
      }),
    };
  } catch (error) {
    console.error("[inactivity-anonymization] Unexpected error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Anonymization failed", details: String(error) }),
    };
  }
});

export { handler };
