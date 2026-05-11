'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bfeai_consent_v1';
const EVENT_NAME = 'bfeai-consent-change';

export type ConsentState = 'pending' | 'accepted' | 'rejected';

/**
 * Source of truth for analytics consent. Reads/writes localStorage and
 * broadcasts via a CustomEvent so multiple instances (banner + pixel loader)
 * stay in sync within the same tab. Cross-tab sync via the native `storage`
 * event isn't needed because the user only interacts with one tab at a time.
 *
 * Returns `'pending'` until the first effect runs to avoid hydration
 * mismatches — server-rendered HTML can't read localStorage, so we render
 * nothing on the server and let the client hydrate the real value in.
 */
export function useConsent(): {
  consent: ConsentState;
  setConsent: (next: 'accepted' | 'rejected') => void;
} {
  const [consent, setConsentState] = useState<ConsentState>('pending');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'accepted' || stored === 'rejected') {
      setConsentState(stored);
    }

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      if (detail === 'accepted' || detail === 'rejected') {
        setConsentState(detail);
      }
    };
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);

  const setConsent = (next: 'accepted' | 'rejected') => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can throw in private-browsing modes; pixels won't fire
      // for this session, which is the safer default.
    }
    setConsentState(next);
    window.dispatchEvent(new CustomEvent<ConsentState>(EVENT_NAME, { detail: next }));
  };

  return { consent, setConsent };
}
