import { describe, it, expect, vi, beforeEach } from 'vitest';

const eqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
const fromMock = vi.fn(() => ({ update: updateMock }));

const requireAuthMock = vi.fn().mockResolvedValue({ user: { id: 'user-1' } });

vi.mock('../../../netlify/functions/utils/supabase-admin', () => ({
  supabaseAdmin: { from: fromMock },
  requireAuth: requireAuthMock,
}));

describe('credits-skipped-scan-dismiss handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to happy-path defaults; individual tests override.
    eqMock.mockResolvedValue({ error: null });
    requireAuthMock.mockResolvedValue({ user: { id: 'user-1' } });
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

  it('401 when requireAuth rejects with unauthenticated HttpError', async () => {
    // Pull HttpError from the same module shape the handler uses, so
    // withErrorHandling -> handleError matches the instanceof check.
    const { HttpError } = await import('../../../netlify/functions/utils/http');
    requireAuthMock.mockRejectedValueOnce(new HttpError(401, 'Unauthenticated'));

    const mod = await import(
      '../../../netlify/functions/credits-skipped-scan-dismiss'
    );
    const result = await mod.handler!(
      { httpMethod: 'POST', headers: {}, body: '{}' } as unknown as Parameters<NonNullable<typeof mod.handler>>[0],
      {} as unknown as Parameters<NonNullable<typeof mod.handler>>[1],
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(401);
    // No DB write should have occurred.
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('500 when supabase update returns an error', async () => {
    eqMock.mockResolvedValueOnce({
      error: { code: 'PGRST', message: 'db down' },
    });

    const mod = await import(
      '../../../netlify/functions/credits-skipped-scan-dismiss'
    );
    const result = await mod.handler!(
      { httpMethod: 'POST', headers: {}, body: '{}' } as unknown as Parameters<NonNullable<typeof mod.handler>>[0],
      {} as unknown as Parameters<NonNullable<typeof mod.handler>>[1],
      () => undefined,
    );
    expect((result as { statusCode: number }).statusCode).toBe(500);
  });
});
