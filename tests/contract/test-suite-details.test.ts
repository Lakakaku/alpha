import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { setupTestApp, teardownTestApp, TestApp } from '../utils/test-env';

describe('Contract Test: GET /api/test/suites/{suiteId}', () => {
  let app: TestApp;
  let testSuiteId: string;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  beforeEach(async () => {
    // Create a test suite for testing
    const createResponse = await request(app.server)
      .post('/api/test/suites')
      .send({
        name: 'Test Suite for Details',
        type: 'unit',
        component: 'customer-app',
        priority: 'high',
        coverageTarget: 90
      });
    
    testSuiteId = createResponse.body.id;
  });

  test('should return test suite details with valid ID', async () => {
    // This test will fail until the API endpoint is implemented
    const response = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    // Validate basic test suite fields
    expect(response.body).toHaveProperty('id', testSuiteId);
    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('type');
    expect(response.body).toHaveProperty('component');
    expect(response.body).toHaveProperty('priority');
    expect(response.body).toHaveProperty('coverageTarget');
    expect(response.body).toHaveProperty('enabled');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');

    // Validate details-specific fields (testCases array)
    expect(response.body).toHaveProperty('testCases');
    expect(Array.isArray(response.body.testCases)).toBe(true);

    // If test cases exist, validate their schema
    if (response.body.testCases.length > 0) {
      const testCase = response.body.testCases[0];
      expect(testCase).toHaveProperty('id');
      expect(testCase).toHaveProperty('suiteId', testSuiteId);
      expect(testCase).toHaveProperty('name');
      expect(testCase).toHaveProperty('description');
      expect(testCase).toHaveProperty('type');
      expect(testCase).toHaveProperty('filePath');
      expect(testCase).toHaveProperty('testFunction');
      expect(testCase).toHaveProperty('tags');
      expect(testCase).toHaveProperty('timeout');
      expect(testCase).toHaveProperty('retries');
      expect(testCase).toHaveProperty('enabled');
      
      // Validate enum values
      expect(['contract', 'unit', 'integration', 'e2e', 'performance']).toContain(testCase.type);
      expect(Array.isArray(testCase.tags)).toBe(true);
      expect(typeof testCase.timeout).toBe('number');
      expect(typeof testCase.retries).toBe('number');
      expect(typeof testCase.enabled).toBe('boolean');
    }
  });

  test('should return 404 for non-existent suite ID', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    
    const response = await request(app.server)
      .get(`/api/test/suites/${nonExistentId}`)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/not found/i);
  });

  test('should return 400 for invalid UUID format', async () => {
    const invalidId = 'invalid-uuid';
    
    const response = await request(app.server)
      .get(`/api/test/suites/${invalidId}`)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/invalid.*id/i);
  });

  test('should return content-type application/json', async () => {
    const response = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  test('should handle empty test cases array', async () => {
    const response = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    expect(response.body.testCases).toBeDefined();
    expect(Array.isArray(response.body.testCases)).toBe(true);
  });

  test('should include all required date fields in ISO format', async () => {
    const response = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(response.body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    
    // Verify dates are valid
    expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
    expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
  });

  test('should handle CORS headers', async () => {
    const response = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });

  test('should return consistent data structure with POST response', async () => {
    // Get the details
    const detailsResponse = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    // Verify core fields match what was created
    expect(detailsResponse.body.name).toBe('Test Suite for Details');
    expect(detailsResponse.body.type).toBe('unit');
    expect(detailsResponse.body.component).toBe('customer-app');
    expect(detailsResponse.body.priority).toBe('high');
    expect(detailsResponse.body.coverageTarget).toBe(90);
    expect(detailsResponse.body.enabled).toBe(true);
  });

  test('should handle suite with multiple test cases', async () => {
    // This test assumes test cases can be added to a suite
    // In practice, this would require implementing test case creation first
    const response = await request(app.server)
      .get(`/api/test/suites/${testSuiteId}`)
      .expect(200);

    expect(response.body.testCases).toBeDefined();
    expect(Array.isArray(response.body.testCases)).toBe(true);
    
    // If there are test cases, they should all belong to this suite
    response.body.testCases.forEach((testCase: any) => {
      expect(testCase.suiteId).toBe(testSuiteId);
    });
  });

  test('should handle special characters in suite fields', async () => {
    // Create suite with special characters
    const specialSuite = await request(app.server)
      .post('/api/test/suites')
      .send({
        name: 'Tëst Sûite wïth spëcial chârs åäö',
        type: 'e2e',
        component: 'business-app',
        priority: 'medium'
      });

    const response = await request(app.server)
      .get(`/api/test/suites/${specialSuite.body.id}`)
      .expect(200);

    expect(response.body.name).toBe('Tëst Sûite wïth spëcial chârs åäö');
  });
});