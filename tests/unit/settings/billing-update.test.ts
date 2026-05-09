import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before any import so vi.mock hoisting works
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.fn();

// Track the exact payload passed to update() so we can assert on it.
const mockUpdateFn = vi.fn();
const mockEqFn = vi.fn();

function makeSupabaseFromImpl(table: string) {
  if (table === "user_credits") {
    return {
      update: (payload: Record<string, unknown>) => {
        mockUpdateFn(payload);
        return {
          eq: mockEqFn.mockResolvedValue({ data: null, error: null }),
        };
      },
    };
  }
  return {};
}

const mockSupabaseAdmin = {
  from: vi.fn().mockImplementation(makeSupabaseFromImpl),
};

vi.mock("../../../netlify/functions/utils/supabase-admin", () => ({
  requireAuth: mockRequireAuth,
  supabaseAdmin: mockSupabaseAdmin,
}));

// stripe is used to mirror the saved PM as customer default — mock the module
// so the test doesn't need STRIPE_SECRET_KEY at load time.
vi.mock("../../../netlify/functions/utils/stripe", () => ({
  stripe: {
    customers: { update: vi.fn().mockResolvedValue({}) },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatchEvent(body: Record<string, unknown> = {}) {
  return {
    httpMethod: "PATCH",
    headers: {},
    body: JSON.stringify(body),
  } as any;
}

function makeGetEvent() {
  return {
    httpMethod: "GET",
    headers: {},
    body: null,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("settings-billing-update handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Refresh mock implementation after clearAllMocks
    mockSupabaseAdmin.from.mockImplementation(makeSupabaseFromImpl);

    // Default: authenticated user (gate removed in Wave 3.2)
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
      accessToken: "tok",
    });
  });

  // -------------------------------------------------------------------------
  // Case 1: Happy path — enable + pack + cap + pm
  // -------------------------------------------------------------------------
  it("1. enables auto-topup with all 4 fields and returns 200 {ok:true}", async () => {
    const { handler } = await import(
      "../../../netlify/functions/settings-billing-update"
    );
    const res = await handler!(
      makePatchEvent({
        auto_topup_enabled: true,
        auto_topup_pack_key: "power",
        auto_topup_monthly_cap_cents: 50000,
        auto_topup_payment_method_id: "pm_test_abc",
      }),
      {} as any,
      () => undefined
    );

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(JSON.parse((res as { body: string }).body)).toEqual({ ok: true });

    // update() should include all 4 fields + disabled_reason cleared to null
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_topup_enabled: true,
        auto_topup_disabled_reason: null,
        auto_topup_pack_key: "power",
        auto_topup_monthly_cap_cents: 50000,
        auto_topup_payment_method_id: "pm_test_abc",
      })
    );
    // eq should be called with user_id
    expect(mockEqFn).toHaveBeenCalledWith("user_id", "user-1");
  });

  // -------------------------------------------------------------------------
  // Case 2: Disable only
  // -------------------------------------------------------------------------
  it("2. disables auto-topup and sets auto_topup_disabled_reason=user_disabled", async () => {
    const { handler } = await import(
      "../../../netlify/functions/settings-billing-update"
    );
    const res = await handler!(
      makePatchEvent({ auto_topup_enabled: false }),
      {} as any,
      () => undefined
    );

    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(JSON.parse((res as { body: string }).body)).toEqual({ ok: true });

    expect(mockUpdateFn).toHaveBeenCalledWith({
      auto_topup_enabled: false,
      auto_topup_disabled_reason: "user_disabled",
    });
    expect(mockEqFn).toHaveBeenCalledWith("user_id", "user-1");
  });

  // -------------------------------------------------------------------------
  // Case 3: Invalid pack_key
  // -------------------------------------------------------------------------
  it("3. returns 400 for invalid auto_topup_pack_key", async () => {
    const { handler } = await import(
      "../../../netlify/functions/settings-billing-update"
    );
    const res = await handler!(
      makePatchEvent({ auto_topup_pack_key: "notarealpack" }),
      {} as any,
      () => undefined
    );

    expect((res as { statusCode: number }).statusCode).toBe(400);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 4: Cap below smallest pack (starter = 900¢)
  // -------------------------------------------------------------------------
  it("4. returns 400 when auto_topup_monthly_cap_cents is below smallest pack price", async () => {
    const { handler } = await import(
      "../../../netlify/functions/settings-billing-update"
    );
    const res = await handler!(
      makePatchEvent({ auto_topup_monthly_cap_cents: 100 }), // < 900
      {} as any,
      () => undefined
    );

    expect((res as { statusCode: number }).statusCode).toBe(400);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 5: No fields provided
  // -------------------------------------------------------------------------
  it("5. returns 400 with 'No fields to update' when body is empty", async () => {
    const { handler } = await import(
      "../../../netlify/functions/settings-billing-update"
    );
    const res = await handler!(
      makePatchEvent({}),
      {} as any,
      () => undefined
    );

    expect((res as { statusCode: number }).statusCode).toBe(400);
    const body = JSON.parse((res as { body: string }).body);
    expect(body.error).toMatch(/no fields to update/i);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 6: Method other than PATCH
  // -------------------------------------------------------------------------
  it("6. returns 405 for GET method", async () => {
    const { handler } = await import(
      "../../../netlify/functions/settings-billing-update"
    );
    const res = await handler!(makeGetEvent(), {} as any, () => undefined);

    expect((res as { statusCode: number }).statusCode).toBe(405);
    expect(mockUpdateFn).not.toHaveBeenCalled();
  });
});
