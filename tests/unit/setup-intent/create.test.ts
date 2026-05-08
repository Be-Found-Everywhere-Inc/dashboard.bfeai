import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Stripe utils + supabase-admin
const mockStripe = {
  setupIntents: { create: vi.fn() },
  customers: { retrieve: vi.fn() },
  paymentMethods: { retrieve: vi.fn() },
};

vi.mock("../../../netlify/functions/utils/stripe", () => ({
  stripe: mockStripe,
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_test_123"),
}));

vi.mock("../../../netlify/functions/utils/supabase-admin", () => ({
  requireAuth: vi
    .fn()
    .mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } }),
  supabaseAdmin: {}, // unused but Wave 2 endpoints sometimes import it
}));

describe("setup-intent-create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe.setupIntents.create.mockResolvedValue({
      client_secret: "seti_secret_abc",
    });
  });

  it("creates SetupIntent with off_session and returns client_secret + existing_pm=null when customer has no default PM", async () => {
    mockStripe.customers.retrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: null },
    });
    const { handler } = await import(
      "../../../netlify/functions/setup-intent-create"
    );
    const res = await handler!(
      { httpMethod: "POST", headers: {}, body: "{}" } as any,
      {} as any,
      () => undefined,
    );
    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(
      JSON.parse((res as { body: string }).body),
    ).toEqual({
      client_secret: "seti_secret_abc",
      existing_pm: null,
    });
    expect(mockStripe.setupIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ usage: "off_session", customer: "cus_test_123" }),
    );
  });

  it("returns existing_pm when default PM is non-expired", async () => {
    mockStripe.customers.retrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_test_xyz" },
    });
    mockStripe.paymentMethods.retrieve.mockResolvedValue({
      id: "pm_test_xyz",
      card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2099 },
    });
    const { handler } = await import(
      "../../../netlify/functions/setup-intent-create"
    );
    const res = await handler!(
      { httpMethod: "POST", headers: {}, body: "{}" } as any,
      {} as any,
      () => undefined,
    );
    expect(
      JSON.parse((res as { body: string }).body).existing_pm,
    ).toEqual({ last4: "4242", brand: "visa" });
  });

  it("returns existing_pm=null when default PM is expired", async () => {
    mockStripe.customers.retrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_test_xyz" },
    });
    mockStripe.paymentMethods.retrieve.mockResolvedValue({
      id: "pm_test_xyz",
      card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2020 },
    });
    const { handler } = await import(
      "../../../netlify/functions/setup-intent-create"
    );
    const res = await handler!(
      { httpMethod: "POST", headers: {}, body: "{}" } as any,
      {} as any,
      () => undefined,
    );
    expect(
      JSON.parse((res as { body: string }).body).existing_pm,
    ).toBeNull();
  });

  it("returns existing_pm=null when paymentMethods.retrieve throws (detached PM)", async () => {
    mockStripe.customers.retrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: "pm_test_xyz" },
    });
    mockStripe.paymentMethods.retrieve.mockRejectedValue(
      Object.assign(new Error("No such pm"), { statusCode: 404 }),
    );
    const { handler } = await import(
      "../../../netlify/functions/setup-intent-create"
    );
    const res = await handler!(
      { httpMethod: "POST", headers: {}, body: "{}" } as any,
      {} as any,
      () => undefined,
    );
    expect(
      JSON.parse((res as { body: string }).body).existing_pm,
    ).toBeNull();
  });
});
