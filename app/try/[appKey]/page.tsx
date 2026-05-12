import { redirect } from "next/navigation";

/**
 * Legacy per-app trial landing.
 *
 * The unified Lite/Plus/Max model replaces per-app subscriptions, so any paid-ad
 * traffic that still points at `/try/keywords`, `/try/labs`, `/try/offpage`, etc.
 * is funneled into the universal $1 Lite trial deep link on `/apps`. The dynamic
 * `[appKey]` segment is intentionally ignored — keeping the URL pattern alive
 * means existing campaign URLs do not 404 while the marketing surface migrates.
 */
export default function LegacyTryAppRedirect() {
  redirect("/apps?trial=true");
}
