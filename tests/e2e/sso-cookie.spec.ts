import { test, expect } from '@playwright/test';
import { login, getSessionCookie, clearCookies } from '../utils/auth-helpers';
import { getDefaultTestUser } from '../utils/test-data';

test.describe('SSO Cookie Behavior', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await clearCookies(page);
  });

  test('cookie is set after successful login', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login
    await login(page, testUser.email, testUser.password);

    // Verify cookie exists
    const sessionCookie = await getSessionCookie(page);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.name).toBe('bfeai_session');
  });

  test('cookie has correct security flags', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login
    await login(page, testUser.email, testUser.password);

    // Get cookie
    const sessionCookie = await getSessionCookie(page);

    // Verify security flags
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');

    // Note: In localhost, domain will be 'localhost'
    // In production, it should be '.bfeai.com'
    expect(sessionCookie?.domain).toBeTruthy();

    // Secure flag should be true in production (HTTPS)
    // In localhost (HTTP), it might be false - this is expected
    if (page.url().startsWith('https://')) {
      expect(sessionCookie?.secure).toBe(true);
    }
  });

  test('cookie persists after navigation', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login
    await login(page, testUser.email, testUser.password);

    // Get initial cookie
    const initialCookie = await getSessionCookie(page);
    expect(initialCookie).toBeDefined();

    // Navigate to different page
    await page.goto('/profile');

    // Cookie should still exist
    const afterNavCookie = await getSessionCookie(page);
    expect(afterNavCookie).toBeDefined();
    expect(afterNavCookie?.value).toBe(initialCookie?.value);
  });

  test('cookie is cleared after logout', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login
    await login(page, testUser.email, testUser.password);

    // Verify cookie exists
    let sessionCookie = await getSessionCookie(page);
    expect(sessionCookie).toBeDefined();

    // Navigate to profile page to access logout button
    await page.goto('/profile');

    // Click logout button
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    await logoutButton.click();

    // Wait for redirect to login
    await page.waitForURL('/login', { timeout: 5000 });

    // Cookie should be cleared or expired
    sessionCookie = await getSessionCookie(page);

    // Cookie should either not exist or be cleared (empty value)
    if (sessionCookie) {
      expect(sessionCookie.value).toBe('');
    }
  });

  test('cookie has expiration set', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login
    await login(page, testUser.email, testUser.password);

    // Get cookie
    const sessionCookie = await getSessionCookie(page);

    // Cookie should have an expiration date
    expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);

    // Expiration should be within reasonable range (7 days as per plan)
    const sevenDaysFromNow = (Date.now() / 1000) + (7 * 24 * 60 * 60);
    const eightDaysFromNow = (Date.now() / 1000) + (8 * 24 * 60 * 60);

    expect(sessionCookie?.expires).toBeLessThan(eightDaysFromNow);
    expect(sessionCookie?.expires).toBeGreaterThan((Date.now() / 1000) + (6 * 24 * 60 * 60));
  });
});
