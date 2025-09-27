/**
 * Contract test for GET /feedback-analysis/reports/{storeId}/current
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';
import { AnalysisReport } from '@vocilia/types/feedback-analysis';

describe('GET /feedback-analysis/reports/{storeId}/current', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  it('should return current week analysis report for valid store', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken)
      .expect(200);

    // Validate response structure matches AnalysisReport interface
    expect(response.body).toMatchObject({
      id: expect.any(String),
      store_id: testStoreId,
      business_id: expect.any(String),
      week_number: expect.any(Number),
      year: expect.any(Number),
      total_feedback_count: expect.any(Number),
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });

    // Validate optional fields are properly typed
    if (response.body.positive_summary) {
      expect(typeof response.body.positive_summary).toBe('string');
    }
    if (response.body.negative_summary) {
      expect(typeof response.body.negative_summary).toBe('string');
    }
    if (response.body.general_opinions) {
      expect(typeof response.body.general_opinions).toBe('string');
    }
    if (response.body.new_critiques) {
      expect(Array.isArray(response.body.new_critiques)).toBe(true);
    }
    if (response.body.actionable_insights) {
      expect(Array.isArray(response.body.actionable_insights)).toBe(true);
    }

    // Validate week_number is within valid range
    expect(response.body.week_number).toBeGreaterThanOrEqual(1);
    expect(response.body.week_number).toBeLessThanOrEqual(53);

    // Validate year is reasonable
    expect(response.body.year).toBeGreaterThanOrEqual(2020);
    expect(response.body.year).toBeLessThanOrEqual(2050);
  });

  it('should return 404 when no analysis available for current week', async () => {
    const nonExistentStoreId = 'non-existent-store-id';

    const response = await request(app)
      .get(`/feedback-analysis/reports/${nonExistentStoreId}/current`)
      .set('Authorization', authToken)
      .expect(404);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return 403 when user lacks access to store', async () => {
    const unauthorizedStoreId = 'unauthorized-store-id';

    const response = await request(app)
      .get(`/feedback-analysis/reports/${unauthorizedStoreId}/current`)
      .set('Authorization', authToken)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return 401 when no authorization header is provided', async () => {
    await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .expect(401);
  });

  it('should validate UUID format for storeId parameter', async () => {
    const invalidStoreId = 'invalid-uuid-format';

    const response = await request(app)
      .get(`/feedback-analysis/reports/${invalidStoreId}/current`)
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should include performance metadata in response headers', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/current`)
      .set('Authorization', authToken);

    // Ensure response time is under performance target
    expect(response.header['x-response-time']).toBeDefined();
    const responseTime = parseInt(response.header['x-response-time']);
    expect(responseTime).toBeLessThan(2000); // 2s target for categorization
  });

  it('should handle concurrent requests without conflicts', async () => {
    const requests = Array(5).fill(0).map(() =>
      request(app)
        .get(`/feedback-analysis/reports/${testStoreId}/current`)
        .set('Authorization', authToken)
    );

    const responses = await Promise.all(requests);

    responses.forEach(response => {
      expect([200, 404]).toContain(response.status);
    });
  });
});