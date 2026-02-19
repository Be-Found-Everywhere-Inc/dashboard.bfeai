# OAuth Setup Guide - Supabase Native

This guide shows you how to enable OAuth authentication using **Supabase's built-in OAuth providers**. This is simpler than managing OAuth apps manually.

---

## Overview

Your accounts.bfeai project is already configured to work with Supabase Auth. You just need to:

1. Enable OAuth providers in Supabase Dashboard
2. Get the OAuth credentials from Google/GitHub
3. Add them to Supabase
4. The code will automatically work ✅

**Database Schema (Already Configured):**
- `auth.users` - Supabase's built-in user table
- `public.profiles` - Extended profile with:
  - `oauth_provider` (google/github)
  - `oauth_provider_id` (provider's user ID)
  - Plus other custom fields (company, industry, etc.)

---

## Step 1: Access Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **wmhnkxkyettbeeamuppz**
3. Navigate to **Authentication** → **Providers**

---

## Step 2: Enable Google OAuth

### 2.1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable **Google+ API**:
   - Go to **APIs & Services** → **Library**
   - Search "Google+ API" → **Enable**

4. Configure OAuth Consent Screen:
   - **APIs & Services** → **OAuth consent screen**
   - Select **External** → **Create**
   - App name: `BFEAI Accounts`
   - Add scopes: `email`, `profile`, `openid`
   - Save

5. Create OAuth Client:
   - **APIs & Services** → **Credentials**
   - **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `BFEAI - Supabase`

   **Authorized redirect URIs - ADD THIS EXACT URL:**
   ```
   https://wmhnkxkyettbeeamuppz.supabase.co/auth/v1/callback
   ```

   6. Copy the **Client ID** and **Client Secret**

### 2.2: Add Google to Supabase

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** in the provider list
3. **Enable** the toggle
4. Paste your **Client ID**
5. Paste your **Client Secret**
6. Click **Save**

---

## Step 3: Enable GitHub OAuth

### 3.1: Get GitHub OAuth Credentials

1. Go to [GitHub Settings → Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**

**Application details:**
- Application name: `BFEAI Accounts`
- Homepage URL: `https://accounts.bfeai.com`
- **Authorization callback URL - ADD THIS EXACT URL:**
  ```
  https://wmhnkxkyettbeeamuppz.supabase.co/auth/v1/callback
  ```

3. Click **Register application**
4. Click **Generate a new client secret**
5. Copy the **Client ID** and **Client Secret**

### 3.2: Add GitHub to Supabase

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **GitHub** in the provider list
3. **Enable** the toggle
4. Paste your **Client ID**
5. Paste your **Client Secret**
6. Click **Save**

---

## Step 4: Update Your Code (Already Done!)

The OAuth flow is already implemented in your codebase:

**✅ API Routes:**
- `/api/auth/oauth` - Initiates OAuth flow
- `/api/auth/callback/[provider]` - Handles OAuth callback

**✅ UI Components:**
- Login page has Google and GitHub buttons
- Signup page has Google and GitHub buttons

**✅ Database Integration:**
- Creates/updates users in `auth.users`
- Syncs profile data to `public.profiles`
- Sets `oauth_provider` and `oauth_provider_id` fields

However, we need to update the OAuth library to use Supabase's OAuth endpoints. Let me check the current implementation...

Actually, looking at the code again, it's using direct OAuth integration (not Supabase's OAuth). We need to update it to use Supabase Auth's built-in OAuth methods for a simpler implementation.

---

## Step 5: Update OAuth Implementation to Use Supabase Auth

The current implementation uses direct OAuth calls. Let's update it to use Supabase's built-in OAuth which is simpler and more maintainable.

### Update `/api/auth/oauth/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get('provider');

    if (!provider || (provider !== 'google' && provider !== 'github')) {
      return NextResponse.json(
        { error: 'Invalid OAuth provider' },
        { status: 400 }
      );
    }

    const redirect = request.nextUrl.searchParams.get('redirect') || '/profile';
    const supabase = await createClient();

    // Use Supabase's built-in OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/${provider}?redirect=${encodeURIComponent(redirect)}`,
        scopes: provider === 'github' ? 'user:email read:user' : 'email profile openid'
      }
    });

    if (error) {
      console.error('[OAuth] Error:', error);
      return NextResponse.json(
        { error: 'Failed to initiate OAuth' },
        { status: 500 }
      );
    }

    // Redirect to provider's OAuth page
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error('[OAuth] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Update `/api/auth/callback/[provider]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { JWTService } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const code = request.nextUrl.searchParams.get('code');
    const redirect = request.nextUrl.searchParams.get('redirect') || '/profile';

    if (!code) {
      return NextResponse.redirect(
        new URL('/login?error=oauth_failed', request.url)
      );
    }

    const supabase = await createClient();

    // Exchange code for session using Supabase
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !session) {
      console.error('[OAuth] Session exchange failed:', error);
      return NextResponse.redirect(
        new URL('/login?error=oauth_failed', request.url)
      );
    }

    // Get user profile
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=oauth_failed', request.url)
      );
    }

    // Update profile with OAuth info (will be auto-created by trigger if new user)
    await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        oauth_provider: provider,
        oauth_provider_id: user.user_metadata?.provider_id || user.user_metadata?.sub,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

    // Generate JWT for SSO
    const token = JWTService.generateSSOToken(
      user.id,
      user.email!,
      'user'
    );

    // Set session cookie
    const domain = process.env.NODE_ENV === 'production' ? '.bfeai.com' : 'localhost';
    const response = NextResponse.redirect(new URL(redirect, request.url));

    response.cookies.set('bfeai_session', token, {
      domain,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=oauth_failed', request.url)
    );
  }
}
```

---

## Benefits of Supabase Native OAuth

✅ **Simpler Code** - Let Supabase handle token exchange
✅ **Automatic Session Management** - Supabase manages refresh tokens
✅ **Better Security** - OAuth secrets never exposed to frontend
✅ **Easy Testing** - Test OAuth in Supabase dashboard
✅ **Built-in RLS Support** - Works seamlessly with Row Level Security

---

## Testing

### Local Testing
1. Make sure `.env.local` has:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://wmhnkxkyettbeeamuppz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. Start dev server: `npm run dev`
3. Go to `http://localhost:3000/login`
4. Click "Sign in with Google" or "Sign in with GitHub"

### Production Testing
1. Go to `https://accounts.bfeai.com/login`
2. Click OAuth buttons
3. Verify authentication works

---

## Monitoring

Check authentication logs in Supabase:
1. **Dashboard** → **Authentication** → **Users**
2. See new users created via OAuth
3. Check `public.profiles` table for synced data

---

## Troubleshooting

### "OAuth provider not configured"
- Enable the provider in Supabase Dashboard → Authentication → Providers
- Make sure Client ID and Secret are entered correctly

### "Redirect URI mismatch"
- Ensure you used the exact Supabase callback URL:
  `https://wmhnkxkyettbeeamuppz.supabase.co/auth/v1/callback`

### OAuth works but no profile created
- Check the database trigger `handle_new_user()` exists
- Verify RLS policies allow profile inserts

---

## Next Steps

1. ✅ Enable Google OAuth in Supabase Dashboard
2. ✅ Enable GitHub OAuth in Supabase Dashboard
3. ✅ Update API routes to use Supabase OAuth (see code above)
4. ✅ Test OAuth flow locally
5. ✅ Deploy to production
6. ✅ Test on live site

---

This approach is much simpler than managing OAuth apps manually and leverages Supabase's battle-tested authentication infrastructure.
