"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if no preference is stored. Defaults to "light" */
  defaultTheme?: "light" | "dark";
  /** localStorage key for storing theme preference. Defaults to "theme" */
  storageKey?: string;
  /** Disable CSS transitions when switching themes to prevent flash. Defaults to true */
  disableTransitionOnChange?: boolean;
}

/** Reads the bfeai_theme cookie set by ThemeToggle across .bfeai.com apps */
function getCookieTheme(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)bfeai_theme=(light|dark)/);
  return match ? match[1] : null;
}

/** Syncs theme from cross-app cookie on mount so all apps share the same theme */
function ThemeCookieSync({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const synced = React.useRef(false);

  React.useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const cookieTheme = getCookieTheme();
    if (cookieTheme) {
      setTheme(cookieTheme);
    }
  }, [setTheme]);

  return <>{children}</>;
}

/**
 * Theme provider for BFEAI apps. Wraps next-themes with ecosystem defaults.
 * Reads the shared bfeai_theme cookie on mount for cross-app theme persistence.
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "theme",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={false}
      storageKey={storageKey}
      disableTransitionOnChange={disableTransitionOnChange}
      {...props}
    >
      <ThemeCookieSync>{children}</ThemeCookieSync>
    </NextThemesProvider>
  );
}
