import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/auth/oauth-init?provider=google|github
 *
 * Returns the OAuth authorization URL as JSON with PKCE cookies set on the response.
 *
 * This is the non-redirect version of /api/auth/oauth. We need it because Netlify
 * strips Set-Cookie headers from redirect responses, which breaks Supabase's PKCE flow:
 * the code_verifier cookie never reaches the browser, so exchangeCodeForSession fails
 * in the callback with "oauth_session_failed".
 *
 * By returning JSON instead of a redirect, Netlify preserves the Set-Cookie headers,
 * and the PKCE cookies are properly set before the user is sent to the provider.
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.bfeai.com';

    const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookiesToSet.push({ name, value, options });
            try {
              cookieStore.set({ name, value, ...options });
            } catch {
              // ignore — will be set on the response below
            }
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: '', options: { ...options, maxAge: 0 } });
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch {
              // ignore
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github',
      options: {
        redirectTo: `${appUrl}/api/auth/callback/${provider}`,
        scopes: provider === 'github' ? 'user:email read:user' : undefined,
      },
    });

    if (error || !data.url) {
      console.error('[OAuth Init] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth flow' },
        { status: 500 }
      );
    }

    console.log('[OAuth Init] Generated auth URL, PKCE cookies to set:', cookiesToSet.length);

    // Return JSON — NOT a redirect — so Netlify preserves Set-Cookie headers
    const response = NextResponse.json({ url: data.url });
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (error) {
    console.error('[OAuth Init] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
