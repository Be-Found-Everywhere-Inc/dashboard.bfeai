# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- Playwright 1.57.0 (E2E testing only)
- Config: `playwright.config.ts`
- No unit tests (no Jest/Vitest configured)

**Assertion Library:**
- Playwright's built-in `expect()` API
- No external assertion library needed

**Run Commands:**
```bash
npm run test              # Run all E2E tests (alias for test:e2e)
npm run test:e2e         # Run all tests headless (Chromium only)
npm run test:e2e:ui      # Interactive UI mode (useful for debugging)
npm run test:e2e:headed  # Run with browser visible (visual debugging)
npm run test:e2e:debug   # Debug mode (pause and step through)
npm run test:e2e:report  # View HTML test report
```

## Test File Organization

**Location:**
- `tests/e2e/` - All E2E test specs
- `tests/setup/` - Global setup and teardown
- `tests/utils/` - Helper functions and test data

**Naming:**
- Spec files: `*.spec.ts` suffix
- Examples: `auth.spec.ts`, `signup.spec.ts`, `password-reset.spec.ts`, `profile.spec.ts`

**Structure:**
```
tests/
├── setup/
│   └── global-setup.ts          # Initialize test environment
├── utils/
│   ├── auth-helpers.ts          # Login, logout, cookie helpers
│   ├── db-helpers.ts            # Database setup/teardown
│   └── test-data.ts             # Test user data generators
└── e2e/
    ├── auth.spec.ts             # Login/logout flows
    ├── signup.spec.ts           # Registration flow
    ├── password-reset.spec.ts   # Password reset flow
    ├── profile.spec.ts          # Profile management
    ├── avatar-upload.spec.ts    # Avatar upload
    ├── sso-cookie.spec.ts       # Cross-domain SSO
    └── production.spec.ts       # Production env tests
```

## Test Structure

**Suite Organization:**
```typescript
import { test, expect } from '@playwright/test';
import { login, getSessionCookie, verifySessionCookie, clearCookies } from '../utils/auth-helpers';
import { getDefaultTestUser, getInvalidCredentials } from '../utils/test-data';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await clearCookies(page);
  });

  test('successful login with valid credentials', async ({ page }) => {
    const testUser = getDefaultTestUser();
    await page.goto('/login');
    // ... test steps
  });

  test('failed login with invalid password', async ({ page }) => {
    // ... test
  });
});
```

**Patterns:**
- Use `test.describe()` to group related tests
- Use `test.beforeEach()` to reset state (clear cookies, etc.)
- Each test is independent and can run in any order
- Use `test.skip()` to temporarily disable tests
- Use `.skip` suffix for tests that are disabled (`test.skip('failed login with invalid email', ...)`

## Mocking

**Framework:** None—Playwright tests against real running server

**No mocking patterns used** because:
- Tests run against actual `http://localhost:3000` (real dev server)
- Tests interact with real Supabase database (test instance)
- Real authentication flow is tested end-to-end

**Global Setup ensures test environment:**
```typescript
async function globalSetup(config: FullConfig) {
  console.log('🧪 Setting up test environment...');

  // 1. Verify database connection
  const dbConnected = await verifyDatabaseConnection();

  // 2. Check required environment variables
  const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'JWT_SECRET', ...];

  // 3. Create test user if it doesn't exist
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase.auth.admin.createUser({
    email: testUser.email,
    password: testUser.password,
    email_confirm: true,
  });
}
```

## Fixtures and Factories

**Test Data:**
```typescript
// Test data generators in tests/utils/test-data.ts

// Generate unique user per test
export function generateTestUser() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: 'TestPass123!',
    fullName: `Test User ${timestamp}`,
  };
}

// Consistent test user for repeated login tests
export function getDefaultTestUser() {
  return {
    email: 'test@example.com',
    password: 'Password123',
  };
}

// Invalid credentials for error case testing
export function getInvalidCredentials() {
  return {
    invalidEmail: 'notanemail',
    wrongEmail: 'nonexistent@example.com',
    wrongPassword: 'WrongPassword123',
    emptyEmail: '',
    emptyPassword: '',
  };
}
```

**Location:**
- `tests/utils/test-data.ts` - Factory functions for test data
- `tests/utils/auth-helpers.ts` - Auth-specific helpers
- `tests/utils/db-helpers.ts` - Database helpers (setup/teardown)
- `tests/setup/global-setup.ts` - Environment initialization

## Helper Functions

**Auth Helpers (tests/utils/auth-helpers.ts):**
```typescript
// Login helper - navigate, fill form, submit, wait for nav
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });
}

// Get session cookie
export async function getSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find(c => c.name === 'bfeai_session');
}

// Verify cookie has correct security flags
export async function verifySessionCookie(page: Page) {
  const sessionCookie = await getSessionCookie(page);
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe('Lax');
}

// Clear all cookies
export async function clearCookies(page: Page) {
  await page.context().clearCookies();
}
```

## Coverage

**Requirements:** Not enforced (no coverage tool configured)

**View Coverage:** Not applicable (E2E only, no coverage metrics)

## Test Types

**Unit Tests:**
- Not used in this codebase
- Complex logic (JWT generation, rate limiting, encryption) tested via E2E

**Integration Tests:**
- Not explicitly separated—E2E tests cover integration
- Tests authenticate with real Supabase
- Tests interact with real databases

**E2E Tests:**
- Framework: Playwright
- Coverage: User workflows (login, signup, password reset, profile management)
- Run against real dev server (`npm run dev`)
- Access real test database via Supabase

## Common Patterns

**Page Navigation and Waiting:**
```typescript
// Navigate to page
await page.goto('/login');

// Wait for URL to change (after form submit)
await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });

// Wait for specific URL
await page.waitForURL('/profile', { timeout: 10000 });

// Wait for element visibility
await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 3000 });
```

**Form Filling:**
```typescript
// Fill input by name attribute
await page.fill('[name="email"]', testUser.email);
await page.fill('[name="password"]', testUser.password);

// Click checkbox by ID
await page.locator('#agreeToTerms').click();

// Submit form
await page.click('button[type="submit"]');
```

**Element Selection:**
```typescript
// By name attribute (form inputs)
page.fill('[name="email"]', value);

// By role (accessibility)
page.getByRole('alert')        // Find by role="alert"
page.getByRole('button', { name: /Sign in/i })

// By test ID (if added)
page.click('[data-testid="logout-button"]');

// By text matching regex
page.locator('text=/Invalid|Error|incorrect/i')
```

**Assertions:**
```typescript
// Element exists and is visible
expect(page.locator('text=/error/i')).toBeVisible({ timeout: 3000 });

// Element contains text (case-insensitive regex)
await expect(page.getByRole('alert').first()).toContainText(/password.*required/i);

// Current URL
await expect(page).toHaveURL('/login');

// Cookie exists and has properties
expect(sessionCookie?.httpOnly).toBe(true);
expect(sessionCookie?.sameSite).toBe('Lax');
```

**Error Testing:**
```typescript
test('validation shows error for empty email', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="password"]', 'SomePassword123');

  // Try to submit with empty email
  await page.click('button[type="submit"]');

  // Check validation error appears
  await expect(page.getByRole('alert').first()).toContainText(/invalid.*email/i, {
    timeout: 3000,
  });
});
```

## Async Testing

All tests use async/await pattern:
```typescript
test('successful login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  // ... more awaited operations
});
```

- Tests are async functions
- Use `await` before page operations
- Timeouts specified: `{ timeout: 10000 }` for navigation, `{ timeout: 3000 }` for visibility

## Test Configuration

**playwright.config.ts:**
```typescript
{
  testDir: './tests/e2e',           // Where test files live
  fullyParallel: true,               // Run tests in parallel
  forbidOnly: !!process.env.CI,      // Fail if .only() test left in CI
  retries: process.env.CI ? 2 : 0,   // Retry twice in CI
  workers: process.env.CI ? 1 : undefined,  // Single worker in CI
  reporter: 'html',                  // Generate HTML report
  timeout: 30 * 1000,                // 30 seconds per test

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',         // Record trace on failures
    screenshot: 'only-on-failure',   // Save screenshots on fail
    video: 'retain-on-failure',      // Save video on fail
    actionTimeout: 10 * 1000,        // 10 seconds for single actions
    navigationTimeout: 10 * 1000,    // 10 seconds for navigation
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',          // Start dev server
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,  // Reuse server in dev
    timeout: 120 * 1000,
  },
}
```

## Test Execution

**Local Development:**
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests
npm run test:e2e:ui  # Or test:e2e:headed to see browser
```

**CI/CD:**
- Tests run with `npm run test`
- Retried 2 times on failure
- Single worker (sequential)
- Artifacts (screenshots, videos, traces) saved on failure

## Skipped Tests

Several tests use `.skip()` for tests that need database state:
```typescript
test.skip('failed login with invalid email', async ({ page }) => {
  // These tests are disabled because they depend on
  // specific user state or external services
});
```

These should be enabled once:
- Test database has required state
- External services (Supabase) are properly configured
- Test isolation is ensured

---

*Testing analysis: 2026-01-29*
