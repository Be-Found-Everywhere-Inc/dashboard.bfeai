import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain: from('user_credits').update({...}).eq('user_id', x).select('user_id')
// The terminal `.select()` resolves to { data, error }.
const selectMock = vi.fn().mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null });
const eqMock = vi.fn().mockReturnValue({ select: selectMock });
const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('../../../netlify/functions/utils/supabase-admin', () => ({
  supabaseAdmin: { from: fromMock },
}));

describe('markScheduledScanSkipped', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to happy-path default; individual tests override as needed.
    selectMock.mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null });
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
    expect(selectMock).toHaveBeenCalledWith('user_id');
  });

  it('does not throw and logs error when supabase update errors', async () => {
    selectMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key', details: 'pk conflict' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { markScheduledScanSkipped } = await import(
      '../../../netlify/functions/utils/skipped-scan'
    );

    await expect(markScheduledScanSkipped('user-1')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[skipped-scan] failed to mark',
      expect.objectContaining({
        userId: 'user-1',
        code: '23505',
        message: 'duplicate key',
        details: 'pk conflict',
      })
    );

    errorSpy.mockRestore();
  });

  it('warns when no user_credits row exists for the user (0-row update)', async () => {
    selectMock.mockResolvedValueOnce({ data: [], error: null });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { markScheduledScanSkipped } = await import(
      '../../../netlify/functions/utils/skipped-scan'
    );

    await markScheduledScanSkipped('user-ghost');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no user_credits row'),
      expect.objectContaining({ userId: 'user-ghost' })
    );

    warnSpy.mockRestore();
  });
});
