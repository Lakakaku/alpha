import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing
 * Covers mobile and desktop browser testing for Vocilia Alpha PWA
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }]
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Ignore HTTPS errors (for local development)
    ignoreHTTPSErrors: true,
    
    // Accept downloads
    acceptDownloads: true,
  },
  
  // Configure projects for major browsers and mobile devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile devices (primary focus for PWA)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // Tablet devices
    {
      name: 'Tablet Chrome',
      use: { ...devices['iPad Pro'] },
    },
    
    // PWA-specific testing
    {
      name: 'PWA Mobile',
      use: {
        ...devices['Pixel 5'],
        // Simulate installed PWA
        contextOptions: {
          serviceWorkers: 'allow',
        },
      },
    },
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
  
  // Web server configuration for local development
  webServer: process.env.CI ? undefined : [
    {
      command: 'pnpm --filter @vocilia/customer dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm --filter @vocilia/business dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm --filter @vocilia/admin dev',
      port: 3002,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'pnpm --filter @vocilia/backend dev',
      port: 3333,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
  
  // Output directory
  outputDir: 'test-results/',
  
  // Test timeout
  timeout: 30 * 1000,
  
  // Expect timeout
  expect: {
    timeout: 5 * 1000,
  },
});