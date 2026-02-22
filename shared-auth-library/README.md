# Shared Auth Library for BFEAI Apps

SSO authentication library for integrating new apps into the BFEAI ecosystem.

**Version:** 2.0 (February 2026)

## What Changed in v2.0

The `bfeai_session` cookie is `httpOnly`, meaning client-side JavaScript cannot read it. The previous version tried to read this cookie via `js-cookie`, which always failed. This version uses **server-side API routes** to read the cookie and return user/subscription data.

## Installation

### Step 1: Copy library files

Copy the `lib/bfeai-auth/` files to your app:

```
your-app/src/lib/bfeai-auth/
├── index.ts
├── types.ts
├── authHelpers.ts
├── AuthProvider.tsx
├── useAuth.ts
├── subscriptionCheck.ts
└── server.ts              ← NEW: server-side auth helpers
```

### Step 2: Create required API routes

Copy the template routes to your app:

```
your-app/src/app/api/auth/
├── me/
│   └── route.ts           ← from api-route-templates/auth-me-route.ts
└── subscription/
    └── route.ts           ← from api-route-templates/auth-subscription-route.ts
```

These endpoints are called by AuthProvider to get user info and subscription data.

### Step 3: Copy middleware

Copy `middleware-template.ts` to your project root as `middleware.ts`. Customize `PUBLIC_PATHS` for your app's routes.

### Step 4: Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr js-cookie jsonwebtoken
npm install --save-dev @types/js-cookie @types/jsonwebtoken
```

### Step 5: Set environment variables

```env
# Required — must match all BFEAI apps
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<must match all apps>

# Required — service URLs
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.bfeai.com
NEXT_PUBLIC_APP_NAME=your-app-name

# Required — Netlify builds
SKIP_ENV_VALIDATION=true
```

### Step 6: Wrap your app with AuthProvider

```tsx
// src/app/layout.tsx (or src/app/providers.tsx)
import { AuthProvider } from '@/lib/bfeai-auth';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### Step 7: Use in components

```tsx
import { useAuth } from '@/lib/bfeai-auth';

export function MyComponent() {
  const { user, subscription, loading, logout } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div>
      <p>Hello, {user.email}</p>
      <p>Subscription: {subscription?.status || 'none'}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Step 8: Set up SSO Code Exchange

Your app needs an SSO code exchange page. See `docs/04-Architecture/sso-client-registration.md` for the full process including getting your `SSO_CLIENT_SECRET`.

## File Reference

| File | Purpose | Context |
|------|---------|---------|
| `types.ts` | TypeScript interfaces | Both |
| `authHelpers.ts` | Client-side utilities (redirect, decode) | Client |
| `AuthProvider.tsx` | React context provider | Client |
| `useAuth.ts` | React hook for auth state | Client |
| `subscriptionCheck.ts` | Sync subscription helpers | Client |
| `server.ts` | Server-side JWT verification | Server only |
| `api-route-templates/` | Template API routes to copy | Server only |
| `middleware-template.ts` | Route protection middleware | Edge Runtime |

## Architecture

```
Browser                          Your App Server
  │                                    │
  │  GET /api/auth/me                  │
  │  (cookie sent automatically)  ───► │ reads httpOnly cookie
  │  ◄── { userId, email, profile }    │ verifies JWT signature
  │                                    │ fetches profile from Supabase
  │  GET /api/auth/subscription        │
  │  (cookie sent automatically)  ───► │ reads httpOnly cookie
  │  ◄── { subscriptions: {...} }      │ queries app_subscriptions table
  │                                    │
```

## Complete Documentation

- **Auth Flows (3 patterns):** `docs/04-Architecture/auth-flows.md`
- **SSO Client Registration:** `docs/04-Architecture/sso-client-registration.md`
- **App Registration (payments):** `docs/04-Architecture/app-registration-payments.md`
