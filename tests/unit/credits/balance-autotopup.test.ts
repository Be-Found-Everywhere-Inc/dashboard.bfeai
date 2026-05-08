import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks must be declared before any imports that pull in the mocked modules.
// ---------------------------------------------------------------------------

// Stripe mock — set up before module import so the credits module picks it up.
vi.mock('../../../netlify/functions/utils/stripe', () => ({
  stripe: {
    paymentMethods: {
      retrieve: vi.fn(),
    },
  },
}));

// supabaseAdmin mock — the from() dispatcher is replaced per-test via fromImpl.
// We keep a reference so individual tests can reconfigure it.
let fromImpl: (table: string) => unknown = () => ({});

vi.mock('../../../netlify/functions/utils/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => fromImpl(table)),
    rpc: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a from() implementation for a given user_credits row. */
const makeFromImpl = (row: Record<string, unknown> | null) => (table: string) => {
  if (table === 'user_credits') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    };
  }
  if (table === 'credit_transactions') {
    // Returns last charge row by default (overridden per test when needed)
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ created_at: '2026-05-01T10:00:00.000Z' }],
        error: null,
      }),
    };
  }
  return {};
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getBalance – autoTopup field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: returns all 7 autoTopup fields populated from DB + Stripe', async () => {
    const { supabaseAdmin } = await import('../../../netlify/functions/utils/supabase-admin');
    const { stripe } = await import('../../../netlify/functions/utils/stripe');

    // Configure user_credits row with auto top-up fields set
    fromImpl = makeFromImpl({
      subscription_balance: 200,
      topup_balance: 50,
      trial_balance: 0,
      trial_expires_at: null,
      subscription_cap: 900,
      lifetime_earned: 500,
      lifetime_spent: 250,
      last_skipped_scan_at: null,
      last_skipped_scan_dismissed_at: null,
      auto_topup_enabled: true,
      auto_topup_pack_key: 'starter_boost',
      auto_topup_monthly_cap_cents: 15000,
      auto_topup_payment_method_id: 'pm_test_123',
      auto_topup_disabled_reason: null,
    });

    // RPC returns 4999 cents MTD
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: 4999, error: null } as never);

    // Stripe returns card with last4
    vi.mocked(stripe.paymentMethods.retrieve).mockResolvedValue({
      id: 'pm_test_123',
      card: { last4: '4242' },
    } as never);

    const { getBalance } = await import('../../../netlify/functions/utils/credits');
    const balance = await getBalance('user-happy');

    expect(balance.autoTopup).toEqual({
      enabled: true,
      packKey: 'starter_boost',
      capCents: 15000,
      mtdSpentCents: 4999,
      lastChargeAt: '2026-05-01T10:00:00.000Z',
      paymentMethodLast4: '4242',
      disabledReason: null,
    });

    // Confirm Stripe was called with the correct PM id
    expect(stripe.paymentMethods.retrieve).toHaveBeenCalledWith('pm_test_123');
  });

  it('Stripe PM retrieve throws → paymentMethodLast4 is null, balance still returned', async () => {
    const { supabaseAdmin } = await import('../../../netlify/functions/utils/supabase-admin');
    const { stripe } = await import('../../../netlify/functions/utils/stripe');

    fromImpl = makeFromImpl({
      subscription_balance: 100,
      topup_balance: 0,
      trial_balance: 0,
      trial_expires_at: null,
      subscription_cap: 900,
      lifetime_earned: 100,
      lifetime_spent: 0,
      last_skipped_scan_at: null,
      last_skipped_scan_dismissed_at: null,
      auto_topup_enabled: true,
      auto_topup_pack_key: 'builder_pack',
      auto_topup_monthly_cap_cents: 20000,
      auto_topup_payment_method_id: 'pm_detached_xyz',
      auto_topup_disabled_reason: 'payment_failed',
    });

    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: 0, error: null } as never);

    // Simulate a detached/deleted PM → Stripe throws
    vi.mocked(stripe.paymentMethods.retrieve).mockRejectedValue(
      new Error('No such PaymentMethod: pm_detached_xyz')
    );

    const { getBalance } = await import('../../../netlify/functions/utils/credits');
    const balance = await getBalance('user-stripe-fail');

    // Should not throw — paymentMethodLast4 falls back to null
    expect(balance.autoTopup.paymentMethodLast4).toBeNull();
    expect(balance.autoTopup.enabled).toBe(true);
    expect(balance.autoTopup.disabledReason).toBe('payment_failed');
    // Other balance fields should still be correct
    expect(balance.total).toBe(100);
  });

  it('no user_credits row → returns sensible autoTopup defaults', async () => {
    const { supabaseAdmin } = await import('../../../netlify/functions/utils/supabase-admin');
    const { stripe } = await import('../../../netlify/functions/utils/stripe');

    // Simulate no row in DB
    fromImpl = makeFromImpl(null);

    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: 0, error: null } as never);
    vi.mocked(stripe.paymentMethods.retrieve).mockResolvedValue({} as never);

    const { getBalance } = await import('../../../netlify/functions/utils/credits');
    const balance = await getBalance('user-no-row');

    expect(balance.autoTopup).toEqual({
      enabled: false,
      packKey: null,
      capCents: 20000,
      mtdSpentCents: 0,
      lastChargeAt: null,
      paymentMethodLast4: null,
      disabledReason: null,
    });

    // Stripe should NOT be called when there's no PM id
    expect(stripe.paymentMethods.retrieve).not.toHaveBeenCalled();
  });
});
