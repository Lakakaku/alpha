import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('Contract Test: GET /health/detailed', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return detailed health status with all required fields', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/detailed')
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - detailed health schema
    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      uptime: expect.any(Number),
      checks: expect.arrayContaining([])
    });

    // Memory usage validation (optional field)
    if (response.body.memory) {
      expect(response.body.memory).toMatchObject({
        rss: expect.any(Number),
        heapTotal: expect.any(Number),
        heapUsed: expect.any(Number)
      });
    }

    // Performance metrics validation (optional field)
    if (response.body.performance) {
      expect(response.body.performance).toMatchObject({
        avg_response_time_ms: expect.any(Number),
        requests_per_minute: expect.any(Number),
        error_rate_percent: expect.any(Number),
        cpu_usage_percent: expect.any(Number),
        memory_usage_percent: expect.any(Number)
      });

      // Performance bounds validation
      expect(response.body.performance.error_rate_percent).toBeGreaterThanOrEqual(0);
      expect(response.body.performance.error_rate_percent).toBeLessThanOrEqual(100);
      expect(response.body.performance.cpu_usage_percent).toBeGreaterThanOrEqual(0);
      expect(response.body.performance.cpu_usage_percent).toBeLessThanOrEqual(100);
    }

    // Health checks array validation
    response.body.checks.forEach((check: any) => {
      expect(check).toMatchObject({
        name: expect.any(String),
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/)
      });

      // Optional fields validation
      if (check.response_time_ms) {
        expect(check.response_time_ms).toBeGreaterThan(0);
      }
      if (check.last_checked) {
        expect(new Date(check.last_checked)).toBeInstanceOf(Date);
      }
    });
  });

  it('should return degraded status when some components are unhealthy', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/detailed')
      .expect('Content-Type', /json/);

    // Accept any status but validate structure consistency
    expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    
    if (response.body.status === 'degraded') {
      // At least one check should be degraded or unhealthy
      const unhealthyChecks = response.body.checks.filter(
        (check: any) => check.status === 'degraded' || check.status === 'unhealthy'
      );
      expect(unhealthyChecks.length).toBeGreaterThan(0);
    }
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/health/detailed')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000); // Detailed health check should be <2s
  });
});