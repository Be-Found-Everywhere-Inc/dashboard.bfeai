// Utility functions for authentication

import Cookies from 'js-cookie';

import type { JWTPayload } from './types';

const COOKIE_NAME = 'bfeai_session';
const COOKIE_DOMAIN = '.bfeai.com';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
const PAYMENTS_URL = process.env.NEXT_PUBLIC_PAYMENTS_URL || 'https://payments.bfeai.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'payments';

/**
 * Get the session token from cookies
 */
export function getSessionToken(): string | undefined {
  return Cookies.get(COOKIE_NAME);
}

/**
 * Remove the session cookie (logout)
 */
export function clearSessionToken(): void {
  // Remove from current domain
  Cookies.remove(COOKIE_NAME);

  // Also try to remove from .bfeai.com domain
  Cookies.remove(COOKIE_NAME, { domain: COOKIE_DOMAIN });
}

/**
 * Decode a JWT token without verification (client-side)
 * Note: This is for reading the payload only. Verification happens server-side.
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // Use Buffer.from instead of atob for Edge/SSR runtime compatibility
    // Bundler polyfills Buffer for browser environments
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded) as JWTPayload;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;

  // exp is in seconds, Date.now() is in milliseconds
  return payload.exp * 1000 < Date.now();
}

/**
 * Redirect to login page
 */
export function redirectToLogin(returnUrl?: string): void {
  const currentUrl = returnUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const loginUrl = `${ACCOUNTS_URL}/login?redirect=${encodeURIComponent(currentUrl)}`;

  if (typeof window !== 'undefined') {
    window.location.href = loginUrl;
  }
}

/**
 * Redirect to subscription page
 */
export function redirectToSubscribe(planId?: string): void {
  let subscribeUrl = `${PAYMENTS_URL}/subscribe?app=${APP_NAME}`;
  if (planId) {
    subscribeUrl += `&plan=${planId}`;
  }

  if (typeof window !== 'undefined') {
    window.location.href = subscribeUrl;
  }
}

/**
 * Get the current app name
 */
export function getAppName(): string {
  return APP_NAME;
}

/**
 * Build API URL for payments service
 */
export function getPaymentsApiUrl(path: string): string {
  return `${PAYMENTS_URL}/api${path}`;
}

/**
 * Build API URL for accounts service
 */
export function getAccountsApiUrl(path: string): string {
  return `${ACCOUNTS_URL}/api${path}`;
}

/**
 * Get accounts URL
 */
export function getAccountsUrl(): string {
  return ACCOUNTS_URL;
}
