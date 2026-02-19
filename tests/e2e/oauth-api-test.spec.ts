import { test } from '@playwright/test';

/**
 * OAuth API Direct Test
 * Tests the OAuth endpoints directly to diagnose issues
 */

const BASE_URL = 'https://accounts.bfeai.com';

test.describe('OAuth API Debug', () => {
  test('Google OAuth API endpoint', async ({ request }) => {
    console.log('\n========== TESTING GOOGLE OAUTH ==========\n');

    try {
      const response = await request.get(
        `${BASE_URL}/api/auth/oauth?provider=google&redirect=/profile`,
        { maxRedirects: 0 }
      );

      console.log('✓ Request sent successfully');
      console.log('Status:', response.status());
      console.log('Status Text:', response.statusText());

      const headers = response.headers();
      console.log('\nResponse Headers:');
      Object.keys(headers).forEach(key => {
        console.log(`  ${key}: ${headers[key]}`);
      });

      if (response.status() === 302 || response.status() === 307 ||response.status() === 301) {
        const location = headers['location'];
        console.log('\n✓ REDIRECT FOUND');
        console.log('Location:', location);

        if (location?.includes('accounts.google.com')) {
          console.log('✓ Correctly redirects to Google');
        } else {
          console.log('✗ Location does not point to Google');
        }
      } else {
        const body = await response.text();
        console.log('\n✗ NOT A REDIRECT');
        console.log('Response body:', body);
      }
    } catch (error: any) {
      console.log('\n✗ ERROR');
      console.log('Message:', error.message);
      console.log('Stack:', error.stack);
    }

    console.log('\n========================================\n');
  });

  test('GitHub OAuth API endpoint', async ({ request }) => {
    console.log('\n========== TESTING GITHUB OAUTH ==========\n');

    try {
      const response = await request.get(
        `${BASE_URL}/api/auth/oauth?provider=github&redirect=/profile`,
        { maxRedirects: 0 }
      );

      console.log('✓ Request sent successfully');
      console.log('Status:', response.status());
      console.log('Status Text:', response.statusText());

      const headers = response.headers();
      console.log('\nResponse Headers:');
      Object.keys(headers).forEach(key => {
        console.log(`  ${key}: ${headers[key]}`);
      });

      if (response.status() === 302 || response.status() === 307 || response.status() === 301) {
        const location = headers['location'];
        console.log('\n✓ REDIRECT FOUND');
        console.log('Location:', location);

        if (location?.includes('github.com')) {
          console.log('✓ Correctly redirects to GitHub');
        } else {
          console.log('✗ Location does not point to GitHub');
        }
      } else {
        const body = await response.text();
        console.log('\n✗ NOT A REDIRECT');
        console.log('Response body:', body);
      }
    } catch (error: any) {
      console.log('\n✗ ERROR');
      console.log('Message:', error.message);
      console.log('Stack:', error.stack);
    }

    console.log('\n========================================\n');
  });
});
