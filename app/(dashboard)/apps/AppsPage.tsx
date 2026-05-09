'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  ArrowUpRight,
  Check,
  Search,
  FlaskConical,
  Globe,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button } from "@bfeai/ui";
import { APP_CATALOG, getActiveApps, type AppConfig, type AppKey } from "@/config/apps";
import { useBilling } from "@/hooks/useBilling";
import { AppUpsellModal } from "@/components/billing/AppUpsellModal";
import { toast } from "@bfeai/ui";

const ICON_MAP: Record<string, React.ElementType> = {
  Search,
  FlaskConical,
  Globe,
};

export function AppsPage() {
  const {
    subscriptions,
    getSubscription,
    createUnifiedTrialCheckout,
    unifiedTrialCheckoutLoading,
    createTierCheckout,
    tierCheckoutLoading,
  } = useBilling();
  const searchParams = useSearchParams();

  const [selectedApp, setSelectedApp] = useState<AppKey | null>(null);
  const [trialRedirecting, setTrialRedirecting] = useState(false);
  const [trialAttempted, setTrialAttempted] = useState(false);
  const [userTier, setUserTier] = useState<string | null>(null);

  // Fetch user_tier so the beta-access gate can filter the app list
  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user_tier) setUserTier(data.user_tier as string);
      })
      .catch(() => {});
  }, []);

  // Auto-trigger unified trial checkout when ?trial=true is in URL
  // (Wave 1: legacy ?trial=true&app=X deep-links now route to the unified $1 trial on Lite.)
  useEffect(() => {
    const trialParam = searchParams.get("trial");
    if (trialParam === "true" && !trialRedirecting && !trialAttempted) {
      setTrialRedirecting(true);
      setTrialAttempted(true);
      createUnifiedTrialCheckout()
        .then((url) => {
          window.location.href = url;
        })
        .catch((error) => {
          setTrialRedirecting(false);
          toast({
            title: "Unable to start trial",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        });
    }
  }, [searchParams, createUnifiedTrialCheckout, trialRedirecting, trialAttempted]);

  const getAppStatus = (app: AppConfig): 'subscribed' | 'trialing' | 'available' => {
    const sub = getSubscription(app.key);
    if (sub) {
      if (sub.status === 'active') return 'subscribed';
      if (sub.status === 'trialing') return 'trialing';
    }
    return 'available';
  };

  const handleLaunchApp = (app: AppConfig) => {
    window.open(app.url, '_blank');
  };

  const handleViewPlans = () => {
    // Scroll the unified-tier section (Lite/Plus/Max) into view.
    document.getElementById('unified-tier-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleUnifiedTrial = async () => {
    try {
      const url = await createUnifiedTrialCheckout();
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Unable to start trial",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTierCheckout = async (tier: "lite" | "plus" | "max") => {
    try {
      const url = await createTierCheckout(tier);
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Unable to start checkout",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Any active sub (legacy per-app or new-tier) means the user can launch every app.
  // Wave 1: access is auth-only; per-app subs no longer act as gates.
  const hasAnySub = subscriptions.some(
    (s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
  );

  const visibleApps = getActiveApps({ user_tier: userTier });
  const hasAvailableApp = visibleApps.some((app) => getAppStatus(app) === 'available');

  // Show loading state while auto-triggering trial checkout
  if (trialRedirecting) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center space-y-3">
          <Zap className="mx-auto h-8 w-8 animate-pulse text-amber-500" />
          <p className="text-sm text-muted-foreground">Redirecting to trial checkout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up relative overflow-hidden rounded-2xl border border-brand-indigo/10 bg-gradient-to-br from-brand-indigo/8 via-background to-brand-purple/6 p-6 md:p-8">
        {/* Decorative shapes */}
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-brand-indigo/5 blur-3xl" aria-hidden />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-brand-teal/5 blur-2xl" aria-hidden />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-indigo mb-1">
              App Marketplace
            </p>
            <h1 className="page-title text-2xl md:text-3xl text-foreground">
              Explore BFEAI Apps
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Powerful tools to grow your business. One subscription unlocks every app.
            </p>
          </div>
          {subscriptions.length > 0 && (
            <div className="flex gap-2">
              {subscriptions.map((sub) => (
                <Badge key={sub.id} variant="outline" className="text-sm">
                  {sub.appKey === 'keywords' ? 'Keywords' : 'LABS'}: {sub.status === 'trialing' ? 'Trial' : 'Active'}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unified Tier Plans (Wave 1) */}
      <div id="unified-tier-plans" className="animate-fade-in-up space-y-6 scroll-mt-20" style={{ animationDelay: '50ms' }}>
        <div className="text-center">
          <h2 className="font-heading text-2xl text-foreground">All plans now include every BFEAI app</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Choose your plan based on the credits you need each month.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Lite */}
          <Card className="card-hover-lift relative overflow-hidden border-border">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Lite</CardTitle>
              <CardDescription>Starter plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">$49</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li>500 credits/month</li>
                <li>All BFEAI apps included</li>
                <li>Credits cap at 1,500</li>
              </ul>
              <Button
                className="w-full btn-press"
                onClick={() => void handleTierCheckout('lite')}
                disabled={tierCheckoutLoading}
              >
                {tierCheckoutLoading ? "Redirecting..." : "Subscribe"}
              </Button>
            </CardContent>
          </Card>

          {/* Plus (Recommended) */}
          <Card className="card-hover-lift relative overflow-hidden border-brand-indigo/40 shadow-md">
            <div className="absolute top-0 right-0 bg-brand-indigo px-3 py-1 text-xs font-semibold text-white rounded-bl-lg">
              Recommended
            </div>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Plus</CardTitle>
              <CardDescription>For growing teams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">$144</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li>1,700 credits/month</li>
                <li>All BFEAI apps included</li>
                <li>Credits cap at 5,100</li>
              </ul>
              <Button
                className="w-full btn-press"
                onClick={() => void handleTierCheckout('plus')}
                disabled={tierCheckoutLoading}
              >
                {tierCheckoutLoading ? "Redirecting..." : "Subscribe"}
              </Button>
            </CardContent>
          </Card>

          {/* Max */}
          <Card className="card-hover-lift relative overflow-hidden border-border">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Max</CardTitle>
              <CardDescription>Power users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">$444</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="text-sm space-y-1.5 text-muted-foreground">
                <li>5,500 credits/month</li>
                <li>All BFEAI apps included</li>
                <li>Credits cap at 16,500</li>
              </ul>
              <Button
                className="w-full btn-press"
                onClick={() => void handleTierCheckout('max')}
                disabled={tierCheckoutLoading}
              >
                {tierCheckoutLoading ? "Redirecting..." : "Subscribe"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Unified trial CTA — only show to users with no active sub */}
        {!hasAnySub && (
          <div className="text-center">
            <Button
              variant="outline"
              className="gap-2 btn-press"
              disabled={unifiedTrialCheckoutLoading}
              onClick={() => void handleUnifiedTrial()}
            >
              {unifiedTrialCheckoutLoading ? "Redirecting..." : "Try free for 7 days for $1"}
              {!unifiedTrialCheckoutLoading && <Zap className="h-4 w-4" />}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Then $49/month for Lite (500 credits/mo). Cancel anytime.
            </p>
          </div>
        )}
      </div>

      {/* Apps Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {visibleApps.map((app, i) => {
          const status = getAppStatus(app);
          const IconComponent = ICON_MAP[app.icon] || Sparkles;

          return (
            <Card
              key={app.key}
              className={`animate-fade-in-up card-hover-lift relative overflow-hidden border transition cursor-pointer ${
                status === 'subscribed' || status === 'trialing'
                  ? 'border-brand-indigo/25 shadow-sm'
                  : 'border-border'
              }`}
              style={{ animationDelay: `${(i + 1) * 100 + 200}ms` }}
              onClick={(e) => {
                // Don't open modal if clicking a button or link
                if ((e.target as HTMLElement).closest('button, a')) return;
                setSelectedApp(app.key);
              }}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-[0.06]`}
                aria-hidden
              />

              <div className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${app.gradient} text-white shadow-lg`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-heading">{app.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {app.description}
                        </CardDescription>
                      </div>
                    </div>
                    {status === 'subscribed' && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
                        <Check className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    )}
                    {status === 'trialing' && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                        <Zap className="mr-1 h-3 w-3" />
                        Trial
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {app.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-brand-indigo flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {app.features.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{app.features.length - 3} more features
                      </li>
                    )}
                  </ul>

                  {/* Pricing */}
                  {app.pricing && status === 'available' && (
                    <div className="flex items-baseline gap-1 pt-2 border-t border-border/50">
                      <span className="text-2xl font-heading font-bold text-foreground">${app.pricing.monthly}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                      <span className="ml-2 text-xs text-muted-foreground">300 credits/mo</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {hasAnySub ? (
                      <>
                        <Button
                          className="flex-1 gap-2 btn-press"
                          onClick={() => handleLaunchApp(app)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Launch App
                        </Button>
                        <Button
                          variant="outline"
                          className="btn-press"
                          onClick={() => setSelectedApp(app.key)}
                        >
                          Details
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="flex-1 gap-2 btn-press"
                          onClick={handleViewPlans}
                        >
                          View plans
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="btn-press"
                          onClick={() => setSelectedApp(app.key)}
                        >
                          Learn More
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>

      {/* App Upsell Modal */}
      {selectedApp && (
        <AppUpsellModal
          appKey={selectedApp}
          open={Boolean(selectedApp)}
          onOpenChange={(open) => !open && setSelectedApp(null)}
          onViewPlans={() => {
            setSelectedApp(null);
            handleViewPlans();
          }}
          currentStatus={getAppStatus(APP_CATALOG[selectedApp])}
          appUrl={APP_CATALOG[selectedApp].url}
          hasAnySub={hasAnySub}
        />
      )}
    </div>
  );
}
