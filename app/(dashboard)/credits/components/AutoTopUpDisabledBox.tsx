"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, Button } from "@bfeai/ui";
import { InlineCardForm } from "@bfeai/ui";
import { useState } from "react";
import type { AutoTopUpState } from "@/services/BillingService";

// ---------------------------------------------------------------------------
// Copy map — reason → human-readable message
// ---------------------------------------------------------------------------

const REASON_COPY: Record<string, string> = {
  card_declined: "Your card was declined",
  requires_authentication: "Your card needs verification",
  pack_archived: "Your selected pack is no longer available",
  no_payment_method: "No payment method on file",
  customer_deleted: "Your Stripe customer record was deleted (contact support)",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutoTopUpDisabledBoxProps = {
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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shown when auto-topup has been disabled by the system (e.g. card declined).
 * Renders nothing when `disabledReason` is null, 'user_disabled', or unknown.
 *
 * Allows the user to:
 * - Update their card (InlineCardForm flow) → re-enables auto-topup
 * - Manually disable auto-topup (sets reason='user_disabled' via backend)
 */
export function AutoTopUpDisabledBox({
  autoTopup,
  stripePublishableKey,
  onUpdate,
  onRequestSetupIntent,
}: AutoTopUpDisabledBoxProps) {
  const { disabledReason } = autoTopup;

  // Don't render when:
  // - no disabled reason
  // - user manually disabled (they chose to turn it off — show toggle in OFF state)
  // - unknown reason not in our copy map
  if (
    !disabledReason ||
    disabledReason === "user_disabled" ||
    !REASON_COPY[disabledReason]
  ) {
    return null;
  }

  const reasonCopy = REASON_COPY[disabledReason];

  return (
    <DisabledBoxInner
      reasonCopy={reasonCopy}
      autoTopup={autoTopup}
      stripePublishableKey={stripePublishableKey}
      onUpdate={onUpdate}
      onRequestSetupIntent={onRequestSetupIntent}
    />
  );
}

// Separate inner component so the state is only created when the box is visible
function DisabledBoxInner({
  reasonCopy,
  autoTopup,
  stripePublishableKey,
  onUpdate,
  onRequestSetupIntent,
}: {
  reasonCopy: string;
  autoTopup: AutoTopUpState;
  stripePublishableKey: string;
  onUpdate: AutoTopUpDisabledBoxProps["onUpdate"];
  onRequestSetupIntent: AutoTopUpDisabledBoxProps["onRequestSetupIntent"];
}) {
  const [showCardForm, setShowCardForm] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [existingPm, setExistingPm] = useState<{ last4: string; brand: string } | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // "Update card" flow
  // ---------------------------------------------------------------------------

  const handleUpdateCardClick = async () => {
    setError(null);
    setLoadingIntent(true);
    try {
      const { client_secret, existing_pm } = await onRequestSetupIntent();
      setSetupIntentClientSecret(client_secret);
      setExistingPm(existing_pm);
      setShowCardForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start card setup");
    } finally {
      setLoadingIntent(false);
    }
  };

  const handleCardSuccess = async (pmId: string) => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        auto_topup_payment_method_id: pmId,
        auto_topup_enabled: true, // re-enables, backend clears disabled_reason
      });
      setShowCardForm(false);
      setSetupIntentClientSecret(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card");
    } finally {
      setSaving(false);
    }
  };

  const handleCardCancel = () => {
    setShowCardForm(false);
    setSetupIntentClientSecret(null);
    setExistingPm(null);
  };

  // ---------------------------------------------------------------------------
  // "Disable auto top-up" action
  // ---------------------------------------------------------------------------

  const handleDisable = async () => {
    setSaving(true);
    setError(null);
    try {
      await onUpdate({ auto_topup_enabled: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/5">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Auto top-up is currently disabled
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Reason: {reasonCopy}
            </p>
            {autoTopup.paymentMethodLast4 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Previous card: •••• {autoTopup.paymentMethodLast4}
              </p>
            )}
          </div>
        </div>

        {/* Inline card form */}
        {showCardForm && setupIntentClientSecret && (
          <div className="rounded-lg border border-amber-200 bg-white dark:bg-card p-4">
            <InlineCardForm
              clientSecret={setupIntentClientSecret}
              publishableKey={stripePublishableKey}
              existingPm={existingPm}
              onSuccess={(pmId) => void handleCardSuccess(pmId)}
              onCancel={handleCardCancel}
            />
          </div>
        )}

        {/* Action buttons */}
        {!showCardForm && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void handleUpdateCardClick()}
              disabled={loadingIntent || saving}
              className="gap-1.5"
            >
              {loadingIntent ? "Loading…" : "Update card →"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDisable()}
              disabled={saving || loadingIntent}
            >
              {saving ? "Saving…" : "Disable auto top-up"}
            </Button>
          </div>
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
