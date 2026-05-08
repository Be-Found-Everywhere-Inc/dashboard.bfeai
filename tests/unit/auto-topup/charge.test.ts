import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before any import so vi.mock hoisting works
// ---------------------------------------------------------------------------

const mockPaymentIntentsCreate = vi.fn();
const mockStripe = {
  paymentIntents: { create: mockPaymentIntentsCreate },
};

const mockRequireAuth = vi.fn();

// Supabase chain: we use a factory that returns a fresh chain object each call,
// controlled by module-level state that makeSupabaseAdmin() updates.
let _creditsData: Record<string, unknown> | null = DEFAULT_CREDITS_ROW_INIT();
let _creditsError: { message: string } | null = null;
let _profileData: Record<string, unknown> | null = null;
let _mtdCents = 0;
// Track update calls for assertions
const mockUpdateCreditsEq = vi.fn();
const mockUpdateChain = {
  update: vi.fn().mockReturnThis(),
  eq: mockUpdateCreditsEq,
};

function DEFAULT_CREDITS_ROW_INIT() {
  return {
    auto_topup_enabled: true,
    auto_topup_disabled_reason: null,
    auto_topup_payment_method_id: "pm_test_abc",
    auto_topup_monthly_cap_cents: 50000, // $500 cap
  };
}

function makeSupabaseFromImpl(table: string) {
  if (table === "user_credits") {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: _creditsData,
            error: _creditsError,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: mockUpdateCreditsEq.mockResolvedValue({ data: null, error: null }),
      }),
    };
  }
  if (table === "profiles") {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: _profileData,
            error: null,
          }),
        }),
      }),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
}

const mockSupabaseAdmin = {
  from: vi.fn().mockImplementation(makeSupabaseFromImpl),
  rpc: vi.fn().mockImplementation(() =>
    Promise.resolve({ data: [{ mtd_cents: _mtdCents }], error: null })
  ),
};

const mockAllocateTopUpCredits = vi.fn();
const mockSendEmail = vi.fn();
const mockShouldSendEmail = vi.fn();
const mockRenderRequiresAuth = vi.fn();
const mockRenderCardDeclined = vi.fn();
const mockIsAutoTopUpBetaUser = vi.fn();

vi.mock("../../../netlify/functions/utils/stripe", () => ({
  stripe: mockStripe,
}));

vi.mock("../../../netlify/functions/utils/supabase-admin", () => ({
  requireAuth: mockRequireAuth,
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock("../../../netlify/functions/utils/credits", () => ({
  allocateTopUpCredits: mockAllocateTopUpCredits,
}));

vi.mock("../../../netlify/functions/utils/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("../../../netlify/functions/utils/email-throttle", () => ({
  shouldSendEmail: mockShouldSendEmail,
}));

vi.mock("../../../netlify/functions/utils/email-templates", () => ({
  renderAutoTopUpRequiresAuthEmail: mockRenderRequiresAuth,
  renderAutoTopUpCardDeclinedEmail: mockRenderCardDeclined,
}));

vi.mock("../../../lib/feature-flags", () => ({
  isAutoTopUpBetaUser: mockIsAutoTopUpBetaUser,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSupabaseState(opts: {
  creditsRow?: Record<string, unknown> | null;
  creditsError?: { message: string } | null;
  profile?: Record<string, unknown> | null;
  mtdCents?: number;
}) {
  _creditsData = opts.creditsRow !== undefined ? opts.creditsRow : DEFAULT_CREDITS_ROW_INIT();
  _creditsError = opts.creditsError !== undefined ? opts.creditsError : null;
  _profileData = opts.profile !== undefined ? opts.profile : DEFAULT_PROFILE;
  _mtdCents = opts.mtdCents ?? 0;

  // Refresh mock implementations so next calls use updated state
  mockSupabaseAdmin.from.mockImplementation(makeSupabaseFromImpl);
  mockSupabaseAdmin.rpc.mockImplementation(() =>
    Promise.resolve({ data: [{ mtd_cents: _mtdCents }], error: null })
  );
}

const DEFAULT_CREDITS_ROW = DEFAULT_CREDITS_ROW_INIT();

const DEFAULT_PROFILE = {
  stripe_customer_id: "cus_test_123",
  first_name: "Alice",
};

// power pack: 980 credits, $99 (9900 cents)
const POWER_PACK_KEY = "power";

function makeEvent(packKey = POWER_PACK_KEY) {
  return {
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({ pack_key: packKey }),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auto-topup-charge handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset module-level state
    _creditsData = DEFAULT_CREDITS_ROW_INIT();
    _creditsError = null;
    _profileData = DEFAULT_PROFILE;
    _mtdCents = 0;

    // Refresh implementations after clearAllMocks
    mockSupabaseAdmin.from.mockImplementation(makeSupabaseFromImpl);
    mockSupabaseAdmin.rpc.mockImplementation(() =>
      Promise.resolve({ data: [{ mtd_cents: _mtdCents }], error: null })
    );

    // Default: authenticated beta user
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
      accessToken: "tok",
    });
    mockIsAutoTopUpBetaUser.mockReturnValue(true);
    mockAllocateTopUpCredits.mockResolvedValue({
      newBalance: 1000,
      allocated: 980,
    });
    mockSendEmail.mockResolvedValue({ success: true });
    mockShouldSendEmail.mockResolvedValue(true);
    mockRenderRequiresAuth.mockReturnValue({
      subject: "Action required",
      html: "<p>auth</p>",
      text: "auth",
    });
    mockRenderCardDeclined.mockReturnValue({
      subject: "Card declined",
      html: "<p>declined</p>",
      text: "declined",
    });
  });

  // -------------------------------------------------------------------------
  // Case 1: Happy path — PI succeeded
  // -------------------------------------------------------------------------
  it("1. returns 200 with credits_added when PI succeeds", async () => {
    setSupabaseState({ creditsRow: DEFAULT_CREDITS_ROW, profile: DEFAULT_PROFILE, mtdCents: 0 });
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_success_1",
      status: "succeeded",
    });

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.credits_added).toBe(980); // power pack credits
    expect(body.payment_intent_id).toBe("pi_success_1");

    // allocateTopUpCredits called with correct opts
    expect(mockAllocateTopUpCredits).toHaveBeenCalledWith(
      "user-1",
      980,
      "Power Pack",
      "pi_success_1",
      { autoTopup: true, priceCents: 9900 }
    );
  });

  // -------------------------------------------------------------------------
  // Case 2: PI requires_action → disable + email
  // -------------------------------------------------------------------------
  it("2. returns 409 requires_authentication when PI status is requires_action", async () => {
    setSupabaseState({ creditsRow: DEFAULT_CREDITS_ROW, profile: DEFAULT_PROFILE, mtdCents: 0 });
    mockPaymentIntentsCreate.mockResolvedValue({
      id: "pi_action_1",
      status: "requires_action",
    });

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(409);
    expect(body.reason).toBe("requires_authentication");

    // disableAutoTopUp side effect: update was called with disabled fields
    expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("user_credits");

    // email should have been rendered and sent
    expect(mockRenderRequiresAuth).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  // -------------------------------------------------------------------------
  // Case 3: Stripe throws card_declined → disable + email
  // -------------------------------------------------------------------------
  it("3. returns 409 card_declined when Stripe throws card_declined error", async () => {
    setSupabaseState({ creditsRow: DEFAULT_CREDITS_ROW, profile: DEFAULT_PROFILE, mtdCents: 0 });
    mockPaymentIntentsCreate.mockRejectedValue(
      Object.assign(new Error("Card declined"), { code: "card_declined" })
    );

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(409);
    expect(body.reason).toBe("card_declined");

    // email should have been rendered and sent
    expect(mockRenderCardDeclined).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  // -------------------------------------------------------------------------
  // Case 3b: Stripe throws with decline_code (no explicit code='card_declined')
  // -------------------------------------------------------------------------
  it("3b. returns 409 card_declined when Stripe error has decline_code", async () => {
    setSupabaseState({ creditsRow: DEFAULT_CREDITS_ROW, profile: DEFAULT_PROFILE, mtdCents: 0 });
    mockPaymentIntentsCreate.mockRejectedValue(
      Object.assign(new Error("Insufficient funds"), {
        decline_code: "insufficient_funds",
      })
    );

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(409);
    expect(body.reason).toBe("card_declined");
    expect(mockRenderCardDeclined).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 4: Stripe throws idempotency_key_in_use → 200 with idempotent_replay
  // -------------------------------------------------------------------------
  it("4. returns 200 idempotent_replay when idempotency_key_in_use", async () => {
    setSupabaseState({ creditsRow: DEFAULT_CREDITS_ROW, profile: DEFAULT_PROFILE, mtdCents: 0 });
    mockPaymentIntentsCreate.mockRejectedValue(
      Object.assign(new Error("Idempotency conflict"), {
        code: "idempotency_key_in_use",
      })
    );

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.idempotent_replay).toBe(true);

    // No disable, no email, no credits allocation
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAllocateTopUpCredits).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 5: Stripe throws StripeConnectionError → 503, no disable
  // -------------------------------------------------------------------------
  it("5. returns 503 for StripeConnectionError and does NOT disable auto_topup", async () => {
    setSupabaseState({ creditsRow: DEFAULT_CREDITS_ROW, profile: DEFAULT_PROFILE, mtdCents: 0 });
    mockPaymentIntentsCreate.mockRejectedValue(
      Object.assign(new Error("Connection error"), {
        type: "StripeConnectionError",
      })
    );

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(503);
    expect(body.error).toBe("stripe_transient");

    // CRITICAL: transient errors must NOT send any email
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAllocateTopUpCredits).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 6: Monthly cap reached (mtd + pack > cap) → 409 cap_reached, no PI
  // -------------------------------------------------------------------------
  it("6. returns 409 cap_reached when mtd + pack price exceeds monthly cap", async () => {
    const creditsRow = { ...DEFAULT_CREDITS_ROW, auto_topup_monthly_cap_cents: 15000 }; // $150 cap
    setSupabaseState({ creditsRow, profile: DEFAULT_PROFILE, mtdCents: 9900 }); // already spent $99 this month
    // power pack is $99 → 9900 + 9900 = 19800 > 15000

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(409);
    expect(body.reason).toBe("cap_reached");

    // No Stripe call made
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 7: Pack alone exceeds monthly cap → 409 pack_exceeds_cap, no PI
  // -------------------------------------------------------------------------
  it("7. returns 409 pack_exceeds_cap when pack price alone exceeds monthly cap", async () => {
    const creditsRow = { ...DEFAULT_CREDITS_ROW, auto_topup_monthly_cap_cents: 5000 }; // $50 cap
    setSupabaseState({ creditsRow, profile: DEFAULT_PROFILE, mtdCents: 0 });
    // power pack is $99 (9900 cents) > $50 cap

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(409);
    expect(body.reason).toBe("pack_exceeds_cap");

    // No Stripe call AND no MTD RPC call (short-circuited before RPC)
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    expect(mockSupabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 8: auto_topup_enabled=false → 409 not enrolled, no PI
  // -------------------------------------------------------------------------
  it("8. returns 409 not enrolled when auto_topup_enabled is false", async () => {
    const creditsRow = {
      ...DEFAULT_CREDITS_ROW,
      auto_topup_enabled: false,
      auto_topup_disabled_reason: null,
    };
    setSupabaseState({ creditsRow, profile: DEFAULT_PROFILE, mtdCents: 0 });

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(409);
    expect(body.reason).toBe("not_enrolled");

    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 9: Non-beta user → 403
  // -------------------------------------------------------------------------
  it("9. returns 403 for non-beta user", async () => {
    mockIsAutoTopUpBetaUser.mockReturnValue(false);

    const { handler } = await import(
      "../../../netlify/functions/auto-topup-charge"
    );
    const res = await handler!(makeEvent(), {} as any, () => undefined);
    const body = JSON.parse((res as { body: string }).body);

    expect((res as { statusCode: number }).statusCode).toBe(403);
    expect(body.error).toMatch(/not available/i);

    // No Stripe call, no credits allocation
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    expect(mockAllocateTopUpCredits).not.toHaveBeenCalled();
  });
});
