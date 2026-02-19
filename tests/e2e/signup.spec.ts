import { test, expect } from '@playwright/test';
import { clearCookies, getSessionCookie } from '../utils/auth-helpers';
import { generateTestUser } from '../utils/test-data';

test.describe('Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await clearCookies(page);
  });

  test('successful signup with valid data', async ({ page }) => {
    const testUser = generateTestUser();

    await page.goto('/signup');

    // Fill form
    await page.fill('[name="fullName"]', testUser.fullName);
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.fill('[name="confirmPassword"]', testUser.password);

    // Click the checkbox label (shadcn Checkbox component)
    await page.locator('#agreeToTerms').click();

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect after successful signup (auto-login)
    await page.waitForURL((url) => url.pathname !== '/signup', { timeout: 10000 });

    // Verify session cookie is set (auto-login)
    const sessionCookie = await getSessionCookie(page);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
  });

  test('shows error for duplicate email', async ({ page }) => {
    // Use the default test user (which should exist from global setup)
    const testUser = {
      email: 'test@example.com',
      password: 'NewPassword123!',
      fullName: 'Test User',
    };

    await page.goto('/signup');

    await page.fill('[name="fullName"]', testUser.fullName);
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.fill('[name="confirmPassword"]', testUser.password);
    await page.locator('#agreeToTerms').click();

    await page.click('button[type="submit"]');

    // Should show error toast about existing email - wait for toast
    await expect(page.locator('text=/already exists/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('validation shows error for password mismatch', async ({ page }) => {
    const testUser = generateTestUser();

    await page.goto('/signup');

    await page.fill('[name="fullName"]', testUser.fullName);
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.fill('[name="confirmPassword"]', 'DifferentPassword123!');
    await page.locator('#agreeToTerms').click();

    // Submit to trigger validation
    await page.click('button[type="submit"]');

    // Should show password mismatch error - "Passwords don't match"
    await expect(page.getByRole('alert').first()).toContainText(/password.*don't match/i, {
      timeout: 3000,
    });
  });

  test('validation shows error for weak password', async ({ page }) => {
    const testUser = generateTestUser();

    await page.goto('/signup');

    await page.fill('[name="fullName"]', testUser.fullName);
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', 'weak');
    await page.fill('[name="confirmPassword"]', 'weak');

    // Submit to trigger validation
    await page.click('button[type="submit"]');

    // Should show password requirements error
    await expect(page.locator('text=/at least 8 characters|uppercase|lowercase|number/i')).toBeVisible({
      timeout: 3000,
    });
  });

  test('validation shows error for empty full name', async ({ page }) => {
    const testUser = generateTestUser();

    await page.goto('/signup');

    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.fill('[name="confirmPassword"]', testUser.password);
    await page.locator('#agreeToTerms').click();

    // Submit without full name
    await page.click('button[type="submit"]');

    // Should show validation error - "Full name must be at least 2 characters"
    await expect(page.getByRole('alert').first()).toContainText(/full name.*at least 2/i, {
      timeout: 3000,
    });
  });

  test('validation shows error for unchecked terms', async ({ page }) => {
    const testUser = generateTestUser();

    await page.goto('/signup');

    await page.fill('[name="fullName"]', testUser.fullName);
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.fill('[name="confirmPassword"]', testUser.password);

    // Don't check terms and conditions, just submit
    await page.click('button[type="submit"]');

    // Should show validation error - "You must agree to the terms and conditions"
    await expect(page.getByRole('alert').first()).toContainText(/must agree.*terms/i, {
      timeout: 3000,
    });
  });

  test('password strength indicator works', async ({ page }) => {
    await page.goto('/signup');

    // Type a weak password
    await page.fill('[name="password"]', 'weak');
    await expect(page.locator('text=/weak/i')).toBeVisible();

    // Type a stronger password
    await page.fill('[name="password"]', 'StrongPass123!');
    await expect(page.locator('text=/strong|good/i')).toBeVisible();
  });

  test('company field is optional', async ({ page }) => {
    const testUser = generateTestUser();

    await page.goto('/signup');

    // Fill required fields only
    await page.fill('[name="fullName"]', testUser.fullName);
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.fill('[name="confirmPassword"]', testUser.password);
    await page.locator('#agreeToTerms').click();

    // Submit without company
    await page.click('button[type="submit"]');

    // Should still succeed
    await page.waitForURL((url) => url.pathname !== '/signup', { timeout: 10000 });
  });
});
