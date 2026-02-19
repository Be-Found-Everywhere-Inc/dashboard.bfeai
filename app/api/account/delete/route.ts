import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import Stripe from 'stripe';

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.string().refine(val => val === 'DELETE', {
    message: 'Confirmation must be DELETE',
  }),
});

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
    console.error('Failed to log security event:', error);
  }
}

/**
 * Cancel all active Stripe subscriptions for a user.
 * Best-effort: logs failures but does not throw.
 */
async function cancelStripeSubscriptions(userId: string): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[Delete] STRIPE_SECRET_KEY not set — skipping Stripe cancellation');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const adminClient = createAdminClient();

  const { data: subscriptions } = await adminClient
    .from('app_subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due']);

  if (!subscriptions?.length) return;

  const results = await Promise.allSettled(
    subscriptions
      .filter(s => s.stripe_subscription_id)
      .map(s =>
        stripe.subscriptions.cancel(s.stripe_subscription_id!)
      )
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Delete] Failed to cancel Stripe subscription:', result.reason);
    }
  }
}

/**
 * Delete all user files from Supabase Storage buckets.
 * Best-effort: logs failures but does not throw.
 */
async function deleteStorageFiles(userId: string): Promise<void> {
  const adminClient = createAdminClient();
  const buckets = ['avatars', 'bug-screenshots', 'agency-logos'];

  const results = await Promise.allSettled(
    buckets.map(async (bucket) => {
      const { data: files } = await adminClient.storage
        .from(bucket)
        .list(userId);

      if (!files?.length) return;

      const filePaths = files.map(f => `${userId}/${f.name}`);
      const { error } = await adminClient.storage
        .from(bucket)
        .remove(filePaths);

      if (error) {
        throw new Error(`Failed to delete from ${bucket}: ${error.message}`);
      }
    })
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Delete] Storage cleanup error:', result.reason);
    }
  }
}

/**
 * Anonymize audit trail records (security_events, api_costs).
 * Sets user_id and PII columns to NULL so records are retained for analytics
 * but cannot be linked back to the deleted user.
 */
async function anonymizeAuditRecords(userId: string): Promise<void> {
  const adminClient = createAdminClient();

  const results = await Promise.allSettled([
    // Anonymize security_events: null out user_id, ip_address, user_agent
    adminClient
      .from('security_events')
      .update({
        user_id: null,
        ip_address: null,
        user_agent: null,
        anonymized_at: new Date().toISOString(),
      })
      .eq('user_id', userId),

    // Anonymize api_costs: null out user_id
    adminClient
      .from('api_costs')
      .update({ user_id: null, anonymized_at: new Date().toISOString() })
      .eq('user_id', userId),

    // Anonymize api_errors: null out user_id
    adminClient
      .from('api_errors')
      .update({ user_id: null, anonymized_at: new Date().toISOString() })
      .eq('user_id', userId),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Delete] Anonymization error:', result.reason);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = JWTService.verifySSOToken(sessionCookie.value);
    const userId = payload.userId;

    const body = await request.json();
    const validation = deleteAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { password } = validation.data;

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Verify password before deletion
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (signInError) {
      await logSecurityEvent(
        'ACCOUNT_DELETE_FAILED',
        'MEDIUM',
        userId,
        request,
        { reason: 'Invalid password' }
      );

      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Log account deletion event (before cleanup — audit trail)
    await logSecurityEvent(
      'ACCOUNT_DELETED',
      'HIGH',
      userId,
      request,
      { email: profile.email }
    );

    // Step 5: Cancel all active Stripe subscriptions
    await cancelStripeSubscriptions(userId);

    // Step 6: Delete storage files from all buckets
    await deleteStorageFiles(userId);

    // Step 7-8: Anonymize audit trail records
    await anonymizeAuditRecords(userId);

    // Step 9: Delete user from Supabase Auth (CASCADE handles remaining tables)
    const adminClient = createAdminClient();

    // Step 8b: Log data lifecycle event for compliance audit trail
    try {
      await adminClient.from('data_lifecycle_events').insert({
        user_id: null, // user is being deleted
        event_type: 'account_deleted',
        tables_affected: ['security_events', 'api_costs', 'api_errors'],
        records_affected: 0, // exact count not tracked here
      });
    } catch (lifecycleError) {
      console.error('[Delete] Failed to log lifecycle event:', lifecycleError);
      // Non-blocking — continue with deletion
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[Delete] User deletion error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Step 10: Clear SSO cookie
    const response = NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });

    const domain = process.env.NODE_ENV === 'production' ? '.bfeai.com' : 'localhost';
    response.cookies.set('bfeai_session', '', {
      domain,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
