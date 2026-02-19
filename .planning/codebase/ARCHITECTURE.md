# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Central Authentication Gateway with Multi-Tier Security

The accounts.bfeai service implements a centralized SSO (Single Sign-On) architecture using JWT cookies shared across all `*.bfeai.com` subdomains. It follows a layered request/response pattern with security guards at multiple levels.

**Key Characteristics:**
- SSO cookie-based authentication valid across all BFEAI subdomains
- JWT token generation with 7-day expiry (configurable to 30 with "Remember Me")
- Multi-layer security: rate limiting → account lockout → CSRF → XSS sanitization
- Fire-and-forget security event logging (never blocks authentication flow)
- Separate JWT secrets for access/refresh tokens with fingerprinting
- Service role client for admin operations (user creation, profile management)

## Layers

**API Routes (app/api/):**
- Purpose: Handles all authentication and profile operations via REST endpoints
- Location: `app/api/auth/`, `app/api/profile/`, `app/api/account/`, `app/api/csrf/`
- Contains: Login, signup, logout, password reset, OAuth, profile management
- Depends on: JWT service, rate limiters, Supabase clients, security event logging
- Used by: Frontend pages and other BFEAI apps

**Security Layer (lib/security/):**
- Purpose: Enforce rate limiting, account lockout, CSRF, XSS, reCAPTCHA protection
- Location: `lib/security/rate-limiter.ts`, `account-lockout.ts`, `csrf.ts`, `xss-protection.ts`, `recaptcha.ts`
- Contains: Redis-backed rate limiters, in-memory lockout tracking, token validators
- Depends on: Upstash Redis (optional), environment configuration
- Used by: All API routes

**Authentication Layer (lib/auth/):**
- Purpose: JWT generation, verification, and cookie management for SSO
- Location: `lib/auth/jwt.ts`, `lib/auth/cookies.ts`, `lib/auth/oauth.ts`, `lib/auth/session.ts`
- Contains: Token generation/verification with fingerprinting, cookie setters, OAuth provider config
- Depends on: jsonwebtoken library, Next.js cookies API
- Used by: Login/signup/logout routes, shared auth library

**Database Layer (Supabase):**
- Purpose: Persistent storage for user profiles, security events, subscriptions
- Location: Database tables: `profiles`, `security_events`, `subscriptions`
- Contains: User profile data, authentication logs, subscription status
- Depends on: Supabase SDK (server and admin clients)
- Used by: All API routes for data persistence

**Presentation Layer (app/login/, app/signup/, app/(dashboard)/):**
- Purpose: User-facing pages for authentication and profile management
- Location: `app/login/page.tsx`, `app/signup/page.tsx`, `app/(dashboard)/profile/`, `app/(dashboard)/settings/`
- Contains: Form components, reCAPTCHA integration, OAuth button handlers
- Depends on: Radix UI components (@bfeai/ui), React Hook Form, Zod validation
- Used by: End users

## Data Flow

**Login Flow:**

1. User submits email/password on `/login` page
2. Frontend validates with Zod schema (`loginSchema`)
3. POST to `/api/auth/login` endpoint
4. Server-side security gates:
   - Check rate limit (5 attempts/15 min per IP via Upstash)
   - Check account lockout (30 min lockout after 5 failed attempts)
   - Verify reCAPTCHA token if enabled
5. Authenticate against Supabase Auth (`supabase.auth.signInWithPassword`)
6. On success:
   - Clear failed attempt count
   - Generate SSO JWT via `JWTService.generateSSOToken(userId, email, role)`
   - Set httpOnly cookie on `.bfeai.com` domain with 7-day expiry
   - Log security event (`LOGIN_SUCCESS`)
   - Return user data to frontend
7. Frontend redirects to `?redirect=` URL or `/profile`
8. Other BFEAI apps read cookie from `.bfeai.com` domain automatically

**Signup Flow:**

1. User submits full_name/email/password on `/signup` page
2. Frontend validates with Zod schema (`signupSchema`)
3. POST to `/api/auth/signup` endpoint
4. Server-side security gates:
   - Check rate limit (3 signups/hour per IP)
   - Verify reCAPTCHA token if enabled
5. Check if email already exists via `supabaseAdmin.auth.admin.listUsers()`
6. Create user via `supabaseAdmin.auth.admin.createUser()` with email_confirm=true
7. On success:
   - Update profile with optional company field
   - Auto-login: Generate SSO JWT and set cookie (same as login flow)
   - Log security event (`SIGNUP_SUCCESS`)
   - Return user data to frontend
8. Frontend redirects to `/profile` or external redirect URL

**Logout Flow:**

1. User clicks "Sign out" button
2. Frontend calls `/api/auth/logout` (POST)
3. Server-side:
   - Clear SSO cookie from `.bfeai.com` domain
   - Sign out Supabase session
   - Log security event (`LOGOUT`)
4. Frontend redirects to `/login`
5. Other BFEAI apps automatically lose access (cookie expired on `.bfeai.com`)

**State Management:**

- **Session State (httpOnly Cookie):** `bfeai_session` JWT token stored as secure httpOnly cookie on `.bfeai.com`
  - Automatically sent by browser to all `*.bfeai.com` subdomains
  - Cannot be accessed by JavaScript (XSS protection)
  - Verified on every protected API route via `/api/auth/session`
  - Expiry: 7 days (30 days if "Remember Me" checked)

- **Token State (Client-side):** Other BFEAI apps decode JWT from cookie to populate UI (no additional requests needed)
  - Decoded via `JWTService.decodeToken()` in shared auth library
  - Contains: userId, email, role, iat, exp, jti (JWT ID for revocation)

- **Security Events (Database):** Fire-and-forget logging to `security_events` table
  - Never blocks authentication flow
  - Used for audit trail and alerts

## Key Abstractions

**JWTService:**
- Purpose: Centralized JWT generation and verification with multiple token types
- Examples: `lib/auth/jwt.ts`
- Pattern: Static class with three token types:
  - SSO Token (7 days, shared across subdomains)
  - Access Token (15 min, with fingerprinting)
  - Refresh Token (7 days, httpOnly-only, with fingerprinting)
- Usage: `JWTService.generateSSOToken(userId, email, role)` for login/signup

**CookieService:**
- Purpose: Manage `.bfeai.com` domain cookies for SSO
- Examples: `lib/auth/cookies.ts`
- Pattern: Static class with methods for session and refresh cookies
- Usage: `CookieService.setSessionCookie(token)` after successful authentication

**Rate Limiter:**
- Purpose: Sliding window rate limiting via Upstash Redis
- Examples: `lib/security/rate-limiter.ts`
- Pattern: Multiple limiters configured per endpoint (login: 5/15min, signup: 3/1h)
- Usage: `checkRateLimit('login', clientIp)` returns `{ success, remaining, reset }`

**Account Lockout:**
- Purpose: Brute force protection with 30-minute lockout after 5 failed attempts
- Examples: `lib/security/account-lockout.ts`
- Pattern: In-memory Map tracking failed attempts per `{IP}:{email}` key
- Usage: `isAccountLocked(key)`, `recordFailedAttempt(key)`, `clearFailedAttempts(key)`

**Supabase Clients:**
- Purpose: Database access with different permission levels
- Examples: `lib/supabase/server.ts` (anon), `lib/supabase/admin.ts` (service role)
- Pattern: Factory functions return configured clients
- Usage:
  - `createClient()` → public data access with RLS
  - `createAdminClient()` → admin operations (user creation, profile updates)

**Validation Schemas:**
- Purpose: Zod schemas for request validation
- Examples: `lib/validation/schemas.ts`
- Pattern: Per-operation schemas (loginSchema, signupSchema, resetPasswordSchema, profileUpdateSchema)
- Usage: `validation.safeParse(body)` returns typed data or validation errors

**Dashboard Shell:**
- Purpose: Protected layout wrapping all authenticated pages
- Examples: `components/layout/DashboardShell.tsx`
- Pattern: Fetches session on mount, redirects to `/login` if not authenticated
- Usage: Wraps `(dashboard)` route group children

## Entry Points

**Next.js App Router:**
- Location: `app/` directory
- Triggers: HTTP requests to routes
- Responsibilities: Page rendering and API handling

**Public Routes (no auth required):**
- `/login` → `app/login/page.tsx` - Email/password + OAuth login
- `/signup` → `app/signup/page.tsx` - User registration
- `/forgot-password` → `app/forgot-password/page.tsx` - Password reset request
- `/reset-password` → `app/reset-password/page.tsx` - Password reset completion (with token)
- `/oauth-start` → `app/oauth-start/page.tsx` - OAuth flow initiation
- `/sso-complete` → `app/sso-complete/page.tsx` - SSO redirect handler
- `/logout` → `app/logout/page.tsx` - Logout page (clears cookie)

**Protected Routes (auth required, rendered by DashboardShell):**
- `/profile` → `app/(dashboard)/profile/page.tsx` - View/edit profile, avatar upload
- `/settings` → `app/(dashboard)/settings/page.tsx` - Account settings
- `/settings/password` → `app/(dashboard)/settings/password/page.tsx` - Change password
- `/settings/delete` → `app/(dashboard)/settings/delete/page.tsx` - Delete account

**API Routes (RESTful endpoints):**
- `POST /api/auth/login` - Email/password authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - Clear SSO cookie
- `GET /api/auth/session` - Get current session user
- `POST /api/auth/forgot-password` - Send password reset email
- `POST /api/auth/reset-password` - Complete password reset
- `POST /api/auth/change-password` - Change password (logged in)
- `GET /api/auth/oauth?provider=google` - Initiate OAuth
- `GET /api/auth/callback/[provider]` - OAuth callback handler
- `GET /api/profile` - Fetch user profile
- `PUT /api/profile` - Update profile
- `POST /api/profile/avatar` - Upload profile avatar
- `DELETE /api/account/delete` - Delete account and all data
- `GET /api/csrf` - Get CSRF token
- `GET /api/health` - Health check

## Error Handling

**Strategy:** Multi-level error handling with security logging

**Patterns:**

1. **Rate Limit Exceeded:** Return 429 with Retry-After header
   ```typescript
   // In login route
   if (!rateLimit.success) {
     return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: { 'Retry-After': ... } });
   }
   ```

2. **Account Lockout:** Return 423 Locked with unlock time
   ```typescript
   // After 5 failed attempts
   if (lockoutResult.isLocked) {
     return NextResponse.json({ error: 'Account temporarily locked', lockedUntil: ... }, { status: 423 });
   }
   ```

3. **Validation Error:** Return 400 with Zod error details
   ```typescript
   // In signup route
   const validation = signupSchema.safeParse(body);
   if (!validation.success) {
     return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
   }
   ```

4. **Authentication Failure:** Return 401 with user-friendly message
   ```typescript
   // Invalid credentials
   return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
   ```

5. **Conflict (Duplicate Email):** Return 409
   ```typescript
   // Email already exists
   return NextResponse.json({ error: 'Account with this email already exists' }, { status: 409 });
   ```

6. **Internal Error:** Return 500 with generic message (never expose stack traces)
   ```typescript
   return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
   ```

7. **Security Event Logging:** Fire-and-forget pattern (never blocks request)
   ```typescript
   logSecurityEvent('LOGIN_FAILED', 'MEDIUM', userId, request, { reason: error.message });
   // Continue processing even if logging fails
   ```

## Cross-Cutting Concerns

**Logging:** Fire-and-forget security event logging to `security_events` table
- Every login attempt (success/failure/lockout/reCAPTCHA) logged with IP, user agent
- Never blocks authentication flow
- Used for audit trail and security alerts

**Validation:** Zod schemas enforce input structure and constraints
- Client-side validation in forms for UX
- Server-side validation on all API routes for security
- Consistent error messages across forms and APIs

**Authentication:** JWT token in httpOnly cookie on `.bfeai.com` domain
- Token verified on every protected route via `/api/auth/session`
- Fingerprinting prevents token theft from localStorage exposure
- Separate access/refresh tokens with different expiries and purposes
- Fallback to mock auth for development (NEXT_PUBLIC_USE_MOCK_AUTH=true)

**Security:**
- Rate limiting via Upstash Redis (5 login/15min, 3 signup/1h per IP)
- Account lockout after 5 failed attempts for 30 minutes
- CSRF token validation on mutations
- XSS protection via DOMPurify sanitization
- reCAPTCHA v3 verification if configured
- HTTPS-only cookies in production

**Error Handling:**
- Public messages never expose stack traces or database details
- Security events logged at multiple severity levels (LOW/MEDIUM/HIGH/CRITICAL)
- Rate limit headers included in 429 responses for client retry logic
- Account lockout messages include unlock time

---

*Architecture analysis: 2026-01-29*
