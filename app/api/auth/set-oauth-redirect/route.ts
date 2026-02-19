import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/set-oauth-redirect
 *
 * Sets the oauth_redirect cookie for the OAuth flow.
 * This endpoint is called from the client-side before initiating OAuth.
 *
 * The reason we use this approach instead of setting the cookie on the redirect
 * response in /api/auth/oauth is that Netlify (and other edge platforms) may strip
 * Set-Cookie headers from redirect responses.
 *
 * By using a non-redirect POST request, the cookie is reliably set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { redirect } = body;

    if (!redirect) {
      return NextResponse.json(
        { error: 'Missing redirect parameter' },
        { status: 400 }
      );
    }

    // Validate redirect URL - must be a valid URL or relative path
    if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
      // Absolute URL - validate it's a bfeai.com domain for security
      try {
        const url = new URL(redirect);
        if (!url.hostname.endsWith('.bfeai.com') && url.hostname !== 'localhost') {
          console.warn('[Set OAuth Redirect] Suspicious redirect URL:', redirect);
          // Still allow it but log it - the callback will validate
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid redirect URL' },
          { status: 400 }
        );
      }
    } else if (!redirect.startsWith('/')) {
      // Relative URLs must start with /
      return NextResponse.json(
        { error: 'Invalid redirect path' },
        { status: 400 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = 60 * 10; // 10 minutes - enough time to complete OAuth

    console.log('[Set OAuth Redirect] Setting cookie:', {
      redirect,
      isProduction,
    });

    // Manually construct Set-Cookie header for maximum compatibility
    const cookieParts = [
      `oauth_redirect=${encodeURIComponent(redirect)}`,
      `Path=/`,
      `Max-Age=${maxAge}`,
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (isProduction) {
      cookieParts.push('Secure');
    }
    const setCookieValue = cookieParts.join('; ');

    // Create response with manual Set-Cookie header
    const response = new NextResponse(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': setCookieValue,
        },
      }
    );

    console.log('[Set OAuth Redirect] Cookie set successfully');

    return response;
  } catch (error) {
    console.error('[Set OAuth Redirect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
