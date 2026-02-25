import { Coins, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bfeai/ui";
import type { CreditBalance } from "@/services/BillingService";

type CreditBalanceCardProps = {
  balance: CreditBalance | null;
  isLoading?: boolean;
  /** If provided, renders a link/button to navigate to credits page */
  onViewCredits?: () => void;
};

export const CreditBalanceCard = ({
  balance,
  isLoading,
  onViewCredits,
}: CreditBalanceCardProps) => {
  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-indigo/5 via-transparent to-brand-teal/5" aria-hidden />
        <CardHeader className="relative">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-6 w-32 animate-pulse rounded bg-muted mt-1" />
        </CardHeader>
        <CardContent className="relative">
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-indigo/5 via-transparent to-brand-teal/5" aria-hidden />
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <div>
            <p className="text-xs text-muted-foreground">Credits</p>
            <h3 className="text-lg font-heading font-semibold">Credit Balance</h3>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-teal text-white shadow-lg">
            <Coins className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="relative">
          <p className="text-sm text-muted-foreground">
            Subscribe to an app to start earning credits.
          </p>
        </CardContent>
      </Card>
    );
  }

  const capPercent = balance.cap > 0
    ? Math.min(100, Math.round((balance.subscriptionBalance / balance.cap) * 100))
    : 0;

  return (
    <Card className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-indigo/6 via-transparent to-brand-teal/4" aria-hidden />
      {/* Decorative circle */}
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-brand-indigo/5 blur-2xl" aria-hidden />

      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <div>
          <p className="text-xs text-muted-foreground">Credits</p>
          <h3 className="text-lg font-heading font-semibold">Credit Balance</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-teal text-white shadow-lg animate-float">
          <Coins className="h-5 w-5" />
        </div>
      </CardHeader>

      <CardContent className="relative space-y-5">
        {/* Total balance — large and prominent */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-heading font-extrabold text-foreground tracking-tight">
            {balance.total.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">credits available</span>
        </div>

        {/* Pool breakdown — visual cards */}
        <div className={`grid gap-3 ${balance.trialBalance > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
          {balance.trialBalance > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/20 p-3 transition-colors hover:bg-amber-50/70 dark:hover:bg-amber-950/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Trial</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {balance.trialBalance.toLocaleString()}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Trial credits from your $1 trial. Used first.</p>
                  <p>These expire at the end of your trial period.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-xl border border-brand-indigo/15 bg-brand-indigo/5 dark:bg-brand-indigo/10 p-3 transition-colors hover:bg-brand-indigo/8 dark:hover:bg-brand-indigo/15">
                  <p className="text-xs font-medium text-brand-indigo mb-1">Subscription</p>
                  <p className="text-xl font-bold text-foreground">
                    {balance.subscriptionBalance.toLocaleString()}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Monthly credits from your subscription.</p>
                <p>Caps at {balance.cap.toLocaleString()} (3x monthly).</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-xl border border-brand-teal/15 bg-brand-teal/5 dark:bg-brand-teal/10 p-3 transition-colors hover:bg-brand-teal/8 dark:hover:bg-brand-teal/15">
                  <p className="text-xs font-medium text-brand-teal mb-1">Top-up</p>
                  <p className="text-xl font-bold text-foreground">
                    {balance.topupBalance.toLocaleString()}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Credits from top-up purchases. No cap.</p>
                <p>These are used after trial credits.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Subscription cap progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Subscription pool</span>
            <span className="font-medium">
              {balance.subscriptionBalance.toLocaleString()} / {balance.cap.toLocaleString()}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-indigo to-brand-teal transition-all duration-700 ease-out"
              style={{ width: `${capPercent}%` }}
            />
          </div>
          {capPercent >= 100 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Subscription credits at cap. Monthly allocation paused until you use some.
            </p>
          )}
        </div>

        {/* Lifetime stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-brand-indigo" />
            Earned: {balance.lifetimeEarned.toLocaleString()}
          </span>
          <span>Spent: {balance.lifetimeSpent.toLocaleString()}</span>
        </div>
      </CardContent>

      {onViewCredits && (
        <CardFooter className="relative flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-2 btn-press"
            onClick={onViewCredits}
          >
            <TrendingUp className="h-4 w-4" />
            Top up credits
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-2 btn-press"
            onClick={onViewCredits}
          >
            View credit history
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
