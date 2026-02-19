/**
 * Avatar Upload and Management Utilities
 * Handles avatar uploads to Supabase Storage
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const BUCKET_NAME = 'avatars';

export interface AvatarValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate avatar file before upload
 */
export function validateAvatarFile(file: File): AvatarValidation {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size must be less than 5MB',
    };
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'File must be JPEG, PNG, WebP, or GIF',
    };
  }

  return { valid: true };
}

/**
 * Generate unique file path for avatar
 */
export function generateAvatarPath(userId: string, fileName: string): string {
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  return `${userId}/${timestamp}.${extension}`;
}

/**
 * Get public URL for avatar
 */
export function getAvatarPublicUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
}

/**
 * Extract file path from avatar URL
 */
export function extractAvatarPath(url: string): string | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Setup Supabase Storage bucket (run once during setup)
 */
export async function setupAvatarBucket(supabaseAdminClient: any) {
  try {
    // Check if bucket exists
    const { data: buckets } = await supabaseAdminClient.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket
      const { data, error } = await supabaseAdminClient.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });

      if (error) {
        console.error('Failed to create avatars bucket:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Avatars bucket created successfully');
      return { success: true };
    }

    console.log('✅ Avatars bucket already exists');
    return { success: true };
  } catch (error) {
    console.error('Error setting up avatar bucket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
