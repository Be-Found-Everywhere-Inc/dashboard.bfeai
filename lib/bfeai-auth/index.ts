// Main entry point - exports all CLIENT-SIDE auth functionality
// For server-side helpers, import from './server' directly

// Components
export { AuthProvider, AuthContext } from './AuthProvider';

// Hooks
export { useAuth } from './useAuth';

// Types
export type {
  BFEAIUser,
  Subscription,
  AuthState,
  AuthContextValue,
  JWTPayload,
} from './types';

// Client-side Helpers
export {
  getSessionToken,
  clearSessionToken,
  decodeToken,
  isTokenExpired,
  redirectToLogin,
  redirectToSubscribe,
  getAppName,
  getPaymentsApiUrl,
  getAccountsApiUrl,
  getAccountsUrl,
} from './authHelpers';

// Subscription utilities
export {
  fetchUserSubscriptions,
  fetchAppSubscription,
  hasActiveSubscription,
  isSubscriptionActive,
  isSubscriptionExpiringSoon,
} from './subscriptionCheck';
