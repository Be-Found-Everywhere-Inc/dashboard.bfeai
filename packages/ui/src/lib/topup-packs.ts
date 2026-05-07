/**
 * Stable re-export of TOPUP_PACKS for consumer apps. The source of truth is
 * Apps/dashboard.bfeai/config/plans.ts. We duplicate the literal here because
 * consumer apps cannot reach into dashboard's config/. Section D5 copies this
 * file verbatim into each consumer app's vendored packages/ui.
 *
 * Keep this in sync with config/plans.ts. Wave 3 may consolidate via a
 * shared subpath export, but for Wave 2 a literal duplicate is the simplest
 * cross-repo solution — TopUp pack data changes ~once a year.
 */

export interface TopUpPack {
  key: "starter" | "builder" | "power" | "pro" | "max";
  name: string;
  credits: number;
  priceCents: number;
  priceId?: string;
  badge?: "best_value" | null;
}

export const TOPUP_PACKS: TopUpPack[] = [
  { key: "starter", name: "Starter Boost", credits: 75, priceCents: 900, badge: null },
  { key: "builder", name: "Builder Pack", credits: 270, priceCents: 2900, badge: null },
  { key: "power", name: "Power Pack", credits: 980, priceCents: 9900, badge: "best_value" },
  { key: "pro", name: "Pro Pack", credits: 2500, priceCents: 24900, badge: null },
  { key: "max", name: "Max Pack", credits: 5250, priceCents: 49900, badge: null },
];

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
