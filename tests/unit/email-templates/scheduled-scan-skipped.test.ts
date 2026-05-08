import { describe, it, expect } from 'vitest';
import { renderScheduledScanSkippedEmail } from '../../../netlify/functions/utils/email-templates';

describe('scheduled_scan_skipped_low_credits email', () => {
  it('renders subject and body with /credits link, app name, and credit numbers', () => {
    const result = renderScheduledScanSkippedEmail({
      firstName: 'Bill',
      appName: 'LABS',
      requiredCredits: 50,
      availableCredits: 8,
      creditsUrl: 'https://dashboard.bfeai.com/credits',
    });
    expect(result.subject).toMatch(/scheduled scan/i);
    expect(result.html).toContain('Bill');
    expect(result.html).toContain('LABS');
    expect(result.html).toContain('https://dashboard.bfeai.com/credits');
    expect(result.html).toMatch(/50/);
    expect(result.html).toMatch(/8/);
    expect(result.text).toContain('Bill');
    expect(result.text).toContain('LABS');
    expect(result.text).toContain('https://dashboard.bfeai.com/credits');
  });

  it('renders generic greeting when firstName is omitted', () => {
    const result = renderScheduledScanSkippedEmail({
      appName: 'LABS',
      requiredCredits: 50,
      availableCredits: 8,
      creditsUrl: 'https://dashboard.bfeai.com/credits',
    });
    expect(result.html).toMatch(/Hi there/i);
    expect(result.text).toMatch(/Hi there/i);
  });
});
