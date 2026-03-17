import { test, expect } from '@playwright/test';
import { login, clearCookies } from '../utils/auth-helpers';
import { getDefaultTestUser } from '../utils/test-data';

test.describe('Settings Page Speed Optimizations', () => {
  test.beforeEach(async ({ page }) => {
    const testUser = getDefaultTestUser();
    await login(page, testUser.email, testUser.password);
  });

  test('session and profile fetched concurrently', async ({ page }) => {
    const requestTimestamps: Record<string, number> = {};

    // Track when each request starts
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

    // Wait for both requests to have been captured
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/session'));
    await page.waitForResponse((resp) => resp.url().includes('/api/profile'));

    // Both timestamps should exist
    expect(requestTimestamps['session']).toBeDefined();
    expect(requestTimestamps['profile']).toBeDefined();

    // Parallel fetches via Promise.all should start within 100ms of each other
    const timeDelta = Math.abs(requestTimestamps['session'] - requestTimestamps['profile']);
    expect(timeDelta).toBeLessThanOrEqual(100);
  });

  test('settings page loads successfully with user profile data', async ({ page }) => {
    await page.goto('/settings');

    // Wait for loading to finish — the page title appears after data loads
    await expect(page.locator('h1')).toContainText('Settings', { timeout: 10000 });

    // Verify the email field is populated (comes from session data)
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    const emailValue = await emailInput.inputValue();
    expect(emailValue).toContain('@');

    // Verify the full name field is populated (comes from profile data)
    const fullNameInput = page.locator('#fullName');
    await expect(fullNameInput).toBeVisible();
  });

  test('no waterfall between session and profile requests', async ({ page }) => {
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

    // Wait for both responses
    await page.waitForResponse((resp) => resp.url().includes('/api/auth/session'));
    await page.waitForResponse((resp) => resp.url().includes('/api/profile'));

    const sessionDuration = responseTimes['session'].end - responseTimes['session'].start;
    const profileDuration = responseTimes['profile'].end - responseTimes['profile'].start;
    const slowestFetch = Math.max(sessionDuration, profileDuration);

    // Total wall-clock time from first request start to last response end
    const overallStart = Math.min(responseTimes['session'].start, responseTimes['profile'].start);
    const overallEnd = Math.max(responseTimes['session'].end, responseTimes['profile'].end);
    const totalTime = overallEnd - overallStart;

    // With parallel fetches, total time should be less than 2x the slowest individual fetch.
    // A waterfall would take ~sessionDuration + profileDuration (roughly 2x slowest).
    expect(totalTime).toBeLessThan(slowestFetch * 2);
  });

  test('auth redirect works if session is invalid', async ({ page }) => {
    // Intercept /api/auth/session to return 401
    await page.route('**/api/auth/session', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/settings');

    // The component checks sessionResponse.ok and calls router.push('/login')
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
