'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Loading spinner component
 */
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-700 dark:text-gray-300">Signing out...</p>
      </div>
    </div>
  );
}

/**
 * Logout handler component (uses useSearchParams)
 */
function LogoutHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  useEffect(() => {
    async function performLogout() {
      try {
        // Call the logout API
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          console.error('Logout failed:', await response.text());
        }
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        // Always redirect to login (or custom redirect) after logout attempt
        const loginUrl = redirect
          ? `/login?redirect=${encodeURIComponent(redirect)}`
          : '/login?message=logged_out';

        router.push(loginUrl);
      }
    }

    performLogout();
  }, [router, redirect]);

  return <LoadingSpinner />;
}

/**
 * /logout page
 *
 * This page handles logout by calling the logout API and redirecting to login.
 * Supports optional redirect parameter to go to a specific page after logout.
 */
export default function LogoutPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LogoutHandler />
    </Suspense>
  );
}
