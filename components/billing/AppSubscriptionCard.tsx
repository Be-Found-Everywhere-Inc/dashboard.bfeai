import { format } from "date-fns";
import {
  Search,
  ExternalLink,
  Calendar,
  Coins,
  AlertCircle,
  Pause,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@bfeai/ui";
import type { SubscriptionSummary } from "@/services/BillingService";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  trialing: { label: "Trial", variant: "secondary" },
  past_due: { label: "Past Due", variant: "destructive" },
  canceled: { label: "Canceled", variant: "destructive" },
  paused: { label: "Paused", variant: "secondary" },
  incomplete: { label: "Incomplete", variant: "outline" },
};

type AppSubscriptionCardProps = {
  subscription: SubscriptionSummary | null;
  isLoading?: boolean;
  onSubscribe: () => void;
  onStartTrial?: () => void;
  onManage: () => void;
  onCancel: () => void;
  subscribeLoading?: boolean;
  trialLoading?: boolean;
  manageLoading?: boolean;
};

export const AppSubscriptionCard = ({
  subscription,
  isLoading,
  onSubscribe,
  onStartTrial,
  onManage,
  onCancel,
  subscribeLoading,
  trialLoading,
  manageLoading,
}: AppSubscriptionCardProps) => {
  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardDescription>App subscription</CardDescription>
          <CardTitle className="text-2xl">Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
    );
  }

  const statusConfig = subscription
    ? STATUS_CONFIG[subscription.status] ?? { label: subscription.status, variant: "outline" as const }
    : null;

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-purple text-white shadow-lg">
            <Search className="h-6 w-6" />
          </div>
          <div>
            <CardDescription>App subscription</CardDescription>
            <CardTitle className="text-2xl">Keywords Discovery Tool</CardTitle>
          </div>
        </div>
        {statusConfig && (
          <Badge variant={statusConfig.variant} className="text-xs uppercase">
            {statusConfig.label}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {subscription ? (
          <>
            {/* Pricing */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-foreground">
                {formatAmount(subscription.amount, subscription.currency)}
              </span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </div>

            {/* Details grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Next billing
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {subscription.nextBillingDate
                    ? format(new Date(subscription.nextBillingDate), "MMMM d, yyyy")
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Coins className="h-3.5 w-3.5" />
                  Monthly credits
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">300</p>
              </div>
            </div>

            {/* Cancel notice */}
            {subscription.cancelAtPeriodEnd && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Cancellation pending
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Your subscription will end on{" "}
                    {subscription.nextBillingDate
                      ? format(new Date(subscription.nextBillingDate), "MMMM d, yyyy")
                      : "the next billing date"}
                    . You keep access until then.
                  </p>
                </div>
              </div>
            )}

            {/* Paused notice */}
            {subscription.isPaused && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                <Pause className="mt-0.5 h-4 w-4 text-blue-600" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    Subscription paused
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    {subscription.resumeAt
                      ? `Auto-resumes on ${format(new Date(subscription.resumeAt), "MMMM d, yyyy")}.`
                      : "Your subscription is currently paused."}
                    {" "}Your existing credits are retained.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium text-foreground">No active subscription</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Subscribe to Keywords for $29/mo and get 300 credits monthly to power your SEO research.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-3">
        {subscription ? (
          <>
            <Button className="gap-2" asChild>
              <a href="https://keywords.bfeai.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Launch Keywords
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={onManage}
              disabled={manageLoading}
            >
              {manageLoading ? "Opening..." : "Manage Billing"}
            </Button>
            {!subscription.cancelAtPeriodEnd && subscription.status === "active" && (
              <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              className="gap-2"
              onClick={onSubscribe}
              disabled={subscribeLoading}
            >
              {subscribeLoading ? "Redirecting..." : "Subscribe to Keywords - $29/mo"}
            </Button>
            {onStartTrial && (
              <Button
                variant="outline"
                className="gap-1.5 border-brand-indigo/40 text-brand-indigo hover:bg-brand-indigo/5 hover:text-brand-indigo"
                onClick={onStartTrial}
                disabled={trialLoading}
              >
                {trialLoading ? "Redirecting..." : "Try for $1 — 7 days"}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
};
