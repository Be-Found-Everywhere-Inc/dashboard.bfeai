# BFEAI Developer Integration Guide
## For Co-founders Bringing Apps into the Ecosystem

**Version:** 2.0
**Last Updated:** January 17, 2026
**GitHub Org:** https://github.com/Be-Found-Everywhere-Inc

---

> **🤖 Using AI to Integrate?**
>
> Copy the contents of **`BFEAI_Integration_Prompt.md`** into your AI coding assistant (Claude Code, Cursor, Copilot, etc.) to automate the integration process. The prompt references this guide and includes all critical implementation rules.

---

> **Important:** This guide contains critical learnings from production debugging. Pay special attention to the **Cookie Clearing** and **Logout Implementation** sections - these contain fixes that took significant effort to discover.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How SSO Authentication Works](#2-how-sso-authentication-works)
3. [Critical: Logout Implementation](#3-critical-logout-implementation)
4. [Before You Start (Prerequisites)](#4-before-you-start-prerequisites)
5. [Integration Steps](#5-integration-steps)
6. [Code Files to Add to Your App](#6-code-files-to-add-to-your-app)
7. [Environment Variables](#7-environment-variables)
8. [Testing Your Integration](#8-testing-your-integration)
9. [Common Issues & Debugging](#9-common-issues--debugging)
10. [Final Checklist](#10-final-checklist)
11. [Getting Help](#11-getting-help)

---

## 1. Architecture Overview

### The BFEAI Ecosystem

BFEAI is a multi-app SaaS ecosystem where all apps share a single login system and centralized payments. Users log in once and can access any app they're subscribed to.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         .bfeai.com Domain                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   bfeai.com     │  │ accounts.bfeai  │  │ payments.bfeai  │     │
│  │   (Landing)     │  │ (Login/Signup)  │  │   (Billing)     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ keywords.bfeai  │  │ yourapp.bfeai   │  │ anotherapp.bfeai│     │
│  │   (SEO Tool)    │  │  (Your App!)    │  │  (Future App)   │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                      Shared Infrastructure                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              Supabase (Central Database)                      │ │
│  │  • Single project for ALL apps                                │ │
│  │  • Shared auth tables (users, profiles, subscriptions)        │ │
│  │  • App-specific schemas (your app gets its own schema)        │ │
│  │  • Row Level Security (users only see their own data)         │ │
│  │                                                               │ │
│  │  URL: https://wmhnkxkyettbeeamuppz.supabase.co               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              Chargebee + Stripe (Payments)                    │ │
│  │  • Managed by payments.bfeai.com                              │ │
│  │  • Your app just checks subscription status via API           │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Subdomains

| Subdomain | Purpose | Who Manages It |
|-----------|---------|----------------|
| `bfeai.com` | Marketing landing page | Core team |
| `accounts.bfeai.com` | Login, signup, password reset, profile | Core team |
| `payments.bfeai.com` | Subscriptions, checkout, billing | Core team |
| `admin.bfeai.com` | Internal admin dashboard | Core team |
| `keywords.bfeai.com` | Keywords SEO tool | Core team |
| `yourapp.bfeai.com` | **Your app!** | **You** |

### What You're Responsible For

As a co-founder bringing an app into the ecosystem, you handle:

- ✅ Building your app's core functionality
- ✅ Adding the shared auth code (provided in this guide)
- ✅ Checking subscription status before showing features
- ✅ Deploying your app to your subdomain
- ✅ Creating your app-specific database tables (in your schema)

You do NOT need to worry about:

- ❌ Building login/signup pages (accounts.bfeai.com handles this)
- ❌ Processing payments (payments.bfeai.com handles this)
- ❌ Managing users (Supabase handles this)
- ❌ SSL certificates (Netlify handles this)

---

## 2. How SSO Authentication Works

### The Login Flow

When a user visits your app, here's what happens:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User visits yourapp.bfeai.com                                        │
│           │                                                              │
│           ▼                                                              │
│  2. Your app checks for 'bfeai_session' cookie                          │
│           │                                                              │
│           ├─── Cookie EXISTS ───────────────────────────────┐            │
│           │                                                 │            │
│           ▼                                                 ▼            │
│  3. Cookie MISSING                               4. Verify JWT token     │
│           │                                                 │            │
│           ▼                                                 ├── Valid    │
│  Redirect to:                                               │            │
│  accounts.bfeai.com/login?redirect=yourapp.bfeai.com        ▼            │
│           │                                      5. Check subscription   │
│           ▼                                         status via API       │
│  User logs in or signs up                                   │            │
│           │                                                 ├── Active   │
│           ▼                                                 │            │
│  accounts.bfeai.com sets cookie                             ▼            │
│  for '.bfeai.com' domain                         6. Show your app! ✓     │
│           │                                                              │
│           ▼                                                              │
│  Redirect back to yourapp.bfeai.com                                      │
│  (Now cookie exists, flow continues at step 4)                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### The Magic: Domain-Wide Cookies

The secret sauce is the cookie domain setting:

```javascript
// When accounts.bfeai.com sets the session cookie:
cookies().set('bfeai_session', token, {
  domain: '.bfeai.com',  // <-- The leading dot is crucial!
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60  // 7 days
});
```

Because the cookie is set for `.bfeai.com` (with the leading dot), it's automatically available to:
- `accounts.bfeai.com` ✓
- `payments.bfeai.com` ✓
- `keywords.bfeai.com` ✓
- `yourapp.bfeai.com` ✓
- Any future `*.bfeai.com` subdomain ✓

This is how Single Sign-On (SSO) works — one login, access everywhere.

---

## 3. Critical: Logout Implementation

> ⚠️ **CRITICAL SECTION**: This section documents a production bug that took significant debugging to solve. Follow these instructions exactly.

### The Problem

When a user logs out from any app in the ecosystem, the session cookie must be cleared across ALL subdomains. This seems simple but has several gotchas:

1. **Cookie attributes must match exactly** - To clear a cookie, you must set it with the SAME attributes (Domain, Path, etc.) as when it was created
2. **Browser compatibility varies** - Some browsers require `Max-Age=0`, others require `Expires` in the past
3. **API consistency matters** - If you set cookies with Next.js `cookies()` API but clear them with manual headers, it may not work

### The Solution: Dual-Method Cookie Clearing

When implementing logout, you MUST use BOTH methods to ensure cookies are cleared:

```typescript
// In your logout API route (e.g., /api/auth/logout/route.ts)
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = '.bfeai.com';  // MUST have leading dot!

  // ═══════════════════════════════════════════════════════════════
  // METHOD 1: Next.js cookies() API (Primary - same as login route)
  // ═══════════════════════════════════════════════════════════════
  const cookieStore = await cookies();
  cookieStore.set('bfeai_session', '', {
    domain: cookieDomain,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 0,  // Immediately expire
    path: '/',
  });

  // ═══════════════════════════════════════════════════════════════
  // METHOD 2: Manual Set-Cookie header (Backup for browser compat)
  // Use BOTH Max-Age=0 AND Expires for maximum compatibility
  // ═══════════════════════════════════════════════════════════════
  const expireDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
  const cookieParts = [
    'bfeai_session=',           // Empty value
    `Domain=${cookieDomain}`,   // Same domain as login
    'Path=/',                   // Same path as login
    'Max-Age=0',                // For modern browsers
    `Expires=${expireDate}`,    // For older browsers
    'HttpOnly',                 // Security: no JS access
    'SameSite=Lax',             // CSRF protection
  ];
  if (isProduction) {
    cookieParts.push('Secure'); // HTTPS only in production
  }
  const setCookieValue = cookieParts.join('; ');

  // Create response with manual header as backup
  const response = new NextResponse(
    JSON.stringify({ success: true, message: 'Logged out successfully' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
  response.headers.append('Set-Cookie', setCookieValue);

  return response;
}
```

### Why Both Methods?

| Method | Purpose |
|--------|---------|
| `cookies().set()` | Consistent with how login sets the cookie - ensures same internal handling |
| Manual `Set-Cookie` header | Backup for edge cases, includes both `Max-Age=0` AND `Expires` |

### Cookie Attribute Requirements

**Every attribute must match between setting and clearing:**

| Attribute | Value | Why |
|-----------|-------|-----|
| `Domain` | `.bfeai.com` | Leading dot = all subdomains |
| `Path` | `/` | Root path for all routes |
| `HttpOnly` | `true` | Prevents JavaScript access (XSS protection) |
| `Secure` | `true` (production) | HTTPS only |
| `SameSite` | `lax` | CSRF protection while allowing redirects |

### Logout Flow from Your App

When a user clicks "Logout" in your app, redirect them to the accounts service:

```typescript
// In your app's logout handler
const handleLogout = () => {
  // Redirect to accounts.bfeai.com/logout
  // This ensures the cookie is cleared on the main auth domain
  window.location.href = 'https://accounts.bfeai.com/logout';
};
```

The accounts service will:
1. Clear the `bfeai_session` cookie on `.bfeai.com` domain
2. Sign out from Supabase
3. Redirect to `/login?message=logged_out`

### Middleware: Redirect Logged-In Users Away from Login

Users who are already logged in shouldn't see the login page. Add this to your middleware:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('bfeai_session');

  // If user is logged in and visits login/signup/root, redirect to dashboard
  if (sessionCookie?.value && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ... rest of middleware
}
```

---

## 4. Before You Start (Prerequisites)

### What You Need

1. **Your subdomain assigned** — Confirm with the core team what your subdomain will be (e.g., `yourapp.bfeai.com`)

2. **Environment variables** — You'll receive these from the core team:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`

3. **Your app registered** — The core team needs to:
   - Add your app to the ecosystem registry
   - Create your database schema in Supabase
   - Configure your pricing plans in Chargebee

4. **Development environment:**
   - Node.js 18 or higher
   - npm or yarn
   - Git

### Confirm Your App Name

Your app name is a lowercase identifier used throughout the system. Examples:
- `keywords` (for keywords.bfeai.com)
- `backlinks` (for backlinks.bfeai.com)
- `content` (for content.bfeai.com)

**Write down your app name: ________________**

This will be used in:
- Environment variables (`NEXT_PUBLIC_APP_NAME=yourapp`)
- Database schema (`yourapp.tablename`)
- Subscription checks (`subscriptions['yourapp']`)

---

## 4. Integration Steps

### Step-by-Step Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    INTEGRATION CHECKLIST                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  □ Step 1: Install required packages                           │
│  □ Step 2: Add environment variables                           │
│  □ Step 3: Add the auth library files (copy from Section 5)    │
│  □ Step 4: Set up middleware for protected routes              │
│  □ Step 5: Add the AuthProvider to your app                    │
│  □ Step 6: Add subscription checks to premium features         │
│  □ Step 7: Add shared navigation component                     │
│  □ Step 8: Test the integration locally                        │
│  □ Step 9: Deploy to Netlify                                   │
│  □ Step 10: Test SSO across domains                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Step 1: Install Required Packages

Run this command in your project root:

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs js-cookie jsonwebtoken
```

Or if using yarn:

```bash
yarn add @supabase/supabase-js @supabase/auth-helpers-nextjs js-cookie jsonwebtoken
```

**For TypeScript projects, also install types:**

```bash
npm install -D @types/js-cookie @types/jsonwebtoken
```

### Step 2: Add Environment Variables

Create a file called `.env.local` in your project root (or update it if it exists):

```env
# App Identity
NEXT_PUBLIC_APP_NAME=yourapp

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret (must match accounts.bfeai.com)
JWT_SECRET=your_jwt_secret_here

# URLs
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.bfeai.com
NEXT_PUBLIC_PAYMENTS_URL=https://payments.bfeai.com
```

> ⚠️ **IMPORTANT:** Get the actual values for `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` from the core team. Never commit these to git!

**Add to `.gitignore`:**

```
.env.local
.env*.local
```

### Step 3: Add Auth Library Files

Copy all the files from [Section 5](#5-code-files-to-add-to-your-app) into your project. The file structure should look like:

```
your-app/
├── src/
│   └── lib/
│       └── bfeai-auth/
│           ├── index.ts
│           ├── AuthProvider.tsx
│           ├── useAuth.ts
│           ├── authHelpers.ts
│           ├── subscriptionCheck.ts
│           └── types.ts
├── middleware.ts
├── .env.local
└── package.json
```

### Step 4: Set Up Middleware

The middleware file goes in your project root (not in `src/`). See the complete code in Section 5.

### Step 5: Add AuthProvider to Your App

Wrap your app with the AuthProvider. 

**For Next.js App Router (`app/layout.tsx`):**

```tsx
import { AuthProvider } from '@/lib/bfeai-auth';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

**For Next.js Pages Router (`pages/_app.tsx`):**

```tsx
import { AuthProvider } from '@/lib/bfeai-auth';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

### Step 6: Add Subscription Checks

For any feature that requires a subscription, use the `useAuth` hook:

```tsx
import { useAuth } from '@/lib/bfeai-auth';

export function PremiumFeature() {
  const { user, subscription, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!subscription || subscription.status !== 'active') {
    return (
      <div>
        <h2>Upgrade Required</h2>
        <p>This feature requires an active subscription.</p>
        <a href="https://payments.bfeai.com/subscribe?app=yourapp">
          View Plans
        </a>
      </div>
    );
  }
  
  return (
    <div>
      {/* Your premium feature content */}
    </div>
  );
}
```

### Step 7: Add Shared Navigation

Every app should include navigation that allows users to switch between apps and manage their account:

```tsx
import { useAuth } from '@/lib/bfeai-auth';

export function Navigation() {
  const { user, logout } = useAuth();
  
  return (
    <nav className="bfeai-nav">
      <div className="logo">
        <a href="/">YourApp</a>
      </div>
      
      {/* App Switcher */}
      <div className="app-switcher">
        <select onChange={(e) => window.location.href = e.target.value}>
          <option value="">Switch App</option>
          <option value="https://keywords.bfeai.com">Keywords Tool</option>
          <option value="https://yourapp.bfeai.com">Your App</option>
          {/* Add other apps as they launch */}
        </select>
      </div>
      
      {/* User Menu */}
      <div className="user-menu">
        {user && (
          <>
            <span>{user.email}</span>
            <a href="https://payments.bfeai.com/subscriptions">
              Manage Subscriptions
            </a>
            <a href="https://accounts.bfeai.com/profile">
              Profile
            </a>
            <button onClick={logout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
```

---

## 5. Code Files to Add to Your App

Copy these files exactly into your project. Create the folder structure as shown.

### File Structure

```
your-app/
├── src/
│   └── lib/
│       └── bfeai-auth/
│           ├── index.ts           (exports everything)
│           ├── types.ts           (TypeScript types)
│           ├── authHelpers.ts     (utility functions)
│           ├── useAuth.ts         (React hook)
│           ├── AuthProvider.tsx   (React context provider)
│           └── subscriptionCheck.ts (subscription verification)
└── middleware.ts                  (route protection)
```

---

### File 1: `src/lib/bfeai-auth/types.ts`

```typescript
// src/lib/bfeai-auth/types.ts
// Type definitions for BFEAI authentication

export interface BFEAIUser {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  role: 'user' | 'admin' | 'employee';
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  appName: string;
  status: 'active' | 'cancelled' | 'expired' | 'trialing' | 'past_due';
  planId: string;
  planName?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface AuthState {
  user: BFEAIUser | null;
  subscription: Subscription | null;
  subscriptions: Record<string, Subscription>;
  loading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkSubscription: (appName: string) => Promise<boolean>;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}
```

---

### File 2: `src/lib/bfeai-auth/authHelpers.ts`

```typescript
// src/lib/bfeai-auth/authHelpers.ts
// Utility functions for authentication

import Cookies from 'js-cookie';
import type { JWTPayload } from './types';

const COOKIE_NAME = 'bfeai_session';
const COOKIE_DOMAIN = '.bfeai.com';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
const PAYMENTS_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL || 'https://payments.bfeai.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'unknown';

/**
 * Get the session token from cookies
 */
export function getSessionToken(): string | undefined {
  return Cookies.get(COOKIE_NAME);
}

/**
 * Remove the session cookie (logout)
 * Note: This only clears the client-side cookie reference.
 * For full logout, always redirect to accounts.bfeai.com/logout
 * which properly clears the cookie on the auth domain.
 */
export function clearSessionToken(): void {
  // Remove from current domain
  Cookies.remove(COOKIE_NAME);

  // Also try to remove from .bfeai.com domain
  Cookies.remove(COOKIE_NAME, { domain: COOKIE_DOMAIN });
}

/**
 * Perform full logout by redirecting to accounts service
 * This is the RECOMMENDED way to logout - it ensures the cookie
 * is properly cleared across all subdomains.
 */
export function performLogout(): void {
  // Always redirect to accounts logout endpoint
  // This ensures cookie is cleared using the same method it was set
  if (typeof window !== 'undefined') {
    window.location.href = `${ACCOUNTS_URL}/logout`;
  }
}

/**
 * Decode a JWT token without verification (client-side)
 * Note: This is for reading the payload only. Verification happens server-side.
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  return payload.exp * 1000 < Date.now();
}

/**
 * Redirect to login page
 */
export function redirectToLogin(returnUrl?: string): void {
  const currentUrl = returnUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const loginUrl = `${ACCOUNTS_URL}/login?redirect=${encodeURIComponent(currentUrl)}`;
  
  if (typeof window !== 'undefined') {
    window.location.href = loginUrl;
  }
}

/**
 * Redirect to subscription page
 */
export function redirectToSubscribe(planId?: string): void {
  let subscribeUrl = `${PAYMENTS_URL}/subscribe?app=${APP_NAME}`;
  if (planId) {
    subscribeUrl += `&plan=${planId}`;
  }
  
  if (typeof window !== 'undefined') {
    window.location.href = subscribeUrl;
  }
}

/**
 * Get the current app name
 */
export function getAppName(): string {
  return APP_NAME;
}

/**
 * Build API URL for payments service
 */
export function getPaymentsApiUrl(path: string): string {
  return `${PAYMENTS_URL}/api${path}`;
}

/**
 * Build API URL for accounts service
 */
export function getAccountsApiUrl(path: string): string {
  return `${ACCOUNTS_URL}/api${path}`;
}
```

---

### File 3: `src/lib/bfeai-auth/subscriptionCheck.ts`

```typescript
// src/lib/bfeai-auth/subscriptionCheck.ts
// Functions for checking subscription status

import type { Subscription } from './types';
import { getSessionToken, getPaymentsApiUrl, getAppName } from './authHelpers';

/**
 * Fetch all subscriptions for the current user
 */
export async function fetchUserSubscriptions(): Promise<Record<string, Subscription>> {
  const token = getSessionToken();
  
  if (!token) {
    throw new Error('No session token');
  }
  
  const response = await fetch(getPaymentsApiUrl('/subscriptions'), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }
  
  const data = await response.json();
  return data.subscriptions || {};
}

/**
 * Fetch subscription for a specific app
 */
export async function fetchAppSubscription(appName?: string): Promise<Subscription | null> {
  const app = appName || getAppName();
  const token = getSessionToken();
  
  if (!token) {
    throw new Error('No session token');
  }
  
  const response = await fetch(getPaymentsApiUrl(`/subscriptions/check?app=${app}`), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // No subscription found
    }
    throw new Error('Failed to check subscription');
  }
  
  const data = await response.json();
  return data.subscription || null;
}

/**
 * Check if user has active subscription for an app
 */
export async function hasActiveSubscription(appName?: string): Promise<boolean> {
  try {
    const subscription = await fetchAppSubscription(appName);
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Check subscription status synchronously from cached data
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Check if subscription is expiring soon (within 7 days)
 */
export function isSubscriptionExpiringSoon(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  
  const endDate = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const daysUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
}
```

---

### File 4: `src/lib/bfeai-auth/useAuth.ts`

```typescript
// src/lib/bfeai-auth/useAuth.ts
// React hook for accessing auth state

import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import type { AuthContextValue } from './types';

/**
 * Hook to access authentication state and methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, subscription, loading, logout } = useAuth();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>Not logged in</div>;
 *   
 *   return <div>Hello, {user.email}</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Make sure your app is wrapped with <AuthProvider>.'
    );
  }
  
  return context;
}
```

---

### File 5: `src/lib/bfeai-auth/AuthProvider.tsx`

```typescript
// src/lib/bfeai-auth/AuthProvider.tsx
// React context provider for authentication

'use client';

import React, { createContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { AuthState, AuthContextValue, BFEAIUser, Subscription } from './types';
import {
  getSessionToken,
  clearSessionToken,
  decodeToken,
  isTokenExpired,
  redirectToLogin,
  getAppName,
} from './authHelpers';
import { fetchUserSubscriptions, fetchAppSubscription } from './subscriptionCheck';

// Create the context
export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    subscription: null,
    subscriptions: {},
    loading: true,
    error: null,
  });

  const supabase = createClientComponentClient();
  const appName = getAppName();

  /**
   * Fetch user profile from Supabase
   */
  const fetchUserProfile = useCallback(async (userId: string): Promise<BFEAIUser | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        company: data.company,
        role: data.role || 'user',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }, [supabase]);

  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    try {
      const token = getSessionToken();

      // No token - redirect to login
      if (!token) {
        redirectToLogin();
        return;
      }

      // Token expired - redirect to login
      if (isTokenExpired(token)) {
        clearSessionToken();
        redirectToLogin();
        return;
      }

      // Decode token to get user ID
      const payload = decodeToken(token);
      if (!payload) {
        clearSessionToken();
        redirectToLogin();
        return;
      }

      // Fetch user profile
      const user = await fetchUserProfile(payload.userId);
      if (!user) {
        // User not found in database - might need to create profile
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: 'User profile not found',
        }));
        return;
      }

      // Fetch subscriptions
      let subscriptions: Record<string, Subscription> = {};
      let currentSubscription: Subscription | null = null;

      try {
        subscriptions = await fetchUserSubscriptions();
        currentSubscription = subscriptions[appName] || null;
      } catch (subError) {
        console.warn('Could not fetch subscriptions:', subError);
        // Continue without subscriptions - user is still authenticated
      }

      setAuthState({
        user,
        subscription: currentSubscription,
        subscriptions,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: 'Authentication failed',
      }));
    }
  }, [fetchUserProfile, appName]);

  /**
   * Logout user
   * IMPORTANT: Always redirect to accounts.bfeai.com/logout
   * This ensures the cookie is cleared using the same method it was set.
   * See Section 3 "Critical: Logout Implementation" for details.
   */
  const logout = useCallback(async () => {
    try {
      // Sign out from Supabase (optional - accounts.bfeai.com will also do this)
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signout error (non-fatal):', error);
    }

    // CRITICAL: Redirect to accounts logout endpoint
    // This ensures cookie is properly cleared across all subdomains
    // The accounts service uses dual-method clearing (cookies() API + manual header)
    window.location.href = `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/logout`;
  }, [supabase]);

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    await initializeAuth();
  }, [initializeAuth]);

  /**
   * Check subscription for a specific app
   */
  const checkSubscription = useCallback(async (targetApp: string): Promise<boolean> => {
    try {
      const subscription = await fetchAppSubscription(targetApp);
      return subscription?.status === 'active' || subscription?.status === 'trialing';
    } catch {
      return false;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Context value
  const contextValue: AuthContextValue = {
    ...authState,
    logout,
    refreshAuth,
    checkSubscription,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

### File 6: `src/lib/bfeai-auth/index.ts`

```typescript
// src/lib/bfeai-auth/index.ts
// Main entry point - exports all auth functionality

// Components
export { AuthProvider, AuthContext } from './AuthProvider';

// Hooks
export { useAuth } from './useAuth';

// Types
export type {
  BFEAIUser,
  Subscription,
  AuthState,
  AuthContextValue,
  JWTPayload,
} from './types';

// Helpers
export {
  getSessionToken,
  clearSessionToken,
  performLogout,  // Recommended way to logout
  decodeToken,
  isTokenExpired,
  redirectToLogin,
  redirectToSubscribe,
  getAppName,
  getPaymentsApiUrl,
  getAccountsApiUrl,
} from './authHelpers';

// Subscription utilities
export {
  fetchUserSubscriptions,
  fetchAppSubscription,
  hasActiveSubscription,
  isSubscriptionActive,
  isSubscriptionExpiringSoon,
} from './subscriptionCheck';
```

---

### File 7: `middleware.ts` (Project Root)

```typescript
// middleware.ts
// This file goes in your PROJECT ROOT (not in src/)
// It protects routes and handles authentication redirects

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/',              // Landing/home page (if you have one)
  '/pricing',       // Pricing page (if you have one)
  '/about',         // About page (if you have one)
  '/api/public',    // Public API endpoints
  '/_next',         // Next.js internals
  '/favicon.ico',   // Favicon
];

// Routes that require a subscription (not just authentication)
const SUBSCRIPTION_REQUIRED_PATHS = [
  '/dashboard',
  '/app',
  '/reports',
  '/api/protected',
  // Add your premium routes here
];

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
const PAYMENTS_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL || 'https://payments.bfeai.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'unknown';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get the session cookie
  const token = request.cookies.get('bfeai_session')?.value;

  // No token - redirect to login
  if (!token) {
    const loginUrl = new URL('/login', ACCOUNTS_URL);
    loginUrl.searchParams.set('redirect', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token is not expired (basic check)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      // Token expired - redirect to login
      const response = NextResponse.redirect(new URL('/login', ACCOUNTS_URL));
      response.cookies.delete('bfeai_session');
      return response;
    }

    // For subscription-required paths, check subscription
    if (SUBSCRIPTION_REQUIRED_PATHS.some(path => pathname.startsWith(path))) {
      // Make API call to check subscription
      const subCheckUrl = `${PAYMENTS_URL}/api/subscriptions/check?app=${APP_NAME}&user=${payload.userId}`;
      
      try {
        const subResponse = await fetch(subCheckUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (subResponse.ok) {
          const { hasAccess } = await subResponse.json();
          
          if (!hasAccess) {
            // No subscription - redirect to subscribe page
            const subscribeUrl = new URL('/subscribe', PAYMENTS_URL);
            subscribeUrl.searchParams.set('app', APP_NAME);
            subscribeUrl.searchParams.set('redirect', request.url);
            return NextResponse.redirect(subscribeUrl);
          }
        }
      } catch (subError) {
        console.error('Subscription check failed:', subError);
        // On error, allow through but log it
        // The component-level check will handle it
      }
    }

    // Token valid - proceed
    return NextResponse.next();

  } catch (error) {
    console.error('Token verification failed:', error);
    // Invalid token - redirect to login
    const response = NextResponse.redirect(new URL('/login', ACCOUNTS_URL));
    response.cookies.delete('bfeai_session');
    return response;
  }
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
```

---

## 6. Environment Variables

### Complete `.env.local` Template

```env
# ============================================
# BFEAI App Configuration
# ============================================

# Your app's unique identifier (lowercase, no spaces)
# Examples: keywords, backlinks, content, analytics
NEXT_PUBLIC_APP_NAME=yourapp

# ============================================
# Supabase Configuration
# Get these from the core team
# ============================================

# Supabase project URL
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co

# Supabase anonymous key (safe for client-side)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Supabase service role key (server-side only, never expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ============================================
# JWT Configuration
# Must match the secret used by accounts.bfeai.com
# ============================================

JWT_SECRET=your_jwt_secret_here

# ============================================
# BFEAI Service URLs
# ============================================

NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.bfeai.com
NEXT_PUBLIC_PAYMENTS_URL=https://payments.bfeai.com
NEXT_PUBLIC_MAIN_SITE_URL=https://bfeai.com

# ============================================
# Your App's URLs (update for production)
# ============================================

NEXT_PUBLIC_APP_URL=https://yourapp.bfeai.com

# ============================================
# Optional: Analytics & Monitoring
# ============================================

# Sentry (error tracking)
# SENTRY_DSN=your_sentry_dsn_here

# ============================================
# Optional: Your App-Specific API Keys
# Add any API keys your specific app needs
# ============================================

# Example:
# OPENAI_API_KEY=your_openai_key_here
# SOME_OTHER_API_KEY=your_key_here
```

### Environment Variables Explained

| Variable | Public? | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_NAME` | Yes | Your app's identifier used in subscription checks |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key for client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO** | Admin key - never expose to client |
| `JWT_SECRET` | **NO** | Secret for verifying JWT tokens |
| `NEXT_PUBLIC_ACCOUNTS_URL` | Yes | URL for the accounts service |
| `NEXT_PUBLIC_PAYMENTS_URL` | Yes | URL for the payments service |

> ⚠️ **Security Note:** Variables starting with `NEXT_PUBLIC_` are exposed to the browser. Never put sensitive keys in `NEXT_PUBLIC_` variables!

---

## 7. Testing Your Integration

### Local Development Testing

Since SSO cookies require the `.bfeai.com` domain, local testing requires some setup.

#### Option A: Test Without SSO (Recommended for Initial Development)

During initial development, you can bypass the SSO check:

1. Create a file `src/lib/bfeai-auth/mockAuth.ts` for development:

```typescript
// src/lib/bfeai-auth/mockAuth.ts
// ONLY FOR LOCAL DEVELOPMENT - Remove before deploying!

export const MOCK_USER = {
  id: 'test-user-id',
  email: 'dev@test.com',
  fullName: 'Test Developer',
  company: 'Test Company',
  role: 'user' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_SUBSCRIPTION = {
  id: 'test-sub-id',
  userId: 'test-user-id',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'yourapp',
  status: 'active' as const,
  planId: 'pro',
  planName: 'Pro Plan',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancelAtPeriodEnd: false,
};
```

2. Modify `AuthProvider.tsx` to use mock data in development (add at the top of `initializeAuth`):

```typescript
// Add this at the start of initializeAuth function
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true') {
  const { MOCK_USER, MOCK_SUBSCRIPTION } = await import('./mockAuth');
  setAuthState({
    user: MOCK_USER,
    subscription: MOCK_SUBSCRIPTION,
    subscriptions: { [appName]: MOCK_SUBSCRIPTION },
    loading: false,
    error: null,
  });
  return;
}
```

3. Add to `.env.local`:

```env
NEXT_PUBLIC_USE_MOCK_AUTH=true
```

4. **Remove mock auth before deploying!** Set `NEXT_PUBLIC_USE_MOCK_AUTH=false` or remove it entirely.

#### Option B: Test with Real SSO (Requires Deployment)

To test actual SSO:

1. Deploy your app to a test subdomain (e.g., `yourapp-dev.bfeai.com`)
2. Test the full flow:
   - Visit `yourapp-dev.bfeai.com`
   - Get redirected to `accounts.bfeai.com/login`
   - Log in
   - Get redirected back to your app

### Testing Checklist

```
┌────────────────────────────────────────────────────────────────┐
│                    TESTING CHECKLIST                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Authentication Flow:                                          │
│  □ Unauthenticated user is redirected to login                │
│  □ After login, user is redirected back to your app           │
│  □ User data displays correctly (email, name)                  │
│  □ Logout clears session and redirects to accounts logout      │
│                                                                │
│  Subscription Checks:                                          │
│  □ Premium features show upgrade prompt when no subscription  │
│  □ Premium features work when subscription is active          │
│  □ Subscription status updates after subscribing              │
│                                                                │
│  Cross-Domain SSO:                                             │
│  □ Log in at accounts.bfeai.com                               │
│  □ Visit keywords.bfeai.com - should be logged in             │
│  □ Visit yourapp.bfeai.com - should be logged in              │
│  □ Logout from any app logs out everywhere                    │
│                                                                │
│  Error Handling:                                               │
│  □ Expired token redirects to login                           │
│  □ Invalid token redirects to login                           │
│  □ Network errors show appropriate messages                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### CRITICAL: Full Multi-Domain E2E Test

This is the **mandatory** end-to-end test you must perform before deploying. This test must include **ALL apps currently in the ecosystem**.

> ⚠️ **Important:** Each time a new app joins the ecosystem, the E2E test scope expands. You must verify SSO works across ALL existing domains, not just yours. The test below shows 3 domains as an example, but you must include every `*.bfeai.com` app that exists.

**Current Ecosystem Apps (update this list as apps are added):**
- `accounts.bfeai.com` (auth - always included)
- `payments.bfeai.com` (billing - always included)
- `keywords.bfeai.com`
- `yourapp.bfeai.com` (your new app)
- _(add future apps here as they launch)_

```
┌────────────────────────────────────────────────────────────────┐
│             MULTI-DOMAIN SSO END-TO-END TEST                   │
│         (Test ALL apps in ecosystem, not just 3)               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  TEST FLOW A: Starting from Your App                           │
│  ─────────────────────────────────────────────────────────────│
│  1. Navigate to yourapp.bfeai.com (unauthenticated)           │
│     → EXPECT: Redirect to accounts.bfeai.com/login            │
│                                                                │
│  2. Log in with valid credentials                              │
│     → EXPECT: Redirect back to yourapp.bfeai.com              │
│                                                                │
│  3. Navigate to EACH other app in the ecosystem:               │
│     • payments.bfeai.com → EXPECT: Already logged in          │
│     • keywords.bfeai.com → EXPECT: Already logged in          │
│     • (any other apps)   → EXPECT: Already logged in          │
│                                                                │
│  4. Navigate to accounts.bfeai.com                             │
│     → EXPECT: Shows profile page (NOT login page!)            │
│                                                                │
│  5. Click "Logout" or navigate to accounts.bfeai.com/logout   │
│     → EXPECT: Redirect to accounts.bfeai.com/login            │
│                                                                │
│  6. Navigate to EACH app again to verify logout:               │
│     • yourapp.bfeai.com  → EXPECT: Redirect to login          │
│     • payments.bfeai.com → EXPECT: Redirect to login          │
│     • keywords.bfeai.com → EXPECT: Redirect to login          │
│     • (any other apps)   → EXPECT: Redirect to login          │
│                                                                │
│  ─────────────────────────────────────────────────────────────│
│  TEST FLOW B: Repeat from Each App                             │
│  ─────────────────────────────────────────────────────────────│
│  Run the same test starting from EACH app in the ecosystem    │
│  to verify bidirectional SSO works from any entry point.       │
│                                                                │
│  If there are N apps, you should run N complete test flows.    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Scaling the Test

As the ecosystem grows, testing becomes more important:

| # of Apps | Test Flows Required | SSO Checks per Flow |
|-----------|---------------------|---------------------|
| 3 apps | 3 complete flows | 2 SSO + 2 logout verifications |
| 5 apps | 5 complete flows | 4 SSO + 4 logout verifications |
| 10 apps | 10 complete flows | 9 SSO + 9 logout verifications |

**Recommendation:** Consider automating this test with Playwright as the ecosystem grows. A single test file can loop through all domains programmatically.

### Key Test Verification Points

| Step | What to Check | How to Verify |
|------|---------------|---------------|
| After login | Cookie is set | DevTools → Application → Cookies → `.bfeai.com` |
| SSO to other apps | No login prompt | Directly access protected routes |
| At accounts.bfeai.com (logged in) | Shows profile | Should NOT show login page |
| After logout | Cookie is cleared | DevTools shows no `bfeai_session` cookie |
| Post-logout navigation | Redirects to login | All apps require re-authentication |

### Debug Mode (Optional)

Add a debug endpoint to your app to verify cookie status:

```typescript
// app/api/debug/route.ts (REMOVE IN PRODUCTION!)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('bfeai_session');

  if (!sessionCookie?.value) {
    return NextResponse.json({
      decision: 'redirect_to_login',
      reason: 'no_cookie',
      pathname: request.nextUrl.pathname,
    });
  }

  try {
    const parts = sessionCookie.value.split('.');
    const payload = JSON.parse(atob(parts[1]));

    return NextResponse.json({
      decision: 'allow',
      reason: 'token_valid',
      pathname: request.nextUrl.pathname,
      payload: {
        userId: payload.userId,
        exp: payload.exp,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      decision: 'redirect_to_login',
      reason: 'invalid_token',
      pathname: request.nextUrl.pathname,
    });
  }
}
```

Use it: `https://yourapp.bfeai.com/api/debug`

---

## 8. Common Issues & Debugging

### Issue 1: "useAuth must be used within an AuthProvider"

**Cause:** You're using the `useAuth` hook in a component that's not wrapped by `AuthProvider`.

**Solution:** Make sure `AuthProvider` wraps your entire app in `layout.tsx` or `_app.tsx`:

```tsx
// app/layout.tsx
import { AuthProvider } from '@/lib/bfeai-auth';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>   {/* <-- This must wrap everything */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

### Issue 2: Cookie Not Clearing on Logout (CRITICAL)

**Symptoms:**
- User logs out but is still logged in when visiting other apps
- Cookie still visible in DevTools after logout
- User can access protected routes after "logging out"

**Root Cause:** Using different methods to SET and CLEAR cookies.

**The Problem:**
```typescript
// ❌ WRONG - Login uses cookies() API but logout uses manual header
// Login:
const cookieStore = await cookies();
cookieStore.set('bfeai_session', token, { ... });

// Logout:
response.headers.set('Set-Cookie', 'bfeai_session=; Max-Age=0; ...');
```

**The Solution:**
```typescript
// ✅ CORRECT - Use BOTH methods in logout
export async function POST(request: NextRequest) {
  // Method 1: Same API as login used to SET the cookie
  const cookieStore = await cookies();
  cookieStore.set('bfeai_session', '', {
    domain: '.bfeai.com',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  // Method 2: Manual header as backup (includes BOTH Max-Age and Expires)
  const cookieParts = [
    'bfeai_session=',
    'Domain=.bfeai.com',
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
  ];
  response.headers.append('Set-Cookie', cookieParts.join('; '));

  return response;
}
```

**Key Insight:** Always clear cookies using the SAME method they were set with, plus a backup.

---

### Issue 3: Logged-In User Sees Login Page on Accounts Site

**Symptoms:**
- User is logged in on payments.bfeai.com or keywords.bfeai.com
- User navigates to accounts.bfeai.com
- User sees login page instead of profile page

**Cause:** Middleware allows public routes without checking if user is already authenticated.

**Solution:** Add a redirect check at the START of your middleware:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('bfeai_session');

  // ✅ ADD THIS: Redirect logged-in users away from auth pages
  if (sessionCookie?.value && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/profile', request.url));
  }

  // ... rest of middleware
}
```

---

### Issue 4: Cookie Not Being Set / SSO Not Working

**Symptoms:**
- User logs in but gets redirected back to login
- Cookie exists on `accounts.bfeai.com` but not on `yourapp.bfeai.com`

**Causes & Solutions:**

1. **Domain mismatch:** The cookie must be set for `.bfeai.com` (with leading dot)
   - This is handled by `accounts.bfeai.com` - contact core team if this seems wrong

2. **Not on bfeai.com domain:** SSO only works on `*.bfeai.com` subdomains
   - `localhost` won't work with the production cookie
   - Use mock auth for local development

3. **Secure cookie on non-HTTPS:** The cookie has `secure: true`
   - Make sure your deployed site uses HTTPS (Netlify handles this automatically)

---

### Issue 5: "Failed to fetch subscriptions"

**Symptoms:**
- User is logged in but subscription checks fail
- Console shows network error for payments API

**Causes & Solutions:**

1. **CORS issue:** The payments API might not allow requests from your domain
   - Contact core team to add your subdomain to CORS whitelist

2. **Token not being sent:** Check that the Authorization header is included
   ```typescript
   // Make sure this is in your fetch call:
   headers: {
     'Authorization': `Bearer ${token}`,
   }
   ```

3. **Token expired:** The subscription API rejected an expired token
   - The middleware should handle this, but check token expiration

---

### Issue 6: Middleware Not Running

**Symptoms:**
- Unauthenticated users can access protected routes
- No redirects happening

**Causes & Solutions:**

1. **Middleware file in wrong location:** Must be in project root, not in `src/`
   ```
   your-app/
   ├── middleware.ts    ✓ Correct
   ├── src/
   │   └── middleware.ts    ✗ Wrong location
   ```

2. **Matcher not configured correctly:** Check the `config.matcher` in middleware.ts

3. **Next.js version:** Middleware requires Next.js 12.2+

---

### Issue 7: Environment Variables Not Loading

**Symptoms:**
- `process.env.NEXT_PUBLIC_*` returns `undefined`
- API calls going to wrong URLs

**Causes & Solutions:**

1. **Restart dev server:** After changing `.env.local`, restart:
   ```bash
   # Stop the server (Ctrl+C), then:
   npm run dev
   ```

2. **Variable naming:** Client-side variables MUST start with `NEXT_PUBLIC_`
   ```env
   # ✓ Accessible in browser
   NEXT_PUBLIC_APP_NAME=yourapp
   
   # ✗ NOT accessible in browser (server only)
   APP_NAME=yourapp
   ```

3. **File name:** Must be exactly `.env.local` (not `.env`, not `env.local`)

---

### Issue 8: TypeScript Errors

**Symptoms:**
- Red squiggly lines in VS Code
- Build fails with type errors

**Common fixes:**

1. **Missing types:** Install type packages:
   ```bash
   npm install -D @types/js-cookie @types/jsonwebtoken
   ```

2. **Module not found:** Check your import paths use `@/` correctly:
   ```typescript
   // Make sure tsconfig.json has:
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

---

### Debugging Tips

**Check the cookie:**
```javascript
// In browser console:
document.cookie
// Look for 'bfeai_session=...'
```

**Decode the JWT:**
```javascript
// In browser console:
const token = document.cookie.split('; ').find(c => c.startsWith('bfeai_session='))?.split('=')[1];
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('Token payload:', payload);
  console.log('Expires:', new Date(payload.exp * 1000));
}
```

**Check Supabase connection:**
```typescript
// Add temporarily to debug:
const { data, error } = await supabase.from('profiles').select('*').limit(1);
console.log('Supabase test:', { data, error });
```

---

## 9. Final Checklist

Before deploying, verify everything is working:

```
┌────────────────────────────────────────────────────────────────┐
│              PRE-DEPLOYMENT CHECKLIST                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Code & Configuration:                                         │
│  □ All auth library files added to src/lib/bfeai-auth/        │
│  □ middleware.ts is in project root                           │
│  □ AuthProvider wraps the entire app                          │
│  □ Environment variables configured                           │
│  □ .env.local is in .gitignore                               │
│  □ Mock auth disabled (NEXT_PUBLIC_USE_MOCK_AUTH=false)       │
│                                                                │
│  Subscription Integration:                                     │
│  □ Premium features check subscription status                 │
│  □ Upgrade prompts link to payments.bfeai.com                 │
│  □ NEXT_PUBLIC_APP_NAME matches registered app name           │
│                                                                │
│  UI/UX:                                                        │
│  □ Shared navigation component added                          │
│  □ User can see their email when logged in                    │
│  □ Logout button works                                        │
│  □ App switcher allows navigation to other apps               │
│                                                                │
│  Netlify Deployment:                                           │
│  □ Environment variables set in Netlify dashboard             │
│  □ Custom domain configured (yourapp.bfeai.com)               │
│  □ SSL certificate active (automatic with Netlify)            │
│                                                                │
│  Testing:                                                      │
│  □ SSO flow tested end-to-end                                 │
│  □ Subscription check tested                                  │
│  □ Logout tested                                              │
│  □ Error states tested                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 10. Getting Help

### Contact the Core Team

If you run into issues:

1. **Check this guide first** — Most common issues are covered in Section 8
2. **Check the GitHub repo** — Look for existing issues or discussions
3. **Reach out to the core team** — For environment variables, domain setup, or infrastructure issues

### Useful Links

| Resource | URL |
|----------|-----|
| GitHub Organization | https://github.com/Be-Found-Everywhere-Inc |
| Supabase Dashboard | https://supabase.com/dashboard/project/wmhnkxkyettbeeamuppz |
| Netlify Dashboard | https://app.netlify.com |
| Main PRD Document | (Request from core team) |

### What the Core Team Needs From You

When your app is ready to join the ecosystem:

1. **Your app name** — The lowercase identifier (e.g., `backlinks`)
2. **Your subdomain** — Confirm it (e.g., `backlinks.bfeai.com`)
3. **Your pricing plans** — What tiers/features you want to offer
4. **Your database schema** — What tables your app needs (core team will create the schema)
5. **Your GitHub repo** — So the team can review the integration

---

## Appendix A: Quick Reference

### Import Cheatsheet

```typescript
// Everything you might need to import:
import {
  // Components
  AuthProvider,

  // Hooks
  useAuth,

  // Types
  BFEAIUser,
  Subscription,

  // Helpers
  performLogout,      // ← Recommended way to logout
  redirectToLogin,
  redirectToSubscribe,
  getAppName,

  // Subscription checks
  hasActiveSubscription,
  isSubscriptionActive,
} from '@/lib/bfeai-auth';
```

### Common Patterns

**Check if user is logged in:**
```typescript
const { user, loading } = useAuth();
if (loading) return <Loading />;
if (!user) return <LoginPrompt />;
```

**Check subscription status:**
```typescript
const { subscription } = useAuth();
const hasAccess = subscription?.status === 'active';
```

**Logout (Recommended - using useAuth hook):**
```typescript
const { logout } = useAuth();
<button onClick={logout}>Logout</button>
// This redirects to accounts.bfeai.com/logout which properly clears the cookie
```

**Logout (Direct redirect - without React context):**
```typescript
import { performLogout } from '@/lib/bfeai-auth';
<button onClick={performLogout}>Logout</button>
// Also redirects to accounts.bfeai.com/logout
```

**Redirect to subscribe:**
```typescript
import { redirectToSubscribe } from '@/lib/bfeai-auth';
<button onClick={() => redirectToSubscribe('pro')}>Upgrade to Pro</button>
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2025 | Initial release |
| 2.0 | January 17, 2026 | **Critical Update:** Added Section 3 "Logout Implementation" with dual-method cookie clearing fix. Added Issue 2 and Issue 3 documenting cookie clearing bugs and fixes. Added comprehensive 3-domain E2E testing flow. Updated AuthProvider logout to redirect to accounts.bfeai.com. Added `performLogout()` helper function. |

---

## Key Learnings Summary

These are the most important things discovered during production debugging:

### 1. Cookie Clearing Must Match Cookie Setting
If you set a cookie using `cookies().set()`, you must clear it the same way. Mismatched methods = cookie not cleared.

### 2. Use Both Max-Age AND Expires
For browser compatibility, always include BOTH `Max-Age=0` AND `Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

### 3. Always Redirect to Accounts for Logout
Never try to clear the SSO cookie from your app directly. Always redirect to `accounts.bfeai.com/logout`.

### 4. Redirect Logged-In Users Away from Login Pages
Add middleware logic to redirect authenticated users to their dashboard/profile when they visit auth pages.

### 5. Test ALL Domains in the Ecosystem
As new apps join, the test scope grows. Always test SSO across **every** `*.bfeai.com` app, not just a subset. If there are 5 apps, test all 5. If there are 10 apps, test all 10. Automate with Playwright as the ecosystem scales.

---

*This guide is maintained by the BFEAI core team. For updates or corrections, please submit a pull request or contact the team.*
