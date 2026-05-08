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
}

export function OutOfCreditsModal({ manageCreditsUrl, onPurchase }: OutOfCreditsModalProps) {
  const { isOpen, context, closeOutOfCreditsModal } = useCredits();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!context) return null;

  const { operation, required, balance } = context;

  const handlePick = async (pack: TopUpPack) => {
    setError(null);
    setPendingKey(pack.key);
    try {
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
