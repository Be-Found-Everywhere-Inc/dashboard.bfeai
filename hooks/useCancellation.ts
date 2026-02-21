import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/bfeai-auth";
import {
  BillingService,
  type CancelResponse,
  type CancelOfferResponse,
} from "@/services/BillingService";

export type CancellationStep = "reason" | "offer" | "confirm" | "success";

export type RetentionOffer = {
  offerId: string;
  offerType: string;
  offerDetails: Record<string, unknown>;
};

/**
 * Hook for managing the 4-step cancellation flow with retention offers.
 *
 * Flow:
 *  1. reason  – User selects reason + feedback → sends to API
 *  2. offer   – API may return a retention offer (skipped for "other" or if used before)
 *  3. confirm – User confirms cancellation (after declining offer, or no offer available)
 *  4. success – Cancellation confirmed
 */
export const useCancellation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CancellationStep>("reason");
  const [offer, setOffer] = useState<RetentionOffer | null>(null);
  const [offerMessage, setOfferMessage] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const invalidateBilling = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["credits"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }, [queryClient]);

  // Step 1: Submit reason + feedback. May return an offer or go straight to cancelled.
  const submitReasonMutation = useMutation({
    mutationFn: (data: { reason: string; feedback?: string }) =>
      BillingService.cancelSubscription(data),
    onSuccess: (response: CancelResponse) => {
      if (response.action === "offer") {
        const offerResp = response as CancelOfferResponse;
        setOffer({
          offerId: offerResp.offerId,
          offerType: offerResp.offerType,
          offerDetails: offerResp.offerDetails,
        });
        setStep("offer");
      } else if (response.action === "cancelled") {
        setCancelMessage(response.message);
        invalidateBilling();
        setStep("success");
      }
    },
  });

  // Step 2a: Accept the retention offer.
  const acceptOfferMutation = useMutation({
    mutationFn: (data: { reason: string; feedback?: string }) =>
      BillingService.cancelSubscription({
        ...data,
        acceptOffer: true,
        offerType: offer?.offerType,
      }),
    onSuccess: (response: CancelResponse) => {
      if (response.action === "offer_accepted") {
        setOfferMessage(response.message);
        invalidateBilling();
        setStep("success");
      }
    },
  });

  // Step 2b: Decline the offer → proceed to confirm step.
  const declineOffer = useCallback(() => {
    setStep("confirm");
  }, []);

  // Step 3: Confirm cancellation (after declining offer or no offer).
  const confirmCancelMutation = useMutation({
    mutationFn: (data: { reason: string; feedback?: string }) =>
      BillingService.cancelSubscription({
        ...data,
        acceptOffer: false,
      }),
    onSuccess: (response: CancelResponse) => {
      if (response.action === "cancelled") {
        setCancelMessage(response.message);
        invalidateBilling();
        setStep("success");
      }
    },
  });

  const reset = useCallback(() => {
    setStep("reason");
    setOffer(null);
    setOfferMessage(null);
    setCancelMessage(null);
  }, []);

  return {
    step,
    setStep,
    offer,
    offerMessage,
    cancelMessage,
    isAuthenticated: Boolean(user?.id),

    // Step 1
    submitReason: submitReasonMutation.mutateAsync,
    submitReasonLoading: submitReasonMutation.isPending,

    // Step 2
    acceptOffer: acceptOfferMutation.mutateAsync,
    acceptOfferLoading: acceptOfferMutation.isPending,
    declineOffer,

    // Step 3
    confirmCancel: confirmCancelMutation.mutateAsync,
    confirmCancelLoading: confirmCancelMutation.isPending,

    // Any step loading
    isLoading:
      submitReasonMutation.isPending ||
      acceptOfferMutation.isPending ||
      confirmCancelMutation.isPending,

    error:
      submitReasonMutation.error ??
      acceptOfferMutation.error ??
      confirmCancelMutation.error,

    reset,
  };
};
