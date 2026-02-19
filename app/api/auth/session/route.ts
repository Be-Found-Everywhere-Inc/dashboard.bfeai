import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';

/**
 * GET /api/auth/session
 *
 * Verify if the user has a valid session and return user data.
 * This endpoint is used by:
 * 1. This app to check authentication status
 * 2. Other apps in the BFEAI ecosystem to verify SSO authentication
 *
 * Returns 200 with user data if authenticated, 401 if not authenticated
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'No session cookie found'
        },
        { status: 401 }
      );
    }

    // Verify JWT token
    try {
      const payload = JWTService.verifySSOToken(sessionCookie.value);

      // Check if token is expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return NextResponse.json(
          {
            authenticated: false,
            error: 'Session expired'
          },
          { status: 401 }
        );
      }

      // Optionally fetch fresh user data from database
      // For now, return data from JWT payload
      const userData = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role || 'user',
      };

      // If you want to fetch fresh data from Supabase:
      // const { createClient } = await import('@/lib/supabase/server');
      // const supabase = await createClient();
      // const { data: profile } = await supabase
      //   .from('profiles')
      //   .select('*')
      //   .eq('id', payload.userId)
      //   .single();

      return NextResponse.json({
        authenticated: true,
        user: userData,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      });
    } catch (error) {
      console.error('JWT verification failed:', error);

      return NextResponse.json(
        {
          authenticated: false,
          error: 'Invalid session token'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Session verification error:', error);

    return NextResponse.json(
      {
        authenticated: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/session
 *
 * Alternative endpoint that accepts JWT token in request body
 * Useful for cross-domain verification where cookies might not be accessible
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'No token provided'
        },
        { status: 400 }
      );
    }

    // Verify JWT token
    try {
      const payload = JWTService.verifySSOToken(token);

      // Check if token is expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return NextResponse.json(
          {
            authenticated: false,
            error: 'Token expired'
          },
          { status: 401 }
        );
      }

      const userData = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role || 'user',
      };

      return NextResponse.json({
        authenticated: true,
        user: userData,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      });
    } catch (error) {
      console.error('JWT verification failed:', error);

      return NextResponse.json(
        {
          authenticated: false,
          error: 'Invalid token'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Session verification error:', error);

    return NextResponse.json(
      {
        authenticated: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
