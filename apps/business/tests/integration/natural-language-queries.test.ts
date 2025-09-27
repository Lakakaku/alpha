/**
 * Integration test for natural language queries
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import { test, expect } from '@playwright/test';

test.describe('Natural Language Queries', () => {
  test.beforeEach(async ({ page }) => {
    // Login as business user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@business.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should process Swedish natural language queries correctly', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const naturalLanguageQueries = [
      {
        query: 'Vad tycker kunderna om köttavdelningen?',
        expectedDepartment: 'kött',
        expectedIntent: 'customer opinion'
      },
      {
        query: 'Vilka problem finns det med kassan?',
        expectedDepartment: 'kassa',
        expectedIntent: 'problem identification'
      },
      {
        query: 'Hur nöjda är kunderna med bageriet denna vecka?',
        expectedDepartment: 'bageri',
        expectedIntent: 'satisfaction measurement'
      },
      {
        query: 'Negativ feedback om kundservice senaste månaden',
        expectedDepartment: 'kundservice',
        expectedIntent: 'negative feedback review'
      }
    ];

    for (const { query, expectedDepartment, expectedIntent } of naturalLanguageQueries) {
      // Clear previous search
      await page.fill('[data-testid="search-query-input"]', '');
      
      // Type natural language query
      await page.fill('[data-testid="search-query-input"]', query);
      
      // Should show AI processing indicator
      await expect(page.locator('[data-testid="ai-processing-indicator"]')).toBeVisible();
      
      // Perform search
      await page.click('[data-testid="search-button"]');
      
      // Wait for AI processing to complete
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 5000 });
      
      // Should automatically detect and apply department filter
      const appliedFilters = page.locator('[data-testid="applied-filters"]');
      await expect(appliedFilters).toContainText(expectedDepartment);
      
      // Should show query interpretation
      const queryInterpretation = page.locator('[data-testid="query-interpretation"]');
      await expect(queryInterpretation).toBeVisible();
      await expect(queryInterpretation).toContainText(expectedIntent);
      
      // Results should be relevant to the query
      const resultItems = page.locator('[data-testid="feedback-result-item"]');
      if (await resultItems.count() > 0) {
        // Check relevance of first few results
        for (let i = 0; i < Math.min(3, await resultItems.count()); i++) {
          const item = resultItems.nth(i);
          const departmentTags = await item.locator('[data-testid="feedback-department-tags"]').textContent();
          expect(departmentTags?.toLowerCase()).toContain(expectedDepartment);
        }
      }
    }
  });

  test('should handle complex multi-part natural language queries', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const complexQueries = [
      {
        query: 'Jämför kundnöjdhet mellan kassa och bageri senaste veckan',
        expectedFeatures: ['comparison', 'sentiment analysis', 'time filter']
      },
      {
        query: 'Vilka förbättringar föreslår kunderna för köttavdelningen?',
        expectedFeatures: ['suggestion extraction', 'department filter']
      },
      {
        query: 'Negativ feedback om långa köer och väntetider',
        expectedFeatures: ['sentiment filter', 'keyword extraction']
      }
    ];

    for (const { query, expectedFeatures } of complexQueries) {
      await page.fill('[data-testid="search-query-input"]', query);
      await page.click('[data-testid="search-button"]');
      
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 5000 });
      
      // Should show advanced query processing
      const advancedProcessing = page.locator('[data-testid="advanced-query-processing"]');
      await expect(advancedProcessing).toBeVisible();
      
      // Should identify multiple query components
      const queryComponents = page.locator('[data-testid="query-component"]');
      expect(await queryComponents.count()).toBeGreaterThan(1);
      
      // Should apply multiple filters/features based on query
      for (const feature of expectedFeatures) {
        const featureIndicator = page.locator(`[data-testid="active-feature-${feature.replace(/ /g, '-')}"]`);
        await expect(featureIndicator).toBeVisible();
      }
    }
  });

  test('should provide query suggestions and auto-completion', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const searchInput = page.locator('[data-testid="search-query-input"]');
    
    // Test auto-completion for partial queries
    const partialQueries = [
      { partial: 'Vad tycker', expectedSuggestions: ['kunderna', 'om', 'människor'] },
      { partial: 'Problem med', expectedSuggestions: ['kassan', 'kött', 'bageri', 'service'] },
      { partial: 'Hur nöjda', expectedSuggestions: ['är kunderna', 'känner sig', 'verkar'] }
    ];

    for (const { partial, expectedSuggestions } of partialQueries) {
      await searchInput.fill(partial);
      
      // Should show suggestions dropdown
      await expect(page.locator('[data-testid="query-suggestions"]')).toBeVisible();
      
      const suggestionItems = page.locator('[data-testid="suggestion-item"]');
      expect(await suggestionItems.count()).toBeGreaterThan(0);
      
      // Should contain relevant suggestions
      let foundRelevantSuggestion = false;
      for (let i = 0; i < await suggestionItems.count(); i++) {
        const suggestionText = await suggestionItems.nth(i).textContent();
        if (suggestionText && expectedSuggestions.some(expected => 
          suggestionText.toLowerCase().includes(expected.toLowerCase())
        )) {
          foundRelevantSuggestion = true;
          break;
        }
      }
      expect(foundRelevantSuggestion).toBe(true);
      
      // Clear for next test
      await searchInput.fill('');
    }
  });

  test('should handle intent-based queries and route appropriately', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const intentQueries = [
      {
        query: 'Visa mig veckorapport för alla avdelningar',
        expectedRoute: 'reports',
        expectedView: 'weekly-report'
      },
      {
        query: 'Jämför denna vecka med förra veckan',
        expectedRoute: 'temporal',
        expectedView: 'comparison-view'
      },
      {
        query: 'Vilka åtgärder behövs för att förbättra kundnöjdheten?',
        expectedRoute: 'insights',
        expectedView: 'actionable-insights'
      }
    ];

    for (const { query, expectedRoute, expectedView } of intentQueries) {
      await page.fill('[data-testid="search-query-input"]', query);
      await page.click('[data-testid="search-button"]');
      
      // Should recognize intent and suggest appropriate view
      await expect(page.locator('[data-testid="intent-recognition"]')).toBeVisible();
      
      const suggestedView = page.locator('[data-testid="suggested-view"]');
      await expect(suggestedView).toBeVisible();
      await expect(suggestedView).toContainText(expectedView);
      
      // Should offer to navigate to appropriate section
      const navigationSuggestion = page.locator('[data-testid="navigation-suggestion"]');
      await expect(navigationSuggestion).toBeVisible();
      
      // Click to navigate to suggested view
      await navigationSuggestion.click();
      
      // Should navigate to appropriate section
      await expect(page.locator(`[data-testid="${expectedView}"]`)).toBeVisible();
      
      // Return to search for next test
      await page.goto('/dashboard/feedback-analysis/search');
    }
  });

  test('should support conversational query refinement', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    // Initial broad query
    await page.fill('[data-testid="search-query-input"]', 'Problem med service');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Should offer refinement suggestions
    await expect(page.locator('[data-testid="refinement-suggestions"]')).toBeVisible();
    
    const refinementOptions = page.locator('[data-testid="refinement-option"]');
    expect(await refinementOptions.count()).toBeGreaterThan(0);
    
    // Click on a refinement suggestion
    await refinementOptions.first().click();
    
    // Should update search with refined query
    await expect(page.locator('[data-testid="refined-search-results"]')).toBeVisible();
    
    // Should show conversation history
    await expect(page.locator('[data-testid="query-conversation"]')).toBeVisible();
    
    const conversationSteps = page.locator('[data-testid="conversation-step"]');
    expect(await conversationSteps.count()).toBeGreaterThanOrEqual(2);
    
    // Should allow further refinement
    await expect(page.locator('[data-testid="further-refinement"]')).toBeVisible();
  });

  test('should extract and highlight key entities from queries', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const entityQueries = [
      {
        query: 'Kunder klagar på långa väntetider vid kassan på fredagar',
        expectedEntities: ['kunder', 'väntetider', 'kassan', 'fredagar']
      },
      {
        query: 'Köttavdelningens produkter är inte färska enligt feedback',
        expectedEntities: ['köttavdelningen', 'produkter', 'färska', 'feedback']
      }
    ];

    for (const { query, expectedEntities } of entityQueries) {
      await page.fill('[data-testid="search-query-input"]', query);
      await page.click('[data-testid="search-button"]');
      
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      
      // Should show entity extraction
      await expect(page.locator('[data-testid="extracted-entities"]')).toBeVisible();
      
      const entityTags = page.locator('[data-testid="entity-tag"]');
      expect(await entityTags.count()).toBeGreaterThan(0);
      
      // Should highlight relevant entities
      for (const expectedEntity of expectedEntities) {
        const entityTag = page.locator(`[data-testid="entity-${expectedEntity}"]`);
        if (await entityTag.isVisible()) {
          // Entity should be clickable for filtering
          await expect(entityTag).toBeEnabled();
        }
      }
      
      // Should allow entity-based filtering
      if (await entityTags.count() > 0) {
        await entityTags.first().click();
        
        // Should filter results based on selected entity
        await expect(page.locator('[data-testid="entity-filtered-results"]')).toBeVisible();
      }
    }
  });

  test('should handle ambiguous queries with clarification prompts', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const ambiguousQueries = [
      'problem',
      'bra',
      'service',
      'kvalitet'
    ];

    for (const query of ambiguousQueries) {
      await page.fill('[data-testid="search-query-input"]', query);
      await page.click('[data-testid="search-button"]');
      
      // Should recognize ambiguity and ask for clarification
      const clarificationPrompt = page.locator('[data-testid="clarification-prompt"]');
      await expect(clarificationPrompt).toBeVisible();
      
      // Should offer specific clarification options
      const clarificationOptions = page.locator('[data-testid="clarification-option"]');
      expect(await clarificationOptions.count()).toBeGreaterThan(1);
      
      // Options should be contextually relevant
      for (let i = 0; i < await clarificationOptions.count(); i++) {
        const optionText = await clarificationOptions.nth(i).textContent();
        expect(optionText?.length).toBeGreaterThan(query.length + 5); // Should be more specific
      }
      
      // Select a clarification option
      await clarificationOptions.first().click();
      
      // Should perform refined search
      await expect(page.locator('[data-testid="clarified-search-results"]')).toBeVisible();
    }
  });

  test('should provide AI confidence scores for query interpretation', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    await page.fill('[data-testid="search-query-input"]', 'Kunderna är missnöjda med långa väntetider vid kassan');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Should show AI interpretation confidence
    await expect(page.locator('[data-testid="interpretation-confidence"]')).toBeVisible();
    
    const confidenceScore = page.locator('[data-testid="confidence-score"]');
    await expect(confidenceScore).toBeVisible();
    
    const confidenceText = await confidenceScore.textContent();
    expect(confidenceText).toMatch(/\d+%/);
    
    // Should show interpretation breakdown
    await expect(page.locator('[data-testid="interpretation-breakdown"]')).toBeVisible();
    
    const interpretationComponents = page.locator('[data-testid="interpretation-component"]');
    expect(await interpretationComponents.count()).toBeGreaterThan(0);
    
    // Each component should have confidence indicator
    for (let i = 0; i < await interpretationComponents.count(); i++) {
      const component = interpretationComponents.nth(i);
      await expect(component.locator('[data-testid="component-confidence"]')).toBeVisible();
    }
    
    // Low confidence should show alternative interpretations
    if (confidenceText && parseInt(confidenceText) < 80) {
      await expect(page.locator('[data-testid="alternative-interpretations"]')).toBeVisible();
    }
  });

  test('should meet performance requirements for natural language processing', async ({ page }) => {
    await page.goto('/dashboard/feedback-analysis/search');
    
    const testQueries = [
      'Vad tycker kunderna om köttavdelningen?',
      'Problem med kassan senaste veckan',
      'Jämför bageri och kundservice denna månaden'
    ];

    for (const query of testQueries) {
      const startTime = Date.now();
      
      await page.fill('[data-testid="search-query-input"]', query);
      await page.click('[data-testid="search-button"]');
      
      // AI processing should complete within 3 seconds
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 3000 });
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(3000);
      
      // Should show processing steps for transparency
      const processingSteps = page.locator('[data-testid="processing-step"]');
      if (await processingSteps.isVisible()) {
        expect(await processingSteps.count()).toBeGreaterThan(0);
      }
    }
  });
});