import { describe, it, expect, vi, beforeEach } from 'vitest';

const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock('../../../netlify/functions/utils/supabase-admin', () => ({
  supabaseAdmin: { from: fromMock },
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

describe('credits-skipped-scan-dismiss handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 sets last_skipped_scan_dismissed_at on POST', async () => {
    const mod = await import(
      '../../../netlify/functions/credits-skipped-scan-dismiss'
    );
    const result = await mod.handler!(
      { httpMethod: 'POST', headers: {}, body: '{}' } as unknown as Parameters<NonNullable<typeof mod.handler>>[0],
      {} as unknown as Parameters<NonNullable<typeof mod.handler>>[1],
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(fromMock).toHaveBeenCalledWith('user_credits');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        last_skipped_scan_dismissed_at: expect.any(String),
      })
    );
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('405 on GET', async () => {
    const mod = await import(
      '../../../netlify/functions/credits-skipped-scan-dismiss'
    );
    const result = await mod.handler!(
      { httpMethod: 'GET', headers: {} } as unknown as Parameters<NonNullable<typeof mod.handler>>[0],
      {} as unknown as Parameters<NonNullable<typeof mod.handler>>[1],
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(405);
  });
});
