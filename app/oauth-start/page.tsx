'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * OAuth Start Page
 *
 * This intermediate page handles setting the oauth_redirect cookie before
 * initiating the OAuth flow. This is necessary because Netlify strips
 * Set-Cookie headers from redirect responses.
 *
 * Flow:
 * 1. User clicks OAuth button → redirected here with provider & redirect params
 * 2. This page calls /api/auth/set-oauth-redirect to set the cookie
 * 3. Then redirects to /api/auth/oauth to start the actual OAuth flow
 */
function OAuthStartContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'setting-cookie' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const provider = searchParams.get('provider');
    const redirect = searchParams.get('redirect') || '/';

    if (!provider || (provider !== 'google' && provider !== 'github')) {
      setStatus('error');
      setErrorMessage('Invalid OAuth provider');
      setTimeout(() => {
        window.location.href = '/login?error=invalid_provider';
      }, 2000);
      return;
    }

    // Set the oauth_redirect cookie via API call
    setStatus('setting-cookie');

    fetch('/api/auth/set-oauth-redirect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ redirect }),
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to set OAuth redirect cookie');
        }
        return response.json();
      })
      .then(() => {
        setStatus('redirecting');
        // Small delay to ensure cookie is set, then redirect to OAuth
        setTimeout(() => {
          // Now redirect to the OAuth endpoint - it doesn't need the redirect param
          // because the cookie is already set
          window.location.href = `/api/auth/oauth?provider=${provider}`;
        }, 100);
      })
      .catch(error => {
        console.error('OAuth start error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Unknown error');
        setTimeout(() => {
          window.location.href = '/login?error=oauth_start_failed';
        }, 2000);
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {(status === 'loading' || status === 'setting-cookie') && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
                Preparing authentication...
              </h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                You'll be redirected to sign in shortly.
              </p>
            </>
          )}
          {status === 'redirecting' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
                Redirecting to sign in...
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
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
                Something went wrong
              </h2>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                {errorMessage || 'An error occurred during authentication.'}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Redirecting to login...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OAuthStartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <OAuthStartContent />
    </Suspense>
  );
}
