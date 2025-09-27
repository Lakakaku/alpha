import { test, expect, Page, BrowserContext } from '@playwright/test';
import { SwedishDataGenerator } from '../../generators/swedish-data';

test.describe('Admin Test Management', () => {
  let page: Page;
  let context: BrowserContext;
  let dataGenerator: SwedishDataGenerator;
  let mockAdmin: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, // Large desktop viewport for admin
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    dataGenerator = new SwedishDataGenerator();
    mockAdmin = {
      id: 'admin-123',
      email: 'admin@vocilia.se',
      firstName: 'Anna',
      lastName: 'Andersson',
      role: 'super_admin'
    };
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock admin authentication
    await page.addInitScript((admin) => {
      localStorage.setItem('admin_auth_token', 'mock-admin-jwt-token');
      localStorage.setItem('admin_user', JSON.stringify(admin));
      localStorage.setItem('admin_permissions', JSON.stringify({
        canManageTests: true,
        canViewTestResults: true,
        canRunTests: true,
        canConfigureTestSuites: true
      }));
    }, mockAdmin);
    
    // Navigate to admin dashboard
    await page.goto(process.env.ADMIN_APP_URL || 'http://localhost:3002');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display admin test management dashboard', async () => {
    // Verify admin dashboard loads
    await expect(page).toHaveTitle(/Vocilia Admin/);
    await expect(page.locator('[data-testid="admin-header"]')).toBeVisible();
    
    // Navigate to testing section
    await page.click('[data-testid="nav-testing"]');
    await expect(page).toHaveURL(/.*\/testing/);
    
    // Verify testing dashboard components
    await expect(page.locator('[data-testid="testing-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-suites-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-test-runs"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-metrics"]')).toBeVisible();
    
    // Verify metrics cards
    await expect(page.locator('[data-testid="metric-total-tests"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-pass-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-coverage"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-last-run"]')).toBeVisible();
  });

  test('should create and configure test suites', async () => {
    await page.click('[data-testid="nav-testing"]');
    
    // Click create test suite
    await page.click('[data-testid="create-test-suite-button"]');
    
    // Verify create suite modal
    await expect(page.locator('[data-testid="create-suite-modal"]')).toBeVisible();
    
    // Fill test suite details
    await page.fill('[data-testid="suite-name-input"]', 'Customer QR Workflow Tests');
    await page.fill('[data-testid="suite-description-input"]', 
      'Comprehensive tests for QR scanning and verification workflow');
    
    // Select suite type
    await page.click('[data-testid="suite-type-select"]');
    await page.click('[data-testid="suite-type-e2e"]');
    
    // Select component
    await page.click('[data-testid="suite-component-select"]');
    await page.click('[data-testid="component-customer-app"]');
    
    // Set priority
    await page.click('[data-testid="suite-priority-select"]');
    await page.click('[data-testid="priority-critical"]');
    
    // Set coverage target
    await page.fill('[data-testid="coverage-target-input"]', '95');
    
    // Enable suite
    await page.check('[data-testid="suite-enabled-checkbox"]');
    
    // Submit suite creation
    await page.click('[data-testid="submit-suite-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="suite-created-success"]')).toBeVisible();
    
    // Verify suite appears in list
    await expect(page.locator('[data-testid="suite-Customer QR Workflow Tests"]')).toBeVisible();
  });

  test('should execute test runs and monitor progress', async () => {
    await page.click('[data-testid="nav-testing"]');
    
    // Click run all tests
    await page.click('[data-testid="run-all-tests-button"]');
    
    // Verify run confirmation modal
    await expect(page.locator('[data-testid="run-confirmation-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="run-environment-select"]')).toBeVisible();
    
    // Select test environment
    await page.click('[data-testid="run-environment-select"]');
    await page.click('[data-testid="environment-staging"]');
    
    // Confirm test run
    await page.click('[data-testid="confirm-run-button"]');
    
    // Verify test run started
    await expect(page.locator('[data-testid="test-run-started"]')).toBeVisible();
    await expect(page.locator('[data-testid="run-progress-bar"]')).toBeVisible();
    
    // Wait for test execution to begin
    await expect(page.locator('[data-testid="test-status-running"]')).toBeVisible();
    
    // Verify real-time updates
    await expect(page.locator('[data-testid="tests-completed-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="tests-failed-count"]')).toBeVisible();
    
    // Click to view detailed progress
    await page.click('[data-testid="view-detailed-progress"]');
    
    // Verify detailed test execution view
    await expect(page.locator('[data-testid="test-execution-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-logs-panel"]')).toBeVisible();
    
    // Verify individual test status updates
    await expect(page.locator('[data-testid="test-item-status"]').first()).toBeVisible();
  });

  test('should view and analyze test results', async () => {
    await page.click('[data-testid="nav-testing"]');
    
    // Click on recent test run
    await page.click('[data-testid="test-run-item"]:first-child');
    
    // Verify test run details page
    await expect(page.locator('[data-testid="test-run-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="run-summary-stats"]')).toBeVisible();
    
    // Verify test results breakdown
    await expect(page.locator('[data-testid="tests-passed-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="tests-failed-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="tests-skipped-count"]')).toBeVisible();
    
    // Verify coverage information
    await expect(page.locator('[data-testid="coverage-overall"]')).toBeVisible();
    await expect(page.locator('[data-testid="coverage-by-component"]')).toBeVisible();
    
    // Click on failed test to see details
    await page.click('[data-testid="failed-test-item"]:first-child');
    
    // Verify test failure details modal
    await expect(page.locator('[data-testid="test-failure-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="failure-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="failure-stack-trace"]')).toBeVisible();
    
    // Verify screenshots if available
    const screenshotElement = page.locator('[data-testid="failure-screenshot"]');
    if (await screenshotElement.isVisible()) {
      await expect(screenshotElement).toBeVisible();
    }
    
    // Test retry functionality
    await page.click('[data-testid="retry-failed-test-button"]');
    await expect(page.locator('[data-testid="test-retry-initiated"]')).toBeVisible();
  });

  test('should manage performance benchmarks', async () => {
    await page.click('[data-testid="nav-testing"]');
    await page.click('[data-testid="performance-tab"]');
    
    // Verify performance benchmarks section
    await expect(page.locator('[data-testid="performance-benchmarks"]')).toBeVisible();
    
    // Click create new benchmark
    await page.click('[data-testid="create-benchmark-button"]');
    
    // Verify create benchmark modal
    await expect(page.locator('[data-testid="create-benchmark-modal"]')).toBeVisible();
    
    // Fill benchmark details
    await page.fill('[data-testid="benchmark-operation-input"]', 'qr-scan-response');
    await page.fill('[data-testid="benchmark-component-input"]', 'customer-app');
    
    // Select metric type
    await page.click('[data-testid="benchmark-metric-select"]');
    await page.click('[data-testid="metric-response-time"]');
    
    // Set target value
    await page.fill('[data-testid="benchmark-target-input"]', '1000');
    await page.fill('[data-testid="benchmark-unit-input"]', 'ms');
    
    // Set thresholds
    await page.fill('[data-testid="benchmark-warning-threshold"]', '800');
    await page.fill('[data-testid="benchmark-critical-threshold"]', '1200');
    
    // Submit benchmark
    await page.click('[data-testid="submit-benchmark-button"]');
    
    // Verify benchmark created
    await expect(page.locator('[data-testid="benchmark-created-success"]')).toBeVisible();
    
    // Verify benchmark appears in list
    await expect(page.locator('[data-testid="benchmark-qr-scan-response"]')).toBeVisible();
  });

  test('should configure test data management', async () => {
    await page.click('[data-testid="nav-testing"]');
    await page.click('[data-testid="test-data-tab"]');
    
    // Verify test data management section
    await expect(page.locator('[data-testid="test-data-management"]')).toBeVisible();
    
    // Click create dataset
    await page.click('[data-testid="create-dataset-button"]');
    
    // Verify create dataset modal
    await expect(page.locator('[data-testid="create-dataset-modal"]')).toBeVisible();
    
    // Fill dataset details
    await page.fill('[data-testid="dataset-name-input"]', 'Swedish Customers');
    
    // Select category
    await page.click('[data-testid="dataset-category-select"]');
    await page.click('[data-testid="category-users"]');
    
    // Configure generator settings
    await page.click('[data-testid="generator-config-expand"]');
    
    // Set locale
    await page.click('[data-testid="generator-locale-select"]');
    await page.click('[data-testid="locale-sv-se"]');
    
    // Set sample size
    await page.fill('[data-testid="dataset-sample-size"]', '1000');
    
    // Set refresh strategy
    await page.click('[data-testid="refresh-strategy-select"]');
    await page.click('[data-testid="strategy-per-run"]');
    
    // Enable dataset
    await page.check('[data-testid="dataset-enabled-checkbox"]');
    
    // Submit dataset creation
    await page.click('[data-testid="submit-dataset-button"]');
    
    // Verify dataset created
    await expect(page.locator('[data-testid="dataset-created-success"]')).toBeVisible();
    
    // Test dataset preview
    await page.click('[data-testid="dataset-Swedish Customers"] [data-testid="preview-button"]');
    
    // Verify preview modal
    await expect(page.locator('[data-testid="dataset-preview-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-data-table"]')).toBeVisible();
    
    // Verify Swedish data characteristics
    const firstRowData = await page.locator('[data-testid="preview-row-0"]').textContent();
    expect(firstRowData).toMatch(/\+46/); // Swedish phone number
  });

  test('should export test reports and analytics', async () => {
    await page.click('[data-testid="nav-testing"]');
    await page.click('[data-testid="reports-tab"]');
    
    // Verify reports section
    await expect(page.locator('[data-testid="test-reports"]')).toBeVisible();
    
    // Select report type
    await page.click('[data-testid="report-type-select"]');
    await page.click('[data-testid="report-type-comprehensive"]');
    
    // Set date range
    await page.click('[data-testid="report-date-range"]');
    await page.click('[data-testid="date-range-last-30-days"]');
    
    // Select components to include
    await page.check('[data-testid="include-unit-tests"]');
    await page.check('[data-testid="include-integration-tests"]');
    await page.check('[data-testid="include-e2e-tests"]');
    await page.check('[data-testid="include-performance-tests"]');
    
    // Generate report
    await page.click('[data-testid="generate-report-button"]');
    
    // Verify report generation progress
    await expect(page.locator('[data-testid="report-generating"]')).toBeVisible();
    
    // Wait for report completion
    await expect(page.locator('[data-testid="report-ready"]')).toBeVisible();
    
    // Test report download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-report-button"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/test-report-.*\.pdf/);
    
    // Test CSV export
    const csvDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const csvDownload = await csvDownloadPromise;
    
    expect(csvDownload.suggestedFilename()).toMatch(/test-results-.*\.csv/);
  });

  test('should handle test environment management', async () => {
    await page.click('[data-testid="nav-testing"]');
    await page.click('[data-testid="environments-tab"]');
    
    // Verify environments section
    await expect(page.locator('[data-testid="test-environments"]')).toBeVisible();
    
    // Click create environment
    await page.click('[data-testid="create-environment-button"]');
    
    // Verify create environment modal
    await expect(page.locator('[data-testid="create-environment-modal"]')).toBeVisible();
    
    // Fill environment details
    await page.fill('[data-testid="environment-name-input"]', 'E2E Testing Environment');
    
    // Select environment type
    await page.click('[data-testid="environment-type-select"]');
    await page.click('[data-testid="type-staging"]');
    
    // Configure environment settings
    await page.fill('[data-testid="database-url-input"]', 'postgresql://localhost:5432/vocilia_test');
    await page.fill('[data-testid="api-base-url-input"]', 'https://api-staging.vocilia.com');
    await page.fill('[data-testid="frontend-url-input"]', 'https://staging.vocilia.com');
    
    // Configure browser settings for E2E tests
    await page.check('[data-testid="browser-chrome"]');
    await page.check('[data-testid="browser-firefox"]');
    await page.check('[data-testid="browser-safari"]');
    
    // Set viewport configuration
    await page.fill('[data-testid="viewport-width"]', '1280');
    await page.fill('[data-testid="viewport-height"]', '720');
    
    // Enable headless mode
    await page.check('[data-testid="headless-mode"]');
    
    // Submit environment creation
    await page.click('[data-testid="submit-environment-button"]');
    
    // Verify environment created
    await expect(page.locator('[data-testid="environment-created-success"]')).toBeVisible();
    
    // Test environment health check
    await page.click('[data-testid="environment-E2E Testing Environment"] [data-testid="health-check-button"]');
    
    // Verify health check results
    await expect(page.locator('[data-testid="health-check-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="database-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="frontend-status"]')).toBeVisible();
  });

  test('should validate admin permissions and access control', async () => {
    // Test super admin has full access
    await page.click('[data-testid="nav-testing"]');
    
    // Verify all admin functions are available
    await expect(page.locator('[data-testid="create-test-suite-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="run-all-tests-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-test-data-button"]')).toBeVisible();
    
    // Simulate limited admin permissions
    await page.addInitScript(() => {
      localStorage.setItem('admin_permissions', JSON.stringify({
        canManageTests: false,
        canViewTestResults: true,
        canRunTests: false,
        canConfigureTestSuites: false
      }));
    });
    
    // Reload page to apply permission changes
    await page.reload();
    await page.click('[data-testid="nav-testing"]');
    
    // Verify restricted access
    await expect(page.locator('[data-testid="create-test-suite-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="run-all-tests-button"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="delete-test-data-button"]')).not.toBeVisible();
    
    // But can still view results
    await expect(page.locator('[data-testid="recent-test-runs"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-metrics"]')).toBeVisible();
  });
});