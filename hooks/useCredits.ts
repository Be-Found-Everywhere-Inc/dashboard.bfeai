import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/bfeai-auth";
import {
  BillingService,
  type CreditBalance,
  type CreditHistoryResponse,
} from "@/services/BillingService";

const balanceKey = (userId: string | undefined) =>
  ["credits", userId] as const;

const historyKey = (userId: string | undefined, limit: number, offset: number) =>
  ["credits-history", userId, limit, offset] as const;

/**
 * Hook for managing credits: balance, transaction history, and top-up purchases.
 */
export const useCredits = (historyLimit = 50, historyOffset = 0) => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const balanceQuery = useQuery<CreditBalance>({
    queryKey: balanceKey(userId),
    enabled: Boolean(userId),
    queryFn: BillingService.getCredits,
  });

  const historyQuery = useQuery<CreditHistoryResponse>({
    queryKey: historyKey(userId, historyLimit, historyOffset),
    enabled: Boolean(userId),
    queryFn: () => BillingService.getCreditHistory(historyLimit, historyOffset),
  });

  const topUpMutation = useMutation({
    mutationFn: (packKey: string) => BillingService.purchaseTopUp(packKey),
  });

  const invalidate = () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ["credits", userId] });
    queryClient.invalidateQueries({
      queryKey: ["credits-history", userId],
    });
    // Also refresh subscription query (it includes credits snapshot)
    queryClient.invalidateQueries({ queryKey: ["subscription", userId] });
  };

  return {
    // Balance
    balance: balanceQuery.data ?? null,
    balanceLoading: balanceQuery.isLoading,

    // History
    transactions: historyQuery.data?.transactions ?? [],
    totalTransactions: historyQuery.data?.total ?? 0,
    historyLoading: historyQuery.isLoading,

    /**
     * Purchase a top-up pack. Returns the full TopUpPurchaseResult so the
     * caller can decide between redirecting to Checkout (`url`) or surfacing
     * the off-session success (`ok: true`) — see services/BillingService.ts
     * `TopUpPurchaseResult`.
     */
    purchaseTopUp: async (packKey: string) => {
      const result = await topUpMutation.mutateAsync(packKey);
      // Off-session success — refresh balance immediately so callers see new total
      if ("ok" in result && result.ok) invalidate();
      return result;
    },
    topUpLoading: topUpMutation.isPending,

    // Utilities
    invalidate,
    refetch: balanceQuery.refetch,
  };
};
