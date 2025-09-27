import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

// Test data
const TEST_STORE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_QR_VERSION = '12345';
const TEST_QR_TIMESTAMP = Math.floor(Date.now() / 1000).toString();

test.describe('QR Code Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
  });

  test('Complete successful verification flow', async ({ page }) => {
    // Step 1: Navigate to QR landing page
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    // Step 2: Verify QR landing page loads
    await expect(page).toHaveTitle(/Verify Your Transaction/);
    await expect(page.locator('[data-testid="store-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();

    // Step 3: Fill out verification form
    const currentTime = new Date();
    const timeString = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
    
    await page.fill('[data-testid="transaction-time"]', timeString);
    await page.fill('[data-testid="transaction-amount"]', '125.50');
    await page.fill('[data-testid="phone-number"]', '070-123 45 67');

    // Step 4: Submit form
    await page.click('[data-testid="submit-button"]');

    // Step 5: Verify success page
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-id"]')).toBeVisible();
    
    // Step 6: Verify all validation statuses are "valid"
    await expect(page.locator('[data-testid="time-validation-status"]')).toContainText('valid');
    await expect(page.locator('[data-testid="amount-validation-status"]')).toContainText('valid');
    await expect(page.locator('[data-testid="phone-validation-status"]')).toContainText('valid');
  });

  test('Handle invalid QR code', async ({ page }) => {
    // Test with invalid store ID
    const invalidQrUrl = `${FRONTEND_BASE_URL}/qr/invalid-uuid?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(invalidQrUrl);

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid QR code');
  });

  test('Handle expired QR code', async ({ page }) => {
    // Test with old timestamp (25 hours ago)
    const oldTimestamp = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000).toString();
    const expiredQrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${oldTimestamp}`;
    await page.goto(expiredQrUrl);

    // Should show expiry error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('expired');
  });

  test('Time tolerance validation', async ({ page }) => {
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    // Wait for form to load
    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();

    // Enter time that's outside tolerance (5 minutes ago)
    const oldTime = new Date(Date.now() - 5 * 60 * 1000);
    const oldTimeString = `${oldTime.getHours().toString().padStart(2, '0')}:${oldTime.getMinutes().toString().padStart(2, '0')}`;
    
    await page.fill('[data-testid="transaction-time"]', oldTimeString);
    await page.fill('[data-testid="transaction-amount"]', '125.50');
    await page.fill('[data-testid="phone-number"]', '070-123 45 67');
    
    await page.click('[data-testid="submit-button"]');

    // Should show time validation error
    await expect(page.locator('[data-testid="time-validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-validation-error"]')).toContainText('within 2 minutes');
  });

  test('Amount tolerance validation', async ({ page }) => {
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();

    // Enter amount outside tolerance
    const currentTime = new Date();
    const timeString = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
    
    await page.fill('[data-testid="transaction-time"]', timeString);
    await page.fill('[data-testid="transaction-amount"]', '120.00'); // >2 SEK difference from expected 125.50
    await page.fill('[data-testid="phone-number"]', '070-123 45 67');
    
    await page.click('[data-testid="submit-button"]');

    // Should show amount validation error
    await expect(page.locator('[data-testid="amount-validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="amount-validation-error"]')).toContainText('within 2 SEK');
  });

  test('Phone number validation', async ({ page }) => {
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();

    // Test invalid phone formats
    const invalidPhones = [
      '123-456-7890',      // US format
      '08-123 45 67',      // Swedish landline
      '060-123 45 67',     // Invalid mobile prefix
      '+1-555-123-4567'    // International non-Swedish
    ];

    for (const invalidPhone of invalidPhones) {
      const currentTime = new Date();
      const timeString = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
      
      await page.fill('[data-testid="transaction-time"]', timeString);
      await page.fill('[data-testid="transaction-amount"]', '125.50');
      await page.fill('[data-testid="phone-number"]', invalidPhone);
      
      await page.click('[data-testid="submit-button"]');

      // Should show phone validation error
      await expect(page.locator('[data-testid="phone-validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="phone-validation-error"]')).toContainText('Swedish mobile number');
      
      // Clear form for next test
      await page.fill('[data-testid="phone-number"]', '');
    }
  });

  test('Mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    // Verify mobile layout
    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();
    
    // Check that form fields are properly sized for mobile
    const timeInput = page.locator('[data-testid="transaction-time"]');
    const amountInput = page.locator('[data-testid="transaction-amount"]');
    const phoneInput = page.locator('[data-testid="phone-number"]');
    
    // All inputs should be visible and properly sized
    await expect(timeInput).toBeVisible();
    await expect(amountInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    
    // Touch targets should be at least 48px
    const submitButton = page.locator('[data-testid="submit-button"]');
    const buttonBounds = await submitButton.boundingBox();
    expect(buttonBounds?.height).toBeGreaterThanOrEqual(48);
  });

  test('Performance validation', async ({ page }) => {
    // Start performance monitoring
    const startTime = Date.now();
    
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    // Wait for page to be fully loaded
    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('Session expiry handling', async ({ page }) => {
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();

    // Mock expired session by manipulating session storage
    await page.evaluate(() => {
      const expiredToken = 'expired_session_token_for_testing';
      sessionStorage.setItem('vocilia_session_token', expiredToken);
    });

    // Try to submit form
    const currentTime = new Date();
    const timeString = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
    
    await page.fill('[data-testid="transaction-time"]', timeString);
    await page.fill('[data-testid="transaction-amount"]', '125.50');
    await page.fill('[data-testid="phone-number"]', '070-123 45 67');
    
    await page.click('[data-testid="submit-button"]');

    // Should show session expired error
    await expect(page.locator('[data-testid="session-expired-error"]')).toBeVisible();
  });

  test('Network error handling', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/v1/**', route => route.abort());

    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    // Should show network error
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('Accessibility compliance', async ({ page }) => {
    const qrUrl = `${FRONTEND_BASE_URL}/qr/${TEST_STORE_ID}?v=${TEST_QR_VERSION}&t=${TEST_QR_TIMESTAMP}`;
    await page.goto(qrUrl);

    await expect(page.locator('[data-testid="verification-form"]')).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="transaction-time"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="transaction-amount"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="phone-number"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="submit-button"]')).toBeFocused();

    // Test form labels and ARIA attributes
    await expect(page.locator('label[for="transaction-time"]')).toBeVisible();
    await expect(page.locator('label[for="transaction-amount"]')).toBeVisible();
    await expect(page.locator('label[for="phone-number"]')).toBeVisible();
  });
});