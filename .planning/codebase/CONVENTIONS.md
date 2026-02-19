# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- Kebab-case for most files: `rate-limiter.ts`, `account-lockout.ts`, `session-manager.ts`
- PascalCase for React components: `DashboardShell.tsx`, `ThemeToggle.tsx`, `LoginForm` (inline components)
- Database/schema files: kebab-case (`db-helpers.ts`)
- API route files: lowercase with hyphens in directories (`/api/auth/login/route.ts`, `/api/auth/change-password/route.ts`)
- Test files: `.spec.ts` suffix (`auth.spec.ts`, `signup.spec.ts`, `password-reset.spec.ts`)

**Functions:**
- camelCase for all functions: `logSecurityEvent()`, `generateToken()`, `getClientIp()`, `verifySSOToken()`
- Static methods use PascalCase on class: `JWTService.generateSSOToken()`, `JWTService.verifySSOToken()`
- React hooks use `use` prefix: `useAuth()`, `useRecaptcha()`, `useForm()`, `useRouter()`
- Helper functions with verb prefix: `checkRateLimit()`, `recordFailedAttempt()`, `clearFailedAttempts()`, `verifySessionCookie()`

**Variables:**
- camelCase for all variables: `userId`, `userEmail`, `sessionCookie`, `isLoading`, `rememberMe`
- Boolean variables use `is` or `has` prefix: `isAccountLocked`, `isLoading`, `isRecaptchaEnabled`, `isLoggingOut`, `hasText`
- Constants use UPPER_SNAKE_CASE: `USE_MOCK_AUTH`, `MAX_SESSIONS_PER_USER`, `SESSION_TIMEOUT_MS`, `ACCESS_TOKEN_EXPIRY`
- String constants for configuration: `'LOGIN_FAILED'`, `'ACCOUNT_LOCKED_ATTEMPT'`, `'LOGIN_SUCCESS'`

**Types:**
- PascalCase for interface/type names: `JWTPayload`, `UserData`, `DashboardShellProps`, `Session`, `LoginInput`
- Suffix types that describe shape: interface `Session`, type `LoginInput`, interface `DashboardShellProps`
- Type unions imported as `type`: `type LoginInput = z.infer<typeof loginSchema>`

## Code Style

**Formatting:**
- ESLint config: `extends: ["next/core-web-vitals", "next/typescript"]` (base Next.js lint rules)
- No explicit Prettier config found—relies on default formatting
- Typical patterns: 2-space indentation, single quotes in JS/TS, double quotes in JSX attributes
- Maximum line length: implied ~120 characters (login form wraps long lines)

**Linting:**
- ESLint enabled via `npm run lint` and `npm run lint:fix`
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- No null checks required for JSDoc comments

## Import Organization

**Order:**
1. External libraries (React, Next.js, third-party packages)
2. Internal modules from `@/` path alias
3. Types/interfaces (imported with `type` keyword when appropriate)

**Examples from codebase:**
```typescript
// External
import { NextRequest, NextResponse } from 'next/server';
import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

// Internal components and utils
import { Button, Input, Label, Card } from '@bfeai/ui';
import { loginSchema, type LoginInput } from '@/lib/validation/schemas';
import { useRecaptcha } from '@/components/recaptcha';

// Types with 'type' keyword
import type { JWTPayload } from '@/lib/auth/jwt';
```

**Path Aliases:**
- `@/*` maps to root directory (accounts.bfeai has no `src/` directory)
- Import pattern: `@/lib/`, `@/components/`, `@/app/api/`
- Shared auth library: `@/lib/bfeai-auth/` (for other apps integrating SSO)

## Error Handling

**Patterns:**
- Try-catch blocks wrap async operations and API calls
- Errors logged with `console.error()` including context
- Return structured error responses with HTTP status codes:
  - 400: Bad request (validation, missing params)
  - 401: Unauthorized (no auth)
  - 403: Forbidden (permission denied)
  - 404: Not found (resource missing)
  - 423: Locked (account locked)
  - 429: Rate limited (too many requests)
  - 500: Internal server error

**Security event logging:**
```typescript
async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  userId: string | null,
  request: NextRequest,
  details?: Record<string, any>
) {
  try {
    // Insert to security_events table
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Never fail the request if logging fails
  }
}
```

- Security events classified by severity level
- Event types stored as strings: `'LOGIN_SUCCESS'`, `'LOGIN_FAILED'`, `'ACCOUNT_LOCKED_ATTEMPT'`, `'RATE_LIMIT_EXCEEDED'`
- Fire-and-forget pattern: logging never blocks main flow

## Logging

**Framework:** `console.error()`, `console.log()`, `console.warn()` (built-in Node.js)

**Patterns:**
- `console.error()` for failures with error context: `console.error('Login error:', error)`
- `console.log()` for important info: `console.log('[MOCK AUTH] Login attempt:', email)`
- `console.warn()` for configuration warnings: `console.warn('⚠️ Rate limiting disabled: Upstash Redis not configured')`
- Logs include context and data for debugging
- Use emoji prefixes for visibility: `'✅'`, `'⚠️'`, `'🧪'`, `'🔍'`

**When to log:**
- Auth operations (login, signup, logout)
- Security events (failed attempts, lockouts, rate limit exceeded)
- Configuration issues (missing env vars, missing Upstash)
- API errors from external services
- Never log passwords or sensitive data

## Comments

**When to Comment:**
- Complex security logic (rate limiting, account lockout)
- Non-obvious JWT token generation/verification
- Purpose of utility functions
- Why a specific approach was chosen (not just what it does)
- Configuration constants: why limits were chosen

**JSDoc/TSDoc:**
- Used for exported functions and types
- Describe parameters and return values
- Example from `session-manager.ts`:
```typescript
/**
 * Create a new session for a user
 * Removes oldest session if max limit is reached
 */
export function createSession(
  userId: string,
  sessionId: string,
  userAgent: string,
  ipAddress: string
): void
```

- Simple one-line descriptions for helper functions
- Parameter names in comments match exact code

## Function Design

**Size:**
- API routes: 50-100 lines (handle request, validate, call DB, return response)
- Helper functions: 10-30 lines (single responsibility)
- Components: 50-200 lines (render + hooks + event handlers)
- No arbitrary line limit, but prefer breaking long functions into helpers

**Parameters:**
- Use destructuring for object parameters in components
- Spread operators for flexible props: `{ ...devices['Desktop Chrome'] }`
- Positional params for simple functions: `getClientIp(req)`
- Named params in object for complex operations: `{ success, remaining, reset }`

**Return Values:**
- Single responsibility: functions return one type
- Promise-based for async: `async function() => Promise<Response>`
- Structured objects for multiple values: `{ success: boolean, remaining: number, reset: Date }`
- Union types for variants: `{ success: true, user: {...} } | { error: string }`
- NextResponse for API routes (never plain objects)

**Error handling in functions:**
```typescript
// API route pattern
export async function POST(request: NextRequest) {
  try {
    // Validation
    // Business logic
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error('Operation error:', error);
    return NextResponse.json({ error: 'message' }, { status: 500 });
  }
}
```

## Module Design

**Exports:**
- Named exports for utilities: `export function checkRateLimit()`, `export const rateLimiters = {}`
- Default export for React pages: `export default function LoginPage()`
- Class with static methods: `export class JWTService { static generateSSOToken() }`
- Mix of named and default not used in same file

**Barrel Files:**
- Used in `shared-auth-library/index.ts` for public API
- Not used in component directories
- Never wildcard imports (`import * as`), always explicit imports

**'use client' directive:**
- Required in any component using hooks, event handlers, or browser APIs
- `'use client';` at top of file before imports
- Examples: `app/login/page.tsx`, `components/layout/DashboardShell.tsx`, `app/(dashboard)/profile/page.tsx`

**'use server' (if used):**
- Not observed in current codebase
- Server-side logic in `/api/` routes instead

## Database and ORM Patterns

**Supabase client usage:**
```typescript
// Server-side
const { createClient } = await import('@/lib/supabase/server');
const supabase = await createClient();

// Query pattern
const { data: profile, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();
```

- Destructure `{ data, error }` to check for errors
- Use `.single()` when expecting one row
- Always verify user ownership with `eq('id', userId)` to respect RLS
- Never use `.select('*')` on sensitive tables—be explicit about columns

## Tailwind CSS

**Version:** 3.4.19 (non-PostCSS, uses config file)

**Patterns:**
- Utility-first approach: `className="min-h-screen flex items-center justify-center"`
- Color system with brand colors: `bg-brand-indigo`, `text-accent`, `border-border`
- Semantic modifiers: `group-hover:`, `disabled:`, `aria-invalid:`
- State classes: `animate-spin`, `animate-fade-in`, `animate-delay-100`
- Responsive: `md:flex-row`, `lg:flex-row`, `lg:px-8`

**Custom utilities in codebase:**
- `cn()` utility from `lib/utils.ts` merges clsx and tailwind-merge
- Used to conditionally apply Tailwind classes: `cn('base-class', isActive && 'active-class')`
- Prevents class conflicts when merging

---

*Convention analysis: 2026-01-29*
