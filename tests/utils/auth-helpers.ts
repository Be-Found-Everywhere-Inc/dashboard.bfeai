import { Page, expect } from '@playwright/test';

/**
 * Helper function to log in a user
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 10000 });
}

/**
 * Helper function to log out a user
 */
export async function logout(page: Page) {
  // Click logout button or link
  await page.click('[data-testid="logout-button"]');

  // Wait for redirect to login
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Get the session cookie from the page context
 */
export async function getSessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find(c => c.name === 'bfeai_session');
}

/**
 * Verify that a session cookie exists and has correct security flags
 */
export async function verifySessionCookie(page: Page) {
  const sessionCookie = await getSessionCookie(page);

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.name).toBe('bfeai_session');
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe('Lax');
  expect(sessionCookie?.domain).toBeTruthy();

  return sessionCookie;
}

/**
 * Clear all cookies from the browser context
 */
export async function clearCookies(page: Page) {
  await page.context().clearCookies();
}
