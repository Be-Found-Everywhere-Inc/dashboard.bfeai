import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase admin client for test cleanup
 * Uses service role key to bypass RLS policies
 */
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for test cleanup');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Cleanup test users matching a specific email pattern
 * BE CAREFUL: Only delete test users with test-* email pattern
 */
export async function cleanupTestUsers(emailPattern: string = 'test-%@example.com') {
  const supabase = getAdminClient();

  try {
    // First, get all profiles matching the pattern
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .like('email', emailPattern);

    if (profilesError) {
      console.error('Error fetching test profiles:', profilesError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No test users found to cleanup');
      return;
    }

    console.log(`Found ${profiles.length} test users to cleanup`);

    // Delete profiles (this should cascade to related data if FK constraints are set)
    const { error: deleteProfilesError } = await supabase
      .from('profiles')
      .delete()
      .like('email', emailPattern);

    if (deleteProfilesError) {
      console.error('Error deleting test profiles:', deleteProfilesError);
    }

    // Note: Deleting from auth.users requires admin API or manual cleanup
    // For now, we only clean up profiles table
    console.log('Test user cleanup completed');
  } catch (error) {
    console.error('Unexpected error during cleanup:', error);
  }
}

/**
 * Create a test user in the database for testing
 */
export async function createTestUser(email: string, password: string, fullName: string) {
  const supabase = getAdminClient();

  try {
    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for testing
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      console.error('Error creating test user:', authError);
      return null;
    }

    console.log(`Test user created: ${email}`);
    return authData.user;
  } catch (error) {
    console.error('Unexpected error creating test user:', error);
    return null;
  }
}

/**
 * Verify database connection for tests
 */
export async function verifyDatabaseConnection() {
  const supabase = getAdminClient();

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Database connection failed:', error);
      return false;
    }

    console.log('Database connection verified');
    return true;
  } catch (error) {
    console.error('Unexpected error verifying database:', error);
    return false;
  }
}
