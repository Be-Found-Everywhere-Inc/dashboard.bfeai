# API Route Templates

These are template files for the server-side API routes your app needs. The AuthProvider calls these endpoints to get user info and subscription data, since the `bfeai_session` cookie is `httpOnly` and cannot be read by client-side JavaScript.

## Required Routes

Copy these to your Next.js app:

| Template File | Copy To |
|---------------|---------|
| `auth-me-route.ts` | `src/app/api/auth/me/route.ts` |
| `auth-subscription-route.ts` | `src/app/api/auth/subscription/route.ts` |

## Why These Are Needed

The `bfeai_session` cookie is set with `httpOnly: true` for security (prevents XSS attacks from stealing tokens). This means:

- Client-side JavaScript (`js-cookie`, `document.cookie`) **cannot** read it
- Only server-side code (API routes, middleware, server components) can access it

These API routes act as a bridge: the browser sends the cookie automatically with `fetch()` requests to same-origin endpoints, and the server reads the cookie and returns the user/subscription data.
