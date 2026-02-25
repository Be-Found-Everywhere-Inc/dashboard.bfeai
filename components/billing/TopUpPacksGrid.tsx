import { useState } from "react";
import { Zap, Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@bfeai/ui";
import { toast } from "@bfeai/ui";

type TopUpPack = {
  key: string;
  name: string;
  credits: number;
  price: number;
  bestValue?: boolean;
};

const TOPUP_PACKS: TopUpPack[] = [
  { key: "starter", name: "Starter Boost", credits: 75, price: 9 },
  { key: "builder", name: "Builder Pack", credits: 270, price: 29 },
  { key: "power", name: "Power Pack", credits: 980, price: 99, bestValue: true },
  { key: "pro", name: "Pro Pack", credits: 2500, price: 249 },
  { key: "max", name: "Max Pack", credits: 5250, price: 499 },
];

type TopUpPacksGridProps = {
  onPurchase: (packKey: string) => Promise<string>;
  purchaseLoading?: boolean;
};

export const TopUpPacksGrid = ({
  onPurchase,
  purchaseLoading,
}: TopUpPacksGridProps) => {
  const [purchasingKey, setPurchasingKey] = useState<string | null>(null);

  const handlePurchase = async (pack: TopUpPack) => {
    setPurchasingKey(pack.key);
    try {
      const url = await onPurchase(pack.key);
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Purchase failed",
        description: error instanceof Error ? error.message : "Unable to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-brand-indigo" />
        <h3 className="text-lg font-heading font-semibold text-foreground">Top-Up Credit Packs</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Need more credits? Purchase a one-time top-up pack. Credits never expire and are used before your subscription credits.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TOPUP_PACKS.map((pack) => {
          const isLoading = purchaseLoading && purchasingKey === pack.key;
          return (
            <Card
              key={pack.key}
              className={`relative card-hover-lift ${
                pack.bestValue
                  ? "border-brand-indigo/50 ring-1 ring-brand-indigo/20 shadow-sm"
                  : "border-border"
              }`}
            >
              {pack.bestValue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-brand-indigo text-white gap-1">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className={`pb-2 ${pack.bestValue ? "pt-5" : ""}`}>
                <CardDescription className="text-xs">{pack.name}</CardDescription>
                <CardTitle className="flex items-baseline gap-1">
                  <span className="text-2xl">${pack.price}</span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-semibold text-foreground">
                      {pack.credits.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full btn-press"
                  variant={pack.bestValue ? "default" : "outline"}
                  disabled={isLoading || Boolean(purchaseLoading)}
                  onClick={() => void handlePurchase(pack)}
                >
                  {isLoading ? "Redirecting..." : "Buy Now"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
