import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

/**
 * POST /api/auth/refresh
 *
 * Refresh token rotation endpoint.
 * - Verifies the refresh token from the bfeai_refresh cookie
 * - Checks the JTI against the database (rotation tracking)
 * - Issues a new SSO token + new refresh token
 * - Updates the stored JTI (old one becomes invalid)
 * - If an old/reused JTI is detected, invalidates ALL sessions (token theft)
 */

async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  userId: string | null,
  request: NextRequest,
  details?: Record<string, unknown>
) {
  try {
    const adminClient = createAdminClient();
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    await adminClient.from('security_events').insert({
      event_type: eventType,
      severity,
      user_id: userId,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown',
      details,
    });
  } catch (error) {
    console.error('[Refresh] Failed to log security event:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshCookie = cookieStore.get('bfeai_refresh');

    if (!refreshCookie?.value) {
      return NextResponse.json(
        { error: 'No refresh token' },
        { status: 401 }
      );
    }

    // Verify the refresh token
    let payload;
    try {
      payload = JWTService.verifyRefreshTokenBySecret(refreshCookie.value);
    } catch {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const { userId, email, role, sessionId, jti } = payload;
    const adminClient = createAdminClient();

    // Look up the session by session_id
    const { data: session, error: sessionError } = await adminClient
      .from('user_sessions')
      .select('id, refresh_jti, user_id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      // Session not found — token is for a deleted/expired session
      await logSecurityEvent(
        'REFRESH_TOKEN_INVALID_SESSION',
        'MEDIUM',
        userId,
        request,
        { sessionId }
      );

      return NextResponse.json(
        { error: 'Session not found' },
        { status: 401 }
      );
    }

    // Check if the JTI matches the stored one (rotation check)
    if (session.refresh_jti !== jti) {
      // REUSE DETECTED — this means an old refresh token is being used.
      // This is a strong indicator of token theft.
      // Invalidate ALL sessions for this user as a security measure.
      await logSecurityEvent(
        'REFRESH_TOKEN_REUSE_DETECTED',
        'CRITICAL',
        userId,
        request,
        {
          sessionId,
          expectedJti: session.refresh_jti,
          receivedJti: jti,
        }
      );

      // Delete all sessions for this user
      await adminClient
        .from('user_sessions')
        .delete()
        .eq('user_id', userId);

      // Clear cookies
      const domain = process.env.NODE_ENV === 'production' ? '.bfeai.com' : 'localhost';
      cookieStore.set('bfeai_session', '', {
        domain,
        maxAge: 0,
        path: '/',
      });
      cookieStore.set('bfeai_refresh', '', {
        domain,
        maxAge: 0,
        path: '/api/auth',
      });

      return NextResponse.json(
        { error: 'Security violation detected. All sessions have been invalidated. Please log in again.' },
        { status: 401 }
      );
    }

    // JTI matches — issue new tokens
    const newSsoToken = JWTService.generateSSOToken(userId, email, role);
    const { token: newRefreshToken, jti: newJti } =
      JWTService.generateRefreshToken(userId, email, role, sessionId);

    // Update the stored JTI (rotation — old token is now invalid)
    await adminClient
      .from('user_sessions')
      .update({
        refresh_jti: newJti,
        last_active: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    await logSecurityEvent(
      'TOKEN_REFRESHED',
      'LOW',
      userId,
      request,
      { sessionId }
    );

    // Set new cookies
    const domain = process.env.NODE_ENV === 'production' ? '.bfeai.com' : 'localhost';

    cookieStore.set('bfeai_session', newSsoToken, {
      domain,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    cookieStore.set('bfeai_refresh', newRefreshToken, {
      domain,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth',
    });

    return NextResponse.json({
      success: true,
      message: 'Tokens refreshed',
    });
  } catch (error) {
    console.error('[Refresh] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
