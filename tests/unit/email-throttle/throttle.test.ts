import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const setMock = vi.fn();
vi.mock('@upstash/redis', () => ({
  Redis: class {
    set = setMock;
  },
}));

describe('shouldSendEmail', () => {
  const originalUrl = process.env.UPSTASH_REDIS_URL;
  const originalToken = process.env.UPSTASH_REDIS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default: configured env. Individual tests can override.
    process.env.UPSTASH_REDIS_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'real-token';
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_URL = originalUrl;
    process.env.UPSTASH_REDIS_TOKEN = originalToken;
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

  it('returns false (fail-closed) when redis errors', async () => {
    setMock.mockRejectedValueOnce(new Error('redis down'));
    const { shouldSendEmail } = await import(
      '../../../netlify/functions/utils/email-throttle'
    );
    expect(
      await shouldSendEmail('user-1', 'scheduled_scan_skipped_low_credits')
    ).toBe(false);
  });

  it('returns false and warns when Upstash env vars are missing', async () => {
    delete process.env.UPSTASH_REDIS_URL;
    delete process.env.UPSTASH_REDIS_TOKEN;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { shouldSendEmail } = await import(
      '../../../netlify/functions/utils/email-throttle'
    );
    expect(
      await shouldSendEmail('user-1', 'scheduled_scan_skipped_low_credits')
    ).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[email-throttle]')
    );
    // Critically: redis client was never built, so .set was never called.
    expect(setMock).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('returns false when env vars are placeholders', async () => {
    process.env.UPSTASH_REDIS_URL = 'https://placeholder.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'placeholder-token';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { shouldSendEmail } = await import(
      '../../../netlify/functions/utils/email-throttle'
    );
    expect(
      await shouldSendEmail('user-1', 'scheduled_scan_skipped_low_credits')
    ).toBe(false);
    expect(setMock).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
