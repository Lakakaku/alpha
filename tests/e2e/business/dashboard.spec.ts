import { test, expect, Page, BrowserContext } from '@playwright/test';
import { SwedishDataGenerator } from '../../generators/swedish-data';

test.describe('Business Dashboard Workflows', () => {
  let page: Page;
  let context: BrowserContext;
  let dataGenerator: SwedishDataGenerator;
  let testBusiness: any;
  let testStore: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }, // Desktop viewport for business dashboard
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    
    dataGenerator = new SwedishDataGenerator();
    testBusiness = dataGenerator.generateStore(); // Business profile
    testStore = dataGenerator.generateStore();
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock authentication for business dashboard
    await page.addInitScript(() => {
      localStorage.setItem('business_auth_token', 'mock-jwt-token');
      localStorage.setItem('business_id', 'business-123');
    });
    
    // Navigate to business dashboard
    await page.goto(process.env.BUSINESS_APP_URL || 'http://localhost:3001');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display business dashboard overview', async () => {
    // Verify dashboard loads correctly
    await expect(page).toHaveTitle(/Vocilia Business/);
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
    
    // Verify main navigation
    await expect(page.locator('[data-testid="nav-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-stores"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-feedback"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-analytics"]')).toBeVisible();
    
    // Verify overview metrics cards
    await expect(page.locator('[data-testid="metric-total-stores"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-active-feedback"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-avg-rating"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-monthly-revenue"]')).toBeVisible();
  });

  test('should manage store creation workflow', async () => {
    // Navigate to stores section
    await page.click('[data-testid="nav-stores"]');
    await expect(page).toHaveURL(/.*\/stores/);
    
    // Click create new store
    await page.click('[data-testid="create-store-button"]');
    
    // Verify create store modal
    await expect(page.locator('[data-testid="create-store-modal"]')).toBeVisible();
    
    // Fill store information
    await page.fill('[data-testid="store-name-input"]', testStore.name);
    await page.fill('[data-testid="store-address-input"]', testStore.address.street);
    await page.fill('[data-testid="store-city-input"]', testStore.address.city);
    await page.fill('[data-testid="store-postal-code-input"]', testStore.address.postalCode);
    await page.fill('[data-testid="store-phone-input"]', testStore.phone);
    await page.fill('[data-testid="store-email-input"]', testStore.email);
    
    // Select store type
    await page.click('[data-testid="store-type-select"]');
    await page.click(`[data-testid="store-type-option-${testStore.type.toLowerCase()}"]`);
    
    // Set opening hours
    await page.fill('[data-testid="opening-hours-monday"]', '09:00-18:00');
    await page.fill('[data-testid="opening-hours-tuesday"]', '09:00-18:00');
    await page.fill('[data-testid="opening-hours-wednesday"]', '09:00-18:00');
    await page.fill('[data-testid="opening-hours-thursday"]', '09:00-18:00');
    await page.fill('[data-testid="opening-hours-friday"]', '09:00-18:00');
    await page.fill('[data-testid="opening-hours-saturday"]', '10:00-16:00');
    await page.fill('[data-testid="opening-hours-sunday"]', 'Stängt');
    
    // Submit store creation
    await page.click('[data-testid="submit-store-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="store-created-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="store-created-success"]')).toContainText('Store created successfully');
    
    // Verify store appears in store list
    await expect(page.locator(`[data-testid="store-card-${testStore.name}"]`)).toBeVisible();
  });

  test('should generate and display QR codes for stores', async () => {
    // Navigate to stores section
    await page.click('[data-testid="nav-stores"]');
    
    // Click on first store
    await page.click('[data-testid="store-card"]:first-child');
    
    // Verify store details page
    await expect(page.locator('[data-testid="store-details-header"]')).toBeVisible();
    
    // Click generate QR code
    await page.click('[data-testid="generate-qr-button"]');
    
    // Verify QR code generation modal
    await expect(page.locator('[data-testid="qr-code-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="qr-code-image"]')).toBeVisible();
    
    // Verify QR code details
    await expect(page.locator('[data-testid="qr-expiry-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="qr-session-id"]')).toBeVisible();
    
    // Test QR code download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-qr-button"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/qr-code-.*\.png/);
    
    // Test QR code refresh
    const originalSessionId = await page.locator('[data-testid="qr-session-id"]').textContent();
    await page.click('[data-testid="refresh-qr-button"]');
    
    // Verify new QR code generated
    const newSessionId = await page.locator('[data-testid="qr-session-id"]').textContent();
    expect(newSessionId).not.toBe(originalSessionId);
  });

  test('should display feedback analytics and insights', async () => {
    // Navigate to feedback section
    await page.click('[data-testid="nav-feedback"]');
    await expect(page).toHaveURL(/.*\/feedback/);
    
    // Verify feedback overview metrics
    await expect(page.locator('[data-testid="feedback-total-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-avg-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-sentiment-breakdown"]')).toBeVisible();
    
    // Verify feedback filters
    await expect(page.locator('[data-testid="feedback-date-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-store-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-sentiment-filter"]')).toBeVisible();
    
    // Test date filter
    await page.click('[data-testid="feedback-date-filter"]');
    await page.click('[data-testid="date-filter-last-30-days"]');
    
    // Verify filtered results load
    await expect(page.locator('[data-testid="feedback-loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-loading"]')).not.toBeVisible();
    
    // Verify feedback list
    await expect(page.locator('[data-testid="feedback-item"]').first()).toBeVisible();
    
    // Click on individual feedback item
    await page.click('[data-testid="feedback-item"]:first-child');
    
    // Verify feedback details modal
    await expect(page.locator('[data-testid="feedback-details-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-transcript"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-sentiment"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-categories"]')).toBeVisible();
  });

  test('should manage store settings and configuration', async () => {
    // Navigate to stores section
    await page.click('[data-testid="nav-stores"]');
    
    // Click on store settings
    await page.click('[data-testid="store-settings-button"]:first-child');
    
    // Verify store settings page
    await expect(page.locator('[data-testid="store-settings-header"]')).toBeVisible();
    
    // Test context window configuration
    await page.click('[data-testid="context-settings-tab"]');
    
    // Configure context window
    await page.fill('[data-testid="context-description"]', 
      'En mysig restaurang i Stockholms hjärta som serverar traditionell svensk husmanskost.');
    
    await page.fill('[data-testid="context-specialties"]', 
      'Köttbullar, gravlax, prinskorv, lingonsylt');
    
    await page.fill('[data-testid="context-atmosphere"]', 
      'Familjevänlig, traditionell, hemtrevlig');
    
    // Save context settings
    await page.click('[data-testid="save-context-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="context-saved-success"]')).toBeVisible();
    
    // Test notification settings
    await page.click('[data-testid="notification-settings-tab"]');
    
    // Configure notifications
    await page.check('[data-testid="email-notifications-enabled"]');
    await page.check('[data-testid="sms-notifications-enabled"]');
    await page.fill('[data-testid="notification-email"]', testBusiness.email);
    await page.fill('[data-testid="notification-phone"]', testBusiness.phone);
    
    // Set notification frequency
    await page.click('[data-testid="notification-frequency-select"]');
    await page.click('[data-testid="frequency-daily"]');
    
    // Save notification settings
    await page.click('[data-testid="save-notifications-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="notifications-saved-success"]')).toBeVisible();
  });

  test('should handle AI assistant integration', async () => {
    // Navigate to AI assistant section
    await page.click('[data-testid="nav-ai-assistant"]');
    await expect(page).toHaveURL(/.*\/ai-assistant/);
    
    // Verify AI assistant status
    await expect(page.locator('[data-testid="ai-status-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-status-text"]')).toContainText('Active');
    
    // Test AI configuration
    await page.click('[data-testid="ai-configuration-button"]');
    
    // Verify AI settings modal
    await expect(page.locator('[data-testid="ai-settings-modal"]')).toBeVisible();
    
    // Configure AI personality
    await page.click('[data-testid="ai-personality-select"]');
    await page.click('[data-testid="personality-friendly"]');
    
    // Set conversation length
    await page.fill('[data-testid="max-conversation-length"]', '120');
    
    // Configure language settings
    await page.check('[data-testid="enable-swedish-only"]');
    
    // Save AI configuration
    await page.click('[data-testid="save-ai-config-button"]');
    
    // Verify configuration saved
    await expect(page.locator('[data-testid="ai-config-saved"]')).toBeVisible();
    
    // Test AI performance metrics
    await expect(page.locator('[data-testid="ai-avg-call-duration"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-customer-satisfaction"]')).toBeVisible();
  });

  test('should export feedback data and reports', async () => {
    // Navigate to analytics section
    await page.click('[data-testid="nav-analytics"]');
    await expect(page).toHaveURL(/.*\/analytics/);
    
    // Verify analytics dashboard
    await expect(page.locator('[data-testid="analytics-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="feedback-trends-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="sentiment-distribution-chart"]')).toBeVisible();
    
    // Test CSV export
    await page.click('[data-testid="export-options-button"]');
    await expect(page.locator('[data-testid="export-dropdown"]')).toBeVisible();
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-csv-button"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/feedback-export-.*\.csv/);
    
    // Test PDF report generation
    await page.click('[data-testid="export-options-button"]');
    
    const reportDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-pdf-report-button"]');
    const reportDownload = await reportDownloadPromise;
    
    expect(reportDownload.suggestedFilename()).toMatch(/feedback-report-.*\.pdf/);
  });

  test('should handle responsive design on tablet devices', async () => {
    // Change viewport to tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Verify responsive navigation
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Test mobile menu functionality
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
    
    // Navigate using mobile menu
    await page.click('[data-testid="mobile-nav-stores"]');
    await expect(page).toHaveURL(/.*\/stores/);
    
    // Verify mobile-optimized store cards
    await expect(page.locator('[data-testid="store-card-mobile"]')).toBeVisible();
    
    // Test swipe gestures for store carousel (if implemented)
    const storeCarousel = page.locator('[data-testid="store-carousel"]');
    if (await storeCarousel.isVisible()) {
      // Simulate swipe gesture
      await storeCarousel.hover();
      await page.mouse.down();
      await page.mouse.move(100, 0);
      await page.mouse.up();
      
      // Verify carousel moved
      await expect(page.locator('[data-testid="store-card"]:nth-child(2)')).toBeVisible();
    }
  });

  test('should validate form inputs and show proper error messages', async () => {
    // Navigate to store creation
    await page.click('[data-testid="nav-stores"]');
    await page.click('[data-testid="create-store-button"]');
    
    // Try to submit empty form
    await page.click('[data-testid="submit-store-button"]');
    
    // Verify validation errors
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="name-error"]')).toContainText('Store name is required');
    
    await expect(page.locator('[data-testid="address-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="phone-error"]')).toBeVisible();
    
    // Test invalid phone number format
    await page.fill('[data-testid="store-phone-input"]', '123456789');
    await page.click('[data-testid="submit-store-button"]');
    
    await expect(page.locator('[data-testid="phone-error"]')).toContainText('Invalid Swedish phone number format');
    
    // Test invalid email format
    await page.fill('[data-testid="store-email-input"]', 'invalid-email');
    await page.click('[data-testid="submit-store-button"]');
    
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email format');
    
    // Test invalid postal code
    await page.fill('[data-testid="store-postal-code-input"]', '12345');
    await page.click('[data-testid="submit-store-button"]');
    
    await expect(page.locator('[data-testid="postal-code-error"]')).toContainText('Invalid Swedish postal code format');
  });
});