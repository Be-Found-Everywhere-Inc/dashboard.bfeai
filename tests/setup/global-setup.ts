import { FullConfig } from '@playwright/test';
import { verifyDatabaseConnection } from '../utils/db-helpers';
import { createClient } from '@supabase/supabase-js';
import { getDefaultTestUser } from '../utils/test-data';

async function globalSetup(config: FullConfig) {
  console.log('🧪 Setting up test environment...');

  // Verify database connection
  const dbConnected = await verifyDatabaseConnection();
  if (!dbConnected) {
    throw new Error('Failed to connect to test database');
  }

  // Check required environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}\n` +
      'Please ensure .env.test.local is configured correctly.'
    );
  }

  // Create test user if it doesn't exist
  try {
    console.log('🔍 Checking for test user...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const testUser = getDefaultTestUser();

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const userExists = existingUsers?.users.find((u) => u.email === testUser.email);

    if (!userExists) {
      console.log('👤 Creating test user...');
      const { data, error } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: {
          full_name: 'Test User',
        },
      });

      if (error) {
        throw new Error(`Failed to create test user: ${error.message}`);
      }

      console.log(`✅ Test user created: ${testUser.email}`);
    } else {
      console.log(`✅ Test user exists: ${testUser.email}`);
    }
  } catch (error) {
    console.error('⚠️ Warning: Could not setup test user:', error);
    // Don't throw - some tests might still work
  }

  console.log('✅ Test environment ready');
}

export default globalSetup;
