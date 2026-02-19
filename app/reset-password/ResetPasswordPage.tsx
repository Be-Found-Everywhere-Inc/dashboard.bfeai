'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bfeai/ui';
import { createClient } from '@/lib/supabase/client';

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch('password');

  useEffect(() => {
    // Check for error from /auth/confirm redirect
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorDesc = searchParams.get('error_description') || 'Invalid or expired reset link';
      console.error('Auth confirm error:', errorParam, errorDesc);
      toast.error(errorDesc);
      return;
    }

    // Flow 1: Arrived via /auth/confirm with session already established server-side
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      setIsExchanging(true);
      const supabase = createClient();
      supabase.auth.getSession().then(({ data, error }) => {
        if (error || !data.session) {
          console.error('Session check error after verify:', error);
          toast.error('Session expired. Please request a new reset link.');
          setIsExchanging(false);
          return;
        }
        setHasSession(true);
        setToken('verified'); // Set token so the form renders
        setIsExchanging(false);
      });
      return;
    }

    // Flow 2: PKCE code exchange (legacy — when email still goes through Supabase /auth/v1/verify)
    const code = searchParams.get('code');
    if (code) {
      setIsExchanging(true);
      const supabase = createClient();
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error || !data.session) {
          console.error('Code exchange error:', error);
          toast.error('Invalid or expired reset link. Please request a new one.');
          setIsExchanging(false);
          return;
        }
        setHasSession(true);
        setToken(code);
        setIsExchanging(false);
      });
      return;
    }

    // Flow 3: Legacy implicit flow (access_token in URL)
    const accessToken = searchParams.get('access_token') || searchParams.get('token');
    if (accessToken) {
      setToken(accessToken);
      return;
    }

    toast.error('Invalid or missing reset token');
  }, [searchParams]);

  // Calculate password strength
  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: 25, label: 'Weak', color: 'bg-error' };
    if (strength <= 4) return { strength: 50, label: 'Fair', color: 'bg-warning' };
    if (strength <= 5) return { strength: 75, label: 'Good', color: 'bg-primary' };
    return { strength: 100, label: 'Strong', color: 'bg-success' };
  };

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token && !hasSession) {
      toast.error('Invalid reset token');
      return;
    }

    setIsLoading(true);

    try {
      if (hasSession) {
        // PKCE flow: we have a live Supabase session, update password directly
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password: data.password });

        if (error) {
          toast.error(error.message || 'Failed to reset password');
          setIsLoading(false);
          return;
        }

        await supabase.auth.signOut();
        toast.success('Password reset successfully! Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        // Legacy flow: send token to API route
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: data.password }),
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || 'Failed to reset password');
          setIsLoading(false);
          return;
        }

        toast.success('Password reset successfully! Redirecting to login...');
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (isExchanging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background-tertiary py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-200 [mask-image:radial-gradient(white,transparent_85%)] pointer-events-none" />
        <Card className="w-full max-w-md relative animate-scale-in backdrop-blur-sm bg-background/95">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Verifying link...</CardTitle>
            <CardDescription className="text-center">
              Please wait while we verify your reset link
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token && !hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background-tertiary py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-200 [mask-image:radial-gradient(white,transparent_85%)] pointer-events-none" />
        <Card className="w-full max-w-md relative animate-scale-in backdrop-blur-sm bg-background/95">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-error">Invalid Link</CardTitle>
            <CardDescription className="text-center">
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <p className="text-sm text-foreground-secondary text-center">
              Please request a new password reset link.
            </p>
            <Link href="/forgot-password">
              <Button>Request New Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background-tertiary py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-200 [mask-image:radial-gradient(white,transparent_85%)] pointer-events-none" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none animate-pulse-ring" />

      <Card className="w-full max-w-md relative animate-scale-in backdrop-blur-sm bg-background/95">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-fade-in">
            <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold">Reset your password</CardTitle>
          <CardDescription className="text-base">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-error" role="alert">
                  {errors.password.message}
                </p>
              )}

              {/* Password strength indicator */}
              {password && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground-secondary">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.label === 'Strong' ? 'text-success' :
                      passwordStrength.label === 'Good' ? 'text-primary' :
                      passwordStrength.label === 'Fair' ? 'text-warning' :
                      'text-error'
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${passwordStrength.strength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-error" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Resetting password...' : 'Reset Password'}
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm font-medium text-primary hover:text-primary-hover transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-secondary">
        <div className="text-foreground-secondary">Loading...</div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
