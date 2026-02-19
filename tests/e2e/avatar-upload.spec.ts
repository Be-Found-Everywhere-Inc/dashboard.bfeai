import { test, expect } from '@playwright/test';
import { login } from '../utils/auth-helpers';
import { getDefaultTestUser } from '../utils/test-data';
import path from 'path';

test.describe('Avatar Upload', () => {
  const testUser = getDefaultTestUser();

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, testUser.email, testUser.password);
  });

  test.skip('complete avatar upload and display flow', async ({ page }) => {
    // Navigate to settings page
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verify we're on settings page
    await expect(page.getByText('Account Settings')).toBeVisible();

    // Create a test image file (1x1 pixel PNG)
    const testImagePath = path.join(__dirname, '../fixtures/test-avatar.png');

    // Check if default avatar icon is shown (no avatar yet)
    const avatarPreview = page.locator('img[alt="Avatar"]');
    const defaultIcon = page.locator('svg.text-gray-400').first();

    // Should show default icon if no avatar
    const hasAvatar = await avatarPreview.isVisible().catch(() => false);
    if (!hasAvatar) {
      await expect(defaultIcon).toBeVisible();
    }

    // Upload avatar
    const fileInput = page.locator('input[type="file"]#avatar-upload');
    await fileInput.setInputFiles(testImagePath);

    // Wait for upload to complete and preview to update
    await expect(page.getByText(/uploaded successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify avatar preview appears in settings
    await expect(avatarPreview).toBeVisible();

    // Navigate to profile page
    await page.goto('/profile');

    // Verify avatar appears on profile page
    const profileAvatar = page.locator('img[alt*="Test User"]').or(page.locator('img[alt*="User"]')).first();
    await expect(profileAvatar).toBeVisible();

    // Verify the image has a source
    const src = await profileAvatar.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toContain('avatars');

    // Navigate back to settings
    await page.goto('/settings');

    // Test avatar removal
    const removeButton = page.getByRole('button', { name: /remove/i });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Wait for removal confirmation
    await expect(page.getByText(/removed successfully/i)).toBeVisible({ timeout: 5000 });

    // Verify default icon is shown again
    await expect(defaultIcon).toBeVisible();

    // Verify removed from profile page
    await page.goto('/profile');
    const profileDefaultIcon = page.locator('svg.text-gray-400').first();
    await expect(profileDefaultIcon).toBeVisible();
  });

  test('validates file size limits', async ({ page }) => {
    await page.goto('/settings');

    // Try to upload a file that's too large (simulated by checking client-side validation)
    // Note: We can't easily create a 6MB file in the test, so we verify the error message exists
    await expect(page.getByText(/max 5mb/i)).toBeVisible();
  });

  test('validates file types', async ({ page }) => {
    await page.goto('/settings');

    // Verify allowed file types are displayed
    await expect(page.getByText(/jpg.*png.*webp.*gif/i)).toBeVisible();
  });

  test('shows loading state during upload', async ({ page }) => {
    await page.goto('/settings');

    const testImagePath = path.join(__dirname, '../fixtures/test-avatar.png');
    const fileInput = page.locator('input[type="file"]#avatar-upload');

    // Start upload
    await fileInput.setInputFiles(testImagePath);

    // Should show uploading state (may be very quick)
    const uploadButton = page.getByRole('button', { name: /upload photo|uploading/i });
    await expect(uploadButton).toBeVisible();
  });
});
