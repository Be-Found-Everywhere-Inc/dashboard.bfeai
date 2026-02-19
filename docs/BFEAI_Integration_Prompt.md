# BFEAI Ecosystem Integration Prompt

**Copy and paste this entire prompt into your AI coding assistant (Claude Code, Cursor, Copilot, etc.) to integrate your app into the BFEAI SSO ecosystem.**

---

## Instructions for AI Assistant

You are helping integrate a new app into the BFEAI multi-app SaaS ecosystem. This ecosystem uses Single Sign-On (SSO) via JWT cookies shared across all `*.bfeai.com` subdomains.

### Reference Document

The complete integration guide is located at:
```
BFEAI_Developer_Integration_Guide.md
```

**Read this file first before proceeding.** It contains critical implementation details, code files to copy, and lessons learned from production debugging.

---

## Integration Task

### App Details (FILL THESE IN)

```
App Name: _________________ (lowercase, e.g., "backlinks", "content", "analytics")
Subdomain: _________________.bfeai.com
Framework: Next.js (App Router / Pages Router - circle one)
```

### What You Need to Do

1. **Read the Integration Guide**
   - Read `BFEAI_Developer_Integration_Guide.md` completely
   - Pay special attention to **Section 3: Critical Logout Implementation**
   - Note the **Multi-Domain E2E Test** requirements

2. **Install Dependencies**
   ```bash
   npm install @supabase/supabase-js @supabase/auth-helpers-nextjs js-cookie jsonwebtoken
   npm install -D @types/js-cookie @types/jsonwebtoken
   ```

3. **Create Auth Library Files**
   Create the folder `src/lib/bfeai-auth/` and add these files (code is in the integration guide):
   - `types.ts` - TypeScript type definitions
   - `authHelpers.ts` - Cookie and redirect utilities
   - `subscriptionCheck.ts` - Subscription verification
   - `useAuth.ts` - React hook
   - `AuthProvider.tsx` - React context provider
   - `index.ts` - Main exports

4. **Create Middleware**
   Create `middleware.ts` in the project ROOT (not in src/) with:
   - Protected route checking
   - Session cookie verification
   - **CRITICAL**: Redirect logged-in users away from `/login`, `/signup`, `/`

5. **Wrap App with AuthProvider**
   Update `app/layout.tsx` (or `pages/_app.tsx`) to wrap the app

6. **Add Environment Variables**
   Create `.env.local` with values from the core team

7. **Implement Logout Correctly**
   **CRITICAL**: Always redirect to `accounts.bfeai.com/logout` for logout.
   Never try to clear the cookie directly from your app.

---

## Critical Implementation Rules

### Cookie Handling (MUST FOLLOW)

1. **Cookie Domain**: Always `.bfeai.com` (with leading dot)
2. **Cookie Name**: `bfeai_session`
3. **Cookie Attributes**: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`

### Logout (CRITICAL - Read Carefully)

**DO NOT** try to clear the SSO cookie from your app. This will fail.

**DO** redirect users to the accounts service for logout:

```typescript
// In your logout handler
const handleLogout = () => {
  window.location.href = 'https://accounts.bfeai.com/logout';
};
```

The accounts service uses a dual-method approach to clear cookies:
1. Next.js `cookies()` API with `maxAge: 0`
2. Manual `Set-Cookie` header with both `Max-Age=0` AND `Expires`

This was discovered through production debugging - do not deviate from this pattern.

### Middleware Requirements

Your middleware MUST include this check at the START:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('bfeai_session');

  // Redirect logged-in users away from auth pages
  if (sessionCookie?.value && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // ... rest of middleware
}
```

---

## Testing Requirements

After integration, you MUST test SSO across ALL apps in the ecosystem:

### Current Ecosystem Apps
- `accounts.bfeai.com` (auth)
- `payments.bfeai.com` (billing)
- `keywords.bfeai.com`
- Your new app

### Test Flow (Run from EACH app as starting point)

1. Visit your app (unauthenticated) → Should redirect to accounts.bfeai.com/login
2. Log in → Should redirect back to your app
3. Visit EACH other app → Should be logged in (no login prompt)
4. Visit accounts.bfeai.com → Should show profile (NOT login page)
5. Logout → Should redirect to accounts.bfeai.com/login
6. Visit EACH app again → Should redirect to login (cookie cleared)

**If any step fails, do not deploy. Debug using the guide's troubleshooting section.**

---

## Environment Variables Needed

Request these from the core team:

```env
NEXT_PUBLIC_APP_NAME=yourapp
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from_core_team>
SUPABASE_SERVICE_ROLE_KEY=<from_core_team>
JWT_SECRET=<from_core_team>
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.bfeai.com
NEXT_PUBLIC_PAYMENTS_URL=https://payments.bfeai.com
NEXT_PUBLIC_APP_URL=https://yourapp.bfeai.com
```

---

## Checklist Before Deployment

- [ ] All auth library files created in `src/lib/bfeai-auth/`
- [ ] `middleware.ts` in project root with logged-in redirect
- [ ] `AuthProvider` wraps entire app
- [ ] Environment variables configured
- [ ] `.env.local` in `.gitignore`
- [ ] Logout redirects to `accounts.bfeai.com/logout`
- [ ] Multi-domain E2E test passed (ALL apps tested)
- [ ] Premium features check subscription status

---

## Common Mistakes to Avoid

1. **Don't clear cookies directly** - Always redirect to accounts.bfeai.com/logout
2. **Don't forget the leading dot** - Cookie domain must be `.bfeai.com`
3. **Don't put middleware in src/** - It must be in the project root
4. **Don't skip the logged-in redirect** - Users shouldn't see login page when authenticated
5. **Don't test only your app** - Test ALL ecosystem apps for SSO

---

## Getting Help

If you encounter issues:
1. Check Section 9 "Common Issues & Debugging" in the integration guide
2. Use the debug endpoint pattern from the guide to inspect cookie status
3. Check browser DevTools → Application → Cookies → `.bfeai.com`
4. Contact the core team with specific error details

---

## Start Integration

AI Assistant: Please begin by:
1. Reading `BFEAI_Developer_Integration_Guide.md`
2. Confirming you understand the critical logout implementation
3. Creating the auth library files in `src/lib/bfeai-auth/`
4. Setting up the middleware with the logged-in redirect
5. Reporting back with a checklist of completed items

Remember: The SSO cookie is shared across ALL `*.bfeai.com` apps. Your integration affects the entire ecosystem, so follow the guide exactly.
