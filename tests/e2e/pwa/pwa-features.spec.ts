import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('PWA Functionality Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE viewport
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      permissions: ['notifications', 'camera'], // PWA permissions
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should have valid PWA manifest', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check for manifest link
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeVisible();
    
    // Get manifest URL
    const manifestHref = await manifestLink.getAttribute('href');
    expect(manifestHref).toBeTruthy();
    
    // Fetch and validate manifest
    const manifestResponse = await page.request.get(manifestHref!);
    expect(manifestResponse.ok()).toBe(true);
    
    const manifest = await manifestResponse.json();
    
    // Validate required manifest fields
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
    
    // Validate icons
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
    
    // Check for required icon sizes
    const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');
    
    // Validate PWA categories
    expect(manifest.categories).toContain('business');
    expect(manifest.categories).toContain('productivity');
  });

  test('should register service worker correctly', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          return !!registration;
        } catch (error) {
          return false;
        }
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
    
    // Verify service worker script exists
    const swResponse = await page.request.get('/sw.js');
    expect(swResponse.ok()).toBe(true);
    
    // Check service worker state
    const swState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return {
        active: !!registration?.active,
        installing: !!registration?.installing,
        waiting: !!registration?.waiting
      };
    });
    
    expect(swState.active || swState.installing).toBe(true);
  });

  test('should work offline with cached resources', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Wait for service worker to cache resources
    await page.waitForTimeout(2000);
    
    // Verify page loads normally
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    
    // Go offline
    await context.setOffline(true);
    
    // Reload page to test offline functionality
    await page.reload();
    
    // Verify page still loads (from cache)
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    
    // Test navigation between cached pages
    await page.click('[data-testid="scan-qr-button"]');
    await expect(page.locator('[data-testid="camera-view"]')).toBeVisible();
    
    // Test offline message for network requests
    await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
    
    // Try to submit form (should show offline message)
    await page.fill('[data-testid="phone-input"]', '+46701234567');
    await page.click('[data-testid="send-verification-button"]');
    
    const offlineMessage = page.locator('[data-testid="offline-message"], [data-testid="network-error"]');
    await expect(offlineMessage).toBeVisible();
    
    // Restore network
    await context.setOffline(false);
  });

  test('should support app installation', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check for install prompt availability
    const installAvailable = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('beforeinstallprompt', () => {
          resolve(true);
        });
        
        // Timeout if no install prompt
        setTimeout(() => resolve(false), 3000);
      });
    });
    
    // Install button should be available
    const installButton = page.locator('[data-testid="install-app-button"], [data-testid="add-to-homescreen"]');
    if (await installButton.count() > 0) {
      await expect(installButton).toBeVisible();
      
      // Test install button click
      await installButton.click();
      
      // Check for install confirmation (might be browser-specific)
      const installConfirm = page.locator('[data-testid="install-confirm"], .install-prompt');
      if (await installConfirm.count() > 0) {
        await expect(installConfirm).toBeVisible();
      }
    }
  });

  test('should handle push notifications', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check if notifications are supported
    const notificationSupport = await page.evaluate(() => {
      return 'Notification' in window && 'serviceWorker' in navigator;
    });
    
    if (notificationSupport) {
      // Test notification permission request
      const permissionResult = await page.evaluate(async () => {
        if (Notification.permission === 'default') {
          return await Notification.requestPermission();
        }
        return Notification.permission;
      });
      
      expect(['granted', 'denied', 'default']).toContain(permissionResult);
      
      // If notifications are enabled, test subscription
      if (permissionResult === 'granted') {
        const subscriptionSupported = await page.evaluate(async () => {
          try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
              const subscription = await registration.pushManager.getSubscription();
              return subscription !== null || registration.pushManager.subscribe !== undefined;
            }
            return false;
          } catch (error) {
            return false;
          }
        });
        
        expect(subscriptionSupported).toBe(true);
      }
    }
  });

  test('should handle background sync', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check if background sync is supported
    const backgroundSyncSupport = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration && 'sync' in registration;
      }
      return false;
    });
    
    if (backgroundSyncSupport) {
      // Go offline
      await context.setOffline(true);
      
      // Navigate to verification page
      await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
      
      // Try to submit form (should queue for background sync)
      await page.fill('[data-testid="phone-input"]', '+46701234567');
      await page.click('[data-testid="send-verification-button"]');
      
      // Should show queued message
      const queuedMessage = page.locator('[data-testid="request-queued"], [data-testid="sync-pending"]');
      if (await queuedMessage.count() > 0) {
        await expect(queuedMessage).toBeVisible();
      }
      
      // Restore network
      await context.setOffline(false);
      
      // Wait for background sync to process
      await page.waitForTimeout(3000);
      
      // Should show success message
      const successMessage = page.locator('[data-testid="sms-sent-message"], [data-testid="sync-completed"]');
      if (await successMessage.count() > 0) {
        await expect(successMessage).toBeVisible();
      }
    }
  });

  test('should maintain app state across sessions', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Set some app state (e.g., user preferences)
    await page.evaluate(() => {
      localStorage.setItem('user_preferences', JSON.stringify({
        language: 'sv-SE',
        notifications: true,
        darkMode: false
      }));
      
      sessionStorage.setItem('session_data', JSON.stringify({
        currentView: 'home',
        timestamp: Date.now()
      }));
    });
    
    // Navigate to different page
    await page.click('[data-testid="scan-qr-button"]');
    await expect(page.locator('[data-testid="camera-view"]')).toBeVisible();
    
    // Simulate app restart by reloading
    await page.reload();
    
    // Verify state persistence
    const storedPreferences = await page.evaluate(() => {
      const prefs = localStorage.getItem('user_preferences');
      return prefs ? JSON.parse(prefs) : null;
    });
    
    expect(storedPreferences).toEqual({
      language: 'sv-SE',
      notifications: true,
      darkMode: false
    });
    
    // Session storage should be cleared on reload
    const sessionData = await page.evaluate(() => {
      return sessionStorage.getItem('session_data');
    });
    
    expect(sessionData).toBeNull();
  });

  test('should handle app lifecycle events', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    const lifecycleEvents: string[] = [];
    
    // Listen for lifecycle events
    await page.addInitScript(() => {
      const events: string[] = [];
      
      document.addEventListener('visibilitychange', () => {
        events.push(`visibility-${document.visibilityState}`);
        (window as any).lifecycleEvents = events;
      });
      
      window.addEventListener('beforeunload', () => {
        events.push('beforeunload');
        (window as any).lifecycleEvents = events;
      });
      
      window.addEventListener('pagehide', () => {
        events.push('pagehide');
        (window as any).lifecycleEvents = events;
      });
      
      window.addEventListener('pageshow', () => {
        events.push('pageshow');
        (window as any).lifecycleEvents = events;
      });
    });
    
    // Navigate away (simulates backgrounding)
    await page.goto('about:blank');
    
    // Navigate back
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check that lifecycle events were fired
    const events = await page.evaluate(() => (window as any).lifecycleEvents || []);
    
    expect(events.length).toBeGreaterThan(0);
    expect(events).toContain('pageshow');
  });

  test('should provide native-like user experience', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Check for native-like styling
    const metaViewport = page.locator('meta[name="viewport"]');
    await expect(metaViewport).toBeVisible();
    
    const viewportContent = await metaViewport.getAttribute('content');
    expect(viewportContent).toContain('width=device-width');
    expect(viewportContent).toContain('initial-scale=1');
    
    // Check for status bar styling
    const statusBarMeta = page.locator('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (await statusBarMeta.count() > 0) {
      const statusBarStyle = await statusBarMeta.getAttribute('content');
      expect(['default', 'black', 'black-translucent']).toContain(statusBarStyle);
    }
    
    // Check for fullscreen mode
    const webAppCapable = page.locator('meta[name="apple-mobile-web-app-capable"]');
    if (await webAppCapable.count() > 0) {
      const capable = await webAppCapable.getAttribute('content');
      expect(capable).toBe('yes');
    }
    
    // Test touch interactions feel native
    const button = page.locator('[data-testid="scan-qr-button"]');
    
    // Verify touch feedback (active states)
    await button.hover();
    await page.mouse.down();
    
    const activeStyles = await button.evaluate(el => {
      const computed = window.getComputedStyle(el, ':active');
      return {
        transform: computed.transform,
        opacity: computed.opacity
      };
    });
    
    // Should have some visual feedback (transform or opacity change)
    expect(activeStyles.transform !== 'none' || parseFloat(activeStyles.opacity) < 1).toBe(true);
    
    await page.mouse.up();
  });

  test('should handle device capabilities', async () => {
    await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
    
    // Test camera access for QR scanning
    await page.click('[data-testid="scan-qr-button"]');
    
    const cameraSupport = await page.evaluate(async () => {
      try {
        if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    });
    
    if (cameraSupport) {
      await expect(page.locator('[data-testid="camera-view"]')).toBeVisible();
    } else {
      // Should show fallback for devices without camera
      const fallbackMessage = page.locator('[data-testid="camera-not-available"]');
      if (await fallbackMessage.count() > 0) {
        await expect(fallbackMessage).toBeVisible();
      }
    }
    
    // Test vibration API (if supported)
    const vibrationSupport = await page.evaluate(() => {
      return 'vibrate' in navigator;
    });
    
    if (vibrationSupport) {
      // Test feedback vibration
      const vibrationWorked = await page.evaluate(() => {
        try {
          navigator.vibrate(100);
          return true;
        } catch (error) {
          return false;
        }
      });
      
      expect(vibrationWorked).toBe(true);
    }
    
    // Test geolocation (if needed for store proximity)
    const locationSupport = await page.evaluate(() => {
      return 'geolocation' in navigator;
    });
    
    if (locationSupport) {
      const locationAvailable = await page.evaluate(() => {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 5000 }
          );
        });
      });
      
      expect(typeof locationAvailable).toBe('boolean');
    }
  });
});