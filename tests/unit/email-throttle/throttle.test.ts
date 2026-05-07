import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();
vi.mock('@upstash/redis', () => ({
  Redis: class {
    set = setMock;
  },
}));

describe('shouldSendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns true on first call (key set, NX succeeded)', async () => {
    setMock.mockResolvedValueOnce('OK');
    const { shouldSendEmail } = await import(
      '../../../netlify/functions/utils/email-throttle'
    );
    expect(
      await shouldSendEmail('user-1', 'scheduled_scan_skipped_low_credits')
    ).toBe(true);
    expect(setMock).toHaveBeenCalledWith(
      'email_throttle:user-1:scheduled_scan_skipped_low_credits',
      '1',
      { nx: true, ex: 86400 }
    );
  });

  it('returns false on second call within window (NX returns null)', async () => {
    setMock.mockResolvedValueOnce(null);
    const { shouldSendEmail } = await import(
      '../../../netlify/functions/utils/email-throttle'
    );
    expect(
      await shouldSendEmail('user-1', 'scheduled_scan_skipped_low_credits')
    ).toBe(false);
  });

  it('returns true (fail-open) when redis errors', async () => {
    setMock.mockRejectedValueOnce(new Error('redis down'));
    const { shouldSendEmail } = await import(
      '../../../netlify/functions/utils/email-throttle'
    );
    expect(
      await shouldSendEmail('user-1', 'scheduled_scan_skipped_low_credits')
    ).toBe(true);
  });
});
