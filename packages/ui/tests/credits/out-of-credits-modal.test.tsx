import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { CreditsProvider, OutOfCreditsModal, useCredits } from "../../src";
import { TOPUP_PACKS } from "../../src/lib/topup-packs";

function OpenModalOnMount({ ctx }: { ctx: { operation: string; required: number; balance: number } }) {
  const { openOutOfCreditsModal } = useCredits();
  useEffect(() => {
    openOutOfCreditsModal(ctx);
  }, [ctx, openOutOfCreditsModal]);
  return null;
}

function renderModal(onPurchase: (pack: { key: string }) => void | Promise<void>) {
  return render(
    <CreditsProvider>
      <OpenModalOnMount ctx={{ operation: "create_report", required: 50, balance: 8 }} />
      <OutOfCreditsModal manageCreditsUrl="https://dashboard.bfeai.com/credits" onPurchase={onPurchase} />
    </CreditsProvider>
  );
}

describe("<OutOfCreditsModal>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all packs with name", async () => {
    renderModal(vi.fn());
    await waitFor(() => {
      expect(screen.getByText(/Out of credits/i)).toBeInTheDocument();
    });
    for (const pack of TOPUP_PACKS) {
      expect(screen.getByText(pack.name)).toBeInTheDocument();
    }
  });

  it("shows operation, required, and balance in description", async () => {
    renderModal(vi.fn());
    await waitFor(() => {
      expect(screen.getByText(/Need 50 credits for create_report/i)).toBeInTheDocument();
      expect(screen.getByText(/You have 8/i)).toBeInTheDocument();
    });
  });

  it("calls onPurchase with the picked pack", async () => {
    const onPurchase = vi.fn().mockResolvedValue(undefined);
    renderModal(onPurchase);
    await waitFor(() => screen.getByText(TOPUP_PACKS[0].name));
    fireEvent.click(screen.getByText(TOPUP_PACKS[0].name));
    await waitFor(() => {
      expect(onPurchase).toHaveBeenCalledWith(expect.objectContaining({ key: TOPUP_PACKS[0].key }));
    });
  });

  it("renders error state when onPurchase rejects", async () => {
    const onPurchase = vi.fn().mockRejectedValue(new Error("Stripe down"));
    renderModal(onPurchase);
    await waitFor(() => screen.getByText(TOPUP_PACKS[0].name));
    fireEvent.click(screen.getByText(TOPUP_PACKS[0].name));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Stripe down/);
    });
  });

  it("disables all packs while one purchase is pending", async () => {
    // Make onPurchase hang so we can observe the pending state
    let resolve: () => void = () => {};
    const onPurchase = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolve = r; }));
    renderModal(onPurchase);
    await waitFor(() => screen.getByText(TOPUP_PACKS[0].name));

    fireEvent.click(screen.getByText(TOPUP_PACKS[0].name));

    // While pending, clicking another pack should not call onPurchase again
    await waitFor(() => {
      expect(screen.getByText(/Redirecting to checkout/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(TOPUP_PACKS[1].name));
    expect(onPurchase).toHaveBeenCalledTimes(1); // still 1, not 2

    resolve();
  });

  it("clears pending state on successful resolution", async () => {
    const onPurchase = vi.fn().mockResolvedValue(undefined);
    renderModal(onPurchase);
    await waitFor(() => screen.getByText(TOPUP_PACKS[0].name));

    fireEvent.click(screen.getByText(TOPUP_PACKS[0].name));
    await waitFor(() => {
      expect(onPurchase).toHaveBeenCalledTimes(1);
    });

    // After success, pending state should be cleared (no "Redirecting" text)
    await waitFor(() => {
      expect(screen.queryByText(/Redirecting to checkout/i)).not.toBeInTheDocument();
    });
  });
});
