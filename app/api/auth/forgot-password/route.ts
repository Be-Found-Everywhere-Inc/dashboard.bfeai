import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// Upstash rate limiter removed for password reset — Supabase Auth
// already rate-limits /recover more aggressively (per-user email limits)

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Send password reset email via Supabase Auth
    // Supabase will send an email with a reset link
    // The link will contain an access_token that can be used to reset the password
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      console.error('Forgot password error:', error);

      // Log the attempt but don't reveal if email exists
      await logSecurityEvent(
        'PASSWORD_RESET_REQUEST_FAILED',
        'LOW',
        null,
        request,
        { email, reason: error.message }
      );

      // Surface rate limit errors (not an enumeration risk)
      if (error.status === 429 || error.message?.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a few minutes before trying again.' },
          { status: 429 }
        );
      }

      // For other errors, always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Log successful password reset request
    await logSecurityEvent(
      'PASSWORD_RESET_REQUEST',
      'LOW',
      null,
      request,
      { email }
    );

    // Always return success for security (prevent email enumeration)
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);

    await logSecurityEvent(
      'PASSWORD_RESET_ERROR',
      'MEDIUM',
      null,
      request,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );

    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
