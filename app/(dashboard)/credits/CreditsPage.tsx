'use client';

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bfeai/ui";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalanceCard } from "@/components/billing/CreditBalanceCard";
import { CreditHistoryTable } from "@/components/billing/CreditHistoryTable";
import { SkippedScanBanner } from "@/components/billing/SkippedScanBanner";
import { TopUpPacksGrid } from "@/components/billing/TopUpPacksGrid";
import { AutoTopUpSection } from "./components/AutoTopUpSection";
import { AutoTopUpDisabledBox } from "./components/AutoTopUpDisabledBox";
import { toast } from "@bfeai/ui";

const PAGE_SIZE = 20;

// Stripe publishable key — resolved at build/runtime from env
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

type CreditsPageProps = {
  /** Server-side beta gate: hide auto-topup UI for non-beta users. */
  isBetaUser?: boolean;
};

export function CreditsPage({ isBetaUser = false }: CreditsPageProps) {
  const [page, setPage] = useState(0);

  const {
    balance,
    balanceLoading,
    transactions,
    totalTransactions,
    historyLoading,
    purchaseTopUp,
    topUpLoading,
    refetch,
  } = useCredits(PAGE_SIZE, page * PAGE_SIZE);

  // -------------------------------------------------------------------------
  // Auto top-up backend helpers
  // -------------------------------------------------------------------------

  const handleUpdate = useCallback(
    async (patch: Record<string, unknown>) => {
      const res = await fetch("/.netlify/functions/settings-billing-update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to save settings");
      }
      // Refresh balance so autoTopup state is up to date
      refetch();
    },
    [refetch]
  );

  const handleRequestSetupIntent = useCallback(async () => {
    const res = await fetch("/.netlify/functions/setup-intent-create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error ?? "Failed to create setup intent");
    }
    return res.json() as Promise<{
      client_secret: string;
      existing_pm: { last4: string; brand: string } | null;
    }>;
  }, []);

  // Toast wrapper for top-level errors from auto-topup actions
  const handleUpdateWithToast = useCallback(
    async (patch: Parameters<typeof handleUpdate>[0]) => {
      try {
        await handleUpdate(patch);
      } catch (err) {
        toast({
          title: "Could not save auto top-up settings",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
        throw err; // re-throw so child component can show inline error too
      }
    },
    [handleUpdate]
  );

  // -------------------------------------------------------------------------
  // Determine which auto-topup UI to show
  // -------------------------------------------------------------------------

  const autoTopup = balance?.autoTopup ?? null;
  const showDisabledBox =
    isBetaUser &&
    autoTopup !== null &&
    autoTopup.disabledReason !== null &&
    autoTopup.disabledReason !== "user_disabled";

  const showMainSection =
    isBetaUser &&
    autoTopup !== null &&
    !showDisabledBox;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="animate-fade-in-up">
        <h1 className="page-title text-2xl md:text-3xl text-foreground">Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your credit balance, buy top-ups, and track usage.</p>
      </div>

      {/* Top row: Balance card + explanation */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CreditBalanceCard balance={balance} isLoading={balanceLoading} />
        </div>

        <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="font-heading">How credits work</CardTitle>
            <CardDescription>Credits power everything you do across BFEAI apps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <p className="font-semibold text-foreground">Monthly allocation</p>
                <p>Each app subscription grants monthly credits that refresh on your billing date. Unused credits carry over up to a cap.</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <p className="font-semibold text-foreground">Top-up credits</p>
                <p>Buy extra credits anytime. They never expire and are used first before your monthly balance.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skipped-scan banner (Wave 2): show when the most recent skip is
          newer than the last dismissal (or never dismissed). */}
      {balance?.lastSkippedScanAt &&
        (balance.lastSkippedScanDismissedAt === null ||
          new Date(balance.lastSkippedScanAt) >
            new Date(balance.lastSkippedScanDismissedAt)) && (
          <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <SkippedScanBanner skippedAt={balance.lastSkippedScanAt} />
          </div>
        )}

      {/* Top-up packs */}
      <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <TopUpPacksGrid onPurchase={purchaseTopUp} purchaseLoading={topUpLoading} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Auto top-up settings (Wave 3 — beta users only)                     */}
      {/* ------------------------------------------------------------------ */}

      {/* Disabled-state box: shown when a system reason disabled auto-topup */}
      {showDisabledBox && autoTopup && (
        <div className="animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <AutoTopUpDisabledBox
            autoTopup={autoTopup}
            stripePublishableKey={STRIPE_PK}
            onUpdate={handleUpdateWithToast}
            onRequestSetupIntent={handleRequestSetupIntent}
          />
        </div>
      )}

      {/* Main settings panel: shown when no system disabled-reason */}
      {showMainSection && autoTopup && (
        <div className="animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          {/* TODO: pass stripePortalUrl once BillingService.createPortalSession()
              is plumbed through CreditsPage. BillingPage already uses
              createPortalSession — share that hook or lift the URL here. */}
          <AutoTopUpSection
            autoTopup={autoTopup}
            stripePublishableKey={STRIPE_PK}
            onUpdate={handleUpdateWithToast}
            onRequestSetupIntent={handleRequestSetupIntent}
          />
        </div>
      )}

      {/* Transaction history */}
      <Card className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <CardHeader>
          <CardTitle className="font-heading">Transaction history</CardTitle>
          <CardDescription>All credit allocations, purchases, and usage.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreditHistoryTable
            transactions={transactions}
            total={totalTransactions}
            isLoading={historyLoading}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
