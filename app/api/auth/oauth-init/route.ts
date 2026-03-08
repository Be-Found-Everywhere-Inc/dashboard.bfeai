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

    // ---------------------------------------------------------------
    // Explicitly clear ALL stale Supabase auth cookies BEFORE creating
    // the Supabase client. This replaces the previous approach of calling
    // supabase.auth.signOut() which fired an unawaited onAuthStateChange
    // callback, creating a race condition with signInWithOAuth's PKCE
    // code verifier storage — both pushed entries to cookiesToSet
    // concurrently via shared mutable state, causing the PKCE cookie
    // to be missing or corrupted on Netlify.
    // ---------------------------------------------------------------
    const supabaseProjectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .replace('https://', '')
      .replace('.supabase.co', '');

    if (supabaseProjectRef) {
      const sbCookieBase = `sb-${supabaseProjectRef}-auth-token`;
      // Clear base cookie, chunked variants (.0-.4), and stale code verifier
      const staleSuffixes = ['', '.0', '.1', '.2', '.3', '.4', '-code-verifier'];
      for (const suffix of staleSuffixes) {
        const cookieName = `${sbCookieBase}${suffix}`;
        // Only clear if the cookie actually exists in the request
        if (cookieStore.get(cookieName)) {
          cookiesToSet.push({
            name: cookieName,
            value: '',
            options: { path: '/', sameSite: 'lax', maxAge: 0 },
          });
        }
      }

      if (cookiesToSet.length > 0) {
        console.log('[OAuth Init] Clearing stale Supabase cookies:', cookiesToSet.length);
      }
    }

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

    // NOTE: We intentionally do NOT call supabase.auth.signOut() here.
    // signOut() fires an async onAuthStateChange('SIGNED_OUT') callback
    // that is NOT awaited by the Supabase auth-js library. This callback
    // calls applyServerStorage which pushes cookie entries concurrently
    // with signInWithOAuth's PKCE storage, causing a race condition.
    // Stale cookies are cleared explicitly above instead.

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

    // Deduplicate cookiesToSet — keep last entry per cookie name so that
    // PKCE set entries always win over earlier stale-cookie clear entries.
    const deduped = new Map<string, (typeof cookiesToSet)[number]>();
    for (const entry of cookiesToSet) {
      deduped.set(entry.name, entry);
    }

    console.log('[OAuth Init] Generated auth URL, PKCE cookies to set:', deduped.size,
      'names:', [...deduped.keys()].join(', '));

    // Return JSON — NOT a redirect — so Netlify preserves Set-Cookie headers
    const response = NextResponse.json({ url: data.url });
    for (const entry of deduped.values()) {
      response.cookies.set(entry.name, entry.value, entry.options);
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
