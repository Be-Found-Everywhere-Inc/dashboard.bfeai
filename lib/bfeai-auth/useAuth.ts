// React hook for accessing auth state

import { useContext } from 'react';

import { AuthContext } from './AuthProvider';

import type { AuthContextValue } from './types';

/**
 * Hook to access authentication state and methods
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, subscription, loading, logout } = useAuth();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <div>Not logged in</div>;
 *
 *   return <div>Hello, {user.email}</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
        'Make sure your app is wrapped with <AuthProvider>.'
    );
  }

  return context;
}
