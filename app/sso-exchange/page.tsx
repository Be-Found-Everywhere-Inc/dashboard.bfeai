'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * SECURITY: Validate redirect URL to prevent open redirect attacks
 * Only allows relative paths or BFEAI domain URLs
 */
function isValidRedirectUrl(url: string): boolean {
  // Empty or whitespace-only is invalid
  if (!url || !url.trim()) {
    return false;
  }

  // Relative paths starting with / (but not //) are valid
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }

  // Absolute URLs must be on bfeai.com domain
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'payments.bfeai.com' ||
           hostname.endsWith('.bfeai.com');
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * SSO Exchange Page
 *
 * This page handles the secure code-based SSO flow. Instead of receiving
 * a JWT token directly in the URL (which exposes it in logs and browser history),
 * this page receives a short-lived authorization code.
 *
 * Flow:
 * 1. Receive authorization code from accounts.bfeai.com
 * 2. Call server-side API to exchange code for JWT token
 * 3. Server sets the bfeai_session cookie
 * 4. Redirect to final destination
 *
 * Security improvements over URL token flow:
 * - Code expires in 30 seconds
 * - Code is single-use (can't be replayed)
 * - Token never appears in URL/logs
 * - Server-to-server exchange uses client secrets
 */
function SSOExchangeContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'exchanging' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const code = searchParams.get('code');
    const rawRedirect = searchParams.get('redirect') || '/';

    // SECURITY: Validate redirect URL to prevent open redirect attacks
    const redirect = isValidRedirectUrl(rawRedirect) ? rawRedirect : '/';

    if (!code) {
      setStatus('error');
      setErrorMessage('Missing authorization code');
      // Redirect to accounts login after a short delay
      setTimeout(() => {
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
        window.location.href = `${accountsUrl}/login?error=sso_missing_code`;
      }, 2000);
      return;
    }

    // Exchange the code for a token via server-side API
    setStatus('exchanging');

    fetch('/api/auth/exchange-sso-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
      credentials: 'include', // Important: include cookies in the response
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Code exchange failed');
        }
        return response.json();
      })
      .then(() => {
        setStatus('redirecting');
        // Small delay to ensure cookie is fully processed
        setTimeout(() => {
          window.location.href = redirect;
        }, 300);
      })
      .catch((error) => {
        console.error('SSO exchange error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Authentication failed');
        // Redirect to accounts login after a short delay
        setTimeout(() => {
          const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';
          window.location.href = `${accountsUrl}/login?error=sso_exchange_failed`;
        }, 2000);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-brand-gray-900">
                Completing authentication...
              </h2>
            </>
          )}
          {status === 'exchanging' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-brand-gray-900">
                Setting up your session...
              </h2>
              <p className="mt-2 text-sm text-brand-gray-600">
                Securely establishing your session
              </p>
            </>
          )}
          {status === 'redirecting' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-brand-gray-900">
                Redirecting you now...
              </h2>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mt-6 text-xl font-semibold text-brand-gray-900">
                Authentication failed
              </h2>
              <p className="mt-2 text-sm text-brand-gray-600">
                {errorMessage || 'An error occurred during authentication.'}
              </p>
              <p className="mt-2 text-sm text-brand-gray-500">
                Redirecting to login...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SSOExchangePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
      </div>
    }>
      <SSOExchangeContent />
    </Suspense>
  );
}
