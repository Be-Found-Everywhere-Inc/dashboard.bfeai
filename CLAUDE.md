# CLAUDE.md - Accounts Portal (accounts.bfeai)

This file provides guidance to Claude Code for working with the BFEAI Accounts Portal.

---

## 1. Project Overview

**Purpose:** Central authentication service for the BFEAI multi-app SaaS ecosystem. Provides Single Sign-On (SSO) via JWT cookies shared across all `*.bfeai.com` subdomains.

**Key Features:**
- User login, signup, and password reset
- OAuth authentication (Google)
- Profile management with avatar upload
- Session management across all BFEAI apps
- Account deletion with data cleanup
- Security features: rate limiting, CSRF, XSS protection

**What This Service Does NOT Handle:**
- Payments/subscriptions (handled by `payments.bfeai.com`)
- App-specific features (handled by individual apps)

**Production URL:** https://accounts.bfeai.com

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 3.4 |
| Components | Radix UI (dialog, checkbox, select, etc.) |
| Forms | React Hook Form + Zod validation |
| Auth | Supabase Auth + custom JWT for SSO |
| Database | Supabase (shared BFEAI project) |
| Security | Upstash Redis (rate limiting), bcryptjs, DOMPurify |
| Deployment | Netlify |

---

## 3. File Structure

```
accounts.bfeai/
├── app/
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Home (redirects to login/profile)
│   ├── not-found.tsx                   # 404 page
│   │
│   ├── login/
│   │   └── page.tsx                    # Login page
│   ├── signup/
│   │   └── page.tsx                    # Signup page
│   ├── logout/
│   │   └── page.tsx                    # Logout handler (clears SSO cookie)
│   ├── forgot-password/
│   │   └── page.tsx                    # Password reset request
│   ├── reset-password/
│   │   └── page.tsx                    # Password reset completion
│   ├── oauth-start/
│   │   └── page.tsx                    # OAuth flow initiation
│   ├── sso-complete/
│   │   └── page.tsx                    # SSO completion redirect
│   │
│   ├── (dashboard)/                    # Auth-protected routes
│   │   ├── layout.tsx                  # Dashboard shell
│   │   ├── profile/
│   │   │   └── page.tsx                # Profile management
│   │   └── settings/
│   │       ├── page.tsx                # Settings overview
│   │       ├── password/
│   │       │   └── page.tsx            # Change password
│   │       └── delete/
│   │           └── page.tsx            # Delete account
│   │
│   └── api/
│       ├── health/
│       │   └── route.ts                # Health check endpoint
│       ├── csrf/
│       │   └── route.ts                # CSRF token endpoint
│       ├── auth/
│       │   ├── login/route.ts          # POST: Login + set JWT cookie
│       │   ├── signup/route.ts         # POST: Create user + profile
│       │   ├── logout/route.ts         # POST: Clear SSO cookie
│       │   ├── session/route.ts        # GET: Current session
│       │   ├── forgot-password/route.ts # POST: Send reset email
│       │   ├── reset-password/route.ts # POST: Complete reset
│       │   ├── change-password/route.ts # POST: Change password
│       │   ├── set-sso-cookie/route.ts # POST: Set SSO cookie
│       │   ├── set-oauth-redirect/route.ts # POST: Store OAuth redirect
│       │   ├── oauth/route.ts          # GET: OAuth initiation
│       │   └── callback/
│       │       └── [provider]/route.ts # GET: OAuth callback
│       ├── profile/
│       │   ├── route.ts                # GET/PUT: Profile CRUD
│       │   └── avatar/
│       │       └── route.ts            # POST: Avatar upload
│       └── account/
│           └── delete/
│               └── route.ts            # DELETE: Account deletion
│
├── lib/
│   ├── auth/
│   │   ├── jwt.ts                      # JWT generation & verification
│   │   ├── session.ts                  # Session management
│   │   ├── cookies.ts                  # SSO cookie helpers
│   │   └── oauth.ts                    # OAuth provider config
│   ├── security/
│   │   ├── rate-limiter.ts             # Upstash rate limiting
│   │   ├── account-lockout.ts          # Failed login lockout
│   │   ├── session-manager.ts          # Session tracking
│   │   ├── csrf.ts                     # CSRF token management
│   │   ├── xss-protection.ts           # DOMPurify sanitization
│   │   └── recaptcha.ts                # reCAPTCHA verification
│   ├── supabase/
│   │   ├── client.ts                   # Browser client
│   │   ├── server.ts                   # Server client (SSR)
│   │   └── admin.ts                    # Service role client
│   ├── storage/
│   │   └── avatar.ts                   # Avatar upload to Supabase Storage
│   ├── validation/
│   │   └── schemas.ts                  # Zod validation schemas
│   └── utils.ts                        # General utilities (cn, etc.)
│
├── components/
│   └── ui/                             # Radix UI components
│       ├── alert.tsx
│       ├── checkbox.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── skeleton.tsx
│       └── sonner.tsx
│
├── shared-auth-library/                # Shared library for other apps
│   ├── index.ts                        # Exports
│   ├── types.ts                        # BFEAIUser, AuthState types
│   ├── authHelpers.ts                  # decodeJWT, isTokenExpired, etc.
│   ├── useAuth.ts                      # React hook
│   ├── AuthProvider.tsx                # React context provider
│   ├── subscriptionCheck.ts            # Subscription verification
│   └── middleware-template.ts          # Route protection template
│
├── src/
│   └── types/
│       └── database.ts                 # Supabase generated types
│
├── tests/
│   ├── setup/
│   │   └── global-setup.ts
│   ├── utils/
│   │   ├── auth-helpers.ts
│   │   ├── db-helpers.ts
│   │   └── test-data.ts
│   └── e2e/
│       ├── auth.spec.ts                # Login/logout tests
│       ├── signup.spec.ts              # Registration tests
│       ├── profile.spec.ts             # Profile management tests
│       ├── password-reset.spec.ts      # Password reset flow
│       ├── avatar-upload.spec.ts       # Avatar upload tests
│       └── sso-cookie.spec.ts          # Cross-domain SSO tests
│
├── playwright.config.ts                # Playwright configuration
├── netlify.toml                        # Netlify deployment config
├── package.json                        # Dependencies
├── tailwind.config.js                  # Tailwind configuration
└── tsconfig.json                       # TypeScript config
```

---

## 4. SSO Cookie Architecture

The core purpose of this service is managing the SSO cookie that enables authentication across all BFEAI apps.

### Cookie Configuration

```typescript
// lib/auth/cookies.ts
export const SSO_COOKIE_NAME = 'bfeai_session';

export function setSSoCookie(token: string) {
  cookies().set(SSO_COOKIE_NAME, token, {
    domain: '.bfeai.com',     // Leading dot = all subdomains
    httpOnly: true,           // Prevent JavaScript access (XSS protection)
    secure: true,             // HTTPS only
    sameSite: 'lax',          // CSRF protection
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}
```

### Cookie Accessibility

The `.bfeai.com` domain cookie is readable by:
- `accounts.bfeai.com` ✓
- `payments.bfeai.com` ✓
- `keywords.bfeai.com` ✓
- `admin.bfeai.com` ✓
- Any future `*.bfeai.com` subdomain ✓

---

## 5. Authentication Flows

### Login Flow

1. User submits email/password to `/api/auth/login`
2. Validate against Supabase Auth
3. Check rate limits and account lockout
4. Generate JWT token with user data
5. Set SSO cookie on `.bfeai.com` domain
6. Redirect to `?redirect=` URL or dashboard

### Signup Flow

1. User submits email/password/name to `/api/auth/signup`
2. Validate with Zod schema
3. Create user in Supabase Auth
4. Create profile in `public.profiles` table
5. Generate JWT token
6. Set SSO cookie
7. Redirect to onboarding or redirect URL

### OAuth Flow (Google)

1. User clicks "Login with Google"
2. Store redirect URL in cookie via `/api/auth/set-oauth-redirect`
3. Redirect to `/api/auth/oauth?provider=google`
4. Supabase handles OAuth handshake
5. Callback at `/api/auth/callback/google`
6. Create/update profile
7. Set SSO cookie
8. Redirect to stored URL

### Logout Flow

1. User visits `/logout` page
2. Call `/api/auth/logout` to clear cookie
3. Sign out of Supabase session
4. Redirect to login page

### Password Reset Flow

1. User requests reset at `/forgot-password`
2. API sends email via Supabase
3. User clicks email link to `/reset-password?token=...`
4. User enters new password
5. API updates password in Supabase

---

## 6. JWT Token Structure

```typescript
// lib/auth/jwt.ts
interface JWTPayload {
  sub: string;           // User ID
  email: string;
  full_name?: string;
  avatar_url?: string;
  iat: number;           // Issued at
  exp: number;           // Expiration (7 days)
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
}
```

---

## 7. Security Features

### Rate Limiting (Upstash Redis)

```typescript
// lib/security/rate-limiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const loginRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 min
  analytics: true,
});

export const signupRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 signups per hour per IP
  analytics: true,
});
```

### Account Lockout

```typescript
// lib/security/account-lockout.ts
// After 5 failed login attempts, lock account for 30 minutes
export async function checkAccountLockout(email: string): Promise<boolean>;
export async function recordFailedAttempt(email: string): Promise<void>;
export async function clearFailedAttempts(email: string): Promise<void>;
```

### CSRF Protection

```typescript
// lib/security/csrf.ts
export function generateCsrfToken(): string;
export function validateCsrfToken(token: string): boolean;
// Token stored in httpOnly cookie, sent in X-CSRF-Token header
```

### XSS Protection

```typescript
// lib/security/xss-protection.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}
```

---

## 8. Database Tables

This service manages user authentication data in Supabase:

### auth.users (Managed by Supabase Auth)
- Do not modify directly
- Contains email, password hash, metadata

### public.profiles

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### public.security_events

```sql
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,  -- LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, etc.
  severity TEXT NOT NULL,     -- LOW, MEDIUM, HIGH, CRITICAL
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/csrf` | GET | Get CSRF token |
| `/api/auth/login` | POST | Login + set SSO cookie |
| `/api/auth/signup` | POST | Create user + profile |
| `/api/auth/logout` | POST | Clear SSO cookie |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/forgot-password` | POST | Send reset email |
| `/api/auth/reset-password` | POST | Complete password reset |
| `/api/auth/change-password` | POST | Change password (logged in) |
| `/api/auth/set-sso-cookie` | POST | Set SSO cookie (internal) |
| `/api/auth/oauth` | GET | Start OAuth flow |
| `/api/auth/callback/[provider]` | GET | OAuth callback |
| `/api/profile` | GET/PUT | Get/update profile |
| `/api/profile/avatar` | POST | Upload avatar |
| `/api/account/delete` | DELETE | Delete account |

---

## 10. Pages Overview

### Public Pages

| Page | Path | Description |
|------|------|-------------|
| Login | `/login` | Email/password + OAuth login |
| Signup | `/signup` | Registration form |
| Forgot Password | `/forgot-password` | Request password reset |
| Reset Password | `/reset-password` | Set new password (from email link) |
| OAuth Start | `/oauth-start` | OAuth flow initiation |
| SSO Complete | `/sso-complete` | SSO redirect handler |
| Logout | `/logout` | Logout and clear cookie |

### Protected Pages (Dashboard)

| Page | Path | Description |
|------|------|-------------|
| Profile | `/profile` | View/edit profile, avatar upload |
| Settings | `/settings` | Account settings overview |
| Change Password | `/settings/password` | Update password |
| Delete Account | `/settings/delete` | Account deletion with confirmation |

---

## 11. Environment Variables

### Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# JWT (CRITICAL: must match all BFEAI apps!)
JWT_SECRET=your-jwt-secret-min-32-chars

# Service URLs
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.bfeai.com
NEXT_PUBLIC_PAYMENTS_URL=https://payments.bfeai.com
NEXT_PUBLIC_APP_NAME=accounts
NEXT_PUBLIC_APP_URL=https://accounts.bfeai.com
```

### Security (Required for Production)

```env
# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Optional

```env
# reCAPTCHA (bot protection)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...

# OAuth Providers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Monitoring
SENTRY_DSN=...
```

---

## 12. Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev           # http://localhost:3000

# Type checking
npm run typecheck     # or: npx tsc --noEmit

# Linting
npm run lint
npm run lint:fix

# Production build
npm run build

# Start production server
npm run start

# E2E Tests (Playwright)
npm run test          # Run all tests
npm run test:e2e      # Same as above
npm run test:e2e:ui   # Interactive UI mode
npm run test:e2e:headed # Run with browser visible
npm run test:e2e:debug # Debug mode
npm run test:e2e:report # View test report
```

---

## 13. Deployment

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NEXT_PUBLIC_APP_NAME = "accounts"
  NEXT_PUBLIC_APP_URL = "https://accounts.bfeai.com"
  NODE_ENV = "production"
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Content-Security-Policy = "default-src 'self'; ..."

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "https://*.bfeai.com"
    Access-Control-Allow-Credentials = "true"
```

### Production URL

https://accounts.bfeai.com

---

## 14. Shared Auth Library

The `shared-auth-library/` directory contains files that other BFEAI apps copy to enable SSO integration:

| File | Purpose |
|------|---------|
| `types.ts` | BFEAIUser, AuthState TypeScript types |
| `authHelpers.ts` | decodeJWT, isTokenExpired, getTokenFromCookie |
| `useAuth.ts` | React hook for auth state |
| `AuthProvider.tsx` | React context provider |
| `subscriptionCheck.ts` | Verify subscription status |
| `middleware-template.ts` | Route protection template |
| `index.ts` | Public exports |

### Usage in Other Apps

```typescript
// Other apps copy these files to lib/bfeai-auth/
import { useAuth } from '@/lib/bfeai-auth';

function Component() {
  const { user, isLoading, subscriptions } = useAuth();

  if (isLoading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;

  return <Dashboard user={user} />;
}
```

---

## 15. Key Patterns

### SSO Cookie Setting

```typescript
// Always set cookie on .bfeai.com domain
cookies().set('bfeai_session', token, {
  domain: '.bfeai.com',  // CRITICAL: Leading dot for subdomains
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60,
});
```

### Redirect URL Handling

```typescript
// Login with redirect
const redirect = searchParams.get('redirect');
const safeRedirect = redirect?.startsWith('https://') &&
                     redirect.includes('.bfeai.com')
  ? redirect
  : '/profile';
```

### Security Event Logging

```typescript
await supabase.from('security_events').insert({
  event_type: 'LOGIN_FAILED',
  severity: 'MEDIUM',
  user_id: null,
  ip_address: getClientIP(request),
  user_agent: request.headers.get('user-agent'),
  details: { email, reason: 'invalid_password' },
});
```

---

## 16. Anti-patterns to Avoid

1. **Never set cookie without `.bfeai.com` domain** - SSO breaks without leading dot
2. **Never expose JWT_SECRET** - Keep only in server-side code
3. **Never use SUPABASE_SERVICE_ROLE_KEY on client** - Only use anon key
4. **Never skip rate limiting** - Always check before auth operations
5. **Never trust redirect URLs** - Validate they're on `*.bfeai.com`
6. **Never clear SSO cookie from other apps** - Only accounts.bfeai can logout
7. **Never store passwords** - Let Supabase Auth handle password hashing
8. **Never skip input sanitization** - Always use DOMPurify

---

## 17. Testing Checklist

- [ ] Login with email/password works
- [ ] Login with Google OAuth works
- [ ] Signup creates user and profile
- [ ] Password reset email is sent
- [ ] Password reset with token works
- [ ] Profile update saves correctly
- [ ] Avatar upload works
- [ ] Account deletion removes all data
- [ ] SSO cookie is set on `.bfeai.com`
- [ ] SSO cookie is readable from other subdomains
- [ ] Logout clears cookie for all subdomains
- [ ] Rate limiting blocks after 5 failed attempts
- [ ] Account lockout activates after threshold
- [ ] CSRF token is validated on mutations
- [ ] XSS inputs are sanitized
- [ ] Redirect URLs are validated

---

## 18. Related Documentation

- **Root CLAUDE.md**: `../CLAUDE.md` - Monorepo overview
- **SSO Integration**: `../BFEAI_Ecosystem/BFEAI_Developer_Integration_Guide.md`
- **Branding**: `../BFEAI_Ecosystem/Branding/BFEAI_Brand_Guide.md`
- **Payments Portal**: `../payments.bfeai/CLAUDE.md`
- **Supabase Dashboard**: https://supabase.com/dashboard/project/wmhnkxkyettbeeamuppz
