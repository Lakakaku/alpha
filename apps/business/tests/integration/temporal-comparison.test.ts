/**
 * Integration test for temporal comparison
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import { test, expect } from '@playwright/test';

test.describe('Temporal Comparison Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login as business user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@business.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display week-over-week comparison with trend indicators', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis');
    
    // Navigate to temporal comparison view
    await page.click('[data-testid="temporal-comparison-tab"]');
    await expect(page.locator('[data-testid="temporal-comparison-view"]')).toBeVisible();

    // Should display current vs previous week data
    await expect(page.locator('[data-testid="current-week-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="previous-week-section"]')).toBeVisible();

    // Current week should show this week's data
    const currentWeekSection = page.locator('[data-testid="current-week-section"]');
    await expect(currentWeekSection.locator('[data-testid="week-number"]')).toBeVisible();
    await expect(currentWeekSection.locator('[data-testid="feedback-count"]')).toBeVisible();
    await expect(currentWeekSection.locator('[data-testid="sentiment-breakdown"]')).toBeVisible();

    // Previous week should show comparison data
    const previousWeekSection = page.locator('[data-testid="previous-week-section"]');
    await expect(previousWeekSection.locator('[data-testid="week-number"]')).toBeVisible();
    await expect(previousWeekSection.locator('[data-testid="feedback-count"]')).toBeVisible();
    await expect(previousWeekSection.locator('[data-testid="sentiment-breakdown"]')).toBeVisible();

    // Should display trend indicators
    await expect(page.locator('[data-testid="trend-direction-indicator"]')).toBeVisible();
    
    const trendIndicator = page.locator('[data-testid="trend-direction-indicator"]');
    const trendText = await trendIndicator.textContent();
    expect(['improving', 'declining', 'stable']).toContain(trendText?.toLowerCase().split(' ')[0]);

    // Should show percentage changes
    await expect(page.locator('[data-testid="feedback-count-change"]')).toBeVisible();
    await expect(page.locator('[data-testid="sentiment-score-change"]')).toBeVisible();

    const countChange = await page.locator('[data-testid="feedback-count-change"]').textContent();
    expect(countChange).toMatch(/[+-]?\d+%/);
  });

  test('should identify and highlight new issues versus resolved issues', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Should display issues comparison section
    await expect(page.locator('[data-testid="issues-comparison-section"]')).toBeVisible();

    // New issues section
    const newIssuesSection = page.locator('[data-testid="new-issues-section"]');
    await expect(newIssuesSection).toBeVisible();
    await expect(newIssuesSection.locator('[data-testid="section-title"]')).toContainText('New Issues This Week');

    const newIssueItems = newIssuesSection.locator('[data-testid="issue-item"]');
    if (await newIssueItems.count() > 0) {
      for (let i = 0; i < Math.min(3, await newIssueItems.count()); i++) {
        const item = newIssueItems.nth(i);
        await expect(item.locator('[data-testid="issue-title"]')).toBeVisible();
        await expect(item.locator('[data-testid="issue-description"]')).toBeVisible();
        await expect(item.locator('[data-testid="first-appeared-date"]')).toBeVisible();
        await expect(item.locator('[data-testid="frequency-indicator"]')).toBeVisible();
        
        // Should have "new" visual indicator
        await expect(item.locator('[data-testid="new-issue-badge"]')).toBeVisible();
      }
    }

    // Resolved issues section
    const resolvedIssuesSection = page.locator('[data-testid="resolved-issues-section"]');
    await expect(resolvedIssuesSection).toBeVisible();
    await expect(resolvedIssuesSection.locator('[data-testid="section-title"]')).toContainText('Resolved Issues');

    const resolvedIssueItems = resolvedIssuesSection.locator('[data-testid="issue-item"]');
    if (await resolvedIssueItems.count() > 0) {
      for (let i = 0; i < Math.min(3, await resolvedIssueItems.count()); i++) {
        const item = resolvedIssueItems.nth(i);
        await expect(item.locator('[data-testid="issue-title"]')).toBeVisible();
        await expect(item.locator('[data-testid="last-mentioned-date"]')).toBeVisible();
        
        // Should have "resolved" visual indicator
        await expect(item.locator('[data-testid="resolved-issue-badge"]')).toBeVisible();
      }
    }

    // Should display summary statistics
    await expect(page.locator('[data-testid="issues-summary-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-issues-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="resolved-issues-count"]')).toBeVisible();
  });

  test('should support custom time range comparison', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Should have time range selector
    await expect(page.locator('[data-testid="time-range-selector"]')).toBeVisible();
    
    const timeRangeSelector = page.locator('[data-testid="time-range-selector"]');
    await timeRangeSelector.click();

    // Should show various time range options
    await expect(page.locator('[data-testid="range-1week"]')).toBeVisible();
    await expect(page.locator('[data-testid="range-2weeks"]')).toBeVisible();
    await expect(page.locator('[data-testid="range-4weeks"]')).toBeVisible();
    await expect(page.locator('[data-testid="range-8weeks"]')).toBeVisible();
    await expect(page.locator('[data-testid="range-custom"]')).toBeVisible();

    // Test 4-week comparison
    await page.click('[data-testid="range-4weeks"]');
    
    // Should update comparison to show current week vs 4 weeks ago
    await expect(page.locator('[data-testid="comparison-period-label"]')).toContainText('4 weeks ago');
    
    // Wait for data to update
    await page.waitForTimeout(2000);
    
    // Should show different baseline data
    const baselineSection = page.locator('[data-testid="baseline-week-section"]');
    await expect(baselineSection).toBeVisible();
    
    // Week numbers should be different by approximately 4
    const currentWeekNum = await page.locator('[data-testid="current-week-number"]').textContent();
    const baselineWeekNum = await page.locator('[data-testid="baseline-week-number"]').textContent();
    
    if (currentWeekNum && baselineWeekNum) {
      const weekDiff = Math.abs(parseInt(currentWeekNum) - parseInt(baselineWeekNum));
      expect(weekDiff).toBeGreaterThanOrEqual(3);
      expect(weekDiff).toBeLessThanOrEqual(5); // Account for year boundaries
    }

    // Test custom date range
    await timeRangeSelector.click();
    await page.click('[data-testid="range-custom"]');
    
    await expect(page.locator('[data-testid="custom-date-picker"]')).toBeVisible();
    
    // Set custom comparison date
    const customDateInput = page.locator('[data-testid="comparison-date-input"]');
    await customDateInput.fill('2025-08-01');
    await page.click('[data-testid="apply-custom-range"]');
    
    // Should update with custom comparison
    await expect(page.locator('[data-testid="comparison-period-label"]')).toContainText('Aug 1, 2025');
  });

  test('should display department-specific temporal trends', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Should have department breakdown section
    await expect(page.locator('[data-testid="department-trends-section"]')).toBeVisible();

    const departmentTrendsSection = page.locator('[data-testid="department-trends-section"]');
    
    // Should show trends for each department
    const departmentCards = departmentTrendsSection.locator('[data-testid="department-trend-card"]');
    expect(await departmentCards.count()).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(5, await departmentCards.count()); i++) {
      const card = departmentCards.nth(i);
      
      // Each card should show department info
      await expect(card.locator('[data-testid="department-name"]')).toBeVisible();
      await expect(card.locator('[data-testid="department-trend-direction"]')).toBeVisible();
      await expect(card.locator('[data-testid="department-feedback-change"]')).toBeVisible();
      
      // Should have mini trend chart or indicator
      const trendChart = card.locator('[data-testid="mini-trend-chart"]');
      const trendIndicator = card.locator('[data-testid="trend-arrow"]');
      
      const hasChart = await trendChart.isVisible();
      const hasIndicator = await trendIndicator.isVisible();
      expect(hasChart || hasIndicator).toBe(true);
      
      // Department names should be in Swedish
      const deptName = await card.locator('[data-testid="department-name"]').textContent();
      const swedishDepartments = ['kassa', 'kött', 'bageri', 'kundservice', 'parkering'];
      const isSwedishDept = swedishDepartments.some(dept => 
        deptName?.toLowerCase().includes(dept)
      );
      expect(isSwedishDept).toBe(true);
    }

    // Should allow drilling down into specific department
    if (await departmentCards.count() > 0) {
      await departmentCards.first().click();
      
      await expect(page.locator('[data-testid="department-detail-view"]')).toBeVisible();
      
      // Detail view should show detailed temporal analysis
      await expect(page.locator('[data-testid="detailed-trend-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="department-specific-issues"]')).toBeVisible();
      await expect(page.locator('[data-testid="sentiment-timeline"]')).toBeVisible();
    }
  });

  test('should provide AI-powered trend analysis and predictions', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Should display AI analysis section
    await expect(page.locator('[data-testid="ai-trend-analysis"]')).toBeVisible();

    const aiAnalysisSection = page.locator('[data-testid="ai-trend-analysis"]');
    
    // Should show trend direction with confidence
    await expect(aiAnalysisSection.locator('[data-testid="trend-direction"]')).toBeVisible();
    await expect(aiAnalysisSection.locator('[data-testid="confidence-score"]')).toBeVisible();
    
    const confidenceScore = await aiAnalysisSection.locator('[data-testid="confidence-score"]').textContent();
    expect(confidenceScore).toMatch(/\d+%/);

    // Should provide key insights
    await expect(aiAnalysisSection.locator('[data-testid="key-insights"]')).toBeVisible();
    
    const keyInsights = aiAnalysisSection.locator('[data-testid="insight-item"]');
    if (await keyInsights.count() > 0) {
      for (let i = 0; i < await keyInsights.count(); i++) {
        const insight = keyInsights.nth(i);
        await expect(insight.locator('[data-testid="insight-text"]')).toBeVisible();
        await expect(insight.locator('[data-testid="insight-impact"]')).toBeVisible();
        
        const insightText = await insight.locator('[data-testid="insight-text"]').textContent();
        expect(insightText?.length).toBeGreaterThan(20); // Should be meaningful
      }
    }

    // Should show predictions if data allows
    const predictionsSection = page.locator('[data-testid="trend-predictions"]');
    if (await predictionsSection.isVisible()) {
      await expect(predictionsSection.locator('[data-testid="prediction-text"]')).toBeVisible();
      await expect(predictionsSection.locator('[data-testid="prediction-confidence"]')).toBeVisible();
      
      // Should have disclaimer about prediction accuracy
      await expect(predictionsSection.locator('[data-testid="prediction-disclaimer"]')).toBeVisible();
    }

    // Should identify significant changes
    await expect(aiAnalysisSection.locator('[data-testid="significant-changes"]')).toBeVisible();
    
    const significantChanges = aiAnalysisSection.locator('[data-testid="change-item"]');
    if (await significantChanges.count() > 0) {
      for (let i = 0; i < await significantChanges.count(); i++) {
        const change = significantChanges.nth(i);
        await expect(change.locator('[data-testid="change-description"]')).toBeVisible();
        await expect(change.locator('[data-testid="change-magnitude"]')).toBeVisible();
        await expect(change.locator('[data-testid="change-significance"]')).toBeVisible();
      }
    }
  });

  test('should enable interactive data exploration with drill-down capabilities', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Should have interactive chart/visualization
    await expect(page.locator('[data-testid="interactive-trend-chart"]')).toBeVisible();

    const trendChart = page.locator('[data-testid="interactive-trend-chart"]');
    
    // Should allow hovering for details
    await trendChart.hover();
    
    // Should show tooltip with detailed information
    const tooltip = page.locator('[data-testid="chart-tooltip"]');
    if (await tooltip.isVisible()) {
      await expect(tooltip.locator('[data-testid="tooltip-date"]')).toBeVisible();
      await expect(tooltip.locator('[data-testid="tooltip-value"]')).toBeVisible();
    }

    // Should allow clicking on data points for drill-down
    const dataPoints = trendChart.locator('[data-testid="chart-data-point"]');
    if (await dataPoints.count() > 0) {
      await dataPoints.first().click();
      
      // Should open detailed view or modal
      const detailView = page.locator('[data-testid="data-point-detail"]');
      const detailModal = page.locator('[data-testid="drill-down-modal"]');
      
      const detailVisible = await detailView.isVisible();
      const modalVisible = await detailModal.isVisible();
      expect(detailVisible || modalVisible).toBe(true);
      
      if (modalVisible) {
        // Modal should show detailed breakdown
        await expect(detailModal.locator('[data-testid="detailed-breakdown"]')).toBeVisible();
        await expect(detailModal.locator('[data-testid="related-feedback"]')).toBeVisible();
        
        // Should allow navigation to related feedback
        const viewFeedbackButton = detailModal.locator('[data-testid="view-related-feedback"]');
        if (await viewFeedbackButton.isVisible()) {
          await viewFeedbackButton.click();
          
          // Should navigate to search with pre-filtered results
          await expect(page.locator('[data-testid="feedback-search-page"]')).toBeVisible();
        }
      }
    }

    // Should support zooming/time range selection on chart
    const zoomControls = page.locator('[data-testid="chart-zoom-controls"]');
    if (await zoomControls.isVisible()) {
      await expect(zoomControls.locator('[data-testid="zoom-in"]')).toBeVisible();
      await expect(zoomControls.locator('[data-testid="zoom-out"]')).toBeVisible();
      await expect(zoomControls.locator('[data-testid="reset-zoom"]')).toBeVisible();
      
      // Test zoom functionality
      await zoomControls.locator('[data-testid="zoom-in"]').click();
      
      // Chart should update to show more detailed view
      await page.waitForTimeout(500);
      
      // Reset zoom
      await zoomControls.locator('[data-testid="reset-zoom"]').click();
    }
  });

  test('should handle edge cases like missing data periods', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Try to compare with a period that has no data
    const timeRangeSelector = page.locator('[data-testid="time-range-selector"]');
    await timeRangeSelector.click();
    await page.click('[data-testid="range-custom"]');
    
    // Set comparison to very old date with likely no data
    await page.fill('[data-testid="comparison-date-input"]', '2020-01-01');
    await page.click('[data-testid="apply-custom-range"]');
    
    // Should handle missing baseline data gracefully
    const noDataMessage = page.locator('[data-testid="no-baseline-data-message"]');
    if (await noDataMessage.isVisible()) {
      await expect(noDataMessage).toContainText('No data available');
      
      // Should still show current week data
      await expect(page.locator('[data-testid="current-week-section"]')).toBeVisible();
      
      // Should suggest alternative comparison periods
      await expect(page.locator('[data-testid="suggested-periods"]')).toBeVisible();
    }

    // Test gap in data (weeks with no feedback)
    const gapsSection = page.locator('[data-testid="data-gaps-indicator"]');
    if (await gapsSection.isVisible()) {
      await expect(gapsSection.locator('[data-testid="gap-warning"]')).toBeVisible();
      await expect(gapsSection.locator('[data-testid="gap-explanation"]')).toBeVisible();
      
      // Should show interpolated or estimated values
      const interpolatedValues = page.locator('[data-testid="interpolated-value"]');
      if (await interpolatedValues.count() > 0) {
        for (let i = 0; i < await interpolatedValues.count(); i++) {
          const value = interpolatedValues.nth(i);
          await expect(value.locator('[data-testid="interpolated-indicator"]')).toBeVisible();
        }
      }
    }
  });

  test('should meet performance requirements for temporal analysis', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/feedback-analysis/temporal');
    
    // Main temporal view should load within 2 seconds
    await expect(page.locator('[data-testid="temporal-comparison-view"]')).toBeVisible({ timeout: 2000 });
    
    const initialLoadTime = Date.now() - startTime;
    expect(initialLoadTime).toBeLessThan(2000);

    // AI analysis should complete within 3 seconds
    await expect(page.locator('[data-testid="ai-trend-analysis"]')).toBeVisible({ timeout: 3000 });
    
    const aiLoadTime = Date.now() - startTime;
    expect(aiLoadTime).toBeLessThan(3000);

    // Interactive chart should be responsive
    const chartInteractionStart = Date.now();
    
    const timeRangeSelector = page.locator('[data-testid="time-range-selector"]');
    await timeRangeSelector.click();
    await page.click('[data-testid="range-4weeks"]');
    
    // Chart should update within 1 second
    await page.waitForTimeout(1000);
    
    const chartUpdateTime = Date.now() - chartInteractionStart;
    expect(chartUpdateTime).toBeLessThan(1000);

    // Department trend cards should load efficiently
    const departmentTrendsSection = page.locator('[data-testid="department-trends-section"]');
    await expect(departmentTrendsSection).toBeVisible();
    
    const departmentCards = departmentTrendsSection.locator('[data-testid="department-trend-card"]');
    expect(await departmentCards.count()).toBeGreaterThan(0);
    
    // All department cards should be visible quickly
    for (let i = 0; i < Math.min(5, await departmentCards.count()); i++) {
      await expect(departmentCards.nth(i)).toBeVisible();
    }
  });
});