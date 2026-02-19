// Main entry point - exports all auth functionality
// Co-founders: Copy this file to your app's lib/bfeai-auth/index.ts

// Components
export { AuthProvider, AuthContext } from "./AuthProvider";

// Hooks
export { useAuth } from "./useAuth";

// Types
export type {
  BFEAIUser,
  Subscription,
  AuthState,
  AuthContextValue,
  JWTPayload,
} from "./types";

// Client-side helpers
export {
  getSessionToken,
  clearSessionToken,
  decodeToken,
  isTokenExpired,
  redirectToLogin,
  redirectToSubscribe,
  getAppName,
  getAccountsUrl,
  getPaymentsApiUrl,
  getAccountsApiUrl,
} from "./authHelpers";

// Subscription utilities (sync helpers only — async ones are deprecated)
export {
  isSubscriptionActive,
  isSubscriptionExpiringSoon,
} from "./subscriptionCheck";

// Server-side helpers (import from './server' in API routes)
// Note: server.ts uses next/headers which only works in server context.
// Import it directly: import { getAuthenticatedUser } from '@/lib/bfeai-auth/server';
