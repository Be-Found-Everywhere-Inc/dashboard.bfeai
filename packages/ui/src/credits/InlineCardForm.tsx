"use client";

import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJsType } from "@stripe/stripe-js";
import { useState, useMemo } from "react";

export type InlineCardFormProps = {
  clientSecret: string;
  publishableKey: string;
  existingPm: { last4: string; brand: string } | null;
  onSuccess: (paymentMethodId: string) => void;
  onCancel?: () => void;
};

function CardFormInner({
  clientSecret,
  existingPm,
  onSuccess,
  onCancel,
}: Omit<InlineCardFormProps, "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [mode, setMode] = useState<"existing" | "new">(existingPm ? "existing" : "new");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    if (!stripe) return;
    setPending(true);
    setError(null);
    try {
      let result;
      if (mode === "existing" && existingPm) {
        // Confirm SetupIntent against the customer's default PM (validates off_session capability)
        result = await stripe.confirmCardSetup(clientSecret);
      } else {
        if (!elements) {
          setError("Card form not loaded");
          return;
        }
        const card = elements.getElement(CardElement);
        if (!card) {
          setError("Card element not found");
          return;
        }
        result = await stripe.confirmCardSetup(clientSecret, {
          payment_method: { card },
        });
      }
      if (result.error) {
        setError(result.error.message ?? "Card error");
      } else if (result.setupIntent?.payment_method) {
        const pmId =
          typeof result.setupIntent.payment_method === "string"
            ? result.setupIntent.payment_method
            : result.setupIntent.payment_method.id;
        onSuccess(pmId);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {existingPm && mode === "existing" && (
        <div className="rounded-md border border-border p-3 text-sm flex items-center justify-between">
          <span>
            Use card on file ({existingPm.brand} &bull;&bull;&bull;&bull; {existingPm.last4})
          </span>
          <button
            type="button"
            className="text-primary underline text-xs"
            onClick={() => setMode("new")}
          >
            Use a different card
          </button>
        </div>
      )}
      {(mode === "new" || !existingPm) && (
        <div className="rounded-md border border-border p-3">
          <CardElement options={{ hidePostalCode: false }} />
        </div>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !stripe}
          onClick={handleConfirm}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 text-sm font-medium"
        >
          {pending ? "Saving…" : "Save card"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function InlineCardForm({ publishableKey, ...props }: InlineCardFormProps) {
  const stripePromise = useMemo<Promise<StripeJsType | null>>(
    () => loadStripe(publishableKey),
    [publishableKey],
  );
  return (
    <Elements stripe={stripePromise}>
      <CardFormInner {...props} />
    </Elements>
  );
}
