'use client';

import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
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
  TrendingUp,
  DollarSign,
  Stethoscope,
  History,
  Clock,
  Bell,
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

type SlideData = {
  icon: React.ElementType;
  title: string;
  description: string;
  detail: string;
  /** Path base for screenshot (dark/light variants auto-resolved) */
  imageBase?: string;
};

type AppUpsellData = {
  sellingPoints: SellingPoint[];
  slides: SlideData[];
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
    slides: [
      {
        icon: Wand2,
        title: "AI Keyword Wizard",
        description: "Enter a seed keyword or URL and let AI expand it into hundreds of high-value opportunities.",
        detail: "AI-powered expansion engine",
      },
      {
        icon: BarChart3,
        title: "Competitive Metrics",
        description: "Get search volume, CPC, keyword difficulty, and conversion rate predictions for every keyword.",
        detail: "Real-time search data",
      },
      {
        icon: Star,
        title: "Best Keywords Score",
        description: "Our proprietary algorithm ranks keywords by actual revenue potential — not just volume.",
        detail: "Exclusive to BFEAI",
      },
      {
        icon: FileDown,
        title: "Export & Share",
        description: "Download full keyword reports as CSV. Share with clients or team members instantly.",
        detail: "One-click CSV export",
      },
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
    slides: [
      {
        icon: Radar,
        title: "Your AI Visibility Command Center",
        description: "Health scores, visibility share, engine coverage, and recent scans — all at a glance.",
        detail: "Real-time dashboard",
        imageBase: "/app-screenshots/labs/labs-dashboard",
      },
      {
        icon: TrendingUp,
        title: "Visibility Trends by Engine",
        description: "Track daily visibility across ChatGPT, Gemini, Perplexity, Claude, and Google — with per-engine breakdowns.",
        detail: "6 engines monitored",
        imageBase: "/app-screenshots/labs/labs-analytics",
      },
      {
        icon: DollarSign,
        title: "Lead Valuation Engine",
        description: "Quantify the monthly revenue at risk from AI invisibility. Compare your brand against competitors.",
        detail: "Revenue impact analysis",
        imageBase: "/app-screenshots/labs/labs-comp",
      },
      {
        icon: Stethoscope,
        title: "AI Invisibility Diagnosis",
        description: "Get AI-powered analysis of why your brand isn't being mentioned — with actionable steps to fix it.",
        detail: "Actionable recommendations",
        imageBase: "/app-screenshots/labs/labs-diagnosis",
      },
      {
        icon: History,
        title: "Complete Scan History",
        description: "Filter by engine, keyword, and date. Review sentiment, confidence scores, and citations for every scan.",
        detail: "Full audit trail",
        imageBase: "/app-screenshots/labs/labs-scan-history",
      },
      {
        icon: Clock,
        title: "Automated Scheduled Scans",
        description: "Set weekly or monthly scans across all engines with credit usage estimates — set it and forget it.",
        detail: "Hands-free monitoring",
        imageBase: "/app-screenshots/labs/labs-schedule",
      },
      {
        icon: Bell,
        title: "Smart Alert Notifications",
        description: "Get notified when visibility drops, competitors change, scans complete, or credits run low.",
        detail: "Never miss a change",
        imageBase: "/app-screenshots/labs/labs-alerts",
      },
    ],
  },
};

const ICON_MAP: Record<string, React.ElementType> = {
  Search,
  Eye,
};

// Per-slide visual variants — same app colors, different compositions
const SLIDE_VARIANTS: { gradient: string; badge: string; decor: React.ReactNode }[] = [
  {
    // Slide 1: diagonal gradient, top-right orb + bottom-left orb, rounded-2xl badge
    gradient: 'bg-gradient-to-br',
    badge: 'rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20',
    decor: (
      <>
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/8 blur-xl" />
        <div className="absolute top-6 right-8 h-16 w-16 rounded-2xl border border-white/10 rotate-12" />
      </>
    ),
  },
  {
    // Slide 2: left-to-right gradient, layered rounded rectangles, offset glow
    gradient: 'bg-gradient-to-r',
    badge: 'rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/15',
    decor: (
      <>
        <div className="absolute -top-6 right-16 h-36 w-36 rounded-3xl bg-white/[0.06] rotate-[18deg]" />
        <div className="absolute top-10 right-10 h-20 w-20 rounded-2xl bg-white/[0.05] rotate-[32deg]" />
        <div className="absolute -bottom-10 -left-6 h-44 w-44 rounded-3xl bg-white/[0.07] blur-xl" />
        <div className="absolute bottom-8 left-20 h-14 w-14 rounded-xl border border-white/10 -rotate-12" />
      </>
    ),
  },
  {
    // Slide 3: bottom-left to top-right gradient, grid pattern, rounded-xl badge
    gradient: 'bg-gradient-to-tr',
    badge: 'rounded-xl bg-white/10 backdrop-blur-md ring-1 ring-white/25 border border-white/10',
    decor: (
      <>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute -bottom-16 right-8 h-48 w-48 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute top-4 left-6 h-20 w-20 rounded-xl border border-white/10 -rotate-12" />
        <div className="absolute bottom-6 left-16 h-12 w-12 rounded-lg border border-white/8 rotate-6" />
      </>
    ),
  },
  {
    // Slide 4: top-left to bottom-right, diagonal stripe, pill badge
    gradient: 'bg-gradient-to-bl',
    badge: 'rounded-[20px] bg-white/12 backdrop-blur-sm ring-1 ring-white/20 shadow-xl',
    decor: (
      <>
        <div className="absolute -top-4 left-1/3 h-[140%] w-32 rotate-[25deg] bg-white/[0.04]" />
        <div className="absolute -top-4 left-1/3 ml-40 h-[140%] w-16 rotate-[25deg] bg-white/[0.03]" />
        <div className="absolute top-8 right-10 h-5 w-5 rounded-full border-2 border-white/15" />
        <div className="absolute bottom-8 left-10 h-8 w-8 rounded-full border-2 border-white/10" />
      </>
    ),
  },
];

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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0">
        <DialogTitle className="sr-only">{app.name} details</DialogTitle>

        {/* Feature highlight carousel */}
        <div className="relative overflow-hidden">
          <Carousel setApi={setApi} opts={{ loop: true }} className="w-full">
            <CarouselContent>
              {upsell.slides.map((slide, i) => (
                <CarouselItem key={i}>
                  {slide.imageBase ? (
                    /* Screenshot-based slide */
                    <div className="relative aspect-[16/9] overflow-hidden bg-gray-900">
                      <Image
                        src={`${slide.imageBase}-${isDark ? 'dark' : 'light'}.png`}
                        alt={slide.title}
                        fill
                        className="object-cover object-top"
                        sizes="(max-width: 672px) 100vw, 672px"
                        priority={i === 0}
                      />
                      {/* Bottom gradient overlay for text */}
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      {/* Slide text */}
                      <div className="absolute inset-x-0 bottom-0 flex items-end p-5 sm:p-6">
                        <div className="flex items-start gap-3 text-white">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${app.gradient} shadow-lg ring-1 ring-white/20`}>
                            <slide.icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base sm:text-lg font-heading font-bold leading-tight drop-shadow-md">{slide.title}</h4>
                            <p className="mt-0.5 text-xs sm:text-sm text-white/80 leading-snug line-clamp-2 drop-shadow-sm">{slide.description}</p>
                            <span className="mt-1.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] sm:text-xs font-medium text-white/90 backdrop-blur-sm">
                              {slide.detail}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Gradient-based slide (keywords fallback) */
                    <div className={`relative aspect-[16/9] overflow-hidden ${SLIDE_VARIANTS[i % SLIDE_VARIANTS.length].gradient} ${app.gradient}`}>
                      {SLIDE_VARIANTS[i % SLIDE_VARIANTS.length].decor}
                      <div className="relative flex h-full flex-col items-center justify-center px-8 text-center text-white">
                        <div className={`mb-4 flex h-16 w-16 items-center justify-center shadow-lg ${SLIDE_VARIANTS[i % SLIDE_VARIANTS.length].badge}`}>
                          <slide.icon className="h-8 w-8" />
                        </div>
                        <h4 className="text-xl font-heading font-bold mb-2">{slide.title}</h4>
                        <p className="max-w-md text-sm text-white/80 leading-relaxed">{slide.description}</p>
                        <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                          {slide.detail}
                        </span>
                      </div>
                    </div>
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border-0 shadow-lg h-9 w-9" />
            <CarouselNext className="right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border-0 shadow-lg h-9 w-9" />
          </Carousel>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {Array.from({ length: slideCount }).map((_, i) => (
              <button
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide ? 'w-6 bg-white shadow-md' : 'w-2 bg-white/50'
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
