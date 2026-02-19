// React context provider for authentication
// Co-founders: Copy this file to your app's lib/bfeai-auth/AuthProvider.tsx

"use client";

import React, {
  createContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import type {
  AuthState,
  AuthContextValue,
  BFEAIUser,
  Subscription,
} from "./types";
import { clearSessionToken, getAppName, getAccountsUrl } from "./authHelpers";

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

  const appName = getAppName();

  // Initialize Supabase client - only on client side with valid env vars
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key || typeof window === "undefined") {
      return null;
    }

    return createBrowserClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false, // SSO uses bfeai_session cookie, not Supabase auth sessions
        detectSessionInUrl: false,
      },
    });
  }, []);

  /**
   * Fetch user profile from Supabase (fallback if /api/auth/me doesn't return profile)
   */
  const fetchUserProfile = useCallback(
    async (userId: string): Promise<BFEAIUser | null> => {
      if (!supabase) return null;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;

        return {
          id: data.id,
          email: data.email,
          fullName: data.full_name,
          avatarUrl: data.avatar_url,
          company: data.company,
          role: data.role || "user",
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }
    },
    [supabase]
  );

  /**
   * Initialize authentication state
   *
   * NOTE: The bfeai_session cookie is HttpOnly, so client-side JS cannot read it.
   * We fetch user info and subscriptions via server-side API endpoints that can
   * read the cookie. You must create these endpoints in your app:
   *   - /api/auth/me           (returns user info)
   *   - /api/auth/subscription (returns subscription data)
   *
   * See api-route-templates/ for the template files.
   */
  const initializeAuth = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      // Clear stale Supabase auth cookies (SSO uses bfeai_session, not these)
      if (typeof document !== "undefined") {
        document.cookie.split(";").forEach((c) => {
          const name = c.trim().split("=")[0];
          if (name.startsWith("sb-") && name.includes("-auth-token")) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          }
        });
      }

      // Fetch current user via API (server reads the httpOnly cookie)
      const response = await fetch("/api/auth/me", { credentials: "include" });

      if (!response.ok) {
        // Not authenticated — server-side middleware handles the redirect
        setAuthState((prev) => ({
          ...prev,
          loading: false,
          error: null,
        }));
        return;
      }

      const data = await response.json();
      const { userId, email, profile } = data;

      // Build user object from API response
      let user: BFEAIUser;
      if (profile) {
        user = {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          company: profile.company,
          role: "user",
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        };
      } else {
        // Fallback: try client-side profile fetch
        const fetchedUser = await fetchUserProfile(userId);
        user = fetchedUser || {
          id: userId,
          email: email,
          fullName: null,
          avatarUrl: null,
          company: null,
          role: "user",
          createdAt: null,
          updatedAt: null,
        };
      }

      // Fetch subscriptions via server-side endpoint
      let subscriptions: Record<string, Subscription> = {};
      let currentSubscription: Subscription | null = null;

      try {
        const subResponse = await fetch("/api/auth/subscription", {
          credentials: "include",
        });
        if (subResponse.ok) {
          const subData = await subResponse.json();
          subscriptions = subData.subscriptions || {};
          currentSubscription = subscriptions[appName] || null;
        }
      } catch (subError) {
        console.warn("Could not fetch subscriptions:", subError);
      }

      setAuthState({
        user,
        subscription: currentSubscription,
        subscriptions,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Auth initialization error:", error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: "Authentication failed",
      }));
    }
  }, [fetchUserProfile, appName]);

  /**
   * Logout user — always redirects to accounts.bfeai.com
   */
  const logout = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }

      clearSessionToken();
      window.location.href = `${getAccountsUrl()}/api/auth/logout`;
    } catch (error) {
      console.error("Logout error:", error);
      clearSessionToken();
      window.location.href = `${getAccountsUrl()}/api/auth/logout`;
    }
  }, [supabase]);

  /**
   * Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    await initializeAuth();
  }, [initializeAuth]);

  /**
   * Check subscription for a specific app
   */
  const checkSubscription = useCallback(
    async (targetApp: string): Promise<boolean> => {
      try {
        const response = await fetch("/api/auth/subscription", {
          credentials: "include",
        });
        if (!response.ok) return false;
        const data = await response.json();
        const sub = data.subscriptions?.[targetApp];
        return sub?.status === "active" || sub?.status === "trialing";
      } catch {
        return false;
      }
    },
    []
  );

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const contextValue: AuthContextValue = {
    ...authState,
    logout,
    refreshAuth,
    checkSubscription,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}
