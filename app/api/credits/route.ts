import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/credits
 * Returns the authenticated user's credit balance from user_credits table.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = JWTService.verifySSOToken(sessionCookie.value);
    const userId = payload.userId;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_credits')
      .select('subscription_balance, topup_balance, subscription_cap')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[credits] Error fetching credits:', error);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    const subscriptionBalance = data?.subscription_balance ?? 0;
    const topupBalance = data?.topup_balance ?? 0;

    return NextResponse.json({
      data: {
        subscriptionBalance,
        topupBalance,
        total: subscriptionBalance + topupBalance,
        cap: data?.subscription_cap ?? 0,
      },
    });
  } catch (error) {
    console.error('[credits] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
