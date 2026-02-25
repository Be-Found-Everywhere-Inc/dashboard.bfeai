import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/auth/oauth?provider=google|github
 * Initiates OAuth flow using Supabase's native OAuth
 *
 * The redirect URL is stored in a cookie (oauth_redirect) instead of passing
 * it through the OAuth URL chain to avoid URL encoding issues.
 */
export async function GET(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get('provider');

    if (!provider || (provider !== 'google' && provider !== 'github')) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider' },
        { status: 400 }
      );
    }

    // Check if oauth_redirect cookie already exists (set by intermediate page)
    // This is the preferred path - the intermediate page sets the cookie via a non-redirect response
    const existingRedirectCookie = request.cookies.get('oauth_redirect')?.value;
    const redirectParam = request.nextUrl.searchParams.get('redirect') || '/';

    // Use existing cookie if set, otherwise use URL param
    const redirect = existingRedirectCookie
      ? decodeURIComponent(existingRedirectCookie)
      : redirectParam;

    // Get the app URL for callback - use production URL as fallback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accounts.bfeai.com';

    console.log('[OAuth] Initiating OAuth flow:', {
      provider,
      redirect,
      redirectFromCookie: !!existingRedirectCookie,
      redirectParam,
      appUrl,
    });

    // Track cookies that need to be set on the response
    const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
    const cookieStore = await cookies();

    // Create Supabase client with custom cookie handler to capture cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Store for later - we'll add to redirect response
            cookiesToSet.push({ name, value, options });
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Ignore - will set on response
            }
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } });
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Ignore - will set on response
            }
          },
        },
      }
    );

    // Use Supabase's built-in OAuth - callback URL has NO query params to avoid encoding issues
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github',
      options: {
        redirectTo: `${appUrl}/api/auth/callback/${provider}`,
        scopes: provider === 'github' ? 'user:email read:user' : undefined
      }
    });

    if (error) {
      console.error('[OAuth] Supabase OAuth error:', error);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500 }
      );
    }

    console.log('[OAuth] Redirecting to provider, cookies to set:', cookiesToSet.length);

    // Create redirect response and add any cookies that Supabase set
    const response = NextResponse.redirect(data.url);

    // Add PKCE and other Supabase cookies to the response
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options);
    }

    // If the cookie wasn't already set by the intermediate page, try to set it here
    // Note: Netlify may strip Set-Cookie headers from redirect responses, so this is a fallback
    if (!existingRedirectCookie) {
      console.log('[OAuth] Cookie not set by intermediate page, attempting to set on redirect (may be stripped by Netlify)');
      response.cookies.set('oauth_redirect', redirect, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes - enough time to complete OAuth
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('[OAuth] Initiation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
