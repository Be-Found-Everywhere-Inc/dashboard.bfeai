import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  token: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
}).refine(data => data.token || data.code, {
  message: 'Either token or code is required',
  path: ['token'],
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
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { token, code, password } = validation.data;

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    let userId: string | null = null;

    if (code) {
      // PKCE flow: exchange the code for a session, then update password
      const { data: sessionData, error: codeError } = await supabase.auth.exchangeCodeForSession(code);

      if (codeError || !sessionData.user) {
        console.error('Code exchange error:', codeError);

        await logSecurityEvent(
          'PASSWORD_RESET_FAILED',
          'MEDIUM',
          null,
          request,
          { reason: 'Invalid or expired code' }
        );

        return NextResponse.json(
          { error: 'Invalid or expired reset link' },
          { status: 401 }
        );
      }

      userId = sessionData.user.id;
    } else if (token) {
      // Legacy implicit flow: set session with access_token
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: token,
      });

      if (sessionError || !sessionData.user) {
        console.error('Session error:', sessionError);

        await logSecurityEvent(
          'PASSWORD_RESET_FAILED',
          'MEDIUM',
          null,
          request,
          { reason: 'Invalid or expired token' }
        );

        return NextResponse.json(
          { error: 'Invalid or expired reset token' },
          { status: 401 }
        );
      }

      userId = sessionData.user.id;
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error('Password update error:', updateError);

      await logSecurityEvent(
        'PASSWORD_RESET_FAILED',
        'MEDIUM',
        userId,
        request,
        { reason: updateError.message }
      );

      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Log successful password reset
    await logSecurityEvent(
      'PASSWORD_RESET_SUCCESS',
      'LOW',
      userId,
      request,
      {}
    );

    // Sign out the user (they'll need to log in with new password)
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);

    await logSecurityEvent(
      'PASSWORD_RESET_ERROR',
      'HIGH',
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
