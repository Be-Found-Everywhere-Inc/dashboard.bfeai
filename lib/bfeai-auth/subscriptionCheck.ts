// Functions for checking subscription status

import { getSessionToken, getPaymentsApiUrl, getAppName } from './authHelpers';

import type { Subscription } from './types';

/**
 * Fetch all subscriptions for the current user
 */
export async function fetchUserSubscriptions(): Promise<Record<string, Subscription>> {
  const token = getSessionToken();

  if (!token) {
    throw new Error('No session token');
  }

  const response = await fetch(getPaymentsApiUrl('/subscriptions'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }

  const data = await response.json();
  return data.subscriptions || {};
}

/**
 * Fetch subscription for a specific app
 */
export async function fetchAppSubscription(appName?: string): Promise<Subscription | null> {
  const app = appName || getAppName();
  const token = getSessionToken();

  if (!token) {
    throw new Error('No session token');
  }

  const response = await fetch(getPaymentsApiUrl(`/subscriptions/check?app=${app}`), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // No subscription found
    }
    throw new Error('Failed to check subscription');
  }

  const data = await response.json();
  return data.subscription || null;
}

/**
 * Check if user has active subscription for an app
 */
export async function hasActiveSubscription(appName?: string): Promise<boolean> {
  try {
    const subscription = await fetchAppSubscription(appName);
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Check subscription status synchronously from cached data
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Check if subscription is expiring soon (within 7 days)
 */
export function isSubscriptionExpiringSoon(subscription: Subscription | null): boolean {
  if (!subscription) return false;

  const endDate = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const daysUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
}
