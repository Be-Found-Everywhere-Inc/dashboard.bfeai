'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import {
  AppSidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  CreditsProvider,
  OutOfCreditsModal,
  useCredits as useOutOfCreditsContext,
  toast,
  type AutoTopUpState,
} from '@bfeai/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { BugReportWidget } from '@/components/bug-report/BugReportWidget';
import { useCredits } from '@/hooks/use-credits';
import { useCredits as useCreditsData } from '@/hooks/useCredits';

interface UserData {
  email: string;
  fullName?: string;
  avatarUrl?: string;
  userTier?: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
}

// Inner component that uses the sidebar context
function DashboardContent({
  children,
  user,
  loading,
  isLoggingOut,
  handleSignOut,
}: {
  children: React.ReactNode;
  user: UserData | null;
  loading: boolean;
  isLoggingOut: boolean;
  handleSignOut: () => void;
}) {
  const pathname = usePathname();
  const credits = useCredits();
  const { balance, invalidate } = useCreditsData();

  // Map balance.autoTopup → AutoTopUpState for CreditsProvider
  const autoTopup: AutoTopUpState | null = balance?.autoTopup ?? null;

  const handleRequestSetupIntent = useCallback(async () => {
    const res = await fetch('/.netlify/functions/setup-intent-create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? 'Failed to create setup intent');
    }
    return res.json() as Promise<{
      client_secret: string;
      existing_pm: { last4: string; brand: string } | null;
    }>;
  }, []);

  const handleConfirmAutoTopUp = useCallback(async (params: {
    autoTopUpEnabled: true;
    autoTopUpPackKey: string;
    autoTopUpMonthlyCapCents: number;
    autoTopUpPaymentMethodId: string;
  }) => {
    const res = await fetch('/.netlify/functions/settings-billing-update', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_topup_enabled: params.autoTopUpEnabled,
        auto_topup_pack_key: params.autoTopUpPackKey,
        auto_topup_monthly_cap_cents: params.autoTopUpMonthlyCapCents,
        auto_topup_payment_method_id: params.autoTopUpPaymentMethodId,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? 'Failed to save auto top-up settings');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-indigo"></div>
      </div>
    );
  }

  return (
    <CreditsProvider autoTopup={autoTopup}>
      {/* Sidebar */}
      <AppSidebar
        currentApp="dashboard"
        pathname={pathname}
        user={user}
        credits={credits ? { total: credits.total } : null}
        onLogout={handleSignOut}
        isLoggingOut={isLoggingOut}
        themeToggle={<ThemeToggle size="sm" syncToCookie compact />}
        showOffpage={true}
      />

      {/* Main Content */}
      <SidebarInset>
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:hidden">
          <SidebarTrigger className="-ml-1">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </SidebarTrigger>
          <div className="flex items-center gap-2">
            <img src="/brand/BFE_Icon_TRN.png" alt="BFEAI" className="h-8 w-8 rounded-lg" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-extrabold tracking-tight text-foreground">BFEAI</span>
                <span className="text-[10px] font-medium text-muted-foreground">{"\u201C"}BEEFY{"\u201D"}</span>
              </div>
              <span className="text-[8px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Be Found Everywhere</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </div>
        <BugReportWidget appSource="dashboard" />
      </SidebarInset>

      {/* Out-of-credits modal \u2014 mounted once at shell level */}
      <OutOfCreditsModalMount
        invalidateCredits={invalidate}
        onRequestSetupIntent={handleRequestSetupIntent}
        onConfirmAutoTopUp={handleConfirmAutoTopUp}
      />
    </CreditsProvider>
  );
}

/**
 * Modal mount inside CreditsProvider so we can call closeOutOfCreditsModal()
 * after a successful off-session quick-charge. Lives here (not in the parent)
 * because useOutOfCreditsContext() requires being inside <CreditsProvider>.
 */
function OutOfCreditsModalMount({
  invalidateCredits,
  onRequestSetupIntent,
  onConfirmAutoTopUp,
}: {
  invalidateCredits: () => void;
  onRequestSetupIntent: () => Promise<{ client_secret: string; existing_pm: { last4: string; brand: string } | null }>;
  onConfirmAutoTopUp: (params: {
    autoTopUpEnabled: true;
    autoTopUpPackKey: string;
    autoTopUpMonthlyCapCents: number;
    autoTopUpPaymentMethodId: string;
  }) => Promise<void>;
}) {
  const { closeOutOfCreditsModal } = useOutOfCreditsContext();

  return (
    <OutOfCreditsModal
      manageCreditsUrl="/credits"
      onPurchase={async (pack) => {
        const res = await fetch('/.netlify/functions/credits-topup', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packKey: pack.key }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? 'Could not start checkout');
        }
        const data = await res.json() as
          | { url: string }
          | { ok: true; creditsAdded: number; balance: number; packName: string };

        if ('url' in data) {
          // No saved PM (or quick-charge fell back) \u2014 redirect to Stripe Checkout
          window.location.href = data.url;
          return;
        }

        // Off-session success \u2014 credits already allocated, refresh + close + toast
        invalidateCredits();
        toast({
          title: `Added ${data.creditsAdded.toLocaleString()} credits`,
          description: `${data.packName} purchased on your saved card. New balance: ${data.balance.toLocaleString()}.`,
        });
        closeOutOfCreditsModal();
      }}
      stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      onRequestSetupIntent={onRequestSetupIntent}
      onConfirmAutoTopUp={onConfirmAutoTopUp}
    />
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        router.push('/login');
        return;
      }

      const sessionData = await response.json();
      if (!sessionData.authenticated) {
        router.push('/login');
        return;
      }

      // Fetch profile for more details
      const profileResponse = await fetch('/api/profile');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setUser({
          email: sessionData.user.email,
          fullName: profileData.full_name,
          avatarUrl: profileData.avatar_url,
          userTier: profileData.user_tier,
        });
      } else {
        setUser({
          email: sessionData.user.email,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/.netlify/functions/auth-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        console.error('Logout request failed:', response.status, await response.text().catch(() => ''));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      router.push('/login');
    }
  };

  return (
    <SidebarProvider defaultOpen={true} style={{ '--sidebar-width-icon': '4rem' } as React.CSSProperties}>
      <DashboardContent
        user={user}
        loading={loading}
        isLoggingOut={isLoggingOut}
        handleSignOut={handleSignOut}
      >
        {children}
      </DashboardContent>
    </SidebarProvider>
  );
}
