/**
 * Contract test for GET /feedback-analysis/status/{jobId}
 * Feature: 008-step-2-6
 * This test MUST FAIL initially (TDD approach)
 */

import request from 'supertest';
import { app } from '../../src/app';

describe('GET /feedback-analysis/status/{jobId}', () => {
  const testJobId = 'job-id-123';
  const authToken = 'Bearer test-jwt-token';

  it('should return job status for valid job ID', async () => {
    const response = await request(app)
      .get(`/feedback-analysis/status/${testJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    // Validate job status structure
    expect(response.body).toMatchObject({
      job_id: testJobId,
      status: expect.stringMatching(/^(queued|processing|completed|failed|cancelled)$/),
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });

    // Validate optional progress fields
    if (response.body.progress_percentage !== undefined) {
      expect(response.body.progress_percentage).toBeGreaterThanOrEqual(0);
      expect(response.body.progress_percentage).toBeLessThanOrEqual(100);
    }

    if (response.body.current_step) {
      expect(typeof response.body.current_step).toBe('string');
    }

    if (response.body.estimated_completion_ms) {
      expect(response.body.estimated_completion_ms).toBeGreaterThan(0);
    }

    // Validate timestamps
    const createdAt = new Date(response.body.created_at);
    const updatedAt = new Date(response.body.updated_at);
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
  });

  it('should return completed status with result reference', async () => {
    const completedJobId = 'completed-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${completedJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'completed') {
      expect(response.body).toMatchObject({
        result_url: expect.any(String),
        completed_at: expect.any(String),
        processing_time_ms: expect.any(Number),
      });

      // Result URL should point to the generated report
      expect(response.body.result_url).toContain('/feedback-analysis/reports/');
      
      // Processing time should be reasonable
      expect(response.body.processing_time_ms).toBeGreaterThan(0);
      expect(response.body.processing_time_ms).toBeLessThan(300000); // Max 5 minutes
    }
  });

  it('should return processing status with progress details', async () => {
    const processingJobId = 'processing-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${processingJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'processing') {
      expect(response.body).toMatchObject({
        progress_percentage: expect.any(Number),
        current_step: expect.any(String),
        estimated_completion_ms: expect.any(Number),
      });

      // Progress should be meaningful
      expect(response.body.progress_percentage).toBeGreaterThan(0);
      expect(response.body.progress_percentage).toBeLessThan(100);

      // Current step should be from expected processing steps
      const validSteps = ['sentiment_analysis', 'categorization', 'insight_generation', 'report_compilation'];
      expect(validSteps).toContain(response.body.current_step);
    }
  });

  it('should return failed status with error details', async () => {
    const failedJobId = 'failed-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${failedJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'failed') {
      expect(response.body).toMatchObject({
        error_code: expect.any(String),
        error_message: expect.any(String),
        failed_at: expect.any(String),
      });

      // Error information should be informative
      expect(response.body.error_message.length).toBeGreaterThan(10);
      
      // Should suggest retry if applicable
      if (response.body.retryable !== undefined) {
        expect(typeof response.body.retryable).toBe('boolean');
      }
    }
  });

  it('should return queued status with position information', async () => {
    const queuedJobId = 'queued-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${queuedJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'queued') {
      expect(response.body).toMatchObject({
        queue_position: expect.any(Number),
        estimated_start_ms: expect.any(Number),
      });

      // Queue position should be reasonable
      expect(response.body.queue_position).toBeGreaterThanOrEqual(1);
      expect(response.body.queue_position).toBeLessThanOrEqual(1000);

      // Estimated start should be in the future
      expect(response.body.estimated_start_ms).toBeGreaterThan(0);
    }
  });

  it('should return 404 for non-existent job ID', async () => {
    const nonExistentJobId = 'non-existent-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${nonExistentJobId}`)
      .set('Authorization', authToken)
      .expect(404);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('not found'),
    });
  });

  it('should return 403 when user lacks access to job', async () => {
    const unauthorizedJobId = 'unauthorized-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${unauthorizedJobId}`)
      .set('Authorization', authToken)
      .expect(403);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
    });
  });

  it('should handle invalid UUID format for jobId', async () => {
    const invalidJobId = 'not-a-uuid';

    const response = await request(app)
      .get(`/feedback-analysis/status/${invalidJobId}`)
      .set('Authorization', authToken)
      .expect(400);

    expect(response.body).toMatchObject({
      code: expect.any(String),
      message: expect.stringContaining('invalid'),
    });
  });

  it('should include real-time progress updates', async () => {
    const activeJobId = 'active-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${activeJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    // Should include real-time update mechanism
    expect(response.header['x-poll-interval']).toBeDefined();
    expect(response.header['x-supports-sse']).toBeDefined();

    // Poll interval should be reasonable
    const pollInterval = parseInt(response.header['x-poll-interval']);
    expect(pollInterval).toBeGreaterThanOrEqual(1000); // At least 1 second
    expect(pollInterval).toBeLessThanOrEqual(30000); // At most 30 seconds
  });

  it('should provide job cancellation capability for queued jobs', async () => {
    const queuedJobId = 'queued-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${queuedJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'queued') {
      expect(response.body.cancellable).toBe(true);
      expect(response.body.cancel_url).toBeDefined();
      expect(response.body.cancel_url).toContain(`/feedback-analysis/status/${queuedJobId}/cancel`);
    }
  });

  it('should include resource usage information for processing jobs', async () => {
    const processingJobId = 'processing-job-id';

    const response = await request(app)
      .get(`/feedback-analysis/status/${processingJobId}`)
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'processing') {
      // Should include performance metrics
      if (response.body.resources) {
        expect(response.body.resources).toMatchObject({
          ai_api_calls: expect.any(Number),
          processing_time_ms: expect.any(Number),
        });
      }
    }
  });

  it('should maintain response time under 50ms for status checks', async () => {
    const startTime = Date.now();

    await request(app)
      .get(`/feedback-analysis/status/${testJobId}`)
      .set('Authorization', authToken);

    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(50);
  });

  it('should handle high frequency polling gracefully', async () => {
    // Simulate rapid polling
    const rapidRequests = Array(20).fill(0).map(() =>
      request(app)
        .get(`/feedback-analysis/status/${testJobId}`)
        .set('Authorization', authToken)
    );

    const responses = await Promise.all(rapidRequests);

    // All requests should complete
    responses.forEach(response => {
      expect([200, 404, 403]).toContain(response.status);
    });

    // Should not hit rate limits for status checks
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBe(0);
  });

  it('should provide historical job logs for completed jobs', async () => {
    const completedJobId = 'completed-job-with-logs';

    const response = await request(app)
      .get(`/feedback-analysis/status/${completedJobId}`)
      .query({ include_logs: 'true' })
      .set('Authorization', authToken)
      .expect(200);

    if (response.body.status === 'completed' && response.body.logs) {
      expect(Array.isArray(response.body.logs)).toBe(true);
      
      response.body.logs.forEach((log: any) => {
        expect(log).toMatchObject({
          timestamp: expect.any(String),
          level: expect.stringMatching(/^(info|warn|error|debug)$/),
          message: expect.any(String),
        });
      });
    }
  });
});