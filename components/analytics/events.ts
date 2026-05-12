'use client';

/**
 * Type-safe `window.dataLayer` push helpers for analytics events.
 *
 * Pushes happen unconditionally — gating by consent is handled by whether the
 * pixel scripts themselves are loaded. If consent === 'rejected' the pixels
 * never load, so the dataLayer pushes become inert (no-op).
 *
 * Event naming follows the GA4 / Meta hybrid convention used across BFEAI:
 *   - `sign_up`  — GA4 standard recommended event for completed registration
 *   - `Lead`     — Meta standard event for any qualified-interest signal
 *   - `start_trial` — GA4 + Meta `StartTrial` analog
 *   - `purchase` — GA4 / Meta standard for paid conversion (fired server-side
 *                  too via Stripe webhook → Conversions API in Phase B.3)
 */

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

type SignupEventArgs = {
  method: 'email' | 'google' | 'github';
  userId?: string;
};

type BeginCheckoutArgs = {
  plan: 'lite' | 'plus' | 'max';
  isTrial: boolean;
};

type SubscribeArgs = {
  isTrial: boolean;
};

function push(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
}

export function trackSignup(args: SignupEventArgs): void {
  push({
    event: 'sign_up',
    method: args.method,
    user_id: args.userId,
  });
  // Meta-style alias so a single GTM Lead trigger can fan out without
  // additional mapping rules.
  push({
    event: 'Lead',
    method: args.method,
    user_id: args.userId,
  });
}

/**
 * Fire when the user clicks "Start trial" or "Subscribe" — i.e. they've
 * committed to the checkout but haven't completed payment yet. Pair with
 * `trackSubscribe` on the Stripe success return to compute funnel drop.
 */
export function trackBeginCheckout(args: BeginCheckoutArgs): void {
  push({
    event: 'begin_checkout',
    plan: args.plan,
    is_trial: args.isTrial,
  });
  // Meta-style alias.
  push({
    event: 'InitiateCheckout',
    plan: args.plan,
    is_trial: args.isTrial,
  });
}

/**
 * Fire on the Stripe success-return landing (`?checkout=success` or
 * `?checkout=trial-success`). This is the conversion. The server-side
 * Conversions API in Phase B.3 will dedupe against this client-side event
 * via the Stripe session ID — once that lands.
 */
export function trackSubscribe(args: SubscribeArgs): void {
  push({
    event: args.isTrial ? 'start_trial' : 'subscribe',
    is_trial: args.isTrial,
  });
  // GA4 `purchase` standard + Meta `Subscribe` standard.
  push({
    event: 'purchase',
    is_trial: args.isTrial,
  });
  push({
    event: 'Subscribe',
    is_trial: args.isTrial,
  });
}

/**
 * Fire when the user lands back on the dashboard with `?checkout=cancelled`.
 * Combine with the absence of a paired `trackSubscribe` after a
 * `trackBeginCheckout` to identify abandoned-checkout sessions in GA4 / Meta
 * funnel reports.
 */
export function trackCancelCheckout(): void {
  push({ event: 'cancel_checkout' });
}

export function trackPageView(path: string): void {
  push({
    event: 'page_view',
    page_path: path,
  });
}
