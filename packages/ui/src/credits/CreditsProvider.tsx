"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface OutOfCreditsContext {
  operation: string;
  required: number;
  balance: number;
}

export type AutoTopUpState = {
  enabled: boolean;
  packKey: string | null;
  capCents: number;
  mtdSpentCents: number;
  lastChargeAt: string | null;
  paymentMethodLast4: string | null;
  disabledReason: string | null;
};

interface CreditsContextValue {
  isOpen: boolean;
  context: OutOfCreditsContext | null;
  /** Auto top-up configuration sourced from the consumer app (never fetched internally). */
  autoTopup: AutoTopUpState | null;
  openOutOfCreditsModal: (ctx: OutOfCreditsContext) => void;
  closeOutOfCreditsModal: () => void;
}

const Ctx = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({
  children,
  autoTopup,
}: {
  children: ReactNode;
  /** Auto top-up state fetched by the consumer app and threaded in here. */
  autoTopup?: AutoTopUpState | null;
}) {
  const [context, setContext] = useState<OutOfCreditsContext | null>(null);

  const openOutOfCreditsModal = useCallback((ctx: OutOfCreditsContext) => {
    setContext(ctx);
  }, []);

  const closeOutOfCreditsModal = useCallback(() => {
    setContext(null);
  }, []);

  const value = useMemo<CreditsContextValue>(
    () => ({
      isOpen: context !== null,
      context,
      autoTopup: autoTopup ?? null,
      openOutOfCreditsModal,
      closeOutOfCreditsModal,
    }),
    [context, autoTopup, openOutOfCreditsModal, closeOutOfCreditsModal]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCredits(): CreditsContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useCredits must be used inside <CreditsProvider>");
  }
  return ctx;
}
