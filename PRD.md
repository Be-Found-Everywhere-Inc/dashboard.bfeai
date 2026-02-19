# Product Requirements Document (PRD)
## accounts.bfeai.com — Central Authentication Service

**Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Ready for Implementation  
**Parent Document:** BFEAI_Complete_PRD_v1_1.md

---

## Executive Summary

accounts.bfeai.com is the centralized authentication and user profile management service for the BFEAI multi-app ecosystem. It handles all login, signup, password management, and profile operations for every app in the ecosystem via JWT-based SSO (Single Sign-On) using domain-wide cookies.

**Core Responsibilities:**
- User registration (email/password, Google OAuth, GitHub OAuth)
- User authentication and session management
- Password reset flow
- User profile management (name, avatar, company, industry)
- Account deletion (self-service)
- SSO cookie issuance for the `.bfeai.com` domain

**Out of Scope (handled by other services):**
- Payment processing → payments.bfeai.com
- Subscription management → payments.bfeai.com
- App-specific features → individual app subdomains
- Admin operations → admin.bfeai.com

---

## Table of Contents

1. [Technical Architecture](#1-technical-architecture)
2. [User Stories](#2-user-stories)
3. [Pages and Routes](#3-pages-and-routes)
4. [Authentication Flows](#4-authentication-flows)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [UI/UX Specifications](#7-uiux-specifications)
8. [Security Requirements](#8-security-requirements)
9. [Environment Variables](#9-environment-variables)
10. [Deployment Configuration](#10-deployment-configuration)
11. [Implementation Phases](#11-implementation-phases)
12. [Success Metrics](#12-success-metrics)
13. [Testing Requirements](#13-testing-requirements)

---

## 1. Technical Architecture

### 1.1 Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | Next.js 14+ (App Router) | Ecosystem consistency, server components, API routes |
| Language | TypeScript | Type safety, better DX |
| Styling | Tailwind CSS + shadcn/ui | Modern, accessible, highly customizable |
| Authentication | Supabase Auth | Already integrated in ecosystem, supports OAuth |
| Database | Supabase PostgreSQL | Shared ecosystem database |
| Hosting | Netlify | Ecosystem consistency, easy subdomain setup |
| Icons | Lucide React | Included with shadcn/ui |

### 1.2 System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User's Browser                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│  │ keywords.bfeai  │     │ payments.bfeai  │     │ app.bfeai.com │ │
│  │   (SEO Tool)    │     │   (Billing)     │     │  (Any App)    │ │
│  └────────┬────────┘     └────────┬────────┘     └───────┬───────┘ │
│           │                       │                       │         │
│           │    No session?        │                       │         │
│           └───────────────────────┼───────────────────────┘         │
│                                   │                                 │
│                                   ▼                                 │
│                    ┌──────────────────────────┐                     │
│                    │   accounts.bfeai.com     │                     │
│                    │   ┌──────────────────┐   │                     │
│                    │   │  /login          │   │                     │
│                    │   │  /signup         │   │                     │
│                    │   │  /forgot-password│   │                     │
│                    │   │  /reset-password │   │                     │
│                    │   │  /profile        │   │                     │
│                    │   │  /settings       │   │                     │
│                    │   └──────────────────┘   │                     │
│                    └────────────┬─────────────┘                     │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Shared Infrastructure                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Supabase                                    │ │
│  │  • auth.users (Supabase managed)                               │ │
│  │  • public.profiles (extended user data)                        │ │
│  │  • URL: https://wmhnkxkyettbeeamuppz.supabase.co              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  OAuth Providers                               │ │
│  │  • Google OAuth 2.0                                            │ │
│  │  • GitHub OAuth                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Cookie-Based SSO Architecture

accounts.bfeai.com is the **only** service that issues the `bfeai_session` JWT cookie. All other apps in the ecosystem read and validate this cookie but never write it.

```
Cookie Configuration:
─────────────────────
Name:     bfeai_session
Domain:   .bfeai.com (note the leading dot)
Path:     /
HttpOnly: true
Secure:   true (production only)
SameSite: lax
MaxAge:   7 days (604800 seconds)
```

---

## 2. User Stories

### 2.1 Authentication Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-01 | New user | Sign up with email and password | I can access BFEAI apps | P0 |
| US-02 | New user | Sign up with Google | I can quickly create an account | P0 |
| US-03 | New user | Sign up with GitHub | I can use my developer account | P0 |
| US-04 | Existing user | Log in with email/password | I can access my account | P0 |
| US-05 | Existing user | Log in with Google | I can quickly access my account | P0 |
| US-06 | Existing user | Log in with GitHub | I can access my account | P0 |
| US-07 | Forgetful user | Reset my password | I can regain access to my account | P0 |
| US-08 | Logged-in user | Log out | My session is securely ended | P0 |
| US-09 | User from another app | Be redirected back after login | I continue where I left off | P0 |

### 2.2 Profile Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-10 | Logged-in user | View my profile | I can see my account information | P0 |
| US-11 | Logged-in user | Update my display name | My name appears correctly in apps | P0 |
| US-12 | Logged-in user | Upload/change my avatar | I have a personalized experience | P1 |
| US-13 | Logged-in user | Update my company name | My business context is captured | P1 |
| US-14 | Logged-in user | Select my industry | Apps can personalize my experience | P1 |
| US-15 | Logged-in user | Change my password | I can maintain account security | P0 |
| US-16 | Logged-in user | Delete my account | I can remove my data from BFEAI | P1 |

### 2.3 Navigation Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-17 | Logged-in user | Navigate to other BFEAI apps | I can use the ecosystem seamlessly | P1 |
| US-18 | Logged-in user | Navigate to my subscriptions | I can manage my billing | P1 |

---

## 3. Pages and Routes

### 3.1 Route Structure

```
accounts.bfeai.com/
├── /                       # Redirect to /login or /profile based on auth state
├── /login                  # Login page (email/password + OAuth)
├── /signup                 # Registration page (email/password + OAuth)
├── /forgot-password        # Password reset request
├── /reset-password         # Password reset form (with token)
├── /profile                # User profile view/edit (protected)
├── /settings               # Account settings (protected)
│   ├── /settings/password  # Change password
│   └── /settings/delete    # Delete account
├── /auth/callback          # OAuth callback handler
└── /api/                   # API routes
    ├── /api/auth/session   # Session info endpoint
    ├── /api/auth/logout    # Logout endpoint
    └── /api/profile        # Profile CRUD
```

### 3.2 Page Specifications

#### `/login` — Login Page

**Purpose:** Authenticate existing users

**Components:**
- Email input field
- Password input field
- "Forgot password?" link
- "Log in" button
- Divider with "or continue with"
- Google OAuth button
- GitHub OAuth button
- "Don't have an account? Sign up" link

**Behavior:**
- If `?redirect=` query param exists, store it for post-login redirect
- On successful login, set `bfeai_session` cookie and redirect to stored URL or bfeai.com
- Show inline validation errors
- Show toast for server errors

**URL Parameters:**
- `redirect` (optional): URL to redirect to after successful login

---

#### `/signup` — Registration Page

**Purpose:** Create new user accounts

**Components:**
- Full name input field
- Email input field
- Password input field (with strength indicator)
- "Create account" button
- Divider with "or continue with"
- Google OAuth button
- GitHub OAuth button
- "Already have an account? Log in" link
- Terms of service / privacy policy links

**Behavior:**
- Validate password meets requirements (min 8 chars, 1 uppercase, 1 number)
- On successful signup, create profile record, set cookie, redirect
- If `?redirect=` exists, use it for post-signup redirect

**URL Parameters:**
- `redirect` (optional): URL to redirect to after successful signup

---

#### `/forgot-password` — Password Reset Request

**Purpose:** Initiate password reset flow

**Components:**
- Email input field
- "Send reset link" button
- "Back to login" link
- Success message (shown after submission)

**Behavior:**
- Submit email to Supabase password reset
- Always show success message (don't reveal if email exists)
- Rate limit: 3 requests per email per hour

---

#### `/reset-password` — Password Reset Form

**Purpose:** Set new password via reset token

**Components:**
- New password input field
- Confirm password input field
- "Reset password" button

**Behavior:**
- Validate token from URL (Supabase handles this)
- Validate password requirements
- Validate passwords match
- On success, redirect to /login with success toast

**URL Parameters:**
- Token parameters added by Supabase email link

---

#### `/profile` — User Profile (Protected)

**Purpose:** View and edit user profile

**Components:**
- Avatar display with upload button
- Display name (editable)
- Email (read-only, displayed)
- Company name (editable)
- Industry dropdown (editable)
- "Save changes" button
- Navigation to /settings

**Behavior:**
- Load profile data on mount
- Optimistic UI updates
- Show success toast on save
- Avatar uploads to Supabase Storage

---

#### `/settings` — Account Settings (Protected)

**Purpose:** Manage account security and preferences

**Components:**
- Section: Change Password (link to /settings/password)
- Section: Connected Accounts (show Google/GitHub status)
- Section: Delete Account (link to /settings/delete)
- Section: Active Sessions (future enhancement)

---

#### `/settings/password` — Change Password (Protected)

**Purpose:** Allow users to change their password

**Components:**
- Current password input
- New password input
- Confirm new password input
- "Update password" button
- "Cancel" link

**Behavior:**
- Verify current password
- Validate new password requirements
- Update password via Supabase
- Show success and redirect to /settings

---

#### `/settings/delete` — Delete Account (Protected)

**Purpose:** Allow users to permanently delete their account

**Components:**
- Warning message explaining consequences
- Text: "Type DELETE to confirm"
- Confirmation input field
- Password input (for verification)
- "Delete my account" button (danger style)
- "Cancel" link

**Behavior:**
- Require user to type "DELETE"
- Require password confirmation
- Soft delete: mark account as deleted, schedule hard delete in 30 days
- Clear session cookie
- Redirect to bfeai.com with goodbye message

---

## 4. Authentication Flows

### 4.1 Email/Password Login Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     EMAIL/PASSWORD LOGIN FLOW                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User enters email + password on /login                           │
│                     │                                                │
│                     ▼                                                │
│  2. Client calls Supabase signInWithPassword()                       │
│                     │                                                │
│           ┌─────────┴─────────┐                                      │
│           ▼                   ▼                                      │
│     3a. SUCCESS          3b. FAILURE                                 │
│           │                   │                                      │
│           ▼                   ▼                                      │
│  4a. Get user data    4b. Show error message                         │
│      from Supabase        "Invalid credentials"                      │
│           │                                                          │
│           ▼                                                          │
│  5. Generate JWT with user data + subscription info                  │
│           │                                                          │
│           ▼                                                          │
│  6. Set bfeai_session cookie (domain: .bfeai.com)                    │
│           │                                                          │
│           ▼                                                          │
│  7. Redirect to ?redirect param OR https://bfeai.com                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 OAuth Login Flow (Google/GitHub)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        OAUTH LOGIN FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User clicks "Continue with Google/GitHub" on /login              │
│                     │                                                │
│                     ▼                                                │
│  2. Store ?redirect param in localStorage (if present)               │
│                     │                                                │
│                     ▼                                                │
│  3. Call Supabase signInWithOAuth({ provider: 'google'|'github' })   │
│                     │                                                │
│                     ▼                                                │
│  4. User redirected to OAuth provider consent screen                 │
│                     │                                                │
│                     ▼                                                │
│  5. User authorizes → Provider redirects to /auth/callback           │
│                     │                                                │
│                     ▼                                                │
│  6. /auth/callback exchanges code for session via Supabase           │
│                     │                                                │
│           ┌─────────┴─────────┐                                      │
│           ▼                   ▼                                      │
│     7a. New User         7b. Existing User                           │
│           │                   │                                      │
│           ▼                   │                                      │
│  8a. Create profile           │                                      │
│      record with              │                                      │
│      OAuth data               │                                      │
│           │                   │                                      │
│           └─────────┬─────────┘                                      │
│                     ▼                                                │
│  9. Generate JWT, set bfeai_session cookie                           │
│                     │                                                │
│                     ▼                                                │
│  10. Retrieve redirect from localStorage                             │
│                     │                                                │
│                     ▼                                                │
│  11. Redirect to stored URL OR https://bfeai.com                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 Password Reset Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     PASSWORD RESET FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User enters email on /forgot-password                            │
│                     │                                                │
│                     ▼                                                │
│  2. Call Supabase resetPasswordForEmail(email)                       │
│                     │                                                │
│                     ▼                                                │
│  3. Show success message (always, for security)                      │
│     "If an account exists, you'll receive an email"                  │
│                     │                                                │
│                     ▼                                                │
│  4. User receives email with reset link                              │
│     Link: accounts.bfeai.com/reset-password?token=xxx                │
│                     │                                                │
│                     ▼                                                │
│  5. User clicks link → arrives at /reset-password                    │
│                     │                                                │
│                     ▼                                                │
│  6. User enters new password + confirmation                          │
│                     │                                                │
│                     ▼                                                │
│  7. Call Supabase updateUser({ password: newPassword })              │
│                     │                                                │
│                     ▼                                                │
│  8. Redirect to /login with success toast                            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.4 Logout Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         LOGOUT FLOW                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User clicks "Logout" (from any app or accounts.bfeai.com)        │
│                     │                                                │
│                     ▼                                                │
│  2. Call accounts.bfeai.com/api/auth/logout                          │
│                     │                                                │
│                     ▼                                                │
│  3. Server calls Supabase signOut()                                  │
│                     │                                                │
│                     ▼                                                │
│  4. Server clears bfeai_session cookie                               │
│     Set-Cookie: bfeai_session=; Domain=.bfeai.com; Max-Age=0         │
│                     │                                                │
│                     ▼                                                │
│  5. Redirect to bfeai.com OR provided redirect URL                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema

accounts.bfeai.com uses the shared Supabase project. User authentication is managed by Supabase Auth (`auth.users`), and extended profile data is stored in `public.profiles`.

### 5.1 Profiles Table

```sql
-- Table: public.profiles
-- Purpose: Extended user profile data beyond Supabase auth.users
-- Note: This table should already exist per the main PRD. 
-- Verify these columns exist or add them.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Business info
  company TEXT,
  industry TEXT,
  
  -- OAuth metadata
  oauth_provider TEXT, -- 'google', 'github', or NULL for email/password
  oauth_provider_id TEXT,
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ, -- Soft delete timestamp
  deletion_scheduled_at TIMESTAMPTZ, -- Hard delete scheduled time
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Index for soft-deleted accounts cleanup job
CREATE INDEX IF NOT EXISTS idx_profiles_deletion ON public.profiles(deletion_scheduled_at) 
  WHERE deletion_scheduled_at IS NOT NULL;

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access" ON public.profiles
  USING (auth.role() = 'service_role');
```

### 5.2 Industry Options

Store as an enum or reference table for the industry dropdown:

```sql
-- Option A: Check constraint with allowed values
ALTER TABLE public.profiles 
  ADD CONSTRAINT valid_industry CHECK (
    industry IS NULL OR industry IN (
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
      'other'
    )
  );
```

### 5.3 Profile Trigger for Updated Timestamp

```sql
-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 5.4 Profile Creation Trigger (on signup)

```sql
-- Automatically create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, oauth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_app_meta_data->>'provider'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

---

## 6. API Endpoints

### 6.1 Session Endpoint

**`GET /api/auth/session`**

Returns the current user's session information. Used by other apps to validate the SSO cookie.

```typescript
// Request
GET https://accounts.bfeai.com/api/auth/session
Cookie: bfeai_session=<jwt_token>

// Response 200 OK
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://...",
    "company": "Acme Inc",
    "industry": "saas_software"
  },
  "session": {
    "expires_at": "2025-01-20T00:00:00Z"
  }
}

// Response 401 Unauthorized
{
  "error": "No valid session"
}
```

### 6.2 Logout Endpoint

**`POST /api/auth/logout`**

Ends the user's session and clears the SSO cookie.

```typescript
// Request
POST https://accounts.bfeai.com/api/auth/logout
Cookie: bfeai_session=<jwt_token>

// Optional body
{
  "redirect": "https://keywords.bfeai.com"
}

// Response 200 OK
{
  "success": true,
  "redirect": "https://bfeai.com"
}
// Also sets: Set-Cookie: bfeai_session=; Domain=.bfeai.com; Max-Age=0
```

### 6.3 Profile Endpoints

**`GET /api/profile`**

Get current user's profile.

```typescript
// Request
GET https://accounts.bfeai.com/api/profile
Cookie: bfeai_session=<jwt_token>

// Response 200 OK
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://...",
  "company": "Acme Inc",
  "industry": "saas_software",
  "oauth_provider": "google",
  "created_at": "2025-01-01T00:00:00Z"
}
```

**`PATCH /api/profile`**

Update current user's profile.

```typescript
// Request
PATCH https://accounts.bfeai.com/api/profile
Cookie: bfeai_session=<jwt_token>
Content-Type: application/json

{
  "full_name": "Jane Doe",
  "company": "New Company",
  "industry": "marketing_advertising"
}

// Response 200 OK
{
  "success": true,
  "profile": { /* updated profile */ }
}

// Response 400 Bad Request
{
  "error": "Invalid industry value"
}
```

**`POST /api/profile/avatar`**

Upload user avatar.

```typescript
// Request
POST https://accounts.bfeai.com/api/profile/avatar
Cookie: bfeai_session=<jwt_token>
Content-Type: multipart/form-data

file: <image file>

// Response 200 OK
{
  "success": true,
  "avatar_url": "https://wmhnkxkyettbeeamuppz.supabase.co/storage/v1/object/public/avatars/uuid.jpg"
}

// Response 400 Bad Request
{
  "error": "File too large. Maximum size is 2MB."
}
```

### 6.4 Account Deletion Endpoint

**`POST /api/account/delete`**

Schedule account for deletion.

```typescript
// Request
POST https://accounts.bfeai.com/api/account/delete
Cookie: bfeai_session=<jwt_token>
Content-Type: application/json

{
  "password": "current_password",
  "confirmation": "DELETE"
}

// Response 200 OK
{
  "success": true,
  "message": "Account scheduled for deletion in 30 days",
  "deletion_date": "2025-02-13T00:00:00Z"
}

// Response 400 Bad Request
{
  "error": "Invalid confirmation text"
}

// Response 401 Unauthorized
{
  "error": "Invalid password"
}
```

---

## 7. UI/UX Specifications

### 7.1 Design System

**Framework:** Tailwind CSS + shadcn/ui

**Why shadcn/ui:**
- Accessible by default (ARIA compliant)
- Highly customizable (not a black-box component library)
- Copy-paste components (no package dependency lock-in)
- Built on Radix UI primitives
- Excellent TypeScript support
- Modern, clean aesthetic

### 7.2 Color Palette

```css
/* Primary brand colors - customize as needed */
:root {
  --primary: 222.2 47.4% 11.2%;        /* Dark blue-gray */
  --primary-foreground: 210 40% 98%;   /* Light text on primary */
  
  --secondary: 210 40% 96%;            /* Light gray background */
  --secondary-foreground: 222.2 47.4% 11.2%;
  
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 47.4% 11.2%;
  
  --destructive: 0 84.2% 60.2%;        /* Red for danger actions */
  --destructive-foreground: 210 40% 98%;
  
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 47.4% 11.2%;
  
  --radius: 0.5rem;
}
```

### 7.3 Typography

```css
/* Font stack */
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Scale */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
```

### 7.4 Component Specifications

#### Login/Signup Forms

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    [BFEAI Logo]                         │
│                                                         │
│              Welcome back / Create account              │
│           Sign in to continue to BFEAI                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Email                                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Password                                   👁   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Forgot password?]                                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Sign in / Create account            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ───────────────── or continue with ──────────────────  │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │   🔷 Google      │  │   🐙 GitHub      │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│        Don't have an account? Sign up                   │
│        Already have an account? Sign in                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### Profile Page

```
┌─────────────────────────────────────────────────────────┐
│  [← Back]                              [BFEAI Logo]     │
│─────────────────────────────────────────────────────────│
│                                                         │
│  ┌───────┐                                              │
│  │       │   John Doe                                   │
│  │ Avatar│   john@example.com                           │
│  │       │   [Change photo]                             │
│  └───────┘                                              │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Display Name                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  John Doe                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Company                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Acme Inc                                       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Industry                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  SaaS / Software                            ▼   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Save Changes                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Account Settings →]                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.5 Responsive Breakpoints

```css
/* Tailwind defaults */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### 7.6 Loading States

- Use skeleton loaders for initial page loads
- Use spinner for button actions
- Disable buttons during async operations
- Show inline validation as user types (debounced)

### 7.7 Error Handling UI

- Inline field errors below inputs (red text, red border)
- Toast notifications for server errors (top-right, auto-dismiss 5s)
- Full-page error state for critical failures

---

## 8. Security Requirements

### 8.1 Password Requirements

```typescript
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional for v1
};

// Regex pattern
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
```

### 8.2 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 attempts | per minute per IP |
| `/api/auth/signup` | 3 attempts | per minute per IP |
| `/api/auth/forgot-password` | 3 attempts | per hour per email |
| `/api/profile/avatar` | 10 uploads | per hour per user |
| All other endpoints | 60 requests | per minute per user |

### 8.3 Input Validation

All inputs must be validated server-side using Zod:

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  full_name: z.string().min(1, 'Name is required').max(100),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  company: z.string().max(100).optional(),
  industry: z.enum([
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
  ]).optional(),
});
```

### 8.4 CSRF Protection

- Generate CSRF token on page load
- Include token in all POST/PATCH/DELETE requests
- Validate token server-side
- Use `SameSite=lax` on session cookie as additional protection

### 8.5 Security Headers

Configure in `next.config.js` or Netlify headers:

```javascript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];
```

### 8.6 Avatar Upload Security

- Max file size: 2MB
- Allowed types: image/jpeg, image/png, image/gif, image/webp
- Scan for malicious content (basic MIME type validation)
- Store in Supabase Storage with public read access
- Generate unique filename (UUID) to prevent enumeration

---

## 9. Environment Variables

### 9.1 Required Variables

```env
# ============================================
# App Identity
# ============================================
NEXT_PUBLIC_APP_NAME=accounts
NEXT_PUBLIC_APP_URL=https://accounts.bfeai.com

# ============================================
# BFEAI Ecosystem URLs
# ============================================
NEXT_PUBLIC_MAIN_SITE_URL=https://bfeai.com
NEXT_PUBLIC_PAYMENTS_URL=https://payments.bfeai.com

# ============================================
# Supabase Configuration
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# ============================================
# JWT Configuration
# ============================================
JWT_SECRET=<minimum_32_character_secret>

# ============================================
# OAuth Configuration
# ============================================
# Google OAuth (configured in Supabase dashboard)
GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>

# GitHub OAuth (configured in Supabase dashboard)
GITHUB_CLIENT_ID=<github_client_id>
GITHUB_CLIENT_SECRET=<github_client_secret>
```

### 9.2 Optional Variables

```env
# ============================================
# Rate Limiting (Upstash Redis)
# ============================================
UPSTASH_REDIS_URL=<redis_url>
UPSTASH_REDIS_TOKEN=<redis_token>

# ============================================
# Monitoring
# ============================================
SENTRY_DSN=<sentry_dsn>
NEXT_PUBLIC_SENTRY_DSN=<sentry_dsn>

# ============================================
# Development
# ============================================
NEXT_PUBLIC_USE_MOCK_AUTH=false
```

---

## 10. Deployment Configuration

### 10.1 Netlify Configuration

**`netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*.bfeai.com"
    Access-Control-Allow-Methods = "GET, POST, PATCH, DELETE, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization, X-CSRF-Token"
    Access-Control-Allow-Credentials = "true"
```

### 10.2 Domain Configuration

1. In Netlify dashboard, add custom domain: `accounts.bfeai.com`
2. Configure DNS (in your domain registrar):
   ```
   Type: CNAME
   Name: accounts
   Value: <netlify-site-name>.netlify.app
   ```
3. Enable HTTPS (automatic with Netlify)

### 10.3 Supabase OAuth Configuration

**Google OAuth Setup:**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://wmhnkxkyettbeeamuppz.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase dashboard → Authentication → Providers → Google

**GitHub OAuth Setup:**

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set callback URL: `https://wmhnkxkyettbeeamuppz.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase dashboard → Authentication → Providers → GitHub

---

## 11. Implementation Phases

### Phase 1: Core Authentication (Week 1)

**Goal:** Basic login/signup functionality with email/password

- [ ] Project setup (Next.js 14, Tailwind, shadcn/ui)
- [ ] Supabase client configuration
- [ ] `/login` page with email/password
- [ ] `/signup` page with email/password
- [ ] JWT cookie generation and setting
- [ ] Basic `/profile` page (view only)
- [ ] Redirect flow handling (`?redirect=` param)
- [ ] Logout functionality

**Deliverables:**
- Users can sign up and log in with email/password
- SSO cookie is set on `.bfeai.com` domain
- Users are redirected back to originating app

### Phase 2: OAuth Integration (Week 2)

**Goal:** Add Google and GitHub login options

- [ ] Google OAuth configuration
- [ ] GitHub OAuth configuration
- [ ] `/auth/callback` handler
- [ ] OAuth button components
- [ ] Profile creation from OAuth data
- [ ] Account linking (same email across providers)

**Deliverables:**
- Users can sign up/log in with Google
- Users can sign up/log in with GitHub
- OAuth users get profile auto-populated

### Phase 3: Password Management (Week 2)

**Goal:** Password reset and change functionality

- [ ] `/forgot-password` page
- [ ] `/reset-password` page
- [ ] `/settings/password` page
- [ ] Email templates for password reset
- [ ] Rate limiting for password reset

**Deliverables:**
- Users can reset forgotten passwords
- Users can change their password when logged in

### Phase 4: Profile Management (Week 3)

**Goal:** Full profile editing capabilities

- [ ] Profile update functionality
- [ ] Avatar upload to Supabase Storage
- [ ] Industry dropdown implementation
- [ ] Form validation with Zod
- [ ] Success/error toast notifications

**Deliverables:**
- Users can update name, company, industry
- Users can upload/change avatar

### Phase 5: Account Deletion (Week 3)

**Goal:** Self-service account deletion

- [ ] `/settings/delete` page with confirmation flow
- [ ] Soft delete implementation
- [ ] Session invalidation on deletion
- [ ] Scheduled hard delete job (30 days)

**Deliverables:**
- Users can request account deletion
- Accounts are soft-deleted with 30-day recovery window

### Phase 6: Polish & Security (Week 4)

**Goal:** Production-ready security and UX

- [ ] Rate limiting implementation
- [ ] CSRF protection
- [ ] Security headers
- [ ] Error handling improvements
- [ ] Loading states and skeletons
- [ ] Mobile responsive testing
- [ ] Cross-browser testing
- [ ] Integration testing with other apps

**Deliverables:**
- Production-ready security measures
- Polished user experience
- Verified SSO works with keywords.bfeai.com

---

## 12. Success Metrics

### 12.1 Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login success rate | > 95% | Successful logins / Total attempts |
| Signup completion rate | > 80% | Completed signups / Started signups |
| Password reset success | > 90% | Completed resets / Requested resets |
| OAuth adoption | > 50% | OAuth signups / Total signups |
| Session validity | 100% | Valid sessions / Total sessions |

### 12.2 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login page load time | < 2s | Time to interactive |
| Login API response | < 500ms | Server response time |
| OAuth redirect time | < 3s | Click to return |
| Profile update time | < 1s | Save to confirmation |

### 12.3 Security Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Failed login rate | < 10% | Failed / Total attempts |
| Rate limit triggers | < 1% | Blocked / Total requests |
| Security incidents | 0 | Breaches or exploits |

---

## 13. Testing Requirements

### 13.1 Unit Tests

- [ ] Password validation logic
- [ ] JWT generation and validation
- [ ] Input sanitization
- [ ] Profile update logic
- [ ] Rate limiting logic

### 13.2 Integration Tests

- [ ] Email/password signup flow
- [ ] Email/password login flow
- [ ] Google OAuth flow
- [ ] GitHub OAuth flow
- [ ] Password reset flow
- [ ] Profile update flow
- [ ] Logout flow
- [ ] Account deletion flow

### 13.3 E2E Tests (with Playwright or Cypress)

- [ ] Complete signup journey
- [ ] Complete login journey
- [ ] SSO redirect from keywords.bfeai.com
- [ ] SSO redirect from payments.bfeai.com
- [ ] Profile edit journey
- [ ] Password change journey
- [ ] Account deletion journey

### 13.4 Security Tests

- [ ] SQL injection attempts
- [ ] XSS attempts
- [ ] CSRF bypass attempts
- [ ] Rate limit bypass attempts
- [ ] Cookie manipulation attempts
- [ ] Session fixation attempts

---

## Document Control

**Version:** 1.0  
**Created:** January 2025  
**Author:** BFEAI Development Team  
**Status:** Ready for Implementation  

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2025 | Initial PRD |

### Related Documents

- `BFEAI_Complete_PRD_v1_1.md` — Parent ecosystem PRD
- `BFEAI_Developer_Integration_Guide.md` — How other apps integrate with accounts.bfeai.com

---

## Appendix A: File Structure

```
accounts-bfeai/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Redirect logic
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   ├── password/
│   │   │   │   └── page.tsx
│   │   │   └── delete/
│   │   │       └── page.tsx
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── session/
│   │       │   │   └── route.ts
│   │       │   └── logout/
│   │       │       └── route.ts
│   │       ├── profile/
│   │       │   ├── route.ts
│   │       │   └── avatar/
│   │       │       └── route.ts
│   │       └── account/
│   │           └── delete/
│   │               └── route.ts
│   ├── components/
│   │   ├── ui/                         # shadcn/ui components
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   ├── OAuthButtons.tsx
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   └── ResetPasswordForm.tsx
│   │   ├── profile/
│   │   │   ├── ProfileForm.tsx
│   │   │   ├── AvatarUpload.tsx
│   │   │   └── IndustrySelect.tsx
│   │   └── shared/
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Toast.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   ├── cookies.ts
│   │   │   └── session.ts
│   │   ├── validation/
│   │   │   └── schemas.ts
│   │   └── utils/
│   │       └── helpers.ts
│   └── styles/
│       └── globals.css
├── public/
│   └── logo.svg
├── middleware.ts
├── next.config.js
├── netlify.toml
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── .env.local
```

---

## Appendix B: Industry Options Reference

| Value | Display Label |
|-------|---------------|
| `marketing_advertising` | Marketing & Advertising |
| `ecommerce_retail` | E-commerce & Retail |
| `saas_software` | SaaS / Software |
| `agency` | Agency |
| `healthcare` | Healthcare |
| `finance` | Finance |
| `education` | Education |
| `real_estate` | Real Estate |
| `hospitality` | Hospitality |
| `manufacturing` | Manufacturing |
| `professional_services` | Professional Services |
| `nonprofit` | Nonprofit |
| `other` | Other |
