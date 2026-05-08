const BETA_USERS = new Set(
  (process.env.AUTO_TOPUP_BETA_USERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isAutoTopUpBetaUser(userId: string): boolean {
  return BETA_USERS.has(userId);
}
