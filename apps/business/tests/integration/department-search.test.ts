/**
 * Integration test for department-specific search
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import { test, expect } from '@playwright/test';

test.describe('Department-Specific Search', () => {
  test.beforeEach(async ({ page }) => {
    // Login as business user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@business.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should navigate to feedback search and filter by department', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Navigate to search interface
    await page.click('[data-testid="feedback-search-tab"]');
    await expect(page.locator('[data-testid="feedback-search-interface"]')).toBeVisible();

    // Should display department filter options
    const departmentFilter = page.locator('[data-testid="department-filter"]');
    await expect(departmentFilter).toBeVisible();
    
    // Click to open department options
    await departmentFilter.click();
    
    // Should show Swedish department options
    await expect(page.locator('[data-testid="department-option-kassa"]')).toBeVisible();
    await expect(page.locator('[data-testid="department-option-kött"]')).toBeVisible();
    await expect(page.locator('[data-testid="department-option-bageri"]')).toBeVisible();
    await expect(page.locator('[data-testid="department-option-kundservice"]')).toBeVisible();
    await expect(page.locator('[data-testid="department-option-parkering"]')).toBeVisible();
    
    // Select "kassa" department
    await page.click('[data-testid="department-option-kassa"]');
    
    // Perform search
    await page.fill('[data-testid="search-query-input"]', 'problem');
    await page.click('[data-testid="search-button"]');
    
    // Wait for results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Results should be filtered by department
    const resultItems = page.locator('[data-testid="feedback-result-item"]');
    if (await resultItems.count() > 0) {
      for (let i = 0; i < Math.min(await resultItems.count(), 5); i++) {
        const item = resultItems.nth(i);
        const departmentTags = item.locator('[data-testid="feedback-department-tags"]');
        
        // Should contain "kassa" in department tags
        await expect(departmentTags).toContainText('kassa');
      }
    }
  });

  test('should support multi-department selection and filtering', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const departmentFilter = page.locator('[data-testid="department-filter"]');
    await departmentFilter.click();
    
    // Select multiple departments
    await page.click('[data-testid="department-option-kassa"]');
    await page.click('[data-testid="department-option-kundservice"]');
    
    // Should show selected departments
    await expect(page.locator('[data-testid="selected-department-kassa"]')).toBeVisible();
    await expect(page.locator('[data-testid="selected-department-kundservice"]')).toBeVisible();
    
    // Perform search
    await page.fill('[data-testid="search-query-input"]', 'service quality');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Results should include feedback from either department
    const resultItems = page.locator('[data-testid="feedback-result-item"]');
    if (await resultItems.count() > 0) {
      let hasKassa = false;
      let hasKundservice = false;
      
      for (let i = 0; i < await resultItems.count(); i++) {
        const departmentTags = await resultItems.nth(i).locator('[data-testid="feedback-department-tags"]').textContent();
        if (departmentTags?.includes('kassa')) hasKassa = true;
        if (departmentTags?.includes('kundservice')) hasKundservice = true;
      }
      
      // Should have results from at least one selected department
      expect(hasKassa || hasKundservice).toBe(true);
    }
  });

  test('should provide department-specific insights and analytics', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Select specific department
    const departmentFilter = page.locator('[data-testid="department-filter"]');
    await departmentFilter.click();
    await page.click('[data-testid="department-option-kött"]');
    
    // Perform search
    await page.fill('[data-testid="search-query-input"]', '*'); // Search all feedback
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Should show department-specific analytics
    const analyticsPanel = page.locator('[data-testid="department-analytics-panel"]');
    await expect(analyticsPanel).toBeVisible();
    
    // Should display department metrics
    await expect(analyticsPanel.locator('[data-testid="department-feedback-count"]')).toBeVisible();
    await expect(analyticsPanel.locator('[data-testid="department-sentiment-distribution"]')).toBeVisible();
    await expect(analyticsPanel.locator('[data-testid="department-trend-indicator"]')).toBeVisible();
    
    // Should show common issues for this department
    await expect(analyticsPanel.locator('[data-testid="common-department-issues"]')).toBeVisible();
    
    const commonIssues = analyticsPanel.locator('[data-testid="common-issue-item"]');
    if (await commonIssues.count() > 0) {
      // Issues should be relevant to meat department
      const firstIssueText = await commonIssues.first().textContent();
      expect(firstIssueText?.toLowerCase()).toMatch(/(kött|meat|kvalitet|quality|färsk|fresh)/);
    }
  });

  test('should enable department comparison functionality', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Enable comparison mode
    await page.click('[data-testid="comparison-mode-toggle"]');
    await expect(page.locator('[data-testid="comparison-interface"]')).toBeVisible();
    
    // Select first department
    const firstDepartmentFilter = page.locator('[data-testid="comparison-department-1"]');
    await firstDepartmentFilter.click();
    await page.click('[data-testid="department-option-kassa"]');
    
    // Select second department
    const secondDepartmentFilter = page.locator('[data-testid="comparison-department-2"]');
    await secondDepartmentFilter.click();
    await page.click('[data-testid="department-option-bageri"]');
    
    // Run comparison
    await page.click('[data-testid="run-comparison-button"]');
    
    // Should display comparison results
    await expect(page.locator('[data-testid="comparison-results"]')).toBeVisible();
    
    // Should show metrics for both departments
    await expect(page.locator('[data-testid="kassa-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="bageri-metrics"]')).toBeVisible();
    
    // Should highlight differences
    await expect(page.locator('[data-testid="sentiment-difference"]')).toBeVisible();
    await expect(page.locator('[data-testid="volume-difference"]')).toBeVisible();
    await expect(page.locator('[data-testid="key-differences"]')).toBeVisible();
  });

  test('should provide smart suggestions for department-related queries', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const searchInput = page.locator('[data-testid="search-query-input"]');
    
    // Type department-related query
    await searchInput.fill('kassa problem');
    
    // Should show smart suggestions
    await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
    
    const suggestions = page.locator('[data-testid="suggestion-item"]');
    if (await suggestions.count() > 0) {
      // Suggestions should be relevant to checkout/kassa
      const suggestionTexts = [];
      for (let i = 0; i < await suggestions.count(); i++) {
        const text = await suggestions.nth(i).textContent();
        if (text) suggestionTexts.push(text.toLowerCase());
      }
      
      // Should contain relevant suggestions
      const hasRelevantSuggestion = suggestionTexts.some(text => 
        text.includes('kassa') || text.includes('checkout') || text.includes('waiting') || text.includes('queue')
      );
      expect(hasRelevantSuggestion).toBe(true);
    }
    
    // Click on a suggestion
    if (await suggestions.count() > 0) {
      await suggestions.first().click();
      
      // Should automatically perform search with selected suggestion
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    }
  });

  test('should display department hierarchy and sub-categorization', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const departmentFilter = page.locator('[data-testid="department-filter"]');
    await departmentFilter.click();
    
    // Should show main departments with sub-categories
    const mainDepartments = ['kött', 'kassa', 'bageri', 'kundservice'];
    
    for (const dept of mainDepartments) {
      await expect(page.locator(`[data-testid="department-option-${dept}"]`)).toBeVisible();
      
      // Some departments should have sub-categories
      const subCategoryExpander = page.locator(`[data-testid="expand-${dept}-subcategories"]`);
      if (await subCategoryExpander.isVisible()) {
        await subCategoryExpander.click();
        
        // Should show sub-categories
        await expect(page.locator(`[data-testid="${dept}-subcategories"]`)).toBeVisible();
      }
    }
  });

  test('should handle Swedish language department terms correctly', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Test Swedish department terms in search
    const swedishTerms = [
      { term: 'köttavdelning', expectedDept: 'kött' },
      { term: 'bageriavdelning', expectedDept: 'bageri' },
      { term: 'kassaavdelning', expectedDept: 'kassa' },
      { term: 'kundtjänst', expectedDept: 'kundservice' }
    ];
    
    for (const { term, expectedDept } of swedishTerms) {
      // Clear and type Swedish term
      await page.fill('[data-testid="search-query-input"]', term);
      await page.click('[data-testid="search-button"]');
      
      // Should automatically detect and filter by department
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      
      // Department filter should be automatically applied
      const appliedFilters = page.locator('[data-testid="applied-filters"]');
      await expect(appliedFilters).toContainText(expectedDept);
      
      // Clear for next test
      await page.click('[data-testid="clear-search"]');
    }
  });

  test('should integrate department search with temporal analysis', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Select department and enable temporal view
    const departmentFilter = page.locator('[data-testid="department-filter"]');
    await departmentFilter.click();
    await page.click('[data-testid="department-option-kassa"]');
    
    // Switch to temporal analysis view
    await page.click('[data-testid="temporal-view-toggle"]');
    await expect(page.locator('[data-testid="temporal-analysis-view"]')).toBeVisible();
    
    // Should show department-specific trends over time
    await expect(page.locator('[data-testid="department-trend-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="department-sentiment-timeline"]')).toBeVisible();
    
    // Should allow time range selection
    const timeRangeSelector = page.locator('[data-testid="time-range-selector"]');
    await timeRangeSelector.click();
    await page.click('[data-testid="time-range-4weeks"]');
    
    // Chart should update with selected time range
    await page.waitForTimeout(1000); // Allow chart to update
    
    // Should show week-over-week changes for the department
    await expect(page.locator('[data-testid="weekly-change-indicator"]')).toBeVisible();
  });

  test('should meet performance requirements for department filtering', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Department filter should load quickly
    await expect(page.locator('[data-testid="department-filter"]')).toBeVisible({ timeout: 1000 });
    
    const filterLoadTime = Date.now() - startTime;
    expect(filterLoadTime).toBeLessThan(1000);
    
    // Department selection should be responsive
    const selectionStartTime = Date.now();
    
    await page.click('[data-testid="department-filter"]');
    await page.click('[data-testid="department-option-kassa"]');
    
    const selectionTime = Date.now() - selectionStartTime;
    expect(selectionTime).toBeLessThan(500);
    
    // Search with department filter should complete within 2 seconds
    const searchStartTime = Date.now();
    
    await page.fill('[data-testid="search-query-input"]', 'test query');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 2000 });
    
    const searchTime = Date.now() - searchStartTime;
    expect(searchTime).toBeLessThan(2000);
  });
});