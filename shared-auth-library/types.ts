// Type definitions for BFEAI authentication
// Co-founders: Copy this file to your app's lib/bfeai-auth/types.ts

export interface BFEAIUser {
  id: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  company?: string | null;
  role: "user" | "admin" | "employee";
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Subscription {
  id: string;
  userId: string;
  appName: string;
  status: "active" | "cancelled" | "expired" | "trialing" | "past_due";
  planId: string;
  planName?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface AuthState {
  user: BFEAIUser | null;
  subscription: Subscription | null;
  subscriptions: Record<string, Subscription>;
  loading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkSubscription: (appName: string) => Promise<boolean>;
}

export interface JWTPayload {
  sub?: string;
  userId: string;
  email: string;
  role?: string;
  exp: number;
  iat: number;
  jti?: string;
}
