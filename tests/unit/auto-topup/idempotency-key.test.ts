import { describe, it, expect, vi } from "vitest";

// Mock modules that throw at load-time when env vars are missing
vi.mock("../../../netlify/functions/utils/supabase-admin", () => ({
  requireAuth: vi.fn(),
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("../../../netlify/functions/utils/stripe", () => ({
  stripe: { paymentIntents: { create: vi.fn() } },
}));

vi.mock("../../../netlify/functions/utils/credits", () => ({
  allocateTopUpCredits: vi.fn(),
}));

vi.mock("../../../netlify/functions/utils/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../../netlify/functions/utils/email-throttle", () => ({
  shouldSendEmail: vi.fn(),
}));

vi.mock("../../../netlify/functions/utils/email-templates", () => ({
  renderAutoTopUpRequiresAuthEmail: vi.fn(),
  renderAutoTopUpCardDeclinedEmail: vi.fn(),
}));

vi.mock("../../../lib/feature-flags", () => ({
  isAutoTopUpBetaUser: vi.fn(),
}));

import { buildIdempotencyKey } from "../../../netlify/functions/auto-topup-charge";

describe("buildIdempotencyKey", () => {
  it("returns auto-topup:{userId}:{utcDate}:{packKey}", () => {
    const key = buildIdempotencyKey("user-1", "power", new Date("2026-05-08T12:34:56Z"));
    expect(key).toBe("auto-topup:user-1:2026-05-08:power");
  });

  it("uses UTC date regardless of local TZ", () => {
    // 2026-05-09T03:00:00Z
    const key = buildIdempotencyKey("u", "p", new Date("2026-05-09T03:00:00Z"));
    expect(key).toBe("auto-topup:u:2026-05-09:p");
  });
});
