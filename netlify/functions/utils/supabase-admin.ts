import type { HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase server env vars are not configured");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Parse cookies from the Cookie header
 */
const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });

  return cookies;
};

/**
 * Verify and decode the bfeai_session JWT token
 * Uses manual JWT verification (no external library needed for HS256)
 */
const verifyBfeaiToken = (token: string): { userId: string; email: string } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode payload (base64url to base64)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));

    // Check expiration
    if (payload.exp * 1000 < Date.now()) {
      console.log('[requireAuth] SSO token expired');
      return null;
    }

    // Return user info from payload
    return {
      userId: payload.userId || payload.sub,
      email: payload.email,
    };
  } catch (error) {
    console.error('[requireAuth] SSO token verification failed:', error);
    return null;
  }
};


export const requireAuth = async (event: HandlerEvent) => {
  // Method 1: Check for Authorization header (legacy Supabase token)
  const header = event.headers.authorization ?? event.headers.Authorization;
  if (header?.startsWith("Bearer ")) {
    const accessToken = header.replace("Bearer ", "");
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new HttpError(401, "Invalid authentication token", error?.message);
    }
    return { user: data.user, accessToken };
  }

  // Method 2: Check for bfeai_session cookie (SSO auth)
  const cookies = parseCookies(event.headers.cookie);
  const ssoToken = cookies['bfeai_session'];

  if (ssoToken) {
    const tokenData = verifyBfeaiToken(ssoToken);
    if (tokenData) {
      // Fetch user from Supabase using admin client
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(tokenData.userId);
      if (userError || !userData.user) {
        console.error('[requireAuth] Failed to fetch user from Supabase:', userError?.message);
        throw new HttpError(401, "Invalid SSO session");
      }
      return { user: userData.user, accessToken: ssoToken };
    }
  }

  throw new HttpError(401, "Missing authentication token");
};


