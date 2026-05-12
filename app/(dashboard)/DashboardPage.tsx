'use client';

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, FlaskConical, ExternalLink, CreditCard, Coins, Megaphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bfeai/ui";
import { useBilling } from "@/hooks/useBilling";
import { APP_CATALOG } from "@/config/apps";
import { CreditBalanceCard } from "@/components/billing/CreditBalanceCard";
import { trackSignup, trackSubscribe, trackCancelCheckout } from "@/components/analytics/events";
import { toast } from "@bfeai/ui";
import { format } from "date-fns";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const {
    subscriptions,
    credits,
    recentInvoices,
    isLoading,
    createPortalSession,
    portalSessionLoading,
    refetch,
  } = useBilling();
  const searchParams = useSearchParams();
  const router = useRouter();
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

  // Handle checkout return states
  const checkoutStatus = searchParams.get("checkout");
  useEffect(() => {
    if (checkoutStatus === "success" || checkoutStatus === "trial-success") {
      void refetch();
      trackSubscribe({ isTrial: checkoutStatus === "trial-success" });
      if (checkoutStatus === "trial-success") {
        toast({
          title: "Trial started!",
          description: "Your 7-day trial is now active. Enjoy exploring the app!",
        });
      }
      router.replace("/", { scroll: false });
    } else if (checkoutStatus === "cancelled") {
      trackCancelCheckout();
      toast({
        title: "Checkout cancelled",
        description: "No worries — nothing was charged. You can start your trial whenever you're ready.",
      });
      router.replace("/", { scroll: false });
    }
  }, [checkoutStatus, refetch, router]);

  // First-time OAuth signup conversion event — tagged server-side by the
  // OAuth callback as `?signup=1&method=<provider>`. Fire once and strip.
  const signupFlag = searchParams.get("signup");
  const signupMethod = searchParams.get("method");
  useEffect(() => {
    if (signupFlag === "1" && (signupMethod === "google" || signupMethod === "github")) {
      trackSignup({ method: signupMethod });
      router.replace("/", { scroll: false });
    }
  }, [signupFlag, signupMethod, router]);

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

      {/* Welcome / What's new */}
      <Card className="animate-fade-in-up mb-6 border-brand-indigo/10 bg-gradient-to-r from-brand-indigo/5 via-background to-brand-purple/5" style={{ animationDelay: '100ms' }}>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
            <Megaphone className="h-5 w-5" />
          </div>
          <CardTitle className="text-base font-heading">Welcome to BFEAI</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI is changing how customers find businesses. BFEAI gives you the tools to be found everywhere AI searches — from keyword research to brand visibility across ChatGPT, Gemini, Perplexity, and more. Use the Quick Access tiles below to launch any app.
          </p>
        </CardContent>
      </Card>

      {/* Credits + Recent payments */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <CreditBalanceCard
            balance={credits}
            isLoading={isLoading}
            onViewCredits={() => router.push("/credits")}
          />
        </div>

        <Card className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <CardHeader className="space-y-1">
            <CardDescription>Recent payments</CardDescription>
            <CardTitle className="text-lg font-heading">Billing activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInvoices.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
                <button
                  type="button"
                  onClick={() => router.push("/apps")}
                  className="mt-2 text-xs font-semibold text-brand-indigo hover:text-brand-indigo/80 transition-colors"
                >
                  View plans →
                </button>
              </div>
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
      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
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
              <FlaskConical className="h-5 w-5" />
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

    </>
  );
}
