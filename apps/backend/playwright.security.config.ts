/**
 * Playwright Configuration for Security E2E Testing
 * Browser automation for authentication, session management, and frontend security testing
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory for security e2e tests
  testDir: './tests/e2e/security',
  
  // Test file patterns
  testMatch: [
    '**/authentication-security.e2e.ts',
    '**/session-security.e2e.ts',
    '**/admin-security.e2e.ts',
    '**/csrf-protection.e2e.ts',
    '**/xss-protection.e2e.ts'
  ],

  // Global timeout for security tests
  timeout: 30 * 1000, // 30 seconds per test

  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000 // 10 seconds for assertions
  },

  // Test execution settings
  fullyParallel: false, // Run security tests sequentially to prevent interference
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 1, // Single worker to control performance impact
  
  // Test reporter
  reporter: [
    ['html', { outputFolder: 'test-results/security-e2e' }],
    ['json', { outputFile: 'test-results/security-e2e-results.json' }],
    ['list']
  ],

  // Global test setup
  globalSetup: './src/testing/security/playwright-global-setup.ts',
  globalTeardown: './src/testing/security/playwright-global-teardown.ts',

  // Test output directory
  outputDir: 'test-results/security-artifacts',

  // Use shared configuration
  use: {
    // Base URL for testing
    baseURL: process.env.SECURITY_TEST_BASE_URL || 'http://localhost:3000',
    
    // Trace collection for security debugging
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording for security test evidence
    video: 'retain-on-failure',
    
    // Network request/response logging
    recordVideo: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 }
    },

    // Security-specific browser settings
    ignoreHTTPSErrors: false, // Strict HTTPS validation
    acceptDownloads: false, // Prevent file downloads during security tests
    
    // Network interception for security testing
    extraHTTPHeaders: {
      'X-Security-Test': 'true',
      'X-Test-Type': 'security-automation'
    },

    // Viewport for consistent testing
    viewport: { width: 1280, height: 720 },

    // User agent for security testing
    userAgent: 'Vocilia-Security-Test/1.0 Playwright'
  },

  // Browser projects for security testing
  projects: [
    {
      name: 'chromium-security',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional security testing settings
        contextOptions: {
          // Strict security headers validation
          ignoreHTTPSErrors: false,
          
          // Record network activity for security analysis
          recordVideo: {
            mode: 'retain-on-failure',
            size: { width: 1280, height: 720 }
          },

          // Permissions for security testing
          permissions: [],
          
          // Geolocation disabled for security tests
          geolocation: undefined,
          
          // Disable notifications
          hasTouch: false
        }
      },
    },

    {
      name: 'firefox-security',
      use: { 
        ...devices['Desktop Firefox'],
        contextOptions: {
          ignoreHTTPSErrors: false,
          permissions: []
        }
      },
    },

    // Mobile security testing
    {
      name: 'mobile-chrome-security',
      use: { 
        ...devices['Pixel 5'],
        contextOptions: {
          ignoreHTTPSErrors: false,
          permissions: []
        }
      },
    },

    // Admin dashboard security testing
    {
      name: 'admin-security',
      testDir: './tests/e2e/security/admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.ADMIN_BASE_URL || 'http://localhost:3002',
        storageState: './tests/fixtures/admin-auth-state.json'
      }
    },

    // Business dashboard security testing  
    {
      name: 'business-security',
      testDir: './tests/e2e/security/business',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BUSINESS_BASE_URL || 'http://localhost:3001',
        storageState: './tests/fixtures/business-auth-state.json'
      }
    }
  ],

  // Development server for testing
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start server
    env: {
      NODE_ENV: 'test',
      SECURITY_TEST_MODE: 'true',
      PERFORMANCE_MONITORING: 'true'
    }
  }
});

// Security test helper configuration
export const securityTestConfig = {
  // Performance monitoring limits (constitutional requirement)
  performanceLimit: 10, // Maximum 10% performance degradation
  
  // Authentication test settings
  bruteForceThreshold: 5, // Maximum failed login attempts
  sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  
  // CSRF protection settings
  csrfTokenName: 'csrf-token',
  csrfHeaderName: 'X-CSRF-Token',
  
  // XSS protection test payloads
  xssPayloads: [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    '"><script>alert("xss")</script>'
  ],
  
  // SQL injection test payloads
  sqlInjectionPayloads: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM admin_accounts --",
    "1'; EXEC xp_cmdshell('dir'); --"
  ],
  
  // Admin privilege escalation tests
  privilegeEscalationTests: [
    'attempt_admin_access_as_business',
    'attempt_business_data_access',
    'attempt_customer_pii_access',
    'attempt_system_config_modification'
  ],

  // Privacy protection test scenarios
  privacyTests: [
    'phone_number_exposure_prevention',
    'transaction_data_anonymization',
    'feedback_content_sanitization',
    'cross_store_data_isolation'
  ]
};