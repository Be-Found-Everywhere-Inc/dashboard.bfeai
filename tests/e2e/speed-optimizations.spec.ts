import { test, expect } from '@playwright/test';

/**
 * Speed Optimization E2E Tests — Settings Page
 *
 * Tests that /api/auth/session and /api/profile are fetched in parallel
 * (via Promise.all) rather than sequentially (waterfall).
 *
 * Uses a fake JWT cookie to pass middleware (which only checks structure + exp,
 * not signature) and route interception for API responses.
 */

const mockSession = {
  user: { id: 'test-user-id', email: 'bill@bfeai.com' },
  profile: { full_name: 'Bill', avatar_url: null },
};

const mockProfile = {
  id: 'test-user-id',
  full_name: 'Bill',
  email: 'bill@bfeai.com',
  company_name: 'BFEAI',
  avatar_url: null,
};

/** Create a fake JWT that passes middleware's structure + expiry check */
function createFakeJWT(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'test-user-id',
      email: 'bill@bfeai.com',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    })
  );
  const signature = btoa('fake-signature');
  return `${header}.${payload}.${signature}`;
}

/** Set the fake auth cookie and mock API responses */
async function setupAuth(page: import('@playwright/test').Page, baseURL: string) {
  // Set the fake JWT cookie so middleware allows access to /settings
  const url = new URL(baseURL);
  await page.context().addCookies([
    {
      name: 'bfeai_session',
      value: createFakeJWT(),
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);

  // Mock API responses so SettingsPage renders without real auth
  await page.route('**/api/auth/session', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSession),
    });
  });

  await page.route('**/api/profile', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProfile),
    });
  });
}

test.describe('Settings Page Speed Optimizations', () => {
  test('session and profile fetched concurrently (within 100ms of each other)', async ({
    page,
    baseURL,
  }) => {
    await setupAuth(page, baseURL!);

    const requestTimestamps: Record<string, number> = {};

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/auth/session')) {
        requestTimestamps['session'] = Date.now();
      }
      if (url.includes('/api/profile')) {
        requestTimestamps['profile'] = Date.now();
      }
    });

    await page.goto('/settings');

    // Wait for both mocked requests to fire
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/session'));
    await page.waitForResponse((resp) => resp.url().includes('/api/profile'));

    expect(requestTimestamps['session']).toBeDefined();
    expect(requestTimestamps['profile']).toBeDefined();

    // Promise.all means both fire within ~100ms; a waterfall would show 200ms+ gap
    const timeDelta = Math.abs(requestTimestamps['session']! - requestTimestamps['profile']!);
    console.log(`Request time delta: ${timeDelta}ms`);
    expect(timeDelta).toBeLessThanOrEqual(100);
  });

  test('no waterfall — total time < 2x slowest individual fetch', async ({ page, baseURL }) => {
    // Set cookie for middleware
    const url = new URL(baseURL!);
    await page.context().addCookies([
      {
        name: 'bfeai_session',
        value: createFakeJWT(),
        domain: url.hostname,
        path: '/',
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'Lax',
      },
    ]);

    // Add realistic latency to mocked responses so timing math is meaningful
    await page.route('**/api/auth/session', async (route) => {
      await new Promise((r) => setTimeout(r, 200));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    });

    await page.route('**/api/profile', async (route) => {
      await new Promise((r) => setTimeout(r, 200));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProfile),
      });
    });

    const responseTimes: Record<string, { start: number; end: number }> = {};

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/auth/session')) {
        responseTimes['session'] = { start: Date.now(), end: 0 };
      }
      if (url.includes('/api/profile')) {
        responseTimes['profile'] = { start: Date.now(), end: 0 };
      }
    });

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/auth/session') && responseTimes['session']) {
        responseTimes['session'].end = Date.now();
      }
      if (url.includes('/api/profile') && responseTimes['profile']) {
        responseTimes['profile'].end = Date.now();
      }
    });

    await page.goto('/settings');

    await page.waitForResponse((resp) => resp.url().includes('/api/auth/session'));
    await page.waitForResponse((resp) => resp.url().includes('/api/profile'));

    const sessionDuration = responseTimes['session'].end - responseTimes['session'].start;
    const profileDuration = responseTimes['profile'].end - responseTimes['profile'].start;
    const slowestFetch = Math.max(sessionDuration, profileDuration);

    const overallStart = Math.min(responseTimes['session'].start, responseTimes['profile'].start);
    const overallEnd = Math.max(responseTimes['session'].end, responseTimes['profile'].end);
    const totalTime = overallEnd - overallStart;

    console.log(`Session: ${sessionDuration}ms, Profile: ${profileDuration}ms`);
    console.log(`Total wall-clock: ${totalTime}ms, Slowest: ${slowestFetch}ms`);

    // Parallel: total ≈ slowest. Waterfall: total ≈ session + profile (2x slowest).
    expect(totalTime).toBeLessThan(slowestFetch * 2);
  });

  test('settings page renders profile data from both endpoints', async ({ page, baseURL }) => {
    await setupAuth(page, baseURL!);

    await page.goto('/settings');

    // Page title appears after data loads
    await expect(page.locator('h1')).toContainText('Settings', { timeout: 15000 });

    // Email field populated (from session endpoint)
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    const emailValue = await emailInput.inputValue();
    expect(emailValue).toContain('@');

    // Full name field populated (from profile endpoint)
    const fullNameInput = page.locator('#fullName');
    await expect(fullNameInput).toBeVisible({ timeout: 10000 });
    const nameValue = await fullNameInput.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
  });

  test('auth redirect works if session is invalid', async ({ page }) => {
    // No cookie set — middleware should redirect to /login
    await page.goto('/settings');

    await page.waitForURL(/\/login/, { timeout: 15000 });
    expect(page.url()).toContain('/login');
  });
});
