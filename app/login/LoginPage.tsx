'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button, Input, Label, Checkbox } from '@bfeai/ui';
import { loginSchema, type LoginInput } from '@/lib/validation/schemas';
import { useRecaptcha, RecaptchaScript } from '@/components/recaptcha';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const { getToken } = useRecaptcha(RECAPTCHA_SITE_KEY, 'login');

  // Check if reCAPTCHA is ready
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) {
      setRecaptchaReady(true); // No reCAPTCHA configured, allow form
      return;
    }

    const checkReady = () => {
      if (window.grecaptcha) {
        setRecaptchaReady(true);
      } else {
        setTimeout(checkReady, 100);
      }
    };

    // Give script time to load
    setTimeout(checkReady, 500);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      // Get reCAPTCHA token if configured
      let recaptchaToken: string | null = null;
      if (RECAPTCHA_SITE_KEY) {
        recaptchaToken = await getToken();
        if (!recaptchaToken) {
          toast.error('reCAPTCHA verification failed. Please refresh and try again.');
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe,
          recaptchaToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Invalid email or password');
        return;
      }

      // Success - redirect to specified URL or default to dashboard
      const redirectUrl = searchParams.get('redirect') || '/';

      // Check if redirect is to another BFEAI subdomain (cross-domain SSO)
      const isCrossDomainRedirect = redirectUrl.startsWith('https://') &&
        redirectUrl.includes('.bfeai.com') &&
        !redirectUrl.startsWith('https://dashboard.bfeai.com');

      // Also check for localhost in development
      const isDevCrossDomainRedirect = process.env.NODE_ENV !== 'production' &&
        redirectUrl.startsWith('http://localhost:') &&
        !redirectUrl.includes(':3000'); // dashboard.bfeai is typically on 3000

      if (isCrossDomainRedirect || isDevCrossDomainRedirect) {
        // Use code-based flow for cross-subdomain redirects
        try {
          const url = new URL(redirectUrl);
          const clientId = isCrossDomainRedirect
            ? url.hostname.split('.')[0] // Extract "keywords" from "keywords.bfeai.com"
            : 'keywords'; // Default for dev

          // Generate authorization code
          const codeResponse = await fetch('/api/auth/generate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: clientId,
              redirect_uri: redirectUrl,
            }),
          });

          if (codeResponse.ok) {
            const { code } = await codeResponse.json();

            // Redirect to target app's SSO exchange endpoint
            const exchangeUrl = new URL('/sso-exchange', url.origin);
            exchangeUrl.searchParams.set('code', code);
            exchangeUrl.searchParams.set('redirect', url.pathname + url.search);

            window.location.href = exchangeUrl.toString();
            return;
          }

          // If code generation fails, fall back to direct redirect
          // (cookie might work, better than failing completely)
          console.warn('Code generation failed, falling back to direct redirect');
        } catch (codeError) {
          console.error('Code generation error:', codeError);
          // Fall back to direct redirect
        }
      }

      // Internal navigation or fallback for external URLs
      if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
        window.location.href = redirectUrl;
      } else {
        router.push(redirectUrl);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Load reCAPTCHA script */}
      {RECAPTCHA_SITE_KEY && <RecaptchaScript siteKey={RECAPTCHA_SITE_KEY} />}

      <div className="min-h-screen flex flex-col md:flex-row">

        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANEL — brand identity                                          */}
        {/* ------------------------------------------------------------------ */}
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden
                     md:w-[45%] md:min-h-screen
                     px-8 py-12 md:px-14 md:py-0"
          style={{
            background: 'linear-gradient(145deg, #1a0f2e 0%, #2d2060 30%, #3a2d7a 52%, #255C85 80%, #1a3a52 100%)',
          }}
        >
          {/* Animated gradient overlay */}
          <div
            className="absolute inset-0 opacity-40 animate-gradient"
            style={{
              background: 'linear-gradient(225deg, #533577 0%, #454D9A 40%, #255C85 70%, #533577 100%)',
              backgroundSize: '200% 200%',
            }}
          />

          {/* Geometric grid lines — subtle dot matrix */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
            }}
          />

          {/* Floating geometric shapes */}
          <div
            className="absolute top-[-80px] right-[-80px] w-72 h-72 rounded-full opacity-20 animate-float"
            style={{
              background: 'radial-gradient(circle at 40% 40%, #533577, transparent 70%)',
              animationDelay: '0s',
            }}
          />
          <div
            className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-15 animate-float"
            style={{
              background: 'radial-gradient(circle at 60% 60%, #255C85, transparent 70%)',
              animationDelay: '1.5s',
            }}
          />
          <div
            className="absolute top-1/2 right-[-40px] w-40 h-40 rounded-full opacity-10 animate-float"
            style={{
              background: 'radial-gradient(circle at 50% 50%, #454D9A, transparent 70%)',
              animationDelay: '0.8s',
            }}
          />

          {/* Accent ring — top-left corner geometric */}
          <div
            className="absolute top-8 left-8 w-24 h-24 opacity-20 animate-fade-in"
            style={{
              border: '1.5px solid rgba(255,255,255,0.5)',
              borderRadius: '6px',
              transform: 'rotate(20deg)',
            }}
          />
          <div
            className="absolute bottom-10 right-10 w-16 h-16 opacity-15 animate-fade-in animate-delay-200"
            style={{
              border: '1.5px solid rgba(255,255,255,0.5)',
              borderRadius: '50%',
            }}
          />

          {/* Brand content */}
          <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left max-w-sm w-full">

            {/* Logo */}
            <div className="animate-fade-in-up animate-delay-100 mb-8">
              <Image
                src="/brand/BFE_Logo_TRN_BG.png"
                alt="BFEAI"
                width={160}
                height={48}
                className="h-12 w-auto object-contain brightness-0 invert"
                priority
              />
            </div>

            {/* Tagline */}
            <h1
              className="page-title text-white text-4xl md:text-5xl leading-[1.08] mb-5
                         animate-fade-in-up animate-delay-200"
            >
              Be Found<br />
              <span
                style={{
                  background: 'linear-gradient(90deg, #a78bdc, #7ec8e3)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Everywhere.
              </span>
            </h1>

            <p
              className="text-white/65 text-base leading-relaxed mb-10
                         animate-fade-in-up animate-delay-300"
            >
              One account. Every BFEAI tool. Unlimited visibility
              across search, AI, and beyond.
            </p>

            {/* Social proof chips */}
            <div className="flex flex-wrap gap-2 animate-fade-in-up animate-delay-400">
              {['Keyword Discovery', 'AI Visibility', 'SEO Analytics'].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/80"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: '#7ec8e3' }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom fine print on desktop */}
          <p className="absolute bottom-6 left-14 text-white/30 text-xs hidden md:block animate-fade-in animate-delay-600">
            &copy; {new Date().getFullYear()} BFEAI. All rights reserved.
          </p>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANEL — form                                                  */}
        {/* ------------------------------------------------------------------ */}
        <div
          className="flex flex-col items-center justify-center
                     flex-1 bg-card
                     px-6 py-12 sm:px-10 md:px-16 lg:px-20"
        >
          <div className="w-full max-w-[420px]">

            {/* Form header */}
            <div className="mb-8 animate-fade-in-up animate-delay-100">
              <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground mb-2">
                Welcome back
              </h2>
              <p className="text-muted-foreground text-sm">
                Sign in to access all BFEAI apps with one account
              </p>
            </div>

            {/* OAuth buttons — prominent, above the fold */}
            <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in-up animate-delay-200">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => {
                  const redirect = searchParams.get('redirect') || '/';
                  window.location.href = `/oauth-start?provider=google&redirect=${encodeURIComponent(redirect)}`;
                }}
                className="btn-press h-11 gap-2 border-border text-foreground
                           hover:bg-brand-purple/5 hover:border-brand-purple/40
                           transition-all duration-normal group"
              >
                <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-sm font-medium">Google</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => {
                  const redirect = searchParams.get('redirect') || '/';
                  window.location.href = `/oauth-start?provider=github&redirect=${encodeURIComponent(redirect)}`;
                }}
                className="btn-press h-11 gap-2 border-border text-foreground
                           hover:bg-brand-purple/5 hover:border-brand-purple/40
                           transition-all duration-normal"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="text-sm font-medium">GitHub</span>
              </Button>
            </div>

            {/* Divider */}
            <div className="relative mb-6 animate-fade-in-up animate-delay-200">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  or continue with email
                </span>
              </div>
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Email */}
              <div className="space-y-1.5 animate-fade-in-up animate-delay-300">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={isLoading}
                    {...register('email')}
                    aria-invalid={errors.email ? 'true' : 'false'}
                    className="h-11 pr-10 text-sm
                               border-border bg-background
                               focus-visible:ring-2 focus-visible:ring-brand-indigo/50
                               focus-visible:border-brand-indigo
                               placeholder:text-muted-foreground/50
                               transition-all duration-normal"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none" aria-hidden="true">
                    <svg className="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
                {errors.email && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in pt-0.5" role="alert">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5 animate-fade-in-up animate-delay-400">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    {...register('password')}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    className="h-11 pr-10 text-sm
                               border-border bg-background
                               focus-visible:ring-2 focus-visible:ring-brand-indigo/50
                               focus-visible:border-brand-indigo
                               placeholder:text-muted-foreground/50
                               transition-all duration-normal"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none" aria-hidden="true">
                    <svg className="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                {errors.password && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in pt-0.5" role="alert">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember me + forgot password */}
              <div className="flex items-center justify-between animate-fade-in-up animate-delay-500">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                    className="transition-all duration-normal
                               data-[state=checked]:bg-brand-indigo
                               data-[state=checked]:border-brand-indigo"
                  />
                  <Label
                    htmlFor="remember-me"
                    className="text-sm font-normal cursor-pointer text-muted-foreground
                               hover:text-foreground transition-colors duration-normal"
                  >
                    Remember me
                  </Label>
                </div>

                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-brand-indigo hover:text-brand-purple
                             transition-colors duration-normal"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                className="btn-press w-full h-11 text-sm font-semibold
                           animate-fade-in-up animate-delay-500
                           bg-brand-indigo hover:bg-brand-purple
                           text-white border-0
                           shadow-sm hover:shadow-md
                           transition-all duration-normal"
                disabled={isLoading || (!!RECAPTCHA_SITE_KEY && !recaptchaReady)}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </Button>

              {/* Sign up link */}
              <p className="text-center text-sm text-muted-foreground animate-fade-in-up animate-delay-600">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="font-semibold text-brand-indigo hover:text-brand-purple
                             transition-colors duration-normal"
                >
                  Create one free
                </Link>
              </p>

              {/* reCAPTCHA notice */}
              {RECAPTCHA_SITE_KEY && (
                <p className="text-xs text-center text-muted-foreground/60 animate-fade-in-up animate-delay-600">
                  Protected by reCAPTCHA.{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-muted-foreground transition-colors duration-fast"
                  >
                    Privacy
                  </a>
                  {' '}&{' '}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-muted-foreground transition-colors duration-fast"
                  >
                    Terms
                  </a>
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Left panel skeleton */}
        <div
          className="md:w-[45%] md:min-h-screen flex items-center justify-center px-8 py-12"
          style={{
            background: 'linear-gradient(145deg, #1a0f2e 0%, #2d2060 30%, #3a2d7a 52%, #255C85 80%, #1a3a52 100%)',
          }}
        >
          <div className="animate-shimmer w-40 h-10 rounded-lg opacity-20" />
        </div>
        {/* Right panel skeleton */}
        <div className="flex-1 flex items-center justify-center bg-card px-6 py-12">
          <div className="w-full max-w-[420px] space-y-4">
            <div className="animate-shimmer h-8 w-48 rounded-lg" />
            <div className="animate-shimmer h-4 w-64 rounded-md" />
            <div className="animate-shimmer h-11 w-full rounded-lg mt-6" />
            <div className="animate-shimmer h-11 w-full rounded-lg" />
            <div className="animate-shimmer h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
