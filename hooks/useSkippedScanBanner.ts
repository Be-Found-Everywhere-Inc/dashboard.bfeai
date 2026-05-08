"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dismissSkippedScanBanner } from "@/services/BillingService";

/**
 * Mutation hook for dismissing the "scheduled scan skipped" banner shown
 * on /credits. On success, invalidates the credits balance query so the
 * banner disappears (the dismiss timestamp now >= the skipped timestamp).
 *
 * The credits balance query key in this app is `["credits", userId]`
 * (see hooks/useCredits.ts), so we invalidate the prefix `["credits"]`
 * to catch all userIds without needing the current user reference here.
 */
export function useDismissSkippedScanBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dismissSkippedScanBanner,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}
