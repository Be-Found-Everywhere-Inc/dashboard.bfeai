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

    // Top-up purchase
    purchaseTopUp: async (packKey: string) => {
      const { url } = await topUpMutation.mutateAsync(packKey);
      return url;
    },
    topUpLoading: topUpMutation.isPending,

    // Utilities
    invalidate,
    refetch: balanceQuery.refetch,
  };
};
