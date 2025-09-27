import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('Contract Test: GET /health/jobs', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return job system health status', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/jobs')
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - jobs health schema
    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded)$/),
      scheduler_running: expect.any(Boolean)
    });

    // Last payment batch validation (optional)
    if (response.body.last_payment_batch) {
      expect(response.body.last_payment_batch).toMatchObject({
        batch_id: expect.any(String),
        completed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        status: expect.stringMatching(/^(completed|failed|in_progress)$/),
        processed_count: expect.any(Number)
      });

      expect(response.body.last_payment_batch.processed_count).toBeGreaterThanOrEqual(0);
      expect(new Date(response.body.last_payment_batch.completed_at)).toBeInstanceOf(Date);
    }

    // Job queue validation (optional)
    if (response.body.job_queue) {
      expect(response.body.job_queue).toMatchObject({
        pending_jobs: expect.any(Number),
        failed_jobs: expect.any(Number)
      });

      expect(response.body.job_queue.pending_jobs).toBeGreaterThanOrEqual(0);
      expect(response.body.job_queue.failed_jobs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should indicate degraded status when scheduler is not running', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/jobs')
      .expect('Content-Type', /json/);

    if (!response.body.scheduler_running) {
      expect(response.body.status).toBe('degraded');
    }
  });

  it('should indicate degraded status when there are too many failed jobs', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/jobs')
      .expect('Content-Type', /json/);

    if (response.body.job_queue && response.body.job_queue.failed_jobs > 10) {
      expect(response.body.status).toBe('degraded');
    }
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/health/jobs')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(1000); // Jobs health check should be <1s
  });
});