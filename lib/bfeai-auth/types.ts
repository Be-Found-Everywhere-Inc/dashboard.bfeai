// Type definitions for BFEAI authentication

export interface BFEAIUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  company?: string;
  role: 'user' | 'admin' | 'employee';
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  appName: string;
  status: 'active' | 'cancelled' | 'expired' | 'trialing' | 'past_due';
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
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
  jti?: string;
}
