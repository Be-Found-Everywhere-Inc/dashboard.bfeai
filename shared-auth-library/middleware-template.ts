// Middleware for route protection
// Co-founders: Copy this file to your project root as middleware.ts
// Then customize PUBLIC_PATHS for your app.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication — customize for your app
const PUBLIC_PATHS = [
  "/",            // Landing/home page (if you have one)
  "/pricing",     // Pricing page (if you have one)
  "/about",       // About page
  "/terms",       // Terms of service
  "/privacy",     // Privacy policy
  "/sso-exchange", // SSO code exchange handler
  "/api/public",  // Public API endpoints
  "/api/health",  // Health check
  "/_next",       // Next.js internals
  "/favicon.ico", // Favicon
];

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ||
  process.env.NEXT_PUBLIC_DASHBOARD_URL ||
  "https://dashboard.bfeai.com";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Get the session cookie
  const token = request.cookies.get("bfeai_session")?.value;

  // No token — redirect to login
  if (!token) {
    const loginUrl = new URL("/login", DASHBOARD_URL);
    loginUrl.searchParams.set("redirect", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token is not expired (basic structural check — Edge Runtime compatible)
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    if (payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL("/login", DASHBOARD_URL);
      loginUrl.searchParams.set("redirect", request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("bfeai_session");
      return response;
    }

    // Token valid — proceed
    // NOTE: Subscription checks are handled by AuthProvider on the client side,
    // NOT in middleware. This avoids cross-domain API calls from Edge Runtime.
    return NextResponse.next();
  } catch (error) {
    console.error("Token verification failed:", error);
    const loginUrl = new URL("/login", DASHBOARD_URL);
    loginUrl.searchParams.set("redirect", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("bfeai_session");
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
