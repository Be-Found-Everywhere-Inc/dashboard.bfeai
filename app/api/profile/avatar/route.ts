import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JWTService } from '@/lib/auth/jwt';
import {
  validateAvatarFile,
  generateAvatarPath,
  getAvatarPublicUrl,
  extractAvatarPath,
} from '@/lib/storage/avatar';
import { createAdminClient } from '@/lib/supabase/admin';

async function logSecurityEvent(
  eventType: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  userId: string | null,
  request: NextRequest,
  details?: Record<string, any>
) {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';

    await supabase.from('security_events').insert({
      event_type: eventType,
      severity,
      user_id: userId,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown',
      details,
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * POST /api/profile/avatar
 * Upload or update user avatar
 */
export async function POST(request: NextRequest) {
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Use admin client for storage operations (SSO JWT doesn't create Supabase auth session)
    const adminClient = createAdminClient();

    // Get current avatar to delete later
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    // Generate unique file path
    const filePath = generateAvatarPath(userId, file.name);

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage using admin client (bypasses RLS)
    const { error: uploadError } = await adminClient.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      await logSecurityEvent(
        'AVATAR_UPLOAD_FAILED',
        'LOW',
        userId,
        request,
        { error: uploadError.message }
      );

      return NextResponse.json(
        { error: 'Failed to upload avatar' },
        { status: 500 }
      );
    }

    // Generate public URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const avatarUrl = getAvatarPublicUrl(supabaseUrl, filePath);

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      // Try to clean up uploaded file using admin client
      await adminClient.storage.from('avatars').remove([filePath]);

      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    // Delete old avatar if exists using admin client
    if (currentProfile?.avatar_url) {
      const oldPath = extractAvatarPath(currentProfile.avatar_url);
      if (oldPath) {
        await adminClient.storage.from('avatars').remove([oldPath]);
      }
    }

    // Log successful avatar upload
    await logSecurityEvent(
      'AVATAR_UPLOADED',
      'LOW',
      userId,
      request,
      { file_size: file.size, file_type: file.type }
    );

    return NextResponse.json({
      success: true,
      avatar_url: avatarUrl,
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove user avatar
 */
export async function DELETE(request: NextRequest) {
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

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    // Use admin client for storage operations (SSO JWT doesn't create Supabase auth session)
    const adminClient = createAdminClient();

    // Get current avatar
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (!profile?.avatar_url) {
      return NextResponse.json(
        { error: 'No avatar to delete' },
        { status: 404 }
      );
    }

    // Extract file path from URL
    const filePath = extractAvatarPath(profile.avatar_url);
    if (filePath) {
      // Delete from storage using admin client (bypasses RLS)
      const { error: deleteError } = await adminClient.storage
        .from('avatars')
        .remove([filePath]);

      if (deleteError) {
        console.error('Storage deletion error:', deleteError);
      }
    }

    // Update profile to remove avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    // Log avatar removal
    await logSecurityEvent(
      'AVATAR_REMOVED',
      'LOW',
      userId,
      request,
      {}
    );

    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (error) {
    console.error('Avatar deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
