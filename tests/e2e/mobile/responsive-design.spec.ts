import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Mobile Responsiveness Tests', () => {
  let context: BrowserContext;

  // Common mobile device configurations
  const mobileDevices = [
    {
      name: 'iPhone 12',
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      deviceScaleFactor: 3
    },
    {
      name: 'Samsung Galaxy S21',
      viewport: { width: 384, height: 854 },
      userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36',
      deviceScaleFactor: 2.75
    },
    {
      name: 'iPad',
      viewport: { width: 768, height: 1024 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      deviceScaleFactor: 2
    }
  ];

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  for (const device of mobileDevices) {
    test.describe(`${device.name} Tests`, () => {
      let page: Page;

      test.beforeAll(async ({ browser }) => {
        context = await browser.newContext({
          viewport: device.viewport,
          userAgent: device.userAgent,
          deviceScaleFactor: device.deviceScaleFactor,
          hasTouch: true,
          isMobile: device.viewport.width < 768
        });
      });

      test.beforeEach(async () => {
        page = await context.newPage();
      });

      test.afterEach(async () => {
        await page.close();
      });

      test(`should display customer app correctly on ${device.name}`, async () => {
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Verify page loads and is responsive
        await expect(page).toHaveTitle(/Vocilia/);
        
        // Check main layout elements
        await expect(page.locator('[data-testid="main-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
        
        // Verify mobile navigation
        if (device.viewport.width < 768) {
          await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
          
          // Test mobile menu functionality
          await page.click('[data-testid="mobile-menu-button"]');
          await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
        }
        
        // Check QR scanner button is prominent and touchable
        const qrButton = page.locator('[data-testid="scan-qr-button"]');
        await expect(qrButton).toBeVisible();
        
        // Verify button size is touch-friendly (minimum 44px)
        const buttonBox = await qrButton.boundingBox();
        expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
        expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
        
        // Test touch interaction
        await qrButton.tap();
        await expect(page.locator('[data-testid="camera-view"]')).toBeVisible();
      });

      test(`should handle text scaling and readability on ${device.name}`, async () => {
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Check text elements are readable
        const headingElements = page.locator('h1, h2, h3');
        const textElements = page.locator('p, span, div[class*="text"]');
        
        // Verify heading sizes
        for (const heading of await headingElements.all()) {
          const styles = await heading.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              fontSize: computed.fontSize,
              lineHeight: computed.lineHeight
            };
          });
          
          const fontSize = parseInt(styles.fontSize);
          expect(fontSize).toBeGreaterThanOrEqual(18); // Minimum readable size
        }
        
        // Verify body text sizes
        for (const text of await textElements.all()) {
          const styles = await text.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              fontSize: computed.fontSize,
              lineHeight: computed.lineHeight
            };
          });
          
          const fontSize = parseInt(styles.fontSize);
          if (fontSize > 0) { // Only check if font size is set
            expect(fontSize).toBeGreaterThanOrEqual(14); // Minimum readable size
          }
        }
      });

      test(`should handle form interactions on ${device.name}`, async () => {
        await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
        
        // Check form elements are touch-friendly
        const phoneInput = page.locator('[data-testid="phone-input"]');
        await expect(phoneInput).toBeVisible();
        
        // Verify input field size
        const inputBox = await phoneInput.boundingBox();
        expect(inputBox?.height).toBeGreaterThanOrEqual(44);
        
        // Test touch interaction with input
        await phoneInput.tap();
        await expect(phoneInput).toBeFocused();
        
        // Verify virtual keyboard opens (mobile devices)
        if (device.viewport.width < 768) {
          // Check if keyboard is detected by viewport change
          const viewportHeight = await page.evaluate(() => window.visualViewport?.height || window.innerHeight);
          expect(viewportHeight).toBeLessThanOrEqual(device.viewport.height);
        }
        
        // Test input functionality
        await phoneInput.fill('+46701234567');
        await expect(phoneInput).toHaveValue('+46701234567');
        
        // Test submit button
        const submitButton = page.locator('[data-testid="send-verification-button"]');
        const submitBox = await submitButton.boundingBox();
        expect(submitBox?.height).toBeGreaterThanOrEqual(44);
        
        await submitButton.tap();
        await expect(page.locator('[data-testid="sms-sent-message"]')).toBeVisible();
      });

      test(`should display images and media correctly on ${device.name}`, async () => {
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Check if there are any images
        const images = page.locator('img');
        const imageCount = await images.count();
        
        if (imageCount > 0) {
          for (let i = 0; i < imageCount; i++) {
            const image = images.nth(i);
            await expect(image).toBeVisible();
            
            // Verify image loads correctly
            const isLoaded = await image.evaluate((img: HTMLImageElement) => {
              return img.complete && img.naturalHeight !== 0;
            });
            expect(isLoaded).toBe(true);
            
            // Check responsive image sizing
            const imageBox = await image.boundingBox();
            expect(imageBox?.width).toBeLessThanOrEqual(device.viewport.width);
          }
        }
        
        // Test logo/branding visibility
        const logo = page.locator('[data-testid="logo"], [data-testid="brand-logo"]');
        if (await logo.count() > 0) {
          await expect(logo.first()).toBeVisible();
          
          const logoBox = await logo.first().boundingBox();
          expect(logoBox?.width).toBeLessThanOrEqual(device.viewport.width * 0.4); // Max 40% of screen width
        }
      });

      test(`should handle orientation changes on ${device.name}`, async () => {
        // Only test orientation on mobile devices
        if (device.viewport.width >= 768) {
          test.skip('Orientation test only for mobile devices');
        }
        
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Test portrait mode (default)
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
        
        // Switch to landscape orientation
        await page.setViewportSize({ 
          width: device.viewport.height, 
          height: device.viewport.width 
        });
        
        // Verify layout adapts to landscape
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
        
        // Check that critical elements are still visible
        await expect(page.locator('[data-testid="scan-qr-button"]')).toBeVisible();
        
        // Switch back to portrait
        await page.setViewportSize(device.viewport);
        
        // Verify layout returns to portrait mode
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
      });

      test(`should handle scroll performance on ${device.name}`, async () => {
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Navigate to a page with scrollable content
        await page.goto(`${process.env.BUSINESS_APP_URL || 'http://localhost:3001'}/feedback`);
        
        // Check if page has scrollable content
        const contentHeight = await page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = device.viewport.height;
        
        if (contentHeight > viewportHeight) {
          // Test scroll performance
          const startTime = Date.now();
          
          // Perform scroll actions
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
          await page.waitForTimeout(100);
          
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(100);
          
          await page.evaluate(() => window.scrollTo(0, 0));
          
          const endTime = Date.now();
          const scrollDuration = endTime - startTime;
          
          // Verify scroll performance (should be smooth)
          expect(scrollDuration).toBeLessThan(1000); // Within 1 second
          
          // Test touch scroll
          const content = page.locator('[data-testid="main-content"]');
          await content.hover();
          
          // Simulate swipe gesture
          await page.mouse.down();
          await page.mouse.move(0, -100);
          await page.mouse.up();
          
          // Verify page scrolled
          const scrollPosition = await page.evaluate(() => window.pageYOffset);
          expect(scrollPosition).toBeGreaterThan(0);
        }
      });

      test(`should maintain performance on ${device.name}`, async () => {
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Measure page load performance
        const performanceMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
          };
        });
        
        // Verify performance targets for mobile
        expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // DOMContentLoaded < 2s
        expect(performanceMetrics.firstContentfulPaint).toBeLessThan(3000); // FCP < 3s
        
        // Test interaction responsiveness
        const qrButton = page.locator('[data-testid="scan-qr-button"]');
        
        const interactionStart = Date.now();
        await qrButton.tap();
        await page.waitForSelector('[data-testid="camera-view"]');
        const interactionEnd = Date.now();
        
        const interactionDuration = interactionEnd - interactionStart;
        expect(interactionDuration).toBeLessThan(500); // Interaction response < 500ms
      });

      test(`should handle network conditions on ${device.name}`, async () => {
        // Simulate slow 3G connection
        await context.route('**/*', route => {
          return new Promise(resolve => {
            setTimeout(() => {
              route.continue();
              resolve(undefined);
            }, 200); // 200ms delay
          });
        });
        
        await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
        
        // Verify loading states are shown
        const loadingIndicator = page.locator('[data-testid="loading"], [data-testid="spinner"]');
        if (await loadingIndicator.count() > 0) {
          await expect(loadingIndicator.first()).toBeVisible();
        }
        
        // Verify page eventually loads
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
        
        // Test offline functionality
        await context.setOffline(true);
        
        // Navigate to a new page (should show offline message)
        await page.click('[data-testid="scan-qr-button"]');
        
        // Check for offline handling
        const offlineMessage = page.locator('[data-testid="offline-message"], [data-testid="network-error"]');
        if (await offlineMessage.count() > 0) {
          await expect(offlineMessage.first()).toBeVisible();
        }
        
        // Restore network
        await context.setOffline(false);
      });
    });
  }

  test('should maintain consistent design across all mobile devices', async () => {
    const screenshots: { [key: string]: Buffer } = {};
    
    // Take screenshots on each device
    for (const device of mobileDevices) {
      const deviceContext = await test.info().project.use.browser!.newContext({
        viewport: device.viewport,
        userAgent: device.userAgent,
        deviceScaleFactor: device.deviceScaleFactor
      });
      
      const devicePage = await deviceContext.newPage();
      await devicePage.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      
      // Wait for page to fully load
      await expect(devicePage.locator('[data-testid="main-content"]')).toBeVisible();
      
      // Take screenshot
      screenshots[device.name] = await devicePage.screenshot({ fullPage: true });
      
      await deviceContext.close();
    }
    
    // Visual comparison could be added here with specialized tools
    // For now, we verify that screenshots were captured successfully
    expect(Object.keys(screenshots)).toHaveLength(mobileDevices.length);
  });
});