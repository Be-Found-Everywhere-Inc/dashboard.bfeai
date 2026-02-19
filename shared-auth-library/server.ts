// Server-side authentication helpers for API routes and server components
// Co-founders: Copy this file to your app's lib/bfeai-auth/server.ts

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { JWTPayload } from "./types";

const COOKIE_NAME = "bfeai_session";

/**
 * Verify a JWT token with signature validation.
 * Returns null if token is invalid, expired, or signature doesn't match.
 */
export function verifyTokenServer(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[Auth] JWT_SECRET not configured - cannot verify tokens");
      return null;
    }

    const payload = jwt.verify(token, secret) as JWTPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn("[Auth] JWT verification failed:", error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      console.warn("[Auth] JWT expired");
    }
    return null;
  }
}

/**
 * Get authenticated user from the bfeai_session cookie.
 * Use this in API routes and server components.
 *
 * Reads the httpOnly cookie server-side (client JS cannot access it),
 * verifies the JWT signature, and returns user info.
 *
 * @example
 * ```typescript
 * import { getAuthenticatedUser } from '@/lib/bfeai-auth/server';
 *
 * export async function GET() {
 *   const user = await getAuthenticatedUser();
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // user.userId and user.email are available
 * }
 * ```
 */
export async function getAuthenticatedUser(): Promise<{
  userId: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = verifyTokenServer(token);
    if (!payload) {
      return null;
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      userId: payload.userId || payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the current request has a valid session.
 * Use this in server components for quick auth checks.
 */
export async function hasValidSession(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user !== null;
}

/**
 * Get the raw session token from cookies.
 * Use this when you need to pass the token to other services.
 */
export async function getSessionTokenServer(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}
