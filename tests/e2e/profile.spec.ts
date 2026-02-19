import { test, expect } from '@playwright/test';
import { login, clearCookies } from '../utils/auth-helpers';
import { getDefaultTestUser } from '../utils/test-data';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await clearCookies(page);
  });

  test('profile page accessible after login', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login first
    await login(page, testUser.email, testUser.password);

    // Navigate to profile
    await page.goto('/profile');

    // Should successfully load profile page
    await expect(page).toHaveURL('/profile');
  });

  test('profile page shows user information', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login first
    await login(page, testUser.email, testUser.password);

    // Navigate to profile
    await page.goto('/profile');

    // Verify profile page heading is visible
    await expect(page.getByRole('heading', { name: 'Account Information' })).toBeVisible({
      timeout: 5000,
    });

    // Should display user email
    await expect(page.locator(`text=${testUser.email}`).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('unauthenticated users redirected to login', async ({ page }) => {
    // Try to access profile without logging in
    await page.goto('/profile');

    // Should redirect to login page
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 });
  });

  test('profile page has logout functionality', async ({ page }) => {
    const testUser = getDefaultTestUser();

    // Login first
    await login(page, testUser.email, testUser.password);

    // Navigate to profile
    await page.goto('/profile');

    // Look for logout button with data-testid
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await expect(logoutButton).toBeVisible({ timeout: 5000 });

    // Click logout button
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('/login', { timeout: 10000 });

    // Verify session cookie is cleared
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'bfeai_session');

    // Cookie should either not exist or be expired/empty
    if (sessionCookie) {
      expect(sessionCookie.value).toBe('');
    }
  });
});
