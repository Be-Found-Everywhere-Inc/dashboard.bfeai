import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

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

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieDomain = '.bfeai.com';

    // Method 1: Use Next.js cookies API (same method as login route sets the cookie)
    // This is more reliable and consistent with how the cookie was originally set
    const cookieStore = await cookies();

    // Delete the cookie using the same domain it was set with
    cookieStore.set('bfeai_session', '', {
      domain: cookieDomain,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 0,  // Immediately expire
      path: '/',
    });

    console.log('[Logout] Cleared cookie via Next.js cookies API');

    // Method 2: Also add manual Set-Cookie header as backup
    // Use BOTH Max-Age=0 AND Expires for maximum browser compatibility
    const expireDate = 'Thu, 01 Jan 1970 00:00:00 GMT';

    const cookieParts = [
      'bfeai_session=',
      `Domain=${cookieDomain}`,
      'Path=/',
      'Max-Age=0',
      `Expires=${expireDate}`,
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (isProduction) {
      cookieParts.push('Secure');
    }
    const setCookieValue = cookieParts.join('; ');

    console.log('[Logout] Also adding manual Set-Cookie header:', setCookieValue);

    // Create response
    const response = new NextResponse(
      JSON.stringify({ success: true, message: 'Logged out successfully' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Append manual header as additional backup
    response.headers.append('Set-Cookie', setCookieValue);

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

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieDomain = '.bfeai.com';

  // Method 1: Use Next.js cookies API (same method as login route sets the cookie)
  const cookieStore = await cookies();
  cookieStore.set('bfeai_session', '', {
    domain: cookieDomain,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  console.log('[Logout GET] Cleared cookie via Next.js cookies API');

  // Method 2: Also add manual Set-Cookie header as backup
  const expireDate = 'Thu, 01 Jan 1970 00:00:00 GMT';

  const cookieParts = [
    'bfeai_session=',
    `Domain=${cookieDomain}`,
    'Path=/',
    'Max-Age=0',
    `Expires=${expireDate}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProduction) {
    cookieParts.push('Secure');
  }
  const setCookieValue = cookieParts.join('; ');

  console.log('[Logout GET] Also adding manual Set-Cookie header:', setCookieValue);

  // Redirect to login page with message
  const loginUrl = new URL('/login', 'https://accounts.bfeai.com');
  loginUrl.searchParams.set('message', 'logged_out');

  // Create redirect response
  // Note: Some edge platforms (Netlify) may strip Set-Cookie from redirects
  // The POST handler is preferred for reliable cookie clearing
  const response = NextResponse.redirect(loginUrl);
  response.headers.append('Set-Cookie', setCookieValue);

  return response;
}
