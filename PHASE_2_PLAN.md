# Phase 2 Implementation Plan
**Project:** accounts.bfeai - Authentication Service
**Date:** 2026-01-14
**Status:** Planning
**Based On:** Phase 1 Testing Results

---

## Executive Summary

Phase 1 is **COMPLETE and STABLE** with all core authentication working:
- ✅ Login functionality with JWT SSO cookies
- ✅ Security event logging
- ✅ Database schema and migrations
- ✅ shadcn/ui component library
- ✅ 10/17 E2E tests passing (59%)

**Phase 2 Focus:** Build the remaining authentication features to make this a complete, production-ready auth service.

---

## Phase 2 Priorities

### Priority Tier 1 (P0) - Critical for Production

#### 1. Logout Functionality
**Why Critical:** Users need to be able to sign out securely

**Tasks:**
- [ ] Create `/api/auth/logout` endpoint
  - Clear `bfeai_session` cookie
  - Invalidate JWT token (optional: add to revocation list)
  - Log security event (LOGOUT_SUCCESS)
  - Return 200 with success message

- [ ] Add logout button to UI
  - Add to profile page
  - Add to navigation/header
  - Use data-testid="logout-button"
  - Handle loading state

- [ ] Update E2E tests
  - Fix test selector syntax error
  - Verify cookie is cleared
  - Verify redirect to login page

**Files to Create/Modify:**
- `app/api/auth/logout/route.ts` (new)
- `app/profile/page.tsx` (add logout button)
- `components/Header.tsx` (add logout to nav, if exists)
- `tests/e2e/profile.spec.ts` (fix syntax)

**Estimated Effort:** 2-3 hours

---

#### 2. Protected Routes Middleware
**Why Critical:** Prevent unauthorized access to protected pages

**Tasks:**
- [ ] Create Next.js middleware
  - Check for `bfeai_session` cookie
  - Verify JWT token is valid and not expired
  - Allow access to protected routes
  - Redirect to login if no valid session

- [ ] Configure protected routes
  - `/profile` → requires auth
  - `/settings/*` → requires auth
  - `/api/profile/*` → requires auth
  - Public: `/`, `/login`, `/signup`, `/reset-password`

- [ ] Add redirect parameter
  - Preserve original URL: `/login?redirect=/profile`
  - Redirect back after successful login

**Files to Create/Modify:**
- `middleware.ts` (new, at root)
- `lib/auth/session.ts` (verify token helper)
- Update login route to handle redirect param

**Estimated Effort:** 3-4 hours

---

#### 3. Session Verification Endpoint
**Why Critical:** Allow other apps to verify authentication

**Tasks:**
- [ ] Create `/api/auth/session` endpoint
  - GET request to check if user is logged in
  - Verify JWT token from cookie
  - Return user data if valid (id, email, role)
  - Return 401 if invalid/expired

- [ ] Add to shared auth library
  - Create `verifySession()` helper
  - Co-founders can use this in their apps
  - Update integration guide

**Files to Create:**
- `app/api/auth/session/route.ts`
- Update `shared-auth-library/authHelpers.ts`
- Update `BFEAI_Developer_Integration_Guide.md`

**Estimated Effort:** 2 hours

---

### Priority Tier 2 (P1) - Important for Full Feature Set

#### 4. Signup Flow
**Why Important:** Users need to create accounts

**Tasks:**
- [ ] Create `/signup` page
  - Form with: email, password, confirm password, full name, company (optional)
  - Form validation with Zod
  - Password strength indicator
  - Terms of service checkbox
  - "Already have an account?" link to login

- [ ] Create `/api/auth/signup` endpoint
  - Validate input with Zod
  - Create user via Supabase Auth
  - Create profile record (trigger should auto-create)
  - Send welcome email (if email service configured)
  - Log security event (SIGNUP_SUCCESS)
  - Set JWT cookie (auto-login after signup)
  - Return user data

- [ ] Add E2E tests
  - Successful signup
  - Email already exists error
  - Password mismatch error
  - Form validation

**Files to Create:**
- `app/signup/page.tsx`
- `app/api/auth/signup/route.ts`
- `tests/e2e/signup.spec.ts`
- Update Zod schemas in `lib/validation/schemas.ts`

**Estimated Effort:** 4-6 hours

---

#### 5. Password Reset Flow
**Why Important:** Users forget passwords

**Tasks:**
- [ ] Create `/forgot-password` page
  - Email input form
  - Submit → send reset email
  - Success message with instructions

- [ ] Create `/reset-password` page
  - Token validation (from email link)
  - New password form
  - Password strength indicator
  - Submit → update password

- [ ] Create `/api/auth/forgot-password` endpoint
  - Validate email exists
  - Generate reset token (Supabase handles this)
  - Send email with reset link
  - Log security event

- [ ] Create `/api/auth/reset-password` endpoint
  - Verify reset token
  - Update password
  - Invalidate token
  - Log security event

- [ ] Email templates (if using custom emails)
  - Password reset email
  - Password changed confirmation

**Files to Create:**
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/api/auth/forgot-password/route.ts`
- `app/api/auth/reset-password/route.ts`
- Email templates (if needed)

**Estimated Effort:** 6-8 hours

---

#### 6. Profile Management
**Why Important:** Users need to view/edit their profiles

**Tasks:**
- [ ] Implement `/profile` page (currently placeholder)
  - Display user information
    - Full name
    - Email
    - Company
    - Industry
    - Account created date
  - Edit button → enable editing
  - Save changes → update profile

- [ ] Create profile edit form
  - Input fields for all editable fields
  - Validation with Zod
  - Loading states
  - Success/error toasts

- [ ] Create `/api/profile` endpoints
  - GET `/api/profile` → fetch user profile
  - PUT `/api/profile` → update profile
  - Require authentication via middleware

- [ ] Add E2E tests
  - Profile displays correct user info
  - Profile editing works
  - Validation errors shown

**Files to Modify:**
- `app/profile/page.tsx` (implement fully)
- `app/api/profile/route.ts` (new)
- `tests/e2e/profile.spec.ts` (fix failing tests)

**Estimated Effort:** 4-5 hours

---

### Priority Tier 3 (P2) - Nice to Have

#### 7. Account Settings
**Why Nice to Have:** Advanced user preferences

**Tasks:**
- [ ] Create `/settings` page
  - Profile settings (link to /profile)
  - Password change
  - Email preferences
  - Account deletion

- [ ] Create `/settings/password` page
  - Current password input
  - New password input
  - Confirm password
  - Submit → change password

- [ ] Create `/settings/delete` page
  - Warning message
  - Confirmation checkbox
  - Delete account button
  - Schedule deletion (30 days)

- [ ] Create API endpoints
  - POST `/api/account/change-password`
  - POST `/api/account/delete`

**Files to Create:**
- `app/settings/page.tsx`
- `app/settings/password/page.tsx`
- `app/settings/delete/page.tsx`
- `app/api/account/change-password/route.ts`
- `app/api/account/delete/route.ts`

**Estimated Effort:** 6-8 hours

---

#### 8. OAuth Integration (Google & GitHub)
**Why Nice to Have:** Social login convenience

**Tasks:**
- [ ] Configure OAuth providers in Supabase
  - Google OAuth app
  - GitHub OAuth app
  - Configure redirect URLs

- [ ] Add OAuth buttons to login/signup pages
  - "Continue with Google"
  - "Continue with GitHub"
  - Styled with provider branding

- [ ] Create `/api/auth/callback` endpoint
  - Handle OAuth callback
  - Create/update profile
  - Set JWT cookie
  - Redirect to app

- [ ] Handle account linking
  - Link OAuth to existing email account
  - Prevent duplicate accounts

**Files to Create/Modify:**
- `app/login/page.tsx` (add OAuth buttons)
- `app/signup/page.tsx` (add OAuth buttons)
- `app/api/auth/callback/route.ts` (new)
- Environment variables for OAuth credentials

**Estimated Effort:** 8-10 hours

---

#### 9. Test Improvements
**Why Nice to Have:** Better test coverage and reliability

**Tasks:**
- [ ] Fix test selector issues (3 tests)
  - Use `page.getByRole('alert')` for error messages
  - Remove ambiguous text regex selectors
  - Add data-testid attributes where needed

- [ ] Add more E2E tests
  - Signup flow tests
  - Password reset flow tests
  - Profile editing tests
  - Logout tests

- [ ] Add unit tests
  - JWT generation/verification
  - Cookie helpers
  - Validation schemas

**Files to Modify:**
- `tests/e2e/auth.spec.ts` (fix selectors)
- Create new test files for new features
- Add unit tests in `tests/unit/`

**Estimated Effort:** 4-6 hours

---

## Implementation Order

**Week 1 (P0 Features):**
1. Day 1-2: Logout functionality + middleware (6-8 hours)
2. Day 3: Session verification endpoint (2 hours)
3. Day 4-5: Testing and bug fixes

**Week 2 (P1 Features):**
1. Day 1-3: Signup flow (6 hours)
2. Day 4-5: Profile management (5 hours)
3. Weekend: Password reset flow (8 hours)

**Week 3 (P2 Features - Optional):**
1. Day 1-3: Account settings (8 hours)
2. Day 4-5: OAuth integration (10 hours)
3. Weekend: Test improvements (6 hours)

**Total Estimated Effort:** 55-65 hours (roughly 2-3 weeks of full-time work)

---

## Success Criteria

### Phase 2 is complete when:
- [ ] All 17 E2E tests passing (currently 10/17)
- [ ] Logout functionality works
- [ ] Protected routes enforced by middleware
- [ ] Signup flow complete and tested
- [ ] Password reset flow complete
- [ ] Profile page fully functional
- [ ] Session verification endpoint working
- [ ] Production build succeeds
- [ ] No TypeScript errors
- [ ] All security best practices followed

### Optional (P2):
- [ ] Account settings functional
- [ ] OAuth integration working
- [ ] 30+ E2E tests (from 17)
- [ ] Unit tests added

---

## Dependencies

**Required for Phase 2:**
- ✅ Supabase credentials (already configured)
- ✅ JWT secrets (already configured)
- ⚠️ Email service (SendGrid/Postmark/AWS SES) - Optional but recommended
- ⚠️ OAuth credentials (Google, GitHub) - Only if implementing P2 OAuth

**Current Status:**
- Supabase: ✅ Configured
- JWT: ✅ Configured
- Email: ❌ Not configured (use Supabase built-in for now)
- OAuth: ❌ Not configured

---

## Risk Assessment

**Low Risk:**
- Logout, middleware, session verification (straightforward features)
- Profile management (database already has schema)

**Medium Risk:**
- Signup flow (needs email verification consideration)
- Password reset (email dependency)
- Test improvements (time-consuming)

**High Risk:**
- OAuth integration (complex, provider-dependent)
- Account deletion (data compliance, reversibility)

---

## Rollout Strategy

### Option A: Feature Flags (Recommended)
Deploy Phase 2 features incrementally with environment flags:
```env
FEATURE_SIGNUP_ENABLED=true
FEATURE_PASSWORD_RESET_ENABLED=true
FEATURE_OAUTH_ENABLED=false
```

**Benefits:**
- Test features in production without enabling for all users
- Gradual rollout
- Easy rollback if issues found

### Option B: Big Bang Deploy
Deploy all Phase 2 features at once after complete testing.

**Recommendation:** Use Option A with feature flags for safer deployment.

---

## Monitoring Requirements

**Metrics to Track:**
- Signup conversion rate
- Login success/failure rate
- Password reset requests
- Session duration
- Logout rate
- OAuth vs email login ratio

**Alerts to Configure:**
- High rate of failed logins (potential attack)
- Unusual spike in signups (potential bot activity)
- Session verification failures
- Email delivery failures

---

## Documentation Updates Needed

After Phase 2 completion, update:
- [ ] `README.md` - Add setup instructions for new features
- [ ] `BFEAI_Developer_Integration_Guide.md` - Add new endpoints
- [ ] `SESSION_NOTES.md` - Document Phase 2 implementation
- [ ] `shared-auth-library/README.md` - Update usage examples
- [ ] API documentation (consider adding Swagger/OpenAPI)

---

## Questions for Product Owner

1. **Email Service:** Should we use Supabase built-in emails or configure a custom service (SendGrid)?
2. **OAuth Priority:** Which OAuth providers are most important? (Google, GitHub, both, neither?)
3. **Account Deletion:** Should deletion be immediate or scheduled (30-day grace period)?
4. **Signup Flow:** Should we require email verification before allowing login?
5. **Feature Flags:** Should we implement feature flags for gradual rollout?
6. **Password Policy:** Any specific password requirements beyond current (8+ chars)?

---

## Next Steps

**Immediate:**
1. Get approval on Phase 2 plan
2. Answer questions above
3. Set up email service (if needed)
4. Begin P0 implementation (logout, middleware, session verification)

**After Approval:**
1. Create GitHub issues for each feature
2. Set up project board for tracking
3. Begin implementation in order of priority
4. Test each feature before moving to next

---

## Document Control

**Created:** 2026-01-14
**Author:** Claude (Planning Session)
**Status:** Draft - Awaiting Approval
**Based On:** Phase 1 testing results and PRD requirements
