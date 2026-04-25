import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Clear all auth cookies on a NextResponse.
 *
 * Why this helper exists: the previous implementation used
 *   `new NextResponse(JSON.stringify(...), { headers: {...} })`
 * combined with `response.headers.append('Set-Cookie', ...)`. That pattern
 * silently drops Set-Cookie headers in the Netlify + @netlify/plugin-nextjs
 * pipeline — the response reaches the browser with no Set-Cookie at all,
 * so bfeai_session is never cleared and users stay "logged in" after
 * clicking Log out.
 *
 * NextResponse.cookies.set() goes through Next.js's ResponseCookies layer,
 * which Netlify forwards correctly. Use this helper for every endpoint
 * that needs to clear session state.
 */
function clearAuthCookies(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = '.bfeai.com';

  // Clear the SSO cookie. Attributes must match how login set it
  // (lib/auth/cookies.ts setSessionCookie) so the browser matches and deletes.
  response.cookies.set('bfeai_session', '', {
    domain: cookieDomain,
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });

  // Clear Supabase auth token cookies (and their chunked variants).
  // signOut() above invalidates the server session; this removes the
  // browser-side cookies so they can't be replayed.
  const supabaseProjectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .replace('https://', '')
    .replace('.supabase.co', '');
  if (supabaseProjectRef) {
    const sbCookieBase = `sb-${supabaseProjectRef}-auth-token`;
    const suffixes = ['', '.0', '.1', '.2', '.3', '.4', '-code-verifier'];
    for (const suffix of suffixes) {
      response.cookies.set(`${sbCookieBase}${suffix}`, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
        secure: isProduction,
      });
    }
  }
}

/**
 * Internal helper to log security events
 * (Inline version to avoid circular dependencies)
 */
async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  userId: string | null,
  request: NextRequest,
  details?: Record<string, any>
) {
  try {
    const supabase = await createClient();

    // Get IP address from headers
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    await supabase.from('security_events').insert({
      event_type: eventType,
      severity,
      user_id: userId,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown',
      details,
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't fail the request if logging fails
  }
}

/**
 * POST /api/auth/logout
 *
 * Logs out the current user by:
 * 1. Signing out from Supabase
 * 2. Clearing the JWT SSO cookie (across all *.bfeai.com subdomains)
 * 3. Logging the security event
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user before logging out (for security logging)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Sign out from Supabase (invalidates Supabase session)
    await supabase.auth.signOut();

    // Log successful logout
    await logSecurityEvent(
      'LOGOUT_SUCCESS',
      'LOW',
      userId,
      request,
      { logout_time: new Date().toISOString() }
    );

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    console.error('[Logout] Error:', error);

    // Log logout error
    await logSecurityEvent(
      'LOGOUT_FAILED',
      'MEDIUM',
      null,
      request,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/logout
 *
 * Also support GET requests for logout (for redirect-based logout)
 * Redirects to login page after logout
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user before logging out (for security logging)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    // Sign out from Supabase (invalidates Supabase session)
    await supabase.auth.signOut();

    // Log successful logout
    await logSecurityEvent(
      'LOGOUT_SUCCESS',
      'LOW',
      userId,
      request,
      { logout_time: new Date().toISOString() }
    );
  } catch (error) {
    console.error('[Logout GET] Error during logout:', error);
  }

  // IMPORTANT: Must use NEXT_PUBLIC_APP_URL (dashboard.bfeai.com), NOT accounts.bfeai.com.
  // accounts.bfeai.com is a legacy domain alias. If the user lands on accounts.bfeai.com
  // and then initiates OAuth, the PKCE code verifier cookie is set on accounts.bfeai.com,
  // but the OAuth callback runs on dashboard.bfeai.com — different origin, cookie missing,
  // exchangeCodeForSession fails with "oauth_session_failed".
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.bfeai.com';
  const loginUrl = new URL('/login', appUrl);
  loginUrl.searchParams.set('message', 'logged_out');

  // Note: Netlify may strip Set-Cookie from redirect responses, even when set
  // via NextResponse.cookies. Apps should prefer navigating to /logout (the
  // page) so the POST handler — which always preserves Set-Cookie — runs.
  const response = NextResponse.redirect(loginUrl);
  clearAuthCookies(response);
  return response;
}
