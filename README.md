# accounts.bfeai - Central Authentication Service

This is the central authentication service for the BFEAI multi-app ecosystem. It handles login, signup, password resets, and profile management for all apps in the `*.bfeai.com` domain.

## Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Supabase account (already configured)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env.local

# Add your environment variables to .env.local
# Get values from core team or Supabase dashboard
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Building

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

This service implements Single Sign-On (SSO) via JWT cookies set on the `.bfeai.com` domain, making authentication automatically available to all subdomains.

### Key Features
- **SSO Authentication**: One login for all BFEAI apps
- **JWT Tokens**: Secure token-based authentication
- **Supabase Integration**: User profiles and session management
- **Security First**: Rate limiting, CSRF protection, XSS prevention
- **Co-founder Friendly**: Auth library for easy app integration

### How SSO Works

1. User logs in at `accounts.bfeai.com`
2. JWT token set as cookie on `.bfeai.com` domain (note the leading dot)
3. Cookie automatically available to all `*.bfeai.com` subdomains
4. Other apps verify token and access user data

## Project Structure

```
accounts.bfeai/
├── app/                      # Next.js app directory
│   ├── login/                # Login page
│   ├── signup/               # Signup page
│   ├── reset-password/       # Password reset page
│   ├── profile/              # User profile page
│   └── api/auth/             # Authentication API routes
├── lib/                      # Shared libraries
│   ├── auth/                 # Auth utilities (JWT, cookies, sessions)
│   ├── security/             # Security utilities (rate limiting, CSRF, XSS)
│   └── supabase/             # Supabase clients
├── shared-auth-library/      # Files for co-founders to copy
└── docs/                     # Documentation (PRD, Integration Guide)
```

## Shared Auth Library

The `shared-auth-library/` directory contains authentication files that co-founders should copy into their apps for SSO integration.

See `shared-auth-library/README.md` for integration instructions.

## Environment Variables

See `.env.example` for all required environment variables.

Critical variables:
- `JWT_SECRET` - Must be the same across all apps
- `NEXT_PUBLIC_SUPABASE_URL` - Shared Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` - Admin access (server-side only)

## Security

This service implements multiple security layers:
- Rate limiting (5 login attempts per 15 minutes)
- CSRF protection on all mutations
- XSS prevention via input sanitization
- JWT security with token fingerprinting
- HttpOnly, Secure cookies
- Security event logging

See `CLAUDE.md` for detailed security implementation.

## Documentation

- `CLAUDE.md` - Architecture and development guide
- `PRD.md` - Product requirements document
- `BFEAI_Developer_Integration_Guide.md` - Guide for co-founders integrating their apps

## Deployment

This service deploys to Netlify at `accounts.bfeai.com`.

### Netlify Setup
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables in Netlify dashboard
5. Custom domain: `accounts.bfeai.com`

## Contributing

This is a core service for the BFEAI ecosystem. Changes should be carefully reviewed as they affect all apps.

### Before Committing
1. Run `npm run typecheck`
2. Run `npm run lint`
3. Test authentication flow locally
4. Update shared auth library if needed
5. Update documentation if architecture changes

## Support

For questions or issues:
- Review documentation in this repository
- Check Supabase dashboard for database issues
- Contact the core team for infrastructure issues

## License

Private - BFEAI Internal Use Only
