'use client';

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Eye, ArrowUpRight, ExternalLink, CreditCard, Coins, Sparkles, Zap, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from "@bfeai/ui";
import { useBilling } from "@/hooks/useBilling";
import { APP_CATALOG } from "@/config/apps";
import { CreditBalanceCard } from "@/components/billing/CreditBalanceCard";
import { CancellationDialog } from "@/components/billing/CancellationDialog";
import { toast } from "@bfeai/ui";
import { format } from "date-fns";

const APP_ICONS: Record<string, React.ElementType> = {
  keywords: Search,
  labs: Eye,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const {
    subscriptions,
    getSubscription,
    credits,
    recentInvoices,
    isLoading,
    createCheckout,
    checkoutLoading,
    createTrialCheckout,
    trialCheckoutLoading,
    createPortalSession,
    portalSessionLoading,
    refetch,
  } = useBilling();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');

  // Fetch user name for greeting
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user?.name) {
          setUserName(data.user.name.split(' ')[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Handle checkout success redirect
  const checkoutStatus = searchParams.get("checkout");
  useEffect(() => {
    if (checkoutStatus === "success" || checkoutStatus === "trial-success") {
      void refetch();
      if (checkoutStatus === "trial-success") {
        toast({
          title: "Trial started!",
          description: "Your 7-day trial is now active. Enjoy exploring the app!",
        });
      }
      router.replace("/", { scroll: false });
    }
  }, [checkoutStatus, refetch, router]);

  const handleSubscribe = async (appKey: string) => {
    try {
      const url = await createCheckout(appKey);
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Unable to start checkout",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartTrial = async (appKey: string) => {
    try {
      const url = await createTrialCheckout(appKey);
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Unable to start trial",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleManageBilling = async () => {
    try {
      const url = await createPortalSession(window.location.href);
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Unable to open billing portal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

  const getAppStatus = (appKey: string): 'active' | 'trialing' | 'none' => {
    const sub = getSubscription(appKey);
    if (sub) {
      if (sub.status === 'active') return 'active';
      if (sub.status === 'trialing') return 'trialing';
    }
    return 'none';
  };

  const activeAppCount = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing').length;

  if (isLoading && subscriptions.length === 0) {
    return (
      <div className="space-y-6">
        {/* Skeleton hero */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-indigo/5 via-background to-brand-purple/5 border border-border p-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted mb-2" />
          <div className="h-5 w-72 animate-pulse rounded-lg bg-muted" />
        </div>
        {/* Skeleton cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-56 animate-pulse rounded-2xl bg-muted" />
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Welcome Hero */}
      <div className="animate-fade-in-up rounded-2xl bg-gradient-to-br from-brand-indigo/8 via-background to-brand-teal/6 border border-brand-indigo/10 p-6 md:p-8 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title text-2xl md:text-3xl text-foreground">
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Here&apos;s your BFEAI overview. Manage apps, credits, and billing all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
              <Activity className="h-4 w-4 text-brand-indigo" />
              <span className="text-muted-foreground">Active apps</span>
              <span className="font-bold text-foreground">{activeAppCount}</span>
            </div>
            {credits && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
                <Coins className="h-4 w-4 text-brand-teal" />
                <span className="text-muted-foreground">Credits</span>
                <span className="font-bold text-foreground">{credits.total.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* App Subscriptions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {(['keywords', 'labs'] as const).map((appKey, i) => {
          const app = APP_CATALOG[appKey];
          const status = getAppStatus(appKey);
          const IconComponent = APP_ICONS[appKey] || Sparkles;

          return (
            <Card
              key={appKey}
              className={`animate-fade-in-up card-hover-lift relative overflow-hidden ${
                status !== 'none'
                  ? 'border-brand-indigo/20 shadow-sm'
                  : 'border-border'
              }`}
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-[0.04]`}
                aria-hidden
              />
              <div className="relative">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${app.gradient} text-white shadow-lg`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardDescription className="text-xs">{app.description}</CardDescription>
                    <CardTitle className="text-lg font-heading">{app.name}</CardTitle>
                  </div>
                  {status === 'active' && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 shrink-0">Active</Badge>
                  )}
                  {status === 'trialing' && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 shrink-0">
                      <Zap className="mr-1 h-3 w-3" />
                      Trial
                    </Badge>
                  )}
                </CardHeader>

                <CardContent>
                  {status !== 'none' ? (() => {
                    const appSub = getSubscription(appKey);
                    return (
                    <div className="space-y-3">
                      {appSub && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold text-foreground">
                            {formatCurrency(appSub.amount, appSub.currency)}
                          </span>
                          <span className="text-sm text-muted-foreground">/ month</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="gap-1.5 btn-press" asChild>
                          <a href={app.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Launch {app.shortName}
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="btn-press"
                          onClick={() => void handleManageBilling()}
                          disabled={portalSessionLoading}
                        >
                          {portalSessionLoading ? "Opening..." : "Manage"}
                        </Button>
                        {appSub && appSub.stripeManaged && !appSub.cancelAtPeriodEnd && appSub.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 btn-press"
                            onClick={() => setCancellationDialogOpen(true)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })() : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {app.pricing ? `$${app.pricing.monthly}/mo` : ''} — 300 credits monthly
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5 btn-press"
                          disabled={checkoutLoading}
                          onClick={() => void handleSubscribe(appKey)}
                        >
                          {checkoutLoading ? "Redirecting..." : "Subscribe"}
                          {!checkoutLoading && <ArrowUpRight className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-brand-indigo/40 text-brand-indigo hover:bg-brand-indigo/5 hover:text-brand-indigo btn-press"
                          disabled={trialCheckoutLoading}
                          onClick={() => void handleStartTrial(appKey)}
                        >
                          {trialCheckoutLoading ? "Redirecting..." : "Try for $1 — 7 days"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Credits + Recent payments */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <CreditBalanceCard
            balance={credits}
            isLoading={isLoading}
            onViewCredits={() => router.push("/credits")}
          />
        </div>

        <Card className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <CardHeader className="space-y-1">
            <CardDescription>Recent payments</CardDescription>
            <CardTitle className="text-lg font-heading">Billing activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
            {recentInvoices.slice(0, 4).map((invoice) => (
              <button
                key={invoice.id}
                className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-all hover:border-brand-indigo/40 hover:bg-brand-indigo/5 hover:shadow-sm btn-press"
                onClick={() => invoice.invoiceUrl && window.open(invoice.invoiceUrl, "_blank")}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground capitalize">{invoice.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.date ? format(new Date(invoice.date), "MMM d, yyyy") : "Processing"}
                  </p>
                </div>
                <div className="text-right text-sm font-semibold text-foreground">
                  {formatCurrency(invoice.total, invoice.currency)}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <h2 className="font-heading text-lg font-semibold text-foreground mb-3">Quick access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Keywords */}
          <a
            href={APP_CATALOG.keywords.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-indigo/40 hover:shadow-md card-hover-lift"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-indigo to-brand-purple text-white shadow">
              <Search className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground group-hover:text-brand-indigo transition-colors">Keywords</p>
              <p className="text-xs text-muted-foreground truncate">SEO keyword research</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand-indigo transition-colors" />
          </a>

          {/* LABS */}
          <a
            href={APP_CATALOG.labs.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-teal/40 hover:shadow-md card-hover-lift"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-teal to-brand-indigo text-white shadow">
              <Eye className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground group-hover:text-brand-teal transition-colors">LABS</p>
              <p className="text-xs text-muted-foreground truncate">AI visibility tracking</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand-teal transition-colors" />
          </a>

          {/* Credits */}
          <button
            onClick={() => router.push('/credits')}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-indigo/40 hover:shadow-md text-left card-hover-lift"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-brand-indigo/10 group-hover:text-brand-indigo transition-colors">
              <Coins className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground group-hover:text-brand-indigo transition-colors">Credits</p>
              <p className="text-xs text-muted-foreground truncate">Balance & top-ups</p>
            </div>
          </button>

          {/* Billing */}
          <button
            onClick={() => void handleManageBilling()}
            disabled={portalSessionLoading}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-brand-purple/40 hover:shadow-md text-left card-hover-lift"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-brand-purple/10 group-hover:text-brand-purple transition-colors">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground group-hover:text-brand-purple transition-colors">Billing</p>
              <p className="text-xs text-muted-foreground truncate">Invoices & payment</p>
            </div>
          </button>
        </div>
      </div>

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
    </>
  );
}
