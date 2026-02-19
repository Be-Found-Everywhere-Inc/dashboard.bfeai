import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limiter';
import {
  isAccountLocked,
  getLockoutTimeRemaining,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/security/account-lockout';
import { verifyRecaptcha, isRecaptchaEnabled } from '@/lib/security/recaptcha';

const USE_MOCK_AUTH = process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true';

async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  userId: string | null,
  request: NextRequest,
  details?: Record<string, any>
) {
  try {
    const { createClient } = await import('@/lib/supabase/server');
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

export async function POST(request: NextRequest) {
  try {
    // Check rate limit (5 attempts per 15 minutes per IP)
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit('login', clientIp);

    if (!rateLimit.success) {
      // Log rate limit exceeded
      await logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        'MEDIUM',
        null,
        request,
        {
          endpoint: 'login',
          ip: clientIp,
          remaining: rateLimit.remaining,
          reset: rateLimit.reset,
        }
      );

      return NextResponse.json(
        {
          error: 'Too many login attempts',
          message: 'Please try again later',
          retryAfter: Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.getTime().toString(),
          },
        }
      );
    }

    // Parse JSON body
    const body = await request.json();
    const { email, password, rememberMe, recaptchaToken } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Verify reCAPTCHA if enabled
    if (isRecaptchaEnabled()) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, 'login');
      if (!recaptchaResult.success) {
        await logSecurityEvent(
          'RECAPTCHA_FAILED',
          'MEDIUM',
          null,
          request,
          {
            email,
            error: recaptchaResult.error,
            score: recaptchaResult.score,
          }
        );

        return NextResponse.json(
          {
            error: 'reCAPTCHA verification failed',
            message: 'Please try again or refresh the page',
          },
          { status: 400 }
        );
      }
    }

    // Check if account is locked (brute force protection)
    const lockoutKey = `${clientIp}:${email}`;
    if (isAccountLocked(lockoutKey)) {
      const timeRemaining = getLockoutTimeRemaining(lockoutKey);

      await logSecurityEvent(
        'ACCOUNT_LOCKED_ATTEMPT',
        'HIGH',
        null,
        request,
        {
          email,
          ip: clientIp,
          timeRemaining,
        }
      );

      return NextResponse.json(
        {
          error: 'Account temporarily locked',
          message: `Too many failed login attempts. Please try again in ${Math.ceil(timeRemaining / 60)} minutes.`,
          lockedUntil: Date.now() + (timeRemaining * 1000),
        },
        { status: 423 } // 423 Locked
      );
    }

    let userId: string;
    let userEmail: string;
    let role = 'user';

    if (USE_MOCK_AUTH) {
      // Mock authentication for development
      console.log('[MOCK AUTH] Login attempt:', email);

      // Accept any email/password for testing
      userId = 'mock-user-' + Buffer.from(email).toString('base64').substring(0, 8);
      userEmail = email;

      // Log mock login
      await logSecurityEvent(
        'LOGIN_SUCCESS_MOCK',
        'LOW',
        userId,
        request,
        { email, mock: true }
      );
    } else {
      // Real Supabase authentication
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);

        // Record failed attempt and check if account should be locked
        const lockoutResult = recordFailedAttempt(lockoutKey);

        // Log failed login attempt
        await logSecurityEvent(
          'LOGIN_FAILED',
          'MEDIUM',
          null,
          request,
          {
            email,
            reason: error.message,
            attemptsRemaining: lockoutResult.attemptsRemaining,
            isLocked: lockoutResult.isLocked,
          }
        );

        // If account is now locked, return lockout message
        if (lockoutResult.isLocked) {
          return NextResponse.json(
            {
              error: 'Account locked',
              message: `Too many failed attempts. Account is locked for ${Math.ceil((lockoutResult.lockoutTimeRemaining || 0) / 60)} minutes.`,
              lockedUntil: Date.now() + ((lockoutResult.lockoutTimeRemaining || 0) * 1000),
            },
            { status: 423 }
          );
        }

        return NextResponse.json(
          {
            error: 'Invalid email or password',
            attemptsRemaining: lockoutResult.attemptsRemaining,
          },
          { status: 401 }
        );
      }

      if (!data.user || !data.session) {
        await logSecurityEvent(
          'LOGIN_FAILED',
          'MEDIUM',
          null,
          request,
          { email, reason: 'No user or session returned' }
        );

        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        );
      }

      userId = data.user.id;
      userEmail = data.user.email!;

      // Get user role from metadata if available
      role = data.user.user_metadata?.role || 'user';

      // Log successful login
      await logSecurityEvent(
        'LOGIN_SUCCESS',
        'LOW',
        userId,
        request,
        { email: userEmail }
      );
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(lockoutKey);

    // Create JWT token for SSO using centralized service
    const token = JWTService.generateSSOToken(userId, userEmail, role);

    // Set domain-wide cookie for SSO
    const cookieStore = await cookies();
    // For SSO to work properly, default to 7 days. Extended to 30 days with "Remember Me"
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days if remember me, otherwise 7 days

    cookieStore.set('bfeai_session', token, {
      domain: process.env.NODE_ENV === 'production' ? '.bfeai.com' : 'localhost',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    // Return success with user info (frontend handles redirect)
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userEmail,
        role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    // Log internal error
    await logSecurityEvent(
      'LOGIN_ERROR',
      'HIGH',
      null,
      request,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
