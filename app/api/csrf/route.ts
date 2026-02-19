import { NextResponse } from 'next/server';
import { CSRFProtection } from '@/lib/security/csrf';

/**
 * GET /api/csrf
 * Get or generate a new CSRF token
 */
export async function GET() {
  try {
    // Get existing token or generate new one
    let token = await CSRFProtection.getToken();

    if (!token) {
      token = await CSRFProtection.setToken();
    }

    return NextResponse.json({
      token,
    });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
