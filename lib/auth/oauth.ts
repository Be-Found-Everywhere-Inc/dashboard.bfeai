/**
 * OAuth Provider Configuration and Helpers
 * Supports Google and GitHub OAuth providers
 */

export type OAuthProvider = 'google' | 'github';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

/**
 * Get OAuth configuration for a specific provider
 */
export function getOAuthConfig(provider: OAuthProvider): OAuthConfig | null {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  switch (provider) {
    case 'google':
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn('[OAuth] Google OAuth credentials not configured');
        return null;
      }
      return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${baseUrl}/api/auth/callback/google`,
        scope: ['openid', 'email', 'profile'],
      };

    case 'github':
      if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        console.warn('[OAuth] GitHub OAuth credentials not configured');
        return null;
      }
      return {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectUri: `${baseUrl}/api/auth/callback/github`,
        scope: ['user:email', 'read:user'],
      };

    default:
      return null;
  }
}

/**
 * Check if OAuth provider is enabled (has valid configuration)
 */
export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  return getOAuthConfig(provider) !== null;
}

/**
 * Generate OAuth authorization URL
 */
export function getOAuthAuthorizationUrl(
  provider: OAuthProvider,
  state: string
): string | null {
  const config = getOAuthConfig(provider);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state,
    response_type: 'code',
  });

  const authUrls = {
    google: 'https://accounts.google.com/o/oauth2/v2/auth',
    github: 'https://github.com/login/oauth/authorize',
  };

  return `${authUrls[provider]}?${params.toString()}`;
}

/**
 * Exchange OAuth authorization code for access token
 */
export async function exchangeOAuthCode(
  provider: OAuthProvider,
  code: string
): Promise<{ access_token: string; token_type: string; scope: string } | null> {
  const config = getOAuthConfig(provider);
  if (!config) return null;

  const tokenUrls = {
    google: 'https://oauth2.googleapis.com/token',
    github: 'https://github.com/login/oauth/access_token',
  };

  try {
    const response = await fetch(tokenUrls[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      console.error(`[OAuth] Token exchange failed for ${provider}:`, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[OAuth] Token exchange error for ${provider}:`, error);
    return null;
  }
}

/**
 * Fetch user profile from OAuth provider
 */
export async function fetchOAuthUserProfile(
  provider: OAuthProvider,
  accessToken: string
): Promise<{
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
} | null> {
  try {
    if (provider === 'google') {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[OAuth] Google profile fetch failed:', await response.text());
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar_url: data.picture,
      };
    }

    if (provider === 'github') {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        console.error('[OAuth] GitHub profile fetch failed:', await response.text());
        return null;
      }

      const data = await response.json();

      // GitHub may not expose email publicly, need to fetch separately
      let email = data.email;
      if (!email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json();
          const primaryEmail = emails.find((e: any) => e.primary);
          email = primaryEmail?.email || emails[0]?.email;
        }
      }

      return {
        id: data.id.toString(),
        email,
        name: data.name || data.login,
        avatar_url: data.avatar_url,
      };
    }

    return null;
  } catch (error) {
    console.error(`[OAuth] Profile fetch error for ${provider}:`, error);
    return null;
  }
}
