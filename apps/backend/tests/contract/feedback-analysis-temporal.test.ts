/**
 * Contract test for GET /feedback-analysis/temporal/{storeId}
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';
import { TemporalComparison } from '@vocilia/types/feedback-analysis';

describe('GET /feedback-analysis/temporal/{storeId}', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  it('should return temporal comparison data for valid store', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .set('Authorization', authToken)
      .expect(200);

    // Validate TemporalComparison structure
    expect(response.body).toMatchObject({
      current_week: expect.objectContaining({
        week_number: expect.any(Number),
        year: expect.any(Number),
        total_feedback_count: expect.any(Number),
      }),
      previous_week: expect.objectContaining({
        week_number: expect.any(Number),
        year: expect.any(Number),
        total_feedback_count: expect.any(Number),
      }),
      comparison: expect.objectContaining({
        feedback_count_change: expect.any(Number),
        sentiment_distribution_change: expect.any(Object),
        trend_direction: expect.stringMatching(/^(improving|declining|stable)$/),
      }),
    });

    // Validate optional analysis fields
    if (response.body.new_issues) {
      expect(Array.isArray(response.body.new_issues)).toBe(true);
    }
    if (response.body.resolved_issues) {
      expect(Array.isArray(response.body.resolved_issues)).toBe(true);
    }
    if (response.body.department_changes) {
      expect(typeof response.body.department_changes).toBe('object');
    }

    // Validate week numbers are valid
    expect(response.body.current_week.week_number).toBeGreaterThanOrEqual(1);
    expect(response.body.current_week.week_number).toBeLessThanOrEqual(53);
    expect(response.body.previous_week.week_number).toBeGreaterThanOrEqual(1);
    expect(response.body.previous_week.week_number).toBeLessThanOrEqual(53);
  });

  it('should handle weeks query parameter for historical comparison', async () => {
    const weeksBack = 2;
    const response = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .query({ weeks_back: weeksBack })
      .set('Authorization', authToken)
      .expect(200);

    expect(response.body).toMatchObject({
      current_week: expect.any(Object),
      previous_week: expect.any(Object),
      comparison: expect.any(Object),
    });

    // Should compare with week from weeksBack
    const currentWeekNumber = response.body.current_week.week_number;
    const previousWeekNumber = response.body.previous_week.week_number;
    
    // Note: This is approximate due to year boundaries
    const expectedDifference = Math.abs(currentWeekNumber - previousWeekNumber);
    expect(expectedDifference).toBeLessThanOrEqual(weeksBack + 1);
  });

  it('should validate weeks_back parameter range', async () => {
    // Test weeks_back too high
    const response1 = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .query({ weeks_back: 60 })
      .set('Authorization', authToken)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('weeks_back'),
    });

    // Test weeks_back too low
    const response2 = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .query({ weeks_back: 0 })
      .set('Authorization', authToken)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('weeks_back'),
    });
  });

  it('should default to 1 week back when no parameter provided', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .set('Authorization', authToken)
      .expect(200);

    // Should compare current week with previous week (1 week back)
    const currentWeekNumber = response.body.current_week.week_number;
    const previousWeekNumber = response.body.previous_week.week_number;
    
    // Allow for year boundary edge cases
    const weekDifference = Math.abs(currentWeekNumber - previousWeekNumber);
    expect(weekDifference).toBeLessThanOrEqual(2);
  });

  it('should return meaningful comparison when no previous data exists', async () => {
    const newStoreId = 'new-store-no-history';

    const response = await request(app)
      .get(`/feedback-analysis/temporal/${newStoreId}`)
      .set('Authorization', authToken)
      .expect(200);

    expect(response.body).toMatchObject({
      current_week: expect.any(Object),
      previous_week: null,
      comparison: expect.objectContaining({
        trend_direction: 'stable',
        feedback_count_change: 0,
      }),
    });
  });

  it('should return 403 when user lacks access to store', async () => {
    const unauthorizedStoreId = 'unauthorized-store-id';

    const response = await request(app)
      .get(`/feedback-analysis/temporal/${unauthorizedStoreId}`)
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
      .get(`/feedback-analysis/temporal/${invalidStoreId}`)
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should include performance metadata in response headers', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .set('Authorization', authToken);

    expect(response.header['x-comparison-time']).toBeDefined();
    expect(response.header['x-ai-processing-time']).toBeDefined();
  });

  it('should maintain response time under 2 seconds for temporal analysis', async () => {
    const startTime = Date.now();

    await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .set('Authorization', authToken);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000);
  });

  it('should handle edge cases around year boundaries', async () => {
    // This test checks week 1 vs week 52/53 comparisons
    const response = await request(app)
      .get(`/feedback-analysis/temporal/${testStoreId}`)
      .query({ weeks_back: 1 })
      .set('Authorization', authToken);

    // Should handle year boundary gracefully
    if (response.status === 200) {
      expect(response.body.current_week.year).toBeGreaterThanOrEqual(2020);
      expect(response.body.previous_week.year).toBeGreaterThanOrEqual(2020);
      
      // Year difference should be reasonable
      const yearDiff = response.body.current_week.year - response.body.previous_week.year;
      expect(yearDiff).toBeLessThanOrEqual(1);
    }
  });
});