import { schedule } from "@netlify/functions";
import { supabaseAdmin } from "./utils/supabase-admin";

/**
 * Scheduled function that runs daily at 2:00 AM UTC to clean up trial user data.
 *
 * Deletes generated data for users whose trial ended 30+ days ago and status=canceled.
 * This enforces the ACCS-03 requirement: 30-day data retention after trial expiry.
 *
 * Data cleanup scope:
 * - keywords app: keyword_reports (cascade to keywords, kd_serp_results)
 * - labs app: llm_mention_history, llm_tracked_keywords (NOT llm_business_profiles)
 * - Credits: user_credits, credit_transactions
 *
 * Active subscribers who previously trialed are NOT affected (only status=canceled).
 */
const handler = schedule("0 2 * * *", async () => {
  console.log("[trial-data-cleanup] Starting scheduled cleanup run");

  try {
    // Calculate cutoff date: 30 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    console.log(`[trial-data-cleanup] Cutoff date: ${cutoffDate.toISOString()}`);

    // Query for expired trials (trial_end set, ended 30+ days ago, status=canceled)
    const { data: expiredTrials, error: queryError } = await supabaseAdmin
      .from("app_subscriptions")
      .select("user_id, app_key")
      .not("trial_end", "is", null)
      .lt("trial_end", cutoffDate.toISOString())
      .eq("status", "canceled")
      .limit(50); // Process max 50 per run to stay within 30-second limit

    if (queryError) {
      console.error("[trial-data-cleanup] Query error:", queryError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Query failed", details: queryError.message }),
      };
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      console.log("[trial-data-cleanup] No expired trials found");
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "No expired trials to clean up" }),
      };
    }

    console.log(`[trial-data-cleanup] Found ${expiredTrials.length} expired trial(s)`);

    let cleanedCount = 0;
    let skippedCount = 0;

    // Process each expired trial
    for (const trial of expiredTrials) {
      const { user_id, app_key } = trial;

      // CRITICAL: Verify user doesn't have an active subscription for the same app
      const { data: activeSub, error: activeSubError } = await supabaseAdmin
        .from("app_subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .eq("app_key", app_key)
        .eq("status", "active")
        .maybeSingle();

      if (activeSubError) {
        console.error(`[trial-data-cleanup] Error checking active sub for user ${user_id} app ${app_key}:`, activeSubError);
        continue;
      }

      if (activeSub) {
        console.log(`[trial-data-cleanup] Skipping user ${user_id} app ${app_key} - has active subscription`);
        skippedCount++;
        continue;
      }

      // Delete generated data based on app_key
      try {
        if (app_key === "keywords") {
          // Delete keyword reports (cascade deletes keywords and kd_serp_results)
          const { error: deleteReportsError } = await supabaseAdmin
            .from("keyword_reports")
            .delete()
            .eq("user_id", user_id);

          if (deleteReportsError) {
            console.error(`[trial-data-cleanup] Error deleting keyword_reports for user ${user_id}:`, deleteReportsError);
            continue;
          }

          console.log(`[trial-data-cleanup] Deleted keyword_reports for user ${user_id}`);

        } else if (app_key === "labs") {
          // Delete llm_mention_history
          const { error: deleteMentionsError } = await supabaseAdmin
            .from("llm_mention_history")
            .delete()
            .eq("user_id", user_id);

          if (deleteMentionsError) {
            console.error(`[trial-data-cleanup] Error deleting llm_mention_history for user ${user_id}:`, deleteMentionsError);
            continue;
          }

          // Delete llm_tracked_keywords (via business_profile_id lookup)
          // First get business profile IDs for this user
          const { data: profiles, error: profilesError } = await supabaseAdmin
            .from("llm_business_profiles")
            .select("id")
            .eq("user_id", user_id);

          if (profilesError) {
            console.error(`[trial-data-cleanup] Error fetching profiles for user ${user_id}:`, profilesError);
            continue;
          }

          if (profiles && profiles.length > 0) {
            const profileIds = profiles.map(p => p.id);
            const { error: deleteKeywordsError } = await supabaseAdmin
              .from("llm_tracked_keywords")
              .delete()
              .in("business_profile_id", profileIds);

            if (deleteKeywordsError) {
              console.error(`[trial-data-cleanup] Error deleting llm_tracked_keywords for user ${user_id}:`, deleteKeywordsError);
              continue;
            }
          }

          console.log(`[trial-data-cleanup] Deleted llm_mention_history and llm_tracked_keywords for user ${user_id}`);
        }

        // Clean up credit records
        const { error: deleteCreditsError } = await supabaseAdmin
          .from("user_credits")
          .delete()
          .eq("user_id", user_id)
          .eq("app_key", app_key);

        if (deleteCreditsError) {
          console.error(`[trial-data-cleanup] Error deleting user_credits for user ${user_id} app ${app_key}:`, deleteCreditsError);
        }

        const { error: deleteTransactionsError } = await supabaseAdmin
          .from("credit_transactions")
          .delete()
          .eq("user_id", user_id)
          .eq("app_key", app_key);

        if (deleteTransactionsError) {
          console.error(`[trial-data-cleanup] Error deleting credit_transactions for user ${user_id} app ${app_key}:`, deleteTransactionsError);
        }

        // Log data lifecycle event for compliance audit trail
        try {
          const tablesAffected = app_key === "keywords"
            ? ["keyword_reports", "user_credits", "credit_transactions"]
            : ["llm_mention_history", "llm_tracked_keywords", "user_credits", "credit_transactions"];

          await supabaseAdmin.from("data_lifecycle_events").insert({
            user_id,
            event_type: "trial_data_deleted",
            tables_affected: tablesAffected,
            records_affected: 0, // exact count not tracked per-table
          });
        } catch (lifecycleError) {
          console.error(`[trial-data-cleanup] Failed to log lifecycle event for user ${user_id}:`, lifecycleError);
          // Non-blocking
        }

        cleanedCount++;
        console.log(`[trial-data-cleanup] Successfully cleaned data for user ${user_id} app ${app_key}`);

      } catch (error) {
        console.error(`[trial-data-cleanup] Unexpected error cleaning user ${user_id} app ${app_key}:`, error);
        continue;
      }
    }

    console.log(`[trial-data-cleanup] Cleanup complete. Cleaned: ${cleanedCount}, Skipped: ${skippedCount}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Trial data cleanup completed",
        cleaned: cleanedCount,
        skipped: skippedCount,
        total: expiredTrials.length,
      }),
    };

  } catch (error) {
    console.error("[trial-data-cleanup] Unexpected error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Cleanup failed", details: String(error) }),
    };
  }
});

export { handler };
