/**
 * Contract test for POST /feedback-analysis/reports/{storeId}/generate
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('POST /feedback-analysis/reports/{storeId}/generate', () => {
  const testStoreId = 'test-store-id-123';
  const authToken = 'Bearer test-jwt-token';

  const validGenerationRequest = {
    week_number: 38,
    year: 2025,
    force_regenerate: false,
  };

  it('should initiate report generation for valid request', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(validGenerationRequest)
      .expect(202);

    // Should return job details for async processing
    expect(response.body).toMatchObject({
      job_id: expect.any(String),
      store_id: testStoreId,
      week_number: validGenerationRequest.week_number,
      year: validGenerationRequest.year,
      status: 'queued',
      created_at: expect.any(String),
    });

    // Should include estimated completion time
    expect(response.body.estimated_completion_ms).toBeGreaterThan(0);
    expect(response.body.estimated_completion_ms).toBeLessThan(300000); // Max 5 minutes

    // Should provide status checking URL
    expect(response.body.status_url).toBeDefined();
    expect(response.body.status_url).toContain(`/feedback-analysis/status/${response.body.job_id}`);
  });

  it('should handle current week generation without parameters', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send({})
      .expect(202);

    // Should use current week and year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    expect(response.body).toMatchObject({
      job_id: expect.any(String),
      store_id: testStoreId,
      year: currentYear,
      status: 'queued',
    });

    // Week number should be reasonable for current date
    expect(response.body.week_number).toBeGreaterThanOrEqual(1);
    expect(response.body.week_number).toBeLessThanOrEqual(53);
  });

  it('should force regeneration when requested', async () => {
    const forceRegenerateRequest = {
      ...validGenerationRequest,
      force_regenerate: true,
    };

    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(forceRegenerateRequest)
      .expect(202);

    expect(response.body).toMatchObject({
      job_id: expect.any(String),
      store_id: testStoreId,
      force_regenerate: true,
      status: 'queued',
    });
  });

  it('should return 409 when report already exists and force_regenerate is false', async () => {
    const existingReportRequest = {
      week_number: 37, // Assume this week already has a report
      year: 2025,
      force_regenerate: false,
    };

    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(existingReportRequest)
      .expect(409);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('already exists'),
      existing_report_id: expect.any(String),
    });
  });

  it('should validate week_number parameter range', async () => {
    // Test invalid week number (too high)
    const invalidWeekRequest1 = {
      week_number: 54,
      year: 2025,
    };

    const response1 = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(invalidWeekRequest1)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('week_number'),
    });

    // Test invalid week number (too low)
    const invalidWeekRequest2 = {
      week_number: 0,
      year: 2025,
    };

    const response2 = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(invalidWeekRequest2)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('week_number'),
    });
  });

  it('should validate year parameter range', async () => {
    // Test year too far in past
    const invalidYearRequest1 = {
      week_number: 1,
      year: 2019,
    };

    const response1 = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(invalidYearRequest1)
      .expect(400);

    expect(response1.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('year'),
    });

    // Test year too far in future
    const invalidYearRequest2 = {
      week_number: 1,
      year: 2030,
    };

    const response2 = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(invalidYearRequest2)
      .expect(400);

    expect(response2.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('year'),
    });
  });

  it('should handle insufficient feedback data gracefully', async () => {
    const earlyWeekRequest = {
      week_number: 1,
      year: 2025, // Assume minimal data
    };

    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(earlyWeekRequest);

    if (response.status === 202) {
      expect(response.body.estimated_completion_ms).toBeLessThan(30000); // Should be fast with little data
    } else if (response.status === 400) {
      expect(response.body.message).toContain('insufficient data');
    }
  });

  it('should return 403 when user lacks access to store', async () => {
    const unauthorizedStoreId = 'unauthorized-store-id';

    const response = await request(app)
      .post(`/feedback-analysis/reports/${unauthorizedStoreId}/generate`)
      .set('Authorization', authToken)
      .send(validGenerationRequest)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should handle invalid UUID format for storeId', async () => {
    const invalidStoreId = 'not-a-uuid';

    const response = await request(app)
      .post(`/feedback-analysis/reports/${invalidStoreId}/generate`)
      .set('Authorization', authToken)
      .send(validGenerationRequest)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should handle malformed JSON request body', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .set('Content-Type', 'application/json')
      .send('{\"week_number\": invalid json}')
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('JSON'),
    });
  });

  it('should queue reports for batch processing', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(validGenerationRequest)
      .expect(202);

    // Should indicate queued status
    expect(response.body.status).toBe('queued');
    expect(response.body.queue_position).toBeGreaterThanOrEqual(1);
  });

  it('should handle rate limiting for excessive requests', async () => {
    // Create multiple rapid requests
    const rapidRequests = Array(10).fill(0).map((_, index) => 
      request(app)
        .post(`/feedback-analysis/reports/${testStoreId}/generate`)
        .set('Authorization', authToken)
        .send({
          week_number: 30 + index,
          year: 2025,
        })
    );

    const responses = await Promise.all(rapidRequests);

    // Some should succeed, some might be rate limited
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    if (rateLimitedResponses.length > 0) {
      rateLimitedResponses.forEach(response => {
        expect(response.body).toMatchObject({
          code: expect.any(String),
          message: expect.stringContaining('rate limit'),
        });
      });
    }
  });

  it('should include AI processing requirements in job metadata', async () => {
    const response = await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(validGenerationRequest)
      .expect(202);

    // Should indicate AI processing steps
    expect(response.body.processing_steps).toBeDefined();
    expect(Array.isArray(response.body.processing_steps)).toBe(true);
    
    const expectedSteps = ['sentiment_analysis', 'categorization', 'insight_generation', 'report_compilation'];
    expectedSteps.forEach(step => {
      expect(response.body.processing_steps).toContain(step);
    });
  });

  it('should maintain response time under 100ms for job creation', async () => {
    const startTime = Date.now();

    await request(app)
      .post(`/feedback-analysis/reports/${testStoreId}/generate`)
      .set('Authorization', authToken)
      .send(validGenerationRequest);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(100);
  });
});