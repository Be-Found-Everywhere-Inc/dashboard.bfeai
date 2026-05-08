"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/dialog";
import { Button } from "../components/button";
import { TOPUP_PACKS, formatUsd, type TopUpPack } from "../lib/topup-packs";
import { useCredits } from "./CreditsProvider";
import { InlineCardForm } from "./InlineCardForm";

export interface OutOfCreditsModalProps {
  /**
   * Manage-credits link. Each consumer app passes its own dashboard URL
   * so this component is environment-agnostic.
   */
  manageCreditsUrl: string;
  /**
   * Called when user picks a pack. Consumer app is responsible for kicking
   * off Stripe Checkout (redirects via window.location after creating session).
   */
  onPurchase: (pack: TopUpPack) => void | Promise<void>;
  /** Stripe.js publishable key for InlineCardForm (auto-topup opt-in flow). */
  stripePublishableKey: string;
  /**
   * Called when user clicks "Set up auto top-up" — fetches SetupIntent
   * client_secret + existing_pm from the consumer app's backend.
   */
  onRequestSetupIntent: () => Promise<{
    client_secret: string;
    existing_pm: { last4: string; brand: string } | null;
  }>;
  /**
   * Called after auto-topup setup completes (BEFORE Stripe Checkout redirect).
   * Should PATCH settings-billing-update on dashboard.
   */
  onConfirmAutoTopUp: (params: {
    autoTopUpEnabled: true;
    autoTopUpPackKey: string;
    autoTopUpMonthlyCapCents: number;
    autoTopUpPaymentMethodId: string;
  }) => Promise<void>;
}

const disabledReasonCopy: Record<string, string> = {
  card_declined:
    "Auto top-up disabled — your card was declined. Update your card on the credits page to re-enable.",
  requires_authentication:
    "Auto top-up disabled — your card needs verification. Update your payment method to re-enable.",
  pack_archived:
    "Auto top-up disabled — your selected pack is no longer available. Pick a different pack on the credits page.",
  no_payment_method:
    "Auto top-up disabled — no payment method on file. Update on the credits page to re-enable.",
  user_disabled: "", // user manually disabled — no banner
};

export function OutOfCreditsModal({
  manageCreditsUrl,
  onPurchase,
  stripePublishableKey,
  onRequestSetupIntent,
  onConfirmAutoTopUp,
}: OutOfCreditsModalProps) {
  const { isOpen, context, autoTopup, closeOutOfCreditsModal } = useCredits();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-topup opt-in state
  const [autoEnable, setAutoEnable] = useState(false);
  const [capDollars, setCapDollars] = useState(200);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [existingPm, setExistingPm] = useState<{ last4: string; brand: string } | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);

  if (!context) return null;

  const { operation, required, balance } = context;

  const disabledReason = autoTopup?.disabledReason ?? null;
  const showDisabledBanner =
    disabledReason !== null &&
    disabledReason !== "user_disabled" &&
    Boolean(disabledReasonCopy[disabledReason]);

  const handleStartAutoSetup = async () => {
    try {
      const { client_secret, existing_pm } = await onRequestSetupIntent();
      setSetupIntentClientSecret(client_secret);
      setExistingPm(existing_pm);
    } catch (err) {
      console.error("[modal] setup-intent-create failed", err);
    }
  };

  const handlePick = async (pack: TopUpPack) => {
    setError(null);
    setPendingKey(pack.key);
    try {
      if (autoEnable && paymentMethodId) {
        // Save auto-topup config FIRST (before Stripe Checkout redirect)
        await onConfirmAutoTopUp({
          autoTopUpEnabled: true,
          autoTopUpPackKey: pack.key,
          autoTopUpMonthlyCapCents: capDollars * 100,
          autoTopUpPaymentMethodId: paymentMethodId,
        });
      }
      await onPurchase(pack);
    } catch (err) {
      console.error("[OutOfCreditsModal] purchase failed", err);
      setError(err instanceof Error ? err.message : "Could not start checkout. Try again.");
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          setPendingKey(null);
          closeOutOfCreditsModal();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Out of credits — top up to keep going</DialogTitle>
          <DialogDescription>
            {`Need ${required} credits for ${operation} · You have ${balance}`}
          </DialogDescription>
        </DialogHeader>

        {/* Disabled-reason banner (shown when a prior auto-topup attempt was system-disabled) */}
        {showDisabledBanner && (
          <div
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {disabledReasonCopy[disabledReason!]}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPUP_PACKS.map((pack) => {
            const isPending = pendingKey === pack.key;
            return (
              <button
                key={pack.key}
                type="button"
                disabled={pendingKey !== null}
                onClick={() => handlePick(pack)}
                className="relative rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pack.badge === "best_value" && (
                  <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    ★ Best Value
                  </span>
                )}
                <div className="text-sm font-medium">{pack.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {pack.credits.toLocaleString()} credits / {formatUsd(pack.priceCents)}
                </div>
                {isPending && (
                  <div className="mt-2 text-xs text-muted-foreground">Redirecting to checkout…</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Auto-topup opt-in (Wave 3) — hidden when a system disabled-reason is active */}
        {!showDisabledBanner && (
          <div className="border-t border-border pt-4 mt-4 space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoEnable}
                onChange={(e) => setAutoEnable(e.target.checked)}
                className="mt-0.5"
                aria-label="Auto top-up me when I run out next time"
              />
              <span>Auto top-up me when I run out next time</span>
            </label>

            {autoEnable && (
              <div className="ml-6 space-y-3 border-l border-border pl-3">
                <div className="text-sm">
                  <label className="block">
                    Monthly spend cap: ${" "}
                    <input
                      type="number"
                      value={capDollars}
                      min={1}
                      onChange={(e) => setCapDollars(Number(e.target.value))}
                      className="w-20 border rounded px-1 text-right"
                      aria-label="Monthly spend cap in dollars"
                    />{" "}
                    /month
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    We&apos;ll never auto-charge you more than this in a calendar month (UTC).
                  </p>
                </div>

                {setupIntentClientSecret ? (
                  <InlineCardForm
                    clientSecret={setupIntentClientSecret}
                    publishableKey={stripePublishableKey}
                    existingPm={existingPm}
                    onSuccess={(pmId) => setPaymentMethodId(pmId)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={handleStartAutoSetup}
                    className="text-sm text-primary underline"
                  >
                    Set up auto top-up payment method
                  </button>
                )}

                {paymentMethodId && (
                  <p className="text-xs text-muted-foreground">
                    Payment method on file. Auto top-up will activate after your purchase.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
          <a
            href={manageCreditsUrl}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Manage credits and auto-topup →
          </a>
          <Button variant="ghost" onClick={closeOutOfCreditsModal} disabled={pendingKey !== null}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
