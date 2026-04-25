import type { HandlerResponse } from "@netlify/functions";
import { withErrorHandling } from "./utils/http";
import { supabaseAdmin } from "./utils/supabase-admin";

/**
 * POST or GET /.netlify/functions/auth-logout
 *
 * Clears bfeai_session + Supabase auth cookies and returns either a JSON
 * success response (POST) or a 307 redirect to the login page (GET).
 *
 * This lives as a raw Netlify Function rather than a Next.js Route
 * Handler because @netlify/plugin-nextjs strips Set-Cookie headers from
 * Next.js Route Handler responses (verified empirically: three different
 * response-construction patterns in app/api/auth/logout/route.ts all
 * returned with zero Set-Cookie headers in production). Raw Netlify
 * Functions emit Set-Cookie reliably — the same path stripe-webhook and
 * every other working cookie-emitting endpoint in this repo uses.
 */

const buildClearCookie = (
  name: string,
  options: {
    domain?: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
  }
): string => {
  const parts = [`${name}=`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`Path=${options.path ?? "/"}`);
  parts.push("Max-Age=0");
  parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  if (options.httpOnly) parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
};

const buildAllClearCookies = (): string[] => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookies: string[] = [];

  // bfeai_session — domain cookie shared across all *.bfeai.com subdomains.
  // Attributes must match how login set it (lib/auth/cookies.ts).
  cookies.push(
    buildClearCookie("bfeai_session", {
      domain: ".bfeai.com",
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: "Lax",
    })
  );

  // Supabase auth-token cookies (and chunked variants). Host-only cookies
  // on dashboard.bfeai.com — no Domain attribute.
  const supabaseProjectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace("https://", "")
    .replace(".supabase.co", "");
  if (supabaseProjectRef) {
    const sbBase = `sb-${supabaseProjectRef}-auth-token`;
    for (const suffix of ["", ".0", ".1", ".2", ".3", ".4", "-code-verifier"]) {
      cookies.push(
        buildClearCookie(`${sbBase}${suffix}`, {
          path: "/",
          secure: isProduction,
          sameSite: "Lax",
        })
      );
    }
  }

  return cookies;
};

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) cookies[name] = rest.join("=");
  });
  return cookies;
};

const decodeUserIdFromBfeaiSession = (token: string | undefined): string | null => {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    return payload.userId || payload.sub || null;
  } catch {
    return null;
  }
};

const logLogoutEvent = async (
  headers: Record<string, string | undefined>,
  userId: string | null
): Promise<void> => {
  try {
    const ip =
      headers["x-forwarded-for"] ||
      headers["x-real-ip"] ||
      "unknown";
    await supabaseAdmin.from("security_events").insert({
      event_type: "LOGOUT_SUCCESS",
      severity: "LOW",
      user_id: userId,
      ip_address: ip,
      user_agent: headers["user-agent"] || "unknown",
      details: { logout_time: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[auth-logout] Failed to log security event:", error);
    // Never fail logout because of logging.
  }
};

export const handler = withErrorHandling(async (event): Promise<HandlerResponse> => {
  const cookies = parseCookies(event.headers.cookie);
  const userId = decodeUserIdFromBfeaiSession(cookies["bfeai_session"]);

  // Best-effort security log — fire and forget so a slow Supabase insert
  // never delays the cookie-clearing response.
  void logLogoutEvent(event.headers, userId);

  const setCookieValues = buildAllClearCookies();

  if (event.httpMethod === "GET") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.bfeai.com";
    const loginUrl = new URL("/login", appUrl);
    loginUrl.searchParams.set("message", "logged_out");
    return {
      statusCode: 307,
      headers: {
        Location: loginUrl.toString(),
        "Cache-Control": "no-store",
      },
      multiValueHeaders: {
        "Set-Cookie": setCookieValues,
      },
      body: "",
    };
  }

  // POST (and any other method). All apps' /logout page POSTs here.
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    multiValueHeaders: {
      "Set-Cookie": setCookieValues,
    },
    body: JSON.stringify({ success: true, message: "Logged out successfully" }),
  };
});
