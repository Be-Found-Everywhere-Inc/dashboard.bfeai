import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/profile
 * Fetch the authenticated user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = JWTService.verifySSOToken(sessionCookie.value);
    const userId = payload.userId;

    const adminSupabase = createAdminClient();

    // Fetch profile data (use admin client since auth is via custom JWT, not Supabase session)
    const { data: profile, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      // Profile row doesn't exist yet - auto-create from JWT data
      const { data: newProfile, error: upsertError } = await adminSupabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: payload.email,
            full_name: payload.email.split('@')[0],
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (upsertError || !newProfile) {
        console.error('Error creating profile:', upsertError);
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }

      return NextResponse.json(newProfile);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update the authenticated user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const payload = JWTService.verifySSOToken(sessionCookie.value);
    const userId = payload.userId;

    const body = await request.json();
    const { full_name, company, industry } = body;

    // Validate input
    if (!full_name || full_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Full name must be at least 2 characters' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Upsert profile (handles users without existing profile row)
    const { data: profile, error } = await adminSupabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: payload.email,
          full_name: full_name.trim(),
          company: company?.trim() || null,
          industry: industry?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
