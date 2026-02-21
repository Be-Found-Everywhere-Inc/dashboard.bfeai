// Server-side authentication helpers for API routes and server components

import { cookies } from 'next/headers';

import type { JWTPayload } from './types';

const COOKIE_NAME = 'bfeai_session';

/**
 * Decode a JWT token without verification (for Edge/Server runtime)
 * Note: This is for reading the payload only. Full verification would require JWT_SECRET.
 */
export function decodeTokenServer(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // Use Buffer.from instead of atob for Edge/Node runtime compatibility
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(decoded) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Get authenticated user from the bfeai_session cookie
 * Use this in API routes and server components
 *
 * @example
 * ```typescript
 * // In an API route
 * const user = await getAuthenticatedUser();
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * // user.userId and user.email are available
 * ```
 */
export async function getAuthenticatedUser(): Promise<{ userId: string; email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = decodeTokenServer(token);
    if (!payload) {
      return null;
    }

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the current request has a valid session
 * Use this in server components for quick auth checks
 */
export async function hasValidSession(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user !== null;
}

/**
 * Get the raw session token from cookies
 * Use this when you need to pass the token to other services
 */
export async function getSessionTokenServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}
