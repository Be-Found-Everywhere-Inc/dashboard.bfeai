import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /auth/confirm
 *
 * Server-side route that handles email verification (password recovery, signup confirmation, etc.)
 *
 * Supports two flows:
 * 1. token_hash + type: Direct OTP verification (recommended for email links)
 * 2. code: PKCE authorization code exchange (fallback for Supabase redirect flow)
 *
 * After verification, redirects to the `next` param (defaults to /reset-password for recovery).
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.bfeai.com';

  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as
    | 'recovery'
    | 'signup'
    | 'email'
    | 'invite'
    | null;
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') || '/reset-password';

  // Determine a safe redirect path (must be relative and on our domain)
  const safeNext = next.startsWith('/') ? next : '/reset-password';

  try {
    const supabase = await createClient();

    if (tokenHash && type) {
      // Flow 1: Direct OTP verification with token_hash
      // This does NOT require a code_verifier — works reliably across sessions/devices
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        console.error('[Auth Confirm] verifyOtp failed:', error.message);
        const errorUrl = new URL(safeNext, appUrl);
        errorUrl.searchParams.set('error', 'invalid_token');
        errorUrl.searchParams.set('error_description', error.message);
        return NextResponse.redirect(errorUrl.toString());
      }

      // Success — session is now set via cookies by the server client
      const successUrl = new URL(safeNext, appUrl);
      successUrl.searchParams.set('verified', 'true');
      return NextResponse.redirect(successUrl.toString());
    }

    if (code) {
      // Flow 2: PKCE code exchange (fallback if Supabase redirects with ?code=)
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[Auth Confirm] exchangeCodeForSession failed:', error.message);
        const errorUrl = new URL(safeNext, appUrl);
        errorUrl.searchParams.set('error', 'code_exchange_failed');
        errorUrl.searchParams.set('error_description', error.message);
        return NextResponse.redirect(errorUrl.toString());
      }

      const successUrl = new URL(safeNext, appUrl);
      successUrl.searchParams.set('verified', 'true');
      return NextResponse.redirect(successUrl.toString());
    }

    // No token_hash or code provided
    console.error('[Auth Confirm] No token_hash or code in request');
    const errorUrl = new URL(safeNext, appUrl);
    errorUrl.searchParams.set('error', 'missing_params');
    return NextResponse.redirect(errorUrl.toString());
  } catch (error) {
    console.error('[Auth Confirm] Unexpected error:', error);
    const errorUrl = new URL(safeNext, appUrl);
    errorUrl.searchParams.set('error', 'server_error');
    return NextResponse.redirect(errorUrl.toString());
  }
}
