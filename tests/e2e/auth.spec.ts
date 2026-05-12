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

    // Fill form
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);

    // Submit
    await page.click('button[type="submit"]');

    // Verify redirect to profile or dashboard
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });

    // Verify session cookie set
    await verifySessionCookie(page);
  });

  test.skip('failed login with invalid email', async ({ page }) => {
    const invalidCreds = getInvalidCredentials();

    await page.goto('/login');

    await page.fill('[name="email"]', invalidCreds.wrongEmail);
    await page.fill('[name="password"]', 'SomePassword123');
    await page.click('button[type="submit"]');

    // Should stay on login page
    await expect(page).toHaveURL('/login');

    // Should show error message (toast)
    await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: /Invalid|Error|incorrect/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test.skip('failed login with invalid password', async ({ page }) => {
    const testUser = getDefaultTestUser();
    const invalidCreds = getInvalidCredentials();

    await page.goto('/login');

    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', invalidCreds.wrongPassword);
    await page.click('button[type="submit"]');

    // Should stay on login page
    await expect(page).toHaveURL('/login');

    // Should show error message (toast)
    await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: /Invalid|Error|incorrect/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test('login with redirect parameter', async ({ page }) => {
    const testUser = getDefaultTestUser();

    await page.goto('/login?redirect=/profile');

    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should redirect to specified URL
    await page.waitForURL('/profile', { timeout: 10000 });
  });

  test('session persists across page reloads', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login first
    await login(page, testUser.email, testUser.password);

    // Get initial cookie
    const initialCookie = await getSessionCookie(page);
    expect(initialCookie).toBeDefined();

    // Reload page
    await page.reload();

    // Cookie should still exist
    const reloadedCookie = await getSessionCookie(page);
    expect(reloadedCookie).toBeDefined();
    expect(reloadedCookie?.value).toBe(initialCookie?.value);
  });

  test('validation shows error for empty email', async ({ page }) => {
    await page.goto('/login');

    // Try to submit with empty email
    await page.fill('[name="password"]', 'SomePassword123');
    await page.click('button[type="submit"]');

    // Should show validation error - empty email triggers "Invalid email address"
    await expect(page.getByRole('alert').first()).toContainText(/invalid.*email/i, {
      timeout: 3000,
    });
  });

  test('validation shows error for empty password', async ({ page }) => {
    await page.goto('/login');

    // Try to submit with empty password
    await page.fill('[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Should show validation error - "Password is required"
    await expect(page.getByRole('alert').first()).toContainText(/password.*required/i, {
      timeout: 3000,
    });
  });

  test('validation shows error for invalid email format', async ({ page }) => {
    const invalidCreds = getInvalidCredentials();

    await page.goto('/login');

    await page.fill('[name="email"]', invalidCreds.invalidEmail);
    await page.fill('[name="password"]', 'SomePassword123');

    // Submit to trigger validation
    await page.click('button[type="submit"]');

    // Should show email format validation error - "Invalid email address"
    await expect(page.getByRole('alert').first()).toContainText(/invalid.*email/i, {
      timeout: 3000,
    });
  });

  // Regression: GET /api/auth/session must return user.name from the profile
  // row so the dashboard hero greeting ("Good morning, <First>") can render.
  // The JWT payload only carries {userId, email, role} — name is sourced from
  // public.profiles.full_name. See app/api/auth/session/route.ts (GET handler).
  //
  // NOTE: This test depends on the seeded user identified by getDefaultTestUser()
  // having `profiles.full_name = 'Test User'`. The seed script
  // (scripts/create-test-user.mjs) creates the auth user with
  // user_metadata.full_name = 'Test User', and the `handle_new_user` trigger
  // (see docs/04-Architecture/schema.sql) copies that into profiles.full_name.
  // If the seed or trigger changes, update the expected value below.
  test('GET /api/auth/session returns user.name from profile', async ({ page, request }) => {
    const testUser = getDefaultTestUser();

    // Log in via the same flow as the other tests so cookies match production
    await login(page, testUser.email, testUser.password);

    // Pull session via API using the cookies the browser just got
    const sessionCookie = await getSessionCookie(page);
    expect(sessionCookie?.value).toBeTruthy();

    const res = await request.get('/api/auth/session', {
      headers: { Cookie: `bfeai_session=${sessionCookie!.value}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.name).toBe('Test User');
  });

  // Regression: dashboard hero hydrates the greeting with the first name from
  // /api/auth/session. If user.name is null/missing, only "Good morning" (no
  // comma + first name) is rendered — which is what we are fixing.
  test('Dashboard hero greets user by first name', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Set up the session-response wait BEFORE login so we don't miss it
    const sessionResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/auth/session') && r.ok(),
      { timeout: 10000 }
    );

    await login(page, testUser.email, testUser.password);
    await page.waitForURL('/', { timeout: 10000 });
    await sessionResponsePromise;

    const heading = page.locator('h1.page-title').first();
    await expect(heading).toContainText(/Good (morning|afternoon|evening), \w+/);
  });
});
