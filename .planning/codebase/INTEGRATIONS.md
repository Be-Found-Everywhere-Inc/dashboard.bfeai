# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Authentication Providers:**
- Google OAuth 2.0 - Third-party login
  - SDK/Client: Supabase Auth + custom implementation in `lib/auth/oauth.ts`
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Flow: User clicks "Login with Google" → OAuth flow via Supabase → Token exchange → Profile fetch via Google API
  - Endpoints used:
    - `https://accounts.google.com/o/oauth2/v2/auth` - Authorization endpoint
    - `https://oauth2.googleapis.com/token` - Token exchange
    - `https://www.googleapis.com/oauth2/v2/userinfo` - User profile

- GitHub OAuth 2.0 - Third-party login (optional)
  - SDK/Client: Custom implementation in `lib/auth/oauth.ts`
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - Endpoints used:
    - `https://github.com/login/oauth/authorize` - Authorization endpoint
    - `https://github.com/login/oauth/access_token` - Token exchange
    - `https://api.github.com/user` - User profile
    - `https://api.github.com/user/emails` - Email address (if not public)

**Bot Protection:**
- Google reCAPTCHA - Bot protection on login/signup
  - Version: v2 and v3 supported
  - Implementation: `lib/security/recaptcha.ts`
  - Auth: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (public), `RECAPTCHA_SECRET_KEY` (server)
  - Verification: `https://www.google.com/recaptcha/api/siteverify`
  - Graceful degradation: If not configured, skips verification

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - URL: `https://wmhnkxkyettbeeamuppz.supabase.co`
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` v2.90.1
  - Tables managed:
    - `auth.users` - Supabase Auth managed table (email, password hash, metadata)
    - `public.profiles` - User profiles (id, email, full_name, avatar_url, company, phone, industry, is_active)
    - `public.security_events` - Audit log (event_type, severity, user_id, ip_address, user_agent, details)
  - Auth approach:
    - Supabase Auth handles user registration/login/password reset via email magic links
    - Custom JWT tokens generated for SSO cookie (separate from Supabase session)
    - Row-level security (RLS) enables multi-tenancy safeguards

**File Storage:**
- Supabase Storage
  - Bucket: `avatars` (public)
  - Purpose: User profile pictures
  - Max file size: 5 MB
  - Allowed types: JPEG, PNG, WebP, GIF
  - Implementation: `lib/storage/avatar.ts`
  - Access: Public URL via `${SUPABASE_URL}/storage/v1/object/public/avatars/{path}`

**Caching & Session Management:**
- Upstash Redis (serverless Redis)
  - Purpose: Rate limiting and request throttling
  - Connection: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
  - Client: `@upstash/redis` v1.36.1
  - Limiters configured in `lib/security/rate-limiter.ts`:
    - Login: 5 attempts per 15 minutes per IP
    - Signup: 3 attempts per hour per IP
    - Password reset: 3 attempts per hour per IP
    - API: 100 requests per minute per IP
  - Graceful degradation: If not configured, rate limiting disabled with warning
  - Analytics: Enabled to track rate limit metrics

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (primary)
  - Email/password signup and login via `supabase.auth.signUp()` and `supabase.auth.signInWithPassword()`
  - Password reset via `supabase.auth.resetPasswordForEmail()`
  - OAuth provider handling via Supabase
  - Implementation files: `lib/auth/jwt.ts`, `app/api/auth/*` routes

**SSO Cookie Architecture:**
- Custom JWT tokens (not Supabase sessions)
- Cookie name: `bfeai_session`
- Domain: `.bfeai.com` (leading dot for all subdomains)
- Attributes: httpOnly, secure (HTTPS), sameSite=lax, maxAge=7 days
- Token includes: userId, email, role, jti (JWT ID), exp, iat
- Verification: `JWTService.verifySSOToken()` in `lib/auth/jwt.ts`
- Expiry: 7 days (cross-domain SSO duration)

## Monitoring & Observability

**Error Tracking:**
- Sentry (optional, not currently integrated)
  - Env var: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
  - Status: Defined in `.env.example` but not implemented

**Logs:**
- Console logs via `console.log()`, `console.warn()`, `console.error()`
- Security event logging to Supabase `security_events` table
  - Events tracked: LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, LOCKOUT, PASSWORD_RESET_REQUEST, etc.
  - Severity levels: LOW, MEDIUM, HIGH, CRITICAL
  - Includes: IP address, user agent, event details

**Analytics:**
- Google Analytics (optional)
  - Env var: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - Status: Not implemented in codebase

## CI/CD & Deployment

**Hosting:**
- Netlify (primary)
  - Configuration: `netlify.toml`
  - Build command: `npm run build`
  - Publish directory: `.next`
  - Node version: 20
  - Plugin: @netlify/plugin-nextjs v5.15.4

**CI Pipeline:**
- GitHub Actions (inferred from Netlify config, no local config found)
- Deploy triggers: Pushes to `main` branch in `Be-Found-Everywhere-Inc/accounts.bfeai` repository

## Environment Configuration

**Required env vars (production):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-side)
- `JWT_SECRET` - Main SSO token secret (CRITICAL: must match across all apps)
- `JWT_ACCESS_SECRET` - Access token secret
- `JWT_REFRESH_SECRET` - Refresh token secret
- `UPSTASH_REDIS_URL` - Redis connection URL
- `UPSTASH_REDIS_TOKEN` - Redis auth token
- `NEXT_PUBLIC_APP_URL` - App base URL (default: https://accounts.bfeai.com)
- `NEXT_PUBLIC_APP_NAME` - App identifier (default: accounts)

**Optional but recommended:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` - reCAPTCHA
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` - Error tracking
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics

**Secrets location:**
- Local: `.env.local` (git-ignored)
- Netlify: Environment variables dashboard (`Site settings` → `Build & deploy` → `Environment`)
- Never commit secrets; use Netlify dashboard or secure vaults

## Webhooks & Callbacks

**Incoming Webhooks:**
- None currently implemented

**OAuth Callbacks:**
- `/api/auth/callback/google` - Handles Google OAuth callback
- `/api/auth/callback/github` - Handles GitHub OAuth callback (if enabled)
  - Expected flow: User returns from OAuth provider → callback extracts `code` and `session` → creates/updates user → sets SSO cookie → redirects to dashboard

**Cross-App Redirects:**
- Redirect from other `*.bfeai.com` apps to login: `https://accounts.bfeai.com/login?redirect=<original_url>`
- Redirect from other apps to logout: `https://accounts.bfeai.com/logout`
- All redirect URLs validated to start with `https://` and contain `.bfeai.com`

## Security Architecture

**SSO Cookie Sharing:**
- Cookie domain `.bfeai.com` allows sharing across:
  - accounts.bfeai.com (issuer)
  - payments.bfeai.com (consumer)
  - keywords.bfeai.com (consumer)
  - admin.bfeai.com (consumer)

**Rate Limiting:**
- Leverages Upstash Redis for distributed rate limiting
- IP-based limiting (supports Netlify, Vercel, Cloudflare headers)
- Configurable limits per endpoint

**Account Lockout:**
- After 5 failed login attempts within 15 minutes, account locked for 30 minutes
- Implementation: `lib/security/account-lockout.ts`
- Redis-backed state tracking

**CSRF Protection:**
- Token-based CSRF protection
- Implementation: `lib/security/csrf.ts`
- Tokens stored in httpOnly cookies

**XSS Protection:**
- DOMPurify sanitization on user inputs
- Implementation: `lib/security/xss-protection.ts`
- Strips dangerous HTML/JavaScript before storing

---

*Integration audit: 2026-01-29*
