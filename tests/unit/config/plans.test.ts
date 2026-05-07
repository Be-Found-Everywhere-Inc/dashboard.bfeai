import { describe, it, expect } from 'vitest';
import {
  LITE_PLAN,
  PLUS_PLAN,
  MAX_PLAN,
  ALL_SUBSCRIPTIONS,
  UNIVERSAL_APP_KEY,
  findSubscriptionPlan,
} from '../../../config/plans';

describe('new tier constants', () => {
  it('LITE_PLAN matches spec', () => {
    expect(LITE_PLAN).toMatchObject({
      appKey: 'any',
      tier: 'lite',
      monthlyPrice: 49,
      monthlyCredits: 500,
      creditCap: 1500,
    });
  });

  it('PLUS_PLAN matches spec', () => {
    expect(PLUS_PLAN).toMatchObject({
      appKey: 'any',
      tier: 'plus',
      monthlyPrice: 144,
      monthlyCredits: 1700,
      creditCap: 5100,
    });
  });

  it('MAX_PLAN matches spec', () => {
    expect(MAX_PLAN).toMatchObject({
      appKey: 'any',
      tier: 'max',
      monthlyPrice: 444,
      monthlyCredits: 5500,
      creditCap: 16500,
    });
  });

  it('UNIVERSAL_APP_KEY is "any"', () => {
    expect(UNIVERSAL_APP_KEY).toBe('any');
  });

  it('ALL_SUBSCRIPTIONS includes new tiers and legacy plans', () => {
    expect(ALL_SUBSCRIPTIONS).toContain(LITE_PLAN);
    expect(ALL_SUBSCRIPTIONS).toContain(PLUS_PLAN);
    expect(ALL_SUBSCRIPTIONS).toContain(MAX_PLAN);
  });

  it('ALL_SUBSCRIPTIONS does NOT include LABS_AEO', () => {
    const aeoExists = ALL_SUBSCRIPTIONS.some(
      (p) => (p.tier as string) === 'aeo_consultant'
    );
    expect(aeoExists).toBe(false);
  });
});

describe('findSubscriptionPlan sentinel rejection', () => {
  it('returns null for sentinel "any" appKey', () => {
    expect(findSubscriptionPlan('any')).toBeNull();
  });

  it('returns null for "any" with tier specified', () => {
    expect(findSubscriptionPlan('any', 'lite')).toBeNull();
  });

  it('still works for legacy app keys', () => {
    const plan = findSubscriptionPlan('keywords');
    expect(plan).not.toBeNull();
    expect(plan?.appKey).toBe('keywords');
  });
});
