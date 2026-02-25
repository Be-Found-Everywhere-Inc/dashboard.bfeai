'use client';

import { useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@bfeai/ui";
import { useBilling } from "@/hooks/useBilling";
import { toast } from "@bfeai/ui";
import { CancellationDialog } from "@/components/billing/CancellationDialog";

export function BillingPage() {
  const {
    subscriptions,
    createPortalSession,
    portalSessionLoading,
  } = useBilling();
  const [redirecting, setRedirecting] = useState(false);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);

  const handlePortalRedirect = async () => {
    setRedirecting(true);
    try {
      const returnUrl = new URL("/billing", window.location.origin).toString();
      const url = await createPortalSession(returnUrl);
      if (!url) {
        throw new Error("Stripe billing portal is not available yet.");
      }
      window.location.assign(url);
    } catch (error) {
      toast({
        title: "Unable to open billing portal",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setRedirecting(false);
    }
  };

  const isPortalLoading = portalSessionLoading || redirecting;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in-up">
        <h1 className="page-title text-2xl md:text-3xl text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage payment methods, view invoices, and update billing details.</p>
      </div>

      {/* Stripe Billing Portal */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-indigo/20 text-brand-indigo">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-heading">Billing & Invoices</CardTitle>
              <CardDescription>
                Manage your payment method, view invoices, and update billing details.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-5">
            <p className="text-sm text-muted-foreground">
              Your billing is managed through Stripe. From the Stripe portal you can:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-indigo" />
                Update your payment method or billing address
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-indigo" />
                View and download invoices
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-indigo" />
                Manage invoice email preferences
              </li>
            </ul>
            <Button
              className="mt-4 gap-2"
              onClick={() => void handlePortalRedirect()}
              disabled={isPortalLoading}
            >
              <ExternalLink className="h-4 w-4" />
              {isPortalLoading ? "Opening..." : "Open Stripe Billing Portal"}
            </Button>
          </div>

          {subscriptions.filter((s) => s.stripeManaged && !s.cancelAtPeriodEnd && s.status === "active").map((sub) => (
            <div key={sub.id} className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">Cancel {sub.appKey === 'labs' ? 'LABS' : 'Keywords'} subscription</p>
                <p className="text-xs text-red-700 dark:text-red-300">Cancel at the end of the current billing period.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setCancellationDialogOpen(true)}>
                Cancel
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <CancellationDialog
        open={cancellationDialogOpen}
        onOpenChange={setCancellationDialogOpen}
        subscription={(() => {
          const cancelSub = subscriptions.find((s) => s.status === 'active' && !s.cancelAtPeriodEnd);
          return cancelSub
            ? {
                id: cancelSub.id,
                planName: cancelSub.appKey === 'labs' ? 'LABS' : 'Keywords',
                amount: cancelSub.amount,
                currency: cancelSub.currency,
                nextBillingDate: cancelSub.nextBillingDate,
              }
            : null;
        })()}
      />
    </div>
  );
}
