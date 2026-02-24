// React context provider for authentication

'use client';

import type { ReactNode } from 'react';
import React, { createContext, useEffect, useState, useCallback } from 'react';

import {
  clearSessionToken,
  getAccountsUrl,
} from './authHelpers';

import type { AuthState, AuthContextValue, BFEAIUser } from './types';

// Create the context
export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    subscription: null,
    subscriptions: {},
    loading: true,
    error: null,
  });

  /**
   * Initialize authentication state
   *
   * NOTE: The bfeai_session cookie is HttpOnly, so client-side JS cannot read it.
   * Server-side middleware and layout already validate auth before this runs.
   * We fetch user info via API call instead of reading the cookie directly.
   *
   * Subscription data is NOT fetched here — dashboard.bfeai is the subscription
   * manager itself. Subscription data is loaded via useBilling/useCredits hooks.
   */
  const initializeAuth = useCallback(async () => {
    // Skip initialization during SSG/SSR
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Fetch current user via API (server can read HttpOnly cookie and fetch profile)
      const response = await fetch('/api/auth/me', { credentials: 'include' });

      if (!response.ok) {
        // If API returns error, user is not authenticated
        // Don't redirect here - server-side already handles that
        console.log('[AuthProvider] Not authenticated via API, server will handle redirect');
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: null, // Not an error, just not authenticated
        }));
        return;
      }

      const data = await response.json();
      const { userId, email, profile } = data;

      // Build user object from API response (profile is fetched server-side)
      let user: BFEAIUser;
      if (profile) {
        user = {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          company: profile.company,
          role: 'user',
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        };
      } else {
        // Fallback: create minimal user from JWT data
        user = {
          id: userId,
          email: email,
          fullName: undefined,
          avatarUrl: undefined,
          company: undefined,
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      setAuthState({
        user,
        subscription: null,
        subscriptions: {},
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: 'Authentication failed',
      }));
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      // Clear the SSO cookie
      clearSessionToken();

      // Redirect to accounts logout (to clear cookie on main domain)
      window.location.href = `${getAccountsUrl()}/logout`;
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even on error
      clearSessionToken();
      window.location.href = `${getAccountsUrl()}/logout`;
    }
  }, []);

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    await initializeAuth();
  }, [initializeAuth]);

  /**
   * Check subscription for a specific app
   * Returns false since dashboard.bfeai doesn't gate on subscriptions
   */
  const checkSubscription = useCallback(async (_targetApp: string): Promise<boolean> => {
    return false;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Context value
  const contextValue: AuthContextValue = {
    ...authState,
    logout,
    refreshAuth,
    checkSubscription,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
