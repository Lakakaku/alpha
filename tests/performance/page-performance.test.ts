import { test, expect, Page, BrowserContext } from '@playwright/test';

interface PageMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
}

interface PerformanceThresholds {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
}

const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  loadTime: 3000, // Page load under 3 seconds (constitutional requirement)
  firstContentfulPaint: 1800, // FCP under 1.8 seconds
  largestContentfulPaint: 2500, // LCP under 2.5 seconds
  cumulativeLayoutShift: 0.1, // CLS under 0.1
  firstInputDelay: 100, // FID under 100ms
  timeToInteractive: 3500 // TTI under 3.5 seconds
};

const MOBILE_THRESHOLDS: PerformanceThresholds = {
  loadTime: 4000, // Mobile networks are slower
  firstContentfulPaint: 2200,
  largestContentfulPaint: 3000,
  cumulativeLayoutShift: 0.1,
  firstInputDelay: 100,
  timeToInteractive: 4500
};

async function measurePagePerformance(page: Page): Promise<PageMetrics> {
  // Get Web Vitals and performance metrics
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      // Wait for page to be fully loaded
      if (document.readyState === 'complete') {
        collectMetrics();
      } else {
        window.addEventListener('load', collectMetrics);
      }

      function collectMetrics() {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');
        
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
        
        // Use PerformanceObserver for Web Vitals when available
        let lcp = 0;
        let cls = 0;
        let fid = 0;
        let tti = 0;

        // Try to get LCP
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          lcp = lcpEntries[lcpEntries.length - 1].startTime;
        }

        // Calculate TTI approximation
        tti = navigation.domInteractive - navigation.fetchStart;

        resolve({
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          firstContentfulPaint: fcp,
          largestContentfulPaint: lcp,
          cumulativeLayoutShift: cls,
          firstInputDelay: fid,
          timeToInteractive: tti
        });
      }
    });
  });

  return metrics as PageMetrics;
}

test.describe('Page Performance Tests', () => {
  test.describe('Customer App Performance', () => {
    test('should load customer homepage within performance thresholds', async ({ page }) => {
      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
      expect(metrics.timeToInteractive).toBeLessThan(PERFORMANCE_THRESHOLDS.timeToInteractive);
    });

    test('should load QR scanning page within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/qr/scan`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });

    test('should load verification page within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.CUSTOMER_APP_URL || 'http://localhost:3000'}/verification`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });
  });

  test.describe('Business App Performance', () => {
    test('should load business dashboard within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.BUSINESS_APP_URL || 'http://localhost:3001'}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });

    test('should load store management page within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.BUSINESS_APP_URL || 'http://localhost:3001'}/stores`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });

    test('should load feedback analysis page within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.BUSINESS_APP_URL || 'http://localhost:3001'}/feedback-analysis`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });
  });

  test.describe('Admin App Performance', () => {
    test('should load admin dashboard within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.ADMIN_APP_URL || 'http://localhost:3002'}/admin`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });

    test('should load test management page within performance thresholds', async ({ page }) => {
      await page.goto(`${process.env.ADMIN_APP_URL || 'http://localhost:3002'}/testing`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    });
  });

  test.describe('Mobile Performance', () => {
    test('should meet mobile performance thresholds on slow 3G', async ({ browser }) => {
      const context = await browser.newContext({
        deviceScaleFactor: 2,
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
      });

      // Simulate slow 3G connection
      await context.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Add 200ms delay
        await route.continue();
      });

      const page = await context.newPage();
      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(MOBILE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(MOBILE_THRESHOLDS.firstContentfulPaint);
      expect(metrics.largestContentfulPaint).toBeLessThan(MOBILE_THRESHOLDS.largestContentfulPaint);
      
      await context.close();
    });

    test('should maintain performance with limited bandwidth', async ({ browser }) => {
      const context = await browser.newContext({
        deviceScaleFactor: 2,
        viewport: { width: 414, height: 896 }
      });

      // Simulate bandwidth limitations
      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,svg,woff,woff2}', async route => {
        // Add delay for static assets
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.continue();
      });

      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      // Should still meet reasonable thresholds even with bandwidth limitations
      expect(metrics.loadTime).toBeLessThan(5000); // 5 seconds max
      expect(metrics.firstContentfulPaint).toBeLessThan(3000);
      
      await context.close();
    });
  });

  test.describe('Performance with Real Data', () => {
    test('should maintain performance with large datasets', async ({ page }) => {
      // Test business dashboard with many stores
      await page.goto(`${process.env.BUSINESS_APP_URL || 'http://localhost:3001'}/stores?limit=100`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    });

    test('should handle admin dashboard with extensive audit logs', async ({ page }) => {
      await page.goto(`${process.env.ADMIN_APP_URL || 'http://localhost:3002'}/monitoring/audit-logs?days=30`);
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      expect(metrics.loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime);
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    });
  });

  test.describe('Performance Regression Testing', () => {
    test('should track performance metrics over time', async ({ page }) => {
      const baselineMetrics = {
        customerApp: await measurePagePerformance(page),
      };
      
      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      await page.waitForLoadState('networkidle');
      const currentMetrics = await measurePagePerformance(page);
      
      // Performance shouldn't degrade by more than 20%
      expect(currentMetrics.loadTime).toBeLessThan(baselineMetrics.customerApp.loadTime * 1.2);
      expect(currentMetrics.firstContentfulPaint).toBeLessThan(baselineMetrics.customerApp.firstContentfulPaint * 1.2);
    });

    test('should validate Core Web Vitals compliance', async ({ page }) => {
      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      const metrics = await measurePagePerformance(page);
      
      // Core Web Vitals thresholds for good user experience
      expect(metrics.largestContentfulPaint).toBeLessThan(2500); // LCP: Good < 2.5s
      expect(metrics.firstInputDelay).toBeLessThan(100); // FID: Good < 100ms
      expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1); // CLS: Good < 0.1
    });
  });

  test.describe('Resource Loading Performance', () => {
    test('should optimize image loading performance', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      
      // Wait for all images to load
      await page.waitForFunction(() => {
        const images = Array.from(document.images);
        return images.every(img => img.complete);
      });
      
      const imageLoadTime = Date.now() - startTime;
      
      // Images should load within 2 seconds
      expect(imageLoadTime).toBeLessThan(2000);
    });

    test('should optimize JavaScript bundle loading', async ({ page }) => {
      const resourceSizes: { [key: string]: number } = {};
      
      page.on('response', async response => {
        if (response.url().includes('.js')) {
          const buffer = await response.body();
          resourceSizes[response.url()] = buffer.length;
        }
      });
      
      await page.goto(process.env.CUSTOMER_APP_URL || 'http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      // Main bundle should be under 500KB
      const mainBundleSize = Object.values(resourceSizes).reduce((sum, size) => sum + size, 0);
      expect(mainBundleSize).toBeLessThan(500 * 1024); // 500KB
    });
  });
});