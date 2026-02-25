'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button, Input, Label, Checkbox } from '@bfeai/ui';
import { useRecaptcha, RecaptchaScript } from '@/components/recaptcha';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;

// Signup validation schema
const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  company: z.string().optional(),
  ageConfirmation: z.boolean().refine(val => val === true, {
    message: 'You must confirm that you are at least 18 years old',
  }),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

// Inline SVG error icon to avoid repetition
function ErrorIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

// Feature bullets shown in the brand panel
const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    label: 'AI-Powered SEO Tools',
    description: 'Discover keywords, analyze competitors, and track rankings — all with AI.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Credit-Based Pricing',
    description: 'Pay only for what you use. Top up any time, credits never expire.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    label: 'Multiple Apps, One Account',
    description: 'Sign in once and access every BFEAI tool seamlessly.',
  },
];

export default function SignupPageClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const { getToken } = useRecaptcha(RECAPTCHA_SITE_KEY, 'signup');

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      ageConfirmation: false,
      agreeToTerms: false,
    },
  });

  const ageConfirmation = watch('ageConfirmation');
  const agreeToTerms = watch('agreeToTerms');

  const password = watch('password');

  // Calculate password strength
  const getPasswordStrength = (pw: string): { strength: number; label: string; color: string; trackColor: string } => {
    if (!pw) return { strength: 0, label: '', color: '', trackColor: '' };

    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { strength: 25, label: 'Weak', color: '#ef4444', trackColor: 'rgba(239,68,68,0.15)' };
    if (score <= 4) return { strength: 50, label: 'Fair', color: '#f59e0b', trackColor: 'rgba(245,158,11,0.15)' };
    if (score <= 5) return { strength: 75, label: 'Good', color: '#454D9A', trackColor: 'rgba(69,77,154,0.15)' };
    return { strength: 100, label: 'Strong', color: '#10b981', trackColor: 'rgba(16,185,129,0.15)' };
  };

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);

    try {
      // Get reCAPTCHA token if configured
      let recaptchaToken: string | null = null;
      if (RECAPTCHA_SITE_KEY) {
        recaptchaToken = await getToken();
        if (!recaptchaToken) {
          toast.error('reCAPTCHA verification failed. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          password: data.password,
          company: data.company,
          ageConfirmation: data.ageConfirmation,
          recaptchaToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Signup failed');
        setIsLoading(false);
        return;
      }

      toast.success('Account created successfully! Redirecting...');

      // Redirect to home page or dashboard (user is automatically logged in)
      setTimeout(() => {
        router.push('/profile');
      }, 1000);
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('An error occurred during signup');
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* reCAPTCHA v3 Script */}
      {RECAPTCHA_SITE_KEY && <RecaptchaScript siteKey={RECAPTCHA_SITE_KEY} />}

      <div className="min-h-screen flex flex-col md:flex-row bg-background overflow-hidden">

        {/* ------------------------------------------------------------------ */}
        {/* LEFT — Brand panel                                                  */}
        {/* ------------------------------------------------------------------ */}
        <div
          className="relative flex flex-col justify-between md:w-[45%] shrink-0 overflow-hidden
                     px-8 py-10 md:px-12 md:py-14
                     min-h-[220px] md:min-h-screen"
          style={{
            background: 'linear-gradient(155deg, #1a0f2e 0%, #2d1b4e 18%, #533577 42%, #454D9A 68%, #255C85 100%)',
          }}
        >
          {/* Decorative orbs */}
          <div
            className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #533577 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-15 translate-x-1/3 translate-y-1/3"
            style={{ background: 'radial-gradient(circle, #255C85 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          {/* Subtle diagonal grid lines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'repeating-linear-gradient(135deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 48px)',
            }}
            aria-hidden="true"
          />

          {/* Logo + wordmark */}
          <div className="relative z-10 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <Link href="/" className="inline-flex items-center gap-3 group" aria-label="BFEAI home">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-lg transition-all duration-normal group-hover:bg-white/15 group-hover:scale-105">
                <Image
                  src="/brand/BFE_Logo_TRN_BG.png"
                  alt="BFEAI"
                  width={36}
                  height={36}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <span className="block text-white font-heading font-extrabold text-xl leading-none tracking-tight">
                  BFEAI
                </span>
                <span className="block text-white/60 text-xs font-medium leading-none mt-0.5 tracking-wider uppercase">
                  Be Found Everywhere
                </span>
              </div>
            </Link>
          </div>

          {/* Hero copy — hidden on very small mobile, visible from md */}
          <div className="relative z-10 hidden md:block">
            <div className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
              <h1 className="page-title text-white text-3xl lg:text-4xl xl:text-[2.6rem] leading-[1.1] mb-4">
                Your entire SEO<br />
                toolkit — one login.
              </h1>
              <p className="text-white/70 text-base leading-relaxed max-w-xs">
                Create a free account and start discovering keywords, tracking AI visibility, and growing organic traffic today.
              </p>
            </div>

            {/* Feature bullets */}
            <ul className="mt-10 space-y-5" aria-label="Platform features">
              {FEATURES.map((feature, i) => (
                <li
                  key={feature.label}
                  className="flex items-start gap-4 animate-fade-in-up"
                  style={{ animationDelay: `${160 + i * 80}ms` }}
                >
                  <div
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm leading-snug">{feature.label}</p>
                    <p className="text-white/55 text-xs leading-relaxed mt-0.5">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10 animate-fade-in-up hidden md:block" style={{ animationDelay: '480ms' }}>
            <p className="text-white/40 text-xs tracking-wide">
              Trusted by marketers and agencies worldwide.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT — Form panel                                                  */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-background">
          {/* Inner wrapper — centers content vertically on tall screens */}
          <div className="flex flex-col justify-center min-h-full px-6 py-10 sm:px-10 md:px-14 lg:px-20 xl:px-24 max-w-xl w-full mx-auto">

            {/* Heading */}
            <div className="animate-fade-in-up mb-8" style={{ animationDelay: '60ms' }}>
              <h2 className="page-title text-foreground text-3xl md:text-[2rem]">
                Create Your Account
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Already have one?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:text-primary-hover transition-colors duration-normal inline-flex items-center gap-0.5 group"
                >
                  Sign in
                  <svg className="w-3.5 h-3.5 transition-transform duration-normal group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </p>
            </div>

            {/* OAuth buttons — prominent, above the form */}
            <div className="animate-fade-in-up mb-6" style={{ animationDelay: '120ms' }}>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => {
                    window.location.href = '/oauth-start?provider=google&redirect=/profile';
                  }}
                  className="btn-press h-11 gap-2 border-border text-foreground hover:bg-brand-purple/5 hover:border-brand-purple/40 transition-all duration-normal"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                    window.location.href = '/oauth-start?provider=github&redirect=/profile';
                  }}
                  className="btn-press h-11 gap-2 border-border text-foreground hover:bg-brand-purple/5 hover:border-brand-purple/40 transition-all duration-normal"
                >
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="text-sm font-medium">GitHub</span>
                </Button>
              </div>

              {/* Divider */}
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    or sign up with email
                  </span>
                </div>
              </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

              {/* Full name */}
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </Label>
                <div className="relative group">
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Smith"
                    {...register('fullName')}
                    disabled={isLoading}
                    aria-invalid={errors.fullName ? 'true' : 'false'}
                    className="pr-10 transition-all duration-normal group-hover:shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground" aria-hidden="true">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                {errors.fullName && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in" role="alert">
                    <ErrorIcon />
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '220ms' }}>
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...register('email')}
                    disabled={isLoading}
                    aria-invalid={errors.email ? 'true' : 'false'}
                    className="pr-10 transition-all duration-normal group-hover:shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground" aria-hidden="true">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
                {errors.email && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in" role="alert">
                    <ErrorIcon />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '260ms' }}>
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative group">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register('password')}
                    disabled={isLoading}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    className="pr-10 transition-all duration-normal group-hover:shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground" aria-hidden="true">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                {errors.password && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in" role="alert">
                    <ErrorIcon />
                    {errors.password.message}
                  </p>
                )}

                {/* Password strength — premium treatment */}
                {password && (
                  <div className="space-y-1.5 animate-fade-in pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Password strength</span>
                      <span
                        className="text-xs font-bold tracking-wide transition-colors duration-normal"
                        style={{ color: passwordStrength.color }}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                    {/* Track */}
                    <div
                      className="relative h-1.5 rounded-full overflow-hidden"
                      style={{ background: passwordStrength.trackColor || 'hsl(var(--muted))' }}
                    >
                      {/* Fill bar */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${passwordStrength.strength}%`,
                          background: `linear-gradient(90deg, ${passwordStrength.color}aa, ${passwordStrength.color})`,
                          boxShadow: `0 0 8px ${passwordStrength.color}66`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative group">
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    disabled={isLoading}
                    aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                    className="pr-10 transition-all duration-normal group-hover:shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground" aria-hidden="true">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in" role="alert">
                    <ErrorIcon />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Company (optional) */}
              <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '340ms' }}>
                <Label htmlFor="company" className="text-sm font-medium">
                  Company{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="relative group">
                  <Input
                    id="company"
                    type="text"
                    placeholder="Acme Inc."
                    {...register('company')}
                    disabled={isLoading}
                    className="pr-10 transition-all duration-normal group-hover:shadow-sm"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground" aria-hidden="true">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Checkboxes — grouped with a subtle background card */}
              <div
                className="space-y-3 rounded-lg px-4 py-3.5 animate-fade-in-up"
                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', animationDelay: '380ms' }}
              >
                {/* Age confirmation */}
                <div className="flex items-start gap-3 group">
                  <Checkbox
                    id="ageConfirmation"
                    checked={ageConfirmation}
                    onCheckedChange={(checked) => setValue('ageConfirmation', checked as boolean)}
                    disabled={isLoading}
                    className="mt-0.5 shrink-0 transition-all duration-normal"
                  />
                  <label
                    htmlFor="ageConfirmation"
                    className="text-sm leading-relaxed text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors duration-normal select-none"
                  >
                    I confirm that I am at least{' '}
                    <span className="font-semibold text-foreground">18 years old</span>.
                  </label>
                </div>
                {errors.ageConfirmation && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in pl-7" role="alert">
                    <ErrorIcon />
                    {errors.ageConfirmation.message}
                  </p>
                )}

                {/* Divider between checkboxes */}
                <div className="border-t border-border" />

                {/* Terms */}
                <div className="flex items-start gap-3 group">
                  <Checkbox
                    id="agreeToTerms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setValue('agreeToTerms', checked as boolean)}
                    disabled={isLoading}
                    className="mt-0.5 shrink-0 transition-all duration-normal"
                  />
                  <label
                    htmlFor="agreeToTerms"
                    className="text-sm leading-relaxed text-muted-foreground cursor-pointer group-hover:text-foreground transition-colors duration-normal select-none"
                  >
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2 transition-colors duration-normal"
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2 transition-colors duration-normal"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>
                {errors.agreeToTerms && (
                  <p className="text-xs text-error flex items-center gap-1.5 animate-fade-in pl-7" role="alert">
                    <ErrorIcon />
                    {errors.agreeToTerms.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="animate-fade-in-up" style={{ animationDelay: '420ms' }}>
                <Button
                  type="submit"
                  className="w-full btn-press group"
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
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <svg className="w-4 h-4 ml-2 transition-transform duration-normal group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </Button>
              </div>

              {/* reCAPTCHA privacy notice */}
              {RECAPTCHA_SITE_KEY && (
                <p className="text-xs text-muted-foreground text-center animate-fade-in-up" style={{ animationDelay: '460ms' }}>
                  Protected by reCAPTCHA.{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground transition-colors"
                  >
                    Privacy
                  </a>{' '}
                  &{' '}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground transition-colors"
                  >
                    Terms
                  </a>{' '}
                  apply.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
