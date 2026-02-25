'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

/**
 * SSO Complete Page
 *
 * This is an intermediate page that handles SSO cookie setting for cross-subdomain
 * authentication. When the OAuth callback completes, instead of redirecting directly
 * to the target app (e.g., keywords.bfeai.com), we redirect here first.
 *
 * This page:
 * 1. Calls an API endpoint that sets the bfeai_session cookie (on a non-redirect response)
 * 2. Then redirects to the final destination via client-side navigation
 *
 * This approach works around the issue where cookies on redirect responses may be
 * stripped by edge platforms like Netlify.
 */
function SSOCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'setting-cookie' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const redirect = searchParams.get('redirect') || '/';

    if (!token) {
      setStatus('error');
      setErrorMessage('Missing token parameter');
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login?error=sso_missing_token');
      }, 2000);
      return;
    }

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
        setStatus('redirecting');
        // Give a brief moment for the cookie to be set, then redirect
        setTimeout(() => {
          // Use window.location for cross-subdomain redirect
          // For external URLs, redirect to /sso-landing on the target domain
          // This avoids the middleware redirect chain
          let finalUrl: string;
          if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
            const targetUrl = new URL(redirect);
            const currentOrigin = window.location.origin;

            // Check if target is the same domain (accounts.bfeai.com)
            // If same domain, we can redirect directly since cookie is already set
            if (targetUrl.origin === currentOrigin) {
              // Same domain - redirect directly (cookie already set by this page)
              finalUrl = redirect;
            } else {
              // Cross-domain - redirect to sso-landing on the target domain
              // so the target domain can set its own cookie
              const ssoLandingUrl = new URL('/sso-landing', targetUrl.origin);
              ssoLandingUrl.searchParams.set('token', token);
              ssoLandingUrl.searchParams.set('redirect', targetUrl.pathname + targetUrl.search);
              finalUrl = ssoLandingUrl.toString();
            }
          } else {
            // For relative redirects, just use the path directly since cookie is already set
            const url = new URL(redirect, window.location.origin);
            finalUrl = url.toString();
          }
          window.location.href = finalUrl;
        }, 100);
      })
      .catch(error => {
        console.error('SSO cookie error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'Unknown error');
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/login?error=sso_cookie_failed');
        }, 2000);
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
                Completing authentication...
              </h2>
            </>
          )}
          {status === 'setting-cookie' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
                Setting up your session...
              </h2>
            </>
          )}
          {status === 'redirecting' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
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
              <h2 className="mt-6 text-xl font-semibold text-gray-900">
                Authentication failed
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

export default function SSOCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SSOCompleteContent />
    </Suspense>
  );
}
