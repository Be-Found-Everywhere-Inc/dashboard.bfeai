/**
 * Tests for AutoTopUpSection and AutoTopUpDisabledBox.
 *
 * These components live in app/(dashboard)/credits/components/ in the
 * dashboard app. We test them here because this vitest config already has
 * jsdom + @testing-library/react set up.
 *
 * Note: Tests involving InlineCardForm (Stripe.js SetupIntent flow) are
 * skipped here — Stripe.js requires a browser Fetch API that jsdom doesn't
 * provide, and the card form interaction is already covered in
 * inline-card-form.test.tsx. Those paths are deferred to E2E (§M).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mock InlineCardForm so we don't pull in Stripe.js.
// The alias in vitest.config.ts maps @bfeai/ui → src/index.ts, which
// re-exports InlineCardForm from src/credits/InlineCardForm.tsx.
// We mock that module directly so the mock applies everywhere.
// ---------------------------------------------------------------------------
vi.mock("../../src/credits/InlineCardForm", () => ({
  InlineCardForm: ({ onCancel }: { onSuccess: (id: string) => void; onCancel?: () => void }) => (
    <div data-testid="inline-card-form">
      <button type="button" onClick={onCancel}>
        Cancel card form
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock Stripe SDKs (required even with InlineCardForm mocked, since the
// barrel re-exports from modules that may import stripe types at parse time)
// ---------------------------------------------------------------------------
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn().mockResolvedValue(null) }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: vi.fn().mockReturnValue(null),
  useElements: vi.fn().mockReturnValue(null),
}));

// Import AFTER mocks are in place — use relative paths to avoid @/ alias
import { AutoTopUpSection } from "../../../../app/(dashboard)/credits/components/AutoTopUpSection";
import { AutoTopUpDisabledBox } from "../../../../app/(dashboard)/credits/components/AutoTopUpDisabledBox";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const enabledAutoTopup = {
  enabled: true,
  packKey: "power",
  capCents: 20000,
  mtdSpentCents: 4500,
  lastChargeAt: "2026-03-12T10:00:00Z",
  paymentMethodLast4: "4242",
  disabledReason: null,
};

const disabledAutoTopup = {
  enabled: false,
  packKey: "power",
  capCents: 20000,
  mtdSpentCents: 0,
  lastChargeAt: null,
  paymentMethodLast4: "4242",
  disabledReason: null,
};

function makeProps(overrides: Partial<typeof enabledAutoTopup> = {}) {
  return {
    autoTopup: { ...enabledAutoTopup, ...overrides },
    stripePublishableKey: "pk_test_fake",
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onRequestSetupIntent: vi.fn().mockResolvedValue({
      client_secret: "seti_secret_fake",
      existing_pm: null,
    }),
  };
}

// ---------------------------------------------------------------------------
// AutoTopUpSection tests
// ---------------------------------------------------------------------------

describe("<AutoTopUpSection>", () => {
  beforeEach(() => vi.clearAllMocks());

  // -------------------------------------------------------------------------
  // 1. Renders toggle in ON state when autoTopup.enabled === true
  // -------------------------------------------------------------------------
  it("renders toggle in ON state (aria-checked=true) when autoTopup.enabled is true", () => {
    const props = makeProps({ enabled: true });
    render(<AutoTopUpSection {...props} />);

    const toggle = screen.getByRole("switch", { name: /disable auto top-up/i });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  // -------------------------------------------------------------------------
  // 2. Renders toggle in OFF state when autoTopup.enabled === false
  // -------------------------------------------------------------------------
  it("renders toggle in OFF state (aria-checked=false) when autoTopup.enabled is false", () => {
    const props = makeProps({ enabled: false });
    render(<AutoTopUpSection {...props} />);

    const toggle = screen.getByRole("switch", { name: /enable auto top-up/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  // -------------------------------------------------------------------------
  // 3. Toggle OFF — immediate onUpdate({auto_topup_enabled: false}), no card form
  // -------------------------------------------------------------------------
  it("calls onUpdate with {auto_topup_enabled: false} when toggling OFF", async () => {
    const props = makeProps({ enabled: true });
    render(<AutoTopUpSection {...props} />);

    const toggle = screen.getByRole("switch");
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(props.onUpdate).toHaveBeenCalledWith({ auto_topup_enabled: false });
    });

    // Card form should NOT appear
    expect(screen.queryByTestId("inline-card-form")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Toggle ON — calls onRequestSetupIntent (card form required before save)
  // -------------------------------------------------------------------------
  it("calls onRequestSetupIntent when toggling ON, then shows card form", async () => {
    const props = makeProps({ enabled: false });
    render(<AutoTopUpSection {...props} />);

    const toggle = screen.getByRole("switch");
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(props.onRequestSetupIntent).toHaveBeenCalledTimes(1);
    });

    // Card form visible
    expect(screen.getByTestId("inline-card-form")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 5. Toggle ON → user cancels card form → toggle stays OFF
  // -------------------------------------------------------------------------
  it("toggle stays OFF when user cancels the card form", async () => {
    const props = makeProps({ enabled: false });
    render(<AutoTopUpSection {...props} />);

    const toggle = screen.getByRole("switch");
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => screen.getByTestId("inline-card-form"));

    // Click cancel
    fireEvent.click(screen.getByText(/Cancel card form/i));

    // Card form gone
    expect(screen.queryByTestId("inline-card-form")).not.toBeInTheDocument();

    // Toggle is now back to OFF state — onUpdate was NOT called
    expect(props.onUpdate).not.toHaveBeenCalled();

    // aria-checked should be false
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  // -------------------------------------------------------------------------
  // 6. Cap input: debounced 500ms onUpdate (test via fake timers)
  // -------------------------------------------------------------------------
  it("cap input change triggers debounced onUpdate after 500ms", async () => {
    vi.useFakeTimers();
    const props = makeProps({ enabled: true });
    render(<AutoTopUpSection {...props} />);

    const capInput = screen.getByLabelText(/Monthly spend cap in dollars/i);

    fireEvent.change(capInput, { target: { value: "300" } });
    expect(props.onUpdate).not.toHaveBeenCalled(); // not yet

    // Advance 499ms — still not called
    act(() => { vi.advanceTimersByTime(499); });
    expect(props.onUpdate).not.toHaveBeenCalled();

    // Advance 1ms more (total 500ms)
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(props.onUpdate).toHaveBeenCalledWith({ auto_topup_monthly_cap_cents: 30000 });
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 7. Cap input: value below smallest pack ($9 = 900¢) does NOT save
  // -------------------------------------------------------------------------
  it("cap input value below smallest pack price does NOT call onUpdate", async () => {
    vi.useFakeTimers();
    const props = makeProps({ enabled: true });
    render(<AutoTopUpSection {...props} />);

    const capInput = screen.getByLabelText(/Monthly spend cap in dollars/i);
    fireEvent.change(capInput, { target: { value: "5" } }); // $5 < $9 min

    await act(async () => { vi.advanceTimersByTime(600); });

    expect(props.onUpdate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 8. Pack selector change (while enabled) calls onUpdate
  // -------------------------------------------------------------------------
  it("pack selector change calls onUpdate with new pack key when enabled", async () => {
    const props = makeProps({ enabled: true, packKey: "power" });
    render(<AutoTopUpSection {...props} />);

    const select = screen.getByLabelText(/When you run out of credits/i);
    await act(async () => {
      fireEvent.change(select, { target: { value: "builder" } });
    });

    await waitFor(() => {
      expect(props.onUpdate).toHaveBeenCalledWith({ auto_topup_pack_key: "builder" });
    });
  });

  // -------------------------------------------------------------------------
  // 9. Pack selector is disabled when auto-topup is OFF
  // -------------------------------------------------------------------------
  it("pack selector is disabled when auto-topup is not enabled", () => {
    const props = makeProps({ enabled: false });
    render(<AutoTopUpSection {...props} />);

    const select = screen.getByLabelText(/When you run out of credits/i);
    expect(select).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// AutoTopUpDisabledBox tests
// ---------------------------------------------------------------------------

describe("<AutoTopUpDisabledBox>", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeDisabledProps(reason: string | null, overrides: Partial<typeof disabledAutoTopup> = {}) {
    return {
      autoTopup: { ...disabledAutoTopup, disabledReason: reason, ...overrides },
      stripePublishableKey: "pk_test_fake",
      onUpdate: vi.fn().mockResolvedValue(undefined),
      onRequestSetupIntent: vi.fn().mockResolvedValue({
        client_secret: "seti_secret_fake",
        existing_pm: null,
      }),
    };
  }

  // -------------------------------------------------------------------------
  // 10. Shows correct copy for card_declined
  // -------------------------------------------------------------------------
  it("shows 'Your card was declined' for card_declined reason", () => {
    const props = makeDisabledProps("card_declined");
    render(<AutoTopUpDisabledBox {...props} />);

    expect(screen.getByText(/Auto top-up is currently disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Your card was declined/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 11. Shows correct copy for each known reason
  // -------------------------------------------------------------------------
  it.each([
    ["card_declined", /Your card was declined/i],
    ["requires_authentication", /Your card needs verification/i],
    ["pack_archived", /Your selected pack is no longer available/i],
    ["no_payment_method", /No payment method on file/i],
    ["customer_deleted", /Stripe customer record was deleted/i],
  ])("shows correct copy for reason=%s", (reason, pattern) => {
    const props = makeDisabledProps(reason);
    render(<AutoTopUpDisabledBox {...props} />);
    expect(screen.getByText(pattern)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 12. Renders NOTHING for user_disabled reason
  // -------------------------------------------------------------------------
  it("renders nothing when disabledReason is 'user_disabled'", () => {
    const props = makeDisabledProps("user_disabled");
    const { container } = render(<AutoTopUpDisabledBox {...props} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 13. Renders nothing when disabledReason is null
  // -------------------------------------------------------------------------
  it("renders nothing when disabledReason is null", () => {
    const props = makeDisabledProps(null);
    const { container } = render(<AutoTopUpDisabledBox {...props} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 14. "Update card" click → calls onRequestSetupIntent → shows card form
  // -------------------------------------------------------------------------
  it("clicking 'Update card' calls onRequestSetupIntent and shows card form", async () => {
    const props = makeDisabledProps("card_declined");
    render(<AutoTopUpDisabledBox {...props} />);

    const btn = screen.getByRole("button", { name: /Update card/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(props.onRequestSetupIntent).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("inline-card-form")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 15. "Disable auto top-up" calls onUpdate with {auto_topup_enabled: false}
  // -------------------------------------------------------------------------
  it("clicking 'Disable auto top-up' calls onUpdate with {auto_topup_enabled: false}", async () => {
    const props = makeDisabledProps("card_declined");
    render(<AutoTopUpDisabledBox {...props} />);

    const btn = screen.getByRole("button", { name: /Disable auto top-up/i });
    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(props.onUpdate).toHaveBeenCalledWith({ auto_topup_enabled: false });
    });
  });
});
