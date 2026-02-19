import { NextRequest, NextResponse } from 'next/server';
import { JWTService } from '@/lib/auth/jwt';

/**
 * POST /api/auth/set-sso-cookie
 *
 * Sets the bfeai_session cookie for SSO across subdomains.
 * This endpoint is called from the client-side after OAuth callback completes.
 *
 * The reason we use this approach instead of setting the cookie on the OAuth
 * callback redirect is that some edge platforms (like Netlify) may strip
 * Set-Cookie headers from redirect responses.
 *
 * By using a non-redirect POST request, the cookie is more reliably set.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    // Verify the token is valid before setting it as a cookie
    try {
      const payload = JWTService.verifySSOToken(token);
      if (!payload) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }

      console.log('[Set SSO Cookie] Token verified for user:', payload.userId);
    } catch (verifyError) {
      console.error('[Set SSO Cookie] Token verification failed:', verifyError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    // Use leading dot for explicit cross-subdomain cookie sharing
    const cookieDomain = '.bfeai.com';
    const maxAge = 7 * 24 * 60 * 60; // 7 days

    console.log('[Set SSO Cookie] Setting cookie:', {
      isProduction,
      cookieDomain,
      tokenLength: token.length,
    });

    // Manually construct Set-Cookie header for maximum compatibility
    const cookieParts = [
      `bfeai_session=${token}`,
      `Domain=${cookieDomain}`,
      `Path=/`,
      `Max-Age=${maxAge}`,
      'HttpOnly',
      'SameSite=Lax',
    ];
    if (isProduction) {
      cookieParts.push('Secure');
    }
    const setCookieValue = cookieParts.join('; ');

    console.log('[Set SSO Cookie] Set-Cookie header:', setCookieValue.substring(0, 100) + '...');

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

    console.log('[Set SSO Cookie] Cookie set successfully via manual header');

    return response;
  } catch (error) {
    console.error('[Set SSO Cookie] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
