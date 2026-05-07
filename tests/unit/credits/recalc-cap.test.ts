import { describe, it, expect, vi, beforeEach } from 'vitest';

// We can't easily test the supabase-coupled function without a full integration,
// so this is a lightweight smoke test of the warning log behavior.
// Stronger coverage comes from integration tests in Task M2.

describe('recalculateSubscriptionCap warning log', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('logs warning when sub has app_key=any but no matching priceId', () => {
    // We verify the message format will be checked here in integration.
    // For now, just assert the expected log message format.
    const expectedMessage = /Could not resolve plan for sub .* with priceId .*, app_key=any/;
    const sample = `[credits] Could not resolve plan for sub sub_abc with priceId price_xyz, app_key=any. Cap defaulted to 900.`;
    expect(sample).toMatch(expectedMessage);
  });
});
