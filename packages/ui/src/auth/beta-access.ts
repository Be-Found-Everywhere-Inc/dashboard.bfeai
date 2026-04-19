/**
 * User shape with a user_tier field. Loose so callers from any app
 * (which may have slightly different BFEAIUser type definitions) can pass
 * their user object without casting.
 */
type UserWithTier = { user_tier?: string | null } | null | undefined;

const BETA_ELIGIBLE_TIERS = new Set(["beta_tester", "founder", "test_account"]);

/**
 * Returns true if the user should see offpage as if they were subscribed.
 * Used to gate sidebar visibility, marketplace card visibility, and any
 * other surface that asks "does this user have offpage access?".
 */
export function hasOffpageBetaAccess(user: UserWithTier): boolean {
  if (!user || typeof user !== "object") return false;
  const tier = user.user_tier;
  if (!tier) return false;
  return BETA_ELIGIBLE_TIERS.has(tier);
}
