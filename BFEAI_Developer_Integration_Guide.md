# BFEAI Developer Integration Guide
## For Co-founders Bringing Apps into the Ecosystem

**Version:** 1.1  
**Last Updated:** January 2025  
**GitHub Org:** https://github.com/Be-Found-Everywhere-Inc

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How SSO Authentication Works](#2-how-sso-authentication-works)
3. [Before You Start (Prerequisites)](#3-before-you-start-prerequisites)
4. [Integration Steps](#4-integration-steps)
5. [Code Files to Add to Your App](#5-code-files-to-add-to-your-app)
6. [Environment Variables](#6-environment-variables)
7. [Testing Your Integration](#7-testing-your-integration)
8. [Common Issues & Debugging](#8-common-issues--debugging)
9. [Final Checklist](#9-final-checklist)
10. [Getting Help](#10-getting-help)

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

### HttpOnly Cookie Security

The `bfeai_session` cookie is set with the `HttpOnly` flag for security. This means:

```javascript
// ❌ Client-side JavaScript CANNOT read the cookie
document.cookie // Won't contain bfeai_session
Cookies.get('bfeai_session') // Returns undefined (js-cookie library)

// ✅ Server-side code CAN read the cookie
const cookieStore = await cookies();
const token = cookieStore.get('bfeai_session')?.value; // Works!
```

**Why HttpOnly?** It prevents XSS (Cross-Site Scripting) attacks from stealing authentication tokens. Even if malicious JavaScript runs on the page, it cannot access the session cookie.

**Implication for your app:** Your client-side React code cannot directly read the cookie. Instead, use an API endpoint (see Section 5 for the `/api/auth/me` pattern).

---

## 2.5. Netlify/Edge Runtime Critical Requirements

> ⚠️ **CRITICAL:** If you're deploying to Netlify (or any Edge runtime), you MUST follow these patterns or SSO will break!

### The `atob()` Problem

The `atob()` function (used for base64 decoding) is a **browser API** that does NOT exist in Netlify's Edge runtime. Your code will fail silently or throw errors.

```javascript
// ❌ WRONG - Will fail in Netlify Edge runtime
const decoded = atob(base64String);

// ✅ CORRECT - Works everywhere (Node.js, Edge, Browser via bundler)
const decoded = Buffer.from(base64String, 'base64').toString('utf-8');
```

### Where This Matters

Every place that decodes JWT tokens must use `Buffer.from()`:

| Location | Why It's Affected |
|----------|-------------------|
| `middleware.ts` | Runs in Edge runtime |
| `(protected)/layout.tsx` | Server component, may run in Edge |
| `/api/auth/*` routes | Server functions |
| `lib/bfeai-auth/server.ts` | Server-side helpers |

### JWT Decoding Pattern (Use This Everywhere)

```typescript
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Convert URL-safe base64 back to standard base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');

    // Use Buffer.from (NOT atob) for Edge runtime compatibility
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');

    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
```

### Netlify Cookie Redirect Problem

Netlify may strip `Set-Cookie` headers from redirect responses. This breaks the normal OAuth flow.

**The Problem:**
```
1. User completes OAuth on accounts.bfeai.com
2. Server tries to: Set-Cookie + Redirect to keywords.bfeai.com
3. Netlify strips the Set-Cookie header 😱
4. User arrives at keywords.bfeai.com without a cookie
5. Gets redirected back to login → infinite loop!
```

**The Solution: Intermediate Page Pattern**
```
1. User completes OAuth on accounts.bfeai.com
2. Redirect to /sso-complete page (no cookie yet)
3. Page makes POST request to /api/auth/set-sso-cookie
4. API returns 200 with Set-Cookie header (not a redirect!)
5. Cookie is set successfully ✓
6. Page does client-side redirect to final destination
```

See Section 5 for the complete implementation of this pattern.

---

## 3. Before You Start (Prerequisites)

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
 */
export function clearSessionToken(): void {
  // Remove from current domain
  Cookies.remove(COOKIE_NAME);
  
  // Also try to remove from .bfeai.com domain
  Cookies.remove(COOKIE_NAME, { domain: COOKIE_DOMAIN });
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
//
// ⚠️ IMPORTANT: The bfeai_session cookie is HttpOnly, so this component
// CANNOT read it directly. Instead, it calls /api/auth/me to get user info.

'use client';

import React, { createContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { AuthState, AuthContextValue, BFEAIUser, Subscription } from './types';
import {
  clearSessionToken,
  getAppName,
  getAccountsUrl,
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

  const appName = getAppName();

  // Initialize Supabase client - only on client side
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key || typeof window === 'undefined') {
      return null;
    }

    return createBrowserClient(url, key);
  }, []);

  /**
   * Fetch user profile from Supabase
   */
  const fetchUserProfile = useCallback(async (userId: string): Promise<BFEAIUser | null> => {
    if (!supabase) return null;

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
   *
   * ⚠️ CRITICAL: The bfeai_session cookie is HttpOnly, so we CANNOT read it
   * from JavaScript. Instead, we call /api/auth/me which reads the cookie
   * server-side and returns user info.
   *
   * Server-side middleware and layout already validate auth before this runs,
   * so if we reach this code, the user should be authenticated.
   */
  const initializeAuth = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      // ⚠️ Call API to get user info (server can read HttpOnly cookie)
      const response = await fetch('/api/auth/me', { credentials: 'include' });

      if (!response.ok) {
        // Not authenticated - server-side will handle redirect
        console.log('[AuthProvider] Not authenticated via API');
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: null,
        }));
        return;
      }

      const data = await response.json();
      const { userId, email } = data;

      // Fetch user profile from Supabase
      const user = await fetchUserProfile(userId);
      if (!user) {
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
   */
  const logout = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      clearSessionToken();
      window.location.href = `${getAccountsUrl()}/logout`;
    } catch (error) {
      console.error('Logout error:', error);
      clearSessionToken();
      window.location.href = `${getAccountsUrl()}/logout`;
    }
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
//
// ⚠️ CRITICAL: This runs in Edge runtime - use Buffer.from, NOT atob!

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/',              // Landing/home page (if you have one)
  '/pricing',       // Pricing page (if you have one)
  '/about',         // About page (if you have one)
  '/api/public',    // Public API endpoints
  '/api/auth',      // Auth API endpoints (set-sso-cookie, etc.)
  '/api/health',    // Health check endpoint
  '/api/debug',     // Debug endpoints (remove in production if desired)
  '/sso-landing',   // SSO cookie setting page
  '/_next',         // Next.js internals
  '/favicon.ico',   // Favicon
  '/public',        // Public assets
];

// Routes that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/app',
  '/keywords',      // Your app's main routes
  '/api/keywords',  // Your app's API routes
  // Add your protected routes here
];

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug mode - add ?_debug=1 to see middleware decision
  const debugMode = request.nextUrl.searchParams.get('_debug') === '1';

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    if (debugMode) {
      return NextResponse.json({ decision: 'allow', reason: 'public_path', pathname });
    }
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtected = PROTECTED_PATHS.some(path => pathname.startsWith(path));
  if (!isProtected) {
    if (debugMode) {
      return NextResponse.json({ decision: 'allow', reason: 'not_protected', pathname });
    }
    return NextResponse.next();
  }

  // Check for sso_token in URL (fallback for cross-subdomain cookie issues)
  const ssoToken = request.nextUrl.searchParams.get('sso_token');
  if (ssoToken) {
    try {
      const parts = ssoToken.split('.');
      if (parts.length === 3) {
        // Use Buffer.from for Edge runtime compatibility (NOT atob!)
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const payload = JSON.parse(decoded);

        if (payload.exp * 1000 > Date.now()) {
          // Token valid - redirect to sso-landing to set cookie
          const cleanUrl = new URL(request.url);
          cleanUrl.searchParams.delete('sso_token');

          const ssoLandingUrl = new URL('/sso-landing', request.url);
          ssoLandingUrl.searchParams.set('token', ssoToken);
          ssoLandingUrl.searchParams.set('redirect', cleanUrl.pathname + cleanUrl.search);

          return NextResponse.redirect(ssoLandingUrl);
        }
      }
    } catch (e) {
      console.error('Failed to process sso_token:', e);
    }
  }

  // Get the session cookie
  const token = request.cookies.get('bfeai_session')?.value;

  // No token - redirect to login
  if (!token) {
    if (debugMode) {
      return NextResponse.json({
        decision: 'redirect_to_login',
        reason: 'no_token',
        pathname,
      });
    }
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

    // ⚠️ CRITICAL: Use Buffer.from for Edge runtime (NOT atob!)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      if (debugMode) {
        return NextResponse.json({
          decision: 'redirect_to_login',
          reason: 'token_expired',
          pathname,
        });
      }
      // Token expired - redirect to login
      const response = NextResponse.redirect(new URL('/login', ACCOUNTS_URL));
      response.cookies.delete('bfeai_session');
      return response;
    }

    if (debugMode) {
      return NextResponse.json({
        decision: 'allow',
        reason: 'token_valid',
        pathname,
        payload: { userId: payload.userId, exp: payload.exp },
      });
    }

    // Token valid - proceed
    return NextResponse.next();

  } catch (error) {
    console.error('Token verification failed:', error);
    if (debugMode) {
      return NextResponse.json({
        decision: 'redirect_to_login',
        reason: 'token_verification_failed',
        pathname,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    // Invalid token - redirect to login
    const loginUrl = new URL('/login', ACCOUNTS_URL);
    loginUrl.searchParams.set('redirect', request.url);
    const response = NextResponse.redirect(loginUrl);
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

### File 8: `src/lib/bfeai-auth/server.ts` (Server-Side Helpers)

```typescript
// src/lib/bfeai-auth/server.ts
// Server-side authentication helpers for API routes and server components
//
// ⚠️ CRITICAL: Uses Buffer.from for Edge runtime compatibility

import { cookies } from 'next/headers';
import type { JWTPayload } from './types';

const COOKIE_NAME = 'bfeai_session';

/**
 * Decode a JWT token without verification (for Edge/Server runtime)
 * Note: This is for reading the payload only. Full verification would require JWT_SECRET.
 */
export function decodeTokenServer(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // ⚠️ CRITICAL: Use Buffer.from (NOT atob) for Edge runtime
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Get authenticated user from the bfeai_session cookie
 * Use this in API routes and server components
 */
export async function getAuthenticatedUser(): Promise<{ userId: string; email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = decodeTokenServer(token);
    if (!payload) {
      return null;
    }

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the current request has a valid session
 */
export async function hasValidSession(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user !== null;
}

/**
 * Get the raw session token from cookies
 */
export async function getSessionTokenServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}
```

---

### File 9: `src/app/api/auth/me/route.ts` (User Info Endpoint)

```typescript
// src/app/api/auth/me/route.ts
// Returns current user info from the HttpOnly cookie
//
// This endpoint is REQUIRED because client-side JS cannot read HttpOnly cookies.
// The AuthProvider calls this to get user info.

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/bfeai-auth/server';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      userId: user.userId,
      email: user.email,
    });
  } catch (error) {
    console.error('[/api/auth/me] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### File 10: `src/app/sso-landing/page.tsx` (SSO Cookie Setting Page)

```typescript
// src/app/sso-landing/page.tsx
// Intermediate page for setting SSO cookies (Netlify workaround)
//
// Netlify may strip Set-Cookie headers from redirect responses.
// This page receives the token, calls an API to set the cookie,
// then redirects to the final destination.

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SSOLandingContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'setting-cookie' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/dashboard';

    if (!token) {
      setStatus('error');
      setErrorMessage('Missing token parameter');
      setTimeout(() => {
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
        window.location.href = `${accountsUrl}/login?error=sso_missing_token`;
      }, 2000);
      return;
    }

    setStatus('setting-cookie');

    // Set the cookie via API call (POST request preserves Set-Cookie headers)
    fetch('/api/auth/set-sso-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to set SSO cookie');
        return response.json();
      })
      .then(() => {
        setStatus('redirecting');
        // 500ms delay ensures browser fully processes Set-Cookie header
        setTimeout(() => {
          window.location.href = redirect;
        }, 500);
      })
      .catch(error => {
        console.error('SSO cookie error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Unknown error');
        setTimeout(() => {
          const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
          window.location.href = `${accountsUrl}/login?error=sso_cookie_failed`;
        }, 2000);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 text-center">
        {status === 'loading' && <p>Completing authentication...</p>}
        {status === 'setting-cookie' && <p>Setting up your session...</p>}
        {status === 'redirecting' && <p>Redirecting you now...</p>}
        {status === 'error' && (
          <>
            <p className="text-red-600">Authentication failed</p>
            <p className="text-sm text-gray-500">{errorMessage}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SSOLandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SSOLandingContent />
    </Suspense>
  );
}
```

---

### File 11: `src/app/api/auth/set-sso-cookie/route.ts` (Cookie Setting API)

```typescript
// src/app/api/auth/set-sso-cookie/route.ts
// Sets the bfeai_session cookie via a POST request
//
// This is needed because Netlify may strip Set-Cookie headers from redirects.
// By using a non-redirect POST request, the cookie is reliably set.

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Verify the token is a valid JWT structure and not expired
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
      }

      // ⚠️ CRITICAL: Use Buffer.from for Edge runtime compatibility
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);

      if (payload.exp * 1000 < Date.now()) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = 7 * 24 * 60 * 60; // 7 days

    // Build Set-Cookie header manually for maximum control
    const cookieParts = [
      `bfeai_session=${token}`,
      `Path=/`,
      `Max-Age=${maxAge}`,
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (isProduction) {
      cookieParts.push('Secure');
    }

    return new NextResponse(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieParts.join('; '),
        },
      }
    );
  } catch (error) {
    console.error('[set-sso-cookie] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

### File 12: `src/app/(protected)/layout.tsx` (Protected Route Layout)

```typescript
// src/app/(protected)/layout.tsx
// Server-side authentication check for all protected routes
//
// This layout wraps all routes in the (protected) route group.
// It runs AFTER middleware but BEFORE the page renders.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('bfeai_session')?.value;

  // No token - redirect to accounts login
  if (!token) {
    redirect(`${ACCOUNTS_URL}/login`);
  }

  // Basic token validation (decode and check expiration)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // ⚠️ CRITICAL: Use Buffer.from for Edge runtime compatibility (NOT atob!)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      redirect(`${ACCOUNTS_URL}/login`);
    }
  } catch {
    redirect(`${ACCOUNTS_URL}/login`);
  }

  return <>{children}</>;
}
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

### Issue 2: Cookie Not Being Set / SSO Not Working

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

### Issue 3: "Failed to fetch subscriptions"

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

### Issue 4: Middleware Not Running

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

### Issue 5: Environment Variables Not Loading

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

### Issue 6: TypeScript Errors

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

### Issue 7: "atob is not defined" Error

**Symptoms:**
- Middleware crashes with `ReferenceError: atob is not defined`
- Build succeeds but runtime fails on Netlify
- Works locally but fails in production

**Cause:** You're using `atob()` in middleware or server code. The `atob()` function is a browser API that **does not exist** in Netlify Edge runtime or Node.js server environments.

**Solution:** Replace all `atob()` calls with `Buffer.from()`:

```typescript
// ❌ WRONG - Will crash in Netlify Edge runtime
const decoded = atob(base64String);

// ✅ CORRECT - Works everywhere (Netlify, Vercel, Node.js, browser)
const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
const decoded = Buffer.from(base64, 'base64').toString('utf-8');
```

**Files to check:**
- `middleware.ts` - JWT decoding
- `src/lib/bfeai-auth/server.ts` - Server-side auth helpers
- `src/app/(protected)/layout.tsx` - Protected layout

---

### Issue 8: Redirect Loop After Login

**Symptoms:**
- User logs in successfully at accounts.bfeai.com
- Gets redirected back to the app
- App immediately redirects back to login
- Infinite loop between app and accounts

**Cause 1:** Your client-side code is trying to read an HttpOnly cookie.

The `bfeai_session` cookie has `HttpOnly` flag for security, which means:
- ✅ Server-side code CAN read it
- ❌ Client-side JavaScript CANNOT read it
- ❌ `js-cookie` / `Cookies.get()` returns `undefined`
- ❌ `document.cookie` doesn't show it

**Solution:** Don't read the cookie on the client. Instead, call an API endpoint:

```typescript
// AuthProvider.tsx - WRONG approach
const token = Cookies.get('bfeai_session'); // Returns undefined for HttpOnly!
if (!token) redirectToLogin(); // Infinite loop!

// AuthProvider.tsx - CORRECT approach
const response = await fetch('/api/auth/me', { credentials: 'include' });
if (!response.ok) {
  // Server checked cookie and user is not authenticated
  // But DON'T redirect here - let server-side layout handle it
  return;
}
const { userId, email } = await response.json();
```

**Cause 2:** Both client AND server are redirecting.

If your protected layout redirects AND your AuthProvider redirects, you get race conditions.

**Solution:** Let server-side code handle redirects. Client just shows loading state if not authenticated.

---

### Issue 9: Cookie Present But Still Redirecting

**Symptoms:**
- Browser DevTools shows `bfeai_session` cookie exists
- Token appears valid (not expired)
- Still getting redirected to login

**Cause:** Your server-side code has a bug in JWT decoding. Common issues:

1. **Using `atob()` in server code** (see Issue 7)
2. **Not handling URL-safe base64** - JWTs use `-` and `_` instead of `+` and `/`
3. **Checking wrong cookie name**

**Solution:** Use the correct decoding pattern:

```typescript
// In protected layout or middleware:
const token = cookieStore.get('bfeai_session')?.value;

if (!token) {
  redirect(`${ACCOUNTS_URL}/login`);
}

try {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  // CRITICAL: Convert URL-safe base64 to standard base64
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

  // Check expiration
  if (payload.exp * 1000 < Date.now()) {
    redirect(`${ACCOUNTS_URL}/login`);
  }
} catch (error) {
  console.error('Token validation failed:', error);
  redirect(`${ACCOUNTS_URL}/login`);
}
```

---

### Issue 10: Netlify Strips Set-Cookie from Redirects

**Symptoms:**
- User completes login at accounts.bfeai.com
- accounts.bfeai.com sets cookie and redirects to app
- Cookie never arrives at the app
- User stuck in redirect loop

**Cause:** Netlify (and some other edge platforms) may strip `Set-Cookie` headers from redirect responses (3xx status codes).

**Solution:** Use the SSO Landing Page pattern:

1. accounts.bfeai.com redirects to `yourapp.bfeai.com/sso-landing?token=...`
2. sso-landing page makes a POST request to `/api/auth/set-sso-cookie`
3. The POST response (200, not redirect) sets the cookie
4. sso-landing does a client-side redirect after a small delay

See Section 4.5 and Files 10-11 for implementation details.

---

### Debugging Tips

**Enable Debug Mode in Middleware:**

Add `?_debug=1` to any URL to see detailed middleware logs:

```
https://yourapp.bfeai.com/dashboard?_debug=1
```

This will show:
- Whether cookie is present
- Token decode success/failure
- Token expiration status
- Redirect decisions

**Check the cookie in DevTools:**
```
1. Open Chrome DevTools (F12)
2. Go to Application tab
3. Click Cookies → your domain
4. Look for 'bfeai_session'
5. Check the "HttpOnly" column - it should be checked ✓
```

**Decode the JWT (server-side only):**
```typescript
// Add temporarily to an API route to debug:
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('bfeai_session')?.value;

  if (!token) {
    return Response.json({ error: 'No token' });
  }

  const parts = token.split('.');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

  return Response.json({
    userId: payload.userId,
    email: payload.email,
    exp: new Date(payload.exp * 1000).toISOString(),
    isExpired: payload.exp * 1000 < Date.now(),
  });
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

**Logout:**
```typescript
const { logout } = useAuth();
<button onClick={logout}>Logout</button>
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
| 1.1 | January 2026 | Added Netlify/Edge Runtime requirements (Section 2.5), HttpOnly cookie architecture details, SSO Landing Page pattern (Section 4.5), new auth files (Files 8-12), expanded debugging tips (Issues 7-10). Critical fixes for `atob()` → `Buffer.from()` pattern. |
| 1.0 | January 2025 | Initial release |

---

*This guide is maintained by the BFEAI core team. For updates or corrections, please submit a pull request or contact the team.*
