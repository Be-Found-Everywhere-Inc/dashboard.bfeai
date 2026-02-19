# OAuth Setup Guide for accounts.bfeai.com

This guide will walk you through setting up Google and GitHub OAuth authentication for the accounts.bfeai.com authentication service.

---

## Overview

The OAuth implementation is already complete in the codebase. You just need to:
1. Create OAuth applications with Google and GitHub
2. Add the credentials to your environment variables
3. Deploy to Netlify

**Important URLs:**
- Production: `https://accounts.bfeai.com`
- Production Callback: `https://accounts.bfeai.com/api/auth/callback/{provider}`
- Local: `http://localhost:3000`
- Local Callback: `http://localhost:3000/api/auth/callback/{provider}`

---

## Part 1: Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: "BFEAI Auth" (or similar)
4. Click **Create**

### Step 2: Enable Google+ API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Click **Create**

**App Information:**
- App name: `BFEAI Accounts`
- User support email: Your email
- Developer contact email: Your email

**Scopes:**
- Click **Add or Remove Scopes**
- Add: `email`, `profile`, `openid`
- Click **Save and Continue**

**Test Users (optional for development):**
- Add your email for testing
- Click **Save and Continue**

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "BFEAI Accounts - Production"

**Authorized redirect URIs:**
```
https://accounts.bfeai.com/api/auth/callback/google
```

**For local development, create a separate OAuth client:**
- Name: "BFEAI Accounts - Development"
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

5. Click **Create**
6. **Copy the Client ID and Client Secret** - you'll need these!

### Step 5: Add to Environment Variables

**Production (Netlify):**
```bash
GOOGLE_CLIENT_ID=your_production_client_id_here
GOOGLE_CLIENT_SECRET=your_production_client_secret_here
```

**Local (.env.local):**
```bash
GOOGLE_CLIENT_ID=your_development_client_id_here
GOOGLE_CLIENT_SECRET=your_development_client_secret_here
```

---

## Part 2: GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**

### Step 2: Register Application

**Production App:**
- Application name: `BFEAI Accounts (Production)`
- Homepage URL: `https://accounts.bfeai.com`
- Authorization callback URL: `https://accounts.bfeai.com/api/auth/callback/github`
- Click **Register application**

**Development App (optional):**
- Application name: `BFEAI Accounts (Development)`
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

### Step 3: Generate Client Secret

1. After creating the app, click **Generate a new client secret**
2. **Copy the Client ID and Client Secret** immediately - the secret won't be shown again!

### Step 4: Add to Environment Variables

**Production (Netlify):**
```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

**Local (.env.local):**
```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

---

## Part 3: Configure Netlify Environment Variables

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your **accounts-bfeai** site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable** for each:

```bash
GOOGLE_CLIENT_ID = your_production_google_client_id
GOOGLE_CLIENT_SECRET = your_production_google_client_secret
GITHUB_CLIENT_ID = your_github_client_id
GITHUB_CLIENT_SECRET = your_github_client_secret
```

5. Click **Save**
6. **Trigger a new deploy** to apply the changes

---

## Part 4: Testing OAuth Flow

### Local Testing

1. Update `.env.local` with your development credentials
2. Restart the dev server: `npm run dev`
3. Visit `http://localhost:3000/login`
4. Click **Sign in with Google** or **Sign in with GitHub**
5. Verify:
   - ✅ Redirects to provider's login page
   - ✅ After authentication, redirects back to `/profile`
   - ✅ Session cookie is set (`bfeai_session`)
   - ✅ User profile is created in database

### Production Testing

1. Visit `https://accounts.bfeai.com/login`
2. Click **Sign in with Google** or **Sign in with GitHub**
3. Verify:
   - ✅ Successful authentication
   - ✅ Redirected to profile page
   - ✅ No errors in Netlify logs

---

## OAuth Flow Architecture

### How It Works:

1. **User clicks OAuth button** → `/api/auth/oauth?provider=google`
2. **Server generates state** (CSRF protection) and redirects to provider
3. **User authenticates** at Google/GitHub
4. **Provider redirects back** → `/api/auth/callback/google?code=...&state=...`
5. **Server verifies state**, exchanges code for access token
6. **Server fetches user profile** from provider
7. **Server creates/updates user** in Supabase
8. **Server generates JWT** and sets session cookie
9. **User is redirected** to original destination

### Security Features:

- ✅ CSRF protection via state parameter
- ✅ Secure session cookies (httpOnly, secure, sameSite)
- ✅ Security event logging
- ✅ Account linking for existing users
- ✅ Email verification (OAuth emails are pre-verified)

---

## Troubleshooting

### "OAuth provider not configured" error

**Solution:** Environment variables are not set or incorrect
- Check `.env.local` for local development
- Check Netlify environment variables for production
- Restart dev server after updating `.env.local`
- Trigger new deploy after updating Netlify env vars

### "Redirect URI mismatch" error

**Solution:** The callback URL in your OAuth app doesn't match
- Google: Check **Authorized redirect URIs** in Google Cloud Console
- GitHub: Check **Authorization callback URL** in GitHub OAuth app settings
- Ensure URLs are exact (including https/http and port)

### "State mismatch - possible CSRF attack"

**Solution:** OAuth state cookie is missing or incorrect
- Clear browser cookies
- Try in incognito/private mode
- Check that cookies are enabled
- Verify cookie domain is set correctly

### User created but profile not updated

**Solution:** Check database trigger and permissions
- Verify `handle_new_user()` trigger exists in Supabase
- Check RLS policies on `profiles` table
- View logs in Supabase dashboard

### OAuth works locally but not in production

**Solution:** Environment variables or URLs mismatch
- Ensure production OAuth app uses `https://accounts.bfeai.com`
- Verify Netlify environment variables are set
- Check Netlify deploy logs for errors
- Verify cookie domain is set to `.bfeai.com` in production

---

## Monitoring

### Check OAuth Logs

**Supabase Dashboard:**
1. Go to your Supabase project
2. Navigate to **Table Editor** → **security_events**
3. Filter by event_type:
   - `OAUTH_LOGIN_SUCCESS` - Successful OAuth logins
   - `OAUTH_ERROR` - OAuth errors
   - `OAUTH_CSRF_ATTEMPT` - Possible CSRF attacks
   - `OAUTH_USER_CREATE_FAILED` - User creation failures

**Netlify Function Logs:**
1. Go to Netlify dashboard
2. Select your site → **Functions**
3. View logs for OAuth-related functions

---

## Next Steps

After OAuth is configured:

1. ✅ Test both Google and GitHub OAuth
2. ✅ Verify account linking works for existing users
3. ✅ Test redirect parameter (e.g., `/login?redirect=/settings`)
4. ✅ Monitor security events in Supabase
5. ✅ Set up error tracking (Sentry) for production
6. ✅ Test SSO cookie works across subdomains

---

## Security Best Practices

1. **Never commit credentials** to git
   - Use `.env.local` for local development
   - Use Netlify environment variables for production

2. **Use separate OAuth apps** for development and production
   - Development: localhost URLs
   - Production: accounts.bfeai.com URLs

3. **Regularly rotate secrets**
   - Google: Generate new client secret every 6 months
   - GitHub: Regenerate client secret periodically

4. **Monitor security events**
   - Review `security_events` table regularly
   - Set up alerts for `OAUTH_CSRF_ATTEMPT` events
   - Track failed OAuth attempts

5. **Keep OAuth scopes minimal**
   - Google: Only request email, profile, openid
   - GitHub: Only request user:email, read:user

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## Support

If you encounter issues not covered in this guide:

1. Check the Netlify deploy logs
2. Check the Supabase dashboard logs
3. Review the `security_events` table in Supabase
4. Test in incognito mode to rule out cookie issues
5. Verify all environment variables are set correctly
