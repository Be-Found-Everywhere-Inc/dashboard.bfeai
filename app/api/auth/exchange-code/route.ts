// Exchange authorization code for JWT token (server-to-server)
// Part of SSO Token URL Parameter Migration (Security Issue 2.6)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Valid client IDs
const VALID_CLIENTS = ['keywords', 'payments', 'admin', 'labs'] as const;
type ClientId = typeof VALID_CLIENTS[number];

// Get client secret from environment
function getClientSecret(clientId: ClientId): string | undefined {
  const envKeys: Record<ClientId, string> = {
    keywords: 'SSO_CLIENT_SECRET_KEYWORDS',
    payments: 'SSO_CLIENT_SECRET_PAYMENTS',
    admin: 'SSO_CLIENT_SECRET_ADMIN',
    labs: 'SSO_CLIENT_SECRET_LABS',
  };
  return process.env[envKeys[clientId]];
}

function isValidClient(clientId: string): clientId is ClientId {
  return VALID_CLIENTS.includes(clientId as ClientId);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { code, client_id, client_secret } = body;

    // 2. Validate client_id
    if (!client_id || !isValidClient(client_id)) {
      return NextResponse.json(
        { error: 'Invalid client_id' },
        { status: 400 }
      );
    }

    // 3. Validate client_secret
    const expectedSecret = getClientSecret(client_id);
    if (!expectedSecret) {
      console.error('[ExchangeCode] Client secret not configured for:', client_id);
      return NextResponse.json(
        { error: 'Client not configured' },
        { status: 500 }
      );
    }

    if (!client_secret || client_secret !== expectedSecret) {
      console.warn('[ExchangeCode] Invalid client_secret for:', client_id);
      return NextResponse.json(
        { error: 'Invalid client credentials' },
        { status: 401 }
      );
    }

    // 4. Validate code parameter
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing code' },
        { status: 400 }
      );
    }

    // 5. Look up code in database
    const supabase = createAdminClient();

    const { data: authCode, error: lookupError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq('code', code)
      .eq('client_id', client_id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (lookupError || !authCode) {
      // Log failed attempt (fire-and-forget)
      supabase.from('security_events').insert({
        event_type: 'SSO_CODE_EXCHANGE_FAILED',
        severity: 'MEDIUM',
        user_id: null,
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          client_id,
          reason: lookupError ? 'lookup_error' : 'code_not_found_or_expired',
          error: lookupError?.message,
        },
      }).then(({ error }) => {
        if (error) console.error('[ExchangeCode] Failed to log security event:', error);
      });

      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // 6. Mark code as used (one-time use - prevents replay attacks)
    const { error: updateError } = await supabase
      .from('auth_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', authCode.id);

    if (updateError) {
      console.error('[ExchangeCode] Failed to mark code as used:', updateError);
      // Continue anyway - the code lookup already succeeded
      // Better to complete the auth flow than fail here
    }

    // 7. Log successful exchange (fire-and-forget)
    supabase.from('security_events').insert({
      event_type: 'SSO_CODE_EXCHANGED',
      severity: 'INFO',
      user_id: authCode.user_id,
      ip_address: request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') ||
                  'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        client_id,
        redirect_uri: authCode.redirect_uri,
      },
    }).then(({ error }) => {
      if (error) console.error('[ExchangeCode] Failed to log security event:', error);
    });

    // 8. Return the token
    return NextResponse.json({
      token: authCode.token,
      redirect_uri: authCode.redirect_uri,
    });

  } catch (error) {
    console.error('[ExchangeCode] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
