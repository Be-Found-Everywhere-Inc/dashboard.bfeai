'use client';

import { AnalyticsPixels } from './AnalyticsPixels';
import { ConsentBanner } from './ConsentBanner';

/**
 * Mounts the consent banner and (if consent given) all configured ad/analytics
 * pixels on EVERY route — public AND auth-walled dashboard pages.
 *
 * Earlier versions excluded `(dashboard)` paths to "avoid wasting ad budget on
 * logged-in traffic," but that broke conversion attribution because the
 * post-signup landing (`/`), the trial CTA (`/apps`), and Stripe-return URLs
 * (`/?checkout=trial-success`, `/?checkout=cancelled`) all live on auth-walled
 * routes. Pixels must be loaded on those pages for `trackSignup`,
 * `trackBeginCheckout`, and `trackSubscribe` events to actually reach the
 * configured networks.
 *
 * If you want to suppress automatic Meta/TikTok PageView fires on dashboard
 * pages (to keep retargeting audiences clean), do it in the GTM dashboard via
 * a trigger condition on `Page Path` — that's GTM's job, not this component's.
 *
 * Name preserved for layout import stability.
 */
export function PublicAnalytics() {
  return (
    <>
      <AnalyticsPixels />
      <ConsentBanner />
    </>
  );
}
