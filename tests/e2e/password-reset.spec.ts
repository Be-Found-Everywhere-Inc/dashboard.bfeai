import { test, expect } from '@playwright/test';
import { clearCookies } from '../utils/auth-helpers';
import { getDefaultTestUser } from '../utils/test-data';

test.describe('Password Reset Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await clearCookies(page);
  });

  test('forgot password page loads correctly', async ({ page }) => {
    await page.goto('/forgot-password');

    // Should show email input
    await expect(page.locator('[name="email"]')).toBeVisible();

    // Should show submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('forgot password shows success message', async ({ page }) => {
    const testUser = getDefaultTestUser();

    await page.goto('/forgot-password');

    // Fill email
    await page.fill('[name="email"]', testUser.email);

    // Submit
    await page.click('button[type="submit"]');

    // Should show success message - "Check your email"
    await expect(page.getByText(/check.*email/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('forgot password validates email format', async ({ page }) => {
    await page.goto('/forgot-password');

    // Enter invalid email
    await page.fill('[name="email"]', 'notanemail');

    // Submit
    await page.click('button[type="submit"]');

    // Should show validation error - "Invalid email address"
    await expect(page.getByRole('alert').first()).toContainText(/invalid.*email/i, {
      timeout: 3000,
    });
  });

  test('forgot password requires email', async ({ page }) => {
    await page.goto('/forgot-password');

    // Submit without email
    await page.click('button[type="submit"]');

    // Should show validation error - empty email shows "Invalid email address"
    await expect(page.getByRole('alert').first()).toContainText(/invalid.*email/i, {
      timeout: 3000,
    });
  });

  test('reset password page shows invalid link for missing token', async ({ page }) => {
    // Go to reset password without token
    await page.goto('/reset-password');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Should show "Invalid Link" heading
    await expect(page.getByText(/invalid.*link/i)).toBeVisible({
      timeout: 5000,
    });

    // Should show button to request new link
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
  });

  test('reset password validates password requirements', async ({ page }) => {
    // Go to reset password with a mock token
    await page.goto('/reset-password?access_token=mock-token-for-testing');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Fill weak password
    await page.fill('[name="password"]', 'weak');
    await page.fill('[name="confirmPassword"]', 'weak');

    // Submit
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=/at least 8 characters|uppercase|lowercase|number/i')).toBeVisible({
      timeout: 3000,
    });
  });

  test('reset password validates password confirmation', async ({ page }) => {
    // Go to reset password with a mock token
    await page.goto('/reset-password?access_token=mock-token-for-testing');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Fill passwords that don't match
    await page.fill('[name="password"]', 'StrongPass123!');
    await page.fill('[name="confirmPassword"]', 'DifferentPass123!');

    // Submit to trigger validation
    await page.click('button[type="submit"]');

    // Should show validation error - "Passwords don't match"
    await expect(page.getByRole('alert').first()).toContainText(/password.*don't match/i, {
      timeout: 3000,
    });
  });

  test('reset password shows password strength indicator', async ({ page }) => {
    // Go to reset password with a mock token
    await page.goto('/reset-password?access_token=mock-token-for-testing');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Type a weak password
    await page.fill('[name="password"]', 'weak');
    await expect(page.locator('text=/weak/i')).toBeVisible();

    // Type a stronger password
    await page.fill('[name="password"]', 'StrongPass123!');
    await expect(page.locator('text=/strong|good/i')).toBeVisible();
  });

  test('reset password page has back to login link', async ({ page }) => {
    // Go to reset password with a mock token
    await page.goto('/reset-password?access_token=mock-token-for-testing');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should have link back to login
    const backLink = page.locator('a[href="/login"]');
    await expect(backLink).toBeVisible();

    // Click should navigate to login
    await backLink.click();
    await expect(page).toHaveURL('/login');
  });
});
