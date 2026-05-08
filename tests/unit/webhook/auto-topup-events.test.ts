import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks — declared before any import so vi.mock hoisting works
// ---------------------------------------------------------------------------

// stripe utils: stub out webhook event construction + idempotency
const mockConstructWebhookEvent = vi.fn();
const mockIsEventProcessed = vi.fn();
const mockMarkEventProcessed = vi.fn();

vi.mock("../../../netlify/functions/utils/stripe", () => ({
  constructWebhookEvent: mockConstructWebhookEvent,
  isEventProcessed: mockIsEventProcessed,
  markEventProcessed: mockMarkEventProcessed,
  syncAppSubscription: vi.fn(),
  getUserIdFromStripeCustomer: vi.fn(),
  applyBundleDiscountIfEligible: vi.fn(),
  removeBundleDiscountIfIneligible: vi.fn(),
  updateUserTier: vi.fn(),
  provisionDualTrialSubscriptions: vi.fn(),
  stripe: { subscriptions: { cancel: vi.fn() } },
}));

// credits
const mockAllocateTopUpCredits = vi.fn();
const mockGetBalance = vi.fn();

vi.mock("../../../netlify/functions/utils/credits", () => ({
  allocateSubscriptionCredits: vi.fn(),
  allocateTopUpCredits: mockAllocateTopUpCredits,
  allocateTrialCredits: vi.fn(),
  expireTrialCredits: vi.fn(),
  mergeTrialCredits: vi.fn(),
  recalculateSubscriptionCap: vi.fn(),
  getBalance: mockGetBalance,
}));

// supabase admin
const mockFromImpl: Record<string, unknown> = {};
let _profileData: Record<string, unknown> | null = null;
let _txnData: Record<string, unknown> | null = null;

const mockUpdateFn = vi.fn();
const mockInsertFn = vi.fn();
const mockMaybeSingleFn = vi.fn();
const mockSingleFn = vi.fn();

function makeFromImpl(table: string) {
  if (table === "user_credits") {
    return {
      update: (payload: unknown) => {
        mockUpdateFn(payload);
        return {
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      },
    };
  }
  if (table === "profiles") {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingleFn.mockResolvedValue({
            data: _profileData,
            error: null,
          }),
        }),
      }),
    };
  }
  if (table === "credit_transactions") {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingleFn.mockResolvedValue({
              data: _txnData,
              error: null,
            }),
          }),
        }),
      }),
      insert: mockInsertFn.mockResolvedValue({ data: null, error: null }),
    };
  }
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

const mockSupabaseAdmin = {
  from: vi.fn().mockImplementation(makeFromImpl),
};

vi.mock("../../../netlify/functions/utils/supabase-admin", () => ({
  requireAuth: vi.fn(),
  supabaseAdmin: mockSupabaseAdmin,
}));

// email
const mockSendEmail = vi.fn();
const mockShouldSendEmail = vi.fn();
const mockRenderRequiresAuth = vi.fn();
const mockRenderRefundProcessed = vi.fn();

vi.mock("../../../netlify/functions/utils/email", () => ({
  sendEmail: mockSendEmail,
  sendTrialReminderEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
}));

vi.mock("../../../netlify/functions/utils/email-throttle", () => ({
  shouldSendEmail: mockShouldSendEmail,
}));

vi.mock("../../../netlify/functions/utils/email-templates", () => ({
  renderAutoTopUpRequiresAuthEmail: mockRenderRequiresAuth,
  renderAutoTopUpRefundProcessedEmail: mockRenderRefundProcessed,
  buildTrialReminderHtml: vi.fn(),
  buildTrialReminderText: vi.fn(),
  buildWelcomeEmailHtml: vi.fn(),
  buildWelcomeEmailText: vi.fn(),
}));

// plans — keep the real TOPUP_PACKS so keys resolve correctly
vi.mock("../../../config/plans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../config/plans")>();
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhookEvent(body: Record<string, unknown>) {
  return {
    httpMethod: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: JSON.stringify(body),
  } as any;
}

function makeStripeEvent(
  type: string,
  object: Record<string, unknown>
): Stripe.Event {
  return {
    id: `evt_${type.replace(/\./g, "_")}`,
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

function makePaymentIntent(
  overrides: Partial<Stripe.PaymentIntent> = {}
): Stripe.PaymentIntent {
  return {
    id: "pi_test_1",
    object: "payment_intent",
    status: "succeeded",
    metadata: {
      type: "auto_topup",
      user_id: "user-abc",
      pack_key: "power",
    },
    ...overrides,
  } as unknown as Stripe.PaymentIntent;
}

function makeCharge(overrides: Partial<Stripe.Charge> = {}): Stripe.Charge {
  return {
    id: "ch_test_1",
    object: "charge",
    amount: 9900,
    amount_captured: 9900,
    amount_refunded: 9900,
    payment_intent: "pi_test_1",
    ...overrides,
  } as unknown as Stripe.Charge;
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  _profileData = { email: "user@example.com", first_name: "Alice" };
  _txnData = null;

  // Refresh from impls after clearAllMocks
  mockSupabaseAdmin.from.mockImplementation(makeFromImpl);
  mockSingleFn.mockResolvedValue({ data: _profileData, error: null });
  mockMaybeSingleFn.mockResolvedValue({ data: _txnData, error: null });

  // Default: event not yet processed
  mockIsEventProcessed.mockResolvedValue(false);
  mockMarkEventProcessed.mockResolvedValue(undefined);

  // Default credit mocks
  mockAllocateTopUpCredits.mockResolvedValue({ newBalance: 1000, allocated: 980 });
  mockGetBalance.mockResolvedValue({
    subscriptionBalance: 0,
    topupBalance: 980,
    trialBalance: 0,
    total: 980,
    cap: 900,
    lifetimeEarned: 980,
    lifetimeSpent: 0,
    lastSkippedScanAt: null,
    lastSkippedScanDismissedAt: null,
    autoTopup: {
      enabled: true,
      packKey: "power",
      capCents: 50000,
      mtdSpentCents: 0,
      lastChargeAt: null,
      paymentMethodLast4: null,
      disabledReason: null,
    },
  });

  // Default email mocks
  mockShouldSendEmail.mockResolvedValue(true);
  mockSendEmail.mockResolvedValue({ success: true });
  mockRenderRequiresAuth.mockReturnValue({
    subject: "Action required",
    html: "<p>auth</p>",
    text: "auth",
  });
  mockRenderRefundProcessed.mockReturnValue({
    subject: "[BFEAI admin] Refund processed",
    html: "<p>refund</p>",
    text: "refund",
  });
});

// ---------------------------------------------------------------------------
// payment_intent.succeeded
// ---------------------------------------------------------------------------

describe("payment_intent.succeeded handler", () => {
  it("is a no-op when metadata.type !== auto_topup", async () => {
    const pi = makePaymentIntent({
      metadata: { type: "something_else" },
    });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.succeeded", pi as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    const res = await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(mockAllocateTopUpCredits).not.toHaveBeenCalled();
  });

  it("allocates credits with autoTopup=true and priceCents for valid auto_topup PI", async () => {
    const pi = makePaymentIntent();
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.succeeded", pi as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect(mockAllocateTopUpCredits).toHaveBeenCalledWith(
      "user-abc",
      980,
      "Power Pack",
      "pi_test_1",
      { autoTopup: true, priceCents: 9900 }
    );
  });

  it("logs warn and skips allocation when user_id is missing", async () => {
    const pi = makePaymentIntent({
      metadata: { type: "auto_topup", pack_key: "power" }, // no user_id
    });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.succeeded", pi as unknown as Record<string, unknown>)
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    const res = await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(mockAllocateTopUpCredits).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("auto_topup PI missing metadata"),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it("logs warn and skips allocation for unknown pack_key", async () => {
    const pi = makePaymentIntent({
      metadata: { type: "auto_topup", user_id: "user-abc", pack_key: "nonexistent_pack" },
    });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.succeeded", pi as unknown as Record<string, unknown>)
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    const res = await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(mockAllocateTopUpCredits).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// payment_intent.requires_action
// ---------------------------------------------------------------------------

describe("payment_intent.requires_action handler", () => {
  it("is a no-op when metadata.type !== auto_topup", async () => {
    const pi = makePaymentIntent({
      status: "requires_action",
      metadata: { type: "something_else" },
    });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.requires_action", pi as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect(mockUpdateFn).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("disables auto_topup and sends auth email for auto_topup PI", async () => {
    const pi = makePaymentIntent({ status: "requires_action" });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.requires_action", pi as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    // user_credits update called with disabled fields
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_topup_enabled: false,
        auto_topup_disabled_reason: "requires_authentication",
      })
    );

    // email rendered and sent
    expect(mockRenderRequiresAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        packName: "Power Pack",
        packPriceCents: 9900,
      })
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" })
    );
  });

  it("disables auto_topup but skips email when throttled", async () => {
    mockShouldSendEmail.mockResolvedValue(false);

    const pi = makePaymentIntent({ status: "requires_action" });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.requires_action", pi as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect(mockUpdateFn).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips email when profile has no email", async () => {
    _profileData = { email: null, first_name: "Bob" };
    mockSingleFn.mockResolvedValue({ data: _profileData, error: null });
    mockSupabaseAdmin.from.mockImplementation(makeFromImpl);

    const pi = makePaymentIntent({ status: "requires_action" });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.requires_action", pi as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("logs warn and skips when user_id is missing", async () => {
    const pi = makePaymentIntent({
      status: "requires_action",
      metadata: { type: "auto_topup" }, // no user_id
    });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("payment_intent.requires_action", pi as unknown as Record<string, unknown>)
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    const res = await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(mockUpdateFn).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("requires_action PI missing user_id"),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// charge.refunded
// ---------------------------------------------------------------------------

describe("charge.refunded handler", () => {
  it("does full clawback for full refund with matching topup_purchase", async () => {
    _txnData = { user_id: "user-abc", amount: 980, app_key: null };
    mockMaybeSingleFn.mockResolvedValue({ data: _txnData, error: null });
    mockSupabaseAdmin.from.mockImplementation(makeFromImpl);

    process.env.ADMIN_EMAIL = "admin@bfeai.com";

    const charge = makeCharge(); // full refund (amount_refunded === amount_captured)
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("charge.refunded", charge as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    // topup_balance decremented
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ topup_balance: 0 }) // 980 - 980 = 0
    );

    // refund_clawback inserted
    expect(mockInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "refund_clawback",
        amount: -980,
        user_id: "user-abc",
        reference_id: "refund_ch_test_1",
      })
    );

    // admin email sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin@bfeai.com" })
    );
    expect(mockRenderRefundProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        chargeId: "ch_test_1",
        userId: "user-abc",
        creditsClawedBack: 980,
      })
    );

    delete process.env.ADMIN_EMAIL;
  });

  it("routes partial refund to admin only — no balance change", async () => {
    process.env.ADMIN_EMAIL = "admin@bfeai.com";

    const charge = makeCharge({
      amount_captured: 9900,
      amount_refunded: 4950, // partial
    });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("charge.refunded", charge as unknown as Record<string, unknown>)
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect(mockUpdateFn).not.toHaveBeenCalled();
    expect(mockInsertFn).not.toHaveBeenCalled();
    expect(mockGetBalance).not.toHaveBeenCalled();

    // Admin email sent with the partial-refund subject
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@bfeai.com",
        subject: expect.stringContaining("Partial refund"),
      })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Partial refund")
    );

    warnSpy.mockRestore();
    delete process.env.ADMIN_EMAIL;
  });

  it("logs warn and skips clawback when no matching topup_purchase found", async () => {
    _txnData = null;
    mockMaybeSingleFn.mockResolvedValue({ data: null, error: null });
    mockSupabaseAdmin.from.mockImplementation(makeFromImpl);

    const charge = makeCharge();
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("charge.refunded", charge as unknown as Record<string, unknown>)
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    const res = await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(mockUpdateFn).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("No matching topup_purchase")
    );

    warnSpy.mockRestore();
  });

  it("logs warn and skips clawback when charge has no payment_intent", async () => {
    const charge = makeCharge({ payment_intent: null });
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("charge.refunded", charge as unknown as Record<string, unknown>)
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    const res = await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no payment_intent")
    );

    warnSpy.mockRestore();
  });

  it("skips admin email when ADMIN_EMAIL is not set", async () => {
    delete process.env.ADMIN_EMAIL;

    _txnData = { user_id: "user-abc", amount: 980, app_key: null };
    mockMaybeSingleFn.mockResolvedValue({ data: _txnData, error: null });
    mockSupabaseAdmin.from.mockImplementation(makeFromImpl);

    const charge = makeCharge();
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("charge.refunded", charge as unknown as Record<string, unknown>)
    );

    const { handler } = await import(
      "../../../netlify/functions/stripe-webhook"
    );
    await handler!(makeWebhookEvent({}), {} as any, () => undefined);

    // Clawback still happens
    expect(mockUpdateFn).toHaveBeenCalled();
    // But no email
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
