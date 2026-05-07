import { describe, it, expect, vi, beforeEach } from 'vitest';

const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('../../../netlify/functions/utils/supabase-admin', () => ({
  supabaseAdmin: { from: fromMock },
}));

describe('markScheduledScanSkipped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes last_skipped_scan_at to user_credits for the given user', async () => {
    const { markScheduledScanSkipped } = await import(
      '../../../netlify/functions/utils/skipped-scan'
    );
    await markScheduledScanSkipped('user-1');

    expect(fromMock).toHaveBeenCalledWith('user_credits');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        last_skipped_scan_at: expect.any(String),
      })
    );
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
