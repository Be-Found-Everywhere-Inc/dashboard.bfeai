'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bfeai/ui";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalanceCard } from "@/components/billing/CreditBalanceCard";
import { CreditHistoryTable } from "@/components/billing/CreditHistoryTable";
import { TopUpPacksGrid } from "@/components/billing/TopUpPacksGrid";

const PAGE_SIZE = 20;

export function CreditsPage() {
  const [page, setPage] = useState(0);

  const {
    balance,
    balanceLoading,
    transactions,
    totalTransactions,
    historyLoading,
    purchaseTopUp,
    topUpLoading,
  } = useCredits(PAGE_SIZE, page * PAGE_SIZE);

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

      {/* Top-up packs */}
      <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <TopUpPacksGrid onPurchase={purchaseTopUp} purchaseLoading={topUpLoading} />
      </div>

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
