import { test, expect, Page, BrowserContext } from '@playwright/test';
import { SwedishDataGenerator } from '../../generators/swedish-data';

test.describe('QR Scan to Verification Flow', () => {
  let page: Page;
  let context: BrowserContext;
  let dataGenerator: SwedishDataGenerator;
  let testStore: any;
  let testCustomer: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      // Mobile viewport for PWA testing
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      permissions: ['camera'], // For QR scanning simulation
      geolocation: { latitude: 59.3293, longitude: 18.0686 } // Stockholm coordinates
    });
    
    dataGenerator = new SwedishDataGenerator();
    testStore = dataGenerator.generateStore();
    testCustomer = dataGenerator.generateCustomer();
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock geolocation API for consistent testing
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: Function) => {
            success({
              coords: {
                latitude: 59.3293,
                longitude: 18.0686,
                accuracy: 10
              }
            });
          }
        }
      });
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should complete full QR scan to verification workflow', async () => {
    // Step 1: Navigate to customer app
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Verify PWA capability
    await expect(page).toHaveTitle(/Vocilia/);
    
    // Step 2: Access QR scanner
    await page.click('[data-testid="scan-qr-button"]');
    
    // Verify camera permission request (mocked)
    await expect(page.locator('[data-testid="camera-view"]')).toBeVisible();
    
    // Step 3: Simulate QR code scan
    const qrPayload = {
      storeId: testStore.id,
      sessionId: 'test-session-123',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      version: '1.0'
    };
    
    // Simulate successful QR scan
    await page.evaluate((payload) => {
      window.dispatchEvent(new CustomEvent('qr-scanned', {
        detail: { data: JSON.stringify(payload) }
      }));
    }, qrPayload);
    
    // Step 4: Verify QR scan processing
    await expect(page.locator('[data-testid="qr-success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="store-name"]')).toContainText(testStore.name);
    
    // Step 5: Proceed to verification
    await page.click('[data-testid="proceed-to-verification"]');
    
    // Verify navigation to verification page
    await expect(page).toHaveURL(/.*\/verification/);
    
    // Step 6: Enter phone number for verification
    await page.fill('[data-testid="phone-input"]', testCustomer.phone);
    await page.click('[data-testid="send-verification-button"]');
    
    // Step 7: Verify SMS sent confirmation
    await expect(page.locator('[data-testid="sms-sent-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-code-input"]')).toBeVisible();
    
    // Step 8: Enter verification code
    const verificationCode = '123456'; // Mock code for testing
    await page.fill('[data-testid="verification-code-input"]', verificationCode);
    await page.click('[data-testid="verify-code-button"]');
    
    // Step 9: Verify successful verification
    await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();
    
    // Step 10: Proceed to feedback call
    await page.click('[data-testid="start-feedback-call"]');
    
    // Verify AI call interface
    await expect(page.locator('[data-testid="ai-call-interface"]')).toBeVisible();
    await expect(page.locator('[data-testid="call-status"]')).toContainText('Connecting');
  });

  test('should handle invalid QR codes gracefully', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    await page.click('[data-testid="scan-qr-button"]');
    
    // Simulate invalid QR code
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('qr-scanned', {
        detail: { data: 'invalid-qr-data' }
      }));
    });
    
    // Verify error handling
    await expect(page.locator('[data-testid="qr-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="qr-error-message"]')).toContainText('Invalid QR code');
    
    // Verify retry option
    await expect(page.locator('[data-testid="scan-again-button"]')).toBeVisible();
  });

  test('should handle expired QR codes', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    await page.click('[data-testid="scan-qr-button"]');
    
    // Simulate expired QR code
    const expiredQrPayload = {
      storeId: testStore.id,
      sessionId: 'expired-session-123',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
      expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
      version: '1.0'
    };
    
    await page.evaluate((payload) => {
      window.dispatchEvent(new CustomEvent('qr-scanned', {
        detail: { data: JSON.stringify(payload) }
      }));
    }, expiredQrPayload);
    
    // Verify expiration handling
    await expect(page.locator('[data-testid="qr-expired-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="qr-expired-message"]')).toContainText('QR code has expired');
  });

  test('should validate Swedish phone number format', async () => {
    await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
    
    // Test invalid phone numbers
    const invalidPhones = ['+1234567890', '0701234567', '+46123'];
    
    for (const phone of invalidPhones) {
      await page.fill('[data-testid="phone-input"]', phone);
      await page.click('[data-testid="send-verification-button"]');
      
      await expect(page.locator('[data-testid="phone-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="phone-error"]')).toContainText('Invalid Swedish phone number');
      
      // Clear input for next test
      await page.fill('[data-testid="phone-input"]', '');
    }
    
    // Test valid Swedish phone number
    await page.fill('[data-testid="phone-input"]', testCustomer.phone);
    await page.click('[data-testid="send-verification-button"]');
    
    await expect(page.locator('[data-testid="phone-error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="sms-sent-message"]')).toBeVisible();
  });

  test('should handle verification code retry attempts', async () => {
    await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
    
    // Complete phone verification step
    await page.fill('[data-testid="phone-input"]', testCustomer.phone);
    await page.click('[data-testid="send-verification-button"]');
    await expect(page.locator('[data-testid="verification-code-input"]')).toBeVisible();
    
    // Try incorrect codes (should fail)
    const incorrectCodes = ['000000', '111111', '999999'];
    
    for (const code of incorrectCodes) {
      await page.fill('[data-testid="verification-code-input"]', code);
      await page.click('[data-testid="verify-code-button"]');
      
      await expect(page.locator('[data-testid="verification-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-error"]')).toContainText('Invalid verification code');
      
      // Clear input for next attempt
      await page.fill('[data-testid="verification-code-input"]', '');
    }
    
    // After 3 failed attempts, should show blocking message
    await page.fill('[data-testid="verification-code-input"]', '000000');
    await page.click('[data-testid="verify-code-button"]');
    
    await expect(page.locator('[data-testid="verification-blocked"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-blocked"]')).toContainText('Maximum attempts exceeded');
  });

  test('should support resending verification code', async () => {
    await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
    
    // Complete phone verification step
    await page.fill('[data-testid="phone-input"]', testCustomer.phone);
    await page.click('[data-testid="send-verification-button"]');
    await expect(page.locator('[data-testid="verification-code-input"]')).toBeVisible();
    
    // Wait for resend button to become available (rate limiting)
    await page.waitForTimeout(60000); // 1 minute wait
    
    // Click resend button
    await page.click('[data-testid="resend-code-button"]');
    
    // Verify new code sent message
    await expect(page.locator('[data-testid="code-resent-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="code-resent-message"]')).toContainText('New verification code sent');
  });

  test('should handle network connectivity issues', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Simulate offline mode
    await context.setOffline(true);
    
    await page.click('[data-testid="scan-qr-button"]');
    
    // Simulate QR scan while offline
    const qrPayload = {
      storeId: testStore.id,
      sessionId: 'offline-session-123',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      version: '1.0'
    };
    
    await page.evaluate((payload) => {
      window.dispatchEvent(new CustomEvent('qr-scanned', {
        detail: { data: JSON.stringify(payload) }
      }));
    }, qrPayload);
    
    // Verify offline handling
    await expect(page.locator('[data-testid="offline-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-message"]')).toContainText('No internet connection');
    
    // Restore connectivity
    await context.setOffline(false);
    
    // Verify automatic retry
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="qr-success-message"]')).toBeVisible();
  });

  test('should track user journey analytics', async () => {
    // Set up analytics event listener
    const analyticsEvents: any[] = [];
    
    await page.exposeFunction('trackAnalytics', (event: any) => {
      analyticsEvents.push(event);
    });
    
    await page.addInitScript(() => {
      // Mock analytics tracking
      (window as any).analytics = {
        track: (window as any).trackAnalytics
      };
    });
    
    // Complete full workflow
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    await page.click('[data-testid="scan-qr-button"]');
    
    const qrPayload = {
      storeId: testStore.id,
      sessionId: 'analytics-session-123',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      version: '1.0'
    };
    
    await page.evaluate((payload) => {
      window.dispatchEvent(new CustomEvent('qr-scanned', {
        detail: { data: JSON.stringify(payload) }
      }));
    }, qrPayload);
    
    await page.click('[data-testid="proceed-to-verification"]');
    await page.fill('[data-testid="phone-input"]', testCustomer.phone);
    await page.click('[data-testid="send-verification-button"]');
    
    // Verify analytics events were tracked
    expect(analyticsEvents).toContainEqual(
      expect.objectContaining({
        event: 'qr_scan_initiated',
        properties: expect.objectContaining({
          user_agent: expect.stringContaining('iPhone')
        })
      })
    );
    
    expect(analyticsEvents).toContainEqual(
      expect.objectContaining({
        event: 'qr_scan_successful',
        properties: expect.objectContaining({
          store_id: testStore.id
        })
      })
    );
    
    expect(analyticsEvents).toContainEqual(
      expect.objectContaining({
        event: 'verification_initiated',
        properties: expect.objectContaining({
          phone_country_code: '+46'
        })
      })
    );
  });
});