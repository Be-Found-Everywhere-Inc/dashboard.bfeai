// Generate short-lived authorization code for secure SSO token exchange
// Part of SSO Token URL Parameter Migration (Security Issue 2.6)

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { JWTService } from '@/lib/auth/jwt';
import crypto from 'crypto';

// Valid client IDs for BFEAI apps
const VALID_CLIENTS = ['keywords', 'payments', 'admin', 'labs'] as const;
type ClientId = typeof VALID_CLIENTS[number];

// Redirect URI patterns for each client
const VALID_REDIRECT_PATTERNS: Record<ClientId, RegExp> = {
  keywords: /^https:\/\/keywords\.bfeai\.com/,
  payments: /^https:\/\/payments\.bfeai\.com/,
  admin: /^https:\/\/admin\.bfeai\.com/,
  labs: /^https:\/\/labs\.bfeai\.com/,
};

// Development patterns (localhost)
const DEV_REDIRECT_PATTERNS: Record<ClientId, RegExp> = {
  keywords: /^http:\/\/localhost:(3000|3001|3002)/,
  payments: /^http:\/\/localhost:(3000|3001|3002)/,
  admin: /^http:\/\/localhost:(3000|3001|3002)/,
  labs: /^http:\/\/localhost:(3000|3001|3002|3003)/,
};

// Code expiry in seconds (30 seconds for security)
const CODE_EXPIRY_SECONDS = 30;

function isValidClient(clientId: string): clientId is ClientId {
  return VALID_CLIENTS.includes(clientId as ClientId);
}

function isValidRedirectUri(clientId: ClientId, redirectUri: string): boolean {
  // Check production patterns
  if (VALID_REDIRECT_PATTERNS[clientId].test(redirectUri)) {
    return true;
  }

  // Check development patterns in non-production
  if (process.env.NODE_ENV !== 'production') {
    if (DEV_REDIRECT_PATTERNS[clientId].test(redirectUri)) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get the session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('bfeai_session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 2. Verify the session token
    let payload;
    try {
      payload = JWTService.verifySSOToken(sessionToken);
    } catch (error) {
      console.error('[GenerateCode] Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // 3. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { client_id, redirect_uri } = body;

    // 4. Validate client_id
    if (!client_id || !isValidClient(client_id)) {
      return NextResponse.json(
        { error: 'Invalid client_id' },
        { status: 400 }
      );
    }

    // 5. Validate redirect_uri
    if (!redirect_uri || typeof redirect_uri !== 'string') {
      return NextResponse.json(
        { error: 'Missing redirect_uri' },
        { status: 400 }
      );
    }

    if (!isValidRedirectUri(client_id, redirect_uri)) {
      console.warn('[GenerateCode] Invalid redirect_uri:', {
        client_id,
        redirect_uri,
        env: process.env.NODE_ENV,
      });
      return NextResponse.json(
        { error: 'Invalid redirect_uri' },
        { status: 400 }
      );
    }

    // 6. Generate cryptographically secure code
    const code = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_SECONDS * 1000);

    // 7. Store code in database using admin client (bypasses RLS)
    const supabase = createAdminClient();

    const { error: insertError } = await supabase
      .from('auth_codes')
      .insert({
        code,
        user_id: payload.userId,
        token: sessionToken,
        client_id,
        redirect_uri,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[GenerateCode] Database insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to generate code' },
        { status: 500 }
      );
    }

    // 8. Log security event (fire-and-forget)
    supabase.from('security_events').insert({
      event_type: 'SSO_CODE_GENERATED',
      severity: 'INFO',
      user_id: payload.userId,
      ip_address: request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        client_id,
        redirect_uri,
        expires_in: CODE_EXPIRY_SECONDS,
      },
    }).then(({ error }) => {
      if (error) console.error('[GenerateCode] Failed to log security event:', error);
    });

    // 9. Return the code
    return NextResponse.json({
      code,
      expires_in: CODE_EXPIRY_SECONDS,
    });

  } catch (error) {
    console.error('[GenerateCode] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
