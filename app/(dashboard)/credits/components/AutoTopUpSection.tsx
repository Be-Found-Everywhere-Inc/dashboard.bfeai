"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from "@bfeai/ui";
import { TOPUP_PACKS, formatUsd } from "@bfeai/ui";
import { InlineCardForm } from "@bfeai/ui";
import type { AutoTopUpState } from "@/services/BillingService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutoTopUpSectionProps = {
  autoTopup: AutoTopUpState;
  stripePublishableKey: string;
  /** PATCH /.netlify/functions/settings-billing-update */
  onUpdate: (patch: Partial<{
    auto_topup_enabled: boolean;
    auto_topup_pack_key: string;
    auto_topup_monthly_cap_cents: number;
    auto_topup_payment_method_id: string;
  }>) => Promise<void>;
  /** POST /.netlify/functions/setup-intent-create */
  onRequestSetupIntent: () => Promise<{
    client_secret: string;
    existing_pm: { last4: string; brand: string } | null;
  }>;
  /** Stripe Customer Portal URL for "View invoices" link */
  stripePortalUrl?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SMALLEST_PACK_PRICE_CENTS = Math.min(...TOPUP_PACKS.map((p) => p.priceCents));

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMtdDollars(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return `$${(safe / 100).toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// MTD Progress Bar
// ---------------------------------------------------------------------------

function MtdProgressBar({
  mtdSpentCents,
  capCents,
}: {
  mtdSpentCents: number;
  capCents: number;
}) {
  const pct = capCents > 0 ? Math.min(100, (mtdSpentCents / capCents) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-indigo transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={mtdSpentCents}
          aria-valuemin={0}
          aria-valuemax={capCents}
          aria-label={`${formatMtdDollars(mtdSpentCents)} of ${formatMtdDollars(capCents)} used this month`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatMtdDollars(mtdSpentCents)} of {formatMtdDollars(capCents)} used this month (UTC)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoTopUpSection
// ---------------------------------------------------------------------------

export function AutoTopUpSection({
  autoTopup,
  stripePublishableKey,
  onUpdate,
  onRequestSetupIntent,
  stripePortalUrl,
}: AutoTopUpSectionProps) {
  // Local optimistic state for the toggle so the UI responds immediately
  const [enabled, setEnabled] = useState(autoTopup.enabled);
  const [packKey, setPackKey] = useState(autoTopup.packKey ?? "power");
  const [capDollars, setCapDollars] = useState(
    autoTopup.capCents > 0 ? Math.round(autoTopup.capCents / 100) : 200
  );

  // Card update flow
  const [showCardForm, setShowCardForm] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [existingPm, setExistingPm] = useState<{ last4: string; brand: string } | null>(null);
  const [cardFormPending, setCardFormPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync when prop changes (e.g. after refetch)
  useEffect(() => {
    setEnabled(autoTopup.enabled);
  }, [autoTopup.enabled]);

  useEffect(() => {
    if (autoTopup.packKey) setPackKey(autoTopup.packKey);
  }, [autoTopup.packKey]);

  useEffect(() => {
    if (autoTopup.capCents > 0) setCapDollars(Math.round(autoTopup.capCents / 100));
  }, [autoTopup.capCents]);

  // ---------------------------------------------------------------------------
  // Debounced cap update
  // ---------------------------------------------------------------------------

  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCapChange = useCallback(
    (val: number) => {
      setCapDollars(val);
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
      capTimerRef.current = setTimeout(async () => {
        const cents = val * 100;
        if (cents < SMALLEST_PACK_PRICE_CENTS) return; // clamp — don't save invalid value
        try {
          await onUpdate({ auto_topup_monthly_cap_cents: cents });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save cap");
        }
      }, 500);
    },
    [onUpdate]
  );

  // ---------------------------------------------------------------------------
  // Toggle
  // ---------------------------------------------------------------------------

  const handleToggle = async () => {
    setError(null);
    if (enabled) {
      // Toggle OFF — immediate save, no card form
      setEnabled(false);
      setSaving(true);
      try {
        await onUpdate({ auto_topup_enabled: false });
      } catch (err) {
        setEnabled(true); // revert
        setError(err instanceof Error ? err.message : "Failed to disable");
      } finally {
        setSaving(false);
      }
    } else {
      // Toggle ON — requires card form before saving
      setCardFormPending(true);
      try {
        const { client_secret, existing_pm } = await onRequestSetupIntent();
        setSetupIntentClientSecret(client_secret);
        setExistingPm(existing_pm);
        setShowCardForm(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start card setup");
      } finally {
        setCardFormPending(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle ON — called after card form success
  // ---------------------------------------------------------------------------

  const handleToggleOnSuccess = async (pmId: string) => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        auto_topup_enabled: true,
        auto_topup_pack_key: packKey,
        auto_topup_monthly_cap_cents: capDollars * 100,
        auto_topup_payment_method_id: pmId,
      });
      setEnabled(true);
      setShowCardForm(false);
      setSetupIntentClientSecret(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable auto top-up");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOnCancel = () => {
    setShowCardForm(false);
    setSetupIntentClientSecret(null);
    setExistingPm(null);
    // toggle stays OFF
  };

  // ---------------------------------------------------------------------------
  // Pack selector
  // ---------------------------------------------------------------------------

  const handlePackChange = async (newKey: string) => {
    if (!enabled) return; // pack selector is inactive when disabled
    setPackKey(newKey);
    setError(null);
    try {
      await onUpdate({ auto_topup_pack_key: newKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pack");
    }
  };

  // ---------------------------------------------------------------------------
  // Update card (when already enabled — separate flow)
  // ---------------------------------------------------------------------------

  const handleUpdateCard = async () => {
    setError(null);
    setCardFormPending(true);
    try {
      const { client_secret, existing_pm } = await onRequestSetupIntent();
      setSetupIntentClientSecret(client_secret);
      setExistingPm(existing_pm);
      setShowCardForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start card update");
    } finally {
      setCardFormPending(false);
    }
  };

  const handleUpdateCardSuccess = async (pmId: string) => {
    setSaving(true);
    setError(null);
    try {
      // Update PM and re-enable if it was system-disabled
      const patch: Parameters<typeof onUpdate>[0] = {
        auto_topup_payment_method_id: pmId,
      };
      // Re-enable if disabled by system reason (not user_disabled)
      if (
        !enabled &&
        autoTopup.disabledReason !== null &&
        autoTopup.disabledReason !== "user_disabled"
      ) {
        patch.auto_topup_enabled = true;
      }
      await onUpdate(patch);
      setShowCardForm(false);
      setSetupIntentClientSecret(null);
      if (patch.auto_topup_enabled) setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update card");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCardCancel = () => {
    setShowCardForm(false);
    setSetupIntentClientSecret(null);
    setExistingPm(null);
  };

  // ---------------------------------------------------------------------------
  // Selected pack display
  // ---------------------------------------------------------------------------

  const selectedPack = TOPUP_PACKS.find((p) => p.key === packKey) ?? TOPUP_PACKS[2]; // default: power

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Auto top-up settings</CardTitle>
        <CardDescription>
          Automatically buy more credits when you run out, so your workflows never stall.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Toggle row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Status</span>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => void handleToggle()}
            disabled={saving || cardFormPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${
              enabled ? "bg-brand-indigo" : "bg-input"
            }`}
            aria-label={enabled ? "Disable auto top-up" : "Enable auto top-up"}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Card form for toggling ON */}
        {showCardForm && setupIntentClientSecret && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              {enabled ? "Update card on file" : "Add a payment method to enable auto top-up"}
            </p>
            <InlineCardForm
              clientSecret={setupIntentClientSecret}
              publishableKey={stripePublishableKey}
              existingPm={existingPm}
              onSuccess={(pmId) =>
                void (enabled ? handleUpdateCardSuccess(pmId) : handleToggleOnSuccess(pmId))
              }
              onCancel={enabled ? handleUpdateCardCancel : handleToggleOnCancel}
            />
          </div>
        )}

        {/* Pack selector — only interactive when enabled */}
        {!showCardForm && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="auto-topup-pack">
                When you run out of credits, automatically buy:
              </label>
              <select
                id="auto-topup-pack"
                value={packKey}
                onChange={(e) => void handlePackChange(e.target.value)}
                disabled={!enabled || saving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                {TOPUP_PACKS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} — {p.credits.toLocaleString()} credits, {formatUsd(p.priceCents)}
                  </option>
                ))}
              </select>
              {enabled && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedPack.name} · {selectedPack.credits.toLocaleString()} credits
                  for {formatUsd(selectedPack.priceCents)}
                </p>
              )}
            </div>

            {/* Monthly spend cap */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="auto-topup-cap">
                Monthly spend cap
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  id="auto-topup-cap"
                  type="number"
                  value={capDollars}
                  min={Math.ceil(SMALLEST_PACK_PRICE_CENTS / 100)}
                  step={1}
                  onChange={(e) => handleCapChange(Number(e.target.value))}
                  disabled={!enabled || saving}
                  className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  aria-label="Monthly spend cap in dollars"
                />
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <p className="text-xs text-muted-foreground">
                We&apos;ll never auto-charge you more than this in a calendar month (UTC).
              </p>
            </div>

            {/* MTD progress bar */}
            {enabled && (
              <MtdProgressBar
                mtdSpentCents={autoTopup.mtdSpentCents}
                capCents={capDollars * 100}
              />
            )}

            {/* Last charge */}
            {enabled && autoTopup.lastChargeAt && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Last auto-charge:{" "}
                  <span className="text-foreground font-medium">
                    {formatDate(autoTopup.lastChargeAt)} · {selectedPack.name} ·{" "}
                    {formatUsd(selectedPack.priceCents)}
                  </span>
                </p>
              </div>
            )}

            {/* Card on file + controls */}
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                {autoTopup.paymentMethodLast4 ? (
                  <span>
                    Card on file: •••• {autoTopup.paymentMethodLast4}
                  </span>
                ) : (
                  <span>No card on file</span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleUpdateCard()}
                disabled={cardFormPending || saving}
                className="gap-1.5"
              >
                {cardFormPending ? "Loading…" : "Update card"}
              </Button>

              {/* View invoices — only shown when stripePortalUrl is provided */}
              {stripePortalUrl ? (
                <a
                  href={stripePortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  View invoices
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                /* TODO: wire up stripePortalUrl — call BillingService.createPortalSession() and
                   pass the resulting URL here. The BillingPage already has this pattern. */
                null
              )}
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-200"
          >
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
