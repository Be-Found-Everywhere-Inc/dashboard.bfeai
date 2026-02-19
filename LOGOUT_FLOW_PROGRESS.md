# Logout Flow Implementation Progress

**Date**: January 17, 2026
**Status**: ✅ RESOLVED

---

## What Was Accomplished

### 1. Created `/logout` Page Route
**File**: `app/logout/page.tsx`

- Client-side page that handles logout
- Calls `/api/auth/logout` POST endpoint
- Shows "Signing out..." spinner during logout
- Redirects to `/login?message=logged_out` after completion
- Uses Suspense boundary for `useSearchParams()` (required by Next.js)

### 2. Fixed Logout API Route
**File**: `app/api/auth/logout/route.ts`

**Changes made**:
- Changed from `cookies().set()` to manual `Set-Cookie` header
- Now matches the exact format used by login (`app/api/auth/set-sso-cookie/route.ts`)
- Both POST and GET handlers updated

**Cookie clearing format**:
```
bfeai_session=; Domain=.bfeai.com; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure
```

### 3. Deployed to Netlify
- All changes committed and pushed to `main` branch
- Deployed successfully to accounts.bfeai.com

---

## Current Issue

**Problem**: The logout flow redirects correctly to the login page, but the `bfeai_session` cookie is NOT being cleared. When navigating back to `payments.bfeai.com`, the user is still logged in.

**Evidence**:
- After logout, visiting `https://payments.bfeai.com/billing?_debug=1` shows:
  ```json
  {"decision":"allow","reason":"token_valid","pathname":"/billing","payload":{"userId":"c4f28428-a24c-4259-921b-13efe65139e1","exp":1769230463}}
  ```

**Possible Causes**:
1. The `Set-Cookie` header format for clearing might need to exactly match all attributes used when setting
2. Netlify might be stripping or modifying `Set-Cookie` headers
3. The redirect response might not preserve the `Set-Cookie` header

---

## Files Modified

| File | Change |
|------|--------|
| `app/logout/page.tsx` | **Created** - Logout page with Suspense boundary |
| `app/api/auth/logout/route.ts` | **Modified** - Use manual Set-Cookie headers |

---

## Test Credentials

- **Email**: ssotest@bfeai.com
- **Password**: TestPassword123!
- **User ID**: c4f28428-a24c-4259-921b-13efe65139e1

---

## How to Test

### Manual Browser Test:
1. Go to `https://payments.bfeai.com`
2. Log in if needed (will redirect to accounts.bfeai.com)
3. Click "Sign out" in sidebar
4. Should redirect to `https://accounts.bfeai.com/login?message=logged_out`
5. Try accessing `https://payments.bfeai.com/billing`
   - **Expected**: Redirect to login (cookie cleared)
   - **Actual**: Still shows billing page (cookie NOT cleared)

### Debug Mode:
- Add `?_debug=1` to any payments.bfeai.com URL to see middleware decision
- Example: `https://payments.bfeai.com/billing?_debug=1`

---

## Next Steps to Try

### Option 1: Check Netlify Logs
Look at Netlify function logs for accounts.bfeai.com to see if the `Set-Cookie` header is being sent.

### Option 2: Different Cookie Clearing Approach
Try using `Expires` header instead of `Max-Age=0`:
```javascript
const cookieParts = [
  'bfeai_session=',
  `Domain=${cookieDomain}`,
  'Path=/',
  'Expires=Thu, 01 Jan 1970 00:00:00 GMT',  // Use past date instead of Max-Age=0
  'HttpOnly',
  'SameSite=Lax',
  'Secure',
];
```

### Option 3: Compare with Login Cookie
Check browser DevTools to see exact cookie attributes when logged in:
1. Open DevTools → Application → Cookies → `.bfeai.com`
2. Note all attributes of `bfeai_session` cookie
3. Ensure logout clears with identical attributes

### Option 4: Clear from Payments App
Instead of relying on accounts.bfeai.com to clear the cookie, have payments.bfeai.com clear it before redirecting to accounts.bfeai.com/logout.

---

## Related Files Reference

### Login Cookie Setting
**File**: `app/api/auth/set-sso-cookie/route.ts`
```javascript
const cookieParts = [
  `bfeai_session=${token}`,
  `Domain=${cookieDomain}`,
  `Path=/`,
  `Max-Age=${maxAge}`,
  'HttpOnly',
  'SameSite=Lax',
  'Secure',  // if production
];
```

### Payments Sign Out Button
The "Sign out" button in payments.bfeai.com redirects to:
`https://accounts.bfeai.com/logout`

---

## Git Commits Made

1. `2dd3637` - Add /logout page route for SSO logout flow
2. `4deca70` - fix: Add Suspense boundary for useSearchParams in logout page
3. `7427cbf` - fix: Use response.cookies for proper cookie clearing in logout
4. `a482160` - fix: Use manual Set-Cookie header for logout (matches login format)

---

## Environment Info

- **accounts.bfeai.com**: Netlify site ID `02522cb0-e8d0-4a4e-b76a-1cd1d95b6b3e`
- **payments.bfeai.com**: Netlify site ID `d17ddb77-4281-496d-9eea-ea5137279fae`
- **Supabase**: `https://wmhnkxkyettbeeamuppz.supabase.co`

---

## What's Working

- ✅ Login flow (accounts → payments SSO)
- ✅ Session cookie set correctly on login
- ✅ Protected routes redirect to login when no cookie
- ✅ `/logout` page renders and calls API
- ✅ Logout API returns success response
- ✅ Redirect to login page after logout
- ✅ **Cookie properly cleared after logout** (FIXED!)
- ✅ **User logged out on all *.bfeai.com subdomains** (FIXED!)

---

## Resolution (January 17, 2026)

### Root Cause
The logout route was using manual `Set-Cookie` headers while the login route used the Next.js `cookies()` API. This inconsistency caused the cookie not to be cleared properly.

### Fix Applied
Updated `app/api/auth/logout/route.ts` to use both methods:

1. **Primary**: Next.js `cookies()` API (same as login route)
   ```javascript
   const cookieStore = await cookies();
   cookieStore.set('bfeai_session', '', {
     domain: '.bfeai.com',
     httpOnly: true,
     secure: isProduction,
     sameSite: 'lax',
     maxAge: 0,
     path: '/',
   });
   ```

2. **Backup**: Manual `Set-Cookie` header with both `Max-Age=0` AND `Expires` for browser compatibility

### Commit
- `09e383c` - fix: Use Next.js cookies API for cookie clearing (matches login method)

### Verification
Tested on production (accounts.bfeai.com):
1. Logged in to payments.bfeai.com
2. Clicked "Sign out" → redirected to accounts.bfeai.com/login
3. Navigated to payments.bfeai.com/billing → **correctly redirected to login page**
4. Cookie was properly cleared across all subdomains
