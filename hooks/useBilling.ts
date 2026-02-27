import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/bfeai-auth";
import {
  BillingService,
  type SubscriptionResponse,
  type BillingInvoice,
} from "@/services/BillingService";

const subscriptionKey = (userId: string | undefined) =>
  ["subscription", userId] as const;

const invoicesKey = (userId: string | undefined) =>
  ["invoices", userId] as const;

/**
 * Hook for managing billing operations (Stripe-backed).
 * Provides subscription status, invoices, checkout, portal, and credits snapshot.
 */
export const useBilling = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Combined query: subscription + credits + recent invoices
  const subscriptionQuery = useQuery<SubscriptionResponse>({
    queryKey: subscriptionKey(userId),
    enabled: Boolean(userId),
    queryFn: BillingService.getSubscription,
  });

  // Full invoice history (separate query for the billing page)
  const invoicesQuery = useQuery<{ invoices: BillingInvoice[] }>({
    queryKey: invoicesKey(userId),
    enabled: Boolean(userId),
    queryFn: BillingService.getInvoices,
  });

  const invalidate = () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: subscriptionKey(userId) });
    queryClient.invalidateQueries({ queryKey: invoicesKey(userId) });
    queryClient.invalidateQueries({ queryKey: ["credits", userId] });
  };

  const portalSessionMutation = useMutation({
    mutationFn: (returnUrl?: string) =>
      BillingService.createPortalSession(returnUrl),
  });

  const checkoutMutation = useMutation({
    mutationFn: (appKey?: string) => BillingService.createCheckout(appKey),
    onSuccess: invalidate,
  });

  const trialCheckoutMutation = useMutation({
    mutationFn: (appKey: string) => BillingService.createTrialCheckout(appKey),
    onSuccess: invalidate,
  });

  const dualTrialCheckoutMutation = useMutation({
    mutationFn: () => BillingService.createDualTrialCheckout(),
    onSuccess: invalidate,
  });

  const subscriptions = subscriptionQuery.data?.subscriptions ?? [];

  const getSubscription = (appKey: string) =>
    subscriptions.find((s) => s.appKey === appKey) ?? null;

  return {
    // Subscription data (multi-app)
    subscriptions,
    getSubscription,
    customerId: subscriptionQuery.data?.customerId ?? null,
    credits: subscriptionQuery.data?.credits ?? null,
    recentInvoices: subscriptionQuery.data?.recentInvoices ?? [],

    // Full invoice list
    allInvoices: invoicesQuery.data?.invoices ?? [],
    invoicesLoading: invoicesQuery.isLoading,

    // Loading / error
    isLoading: subscriptionQuery.isLoading,
    isError: subscriptionQuery.isError,
    refetch: subscriptionQuery.refetch,
    invalidate,

    // Stripe Customer Portal
    createPortalSession: async (returnUrl?: string) => {
      const { url } = await portalSessionMutation.mutateAsync(returnUrl);
      return url;
    },
    portalSessionLoading: portalSessionMutation.isPending,

    // Checkout (subscribe to an app)
    createCheckout: async (appKey?: string) => {
      const { url } = await checkoutMutation.mutateAsync(appKey);
      return url;
    },
    checkoutLoading: checkoutMutation.isPending,

    // Trial checkout ($1/7-day trial)
    createTrialCheckout: async (appKey: string) => {
      const { url } = await trialCheckoutMutation.mutateAsync(appKey);
      return url;
    },
    trialCheckoutLoading: trialCheckoutMutation.isPending,

    // Dual trial checkout ($2 bundle: Keywords + LABS)
    createDualTrialCheckout: async () => {
      const { url } = await dualTrialCheckoutMutation.mutateAsync();
      return url;
    },
    dualTrialCheckoutLoading: dualTrialCheckoutMutation.isPending,
  };
};
