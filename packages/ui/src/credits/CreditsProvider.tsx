"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface OutOfCreditsContext {
  operation: string;
  required: number;
  balance: number;
}

interface CreditsContextValue {
  isOpen: boolean;
  context: OutOfCreditsContext | null;
  openOutOfCreditsModal: (ctx: OutOfCreditsContext) => void;
  closeOutOfCreditsModal: () => void;
}

const Ctx = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
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
      openOutOfCreditsModal,
      closeOutOfCreditsModal,
    }),
    [context, openOutOfCreditsModal, closeOutOfCreditsModal]
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
