import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const payload = JWTService.verifySSOToken(sessionCookie.value);
    const userId = payload.userId;

    // Rate limit: 1 export per hour per user
    const rateLimitResult = await checkRateLimit('dataExport', userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. You can export your data once per hour.' },
        { status: 429 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch all user data in parallel
    const [
      profileResult,
      settingsResult,
      subscriptionsResult,
      creditsResult,
      creditTransactionsResult,
      keywordReportsResult,
      labsProfilesResult,
      bugReportsResult,
      securityEventsResult,
      activitiesResult,
      apiCostsResult,
    ] = await Promise.allSettled([
      adminClient
        .from('profiles')
        .select('id, email, full_name, avatar_url, company, industry, created_at, updated_at')
        .eq('id', userId)
        .single(),

      adminClient
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single(),

      adminClient
        .from('app_subscriptions')
        .select('id, app_key, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at, paused_at, resume_at, monthly_credits, currency, created_at, updated_at')
        .eq('user_id', userId),

      adminClient
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single(),

      adminClient
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      adminClient
        .from('keyword_reports')
        .select('id, seed_keyword, country, language, status, total_keywords, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // LABS profiles with nested data
      adminClient
        .from('llm_business_profiles')
        .select('*, llm_tracked_keywords(*), llm_competitors(*)')
        .eq('user_id', userId),

      adminClient
        .from('bug_reports')
        .select('id, title, description, app_source, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      adminClient
        .from('security_events')
        .select('event_type, severity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),

      adminClient
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      adminClient
        .from('api_costs')
        .select('operation, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    // Extract data from settled results, defaulting to null/empty on failure
    const extract = <T>(result: PromiseSettledResult<{ data: T; error: unknown }>): T | null => {
      if (result.status === 'fulfilled' && !result.value.error) {
        return result.value.data;
      }
      return null;
    };

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: extract(profileResult),
      settings: extract(settingsResult),
      subscriptions: extract(subscriptionsResult) ?? [],
      credits: extract(creditsResult),
      credit_transactions: extract(creditTransactionsResult) ?? [],
      keyword_reports: extract(keywordReportsResult) ?? [],
      labs_profiles: extract(labsProfilesResult) ?? [],
      bug_reports: extract(bugReportsResult) ?? [],
      security_events: extract(securityEventsResult) ?? [],
      activities: extract(activitiesResult) ?? [],
      api_usage: extract(apiCostsResult) ?? [],
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bfeai-data-export-${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
