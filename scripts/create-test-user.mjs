// Script to create test user for E2E tests
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const testEmail = 'test@example.com';
  const testPassword = 'Password123';

  console.log('🔍 Checking if test user exists...');

  // Check if user already exists
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error checking users:', listError.message);
    process.exit(1);
  }

  const existingUser = existingUsers.users.find(u => u.email === testEmail);

  if (existingUser) {
    console.log('✅ Test user already exists!');
    console.log('   Email:', existingUser.email);
    console.log('   ID:', existingUser.id);
    console.log('   Created:', existingUser.created_at);
    return;
  }

  console.log('📝 Creating test user...');

  // Create new test user
  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true, // Skip email confirmation for test user
    user_metadata: {
      full_name: 'Test User',
    }
  });

  if (error) {
    console.error('❌ Error creating test user:', error.message);
    process.exit(1);
  }

  console.log('✅ Test user created successfully!');
  console.log('   Email:', data.user.email);
  console.log('   ID:', data.user.id);
  console.log('   Password: Password123');
  console.log('');
  console.log('🎉 You can now run E2E tests with this user!');
}

createTestUser().catch(err => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
