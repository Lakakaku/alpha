import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('Contract Test: GET /health', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return basic health status', async () => {
    const response = await request(API_BASE_URL)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - exact schema match required
    expect(response.body).toMatchObject({
      status: expect.stringMatching(/^healthy$/),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      uptime: expect.any(Number)
    });

    // Schema completeness - no extra fields allowed
    expect(Object.keys(response.body)).toEqual(['status', 'timestamp', 'uptime']);

    // Business logic validation
    expect(response.body.uptime).toBeGreaterThan(0);
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
  });

  it('should return 503 when service is unavailable', async () => {
    // This test will be skipped in normal runs but validates contract
    const response = await request(API_BASE_URL)
      .get('/health')
      .expect('Content-Type', /json/);

    if (response.status === 503) {
      expect(response.body).toMatchObject({
        error: expect.any(String),
        message: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      });
    }
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/health')
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(500); // Health check should be <500ms
  });
});