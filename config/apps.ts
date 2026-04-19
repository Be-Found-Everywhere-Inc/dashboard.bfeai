/**
 * BFEAI App Catalog Configuration
 *
 * Defines all available apps in the BFEAI ecosystem.
 * Each app has its own standalone subscription.
 */

// Inlined here (rather than imported from @bfeai/ui) because this module is
// loaded by server-side / public routes (e.g. /try/[appKey]); importing the
// @bfeai/ui barrel pulls in client-only React Context code and breaks the
// production build. Sidebar consumers (client components) still use the
// canonical export from @bfeai/ui — keep these two definitions in sync.
const BETA_ELIGIBLE_TIERS = new Set(['beta_tester', 'founder', 'test_account']);
function hasOffpageBetaAccess(user?: { user_tier?: string | null } | null): boolean {
  if (!user || typeof user !== 'object') return false;
  const tier = user.user_tier;
  if (!tier) return false;
  return BETA_ELIGIBLE_TIERS.has(tier);
}

export type AppKey = 'keywords' | 'labs' | 'offpage';

export type AppStatus = 'active' | 'beta';

export interface AppConfig {
  key: AppKey;
  name: string;
  shortName: string;
  description: string;
  longDescription: string;
  icon: string;
  gradient: string;
  url: string;
  features: string[];
  pricing?: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  status: AppStatus;
  /**
   * If true, this app is only visible to users for whom the gate function
   * (applied in getActiveApps / isAppIncludedInPlan) returns true.
   */
  betaOnly?: boolean;
}

export const APP_CATALOG: Record<AppKey, AppConfig> = {
  keywords: {
    key: 'keywords',
    name: 'Keyword Agent',
    shortName: 'Keywords',
    description: 'AI-powered SEO keyword research and analysis',
    longDescription: 'Discover high-value keywords with advanced metrics like search volume, CPC, conversion rates, and our proprietary Best Keywords Score. Perfect for SEO professionals and content marketers.',
    icon: 'Search',
    gradient: 'from-brand-indigo to-brand-purple',
    url: 'https://keywords.bfeai.com',
    features: [
      'AI-powered keyword expansion',
      'Search volume & CPC data',
      'Keyword difficulty scoring',
      'Conversion rate predictions',
      'Competitor SERP analysis',
      'CSV export functionality',
    ],
    pricing: {
      monthly: 29,
      yearly: 290,
      currency: 'USD',
    },
    status: 'active',
  },
  labs: {
    key: 'labs',
    name: 'LABS',
    shortName: 'LABS',
    description: 'Track brand visibility across AI answer engines',
    longDescription: 'Monitor how AI surfaces your brand across ChatGPT, Gemini, Perplexity, Claude, Google AI Overview, and AI Mode. Get sentiment analysis, confidence scores, and actionable diagnosis for invisibility.',
    icon: 'FlaskConical',
    gradient: 'from-brand-teal to-brand-indigo',
    url: 'https://labs.bfeai.com',
    features: [
      '6 AI engine monitoring',
      'Brand mention detection & classification',
      'Sentiment & confidence scoring',
      'Invisibility diagnosis',
      'Competitor visibility tracking',
      'Scheduled scan automation',
    ],
    pricing: {
      monthly: 29,
      yearly: 290,
      currency: 'USD',
    },
    status: 'active',
  },
  offpage: {
    key: 'offpage',
    name: 'OffPage Agent',
    shortName: 'OffPage',
    description: 'Automated Google Sites creation for off-page SEO',
    longDescription: 'Automate Google Sites creation at scale targeting specific keywords and locations. Queue campaigns, monitor execution progress in real time, and manage connected Google accounts — all through browser automation.',
    icon: 'Globe',
    gradient: 'from-brand-teal to-brand-purple',
    url: 'https://offpage.bfeai.com',
    features: [
      'Automated Google Sites creation',
      'Campaign queue & execution',
      'Real-time progress monitoring',
      'Multi-account management',
      'Browser session automation',
      'Credit-based usage tracking',
    ],
    pricing: {
      monthly: 49,
      yearly: 490,
      currency: 'USD',
    },
    status: 'beta',
    betaOnly: true,
  },
};

export const APP_ORDER: AppKey[] = ['keywords', 'labs', 'offpage'];

/**
 * Filter apps based on user access.
 * Beta-only apps require the appropriate access gate.
 */
export const getActiveApps = (user?: { user_tier?: string | null } | null): AppConfig[] => {
  return APP_ORDER
    .map(key => APP_CATALOG[key])
    .filter(app => {
      if (!app.betaOnly) return true;
      if (app.key === 'offpage') return hasOffpageBetaAccess(user);
      return false;
    });
};

/** Returns the full catalog regardless of user access. Use for admin/internal views only. */
export const getAllApps = (): AppConfig[] => {
  return APP_ORDER.map(key => APP_CATALOG[key]);
};

export const getAppByKey = (key: AppKey): AppConfig | undefined => {
  return APP_CATALOG[key];
};

/**
 * Check if an app is included in the user's current plan.
 * - keywords/labs: standalone, always "included" (user just needs to subscribe).
 * - offpage: beta-only, included if user has beta access.
 */
export const isAppIncludedInPlan = (
  appKey: AppKey,
  _planId?: string | null,
  user?: { user_tier?: string | null } | null,
): boolean => {
  if (appKey === 'keywords' || appKey === 'labs') return true;
  if (appKey === 'offpage') return hasOffpageBetaAccess(user);
  return false;
};
