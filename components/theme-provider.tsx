"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if no preference is stored. Defaults to "system" */
  defaultTheme?: "light" | "dark" | "system";
  /** localStorage key for storing theme preference. Defaults to "theme" */
  storageKey?: string;
  /** Whether to enable system theme detection. Defaults to true */
  enableSystem?: boolean;
  /** Disable CSS transitions when switching themes to prevent flash. Defaults to true */
  disableTransitionOnChange?: boolean;
}

/**
 * Theme provider for BFEAI apps. Wraps next-themes with ecosystem defaults.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  enableSystem = true,
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      storageKey={storageKey}
      disableTransitionOnChange={disableTransitionOnChange}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
