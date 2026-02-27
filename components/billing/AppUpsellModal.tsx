'use client';

import { useState, useCallback, useEffect } from "react";
import {
  Search,
  Eye,
  Sparkles,
  Wand2,
  BarChart3,
  Star,
  FileDown,
  Radar,
  MessageSquareHeart,
  Users,
  CalendarClock,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Badge,
  Button,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@bfeai/ui";
import { APP_CATALOG, type AppKey } from "@/config/apps";

// ---------------------------------------------------------------------------
// Upsell data per app
// ---------------------------------------------------------------------------

type SellingPoint = {
  icon: React.ElementType;
  title: string;
  description: string;
};

type AppUpsellData = {
  sellingPoints: SellingPoint[];
  screenshots: string[];
};

const UPSELL_DATA: Record<AppKey, AppUpsellData> = {
  keywords: {
    sellingPoints: [
      {
        icon: Wand2,
        title: "AI Keyword Wizard",
        description: "Expand any seed keyword into hundreds of high-value opportunities using AI.",
      },
      {
        icon: BarChart3,
        title: "Competitive Metrics",
        description: "Search volume, CPC, keyword difficulty, and conversion rate predictions.",
      },
      {
        icon: Star,
        title: "Best Keywords Score",
        description: "Our proprietary score ranks keywords by actual revenue potential.",
      },
      {
        icon: FileDown,
        title: "Export Reports",
        description: "Download full keyword reports as CSV for clients or team sharing.",
      },
    ],
    screenshots: [
      "/images/upsell/keywords-1.png",
      "/images/upsell/keywords-2.png",
      "/images/upsell/keywords-3.png",
      "/images/upsell/keywords-4.png",
    ],
  },
  labs: {
    sellingPoints: [
      {
        icon: Radar,
        title: "6 AI Engines",
        description: "Monitor ChatGPT, Gemini, Perplexity, Claude, Google AI Overview, and AI Mode.",
      },
      {
        icon: MessageSquareHeart,
        title: "Sentiment Analysis",
        description: "Understand how AI talks about your brand — positive, neutral, or negative.",
      },
      {
        icon: Users,
        title: "Competitor Tracking",
        description: "See which competitors appear alongside your brand in AI answers.",
      },
      {
        icon: CalendarClock,
        title: "Scheduled Scans",
        description: "Automate recurring scans to track visibility trends over time.",
      },
    ],
    screenshots: [
      "/images/upsell/labs-1.png",
      "/images/upsell/labs-2.png",
      "/images/upsell/labs-3.png",
      "/images/upsell/labs-4.png",
    ],
  },
};

const ICON_MAP: Record<string, React.ElementType> = {
  Search,
  Eye,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type AppUpsellModalProps = {
  appKey: AppKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe: () => void;
  onStartTrial: () => void;
  subscribeLoading?: boolean;
  trialLoading?: boolean;
  currentStatus: 'subscribed' | 'trialing' | 'available';
  appUrl: string;
};

export function AppUpsellModal({
  appKey,
  open,
  onOpenChange,
  onSubscribe,
  onStartTrial,
  subscribeLoading,
  trialLoading,
  currentStatus,
  appUrl,
}: AppUpsellModalProps) {
  const app = APP_CATALOG[appKey];
  const upsell = UPSELL_DATA[appKey];
  const IconComponent = ICON_MAP[app.icon] || Sparkles;

  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    setSlideCount(api.scrollSnapList().length);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api, onSelect]);

  const isSubscribed = currentStatus === 'subscribed' || currentStatus === 'trialing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">{app.name} details</DialogTitle>

        {/* Image carousel */}
        <div className="relative">
          <Carousel setApi={setApi} opts={{ loop: true }} className="w-full">
            <CarouselContent>
              {upsell.screenshots.map((src, i) => (
                <CarouselItem key={i}>
                  <div className={`relative aspect-[16/9] bg-gradient-to-br ${app.gradient} overflow-hidden`}>
                    <img
                      src={src}
                      alt={`${app.name} screenshot ${i + 1}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback: hide broken image, show gradient bg
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* Gradient placeholder overlay (visible when image fails) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center text-white/60">
                        <IconComponent className="mx-auto h-12 w-12 mb-2 opacity-40" />
                        <p className="text-sm font-medium opacity-60">Screenshot {i + 1}</p>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border-0 shadow-lg h-9 w-9" />
            <CarouselNext className="right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border-0 shadow-lg h-9 w-9" />
          </Carousel>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {Array.from({ length: slideCount }).map((_, i) => (
              <button
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide ? 'w-6 bg-white' : 'w-2 bg-white/50'
                }`}
                onClick={() => api?.scrollTo(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* App info */}
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${app.gradient} text-white shadow-lg`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-heading font-bold text-foreground">{app.name}</h3>
                {isSubscribed && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
                    {currentStatus === 'trialing' ? 'Trial' : 'Active'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{app.description}</p>
            </div>
          </div>

          {/* Selling points 2x2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upsell.sellingPoints.map((point) => (
              <div
                key={point.title}
                className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${app.gradient} text-white`}>
                  <point.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{point.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA footer */}
          <div className="flex flex-col gap-3 sm:flex-row pt-2 border-t border-border">
            {isSubscribed ? (
              <Button className="flex-1 gap-2 btn-press" asChild>
                <a href={appUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Launch {app.shortName}
                </a>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 border-brand-indigo/40 text-brand-indigo hover:bg-brand-indigo/5 hover:text-brand-indigo btn-press"
                  disabled={trialLoading}
                  onClick={() => {
                    onStartTrial();
                    onOpenChange(false);
                  }}
                >
                  {trialLoading ? "Redirecting..." : "Try for $1 — 7 days"}
                </Button>
                <Button
                  className="flex-1 gap-2 btn-press"
                  disabled={subscribeLoading}
                  onClick={() => {
                    onSubscribe();
                    onOpenChange(false);
                  }}
                >
                  {subscribeLoading ? "Redirecting..." : `Subscribe — $${app.pricing?.monthly}/mo`}
                  {!subscribeLoading && <ArrowUpRight className="h-4 w-4" />}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
