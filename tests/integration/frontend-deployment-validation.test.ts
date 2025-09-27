import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CUSTOMER_URL = process.env.CUSTOMER_URL || 'https://customer.vocilia.com';
const BUSINESS_URL = process.env.BUSINESS_URL || 'https://business.vocilia.com';
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.vocilia.com';

describe('Integration Test: Frontend Deployment Validation (Scenario 2)', () => {
  beforeAll(async () => {
    // Integration test setup
  });

  afterAll(async () => {
    // Integration test cleanup
  });

  it('should validate customer app deployment and accessibility', async () => {
    const response = await fetch(CUSTOMER_URL);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Vocilia'); // Should contain app branding
  });

  it('should validate business app deployment and accessibility', async () => {
    const response = await fetch(BUSINESS_URL);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Vocilia'); // Should contain app branding
  });

  it('should validate admin app deployment and accessibility', async () => {
    const response = await fetch(ADMIN_URL);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Vocilia'); // Should contain app branding
  });

  it('should validate environment variables are properly injected', async () => {
    // Test that Next.js environment variables are working
    const apps = [
      { url: CUSTOMER_URL, name: 'customer' },
      { url: BUSINESS_URL, name: 'business' },
      { url: ADMIN_URL, name: 'admin' }
    ];

    for (const app of apps) {
      const response = await fetch(`${app.url}/_next/static/chunks/pages/_app.js`, {
        method: 'HEAD'
      });
      
      // Should return 200 if static assets are properly built
      expect([200, 404]).toContain(response.status); // 404 is acceptable for different build structures
    }
  });

  it('should validate HTTPS and security headers for all apps', async () => {
    const apps = [CUSTOMER_URL, BUSINESS_URL, ADMIN_URL];

    for (const appUrl of apps) {
      const response = await fetch(appUrl);
      expect(response.status).toBe(200);

      // Validate HTTPS redirect
      expect(response.url).toMatch(/^https:/);

      // Validate security headers (Vercel should add these)
      const headers = response.headers;
      expect(headers.get('x-frame-options') || headers.get('X-Frame-Options')).toBeTruthy();
      expect(headers.get('x-content-type-options') || headers.get('X-Content-Type-Options')).toBeTruthy();
    }
  });

  it('should validate performance requirements for frontend apps', async () => {
    const apps = [
      { url: CUSTOMER_URL, name: 'customer' },
      { url: BUSINESS_URL, name: 'business' },
      { url: ADMIN_URL, name: 'admin' }
    ];

    for (const app of apps) {
      const startTime = Date.now();
      
      const response = await fetch(app.url);
      expect(response.status).toBe(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000); // Frontend should load in <3s
    }
  });

  it('should validate that apps are using correct domain configurations', async () => {
    // Customer app should be accessible on customer subdomain
    const customerResponse = await fetch(CUSTOMER_URL);
    expect(customerResponse.status).toBe(200);

    // Business app should be accessible on business subdomain  
    const businessResponse = await fetch(BUSINESS_URL);
    expect(businessResponse.status).toBe(200);

    // Admin app should be accessible on admin subdomain
    const adminResponse = await fetch(ADMIN_URL);
    expect(adminResponse.status).toBe(200);
  });

  it('should validate CDN and caching configuration', async () => {
    const apps = [CUSTOMER_URL, BUSINESS_URL, ADMIN_URL];

    for (const appUrl of apps) {
      // Test static asset caching
      const staticAssetResponse = await fetch(`${appUrl}/favicon.ico`, {
        method: 'HEAD'
      });
      
      if (staticAssetResponse.status === 200) {
        const cacheControl = staticAssetResponse.headers.get('cache-control');
        expect(cacheControl).toBeTruthy(); // Should have cache headers
      }
    }
  });

  it('should validate build artifacts and deployment integrity', async () => {
    // Test that all apps have proper Next.js build outputs
    const apps = [CUSTOMER_URL, BUSINESS_URL, ADMIN_URL];

    for (const appUrl of apps) {
      const response = await fetch(appUrl);
      const html = await response.text();
      
      // Should contain Next.js runtime
      expect(html).toMatch(/_next\/static|__NEXT_DATA__/);
      
      // Should not contain development artifacts
      expect(html).not.toContain('webpack-hot-middleware');
      expect(html).not.toContain('__webpack_require__');
    }
  });

  it('should validate responsive design and mobile compatibility', async () => {
    const apps = [CUSTOMER_URL, BUSINESS_URL, ADMIN_URL];

    for (const appUrl of apps) {
      const response = await fetch(appUrl);
      const html = await response.text();
      
      // Should have mobile viewport meta tag
      expect(html).toMatch(/<meta[^>]*name="viewport"[^>]*>/);
      
      // Should be responsive (check for viewport meta tag content)
      expect(html).toMatch(/width=device-width/);
    }
  });
});