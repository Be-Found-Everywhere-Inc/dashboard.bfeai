# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
accounts.bfeai/
├── app/                           # Next.js App Router - Pages and API routes
│   ├── layout.tsx                 # Root layout with theme + toaster providers
│   ├── page.tsx                   # Home (redirects to /profile)
│   ├── not-found.tsx              # 404 error page
│   │
│   ├── login/
│   │   └── page.tsx               # Email/password + OAuth login form
│   ├── signup/
│   │   └── page.tsx               # User registration form
│   ├── logout/
│   │   └── page.tsx               # Logout handler (clears SSO cookie)
│   ├── forgot-password/
│   │   └── page.tsx               # Password reset request form
│   ├── reset-password/
│   │   └── page.tsx               # Password reset completion (with token)
│   ├── oauth-start/
│   │   └── page.tsx               # OAuth flow initiation
│   ├── sso-complete/
│   │   └── page.tsx               # SSO completion redirect handler
│   │
│   ├── (dashboard)/               # Auth-protected route group
│   │   ├── layout.tsx             # Dashboard layout wrapping protected pages
│   │   ├── profile/
│   │   │   └── page.tsx           # Profile management and avatar upload
│   │   ├── settings/
│   │   │   ├── page.tsx           # Settings overview
│   │   │   ├── password/
│   │   │   │   └── page.tsx       # Change password form
│   │   │   └── delete/
│   │   │       └── page.tsx       # Delete account confirmation
│   │
│   └── api/                       # REST API endpoints
│       ├── health/
│       │   └── route.ts           # GET: Health check
│       ├── csrf/
│       │   └── route.ts           # GET: CSRF token generator
│       ├── auth/
│       │   ├── login/route.ts     # POST: Email/password authentication
│       │   ├── signup/route.ts    # POST: User registration
│       │   ├── logout/route.ts    # POST: Clear SSO cookie
│       │   ├── session/route.ts   # GET: Current session user
│       │   ├── forgot-password/route.ts  # POST: Send reset email
│       │   ├── reset-password/route.ts   # POST: Complete reset
│       │   ├── change-password/route.ts  # POST: Change password
│       │   ├── set-sso-cookie/route.ts   # POST: Set SSO cookie (internal)
│       │   ├── set-oauth-redirect/route.ts  # POST: Store OAuth redirect
│       │   ├── oauth/route.ts    # GET: OAuth initiation
│       │   └── callback/[provider]/route.ts  # GET: OAuth callback
│       ├── profile/
│       │   ├── route.ts           # GET/PUT: Profile CRUD
│       │   └── avatar/
│       │       └── route.ts       # POST: Avatar upload to Supabase Storage
│       └── account/
│           └── delete/
│               └── route.ts       # DELETE: Account deletion with cleanup
│
├── lib/                           # Shared business logic and utilities
│   ├── auth/
│   │   ├── jwt.ts                 # JWT generation/verification (SSO tokens)
│   │   ├── cookies.ts             # Cookie management for .bfeai.com domain
│   │   ├── oauth.ts               # OAuth provider configuration
│   │   ├── session.ts             # Session state management
│   │   └── index.ts               # Auth exports
│   ├── security/
│   │   ├── rate-limiter.ts        # Upstash Redis sliding window rate limiting
│   │   ├── account-lockout.ts     # Brute force protection (30 min lockout)
│   │   ├── csrf.ts                # CSRF token generation/validation
│   │   ├── xss-protection.ts      # DOMPurify XSS sanitization
│   │   ├── recaptcha.ts           # reCAPTCHA v3 verification
│   │   └── session-manager.ts     # Session tracking and management
│   ├── supabase/
│   │   ├── client.ts              # Browser client for SSR
│   │   ├── server.ts              # Server-side client (anon key, RLS)
│   │   ├── admin.ts               # Admin client (service role key)
│   │   └── types.ts               # Supabase type definitions
│   ├── storage/
│   │   └── avatar.ts              # Avatar upload to Supabase Storage
│   ├── validation/
│   │   ├── schemas.ts             # Zod validation schemas for all operations
│   │   └── index.ts               # Validation exports
│   └── utils.ts                   # General utilities (cn for class merging, etc.)
│
├── components/                    # React components
│   ├── layout/
│   │   └── DashboardShell.tsx     # Protected layout with sidebar navigation
│   ├── providers/
│   │   └── toaster-provider.tsx   # Sonner toast notification provider
│   ├── recaptcha.tsx              # reCAPTCHA script loader and hook
│   ├── theme-provider.tsx         # next-themes wrapper for dark/light mode
│   ├── theme-toggle.tsx           # Theme switcher button component
│   └── ui-backup/                 # Backup of Radix UI components (emergency fallback)
│
├── packages/                      # Local npm packages
│   └── ui/                        # @bfeai/ui - Radix UI wrapper components
│       ├── src/
│       │   ├── components/        # 45+ UI components (button, input, dialog, etc.)
│       │   ├── lib/               # UI utilities and helpers
│       │   └── index.ts           # Component exports
│       ├── package.json           # Package metadata
│       └── tsconfig.json          # TypeScript config
│
├── shared-auth-library/           # Shared authentication library for other BFEAI apps
│   ├── types.ts                   # BFEAIUser, AuthState, AuthContextValue types
│   ├── authHelpers.ts             # decodeJWT, isTokenExpired, getTokenFromCookie, etc.
│   ├── useAuth.ts                 # React hook for auth state
│   ├── AuthProvider.tsx           # React context provider wrapper
│   ├── subscriptionCheck.ts       # Subscription verification utilities
│   ├── middleware-template.ts     # Route protection middleware template
│   ├── index.ts                   # Public exports
│   └── README.md                  # Usage guide for other apps
│
├── src/
│   └── types/
│       └── database.ts            # Supabase auto-generated database types
│
├── tests/                         # Playwright E2E tests
│   ├── setup/
│   │   └── global-setup.ts        # Global test setup
│   ├── utils/
│   │   ├── auth-helpers.ts        # Test utilities for auth
│   │   ├── db-helpers.ts          # Test utilities for database
│   │   └── test-data.ts           # Fixture data for tests
│   └── e2e/
│       ├── auth.spec.ts           # Login/logout tests
│       ├── signup.spec.ts         # Registration tests
│       ├── profile.spec.ts        # Profile management tests
│       ├── password-reset.spec.ts # Password reset flow tests
│       ├── avatar-upload.spec.ts  # Avatar upload tests
│       └── sso-cookie.spec.ts     # Cross-domain SSO tests
│
├── public/                        # Static assets
│   └── brand/                     # Logo and branding assets
│       ├── BFE_Icon_TRN.png       # Icon-only logo (small UI)
│       └── BFE_Logo_TRN_BG.png    # Full wordmark logo
│
├── playwright.config.ts           # Playwright E2E test configuration
├── netlify.toml                   # Netlify deployment configuration
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript compiler options
├── tailwind.config.js             # Tailwind CSS 3.4 configuration
├── globals.css                    # Global styles and Tailwind directives
└── .env.local (not committed)     # Local environment variables
```

## Directory Purposes

**app/ (Next.js App Router):**
- Purpose: Pages and API routes using Next.js file-based routing
- Contains: React components for pages, API route handlers
- Key files: `layout.tsx` (root wrapper), `page.tsx` (route entry points)

**lib/:**
- Purpose: Reusable business logic and utility functions
- Contains: Authentication, security, database, validation logic
- Key subdirectories: `auth/` (JWT/cookies), `security/` (rate limit/lockout), `supabase/` (DB clients), `validation/` (Zod schemas)

**components/:**
- Purpose: Reusable React UI components and layout wrappers
- Contains: DashboardShell layout, theme provider, reCAPTCHA integration
- Key files: `layout/DashboardShell.tsx` (protected layout), `theme-provider.tsx` (dark/light mode)

**packages/ui/:**
- Purpose: Local @bfeai/ui package with Radix UI-wrapped components
- Contains: 45+ UI components imported from Radix UI
- Usage: `import { Button, Input, Dialog } from '@bfeai/ui'`

**shared-auth-library/:**
- Purpose: Shared authentication library copied to other BFEAI apps
- Contains: React hooks, context providers, type definitions, helper functions
- Usage: Other apps copy these files to `lib/bfeai-auth/` for SSO integration

**tests/:**
- Purpose: Playwright E2E tests for authentication flows
- Contains: Test specs for login, signup, profile, password reset
- Key files: `e2e/*.spec.ts` test files

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout wrapping all pages with providers
- `app/page.tsx` - Home route (redirects to `/profile`)
- `app/login/page.tsx` - Login page entry point
- `app/api/auth/login/route.ts` - Login API endpoint

**Configuration:**
- `package.json` - Dependencies (Next.js 16, React 19, TypeScript, Tailwind, Radix UI, etc.)
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - Tailwind CSS customization (Tailwind 3.4)
- `playwright.config.ts` - E2E test configuration
- `netlify.toml` - Netlify build and deployment config

**Core Logic:**
- `lib/auth/jwt.ts` - SSO JWT generation and verification
- `lib/auth/cookies.ts` - `.bfeai.com` domain cookie management
- `lib/security/rate-limiter.ts` - Upstash Redis rate limiting
- `lib/security/account-lockout.ts` - Brute force lockout protection
- `lib/validation/schemas.ts` - Zod validation schemas for all forms

**Authentication Routes:**
- `app/api/auth/login/route.ts` - POST: Email/password authentication
- `app/api/auth/signup/route.ts` - POST: User registration
- `app/api/auth/logout/route.ts` - POST: Clear SSO cookie
- `app/api/auth/session/route.ts` - GET: Current session user
- `app/api/auth/callback/[provider]/route.ts` - GET: OAuth callback

**Profile Management:**
- `app/api/profile/route.ts` - GET/PUT: Profile CRUD
- `app/api/profile/avatar/route.ts` - POST: Avatar upload
- `app/api/account/delete/route.ts` - DELETE: Account deletion

**Protected Pages:**
- `app/(dashboard)/layout.tsx` - DashboardShell layout with auth check
- `app/(dashboard)/profile/page.tsx` - Profile view/edit
- `app/(dashboard)/settings/page.tsx` - Settings overview
- `app/(dashboard)/settings/password/page.tsx` - Change password

**Shared Auth Library:**
- `shared-auth-library/AuthProvider.tsx` - React context provider (copy to other apps)
- `shared-auth-library/useAuth.ts` - React hook for auth state (copy to other apps)
- `shared-auth-library/types.ts` - Type definitions (copy to other apps)
- `shared-auth-library/authHelpers.ts` - Token/cookie utilities (copy to other apps)

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: PascalCase (e.g., `DashboardShell.tsx`, `LoginForm.tsx`)
- Utilities: camelCase (e.g., `authHelpers.ts`, `rate-limiter.ts`)
- Schemas: suffixed with Schema (e.g., `loginSchema`, `signupSchema`)
- Types: PascalCase or Interface prefix (e.g., `BFEAIUser`, `AuthState`)

**Directories:**
- Feature dirs: kebab-case (e.g., `api/auth/`, `lib/security/`)
- Route groups: parentheses (e.g., `(dashboard)/`, Next.js convention)
- Dynamic routes: brackets (e.g., `[provider]/`, Next.js convention)

**Functions:**
- API handlers: `POST()`, `GET()`, etc. (Next.js convention)
- Validation: `validate*` or `*Schema` (e.g., `validateEmail`, `loginSchema`)
- Getters: `get*` (e.g., `getSessionToken`, `getClientIp`)
- Setters: `set*` (e.g., `setSessionCookie`)
- Checkers: `is*` or `check*` (e.g., `isTokenExpired`, `checkRateLimit`)
- Loggers: `log*` (e.g., `logSecurityEvent`)

**Variables:**
- Booleans: prefix with `is` or `has` (e.g., `isLoading`, `isAccountLocked`)
- Collections: plural (e.g., `errors`, `limiters`, `subscriptions`)
- Temporary/derived: `*Result`, `*Data`, `*Response` (e.g., `loginResult`, `userData`)

**Types:**
- User types: `BFEAIUser`, `User`, `UserData`
- State types: `AuthState`, `SessionState`
- Context types: `AuthContextValue`, `ContextValue`
- API types: `LoginInput`, `SignupInput` (derived from Zod schemas)

## Where to Add New Code

**New Authentication Feature (e.g., two-factor auth):**
- Handler: `app/api/auth/two-factor/route.ts`
- Schema: Add to `lib/validation/schemas.ts`
- Page (UI): `app/login/two-factor/page.tsx` or `app/(dashboard)/settings/two-factor/page.tsx`
- Security: Add rate limiter config to `lib/security/rate-limiter.ts` if needed
- Types: Add to `shared-auth-library/types.ts` if used by other apps

**New Protected Page (e.g., billing info):**
- File: `app/(dashboard)/billing/page.tsx`
- API: `app/api/billing/route.ts` if needed
- Layout: Automatically uses `(dashboard)/layout.tsx` (DashboardShell)
- Navigation: Add to NAV_ITEMS array in `components/layout/DashboardShell.tsx`

**New Utility Function (e.g., email validation):**
- File: Add to existing `lib/validation/schemas.ts` or create new `lib/validators.ts`
- If used by other apps: Export from `shared-auth-library/index.ts` with copy instructions

**New Security Guard (e.g., IP whitelist):**
- File: `lib/security/ip-whitelist.ts`
- Integration: Call from relevant API routes (e.g., sensitive operations)
- Config: Store IP list in environment variable or database

**New Component for Reuse:**
- File: `packages/ui/src/components/[component-name].tsx`
- Export: Add to `packages/ui/src/index.ts`
- Import in accounts app: `import { ComponentName } from '@bfeai/ui'`

**New Test:**
- File: `tests/e2e/[feature].spec.ts`
- Setup: Import helpers from `tests/utils/`
- Pattern: Follow existing test structure in `tests/e2e/auth.spec.ts`

## Special Directories

**packages/ui/:**
- Purpose: Local npm package with Radix UI wrapper components
- Generated: No (hand-written components)
- Committed: Yes
- Note: Referenced as `"@bfeai/ui": "file:./packages/ui"` in package.json (NOT npm published)

**shared-auth-library/:**
- Purpose: Shared authentication code for other BFEAI apps to copy
- Generated: No (hand-written)
- Committed: Yes
- Note: Other apps should copy contents to their `lib/bfeai-auth/` directory

**tests/:**
- Purpose: Playwright E2E test suite
- Generated: No (hand-written)
- Committed: Yes
- Note: Run with `npm run test` or `npm run test:e2e`

**public/brand/:**
- Purpose: BFEAI branding assets (logos, icons)
- Generated: No (from design team)
- Committed: Yes
- Note: Used in app layouts and metadata

**src/types/:**
- Purpose: Supabase auto-generated database types
- Generated: Yes (via Supabase CLI or manual)
- Committed: Yes
- Note: Regenerate when database schema changes

**node_modules/, .next/, .playwright-mcp/:**
- Purpose: Build artifacts and dependencies
- Generated: Yes
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-29*
