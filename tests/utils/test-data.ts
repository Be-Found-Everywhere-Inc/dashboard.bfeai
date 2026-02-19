/**
 * Generate a unique test user with timestamp-based email
 */
export function generateTestUser() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: 'TestPass123!',
    fullName: `Test User ${timestamp}`,
  };
}

/**
 * Get a predefined test user for consistent testing
 * NOTE: This user should exist in your test database
 */
export function getDefaultTestUser() {
  return {
    email: 'test@example.com',
    password: 'Password123',
  };
}

/**
 * Generate invalid credentials for testing error cases
 */
export function getInvalidCredentials() {
  return {
    invalidEmail: 'notanemail',
    wrongEmail: 'nonexistent@example.com',
    wrongPassword: 'WrongPassword123',
    emptyEmail: '',
    emptyPassword: '',
  };
}
