/**
 * Contract Test: GET /ai-assistant/suggestions
 * Test ID: T013
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for listing AI-generated suggestions.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { SuggestionType, PriorityLevel, SuggestionStatus, ContextCategory } from '@vocilia/types';

describe('GET /ai-assistant/suggestions', () => {
  const endpoint = '/api/ai-assistant/suggestions';
  let authToken: string;
  let businessId: string;
  let storeId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    storeId = 'test-store-id';
    conversationId = 'test-conversation-id';
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });
  });

  describe('Success Cases', () => {
    it('should return paginated suggestions list', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        suggestions: expect.arrayContaining([]),
        total: expect.any(Number),
        has_more: expect.any(Boolean)
      });

      // Validate suggestion object structure
      if (response.body.suggestions.length > 0) {
        const suggestion = response.body.suggestions[0];
        expect(suggestion).toMatchObject({
          id: expect.any(String),
          business_id: expect.any(String),
          store_id: expect.any(String),
          conversation_id: expect.any(String),
          suggestion_type: expect.stringMatching(/^(context_gap|question_recommendation|fraud_improvement|frequency_optimization|validation_enhancement)$/),
          category: expect.stringMatching(/^(store_profile|personnel|layout|inventory|operations|customer_journey|fraud_detection|seasonal_variations)$/),
          title: expect.any(String),
          description: expect.any(String),
          action_data: expect.any(Object),
          priority: expect.stringMatching(/^(low|medium|high|critical)$/),
          status: expect.stringMatching(/^(pending|accepted|rejected|implemented)$/),
          accepted_at: expect.any(String),
          rejected_at: expect.any(String),
          created_at: expect.any(String)
        });

        // Validate ISO date format
        expect(new Date(suggestion.created_at)).toBeInstanceOf(Date);
        if (suggestion.accepted_at) {
          expect(new Date(suggestion.accepted_at)).toBeInstanceOf(Date);
        }
        if (suggestion.rejected_at) {
          expect(new Date(suggestion.rejected_at)).toBeInstanceOf(Date);
        }
      }
    });

    it('should support store_id filtering', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ store_id: storeId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All returned suggestions should belong to the specified store
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.store_id).toBe(storeId);
      });
    });

    it('should support conversation_id filtering', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ conversation_id: conversationId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All returned suggestions should belong to the specified conversation
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.conversation_id).toBe(conversationId);
      });
    });

    it('should support suggestion_type filtering', async () => {
      const suggestionType: SuggestionType = 'context_gap';
      const response = await request(app)
        .get(endpoint)
        .query({ suggestion_type: suggestionType })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All returned suggestions should have the specified type
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.suggestion_type).toBe(suggestionType);
      });
    });

    it('should support priority filtering', async () => {
      const priority: PriorityLevel = 'high';
      const response = await request(app)
        .get(endpoint)
        .query({ priority })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All returned suggestions should have the specified priority
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.priority).toBe(priority);
      });
    });

    it('should support status filtering', async () => {
      const status: SuggestionStatus = 'pending';
      const response = await request(app)
        .get(endpoint)
        .query({ status })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All returned suggestions should have the specified status
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.status).toBe(status);
      });
    });

    it('should support category filtering', async () => {
      const category: ContextCategory = 'fraud_detection';
      const response = await request(app)
        .get(endpoint)
        .query({ category })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All returned suggestions should have the specified category
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.category).toBe(category);
      });
    });

    it('should support pagination with limit and offset', async () => {
      const limit = 5;
      const offset = 10;

      const response = await request(app)
        .get(endpoint)
        .query({ limit, offset })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));
      expect(response.body.suggestions.length).toBeLessThanOrEqual(limit);
      expect(response.body.total).toEqual(expect.any(Number));
      expect(response.body.has_more).toEqual(expect.any(Boolean));
    });

    it('should support multiple filters combined', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ 
          store_id: storeId,
          suggestion_type: 'fraud_improvement',
          priority: 'high',
          status: 'pending'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // All suggestions should match all filters
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.store_id).toBe(storeId);
        expect(suggestion.suggestion_type).toBe('fraud_improvement');
        expect(suggestion.priority).toBe('high');
        expect(suggestion.status).toBe('pending');
      });
    });

    it('should support sorting by priority', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ sort: 'priority', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // Suggestions should be sorted by priority (critical > high > medium > low)
      if (response.body.suggestions.length > 1) {
        const priorityOrder = ['critical', 'high', 'medium', 'low'];
        for (let i = 0; i < response.body.suggestions.length - 1; i++) {
          const currentPriority = response.body.suggestions[i].priority;
          const nextPriority = response.body.suggestions[i + 1].priority;
          const currentIndex = priorityOrder.indexOf(currentPriority);
          const nextIndex = priorityOrder.indexOf(nextPriority);
          expect(currentIndex).toBeLessThanOrEqual(nextIndex);
        }
      }
    });

    it('should support sorting by created_at', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ sort: 'created_at', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // Suggestions should be sorted by created_at descending
      if (response.body.suggestions.length > 1) {
        for (let i = 0; i < response.body.suggestions.length - 1; i++) {
          const current = new Date(response.body.suggestions[i].created_at);
          const next = new Date(response.body.suggestions[i + 1].created_at);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });

    it('should include action_data when available', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ suggestion_type: 'question_recommendation' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.suggestions.length > 0) {
        const suggestion = response.body.suggestions[0];
        if (suggestion.action_data) {
          expect(suggestion.action_data).toEqual(expect.any(Object));
          
          // For question recommendations, should include question details
          if (suggestion.suggestion_type === 'question_recommendation') {
            expect(suggestion.action_data).toMatchObject({
              question: expect.any(String),
              expected_response_type: expect.any(String)
            });
          }
        }
      }
    });
  });

  describe('Validation', () => {
    it('should reject invalid limit values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ limit: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject limit values over 100', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ limit: 101 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject negative offset values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ offset: -1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid suggestion_type values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ suggestion_type: 'invalid-type' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid priority values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ priority: 'invalid-priority' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid status values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ status: 'invalid-status' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid UUID format for store_id', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ store_id: 'not-a-uuid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid UUID format for conversation_id', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ conversation_id: 'not-a-uuid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid sort fields', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ sort: 'invalid-field' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid order values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ sort: 'created_at', order: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only return suggestions for businesses user has access to', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All suggestions should belong to businesses the user has access to
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.business_id).toBe(businessId);
      });
    });

    it('should respect write_context permission requirements', async () => {
      // Test with user that has only read permissions
      const readOnlyToken = 'test-readonly-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .expect(403);

      expect(response.body).toEqual({
        error: 'Insufficient permissions'
      });
    });

    it('should filter suggestions by accessible stores only', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All suggestions should be from stores the user has access to
      response.body.suggestions.forEach((suggestion: any) => {
        if (suggestion.store_id) {
          // This would be validated against user's accessible stores
          expect(typeof suggestion.store_id).toBe('string');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      // Test with business that has no suggestions
      const emptyBusinessToken = 'test-empty-business-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${emptyBusinessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        suggestions: [],
        total: 0,
        has_more: false
      });
    });

    it('should handle very large offset values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ offset: 999999 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        suggestions: [],
        total: expect.any(Number),
        has_more: false
      });
    });

    it('should handle filters that return no results', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ 
          suggestion_type: 'validation_enhancement',
          priority: 'critical',
          status: 'implemented'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        suggestions: [],
        total: 0,
        has_more: false
      });
    });

    it('should handle null category values correctly', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ category: 'null' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));

      // Should return suggestions with null category
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.category).toBeNull();
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 300ms', async () => {
      const startTime = Date.now();

      await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(300);
    });

    it('should handle large result sets efficiently', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.suggestions).toEqual(expect.any(Array));
      expect(response.body.suggestions.length).toBeLessThanOrEqual(100);
    });

    it('should support concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          suggestions: expect.any(Array),
          total: expect.any(Number),
          has_more: expect.any(Boolean)
        });
      });
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent counts across filtered and unfiltered requests', async () => {
      // Get all suggestions
      const allResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get pending suggestions
      const pendingResponse = await request(app)
        .get(endpoint)
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get non-pending suggestions
      const nonPendingResponse = await request(app)
        .get(endpoint)
        .query({ status: 'accepted,rejected,implemented' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Total should be at least pending count
      expect(allResponse.body.total).toBeGreaterThanOrEqual(pendingResponse.body.total);
    });

    it('should maintain consistent ordering across paginated requests', async () => {
      // Get first page
      const firstPage = await request(app)
        .get(endpoint)
        .query({ limit: 5, offset: 0, sort: 'priority', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get second page
      const secondPage = await request(app)
        .get(endpoint)
        .query({ limit: 5, offset: 5, sort: 'priority', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Priority ordering should be maintained across pages
      if (firstPage.body.suggestions.length > 0 && secondPage.body.suggestions.length > 0) {
        const priorityOrder = ['critical', 'high', 'medium', 'low'];
        const lastFirstPriority = firstPage.body.suggestions[firstPage.body.suggestions.length - 1].priority;
        const firstSecondPriority = secondPage.body.suggestions[0].priority;
        
        const lastFirstIndex = priorityOrder.indexOf(lastFirstPriority);
        const firstSecondIndex = priorityOrder.indexOf(firstSecondPriority);
        
        expect(lastFirstIndex).toBeLessThanOrEqual(firstSecondIndex);
      }
    });

    it('should handle suggestion status transitions correctly', async () => {
      // Get suggestions in different states
      const pendingResponse = await request(app)
        .get(endpoint)
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const acceptedResponse = await request(app)
        .get(endpoint)
        .query({ status: 'accepted' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Accepted suggestions should have accepted_at timestamp
      acceptedResponse.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.status).toBe('accepted');
        expect(suggestion.accepted_at).toBeDefined();
        expect(suggestion.accepted_at).not.toBeNull();
        expect(new Date(suggestion.accepted_at)).toBeInstanceOf(Date);
      });

      // Pending suggestions should not have accepted_at or rejected_at
      pendingResponse.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion.status).toBe('pending');
        expect(suggestion.accepted_at).toBeNull();
        expect(suggestion.rejected_at).toBeNull();
      });
    });
  });
});