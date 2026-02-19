// Subscription check utilities
// Co-founders: Copy this file to your app's lib/bfeai-auth/subscriptionCheck.ts
//
// IMPORTANT: The async functions (fetchUserSubscriptions, fetchAppSubscription,
// hasActiveSubscription) are DEPRECATED. They try to read the bfeai_session
// cookie via js-cookie, but the cookie is httpOnly and cannot be read by
// client-side JavaScript.
//
// Instead, use the server-side /api/auth/subscription endpoint.
// See api-route-templates/auth-subscription-route.ts for the template.
//
// The synchronous helpers (isSubscriptionActive, isSubscriptionExpiringSoon)
// are still useful for checking cached subscription data from AuthProvider.

import type { Subscription } from "./types";

/**
 * @deprecated Use /api/auth/subscription endpoint instead.
 * This function cannot read the httpOnly bfeai_session cookie.
 */
export async function fetchUserSubscriptions(): Promise<
  Record<string, Subscription>
> {
  console.warn(
    "[DEPRECATED] fetchUserSubscriptions cannot read httpOnly cookies. " +
      "Use /api/auth/subscription endpoint instead."
  );
  return {};
}

/**
 * @deprecated Use /api/auth/subscription endpoint instead.
 * This function cannot read the httpOnly bfeai_session cookie.
 */
export async function fetchAppSubscription(
  _appName?: string
): Promise<Subscription | null> {
  console.warn(
    "[DEPRECATED] fetchAppSubscription cannot read httpOnly cookies. " +
      "Use /api/auth/subscription endpoint instead."
  );
  return null;
}

/**
 * @deprecated Use /api/auth/subscription endpoint instead.
 * This function cannot read the httpOnly bfeai_session cookie.
 */
export async function hasActiveSubscription(
  _appName?: string
): Promise<boolean> {
  console.warn(
    "[DEPRECATED] hasActiveSubscription cannot read httpOnly cookies. " +
      "Use /api/auth/subscription endpoint instead."
  );
  return false;
}

/**
 * Check subscription status synchronously from cached data.
 * Use this with data from AuthProvider's subscription state.
 */
export function isSubscriptionActive(
  subscription: Subscription | null
): boolean {
  if (!subscription) return false;
  return subscription.status === "active" || subscription.status === "trialing";
}

/**
 * Check if subscription is expiring soon (within 7 days).
 * Use this with data from AuthProvider's subscription state.
 */
export function isSubscriptionExpiringSoon(
  subscription: Subscription | null
): boolean {
  if (!subscription) return false;

  const endDate = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const daysUntilExpiry =
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
}
