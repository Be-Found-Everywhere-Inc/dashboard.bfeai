# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- TypeScript 5.9 - Full codebase (app routes, lib, components)
- JavaScript - Configuration files and build setup

**Secondary:**
- SQL - Supabase migrations and database schema (in shared project)

## Runtime

**Environment:**
- Node.js 20 (pinned in `netlify.toml`)

**Package Manager:**
- npm 10+ (inferred from lock patterns)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.1 - Full-stack framework with App Router, React Server Components
- React 19.2.3 - UI library with latest hooks and features

**Styling:**
- Tailwind CSS 3.4.19 - Utility-first CSS framework with custom brand colors
- PostCSS 8.5.6 - CSS processing (lightningcss engine)
- Autoprefixer 10.4.23 - Browser compatibility

**Testing:**
- Playwright 1.57.0 - E2E testing in `tests/e2e/`

**Build/Dev:**
- @netlify/plugin-nextjs 5.15.4 - Netlify deployment integration

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.90.1 - Supabase client for Auth and database
- `@supabase/ssr` 0.8.0 - Server-side Supabase client with cookie handling
- `jsonwebtoken` 9.0.3 - JWT generation and verification for SSO
- `bcryptjs` 3.0.3 - Password hashing (legacy, Supabase Auth is primary)

**Security:**
- `@upstash/ratelimit` 2.0.8 - Rate limiting via Upstash Redis
- `@upstash/redis` 1.36.1 - Redis client for rate limiter storage
- `isomorphic-dompurify` 2.35.0 - XSS protection via DOMPurify sanitization

**Forms & Validation:**
- `react-hook-form` 7.71.1 - Form state management
- `zod` 4.3.5 - TypeScript-first schema validation
- `@hookform/resolvers` 5.2.2 - Schema validation integration with RHF

**UI & Components:**
- `@bfeai/ui` file:./packages/ui - Local shared UI component library
  - Based on Radix UI 45+ primitives
  - `lucide-react` 0.562.0 - Icon library
  - `sonner` 2.0.7 - Toast notifications
  - `class-variance-authority` 0.7.1 - Component style variants
  - `clsx` 2.1.1 - Class name utility
  - `tailwind-merge` 3.4.0 - Merge Tailwind classes

**Utilities:**
- `js-cookie` 3.0.5 - Cookie management (supplementary to Next.js cookies API)
- `next-themes` 0.4.6 - Dark mode theme management
- `crypto` (Node.js built-in) - Token fingerprinting and random generation

## Configuration

**Environment:**
- `.env.local` - Local development secrets (not committed)
- `.env.example` - Template with all required and optional variables
- Environment variables required:
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - JWT: `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - Security: `ENCRYPTION_KEY`
  - Rate limiting: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
  - reCAPTCHA: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`
  - OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
  - Email: `EMAIL_FROM`, `EMAIL_PROVIDER`, `SENDGRID_API_KEY` (optional, not actively used)

**Build:**
- `tsconfig.json` - TypeScript with strict mode enabled, ES2017 target
- `next.config.js` - Powers-by header disabled, server action body limit 2MB
- `tailwind.config.js` - Custom theme extends with brand colors (purple, indigo, teal), CSS variables for semantic colors
- `.eslintrc.json` - Next.js ESLint config

## Platform Requirements

**Development:**
- Node.js 20+
- npm 10+
- Modern browser (Chrome, Firefox, Safari, Edge) for dev server
- Upstash Redis account (optional, gracefully degrades without it)
- Google OAuth app credentials (optional)
- reCAPTCHA v2/v3 credentials (optional)

**Production:**
- Netlify (primary deployment target)
- Supabase project (shared: wmhnkxkyettbeeamuppz)
- Upstash Redis (for rate limiting in production)
- Google OAuth credentials (if using OAuth)
- reCAPTCHA credentials (if using reCAPTCHA)

---

*Stack analysis: 2026-01-29*
