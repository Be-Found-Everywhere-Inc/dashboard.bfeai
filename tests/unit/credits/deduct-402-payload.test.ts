import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpError } from '../../../netlify/functions/utils/http';

// Mock stripe so importing credits.ts doesn't require STRIPE_SECRET_KEY.
vi.mock('../../../netlify/functions/utils/stripe', () => ({
  stripe: {
    paymentMethods: { retrieve: vi.fn() },
  },
}));

// Mock supabaseAdmin so that:
// - getCreditCost (queries `app_credit_config`) returns credit_cost: 50
// - getBalance (queries `user_credits`) returns a row totaling -2 credits
//
// Note on numbers: the deductCredits 402 branch fires only when
// `projectedBalance < -cost`, i.e. `balance.total < 0` (a brief sub-zero
// position permitted by the race-tolerance floor introduced in 1d69475).
// Therefore we cannot use a positive `available` value and still hit the
// throw. We use available=-2, required=50 to actually exercise the 402 path.
vi.mock('../../../netlify/functions/utils/supabase-admin', () => {
  const fromImpl = (table: string) => {
    if (table === 'app_credit_config') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { credit_cost: 50 },
          error: null,
        }),
      };
    }
    if (table === 'user_credits') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            subscription_balance: -2,
            topup_balance: 0,
            trial_balance: 0,
            trial_expires_at: null,
            subscription_cap: 900,
            lifetime_earned: 0,
            lifetime_spent: 0,
            auto_topup_enabled: false,
            auto_topup_pack_key: null,
            auto_topup_monthly_cap_cents: 20000,
            auto_topup_payment_method_id: null,
            auto_topup_disabled_reason: null,
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      };
    }
    if (table === 'credit_transactions') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'txn-1' }, error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'txn-1' }, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    };
  };

  return {
    supabaseAdmin: {
      from: vi.fn(fromImpl),
      rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    },
  };
});

describe('deductCredits 402 payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 402 with required, available, and operation fields', async () => {
    const { deductCredits } = await import('../../../netlify/functions/utils/credits');
    try {
      await deductCredits('user-1', 'keywords', 'create_report');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.statusCode).toBe(402);
      expect(httpErr.details).toEqual({
        required: 50,
        available: -2,
        operation: 'create_report',
      });
    }
  });
});
