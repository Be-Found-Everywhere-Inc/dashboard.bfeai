'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  ArrowUpRight,
  Check,
  Search,
  Eye,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@bfeai/ui";
import { APP_CATALOG, APP_ORDER, type AppConfig } from "@/config/apps";
import { useBilling } from "@/hooks/useBilling";
import { toast } from "@bfeai/ui";

const ICON_MAP: Record<string, React.ElementType> = {
  Search,
  Eye,
};

export function AppsPage() {
  const { subscriptions, getSubscription, createCheckout, checkoutLoading, createTrialCheckout, trialCheckoutLoading } = useBilling();
  const searchParams = useSearchParams();

  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [trialRedirecting, setTrialRedirecting] = useState(false);
  const [trialAttempted, setTrialAttempted] = useState(false);

  // Auto-trigger trial checkout when ?trial=true&app=X is in URL
  useEffect(() => {
    const trialParam = searchParams.get("trial");
    const appParam = searchParams.get("app");

    if (trialParam === "true" && appParam && !trialRedirecting && !trialAttempted) {
      setTrialRedirecting(true);
      setTrialAttempted(true);
      createTrialCheckout(appParam)
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
  }, [searchParams, createTrialCheckout, trialRedirecting, trialAttempted]);

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
      <Card className="border-border bg-gradient-to-r from-brand-indigo/10 via-background to-brand-purple/10">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardDescription className="uppercase text-xs tracking-wider text-brand-indigo">
              App Marketplace
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              Explore BFEAI Apps
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Discover powerful tools to grow your business. Subscribe to individual apps for credits-based usage.
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
        </CardHeader>
      </Card>

      {/* Apps Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {APP_ORDER.map((key) => {
          const app = APP_CATALOG[key];
          const status = getAppStatus(app);
          const IconComponent = ICON_MAP[app.icon] || Sparkles;

          return (
            <Card
              key={app.key}
              className={`relative overflow-hidden border transition hover:-translate-y-0.5 hover:shadow-md ${
                status === 'subscribed' || status === 'trialing'
                  ? 'border-brand-indigo/30 bg-card'
                  : 'border-border bg-card'
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-10`}
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
                        <CardTitle className="text-xl">{app.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {app.description}
                        </CardDescription>
                      </div>
                    </div>
                    {status === 'subscribed' && (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <Check className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    )}
                    {status === 'trialing' && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
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
                    <div className="flex items-baseline gap-1 pt-2">
                      <span className="text-2xl font-bold text-foreground">${app.pricing.monthly}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                      {app.key === 'keywords' && (
                        <span className="ml-2 text-xs text-muted-foreground">300 credits/mo</span>
                      )}
                      {app.key === 'labs' && (
                        <span className="ml-2 text-xs text-muted-foreground">300 credits/mo</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {status === 'subscribed' || status === 'trialing' ? (
                      <>
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => handleLaunchApp(app)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Launch App
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedApp(app)}
                        >
                          Details
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="flex-1 gap-2"
                          disabled={checkoutLoading}
                          onClick={() => void handleSubscribe(app.key)}
                        >
                          {checkoutLoading ? "Redirecting..." : "Subscribe"}
                          {!checkoutLoading && <ArrowUpRight className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-1.5 border-brand-indigo/40 text-brand-indigo hover:bg-brand-indigo/5 hover:text-brand-indigo"
                          disabled={trialCheckoutLoading}
                          onClick={() => void handleStartTrial(app.key)}
                        >
                          {trialCheckoutLoading ? "Redirecting..." : "Try for $1 — 7 days"}
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

      {/* App Details Dialog */}
      <Dialog open={Boolean(selectedApp)} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selectedApp && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${selectedApp.gradient} text-white shadow-lg`}
                  >
                    {(() => {
                      const IconComponent = ICON_MAP[selectedApp.icon] || Sparkles;
                      return <IconComponent className="h-6 w-6" />;
                    })()}
                  </div>
                  <div>
                    <DialogTitle>{selectedApp.name}</DialogTitle>
                    <DialogDescription>{selectedApp.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 text-sm text-muted-foreground">
                <p>{selectedApp.longDescription}</p>

                <div>
                  <p className="font-semibold text-foreground mb-3">Features included:</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedApp.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 rounded-xl border border-border bg-muted p-3"
                      >
                        <Check className="h-4 w-4 text-brand-indigo flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedApp.pricing && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="font-semibold text-foreground">Pricing</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-foreground">${selectedApp.pricing.monthly}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="w-full" onClick={() => setSelectedApp(null)}>
                  Close
                </Button>
                {getAppStatus(selectedApp) === 'available' ? (
                  <>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-brand-indigo/40 text-brand-indigo hover:bg-brand-indigo/5"
                      disabled={trialCheckoutLoading}
                      onClick={() => {
                        void handleStartTrial(selectedApp.key);
                        setSelectedApp(null);
                      }}
                    >
                      Try for $1 — 7 days
                    </Button>
                    <Button
                      className="w-full gap-2"
                      onClick={() => {
                        void handleSubscribe(selectedApp.key);
                        setSelectedApp(null);
                      }}
                    >
                      Subscribe
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      handleLaunchApp(selectedApp);
                      setSelectedApp(null);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Launch App
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
