/**
 * Integration test for multi-store filtering
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import { test, expect } from '@playwright/test';

test.describe('Multi-Store Filtering Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login as business user with multiple stores
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'multi-store@business.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display store selector for multi-store businesses', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Should show store selector in header
    await expect(page.locator('[data-testid="store-selector"]')).toBeVisible();
    
    const storeSelector = page.locator('[data-testid="store-selector"]');
    
    // Should display current active store
    await expect(storeSelector.locator('[data-testid="current-store-name"]')).toBeVisible();
    
    // Click to open store list
    await storeSelector.click();
    
    // Should show list of available stores
    await expect(page.locator('[data-testid="store-list"]')).toBeVisible();
    
    const storeItems = page.locator('[data-testid="store-item"]');
    expect(await storeItems.count()).toBeGreaterThan(1); // Multi-store account
    
    // Each store should show relevant information
    for (let i = 0; i < Math.min(3, await storeItems.count()); i++) {
      const store = storeItems.nth(i);
      await expect(store.locator('[data-testid="store-name"]')).toBeVisible();
      await expect(store.locator('[data-testid="store-location"]')).toBeVisible();
      await expect(store.locator('[data-testid="store-status"]')).toBeVisible();
      
      // Should show recent activity indicator
      const activityIndicator = store.locator('[data-testid="recent-activity"]');
      if (await activityIndicator.isVisible()) {
        await expect(activityIndicator.locator('[data-testid="feedback-count"]')).toBeVisible();
        await expect(activityIndicator.locator('[data-testid="last-updated"]')).toBeVisible();
      }
    }
    
    // Should allow selecting different store
    if (await storeItems.count() > 1) {
      const secondStore = storeItems.nth(1);
      const secondStoreName = await secondStore.locator('[data-testid="store-name"]').textContent();
      
      await secondStore.click();
      
      // Should update dashboard to show selected store data
      await expect(storeSelector.locator('[data-testid="current-store-name"]')).toContainText(secondStoreName || '');
      
      // Dashboard should refresh with new store data
      await expect(page.locator('[data-testid="store-specific-data"]')).toBeVisible();
    }
  });

  test('should enable cross-store comparison functionality', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Enable comparison mode
    await page.click('[data-testid="comparison-mode-toggle"]');
    await expect(page.locator('[data-testid="store-comparison-interface"]')).toBeVisible();
    
    // Should show multiple store selectors for comparison
    await expect(page.locator('[data-testid="compare-store-1-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="compare-store-2-selector"]')).toBeVisible();
    
    // Select first store for comparison
    const firstStoreSelector = page.locator('[data-testid="compare-store-1-selector"]');
    await firstStoreSelector.click();
    
    const firstStoreOptions = page.locator('[data-testid="store-option"]');
    expect(await firstStoreOptions.count()).toBeGreaterThan(1);
    
    await firstStoreOptions.first().click();
    
    // Select second store for comparison
    const secondStoreSelector = page.locator('[data-testid="compare-store-2-selector"]');
    await secondStoreSelector.click();
    
    // Should exclude already selected store from options
    const secondStoreOptions = page.locator('[data-testid="store-option"]');
    await secondStoreOptions.first().click();
    
    // Run comparison
    await page.click('[data-testid="run-store-comparison"]');
    
    // Should display comparison results
    await expect(page.locator('[data-testid="store-comparison-results"]')).toBeVisible();
    
    // Should show side-by-side metrics
    await expect(page.locator('[data-testid="store-1-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="store-2-metrics"]')).toBeVisible();
    
    // Should highlight key differences
    await expect(page.locator('[data-testid="performance-differences"]')).toBeVisible();
    await expect(page.locator('[data-testid="sentiment-differences"]')).toBeVisible();
    await expect(page.locator('[data-testid="volume-differences"]')).toBeVisible();
    
    // Should show best practices recommendations
    const recommendationsSection = page.locator('[data-testid="cross-store-recommendations"]');
    if (await recommendationsSection.isVisible()) {
      await expect(recommendationsSection.locator('[data-testid="recommendation-item"]')).toHaveCount({ min: 1 });
    }
  });

  test('should support aggregated view across all stores', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Should have "All Stores" option in store selector
    const storeSelector = page.locator('[data-testid="store-selector"]');
    await storeSelector.click();
    
    await expect(page.locator('[data-testid="all-stores-option"]')).toBeVisible();
    await page.click('[data-testid="all-stores-option"]');
    
    // Should switch to aggregated view
    await expect(page.locator('[data-testid="aggregated-dashboard"]')).toBeVisible();
    
    // Should show combined metrics
    await expect(page.locator('[data-testid="total-stores-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="combined-feedback-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-sentiment-score"]')).toBeVisible();
    
    // Should display per-store breakdown
    await expect(page.locator('[data-testid="per-store-breakdown"]')).toBeVisible();
    
    const storeBreakdownItems = page.locator('[data-testid="store-breakdown-item"]');
    expect(await storeBreakdownItems.count()).toBeGreaterThan(1);
    
    for (let i = 0; i < await storeBreakdownItems.count(); i++) {
      const item = storeBreakdownItems.nth(i);
      await expect(item.locator('[data-testid="store-name"]')).toBeVisible();
      await expect(item.locator('[data-testid="store-feedback-count"]')).toBeVisible();
      await expect(item.locator('[data-testid="store-sentiment-score"]')).toBeVisible();
      await expect(item.locator('[data-testid="store-performance-indicator"]')).toBeVisible();
    }
    
    // Should allow drilling down into individual stores
    if (await storeBreakdownItems.count() > 0) {
      await storeBreakdownItems.first().click();
      
      // Should navigate to individual store view
      await expect(page.locator('[data-testid="individual-store-view"]')).toBeVisible();
      
      // Should maintain context of where user came from
      await expect(page.locator('[data-testid="back-to-aggregated-view"]')).toBeVisible();
    }
  });

  test('should handle store-specific search and filtering', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Search interface should show current store context
    await expect(page.locator('[data-testid="current-store-context"]')).toBeVisible();
    
    // Perform search
    await page.fill('[data-testid="search-query-input"]', 'service quality');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Results should be filtered to current store
    const resultItems = page.locator('[data-testid="feedback-result-item"]');
    if (await resultItems.count() > 0) {
      // Verify all results are from current store
      const currentStoreId = await page.locator('[data-testid="current-store-context"]').getAttribute('data-store-id');
      
      for (let i = 0; i < Math.min(5, await resultItems.count()); i++) {
        const item = resultItems.nth(i);
        const itemStoreId = await item.getAttribute('data-store-id');
        expect(itemStoreId).toBe(currentStoreId);
      }
    }
    
    // Should have option to search across all stores
    await expect(page.locator('[data-testid="search-all-stores-toggle"]')).toBeVisible();
    
    const searchAllToggle = page.locator('[data-testid="search-all-stores-toggle"]');
    await searchAllToggle.click();
    
    // Should expand search to all stores
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="multi-store-search-results"]')).toBeVisible();
    
    // Results should now include multiple stores
    const multiStoreResults = page.locator('[data-testid="feedback-result-item"]');
    if (await multiStoreResults.count() > 1) {
      const storeIds = new Set();
      for (let i = 0; i < await multiStoreResults.count(); i++) {
        const storeId = await multiStoreResults.nth(i).getAttribute('data-store-id');
        if (storeId) storeIds.add(storeId);
      }
      expect(storeIds.size).toBeGreaterThan(1);
    }
    
    // Should group results by store
    await expect(page.locator('[data-testid="results-grouped-by-store"]')).toBeVisible();
  });

  test('should provide store performance rankings and benchmarking', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Navigate to store performance view
    await page.click('[data-testid="store-performance-tab"]');
    await expect(page.locator('[data-testid="store-performance-dashboard"]')).toBeVisible();
    
    // Should display performance rankings
    await expect(page.locator('[data-testid="store-rankings"]')).toBeVisible();
    
    const rankingItems = page.locator('[data-testid="ranking-item"]');
    expect(await rankingItems.count()).toBeGreaterThan(1);
    
    // Rankings should be ordered (best to worst or vice versa)
    for (let i = 0; i < await rankingItems.count(); i++) {
      const item = rankingItems.nth(i);
      await expect(item.locator('[data-testid="rank-position"]')).toBeVisible();
      await expect(item.locator('[data-testid="store-name"]')).toBeVisible();
      await expect(item.locator('[data-testid="performance-score"]')).toBeVisible();
      
      const rankPosition = await item.locator('[data-testid="rank-position"]').textContent();
      expect(parseInt(rankPosition || '0')).toBe(i + 1);
    }
    
    // Should show benchmarking metrics
    await expect(page.locator('[data-testid="benchmarking-metrics"]')).toBeVisible();
    
    const benchmarkingSection = page.locator('[data-testid="benchmarking-metrics"]');
    await expect(benchmarkingSection.locator('[data-testid="average-performance"]')).toBeVisible();
    await expect(benchmarkingSection.locator('[data-testid="top-performer"]')).toBeVisible();
    await expect(benchmarkingSection.locator('[data-testid="improvement-opportunities"]')).toBeVisible();
    
    // Should allow filtering by different metrics
    const metricSelector = page.locator('[data-testid="ranking-metric-selector"]');
    await metricSelector.click();
    
    await expect(page.locator('[data-testid="metric-sentiment-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-feedback-volume"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-response-time"]')).toBeVisible();
    
    // Test different ranking metric
    await page.click('[data-testid="metric-sentiment-score"]');
    
    // Rankings should update
    await expect(page.locator('[data-testid="ranking-updated-indicator"]')).toBeVisible();
    
    // Should show metric-specific insights
    await expect(page.locator('[data-testid="sentiment-ranking-insights"]')).toBeVisible();
  });

  test('should enable bulk operations across multiple stores', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Enable bulk operations mode
    await page.click('[data-testid="bulk-operations-toggle"]');
    await expect(page.locator('[data-testid="bulk-operations-interface"]')).toBeVisible();
    
    // Should show store selection checkboxes
    const storeCheckboxes = page.locator('[data-testid="store-checkbox"]');
    expect(await storeCheckboxes.count()).toBeGreaterThan(1);
    
    // Select multiple stores
    await storeCheckboxes.first().click();
    await storeCheckboxes.nth(1).click();
    
    // Should show selected stores count
    await expect(page.locator('[data-testid="selected-stores-count"]')).toContainText('2');
    
    // Should show available bulk operations
    await expect(page.locator('[data-testid="bulk-operations-menu"]')).toBeVisible();
    
    const bulkOperations = page.locator('[data-testid="bulk-operation-option"]');
    expect(await bulkOperations.count()).toBeGreaterThan(0);
    
    // Test bulk report generation
    const generateReportsOption = page.locator('[data-testid="bulk-generate-reports"]');
    if (await generateReportsOption.isVisible()) {
      await generateReportsOption.click();
      
      await expect(page.locator('[data-testid="bulk-report-config"]')).toBeVisible();
      
      // Configure bulk report parameters
      await page.selectOption('[data-testid="report-type-selector"]', 'weekly');
      await page.fill('[data-testid="week-number-input"]', '38');
      await page.fill('[data-testid="year-input"]', '2025');
      
      await page.click('[data-testid="execute-bulk-operation"]');
      
      // Should show progress tracking
      await expect(page.locator('[data-testid="bulk-operation-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
      
      // Should list individual store job statuses
      await expect(page.locator('[data-testid="store-job-status"]')).toHaveCount(2);
    }
    
    // Test bulk export functionality
    const exportOption = page.locator('[data-testid="bulk-export-data"]');
    if (await exportOption.isVisible()) {
      await exportOption.click();
      
      await expect(page.locator('[data-testid="export-format-selector"]')).toBeVisible();
      
      // Select export format
      await page.selectOption('[data-testid="export-format-selector"]', 'csv');
      
      // Configure date range
      await page.fill('[data-testid="export-start-date"]', '2025-09-01');
      await page.fill('[data-testid="export-end-date"]', '2025-09-21');
      
      await page.click('[data-testid="start-export"]');
      
      // Should initiate download or show download link
      const downloadSection = page.locator('[data-testid="export-download-section"]');
      await expect(downloadSection).toBeVisible({ timeout: 10000 });
    }
  });

  test('should maintain store context across navigation', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Select specific store
    const storeSelector = page.locator('[data-testid="store-selector"]');
    await storeSelector.click();
    
    const storeOptions = page.locator('[data-testid="store-item"]');
    if (await storeOptions.count() > 1) {
      const selectedStore = storeOptions.nth(1);
      const selectedStoreName = await selectedStore.locator('[data-testid="store-name"]').textContent();
      
      await selectedStore.click();
      
      // Navigate to search page
      await page.click('[data-testid="feedback-search-tab"]');
      await expect(page.locator('[data-testid="feedback-search-interface"]')).toBeVisible();
      
      // Should maintain store context
      await expect(page.locator('[data-testid="current-store-context"]')).toContainText(selectedStoreName || '');
      
      // Navigate to temporal comparison
      await page.click('[data-testid="temporal-comparison-tab"]');
      await expect(page.locator('[data-testid="temporal-comparison-view"]')).toBeVisible();
      
      // Should still maintain store context
      await expect(page.locator('[data-testid="current-store-context"]')).toContainText(selectedStoreName || '');
      
      // Context should persist across page refreshes
      await page.reload();
      await expect(page.locator('[data-testid="current-store-context"]')).toContainText(selectedStoreName || '');
    }
  });

  test('should handle store access permissions and restrictions', async ({ page }) => {
    // Try to access a store without proper permissions
    await page.goto('/dashboard/feedback-analysis?storeId=restricted-store');
    
    // Should show access denied or redirect to allowed store
    const accessDenied = page.locator('[data-testid="access-denied-message"]');
    const redirected = page.locator('[data-testid="store-selector"]');
    
    const deniedVisible = await accessDenied.isVisible();
    const redirectedVisible = await redirected.isVisible();
    
    expect(deniedVisible || redirectedVisible).toBe(true);
    
    if (deniedVisible) {
      await expect(accessDenied).toContainText('access denied');
      
      // Should provide link to available stores
      await expect(page.locator('[data-testid="available-stores-link"]')).toBeVisible();
    }
    
    // Test store list filtering based on permissions
    await page.goto('/dashboard/feedback-analysis');
    
    const storeSelector = page.locator('[data-testid="store-selector"]');
    await storeSelector.click();
    
    const availableStores = page.locator('[data-testid="store-item"]');
    
    // All visible stores should be accessible
    for (let i = 0; i < await availableStores.count(); i++) {
      const store = availableStores.nth(i);
      
      // Should not show restricted indicators
      const restrictedIndicator = store.locator('[data-testid="restricted-access"]');
      expect(await restrictedIndicator.isVisible()).toBe(false);
      
      // Should show permission level
      await expect(store.locator('[data-testid="permission-level"]')).toBeVisible();
    }
  });

  test('should meet performance requirements for multi-store operations', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/feedback-analysis');
    
    // Store selector should load quickly
    await expect(page.locator('[data-testid="store-selector"]')).toBeVisible({ timeout: 1000 });
    
    const selectorLoadTime = Date.now() - startTime;
    expect(selectorLoadTime).toBeLessThan(1000);
    
    // Store switching should be fast
    const storeSelector = page.locator('[data-testid="store-selector"]');
    await storeSelector.click();
    
    const switchStartTime = Date.now();
    
    const storeOptions = page.locator('[data-testid="store-item"]');
    if (await storeOptions.count() > 1) {
      await storeOptions.nth(1).click();
      
      // Dashboard should update within 2 seconds
      await expect(page.locator('[data-testid="store-specific-data"]')).toBeVisible({ timeout: 2000 });
      
      const switchTime = Date.now() - switchStartTime;
      expect(switchTime).toBeLessThan(2000);
    }
    
    // Cross-store comparison should complete within 5 seconds
    await page.click('[data-testid="comparison-mode-toggle"]');
    
    const comparisonStartTime = Date.now();
    
    const firstStoreSelector = page.locator('[data-testid="compare-store-1-selector"]');
    await firstStoreSelector.click();
    await page.locator('[data-testid="store-option"]').first().click();
    
    const secondStoreSelector = page.locator('[data-testid="compare-store-2-selector"]');
    await secondStoreSelector.click();
    await page.locator('[data-testid="store-option"]').first().click();
    
    await page.click('[data-testid="run-store-comparison"]');
    
    await expect(page.locator('[data-testid="store-comparison-results"]')).toBeVisible({ timeout: 5000 });
    
    const comparisonTime = Date.now() - comparisonStartTime;
    expect(comparisonTime).toBeLessThan(5000);
  });
});