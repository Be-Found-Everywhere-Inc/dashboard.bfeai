import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Build a Set-Cookie header string for clearing a cookie.
 *
 * Mirrors the pattern proven to work in `/api/auth/set-sso-cookie/route.ts`,
 * which builds Set-Cookie strings manually and passes them through the
 * INITIAL `HeadersInit` of `new NextResponse(...)`. That is the only cookie-
 * emission path empirically observed to survive Netlify's @netlify/plugin-
 * nextjs runtime — both `headers.append('Set-Cookie', ...)` (after construction)
 * and `response.cookies.set(...)` (the Next.js ResponseCookies abstraction) are
 * silently dropped, leaving the response with no Set-Cookie header at all.
 */
function buildClearCookie(name: string, options: {
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}): string {
  const parts = [`${name}=`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`Path=${options.path ?? '/'}`);
  parts.push('Max-Age=0');
  parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  if (options.httpOnly) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Build the full list of Set-Cookie strings needed to clear all auth state.
 * Returns one string per cookie that must be cleared.
 */
function buildAllClearCookieStrings(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookies: string[] = [];

  // Clear the SSO cookie. Attributes must match how login set it
  // (lib/auth/cookies.ts setSessionCookie) so the browser matches and deletes.
  cookies.push(
    buildClearCookie('bfeai_session', {
      domain: '.bfeai.com',
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Lax',
    })
  );

  // Clear Supabase auth token cookies (and their chunked variants).
  const supabaseProjectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .replace('https://', '')
    .replace('.supabase.co', '');
  if (supabaseProjectRef) {
    const sbCookieBase = `sb-${supabaseProjectRef}-auth-token`;
    const suffixes = ['', '.0', '.1', '.2', '.3', '.4', '-code-verifier'];
    for (const suffix of suffixes) {
      cookies.push(
        buildClearCookie(`${sbCookieBase}${suffix}`, {
          path: '/',
          secure: isProduction,
          sameSite: 'Lax',
        })
      );
    }
  }

  return cookies;
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

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    await supabase.auth.signOut();

    await logSecurityEvent(
      'LOGOUT_SUCCESS',
      'LOW',
      userId,
      request,
      { logout_time: new Date().toISOString() }
    );

    // Build response with Set-Cookie headers in the INITIAL HeadersInit array.
    // This is the only emission path Netlify reliably preserves — see
    // buildClearCookie() doc above. Array form of HeadersInit is spec-compliant
    // for sending multiple Set-Cookie values in one response.
    const headerEntries: [string, string][] = [
      ['Content-Type', 'application/json'],
      ...buildAllClearCookieStrings().map(
        (value): [string, string] => ['Set-Cookie', value]
      ),
    ];

    return new NextResponse(
      JSON.stringify({ success: true, message: 'Logged out successfully' }),
      {
        status: 200,
        headers: headerEntries,
      }
    );
  } catch (error) {
    console.error('[Logout] Error:', error);

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
 * Redirect-based logout. Netlify is documented to strip Set-Cookie from
 * redirect responses, so this path is best-effort. Apps should navigate
 * to dashboard's /logout PAGE instead — that page POSTs to this file's
 * POST handler (above) where Set-Cookie reliably reaches the browser.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    await supabase.auth.signOut();

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

  // Build redirect manually so we control HeadersInit. Same array-of-tuples
  // pattern as POST. Netlify may still strip Set-Cookie on redirects — the
  // POST path is the reliable one.
  const headerEntries: [string, string][] = [
    ['Location', loginUrl.toString()],
    ...buildAllClearCookieStrings().map(
      (value): [string, string] => ['Set-Cookie', value]
    ),
  ];

  return new NextResponse(null, {
    status: 307,
    headers: headerEntries,
  });
}
