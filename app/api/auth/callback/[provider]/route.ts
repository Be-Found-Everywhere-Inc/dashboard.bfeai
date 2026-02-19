import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { JWTService } from '@/lib/auth/jwt';

async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  userId: string | null,
  request: NextRequest,
  details?: Record<string, any>
) {
  try {
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

/**
 * GET /api/auth/callback/:provider
 * Handles OAuth callback using Supabase's exchangeCodeForSession
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  // Use production URL for all redirects to avoid Netlify deploy URL issues
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.bfeai.com';

  try {
    const { provider: providerParam } = await params;
    const provider = providerParam;
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');

    // Get redirect from cookie (set by OAuth initiation) - this avoids URL encoding issues
    const redirectCookie = request.cookies.get('oauth_redirect')?.value;
    // Decode the cookie value since it was URL-encoded when set
    const redirect = redirectCookie ? decodeURIComponent(redirectCookie) : '/profile';

    // Debug logging for OAuth callback
    console.log('[OAuth Callback] Request received:', {
      provider,
      hasCode: !!code,
      redirect,
      redirectFromCookie: !!redirectCookie,
      requestUrl: request.url,
      appUrl,
      allSearchParams: Object.fromEntries(request.nextUrl.searchParams.entries()),
    });

    // Check for OAuth error from provider
    if (error) {
      console.error(`[OAuth] Provider returned error: ${error}`);
      await logSecurityEvent(
        'OAUTH_ERROR',
        'MEDIUM',
        null,
        request,
        { provider, error }
      );
      return NextResponse.redirect(
        new URL(`/login?error=oauth_${error}`, appUrl)
      );
    }

    // Validate code parameter
    if (!code) {
      console.error('[OAuth] No code parameter received');
      return NextResponse.redirect(
        new URL('/login?error=oauth_no_code', appUrl)
      );
    }

    const supabase = await createClient();

    // Exchange code for session using Supabase
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !session) {
      console.error('[OAuth] Session exchange failed:', sessionError);
      await logSecurityEvent(
        'OAUTH_SESSION_EXCHANGE_FAILED',
        'MEDIUM',
        null,
        request,
        { provider, error: sessionError?.message }
      );
      return NextResponse.redirect(
        new URL('/login?error=oauth_session_failed', appUrl)
      );
    }

    // Get user from session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[OAuth] Failed to get user:', userError);
      await logSecurityEvent(
        'OAUTH_USER_FETCH_FAILED',
        'MEDIUM',
        null,
        request,
        { provider, error: userError?.message }
      );
      return NextResponse.redirect(
        new URL('/login?error=oauth_user_failed', appUrl)
      );
    }

    // Update profile with OAuth info, preserving existing data when OAuth metadata is missing
    // This prevents automatic OAuth logins from overwriting profile data with nulls
    const oauthFullName = user.user_metadata?.full_name || user.user_metadata?.name;
    const oauthAvatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    const oauthProviderId = user.user_metadata?.provider_id || user.user_metadata?.sub;

    // Fetch existing profile to preserve data when OAuth metadata is missing
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    // Build update object, only including fields that have values
    // Preserves existing data when OAuth doesn't provide new values
    const profileUpdate: Record<string, unknown> = {
      id: user.id,
      email: user.email!,
      oauth_provider: provider,
      updated_at: new Date().toISOString(),
    };

    // Only update full_name if OAuth provides a value, otherwise keep existing
    if (oauthFullName) {
      profileUpdate.full_name = oauthFullName;
    } else if (!existingProfile?.full_name) {
      // Only set to email prefix if there's no existing name
      profileUpdate.full_name = user.email!.split('@')[0];
    }

    // Only update avatar_url if OAuth provides a value, otherwise keep existing
    if (oauthAvatarUrl) {
      profileUpdate.avatar_url = oauthAvatarUrl;
    }
    // If no OAuth avatar and no existing avatar, leave it null (don't overwrite)

    // Only update oauth_provider_id if we have a value
    if (oauthProviderId) {
      profileUpdate.oauth_provider_id = oauthProviderId;
    }

    console.log('[OAuth] Profile update data:', {
      userId: user.id,
      hasOAuthFullName: !!oauthFullName,
      hasOAuthAvatarUrl: !!oauthAvatarUrl,
      hasExistingProfile: !!existingProfile,
      existingFullName: existingProfile?.full_name,
      existingAvatarUrl: existingProfile?.avatar_url ? '[present]' : '[missing]',
    });

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileUpdate, { onConflict: 'id' });

    if (profileError) {
      console.error('[OAuth] Profile update failed:', profileError);
      // Don't fail the login, just log the error
    }

    // Log successful OAuth login
    await logSecurityEvent(
      'OAUTH_LOGIN_SUCCESS',
      'LOW',
      user.id,
      request,
      { provider, email: user.email }
    );

    // Generate JWT for SSO across subdomains
    const token = JWTService.generateSSOToken(
      user.id,
      user.email!,
      'user'
    );

    // Determine the final redirect URL
    let finalRedirect: string;
    if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
      // Absolute URL - use directly without modification
      finalRedirect = redirect;
    } else {
      // Relative URL - resolve against app URL
      finalRedirect = new URL(redirect, appUrl).toString();
    }

    console.log('[OAuth] Token generated, finalRedirect:', {
      tokenLength: token?.length,
      originalRedirect: redirect,
      finalRedirect,
    });

    // Clear the oauth_redirect cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();
    try {
      cookieStore.set('oauth_redirect', '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
      });
    } catch (clearError) {
      console.error('[OAuth] Failed to clear oauth_redirect cookie:', clearError);
    }

    // Instead of setting the cookie on a redirect response (which may be stripped by Netlify),
    // redirect to an intermediate page that will set the cookie via a POST request and then
    // redirect to the final destination.
    const ssoCompleteUrl = new URL('/sso-complete', appUrl);
    ssoCompleteUrl.searchParams.set('token', token);
    ssoCompleteUrl.searchParams.set('redirect', finalRedirect);

    console.log('[OAuth Callback] Successfully completed, redirecting to sso-complete page');

    return NextResponse.redirect(ssoCompleteUrl.toString());
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    const fallbackAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.bfeai.com';
    await logSecurityEvent(
      'OAUTH_ERROR',
      'HIGH',
      null,
      request,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', fallbackAppUrl)
    );
  }
}
