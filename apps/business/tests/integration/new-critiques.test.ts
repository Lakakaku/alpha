/**
 * Integration test for new critiques identification
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import { test, expect } from '@playwright/test';

test.describe('New Critiques Identification', () => {
  test.beforeEach(async ({ page }) => {
    // Login as business user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@business.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should identify and highlight new critiques in current week', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Wait for new critiques section to load
    await expect(page.locator('[data-testid="new-critiques-section"]')).toBeVisible();

    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    
    // Should display header for new critiques
    await expect(newCritiquesSection.locator('[data-testid="new-critiques-title"]')).toBeVisible();
    await expect(newCritiquesSection.locator('[data-testid="new-critiques-title"]')).toContainText('New Issues This Week');

    // Check for critique items
    const critiqueItems = newCritiquesSection.locator('[data-testid="critique-item"]');
    const critiqueCount = await critiqueItems.count();

    if (critiqueCount > 0) {
      // Validate structure of critique items
      for (let i = 0; i < Math.min(critiqueCount, 5); i++) {
        const item = critiqueItems.nth(i);
        await expect(item.locator('[data-testid="critique-title"]')).toBeVisible();
        await expect(item.locator('[data-testid="critique-description"]')).toBeVisible();
        await expect(item.locator('[data-testid="critique-priority"]')).toBeVisible();
        await expect(item.locator('[data-testid="critique-department"]')).toBeVisible();
        
        // Should have visual indicator for "new" status
        await expect(item.locator('[data-testid="new-critique-badge"]')).toBeVisible();
      }

      // Critiques should be sorted by priority (critical/high first)
      const firstCritiqueRelevance = await critiqueItems.first().locator('[data-testid="critique-priority"]').textContent();
      expect(['critical', 'high']).toContain(firstCritiqueRelevance?.toLowerCase());
    }
  });

  test('should allow drill-down into specific critique details', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    const critiqueItems = newCritiquesSection.locator('[data-testid="critique-item"]');
    
    if (await critiqueItems.count() > 0) {
      // Click on first critique to view details
      await critiqueItems.first().click();
      
      // Should open critique detail modal or navigate to detail page
      const detailModal = page.locator('[data-testid="critique-detail-modal"]');
      const detailPage = page.locator('[data-testid="critique-detail-page"]');
      
      const modalVisible = await detailModal.isVisible();
      const pageVisible = await detailPage.isVisible();
      
      expect(modalVisible || pageVisible).toBe(true);
      
      if (modalVisible) {
        // Validate modal content
        await expect(detailModal.locator('[data-testid="critique-full-description"]')).toBeVisible();
        await expect(detailModal.locator('[data-testid="related-feedback-list"]')).toBeVisible();
        await expect(detailModal.locator('[data-testid="suggested-actions"]')).toBeVisible();
        
        // Should have action buttons
        await expect(detailModal.locator('[data-testid="acknowledge-button"]')).toBeVisible();
        await expect(detailModal.locator('[data-testid="dismiss-button"]')).toBeVisible();
      }
    }
  });

  test('should display temporal comparison showing critique emergence', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Navigate to temporal comparison view
    await page.click('[data-testid="temporal-comparison-tab"]');
    
    await expect(page.locator('[data-testid="temporal-comparison-view"]')).toBeVisible();
    
    // Should show comparison with previous week
    await expect(page.locator('[data-testid="current-week-data"]')).toBeVisible();
    await expect(page.locator('[data-testid="previous-week-data"]')).toBeVisible();
    
    // Should highlight new issues
    const newIssuesSection = page.locator('[data-testid="new-issues-this-week"]');
    await expect(newIssuesSection).toBeVisible();
    
    const newIssueItems = newIssuesSection.locator('[data-testid="new-issue-item"]');
    if (await newIssueItems.count() > 0) {
      // Each new issue should show emergence data
      for (let i = 0; i < Math.min(await newIssueItems.count(), 3); i++) {
        const item = newIssueItems.nth(i);
        await expect(item.locator('[data-testid="issue-title"]')).toBeVisible();
        await expect(item.locator('[data-testid="first-mentioned"]')).toBeVisible();
        await expect(item.locator('[data-testid="frequency-change"]')).toBeVisible();
      }
    }
    
    // Should also show resolved issues
    const resolvedIssuesSection = page.locator('[data-testid="resolved-issues-section"]');
    await expect(resolvedIssuesSection).toBeVisible();
  });

  test('should categorize critiques by department and priority', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    
    // Should have filter options
    await expect(newCritiquesSection.locator('[data-testid="department-filter"]')).toBeVisible();
    await expect(newCritiquesSection.locator('[data-testid="priority-filter"]')).toBeVisible();
    
    // Test department filtering
    const departmentFilter = newCritiquesSection.locator('[data-testid="department-filter"]');
    await departmentFilter.click();
    
    // Should show Swedish department options
    await expect(page.locator('[data-testid="filter-option-kassa"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-option-kött"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-option-bageri"]')).toBeVisible();
    
    // Select a department
    await page.click('[data-testid="filter-option-kassa"]');
    
    // Results should be filtered
    const filteredCritiques = newCritiquesSection.locator('[data-testid="critique-item"]');
    if (await filteredCritiques.count() > 0) {
      // All visible critiques should be related to "kassa"
      for (let i = 0; i < await filteredCritiques.count(); i++) {
        const department = await filteredCritiques.nth(i).locator('[data-testid="critique-department"]').textContent();
        expect(department?.toLowerCase()).toContain('kassa');
      }
    }
  });

  test('should enable critique status management (acknowledge/dismiss)', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    const critiqueItems = newCritiquesSection.locator('[data-testid="critique-item"]');
    
    if (await critiqueItems.count() > 0) {
      const firstCritique = critiqueItems.first();
      
      // Should have action buttons
      await expect(firstCritique.locator('[data-testid="acknowledge-button"]')).toBeVisible();
      await expect(firstCritique.locator('[data-testid="dismiss-button"]')).toBeVisible();
      
      // Test acknowledge action
      await firstCritique.locator('[data-testid="acknowledge-button"]').click();
      
      // Should show acknowledgment confirmation
      await expect(page.locator('[data-testid="acknowledge-modal"]')).toBeVisible();
      
      // Add acknowledgment note
      await page.fill('[data-testid="acknowledgment-notes"]', 'Issue acknowledged, will investigate further');
      await page.click('[data-testid="confirm-acknowledge"]');
      
      // Should show success feedback
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Critique status should update
      await expect(firstCritique.locator('[data-testid="critique-status"]')).toContainText('Acknowledged');
    }
  });

  test('should display AI confidence scores for critique identification', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    const critiqueItems = newCritiquesSection.locator('[data-testid="critique-item"]');
    
    if (await critiqueItems.count() > 0) {
      for (let i = 0; i < Math.min(await critiqueItems.count(), 3); i++) {
        const item = critiqueItems.nth(i);
        
        // Should display AI confidence indicator
        await expect(item.locator('[data-testid="ai-confidence-score"]')).toBeVisible();
        
        const confidenceText = await item.locator('[data-testid="ai-confidence-score"]').textContent();
        
        // Confidence should be a percentage
        expect(confidenceText).toMatch(/\d+%/);
        
        // High confidence critiques should be marked
        if (confidenceText && parseInt(confidenceText) >= 80) {
          await expect(item.locator('[data-testid="high-confidence-badge"]')).toBeVisible();
        }
      }
    }
  });

  test('should integrate with feedback search to show supporting evidence', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    const critiqueItems = newCritiquesSection.locator('[data-testid="critique-item"]');
    
    if (await critiqueItems.count() > 0) {
      // Click to view critique details
      await critiqueItems.first().click();
      
      const detailView = page.locator('[data-testid="critique-detail-modal"], [data-testid="critique-detail-page"]').first();
      
      // Should show supporting feedback
      await expect(detailView.locator('[data-testid="supporting-feedback-section"]')).toBeVisible();
      
      const supportingFeedback = detailView.locator('[data-testid="supporting-feedback-item"]');
      if (await supportingFeedback.count() > 0) {
        // Each supporting feedback should show relevance
        for (let i = 0; i < Math.min(await supportingFeedback.count(), 3); i++) {
          const item = supportingFeedback.nth(i);
          await expect(item.locator('[data-testid="feedback-content"]')).toBeVisible();
          await expect(item.locator('[data-testid="feedback-date"]')).toBeVisible();
          await expect(item.locator('[data-testid="relevance-score"]')).toBeVisible();
        }
      }
      
      // Should have link to full search
      await expect(detailView.locator('[data-testid="view-all-related-feedback"]')).toBeVisible();
      
      // Clicking should navigate to search with pre-filled query
      await detailView.locator('[data-testid="view-all-related-feedback"]').click();
      
      await expect(page.locator('[data-testid="feedback-search-page"]')).toBeVisible();
      
      // Search query should be pre-filled with critique keywords
      const searchInput = page.locator('[data-testid="search-query-input"]');
      const searchValue = await searchInput.inputValue();
      expect(searchValue.length).toBeGreaterThan(0);
    }
  });

  test('should handle empty state when no new critiques exist', async ({ page }) => {
    // Navigate to store with no new critiques
    await page.goto('/dashboard/feedback-analysis?storeId=store-no-new-critiques');
    
    const newCritiquesSection = page.locator('[data-testid="new-critiques-section"]');
    
    // Should show empty state
    await expect(newCritiquesSection.locator('[data-testid="no-new-critiques-message"]')).toBeVisible();
    await expect(newCritiquesSection.locator('[data-testid="no-new-critiques-message"]')).toContainText('No new issues identified this week');
    
    // Should show positive message
    await expect(newCritiquesSection.locator('[data-testid="positive-feedback-summary"]')).toBeVisible();
  });

  test('should meet performance requirements for critique identification', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/feedback-analysis');
    
    // New critiques should load within 2 seconds
    await expect(page.locator('[data-testid="new-critiques-section"]')).toBeVisible({ timeout: 2000 });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);
    
    // AI processing indicators should be visible during analysis
    const aiProcessingIndicator = page.locator('[data-testid="ai-analysis-indicator"]');
    if (await aiProcessingIndicator.isVisible()) {
      // Should complete analysis within 5 seconds
      await expect(aiProcessingIndicator).not.toBeVisible({ timeout: 5000 });
    }
  });
});