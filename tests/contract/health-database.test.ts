import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('Contract Test: GET /health/database', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return database health status with connection pool info', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/database')
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - database health schema
    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded)$/),
      connection_pool: expect.objectContaining({
        active_connections: expect.any(Number),
        max_connections: expect.any(Number),
        pool_utilization: expect.any(Number)
      })
    });

    // Connection pool validation
    expect(response.body.connection_pool.active_connections).toBeGreaterThanOrEqual(0);
    expect(response.body.connection_pool.max_connections).toBeGreaterThan(0);
    expect(response.body.connection_pool.pool_utilization).toBeGreaterThanOrEqual(0);
    expect(response.body.connection_pool.pool_utilization).toBeLessThanOrEqual(100);

    // Query performance validation (optional)
    if (response.body.query_performance) {
      expect(response.body.query_performance).toMatchObject({
        avg_response_time_ms: expect.any(Number),
        slow_queries_count: expect.any(Number)
      });
      expect(response.body.query_performance.avg_response_time_ms).toBeGreaterThan(0);
      expect(response.body.query_performance.slow_queries_count).toBeGreaterThanOrEqual(0);
    }

    // Last backup validation (optional)
    if (response.body.last_backup) {
      expect(new Date(response.body.last_backup)).toBeInstanceOf(Date);
    }
  });

  it('should indicate degraded status when connection pool utilization is high', async () => {
    const response = await request(API_BASE_URL)
      .get('/health/database')
      .expect('Content-Type', /json/);

    if (response.body.connection_pool.pool_utilization > 80) {
      expect(response.body.status).toBe('degraded');
    }
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/health/database')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(1000); // Database health check should be <1s
  });
});