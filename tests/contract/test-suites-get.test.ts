import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestApp, teardownTestApp, TestApp } from '../utils/test-env';

describe('Contract Test: GET /api/test/suites', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  test('should return empty array when no test suites exist', async () => {
    const response = await request(app.server)
      .get('/api/test/suites')
      .expect(200);

    expect(response.body).toEqual([]);
  });

  test('should return test suites with valid schema', async () => {
    // This test will fail until the API endpoint is implemented
    const response = await request(app.server)
      .get('/api/test/suites')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    
    // If suites exist, validate schema
    if (response.body.length > 0) {
      const suite = response.body[0];
      expect(suite).toHaveProperty('id');
      expect(suite).toHaveProperty('name');
      expect(suite).toHaveProperty('type');
      expect(suite).toHaveProperty('component');
      expect(suite).toHaveProperty('priority');
      expect(suite).toHaveProperty('coverageTarget');
      expect(suite).toHaveProperty('enabled');
      expect(suite).toHaveProperty('createdAt');
      expect(suite).toHaveProperty('updatedAt');

      // Validate enum values
      expect(['unit', 'integration', 'e2e', 'performance']).toContain(suite.type);
      expect(['critical', 'high', 'medium', 'low']).toContain(suite.priority);
      expect(typeof suite.enabled).toBe('boolean');
      expect(typeof suite.coverageTarget).toBe('number');
      expect(suite.coverageTarget).toBeGreaterThanOrEqual(0);
      expect(suite.coverageTarget).toBeLessThanOrEqual(100);
    }
  });

  test('should filter by component query parameter', async () => {
    const response = await request(app.server)
      .get('/api/test/suites?component=customer-app')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((suite: any) => {
      expect(suite.component).toBe('customer-app');
    });
  });

  test('should filter by type query parameter', async () => {
    const response = await request(app.server)
      .get('/api/test/suites?type=unit')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((suite: any) => {
      expect(suite.type).toBe('unit');
    });
  });

  test('should filter by enabled query parameter', async () => {
    const response = await request(app.server)
      .get('/api/test/suites?enabled=true')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((suite: any) => {
      expect(suite.enabled).toBe(true);
    });
  });

  test('should handle multiple query parameters', async () => {
    const response = await request(app.server)
      .get('/api/test/suites?component=backend-api&type=integration&enabled=true')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    response.body.forEach((suite: any) => {
      expect(suite.component).toBe('backend-api');
      expect(suite.type).toBe('integration');
      expect(suite.enabled).toBe(true);
    });
  });

  test('should reject invalid component values', async () => {
    await request(app.server)
      .get('/api/test/suites?component=invalid-component')
      .expect(400);
  });

  test('should reject invalid type values', async () => {
    await request(app.server)
      .get('/api/test/suites?type=invalid-type')
      .expect(400);
  });

  test('should handle enabled parameter with boolean conversion', async () => {
    // Test string "false"
    const response1 = await request(app.server)
      .get('/api/test/suites?enabled=false')
      .expect(200);

    expect(Array.isArray(response1.body)).toBe(true);

    // Test string "true"
    const response2 = await request(app.server)
      .get('/api/test/suites?enabled=true')
      .expect(200);

    expect(Array.isArray(response2.body)).toBe(true);
  });

  test('should return content-type application/json', async () => {
    const response = await request(app.server)
      .get('/api/test/suites')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  test('should handle CORS headers', async () => {
    const response = await request(app.server)
      .get('/api/test/suites')
      .expect(200);

    // Verify CORS headers are present (assuming CORS is configured)
    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });
});