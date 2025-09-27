/**
 * Contract test for GET /feedback-analysis/insights/{storeId}
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';
import { FeedbackInsight } from '@vocilia/types/feedback-analysis';

describe('GET /feedback-analysis/insights/{storeId}', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  it('should return actionable insights for valid store', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .set('Authorization', authToken)
      .expect(200);

    // Should return array of FeedbackInsight objects
    expect(Array.isArray(response.body)).toBe(true);

    // If insights exist, validate structure
    if (response.body.length > 0) {
      response.body.forEach((insight: any) => {
        expect(insight).toMatchObject({
          id: expect.any(String),
          store_id: testStoreId,
          business_id: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          priority: expect.stringMatching(/^(low|medium|high|critical)$/),
          status: expect.stringMatching(/^(active|acknowledged|resolved|dismissed)$/),
          department: expect.any(String),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        });

        // Validate optional fields
        if (insight.suggested_actions) {
          expect(Array.isArray(insight.suggested_actions)).toBe(true);
        }
        if (insight.feedback_count) {
          expect(typeof insight.feedback_count).toBe('number');
          expect(insight.feedback_count).toBeGreaterThan(0);
        }
        if (insight.confidence_score) {
          expect(typeof insight.confidence_score).toBe('number');
          expect(insight.confidence_score).toBeGreaterThanOrEqual(0);
          expect(insight.confidence_score).toBeLessThanOrEqual(1);
        }
      });

      // Insights should be sorted by priority and recency
      for (let i = 1; i < response.body.length; i++) {
        const current = response.body[i-1];
        const next = response.body[i];
        
        // Critical/high priority should come before low priority
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const currentPriority = priorityOrder[current.priority as keyof typeof priorityOrder];
        const nextPriority = priorityOrder[next.priority as keyof typeof priorityOrder];
        
        expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
      }
    }
  });

  it('should filter insights by status parameter', async () => {
    const status = 'active';
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ status })
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    // All returned insights should have the requested status
    response.body.forEach((insight: any) => {
      expect(insight.status).toBe(status);
    });
  });

  it('should filter insights by priority parameter', async () => {
    const priority = 'high';
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ priority })
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    // All returned insights should have high or critical priority
    response.body.forEach((insight: any) => {
      expect(['high', 'critical']).toContain(insight.priority);
    });
  });

  it('should filter insights by department parameter', async () => {
    const department = 'kassa';
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ department })
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    // All returned insights should be for the specified department
    response.body.forEach((insight: any) => {
      expect(insight.department.toLowerCase()).toContain(department.toLowerCase());
    });
  });

  it('should respect limit parameter', async () => {
    const limit = 5;
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ limit })
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeLessThanOrEqual(limit);
  });

  it('should validate limit parameter range', async () => {
    // Test limit too high
    const response1 = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ limit: 200 })
      .set('Authorization', authToken)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('limit'),
    });

    // Test limit too low
    const response2 = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ limit: 0 })
      .set('Authorization', authToken)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('limit'),
    });
  });

  it('should validate status parameter values', async () => {
    const invalidStatus = 'invalid-status';
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ status: invalidStatus })
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('status'),
    });
  });

  it('should validate priority parameter values', async () => {
    const invalidPriority = 'invalid-priority';
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ priority: invalidPriority })
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('priority'),
    });
  });

  it('should return empty array when no insights exist', async () => {
    const newStoreId = 'new-store-no-insights';

    const response = await request(app)
      .get(`/feedback-analysis/insights/${newStoreId}`)
      .set('Authorization', authToken)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should return 403 when user lacks access to store', async () => {
    const unauthorizedStoreId = 'unauthorized-store-id';

    const response = await request(app)
      .get(`/feedback-analysis/insights/${unauthorizedStoreId}`)
      .set('Authorization', authToken)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should handle invalid UUID format for storeId', async () => {
    const invalidStoreId = 'not-a-uuid';

    const response = await request(app)
      .get(`/feedback-analysis/insights/${invalidStoreId}`)
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should include pagination metadata in headers', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({ limit: 10 })
      .set('Authorization', authToken);

    expect(response.header['x-total-count']).toBeDefined();
    expect(response.header['x-limit']).toBe('10');
  });

  it('should maintain response time under 500ms for insights query', async () => {
    const startTime = Date.now();

    await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .set('Authorization', authToken);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(500);
  });

  it('should support combined filtering parameters', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/insights/${testStoreId}`)
      .query({
        status: 'active',
        priority: 'high',
        department: 'kassa',
        limit: 10
      })
      .set('Authorization', authToken)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeLessThanOrEqual(10);

    // All results should match all filters
    response.body.forEach((insight: any) => {
      expect(insight.status).toBe('active');
      expect(['high', 'critical']).toContain(insight.priority);
      expect(insight.department.toLowerCase()).toContain('kassa');
    });
  });
});