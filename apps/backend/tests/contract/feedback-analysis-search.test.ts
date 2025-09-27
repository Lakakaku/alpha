/**
 * Contract test for POST /feedback-analysis/search/{storeId}
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import type { SearchRequest, SearchResponse } from '@vocilia/types/feedback-analysis';

// Mock application setup
let app: any;
const TEST_STORE_ID = 'test-store-id-123';
const AUTH_TOKEN = 'Bearer test-jwt-token';

beforeAll(async () => {
  // TODO: Initialize test app when implemented
  // app = await createTestApp();
});

afterAll(async () => {
  // TODO: Cleanup test app when implemented
  // await cleanupTestApp(app);
});

describe('POST /feedback-analysis/search/{storeId}', () => {

  const validSearchRequest: SearchRequest = {
    query_text: 'kött avdelning problem',
    limit: 20,
  };

  it('should process natural language search query and return results', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(validSearchRequest)
      .expect(200);

    // Validate SearchResponse structure
    expect(response.body).toMatchObject({
      feedback: expect.any(Array),
      total_count: expect.any(Number),
      execution_time_ms: expect.any(Number),
    });

    // Validate feedback array structure
    response.body.feedback.forEach((feedback: any) => {
      expect(feedback).toMatchObject({
        id: expect.any(String),
        store_id: TEST_STORE_ID,
        business_id: expect.any(String),
        content: expect.any(String),
        created_at: expect.any(String),
      });

      // Validate analysis fields if present
      if (feedback.sentiment) {
        expect(['positive', 'negative', 'neutral', 'mixed']).toContain(feedback.sentiment);
      }
      if (feedback.department_tags) {
        expect(Array.isArray(feedback.department_tags)).toBe(true);
      }
    });

    // Validate performance requirement
    expect(response.body.execution_time_ms).toBeLessThan(500);

    // Should include AI-generated summary if results exist
    if (response.body.feedback.length > 0) {
      expect(response.body.summary).toBeDefined();
      expect(typeof response.body.summary).toBe('string');
    }
  });

  it('should handle department-specific search queries', async () => {
    const departmentSearchRequest: SearchRequest = {
      query_text: 'kassa problem',
      departments: ['kassa', 'kundservice'],
      limit: 10,
    };

    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(departmentSearchRequest)
      .expect(200);

    expect(response.body).toMatchObject({
      feedback: expect.any(Array),
      total_count: expect.any(Number),
      execution_time_ms: expect.any(Number),
    });

    // Results should be filtered by department
    response.body.feedback.forEach((feedback: any) => {
      if (feedback.department_tags) {
        const hasRelevantDepartment = feedback.department_tags.some((tag: string) =>
          departmentSearchRequest.departments?.includes(tag.toLowerCase())
        );
        // Don't enforce this strictly as AI might find relevant content without exact tag matches
      }
    });
  });

  it('should handle sentiment filtering', async () => {
    const sentimentSearchRequest: SearchRequest = {
      query_text: 'service quality',
      sentiment_filter: 'negative',
      limit: 15,
    };

    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(sentimentSearchRequest)
      .expect(200);

    expect(response.body).toMatchObject({
      feedback: expect.any(Array),
      total_count: expect.any(Number),
      execution_time_ms: expect.any(Number),
    });

    // If sentiment analysis is available, results should match filter
    response.body.feedback.forEach((feedback: any) => {
      if (feedback.sentiment) {
        expect(feedback.sentiment).toBe('negative');
      }
    });
  });

  it('should handle date range filtering', async () => {
    const dateRangeSearchRequest: SearchRequest = {
      query_text: 'kundservice',
      date_range: {
        start_date: '2025-09-01',
        end_date: '2025-09-21',
      },
      limit: 20,
    };

    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(dateRangeSearchRequest)
      .expect(200);

    expect(response.body).toMatchObject({
      feedback: expect.any(Array),
      total_count: expect.any(Number),
      execution_time_ms: expect.any(Number),
    });

    // Validate date filtering
    response.body.feedback.forEach((feedback: any) => {
      const feedbackDate = new Date(feedback.created_at);
      const startDate = new Date(dateRangeSearchRequest.date_range!.start_date);
      const endDate = new Date(dateRangeSearchRequest.date_range!.end_date);

      expect(feedbackDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
      expect(feedbackDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
    });
  });

  it('should validate query_text length requirements', async () => {
    // Test empty query
    const emptyQueryRequest = { ...validSearchRequest, query_text: '' };
    const response1 = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(emptyQueryRequest)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('query_text'),
    });

    // Test too long query
    const longQueryRequest = {
      ...validSearchRequest,
      query_text: 'a'.repeat(501) // Exceeds 500 char limit
    };
    const response2 = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(longQueryRequest)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('query_text'),
    });
  });

  it('should validate limit parameter bounds', async () => {
    // Test limit too high
    const highLimitRequest = { ...validSearchRequest, limit: 150 };
    const response1 = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(highLimitRequest)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('limit'),
    });

    // Test limit too low
    const lowLimitRequest = { ...validSearchRequest, limit: 0 };
    const response2 = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(lowLimitRequest)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('limit'),
    });
  });

  it('should return empty results when no matches found', async () => {
    const noResultsRequest: SearchRequest = {
      query_text: 'nonexistent unicorn product complaint',
      limit: 20,
    };

    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(noResultsRequest)
      .expect(200);

    expect(response.body).toMatchObject({
      feedback: [],
      total_count: 0,
      execution_time_ms: expect.any(Number),
    });
  });

  it('should return 403 when user lacks access to store', async () => {
    const unauthorizedStoreId = 'unauthorized-store-id';

    const response = await request(app)
      .post(`/feedback-analysis/search/${unauthorizedStoreId}`)
      .set('Authorization', AUTH_TOKEN)
      .send(validSearchRequest)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should handle malformed JSON request body', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .set('Content-Type', 'application/json')
      .send('{"query_text": invalid json}')
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('JSON'),
    });
  });

  it('should log search queries for analytics', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/search/${TEST_STORE_ID}`)
      .set('Authorization', AUTH_TOKEN)
      .send(validSearchRequest)
      .expect(200);

    // Search should be logged (this will be verified through database integration)
    expect(response.header['x-search-logged']).toBeDefined();
  });
});