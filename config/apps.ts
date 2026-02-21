/**
 * BFEAI App Catalog Configuration
 *
 * Defines all available apps in the BFEAI ecosystem.
 * Each app has its own standalone subscription.
 */

export type AppKey = 'keywords' | 'labs';

export type AppStatus = 'active';

export interface AppConfig {
  key: AppKey;
  name: string;
  shortName: string;
  description: string;
  longDescription: string;
  icon: string; // Lucide icon name
  gradient: string;
  url: string;
  features: string[];
  pricing?: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  status: AppStatus;
}

export const APP_CATALOG: Record<AppKey, AppConfig> = {
  keywords: {
    key: 'keywords',
    name: 'Keywords Discovery Tool',
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
    icon: 'Eye',
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
};

export const APP_ORDER: AppKey[] = ['keywords', 'labs'];

export const getActiveApps = (): AppConfig[] => {
  return APP_ORDER.map(key => APP_CATALOG[key]);
};

export const getAllApps = (): AppConfig[] => {
  return APP_ORDER.map(key => APP_CATALOG[key]);
};

export const getAppByKey = (key: AppKey): AppConfig | undefined => {
  return APP_CATALOG[key];
};

/**
 * Check if an app is included in the user's current plan
 * Both apps are standalone with their own subscriptions
 */
export const isAppIncludedInPlan = (appKey: AppKey, _planId?: string | null): boolean => {
  return appKey === 'keywords' || appKey === 'labs';
};
