import { z } from 'zod';

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Signup validation schema with password complexity requirements
 */
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  full_name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long'),
});

/**
 * Password reset request schema
 */
export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Password reset (new password) schema
 */
export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

/**
 * Profile update schema
 */
export const profileUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  company: z.string().max(100).optional(),
  industry: z
    .enum([
      'marketing_advertising',
      'ecommerce_retail',
      'saas_software',
      'agency',
      'healthcare',
      'finance',
      'education',
      'real_estate',
      'hospitality',
      'manufacturing',
      'professional_services',
      'nonprofit',
      'other',
    ])
    .optional(),
});

/**
 * TypeScript types derived from schemas
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
