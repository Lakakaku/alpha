/**
 * Contract test for GET /feedback-analysis/reports/{storeId}/historical
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';
import { AnalysisReport } from '@vocilia/types/feedback-analysis';

describe('GET /feedback-analysis/reports/{storeId}/historical', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  it('should return historical analysis reports for valid store', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .set('Authorization', authToken)
      .expect(200);

    // Should return array of AnalysisReport objects
    expect(Array.isArray(response.body)).toBe(true);

    // If reports exist, validate structure
    if (response.body.length > 0) {
      response.body.forEach((report: any) => {
        expect(report).toMatchObject({
          id: expect.any(String),
          store_id: testStoreId,
          business_id: expect.any(String),
          week_number: expect.any(Number),
          year: expect.any(Number),
          total_feedback_count: expect.any(Number),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });

        // Validate week_number range
        expect(report.week_number).toBeGreaterThanOrEqual(1);
        expect(report.week_number).toBeLessThanOrEqual(53);
      });

      // Reports should be sorted by recency (newest first)
      for (let i = 1; i < response.body.length; i++) {
        const current = new Date(response.body[i-1].created_at);
        const next = new Date(response.body[i].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    }
  });

  it('should respect weeks query parameter', async () => {
    const weeks = 8;
    const response = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .query({ weeks })
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeLessThanOrEqual(weeks);
  });

  it('should validate weeks parameter range', async () => {
    // Test invalid weeks parameter (too high)
    const response1 = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .query({ weeks: 100 })
      .set('Authorization', authToken)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('weeks'),
    });

    // Test invalid weeks parameter (zero)
    const response2 = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .query({ weeks: 0 })
      .set('Authorization', authToken)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('weeks'),
    });
  });

  it('should default to 4 weeks when no weeks parameter provided', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeLessThanOrEqual(4);
  });

  it('should return 403 when user lacks access to store', async () => {
    const unauthorizedStoreId = 'unauthorized-store-id';

    const response = await request(app)
      .get(`/feedback-analysis/reports/${unauthorizedStoreId}/historical`)
      .set('Authorization', authToken)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should return empty array when no historical data exists', async () => {
    const newStoreId = 'new-store-no-history';

    const response = await request(app)
      .get(`/feedback-analysis/reports/${newStoreId}/historical`)
      .set('Authorization', authToken)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should include pagination metadata in headers', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .query({ weeks: 10 })
      .set('Authorization', authToken);

    expect(response.header['x-total-count']).toBeDefined();
    expect(response.header['x-weeks-requested']).toBe('10');
  });

  it('should handle invalid UUID format for storeId', async () => {
    const invalidStoreId = 'not-a-uuid';

    const response = await request(app)
      .get(`/feedback-analysis/reports/${invalidStoreId}/historical`)
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should maintain response time under 200ms for database queries', async () => {
    const startTime = Date.now();

    await request(app)
      .get(`/feedback-analysis/reports/${testStoreId}/historical`)
      .set('Authorization', authToken);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(200);
  });
});