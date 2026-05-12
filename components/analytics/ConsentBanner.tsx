'use client';

import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { Button } from '@bfeai/ui';
import { useConsent } from './use-consent';

/**
 * Universal consent banner — shown on every public page until the user
 * accepts or rejects. Renders nothing once a decision has been made.
 *
 * Per product decision (2026-05-11): show to ALL traffic, not just EU/UK.
 * Slight US conversion cost is the trade for global GDPR/CCPA safety with
 * a single code path.
 */
export function ConsentBanner() {
  const { consent, setConsent } = useConsent();

  // `pending` covers both the SSR pass and the initial client paint, so the
  // banner only mounts once we know there's no stored decision.
  if (consent !== 'pending') return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-lg animate-fade-in-up"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="h-5 w-5 shrink-0 text-brand-indigo mt-0.5" aria-hidden />
          <div className="flex-1 text-sm text-foreground">
            <p>
              We use cookies and similar technologies to measure how visitors use BFEAI and to deliver relevant ads. See our{' '}
              <Link href="/privacy" className="font-semibold text-brand-indigo underline underline-offset-2 hover:text-brand-indigo/80">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConsent('rejected')}
            className="btn-press"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => setConsent('accepted')}
            className="btn-press"
          >
            Accept
          </Button>
          <button
            type="button"
            aria-label="Reject cookies and close banner"
            onClick={() => setConsent('rejected')}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors btn-press"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
