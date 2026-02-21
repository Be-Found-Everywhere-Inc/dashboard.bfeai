import { useState } from "react";
import {
  AlertCircle,
  Check,
  Gift,
  Pause,
  Percent,
  Coins,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  RadioGroup,
  RadioGroupItem,
  Label,
  Textarea,
  Alert,
  AlertDescription,
  AlertTitle,
} from "@bfeai/ui";
import {
  useCancellation,
  type CancellationStep,
  type RetentionOffer,
} from "@/hooks/useCancellation";
import { toast } from "@bfeai/ui";

type CancellationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: {
    id: string;
    planName: string;
    amount: number;
    currency: string;
    nextBillingDate: string | null;
  } | null;
};

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Too expensive / Not enough value" },
  { value: "not_using", label: "Not using it enough" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "found_alternative", label: "Found a better alternative" },
  { value: "technical_issues", label: "Technical issues or bugs" },
  { value: "business_changed", label: "Business closed or changed direction" },
  { value: "other", label: "Other reason" },
];

// ── Retention offer display config ──────────────────────────────────────────

type OfferDisplay = {
  icon: React.ElementType;
  title: string;
  description: string;
  ctaLabel: string;
  gradient: string;
};

const getOfferDisplay = (
  offer: RetentionOffer,
  amount: number,
  currency: string,
): OfferDisplay => {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);

  switch (offer.offerType) {
    case "discount_3mo": {
      const pct = (offer.offerDetails.percent_off as number) ?? 20;
      const discounted = amount * (1 - pct / 100);
      return {
        icon: Percent,
        title: `${pct}% off for 3 months`,
        description: `Your price drops from ${fmt(amount)}/mo to ${fmt(discounted)}/mo for the next 3 months, then returns to the regular price.`,
        ctaLabel: "Apply discount",
        gradient: "from-green-500/10 to-emerald-500/10",
      };
    }
    case "discount_1mo": {
      const pct = (offer.offerDetails.percent_off as number) ?? 25;
      const discounted = amount * (1 - pct / 100);
      return {
        icon: Percent,
        title: `${pct}% off next month`,
        description: `Get your next month for just ${fmt(discounted)} instead of ${fmt(amount)}, then return to the regular price.`,
        ctaLabel: "Apply discount",
        gradient: "from-blue-500/10 to-indigo-500/10",
      };
    }
    case "pause": {
      const months = (offer.offerDetails.pause_months as number) ?? 1;
      return {
        icon: Pause,
        title: `Pause for ${months} month${months > 1 ? "s" : ""}`,
        description: `Take a break without losing anything. No charges for ${months} month${months > 1 ? "s" : ""}, your credits stay intact, and your subscription resumes automatically.`,
        ctaLabel: "Pause subscription",
        gradient: "from-blue-500/10 to-cyan-500/10",
      };
    }
    case "credits": {
      const creditAmount = (offer.offerDetails.credit_amount as number) ?? 50;
      return {
        icon: Coins,
        title: `${creditAmount} bonus credits`,
        description: `We'll add ${creditAmount} free credits to your account right now. That's about ${Math.floor(creditAmount / 20)} extra keyword runs on us.`,
        ctaLabel: "Claim bonus credits",
        gradient: "from-amber-500/10 to-orange-500/10",
      };
    }
    default:
      return {
        icon: Gift,
        title: "Special offer",
        description: "We have a special offer to help you stay.",
        ctaLabel: "Accept offer",
        gradient: "from-brand-indigo/10 to-brand-purple/10",
      };
  }
};

// ── Component ───────────────────────────────────────────────────────────────

export const CancellationDialog = ({
  open,
  onOpenChange,
  subscription,
}: CancellationDialogProps) => {
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");

  const {
    step,
    offer,
    offerMessage,
    cancelMessage,
    submitReason,
    submitReasonLoading,
    acceptOffer,
    acceptOfferLoading,
    declineOffer,
    confirmCancel,
    confirmCancelLoading,
    isLoading,
    error,
    reset,
  } = useCancellation();

  const handleClose = () => {
    onOpenChange(false);
    // Reset after dialog animation finishes
    setTimeout(() => {
      setReason("");
      setFeedback("");
      reset();
    }, 300);
  };

  const handleSubmitReason = async () => {
    try {
      await submitReason({ reason, feedback: feedback.trim() || undefined });
    } catch (err) {
      toast({
        title: "Something went wrong",
        description:
          err instanceof Error ? err.message : "Unable to process your request.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptOffer = async () => {
    try {
      await acceptOffer({ reason, feedback: feedback.trim() || undefined });
    } catch (err) {
      toast({
        title: "Unable to apply offer",
        description:
          err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await confirmCancel({ reason, feedback: feedback.trim() || undefined });
    } catch (err) {
      toast({
        title: "Unable to cancel",
        description:
          err instanceof Error
            ? err.message
            : "An error occurred while cancelling your subscription.",
        variant: "destructive",
      });
    }
  };

  if (!subscription) return null;

  const renderStep = (currentStep: CancellationStep) => {
    switch (currentStep) {
      // ── Step 1: Reason + Feedback ───────────────────────────────────────
      case "reason":
        return (
          <>
            <DialogHeader>
              <DialogTitle>We&apos;re sorry to see you go</DialogTitle>
              <DialogDescription>
                Help us improve &mdash; what&apos;s your primary reason for
                cancelling?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <RadioGroup value={reason} onValueChange={setReason}>
                {CANCELLATION_REASONS.map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-center space-x-2"
                  >
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label
                      htmlFor={opt.value}
                      className="cursor-pointer font-normal"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="space-y-2 pt-2">
                <Label htmlFor="feedback">
                  Additional feedback (optional)
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us more about your experience..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Keep subscription
              </Button>
              <Button
                onClick={() => void handleSubmitReason()}
                disabled={!reason || submitReasonLoading}
              >
                {submitReasonLoading ? "Processing..." : "Continue"}
              </Button>
            </DialogFooter>
          </>
        );

      // ── Step 2: Retention Offer ─────────────────────────────────────────
      case "offer": {
        if (!offer) return null;

        const display = getOfferDisplay(
          offer,
          subscription.amount,
          subscription.currency,
        );
        const OfferIcon = display.icon;

        return (
          <>
            <DialogHeader>
              <DialogTitle>Before you go&hellip;</DialogTitle>
              <DialogDescription>
                We&apos;d love to keep you. Here&apos;s something that might
                help.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div
                className={`rounded-xl border border-border bg-gradient-to-br ${display.gradient} p-5`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-gray-900/50">
                    <OfferIcon className="h-6 w-6 text-brand-indigo" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {display.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {display.description}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={declineOffer}
              >
                No thanks, cancel anyway
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => void handleAcceptOffer()}
                disabled={acceptOfferLoading}
              >
                {acceptOfferLoading ? "Applying..." : display.ctaLabel}
              </Button>
            </DialogFooter>
          </>
        );
      }

      // ── Step 3: Confirm Cancellation ────────────────────────────────────
      case "confirm":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Confirm cancellation</DialogTitle>
              <DialogDescription>
                Your subscription will be cancelled at the end of the current
                billing period.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>This will cancel your subscription</AlertTitle>
                <AlertDescription className="mt-2 space-y-1">
                  <p>
                    &bull; Your {subscription.planName} subscription will be
                    cancelled
                  </p>
                  <p>
                    &bull; You keep access until{" "}
                    {subscription.nextBillingDate ??
                      "the end of your billing period"}
                  </p>
                  <p>&bull; No further charges after the current period</p>
                  <p>&bull; You can resubscribe anytime</p>
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Keep subscription
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleConfirmCancel()}
                disabled={confirmCancelLoading}
              >
                {confirmCancelLoading
                  ? "Cancelling..."
                  : "Yes, cancel my subscription"}
              </Button>
            </DialogFooter>
          </>
        );

      // ── Step 4: Success ─────────────────────────────────────────────────
      case "success": {
        const isOfferAccepted = Boolean(offerMessage);
        return (
          <>
            <DialogHeader>
              <DialogTitle>
                {isOfferAccepted
                  ? "Offer applied!"
                  : "Subscription cancelled"}
              </DialogTitle>
              <DialogDescription>
                {isOfferAccepted
                  ? "Your subscription has been updated."
                  : "Your cancellation has been processed."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    {isOfferAccepted ? "Offer applied" : "Cancellation confirmed"}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {offerMessage ?? cancelMessage ?? "Done."}
                  </p>
                </div>
              </div>

              {!isOfferAccepted && (
                <div className="rounded-xl border border-border bg-muted p-4">
                  <p className="font-semibold text-foreground">
                    What&apos;s next?
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>
                      &bull; You still have access until{" "}
                      {subscription.nextBillingDate ??
                        "the end of your billing period"}
                    </li>
                    <li>
                      &bull; No further charges after the current period
                    </li>
                    <li>
                      &bull; You can resubscribe anytime from this portal
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Return to dashboard
              </Button>
            </DialogFooter>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {renderStep(step)}
      </DialogContent>
    </Dialog>
  );
};
