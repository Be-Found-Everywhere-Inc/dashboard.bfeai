'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  User,
  Settings,
  Sparkles,
  CreditCard,
  LogOut,
  Search,
  Headphones,
  Menu,
  ChevronLeft,
  Coins,
  LayoutDashboard,
} from 'lucide-react';

import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@bfeai/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { BugReportWidget } from '@/components/bug-report/BugReportWidget';
import { useCredits } from '@/hooks/use-credits';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Billing & Invoices', href: '/billing', icon: CreditCard },
  { label: 'Credits', href: '/credits', icon: Coins },
  { label: 'Explore Apps', href: '/apps', icon: Sparkles },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const APP_LINKS = [
  {
    label: 'Keywords Tool',
    href: 'https://keywords.bfeai.com',
    icon: Search,
    description: 'SEO keyword research',
  },
  {
    label: 'LABS',
    href: 'https://labs.bfeai.com',
    icon: Sparkles,
    description: 'AI visibility monitoring',
  },
];

const BOTTOM_LINKS = [
  {
    label: 'Support',
    href: 'mailto:support@bfeai.com',
    icon: Headphones,
  },
];

interface UserData {
  email: string;
  fullName?: string;
  avatarUrl?: string;
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
  const router = useRouter();
  const { state, toggleSidebar } = useSidebar();
  const credits = useCredits();
  const isCollapsed = state === 'collapsed';

  const initials = useMemo(() => {
    if (user?.fullName) {
      return user.fullName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
    if (user?.email) {
      return user.email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return 'BF';
  }, [user]);

  const firstName =
    user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'friend';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-indigo"></div>
      </div>
    );
  }

  return (
    <>
      {/* Sidebar */}
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3 top-6 z-10 w-6 h-6 items-center justify-center rounded-full border border-sidebar-border bg-background shadow-sm hover:bg-accent transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={cn(
              'h-3 w-3 text-muted-foreground transition-transform duration-200',
              isCollapsed && 'rotate-180'
            )}
          />
        </button>

        <SidebarHeader className="p-4">
          {/* Logo/Brand Header */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-indigo text-white shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className={cn('transition-opacity', isCollapsed && 'hidden')}>
              <span className="text-lg font-semibold text-foreground group-hover:text-brand-indigo transition-colors">
                Dashboard
              </span>
            </div>
          </a>
          <p className={cn('mt-2 text-xs text-muted-foreground line-clamp-2', isCollapsed && 'hidden')}>
            Manage your account, billing, and apps.
          </p>
        </SidebarHeader>

        <SidebarContent>
          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupLabel className={cn('text-xs font-semibold uppercase tracking-[0.2em]', isCollapsed && 'sr-only')}>
              Account
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => router.push(item.href)}
                        tooltip={item.label}
                        className={cn(
                          isActive &&
                            'bg-brand-indigo text-white hover:bg-brand-indigo/90 hover:text-white'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Apps Section */}
          <SidebarGroup>
            <SidebarGroupLabel className={cn('text-xs font-semibold uppercase tracking-[0.2em]', isCollapsed && 'sr-only')}>
              Your Apps
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {APP_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild tooltip={item.label}>
                        <a href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 space-y-3">
          {/* User Info */}
          <div className={cn('flex items-center gap-3 px-2', isCollapsed && 'justify-center px-0')}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName || 'User'}
                className={cn('rounded-full object-cover shrink-0', isCollapsed ? 'h-9 w-9' : 'h-8 w-8')}
              />
            ) : (
              <div className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-brand-indigo/10 text-brand-indigo font-semibold text-xs',
                isCollapsed ? 'h-9 w-9' : 'h-8 w-8'
              )}>
                {initials}
              </div>
            )}
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user?.fullName || 'User'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            )}
          </div>

          {/* Credit Balance */}
          {credits && (
            <a
              href="/credits"
              title={isCollapsed ? `${credits.total} credits` : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-accent/50',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <Coins className="h-4 w-4 shrink-0 text-amber-500" />
              {!isCollapsed && (
                <div>
                  <span className="font-semibold text-foreground">{credits.total}</span>
                  <span className="ml-1 text-xs text-muted-foreground">credits</span>
                </div>
              )}
            </a>
          )}

          {/* Bottom Links */}
          {BOTTOM_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && item.label}
              </a>
            );
          })}

          {/* Theme Toggle Row */}
          <div className={cn('flex items-center px-3 py-2', isCollapsed ? 'justify-center px-0' : 'justify-between')}>
            {!isCollapsed && <span className="text-sm text-muted-foreground">Theme</span>}
            {isCollapsed ? (
              <ThemeToggle size="sm" syncToCookie compact />
            ) : (
              <ThemeToggle size="sm" syncToCookie />
            )}
          </div>

          {/* Log Out Button */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            title={isCollapsed ? 'Log out' : undefined}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/50',
              isCollapsed && 'px-2'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && (isLoggingOut ? 'Logging out...' : 'Log out')}
          </button>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content */}
      <SidebarInset>
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:hidden">
          <SidebarTrigger className="-ml-1">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </SidebarTrigger>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-indigo text-white">
              <User className="h-4 w-4" />
            </div>
            <span className="font-semibold">Accounts</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {/* Welcome Header */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Manage your account, billing, and connected apps.
                </p>
                <h1 className="text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">
                  Welcome back, {firstName}.
                </h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="h-11 gap-2 rounded-lg bg-brand-indigo text-white shadow-lg shadow-brand-indigo/40 hover:bg-brand-indigo/90"
                  onClick={() => router.push('/apps')}
                >
                  <Sparkles className="h-4 w-4" />
                  Explore apps
                </Button>
              </div>
            </div>

            {/* Page Children */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              {children}
            </div>
          </div>
        </main>
        <BugReportWidget appSource="dashboard" />
      </SidebarInset>
    </>
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
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SidebarProvider defaultOpen={true} style={{ '--sidebar-width-icon': '4rem' } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background">
        <DashboardContent
          user={user}
          loading={loading}
          isLoggingOut={isLoggingOut}
          handleSignOut={handleSignOut}
        >
          {children}
        </DashboardContent>
      </div>
    </SidebarProvider>
  );
}
