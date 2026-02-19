"use client";

import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: HTMLElement, options: object) => number;
      reset: (widgetId?: number) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

interface RecaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
  action?: string; // For v3
  version?: "v2" | "v3";
}

/**
 * reCAPTCHA v3 (invisible) component
 * Executes automatically and provides a token via onVerify callback
 */
export function RecaptchaV3({
  siteKey,
  onVerify,
  onError,
  action = "submit",
}: Omit<RecaptchaProps, "version">) {
  const scriptLoaded = useRef(false);

  const executeRecaptcha = useCallback(async () => {
    if (!window.grecaptcha) {
      onError?.(new Error("reCAPTCHA not loaded"));
      return;
    }

    try {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(siteKey, { action });
          onVerify(token);
        } catch (err) {
          onError?.(err as Error);
        }
      });
    } catch (err) {
      onError?.(err as Error);
    }
  }, [siteKey, action, onVerify, onError]);

  useEffect(() => {
    if (scriptLoaded.current) {
      executeRecaptcha();
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      scriptLoaded.current = true;
      executeRecaptcha();
    };

    script.onerror = () => {
      onError?.(new Error("Failed to load reCAPTCHA script"));
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [siteKey, executeRecaptcha, onError]);

  // v3 is invisible, no UI needed
  return null;
}

/**
 * Hook to use reCAPTCHA v3 in forms
 */
export function useRecaptcha(siteKey: string | null, action: string = "submit") {
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!siteKey) {
      console.warn("[reCAPTCHA] Site key not configured");
      return null;
    }

    if (!window.grecaptcha) {
      console.warn("[reCAPTCHA] Not loaded yet");
      return null;
    }

    return new Promise((resolve) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(siteKey, { action });
          tokenRef.current = token;
          resolve(token);
        } catch (err) {
          console.error("[reCAPTCHA] Execute error:", err);
          resolve(null);
        }
      });
    });
  }, [siteKey, action]);

  const refreshToken = useCallback(async () => {
    tokenRef.current = await getToken();
    return tokenRef.current;
  }, [getToken]);

  return { getToken, refreshToken, currentToken: tokenRef.current };
}

/**
 * Script loader component - add to layout or page
 */
export function RecaptchaScript({ siteKey }: { siteKey: string }) {
  useEffect(() => {
    if (document.querySelector(`script[src*="recaptcha"]`)) {
      return; // Already loaded
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [siteKey]);

  return null;
}
