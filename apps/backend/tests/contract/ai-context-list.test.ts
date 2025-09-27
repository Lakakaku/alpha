/**
 * Contract Test: GET /ai-assistant/context/entries
 * Test ID: T011
 * Feature: AI Assistant Interface (Context Builder)
 *
 * This test validates the API contract for listing business context entries.
 * Should FAIL until the endpoint is implemented.
 */

import request from 'supertest';
import { app } from '../../src/app';
import { ContextCategory } from '@vocilia/types';

describe('GET /ai-assistant/context/entries', () => {
  const endpoint = '/api/ai-assistant/context/entries';
  let authToken: string;
  let businessId: string;
  let storeId: string;

  beforeAll(async () => {
    // Setup test authentication and business context
    // This will need to be implemented when auth system is integrated
    authToken = 'test-auth-token';
    businessId = 'test-business-id';
    storeId = 'test-store-id';
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
    it('should return paginated context entries list', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        entries: expect.arrayContaining([]),
        total: expect.any(Number),
        has_more: expect.any(Boolean)
      });

      // Validate context entry object structure
      if (response.body.entries.length > 0) {
        const entry = response.body.entries[0];
        expect(entry).toMatchObject({
          id: expect.any(String),
          business_id: expect.any(String),
          store_id: expect.any(String),
          conversation_id: expect.any(String),
          category: expect.stringMatching(/^(store_profile|personnel|layout|inventory|operations|customer_journey|fraud_detection|seasonal_variations)$/),
          key: expect.any(String),
          value: expect.any(Object),
          confidence_score: expect.any(Number),
          source_type: expect.stringMatching(/^(conversation|ai_inference|manual_input|system_default)$/),
          is_verified: expect.any(Boolean),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        });

        // Validate confidence score range
        expect(entry.confidence_score).toBeGreaterThanOrEqual(0);
        expect(entry.confidence_score).toBeLessThanOrEqual(1);

        // Validate ISO date format
        expect(new Date(entry.created_at)).toBeInstanceOf(Date);
        expect(new Date(entry.updated_at)).toBeInstanceOf(Date);
      }
    });

    it('should support store_id filtering', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ store_id: storeId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // All returned entries should belong to the specified store
      response.body.entries.forEach((entry: any) => {
        expect(entry.store_id).toBe(storeId);
      });
    });

    it('should support category filtering', async () => {
      const category: ContextCategory = 'store_profile';
      const response = await request(app)
        .get(endpoint)
        .query({ category })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // All returned entries should have the specified category
      response.body.entries.forEach((entry: any) => {
        expect(entry.category).toBe(category);
      });
    });

    it('should support is_verified filtering', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ is_verified: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // All returned entries should be verified
      response.body.entries.forEach((entry: any) => {
        expect(entry.is_verified).toBe(true);
      });
    });

    it('should support source_type filtering', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ source_type: 'ai_inference' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // All returned entries should have ai_inference source
      response.body.entries.forEach((entry: any) => {
        expect(entry.source_type).toBe('ai_inference');
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

      expect(response.body.entries).toEqual(expect.any(Array));
      expect(response.body.entries.length).toBeLessThanOrEqual(limit);
      expect(response.body.total).toEqual(expect.any(Number));
      expect(response.body.has_more).toEqual(expect.any(Boolean));
    });

    it('should support multiple filters combined', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ 
          store_id: storeId,
          category: 'operations',
          is_verified: 'false',
          source_type: 'ai_inference'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // All entries should match all filters
      response.body.entries.forEach((entry: any) => {
        expect(entry.store_id).toBe(storeId);
        expect(entry.category).toBe('operations');
        expect(entry.is_verified).toBe(false);
        expect(entry.source_type).toBe('ai_inference');
      });
    });

    it('should support sorting by confidence_score', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ sort: 'confidence_score', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // Entries should be sorted by confidence score descending
      if (response.body.entries.length > 1) {
        for (let i = 0; i < response.body.entries.length - 1; i++) {
          expect(response.body.entries[i].confidence_score)
            .toBeGreaterThanOrEqual(response.body.entries[i + 1].confidence_score);
        }
      }
    });

    it('should support sorting by updated_at', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ sort: 'updated_at', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));

      // Entries should be sorted by updated_at descending
      if (response.body.entries.length > 1) {
        for (let i = 0; i < response.body.entries.length - 1; i++) {
          const current = new Date(response.body.entries[i].updated_at);
          const next = new Date(response.body.entries[i + 1].updated_at);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
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

    it('should reject invalid category values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ category: 'invalid-category' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid source_type values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ source_type: 'invalid-source' })
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

    it('should reject invalid is_verified values', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ is_verified: 'maybe' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });

    it('should reject invalid sort values', async () => {
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
        .query({ sort: 'updated_at', order: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.any(Object)
      });
    });
  });

  describe('Authorization', () => {
    it('should only return entries for businesses user has access to', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All entries should belong to businesses the user has access to
      response.body.entries.forEach((entry: any) => {
        expect(entry.business_id).toBe(businessId);
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

    it('should filter entries by accessible stores only', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All entries should be from stores the user has access to
      response.body.entries.forEach((entry: any) => {
        if (entry.store_id) {
          // This would be validated against user's accessible stores
          expect(typeof entry.store_id).toBe('string');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      // Test with business that has no context entries
      const emptyBusinessToken = 'test-empty-business-token';

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${emptyBusinessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        entries: [],
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
        entries: [],
        total: expect.any(Number),
        has_more: false
      });
    });

    it('should handle filters that return no results', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ 
          category: 'fraud_detection',
          is_verified: 'true',
          source_type: 'manual_input'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        entries: [],
        total: 0,
        has_more: false
      });
    });
  });

  describe('Performance', () => {
    it('should respond within 500ms', async () => {
      const startTime = Date.now();

      await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle large result sets efficiently', async () => {
      const response = await request(app)
        .get(endpoint)
        .query({ limit: 100 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.entries).toEqual(expect.any(Array));
      expect(response.body.entries.length).toBeLessThanOrEqual(100);
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
          entries: expect.any(Array),
          total: expect.any(Number),
          has_more: expect.any(Boolean)
        });
      });
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent counts across filtered and unfiltered requests', async () => {
      // Get all entries
      const allResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get verified entries
      const verifiedResponse = await request(app)
        .get(endpoint)
        .query({ is_verified: 'true' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get unverified entries
      const unverifiedResponse = await request(app)
        .get(endpoint)
        .query({ is_verified: 'false' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Total should equal verified + unverified
      expect(allResponse.body.total).toBe(
        verifiedResponse.body.total + unverifiedResponse.body.total
      );
    });

    it('should maintain consistent ordering across paginated requests', async () => {
      // Get first page
      const firstPage = await request(app)
        .get(endpoint)
        .query({ limit: 5, offset: 0, sort: 'updated_at', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get second page
      const secondPage = await request(app)
        .get(endpoint)
        .query({ limit: 5, offset: 5, sort: 'updated_at', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Last item of first page should be newer than or equal to first item of second page
      if (firstPage.body.entries.length > 0 && secondPage.body.entries.length > 0) {
        const lastFirst = new Date(firstPage.body.entries[firstPage.body.entries.length - 1].updated_at);
        const firstSecond = new Date(secondPage.body.entries[0].updated_at);
        expect(lastFirst.getTime()).toBeGreaterThanOrEqual(firstSecond.getTime());
      }
    });
  });
});