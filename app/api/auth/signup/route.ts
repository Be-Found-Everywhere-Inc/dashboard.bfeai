import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { JWTService } from '@/lib/auth/jwt';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limiter';
import { verifyRecaptcha, isRecaptchaEnabled } from '@/lib/security/recaptcha';

// Signup validation schema
const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  company: z.string().optional(),
  ageConfirmation: z.boolean().refine(val => val === true, {
    message: 'Age confirmation required',
  }),
  recaptchaToken: z.string().optional(),
});

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
    // Check rate limit (3 signups per hour per IP)
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit('signup', clientIp);

    if (!rateLimit.success) {
      await logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        'MEDIUM',
        null,
        request,
        {
          endpoint: 'signup',
          ip: clientIp,
          remaining: rateLimit.remaining,
          reset: rateLimit.reset,
        }
      );

      return NextResponse.json(
        {
          error: 'Too many signup attempts',
          message: 'Please try again later',
          retryAfter: Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.getTime().toString(),
          },
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = signupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { fullName, email, password, company, recaptchaToken } = validation.data;

    // Verify reCAPTCHA if enabled
    if (isRecaptchaEnabled()) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken || '', 'signup');
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

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users.find(u => u.email === email);

    if (userExists) {
      await logSecurityEvent(
        'SIGNUP_FAILED',
        'LOW',
        null,
        request,
        { email, reason: 'Email already registered' }
      );

      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Create user via Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now (can add email verification later)
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error) {
      console.error('Signup error:', error);

      await logSecurityEvent(
        'SIGNUP_FAILED',
        'MEDIUM',
        null,
        request,
        { email, reason: error.message }
      );

      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    if (!data.user) {
      await logSecurityEvent(
        'SIGNUP_FAILED',
        'HIGH',
        null,
        request,
        { email, reason: 'No user data returned' }
      );

      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    const userId = data.user.id;
    const userEmail = data.user.email!;

    // Update profile with company info (if provided)
    // The auto-profile creation trigger will create the basic profile
    if (company) {
      await supabaseAdmin
        .from('profiles')
        .update({ company })
        .eq('id', userId);
    }

    // Log successful signup
    await logSecurityEvent(
      'SIGNUP_SUCCESS',
      'LOW',
      userId,
      request,
      { email: userEmail, has_company: !!company, age_confirmed: true, age_confirmed_at: new Date().toISOString() }
    );

    // Auto-login: Create JWT token and set cookie
    const token = JWTService.generateSSOToken(userId, userEmail, 'user');

    const cookieStore = await cookies();
    cookieStore.set('bfeai_session', token, {
      domain: process.env.NODE_ENV === 'production' ? '.bfeai.com' : 'localhost',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Return success with user info
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userEmail,
        fullName,
        role: 'user',
      },
    });
  } catch (error) {
    console.error('Signup error:', error);

    // Log internal error
    await logSecurityEvent(
      'SIGNUP_ERROR',
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
