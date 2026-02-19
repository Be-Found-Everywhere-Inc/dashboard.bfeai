'use client';

import { useState, useEffect } from 'react';

interface CreditBalance {
  subscriptionBalance: number;
  topupBalance: number;
  total: number;
  cap: number;
}

export function useCredits() {
  const [credits, setCredits] = useState<CreditBalance | null>(null);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/credits', { credentials: 'include' });
        if (response.ok) {
          const json = await response.json();
          setCredits(json.data);
        }
      } catch {
        // Silently fail — credits are non-critical sidebar info
      }
    }
    fetchCredits();
  }, []);

  return credits;
}
