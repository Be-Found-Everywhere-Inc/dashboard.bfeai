'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * SSO Landing Page
 *
 * This intermediate page handles SSO cookie setting for cross-subdomain
 * authentication. When the middleware receives an sso_token parameter,
 * instead of setting the cookie on a redirect (which Netlify may strip),
 * it redirects here first.
 *
 * This page:
 * 1. Calls an API endpoint that sets the bfeai_session cookie (on a non-redirect response)
 * 2. Then redirects to the final destination via client-side navigation
 */
function SSOLandingContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'setting-cookie' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/';
    const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.bfeai.com';

    if (!token) {
      setStatus('error');
      setErrorMessage('Missing token parameter');
      // Redirect to accounts login after a short delay
      setTimeout(() => {
        window.location.href = `${accountsUrl}/login?error=sso_missing_token`;
      }, 2000);
      return;
    }

    // Safety timeout: if processing takes more than 5 seconds, redirect to login
    const timeout = setTimeout(() => {
      setStatus('error');
      setErrorMessage('Authentication timed out');
      setTimeout(() => {
        window.location.href = `${accountsUrl}/login?error=sso_timeout`;
      }, 1000);
    }, 5000);

    // Set the cookie via API call (non-redirect response preserves cookies)
    setStatus('setting-cookie');

    fetch('/api/auth/set-sso-cookie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      credentials: 'include', // Important: include cookies in the request
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to set SSO cookie');
        }
        return response.json();
      })
      .then(() => {
        clearTimeout(timeout);
        setStatus('redirecting');
        // Give the browser time to fully process the Set-Cookie header
        // 500ms is safer than 100ms for cookie processing
        setTimeout(() => {
          // Redirect to the clean URL (no token in URL)
          window.location.href = redirect;
        }, 500);
      })
      .catch(error => {
        clearTimeout(timeout);
        console.error('SSO cookie error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Unknown error');
        // Redirect to accounts login after a short delay
        setTimeout(() => {
          window.location.href = `${accountsUrl}/login?error=sso_cookie_failed`;
        }, 2000);
      });

    return () => clearTimeout(timeout);
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
          {status === 'setting-cookie' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-brand-gray-900">
                Setting up your session...
              </h2>
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

export default function SSOLandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
      </div>
    }>
      <SSOLandingContent />
    </Suspense>
  );
}
