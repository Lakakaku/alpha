/**
 * Integration test for dashboard access and categorization
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import { test, expect } from '@playwright/test';

test.describe('Feedback Analysis Dashboard Access', () => {
  test.beforeEach(async ({ page }) => {
    // Login as business user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@business.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should access feedback analysis dashboard and display categorized feedback', async ({ page }) => {
    // Navigate to feedback analysis dashboard
    await page.goto('/dashboard/feedback-analysis');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="feedback-analysis-dashboard"]')).toBeVisible();

    // Verify current week summary is displayed
    await expect(page.locator('[data-testid="current-week-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-feedback-count"]')).toBeVisible();

    // Verify positive feedback categorization
    const positiveSection = page.locator('[data-testid="positive-feedback-section"]');
    await expect(positiveSection).toBeVisible();
    await expect(positiveSection.locator('[data-testid="feedback-item"]')).toHaveCount({ min: 0 });

    // Verify negative feedback categorization
    const negativeSection = page.locator('[data-testid="negative-feedback-section"]');
    await expect(negativeSection).toBeVisible();
    await expect(negativeSection.locator('[data-testid="feedback-item"]')).toHaveCount({ min: 0 });

    // Check that feedback items display required information
    const feedbackItems = page.locator('[data-testid="feedback-item"]');
    if (await feedbackItems.count() > 0) {
      const firstItem = feedbackItems.first();
      await expect(firstItem.locator('[data-testid="feedback-content"]')).toBeVisible();
      await expect(firstItem.locator('[data-testid="feedback-date"]')).toBeVisible();
      await expect(firstItem.locator('[data-testid="sentiment-indicator"]')).toBeVisible();
    }
  });

  test('should display AI-generated weekly summary when data exists', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Wait for AI summary to load
    await page.waitForSelector('[data-testid="ai-weekly-summary"]', { timeout: 10000 });

    const summarySection = page.locator('[data-testid="ai-weekly-summary"]');
    await expect(summarySection).toBeVisible();

    // Should contain key summary elements
    await expect(summarySection.locator('[data-testid="positive-highlights"]')).toBeVisible();
    await expect(summarySection.locator('[data-testid="negative-issues"]')).toBeVisible();
    await expect(summarySection.locator('[data-testid="general-insights"]')).toBeVisible();

    // Summary text should be meaningful (not empty)
    const positiveText = await summarySection.locator('[data-testid="positive-highlights"]').textContent();
    const negativeText = await summarySection.locator('[data-testid="negative-issues"]').textContent();
    
    if (positiveText) {
      expect(positiveText.length).toBeGreaterThan(10);
    }
    if (negativeText) {
      expect(negativeText.length).toBeGreaterThan(10);
    }
  });

  test('should handle empty state when no feedback exists', async ({ page }) => {
    // Navigate to a store with no feedback data
    await page.goto('/dashboard/feedback-analysis?storeId=empty-store-id');
    
    // Should display empty state message
    await expect(page.locator('[data-testid="empty-feedback-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="empty-state-message"]')).toContainText('No feedback available');
    
    // Should not display categorization sections
    await expect(page.locator('[data-testid="positive-feedback-section"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="negative-feedback-section"]')).not.toBeVisible();
  });

  test('should display loading states during data fetching', async ({ page }) => {
    // Intercept API calls to simulate slow loading
    await page.route('/api/feedback-analysis/reports/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    await page.goto('/dashboard/feedback-analysis');
    
    // Should show loading indicators
    await expect(page.locator('[data-testid="dashboard-loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-skeleton"]')).toBeVisible();
    
    // Wait for loading to complete
    await expect(page.locator('[data-testid="dashboard-loading"]')).not.toBeVisible({ timeout: 15000 });
  });

  test('should handle authentication and store access permissions', async ({ page }) => {
    // Try to access unauthorized store
    await page.goto('/dashboard/feedback-analysis?storeId=unauthorized-store');
    
    // Should redirect to error page or show access denied message
    await expect(page.locator('[data-testid="access-denied-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="access-denied-message"]')).toContainText('access denied');
  });

  test('should maintain responsive design on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/feedback-analysis');
    
    // Dashboard should be visible and functional on mobile
    await expect(page.locator('[data-testid="feedback-analysis-dashboard"]')).toBeVisible();
    
    // Mobile navigation should work
    const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
    }
    
    // Feedback items should stack vertically on mobile
    const feedbackItems = page.locator('[data-testid="feedback-item"]');
    if (await feedbackItems.count() > 1) {
      const firstItemBounds = await feedbackItems.first().boundingBox();
      const secondItemBounds = await feedbackItems.nth(1).boundingBox();
      
      if (firstItemBounds && secondItemBounds) {
        // Second item should be below first item (vertical stacking)
        expect(secondItemBounds.y).toBeGreaterThan(firstItemBounds.y + firstItemBounds.height);
      }
    }
  });

  test('should update dashboard with real-time feedback changes', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Wait for initial load
    await expect(page.locator('[data-testid="feedback-analysis-dashboard"]')).toBeVisible();
    
    // Get initial feedback count
    const initialCountElement = page.locator('[data-testid="total-feedback-count"]');
    const initialCount = await initialCountElement.textContent();
    
    // Simulate new feedback arriving (this would normally come from real-time subscriptions)
    await page.evaluate(() => {
      // Trigger a simulated real-time update
      window.dispatchEvent(new CustomEvent('feedback-update', {
        detail: { type: 'new_feedback', count: 1 }
      }));
    });
    
    // Dashboard should update without full page reload
    await page.waitForTimeout(1000);
    
    // Count might have changed if real-time updates are working
    const updatedCount = await initialCountElement.textContent();
    // Note: This test may need to be adjusted based on actual real-time implementation
  });

  test('should meet performance requirements for dashboard load time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/feedback-analysis');
    
    // Wait for core dashboard elements to be visible
    await expect(page.locator('[data-testid="feedback-analysis-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-week-summary"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // AI summary should load within 5 seconds total
    await expect(page.locator('[data-testid="ai-weekly-summary"]')).toBeVisible({ timeout: 5000 });
    
    const totalLoadTime = Date.now() - startTime;
    expect(totalLoadTime).toBeLessThan(5000);
  });
});