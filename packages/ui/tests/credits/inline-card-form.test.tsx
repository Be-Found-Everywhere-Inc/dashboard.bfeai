import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Use vi.hoisted() so these values are initialised before the vi.mock() calls
// (vi.mock factories are hoisted to the top of the file by vitest)
// ---------------------------------------------------------------------------
const { mockConfirmCardSetup, mockStripeInstance, mockGetElement, mockUseStripe, mockUseElements } =
  vi.hoisted(() => {
    const mockConfirmCardSetup = vi.fn();
    const mockStripeInstance = { confirmCardSetup: mockConfirmCardSetup };
    const mockGetElement = vi.fn();
    const mockUseStripe = vi.fn();
    const mockUseElements = vi.fn();
    return { mockConfirmCardSetup, mockStripeInstance, mockGetElement, mockUseStripe, mockUseElements };
  });

// ---------------------------------------------------------------------------
// Mock @stripe/stripe-js
// ---------------------------------------------------------------------------
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn().mockResolvedValue(mockStripeInstance),
}));

// ---------------------------------------------------------------------------
// Mock @stripe/react-stripe-js
// Elements wrapper passes through children; hooks return mock values.
// CardElement renders a labelled placeholder so we can assert it's present.
// ---------------------------------------------------------------------------
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => mockUseStripe(),
  useElements: () => mockUseElements(),
}));

// Import AFTER mocks are registered
import { InlineCardForm } from "../../src/credits/InlineCardForm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FAKE_CLIENT_SECRET = "seti_test_secret_abc123";
const FAKE_KEY = "pk_test_dummy";
const EXISTING_PM = { last4: "4242", brand: "Visa" };

function renderForm(
  props: Partial<React.ComponentProps<typeof InlineCardForm>> = {},
) {
  const defaults = {
    clientSecret: FAKE_CLIENT_SECRET,
    publishableKey: FAKE_KEY,
    existingPm: null,
    onSuccess: vi.fn(),
    onCancel: undefined,
  };
  return render(<InlineCardForm {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("<InlineCardForm>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: stripe loaded, elements available with a mock card element
    mockGetElement.mockReturnValue({ _card: true });
    mockUseStripe.mockReturnValue({
      confirmCardSetup: mockConfirmCardSetup,
    });
    mockUseElements.mockReturnValue({
      getElement: mockGetElement,
    });
  });

  // -------------------------------------------------------------------------
  // 1. With existingPm, mode="existing" shows "card on file" text
  // -------------------------------------------------------------------------
  it('renders "Use card on file" when existingPm provided', () => {
    renderForm({ existingPm: EXISTING_PM });
    expect(screen.getByText(/Use card on file/i)).toBeInTheDocument();
    expect(screen.getByText(/Visa/i)).toBeInTheDocument();
    expect(screen.getByText(/4242/)).toBeInTheDocument();
    // In "existing" mode, CardElement should NOT be visible
    expect(screen.queryByTestId("card-element")).not.toBeInTheDocument();
  });

  it('shows "Use a different card" link when existingPm provided', () => {
    renderForm({ existingPm: EXISTING_PM });
    expect(screen.getByRole("button", { name: /Use a different card/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Clicking "Use a different card" switches to CardElement
  // -------------------------------------------------------------------------
  it("switches to CardElement when 'Use a different card' is clicked", async () => {
    renderForm({ existingPm: EXISTING_PM });
    const switchBtn = screen.getByRole("button", { name: /Use a different card/i });
    fireEvent.click(switchBtn);
    await waitFor(() => {
      expect(screen.getByTestId("card-element")).toBeInTheDocument();
    });
    // "card on file" text should be gone
    expect(screen.queryByText(/Use card on file/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Without existingPm, CardElement is rendered directly
  // -------------------------------------------------------------------------
  it("renders CardElement directly when no existingPm", () => {
    renderForm({ existingPm: null });
    expect(screen.getByTestId("card-element")).toBeInTheDocument();
    expect(screen.queryByText(/Use card on file/i)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Submit success path → onSuccess called with PM ID (string)
  // -------------------------------------------------------------------------
  it("calls onSuccess with payment method ID on successful setupIntent", async () => {
    const onSuccess = vi.fn();
    mockConfirmCardSetup.mockResolvedValue({
      setupIntent: { payment_method: "pm_test_abc123" },
      error: undefined,
    });

    renderForm({ existingPm: null, onSuccess });

    fireEvent.click(screen.getByRole("button", { name: /Save card/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("pm_test_abc123");
    });
  });

  it("calls onSuccess with PM ID when payment_method is an object", async () => {
    const onSuccess = vi.fn();
    mockConfirmCardSetup.mockResolvedValue({
      setupIntent: { payment_method: { id: "pm_test_obj_id", object: "payment_method" } },
      error: undefined,
    });

    renderForm({ existingPm: null, onSuccess });

    fireEvent.click(screen.getByRole("button", { name: /Save card/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("pm_test_obj_id");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Submit error path → error message in role="alert"
  // -------------------------------------------------------------------------
  it("shows error message via role=alert on stripe error", async () => {
    mockConfirmCardSetup.mockResolvedValue({
      error: { message: "Your card was declined." },
      setupIntent: undefined,
    });

    renderForm({ existingPm: null });
    fireEvent.click(screen.getByRole("button", { name: /Save card/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Your card was declined/i);
    });
  });

  it("shows fallback 'Card error' when stripe error has no message", async () => {
    mockConfirmCardSetup.mockResolvedValue({
      error: {},
      setupIntent: undefined,
    });

    renderForm({ existingPm: null });
    fireEvent.click(screen.getByRole("button", { name: /Save card/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Card error/i);
    });
  });

  // -------------------------------------------------------------------------
  // Cancel button
  // -------------------------------------------------------------------------
  it("renders Cancel button when onCancel prop provided", () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("does not render Cancel button when onCancel not provided", () => {
    renderForm({ onCancel: undefined });
    expect(screen.queryByRole("button", { name: /Cancel/i })).not.toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Save button disabled while stripe not loaded
  // -------------------------------------------------------------------------
  it("disables Save card button when stripe is not yet loaded", () => {
    mockUseStripe.mockReturnValue(null);
    renderForm({ existingPm: null });
    expect(screen.getByRole("button", { name: /Save card/i })).toBeDisabled();
  });
});
