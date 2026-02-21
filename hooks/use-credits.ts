'use client';

import { useCredits as useCreditsQuery } from './useCredits';

interface CreditBalance {
  subscriptionBalance: number;
  topupBalance: number;
  total: number;
  cap: number;
}

/**
 * Compatibility shim: returns CreditBalance | null matching the old API
 * so existing DashboardShell code continues to work.
 */
export function useCredits(): CreditBalance | null {
  const { balance } = useCreditsQuery();
  if (!balance) return null;
  return {
    subscriptionBalance: balance.subscriptionBalance,
    topupBalance: balance.topupBalance,
    total: balance.total,
    cap: balance.cap,
  };
}
