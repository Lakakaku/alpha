import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const STAGING_API_URL = process.env.STAGING_API_URL || 'https://staging-api.vocilia.com';

describe('Integration Test: Backend Deployment Health (Scenario 1)', () => {
  let server: any;

  beforeAll(async () => {
    // Integration test setup
  });

  afterAll(async () => {
    // Integration test cleanup
  });

  it('should validate basic health endpoint functionality', async () => {
    const response = await request(STAGING_API_URL)
      .get('/health')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      uptime: expect.any(Number)
    });

    // Validate timestamp format
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  it('should validate detailed health endpoint with performance metrics', async () => {
    const response = await request(STAGING_API_URL)
      .get('/health/detailed')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
      checks: expect.arrayContaining([]),
      performance: expect.any(Object)
    });

    // Validate performance metrics exist and are reasonable
    if (response.body.performance) {
      expect(response.body.performance.avg_response_time_ms).toBeGreaterThan(0);
      expect(response.body.performance.avg_response_time_ms).toBeLessThan(2000); // <2s requirement
    }

    // Validate individual health checks
    response.body.checks.forEach((check: any) => {
      expect(check.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      if (check.response_time_ms) {
        expect(check.response_time_ms).toBeGreaterThan(0);
      }
    });
  });

  it('should validate database connectivity health check', async () => {
    const response = await request(STAGING_API_URL)
      .get('/health/database')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded)$/),
      connection_pool: expect.objectContaining({
        active_connections: expect.any(Number),
        max_connections: expect.any(Number),
        pool_utilization: expect.any(Number)
      })
    });

    // Validate connection pool health
    expect(response.body.connection_pool.pool_utilization).toBeLessThan(80); // Should be <80% for healthy
    expect(response.body.connection_pool.active_connections).toBeGreaterThanOrEqual(0);
    expect(response.body.connection_pool.max_connections).toBeGreaterThan(0);

    // Validate last backup exists
    if (response.body.last_backup) {
      const backupDate = new Date(response.body.last_backup);
      const now = new Date();
      const hoursSinceBackup = (now.getTime() - backupDate.getTime()) / (1000 * 60 * 60);
      expect(hoursSinceBackup).toBeLessThan(25); // Should have backup within 25 hours
    }
  });

  it('should validate background jobs health check', async () => {
    const response = await request(STAGING_API_URL)
      .get('/health/jobs')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded)$/),
      scheduler_running: true // Should be running for healthy status
    });

    // Validate job queue if present
    if (response.body.job_queue) {
      expect(response.body.job_queue.pending_jobs).toBeGreaterThanOrEqual(0);
      expect(response.body.job_queue.failed_jobs).toBeLessThan(10); // Should have <10 failed jobs
    }

    // Validate last payment batch if present
    if (response.body.last_payment_batch) {
      expect(response.body.last_payment_batch.status).toMatch(/^(completed|failed|in_progress)$/);
      expect(response.body.last_payment_batch.processed_count).toBeGreaterThanOrEqual(0);
    }
  });

  it('should meet response time requirements for health endpoints', async () => {
    const endpoints = ['/health', '/health/detailed', '/health/database', '/health/jobs'];
    const maxResponseTimes = [500, 2000, 1000, 1000]; // Different thresholds per endpoint

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      const maxTime = maxResponseTimes[i];
      
      const startTime = Date.now();
      
      await request(STAGING_API_URL)
        .get(endpoint)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(maxTime);
    }
  });

  it('should validate Railway deployment environment variables', async () => {
    // Test that environment-specific endpoints work
    const response = await request(STAGING_API_URL)
      .get('/health/detailed')
      .expect(200);

    // Should have staging-specific configuration
    expect(response.body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.stringContaining('database')
        })
      ])
    );
  });

  it('should validate HTTPS and SSL certificate', async () => {
    // This test validates SSL configuration
    if (STAGING_API_URL.startsWith('https://')) {
      const response = await request(STAGING_API_URL)
        .get('/health')
        .expect(200);

      // If we get here, SSL certificate was valid
      expect(response.status).toBe(200);
    }
  });
});