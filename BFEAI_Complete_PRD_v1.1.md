# Product Requirements Document (PRD)
## BFEAI Multi-App Ecosystem

### Executive Summary

BFEAI (Be Found Everywhere AI) is a multi-application SaaS ecosystem for SEO and marketing tools, featuring centralized authentication via `accounts.bfeai.com`, unified payments management via `payments.bfeai.com`, and seamless inter-app navigation. Each app operates independently but shares core infrastructure for auth, payments, and monitoring.

**Key Architecture Decisions:**
- **Authentication**: `accounts.bfeai.com` handles all login/signup/profile (SSO via JWT cookie on `.bfeai.com` domain)
- **Payments**: `payments.bfeai.com` handles subscriptions and billing only
- **Database**: Single Supabase project with app-specific schemas
- **Co-founder Integration**: Copy-paste auth library files (optimized for AI coding tools)

---

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Authentication Flow (SSO Implementation)](#2-authentication-flow-sso-implementation)
3. [Payment Integration Architecture](#3-payment-integration-architecture)
4. [Database Schema](#4-database-schema)
5. [Developer Integration Guide](#5-developer-integration-guide)
6. [Migration Plan for Existing Apps](#6-migration-plan-for-existing-apps)
7. [Admin Dashboard](#7-admin-dashboard-adminbfeaicom)
8. [Monitoring & Analytics](#8-monitoring--analytics)
9. [Deployment Configuration](#9-deployment-configuration)
10. [Security Architecture & Protocols](#10-security-architecture--protocols)
11. [Implementation Timeline](#11-implementation-timeline)

---

## 1. System Architecture

**GitHub Organization:** https://github.com/Be-Found-Everywhere-Inc  
**Supabase Project:** https://wmhnkxkyettbeeamuppz.supabase.co

### Core Components

> **Note:** `accounts.bfeai.com` handles all authentication (login, signup, password reset, profile).  
> `payments.bfeai.com` handles only billing and subscriptions.
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        .bfeai.com Domain                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”‚
â”‚  â”‚   bfeai.com  â”‚  â”‚payments.bfeaiâ”‚  â”‚keywords.bfeaiâ”‚      â”‚
â”‚  â”‚  (Landing)   â”‚  â”‚   (Billing)  â”‚  â”‚  (SEO Tool)  â”‚      â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â”‚
â”‚                                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”‚
â”‚  â”‚ admin.bfeai  â”‚  â”‚  app2.bfeai  â”‚  â”‚  app3.bfeai  â”‚      â”‚
â”‚  â”‚  (Internal)  â”‚  â”‚   (Future)   â”‚  â”‚   (Future)   â”‚      â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â”‚
â”‚                                                               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                     Shared Infrastructure                     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚             Supabase (Central Database)               â”‚   â”‚
â”‚  â”‚  â€¢ Auth tables (shared)                              â”‚   â”‚
â”‚  â”‚  â€¢ App-specific schemas (isolated)                   â”‚   â”‚
â”‚  â”‚  â€¢ RLS policies per app                             â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚           Chargebee + Stripe (Payments)              â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 2. Authentication Flow (SSO Implementation)

### JWT Cookie-Based SSO Architecture

```javascript
// File: accounts.bfeai.com/src/auth-config.ts
// This configuration is used by accounts.bfeai.com to set the SSO cookie

export const AUTH_CONFIG = {
  domain: '.bfeai.com',  // Cookie domain for all subdomains
  cookieName: 'bfeai_session',
  jwtSecret: process.env.JWT_SECRET,
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,  // https://wmhnkxkyettbeeamuppz.supabase.co
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  }
};
```

### Authentication Flow Diagram
```
User Journey:
1. User visits any *.bfeai.com subdomain
2. Check for bfeai_session cookie
3. If no cookie â†’ Redirect to accounts.bfeai.com/login
4. After login â†’ Set JWT cookie for .bfeai.com domain
5. Cookie automatically available to all subdomains
6. Each app validates JWT and checks subscription status
```

### Shared Auth Hook Implementation

```typescript
// File: src/lib/bfeai-auth/useAuth.ts
// Co-founders copy this file into their app's src/lib/bfeai-auth/ directory
// See: BFEAI_Developer_Integration_Guide.md for complete integration instructions

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Cookies from 'js-cookie';
import jwt from 'jsonwebtoken';

interface AuthState {
  user: any;
  subscriptions: {
    [appName: string]: {
      status: 'active' | 'expired' | 'none';
      plan: string;
      expiresAt: Date;
    }
  };
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    subscriptions: {},
    loading: true
  });
  
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    const checkAuth = async () => {
      // 1. Check for JWT cookie
      const token = Cookies.get('bfeai_session');
      
      if (!token) {
        // Redirect to login
        window.location.href = 'https://accounts.bfeai.com/login?redirect=' + 
          encodeURIComponent(window.location.href);
        return;
      }
      
      try {
        // 2. Verify JWT
        const decoded = jwt.verify(token, process.env.NEXT_PUBLIC_JWT_SECRET);
        
        // 3. Get user from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        
        // 4. Fetch subscription status from payments API
        const subResponse = await fetch('https://payments.bfeai.com/api/subscriptions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const subscriptions = await subResponse.json();
        
        setAuthState({
          user,
          subscriptions,
          loading: false
        });
        
      } catch (error) {
        // Invalid token - clear and redirect
        Cookies.remove('bfeai_session', { domain: '.bfeai.com' });
        window.location.href = 'https://accounts.bfeai.com/login';
      }
    };
    
    checkAuth();
  }, []);
  
  return authState;
}
```

---

## 3. Payment Integration Architecture

### Payment Modal Embedding

```typescript
// File: keywords.bfeai.com/src/components/PaymentModal.tsx
// This component will be used across all apps

import { useEffect } from 'react';

interface PaymentModalProps {
  appId: string;
  planId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PaymentModal({ appId, planId, onSuccess, onCancel }: PaymentModalProps) {
  useEffect(() => {
    // Create iframe for payments.bfeai.com
    const iframe = document.createElement('iframe');
    iframe.src = `https://payments.bfeai.com/embed/checkout?app=${appId}&plan=${planId}`;
    iframe.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 700px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      z-index: 9999;
    `;
    
    // Listen for messages from iframe
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://payments.bfeai.com') return;
      
      if (event.data.type === 'payment_success') {
        onSuccess();
        document.body.removeChild(iframe);
      } else if (event.data.type === 'payment_cancel') {
        onCancel();
        document.body.removeChild(iframe);
      }
    });
    
    document.body.appendChild(iframe);
    
    return () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
  }, [appId, planId, onSuccess, onCancel]);
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9998
      }}
      onClick={onCancel}
    />
  );
}
```

### Subscription Check Middleware

```typescript
// File: middleware.ts (project root) or accounts.bfeai.com/src/middleware/checkSubscription.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const PUBLIC_PATHS = ['/login', '/signup', '/pricing'];
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME; // e.g., 'keywords'

export async function checkSubscriptionMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  
  // Get JWT from cookie
  const token = request.cookies.get('bfeai_session');
  
  if (!token) {
    return NextResponse.redirect(new URL(
      `https://accounts.bfeai.com/login?redirect=${request.url}`,
      request.url
    ));
  }
  
  try {
    const decoded = jwt.verify(token.value, process.env.JWT_SECRET) as any;
    
    // Check subscription status for this app
    const response = await fetch(
      `https://payments.bfeai.com/api/subscriptions/check?app=${APP_NAME}&user=${decoded.userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      }
    );
    
    const { hasAccess } = await response.json();
    
    if (!hasAccess) {
      // Redirect to subscription required page
      return NextResponse.redirect(new URL(
        `/subscription-required?app=${APP_NAME}`,
        request.url
      ));
    }
    
    return NextResponse.next();
    
  } catch (error) {
    // Invalid token
    return NextResponse.redirect(new URL(
      'https://accounts.bfeai.com/login',
      request.url
    ));
  }
}
```

---

## 4. Database Schema

### Shared Auth Schema (All apps use this)

```sql
-- File: supabase/migrations/001_shared_auth.sql

-- Users table (managed by Supabase Auth)
-- This is automatically created by Supabase

-- User profiles extension
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'admin', 'employee'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription records (synced from Chargebee)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL, -- 'keywords', 'backlinks', etc.
  chargebee_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL, -- 'active', 'cancelled', 'expired'
  plan_id TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, app_name)
);

-- API usage tracking
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  cost_usd DECIMAL(10, 6),
  request_count INTEGER DEFAULT 1,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Security event logging
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin access (for admin.bfeai.com)
CREATE POLICY "Admins can view all data" ON public.profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'employee')
    )
  );
```

### App-Specific Schema Example (keywords.bfeai.com)

```sql
-- File: supabase/migrations/002_keywords_app.sql

-- Create schema for keywords app
CREATE SCHEMA IF NOT EXISTS keywords;

-- Keywords app tables
CREATE TABLE keywords.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  seed_keyword TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_keywords INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE keywords.keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES keywords.reports(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  cpc_high DECIMAL(10, 2),
  difficulty INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE keywords.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords.keywords ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own reports" ON keywords.reports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own keywords" ON keywords.keywords
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM keywords.reports
      WHERE keywords.reports.id = keywords.keywords.report_id
      AND keywords.reports.user_id = auth.uid()
    )
  );
```

---

## 5. Developer Integration Guide

> **📄 Full Documentation:** See `BFEAI_Developer_Integration_Guide.md` for the complete, AI-friendly integration guide that co-founders should use.

### Overview

Co-founders bringing apps into the BFEAI ecosystem will:
1. Copy auth library files into their project (not an npm package)
2. Configure environment variables
3. Add subscription checks to premium features
4. Deploy to their subdomain

### Co-founder Context

- Co-founders are entry-level developers using AI coding tools (Claude, Cursor, etc.)
- They will feed the Developer Integration Guide to their AI assistant
- Documentation must be comprehensive and self-contained
- All code files are provided in full (copy-paste ready)

### Distribution Method: Copy-Paste Files

Instead of an npm package, co-founders copy these files into their `src/lib/bfeai-auth/` directory:

```
src/lib/bfeai-auth/
├── index.ts           # Main exports
├── types.ts           # TypeScript types
├── authHelpers.ts     # Utility functions  
├── useAuth.ts         # React hook
├── AuthProvider.tsx   # React context provider
└── subscriptionCheck.ts # Subscription verification
```

Plus `middleware.ts` in the project root for route protection.

### Key URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Login/Signup | `https://accounts.bfeai.com` | All authentication |
| Subscriptions | `https://payments.bfeai.com` | Billing & plans |
| Supabase | `https://wmhnkxkyettbeeamuppz.supabase.co` | Database |

### Quick Reference

**Import from local files (not npm):**
```typescript
import { AuthProvider, useAuth } from '@/lib/bfeai-auth';
```

**Check subscription:**
```typescript
const { subscription } = useAuth();
const hasAccess = subscription?.status === 'active';
```

**Redirect to login:**
```typescript
import { redirectToLogin } from '@/lib/bfeai-auth';
redirectToLogin(); // Goes to accounts.bfeai.com/login
```

**Redirect to subscribe:**
```typescript
import { redirectToSubscribe } from '@/lib/bfeai-auth';
redirectToSubscribe('pro'); // Goes to payments.bfeai.com/subscribe
```

### What Core Team Must Provide to Co-founders

Before a co-founder can integrate:

- [ ] Their app name assigned (e.g., `backlinks`)
- [ ] Their subdomain configured (e.g., `backlinks.bfeai.com`)
- [ ] Environment variables:
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`
- [ ] Their database schema created in Supabase
- [ ] Their pricing plans configured in Chargebee

### What Co-founders Must Do

See `BFEAI_Developer_Integration_Guide.md` for step-by-step instructions:

1. Install required npm packages
2. Copy auth library files into their project
3. Add environment variables
4. Wrap app with `AuthProvider`
5. Add `middleware.ts` for route protection
6. Implement subscription checks on premium features
7. Add shared navigation component
8. Test SSO flow
9. Deploy to Netlify

---

## 6. Migration Plan for Existing Apps

### Phase 1: Keywords.bfeai.com Migration (Week 1-2)

```typescript
// File: keywords.bfeai.com/src/lib/auth-migration.ts

// Step 1: Replace current auth with shared auth
// OLD CODE (current implementation):
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// NEW CODE:
import { useAuth } from '@bfeai/shared-auth';

// Step 2: Update middleware
// File: keywords.bfeai.com/middleware.ts
import { checkSubscriptionMiddleware } from '@bfeai/shared-auth/middleware';

export default checkSubscriptionMiddleware;

// Step 3: Update API routes to check subscription
// File: keywords.bfeai.com/app/api/keywords/reports/route.ts
import { withSubscription } from '@bfeai/shared-auth/api';

export const POST = withSubscription('keywords', async (req) => {
  // Your existing logic
});
```

### Phase 2: Payments.bfeai.com Updates (Week 2-3)

```typescript
// Add SSO token generation
// File: payments.bfeai.com/app/api/auth/callback/route.ts

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Generate JWT for SSO
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      },
      process.env.JWT_SECRET
    );
    
    // Set cookie for all subdomains
    cookies().set('bfeai_session', token, {
      domain: '.bfeai.com',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });
    
    // Redirect to original URL or dashboard
    const redirectTo = requestUrl.searchParams.get('redirect') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo));
  }
}
```

---

## 7. Admin Dashboard (admin.bfeai.com)

### Core Features

```typescript
// File: admin.bfeai.com/app/dashboard/page.tsx

interface AdminDashboard {
  metrics: {
    totalUsers: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    apiCosts: number;
  };
  userAnalytics: {
    userId: string;
    email: string;
    subscriptions: Subscription[];
    apiUsage: {
      app: string;
      totalCost: number;
      requestCount: number;
    }[];
    lastActive: Date;
  }[];
  costBreakdown: {
    app: string;
    provider: string; // 'openai', 'google', 'dataforseo'
    totalCost: number;
    requestCount: number;
  }[];
}
```

---

## 8. Monitoring & Analytics

### Centralized Logging Setup

```typescript
// File: accounts.bfeai.com/src/lib/monitoring/logger.ts

import * as Sentry from '@sentry/nextjs';

export class Logger {
  static init(appName: string) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations: [
        new Sentry.BrowserTracing(),
      ],
      tracesSampleRate: 1.0,
      beforeSend(event) {
        event.tags = {
          ...event.tags,
          app: appName,
        };
        return event;
      },
    });
  }
  
  static logUserAction(action: string, metadata: any) {
    // Send to admin dashboard
    fetch('https://admin.bfeai.com/api/analytics', {
      method: 'POST',
      body: JSON.stringify({
        app: process.env.NEXT_PUBLIC_APP_NAME,
        action,
        metadata,
        timestamp: new Date(),
      }),
    });
  }
}
```

---

## 9. Deployment Configuration

### Netlify Configuration for Multi-App Setup

```toml
# File: netlify.toml (for each app)

[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = ".next"

[build.environment]
  NEXT_PUBLIC_APP_NAME = "keywords" # Change per app

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"

# Allow embedding in payments.bfeai.com
[[headers]]
  for = "/embed/*"
  [headers.values]
    X-Frame-Options = "ALLOW-FROM https://payments.bfeai.com"
```

---

## 10. Security Architecture & Protocols

### 10.1 Security Overview
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Security Layers                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                               â”‚
â”‚  Layer 1: Edge Security (Cloudflare/Netlify)                â”‚
â”‚  â€¢ DDoS Protection                                           â”‚
â”‚  â€¢ WAF (Web Application Firewall)                           â”‚
â”‚  â€¢ Rate Limiting                                            â”‚
â”‚  â€¢ Bot Protection                                           â”‚
â”‚                                                               â”‚
â”‚  Layer 2: Application Security                               â”‚
â”‚  â€¢ CSRF Protection                                          â”‚
â”‚  â€¢ XSS Prevention                                           â”‚
â”‚  â€¢ Content Security Policy                                  â”‚
â”‚  â€¢ Input Validation & Sanitization                          â”‚
â”‚                                                               â”‚
â”‚  Layer 3: Authentication & Authorization                     â”‚
â”‚  â€¢ MFA Support                                              â”‚
â”‚  â€¢ Session Management                                       â”‚
â”‚  â€¢ JWT Security                                             â”‚
â”‚  â€¢ Role-Based Access Control                                â”‚
â”‚                                                               â”‚
â”‚  Layer 4: Data Security                                      â”‚
â”‚  â€¢ Encryption at Rest (AES-256)                            â”‚
â”‚  â€¢ Encryption in Transit (TLS 1.3)                         â”‚
â”‚  â€¢ PII Protection                                          â”‚
â”‚  â€¢ Database Security (RLS)                                  â”‚
â”‚                                                               â”‚
â”‚  Layer 5: Monitoring & Compliance                           â”‚
â”‚  â€¢ Security Logging                                         â”‚
â”‚  â€¢ Anomaly Detection                                        â”‚
â”‚  â€¢ Compliance Tracking                                      â”‚
â”‚  â€¢ Incident Response                                        â”‚
â”‚                                                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 10.2 Protection Against Common Vulnerabilities

#### A. SQL Injection Prevention

```typescript
// File: accounts.bfeai.com/src/lib/security/database.ts

import { createClient } from '@supabase/supabase-js';
import DOMPurify from 'isomorphic-dompurify';

export class SecureDatabase {
  private supabase: any;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  
  // NEVER use string concatenation for queries
  // Always use parameterized queries
  async secureQuery(table: string, filters: any) {
    // Whitelist table names to prevent injection
    const allowedTables = ['profiles', 'subscriptions', 'keywords.reports'];
    if (!allowedTables.includes(table)) {
      throw new Error('Invalid table name');
    }
    
    // Sanitize all input data
    const sanitizedFilters = this.sanitizeInput(filters);
    
    // Use Supabase's built-in query builder (parameterized)
    return this.supabase
      .from(table)
      .select('*')
      .match(sanitizedFilters);
  }
  
  private sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove any SQL keywords and special characters
      return DOMPurify.sanitize(input, { 
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });
    }
    if (typeof input === 'object') {
      const sanitized: any = {};
      for (const key in input) {
        sanitized[key] = this.sanitizeInput(input[key]);
      }
      return sanitized;
    }
    return input;
  }
}

// Input validation middleware
export function validateInput(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    next();
  };
}
```

#### B. Brute Force Attack Prevention

```typescript
// File: accounts.bfeai.com/src/lib/security/rate-limiter.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

// Configure rate limiters
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Different rate limits for different endpoints
export const rateLimiters = {
  // Login: 5 attempts per 15 minutes
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: true,
    prefix: 'login',
  }),
  
  // API: 100 requests per minute
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'api',
  }),
  
  // Password reset: 3 attempts per hour
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: true,
    prefix: 'password-reset',
  }),
};

// Account lockout after failed attempts
export class AccountSecurity {
  private static LOCKOUT_THRESHOLD = 5;
  private static LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  
  static async recordFailedAttempt(email: string) {
    const key = `failed_attempts:${email}`;
    const attempts = await redis.incr(key);
    
    if (attempts === 1) {
      // Set expiry for first attempt
      await redis.expire(key, this.LOCKOUT_DURATION / 1000);
    }
    
    if (attempts >= this.LOCKOUT_THRESHOLD) {
      // Lock account
      await redis.set(
        `locked:${email}`,
        true,
        { ex: this.LOCKOUT_DURATION / 1000 }
      );
      
      // Send security alert email
      await this.sendSecurityAlert(email);
    }
    
    return attempts;
  }
  
  static async isAccountLocked(email: string): Promise<boolean> {
    const locked = await redis.get(`locked:${email}`);
    return !!locked;
  }
  
  static async clearFailedAttempts(email: string) {
    await redis.del(`failed_attempts:${email}`);
  }
  
  private static async sendSecurityAlert(email: string) {
    // Send email notification about suspicious activity
  }
}

// CAPTCHA integration for suspicious activity
export class CaptchaService {
  static async verify(token: string, action: string): Promise<boolean> {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    });
    
    const data = await response.json();
    return data.success && data.score > 0.5 && data.action === action;
  }
}
```

#### C. XSS (Cross-Site Scripting) Prevention

```typescript
// File: accounts.bfeai.com/src/lib/security/xss-protection.ts

import DOMPurify from 'isomorphic-dompurify';
import helmet from 'helmet';

// Content Security Policy configuration
export const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Remove in production, use nonces
        "https://js.stripe.com",
        "https://www.googletagmanager.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "https://api.stripe.com",
        "https://*.bfeai.com",
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://payments.bfeai.com", // For payment modal
      ],
      frameAncestors: ["'self'", "https://*.bfeai.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding payment modal
  crossOriginResourcePolicy: { policy: "cross-origin" },
};

// Input sanitization helper
export class XSSProtection {
  // Sanitize HTML content
  static sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  }
  
  // Escape special characters for display
  static escapeHTML(text: string): string {
    const map: any = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return text.replace(/[&<>"'/]/g, (char) => map[char]);
  }
  
  // Validate and sanitize JSON
  static sanitizeJSON(input: any): any {
    const sanitized = JSON.parse(JSON.stringify(input));
    
    function sanitizeObject(obj: any): any {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = XSSProtection.escapeHTML(obj[key]);
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
      return obj;
    }
    
    return sanitizeObject(sanitized);
  }
}
```

#### D. CSRF (Cross-Site Request Forgery) Protection

```typescript
// File: accounts.bfeai.com/src/lib/security/csrf.ts

import crypto from 'crypto';
import { cookies } from 'next/headers';

export class CSRFProtection {
  private static TOKEN_LENGTH = 32;
  private static TOKEN_NAME = 'csrf_token';
  
  // Generate CSRF token
  static generateToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }
  
  // Set CSRF token in cookie and return it
  static async setToken(): Promise<string> {
    const token = this.generateToken();
    
    cookies().set(this.TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
    
    return token;
  }
  
  // Verify CSRF token
  static async verifyToken(requestToken: string): Promise<boolean> {
    const cookieToken = cookies().get(this.TOKEN_NAME)?.value;
    
    if (!cookieToken || !requestToken) {
      return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(requestToken)
    );
  }
}

// CSRF Middleware
export async function csrfMiddleware(req: Request) {
  // Skip CSRF for GET requests
  if (req.method === 'GET' || req.method === 'HEAD') {
    return;
  }
  
  const token = req.headers.get('x-csrf-token');
  
  if (!token || !(await CSRFProtection.verifyToken(token))) {
    throw new Error('Invalid CSRF token');
  }
}
```

#### E. JWT Security & Session Management

```typescript
// File: accounts.bfeai.com/src/lib/security/jwt-security.ts

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export class JWTSecurity {
  private static ACCESS_TOKEN_EXPIRY = '15m';
  private static REFRESH_TOKEN_EXPIRY = '7d';
  private static TOKEN_ROTATION_THRESHOLD = 5 * 60; // 5 minutes
  
  // Generate secure tokens with fingerprinting
  static generateTokenPair(userId: string, fingerprint: string) {
    const fingerprintHash = crypto
      .createHash('sha256')
      .update(fingerprint)
      .digest('hex');
    
    const accessToken = jwt.sign(
      {
        userId,
        type: 'access',
        fingerprint: fingerprintHash,
        jti: crypto.randomBytes(16).toString('hex'), // JWT ID for revocation
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: 'bfeai.com',
        audience: '*.bfeai.com',
      }
    );
    
    const refreshToken = jwt.sign(
      {
        userId,
        type: 'refresh',
        fingerprint: fingerprintHash,
        jti: crypto.randomBytes(16).toString('hex'),
      },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'bfeai.com',
      }
    );
    
    return { accessToken, refreshToken };
  }
  
  // Verify token with fingerprint
  static verifyToken(token: string, fingerprint: string, type: 'access' | 'refresh') {
    const secret = type === 'access' 
      ? process.env.JWT_ACCESS_SECRET! 
      : process.env.JWT_REFRESH_SECRET!;
    
    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'bfeai.com',
        audience: type === 'access' ? '*.bfeai.com' : undefined,
      }) as any;
      
      // Verify fingerprint
      const fingerprintHash = crypto
        .createHash('sha256')
        .update(fingerprint)
        .digest('hex');
      
      if (decoded.fingerprint !== fingerprintHash) {
        throw new Error('Invalid token fingerprint');
      }
      
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Token has been revoked');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
  
  // Token rotation for enhanced security
  static shouldRotateToken(decoded: any): boolean {
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    return timeUntilExpiry <= this.TOKEN_ROTATION_THRESHOLD;
  }
  
  // Blacklist tokens on logout
  private static blacklistedTokens = new Set<string>();
  
  static blacklistToken(jti: string) {
    this.blacklistedTokens.add(jti);
    // In production, store in Redis with TTL
  }
  
  static isTokenBlacklisted(jti: string): boolean {
    return this.blacklistedTokens.has(jti);
  }
}

// Secure session management
export class SessionManager {
  // Device fingerprinting for session security
  static generateFingerprint(req: Request): string {
    const userAgent = req.headers.get('user-agent') || '';
    const acceptLanguage = req.headers.get('accept-language') || '';
    const acceptEncoding = req.headers.get('accept-encoding') || '';
    
    return crypto
      .createHash('sha256')
      .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}`)
      .digest('hex');
  }
  
  // Concurrent session control
  static async validateSession(userId: string, sessionId: string): Promise<boolean> {
    // Check if user has too many active sessions
    const activeSessions = await this.getActiveSessions(userId);
    
    if (activeSessions.length > 3) {
      // Invalidate oldest session
      await this.invalidateSession(activeSessions[0].id);
    }
    
    return true;
  }
  
  private static async getActiveSessions(userId: string): Promise<any[]> {
    // Query database for active sessions
    return [];
  }
  
  private static async invalidateSession(sessionId: string) {
    // Mark session as invalid in database
  }
}
```

#### F. API Security

```typescript
// File: accounts.bfeai.com/src/lib/security/api-security.ts

import { z } from 'zod';
import crypto from 'crypto';

export class APIKeyManager {
  // Generate secure API keys for third-party integrations
  static generateAPIKey(): { key: string; hashedKey: string } {
    const key = `bfeai_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = crypto
      .createHash('sha256')
      .update(key)
      .digest('hex');
    
    return { key, hashedKey };
  }
  
  // Verify API key
  static verifyAPIKey(key: string, hashedKey: string): boolean {
    const hash = crypto
      .createHash('sha256')
      .update(key)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hashedKey)
    );
  }
  
  // Rotate API keys periodically
  static async rotateAPIKeys(userId: string) {
    const newKey = this.generateAPIKey();
    
    // Update in database
    await this.updateUserAPIKey(userId, newKey.hashedKey);
    
    // Send notification to user
    await this.notifyKeyRotation(userId, newKey.key);
    
    return newKey;
  }
  
  private static async updateUserAPIKey(userId: string, hashedKey: string) {
    // Database update logic
  }
  
  private static async notifyKeyRotation(userId: string, newKey: string) {
    // Email notification logic
  }
}

// Request validation schemas
export const validationSchemas = {
  createReport: z.object({
    seedKeyword: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s-]+$/),
    method: z.enum(['google', 'openai', 'hybrid']),
    country: z.number().int().positive(),
    language: z.string().length(2),
    industry: z.string().optional(),
  }),
  
  updateSubscription: z.object({
    planId: z.string().uuid(),
    paymentMethodId: z.string().optional(),
  }),
};

// API rate limiting with different tiers
export class TieredRateLimiter {
  static limits = {
    free: { requests: 10, window: '1h' },
    pro: { requests: 100, window: '1h' },
    enterprise: { requests: 1000, window: '1h' },
  };
  
  static async checkLimit(userId: string, tier: keyof typeof TieredRateLimiter.limits) {
    const limit = this.limits[tier];
    const key = `rate_limit:${userId}`;
    
    // Implementation using Redis
    // Return true if within limits, false otherwise
    return true;
  }
}
```

### 10.3 Infrastructure Security

#### Network Security Configuration

```nginx
# File: nginx-security.conf

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Rate limiting
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;

# DDoS protection
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 100;

server {
    listen 443 ssl http2;
    server_name *.bfeai.com;
    
    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Rate limiting for login endpoint
    location /api/auth/login {
        limit_req zone=login burst=2 nodelay;
        proxy_pass http://app:3000;
    }
    
    # Rate limiting for API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://app:3000;
    }
}
```

### 10.4 Security Monitoring & Incident Response

#### Security Event Logging

```typescript
// File: accounts.bfeai.com/src/lib/security/security-logger.ts

interface SecurityEvent {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'SUSPICIOUS_ACTIVITY' | 'DATA_BREACH_ATTEMPT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  ip: string;
  userAgent: string;
  details: any;
  timestamp: Date;
}

export class SecurityLogger {
  static async log(event: SecurityEvent) {
    // Log to multiple destinations
    await Promise.all([
      this.logToDatabase(event),
      this.logToSIEM(event),
      this.sendAlertIfCritical(event),
    ]);
  }
  
  private static async logToDatabase(event: SecurityEvent) {
    // Store in security_events table
  }
  
  private static async logToSIEM(event: SecurityEvent) {
    // Send to Splunk/ELK/Datadog
  }
  
  private static async sendAlertIfCritical(event: SecurityEvent) {
    if (event.severity === 'CRITICAL') {
      // Send immediate alert to security team
      await this.sendSlackAlert(event);
      await this.sendPagerDutyAlert(event);
    }
  }
  
  private static async sendSlackAlert(event: SecurityEvent) {
    // Slack webhook integration
  }
  
  private static async sendPagerDutyAlert(event: SecurityEvent) {
    // PagerDuty integration
  }
}

// Anomaly detection
export class AnomalyDetector {
  static async checkForAnomalies(userId: string, action: string) {
    // Check for unusual patterns
    const recentActions = await this.getRecentActions(userId);
    
    // Detect anomalies
    if (this.isAnomalous(recentActions, action)) {
      await SecurityLogger.log({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        userId,
        ip: '', // Get from request
        userAgent: '', // Get from request
        details: { action, recentActions },
        timestamp: new Date(),
      });
      
      // Trigger additional verification
      return true;
    }
    
    return false;
  }
  
  private static async getRecentActions(userId: string) {
    // Query recent user actions
    return [];
  }
  
  private static isAnomalous(recentActions: any[], action: string): boolean {
    // ML-based anomaly detection logic
    return false;
  }
}
```

### 10.5 Compliance & Data Protection

#### GDPR & Privacy Compliance

```typescript
// File: accounts.bfeai.com/src/lib/security/privacy.ts

import crypto from 'crypto';

export class PrivacyCompliance {
  // Data encryption for PII
  static encryptPII(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  static decryptPII(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  // Data retention policies
  static async enforceDataRetention() {
    // Delete data older than retention period
    const retentionPeriod = 365 * 24 * 60 * 60 * 1000; // 1 year
    const cutoffDate = new Date(Date.now() - retentionPeriod);
    
    // Delete old logs
    await this.deleteOldLogs(cutoffDate);
    
    // Anonymize old user data
    await this.anonymizeOldUserData(cutoffDate);
  }
  
  private static async deleteOldLogs(cutoffDate: Date) {
    // Delete logs older than cutoff
  }
  
  private static async anonymizeOldUserData(cutoffDate: Date) {
    // Anonymize PII in old records
  }
}
```

### 10.6 Security Checklist

```markdown
## Pre-Deployment Security Checklist

### Authentication & Authorization
- [ ] JWT tokens implemented with secure signing
- [ ] Refresh token rotation enabled
- [ ] Session fingerprinting active
- [ ] MFA support available
- [ ] Account lockout after failed attempts
- [ ] Password complexity requirements enforced
- [ ] Secure password reset flow

### Input Validation & Sanitization
- [ ] All inputs validated with Zod schemas
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS protection via DOMPurify
- [ ] File upload validation and scanning
- [ ] Request size limits configured

### Rate Limiting & DDoS Protection
- [ ] Login rate limiting (5 attempts/15 min)
- [ ] API rate limiting (tiered by plan)
- [ ] Cloudflare DDoS protection enabled
- [ ] CAPTCHA for suspicious activity

### Security Headers
- [ ] CSP headers configured
- [ ] HSTS enabled
- [ ] X-Frame-Options set
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy configured

### Data Protection
- [ ] PII encrypted at rest
- [ ] TLS 1.3 for data in transit
- [ ] Secure session management
- [ ] GDPR compliance measures
- [ ] Data retention policies

### Monitoring & Logging
- [ ] Security event logging active
- [ ] Anomaly detection configured
- [ ] Alert system for critical events
- [ ] Audit trails for sensitive operations
- [ ] Regular security scans scheduled

### Infrastructure
- [ ] Secrets in secure vault (not in code)
- [ ] Environment variables properly managed
- [ ] Database RLS policies configured
- [ ] Backup and recovery tested
- [ ] Incident response plan documented

### Third-Party Security
- [ ] Dependency vulnerabilities scanned
- [ ] npm audit clean
- [ ] Docker images scanned
- [ ] API keys rotated regularly
- [ ] Webhook signatures verified

### Payment Security
- [ ] PCI compliance maintained
- [ ] Stripe webhook signatures verified
- [ ] Payment data never stored locally
- [ ] Chargebee integration secured
```

### 10.7 Incident Response Plan

```markdown
## Security Incident Response Procedure

### 1. Detection (0-5 minutes)
- Automated alerts trigger
- Security team notified via PagerDuty
- Initial assessment begins

### 2. Containment (5-30 minutes)
- Isolate affected systems
- Revoke compromised credentials
- Enable emergency rate limiting
- Block suspicious IPs

### 3. Investigation (30 minutes - 2 hours)
- Analyze logs and security events
- Identify attack vector
- Assess data impact
- Document timeline

### 4. Remediation (2-24 hours)
- Patch vulnerabilities
- Reset affected credentials
- Update security rules
- Deploy fixes

### 5. Recovery (24-48 hours)
- Restore normal operations
- Monitor for recurring issues
- Verify security measures
- Clear incident status

### 6. Post-Incident (48-72 hours)
- Complete incident report
- Notify affected users (if required)
- Update security procedures
- Schedule retrospective

### Emergency Contacts
- Security Lead: [Contact]
- DevOps On-Call: [Contact]
- Legal Team: [Contact]
- PR Team: [Contact]
```

---

## 11. Implementation Timeline

### Week 1-2: Core Infrastructure
- [ ] Build and deploy accounts.bfeai.com (login, signup, password reset, profile)
- [ ] Configure JWT SSO cookie for .bfeai.com domain
- [ ] Create auth library files for co-founders to copy
- [ ] Set up subscription check API on payments.bfeai.com
- [ ] Implement basic security measures (CSRF, XSS protection)

### Week 3-4: App Migration & Security Hardening
- [ ] Migrate keywords.bfeai.com to shared auth (use accounts.bfeai.com for login)
- [ ] Update payments.bfeai.com to work with accounts.bfeai.com SSO
- [ ] Implement rate limiting and brute force protection
- [ ] Set up SQL injection prevention
- [ ] Configure security headers

### Week 5-6: Admin, Monitoring & Advanced Security
- [ ] Build admin.bfeai.com dashboard
- [ ] Implement centralized logging
- [ ] Set up cost tracking
- [ ] Deploy JWT security with fingerprinting
- [ ] Configure anomaly detection

### Week 7-8: Documentation, Testing & Co-founder Onboarding
- [ ] Finalize BFEAI_Developer_Integration_Guide.md
- [ ] Create integration tests for SSO flow
- [ ] Security penetration testing
- [ ] GDPR compliance implementation
- [ ] Onboard first co-founder app
- [ ] Incident response training

---

## Appendix A: Environment Variables Template

```env
# ============================================
# App Identity
# ============================================
NEXT_PUBLIC_APP_NAME=yourapp

# ============================================
# BFEAI Service URLs
# ============================================
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.bfeai.com
NEXT_PUBLIC_PAYMENTS_URL=https://payments.bfeai.com
NEXT_PUBLIC_MAIN_SITE_URL=https://bfeai.com

# ============================================
# Supabase Configuration
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# ============================================
# JWT Configuration
# ============================================
JWT_SECRET=your-secret-key-min-32-chars

# ============================================
# Security (Optional - for advanced features)
# ============================================
ENCRYPTION_KEY=hex-encoded-32-byte-key
RECAPTCHA_SECRET_KEY=xxx
RECAPTCHA_SITE_KEY=xxx

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_URL=xxx
UPSTASH_REDIS_TOKEN=xxx

# ============================================
# Monitoring (Optional)
# ============================================
SENTRY_DSN=xxx
DATADOG_API_KEY=xxx

# ============================================
# Payment (Core team only)
# ============================================
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
CHARGEBEE_API_KEY=xxx
CHARGEBEE_SITE=xxx

# ============================================
# API Keys (per app - add your own)
# ============================================
OPENAI_API_KEY=xxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
DATAFORSEO_LOGIN=xxx
DATAFORSEO_PASSWORD=xxx
```

## Appendix B: Key Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [PCI DSS Compliance](https://www.pcisecuritystandards.org/)
- [GDPR Guidelines](https://gdpr.eu/)
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)

---

## Document Control

- **Version:** 1.1
- **Last Updated:** January 2025
- **Author:** BFEAI Development Team
- **Status:** Updated - Ready for Implementation
- **Next Review:** After accounts.bfeai.com deployment

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2025 | Initial draft |
| 1.1 | January 2025 | Added accounts.bfeai.com for auth; Updated distribution method to copy-paste files; Added GitHub org and Supabase URLs; Updated Developer Integration Guide to reference comprehensive guide document; Added co-founder context (AI coding tools) |

### Related Documents

- `BFEAI_Developer_Integration_Guide.md` - Comprehensive guide for co-founders integrating their apps

---

This comprehensive PRD provides a complete roadmap for building a secure, scalable multi-app SaaS ecosystem with enterprise-grade security measures.