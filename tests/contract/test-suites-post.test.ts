import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestApp, teardownTestApp, TestApp } from '../utils/test-env';

describe('Contract Test: POST /api/test/suites', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await teardownTestApp();
  });

  const validTestSuite = {
    name: 'Customer QR Code Tests',
    type: 'unit',
    component: 'customer-app',
    priority: 'high',
    coverageTarget: 85
  };

  test('should create test suite with valid data', async () => {
    // This test will fail until the API endpoint is implemented
    const response = await request(app.server)
      .post('/api/test/suites')
      .send(validTestSuite)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(validTestSuite.name);
    expect(response.body.type).toBe(validTestSuite.type);
    expect(response.body.component).toBe(validTestSuite.component);
    expect(response.body.priority).toBe(validTestSuite.priority);
    expect(response.body.coverageTarget).toBe(validTestSuite.coverageTarget);
    expect(response.body.enabled).toBe(true); // Default value
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
  });

  test('should create test suite with minimal required fields', async () => {
    const minimalSuite = {
      name: 'Minimal Test Suite',
      type: 'integration',
      component: 'backend-api'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(minimalSuite)
      .expect(201);

    expect(response.body.name).toBe(minimalSuite.name);
    expect(response.body.type).toBe(minimalSuite.type);
    expect(response.body.component).toBe(minimalSuite.component);
    expect(response.body.priority).toBe('medium'); // Default value
    expect(response.body.coverageTarget).toBe(80); // Default value
    expect(response.body.enabled).toBe(true); // Default value
  });

  test('should reject request without required name field', async () => {
    const invalidSuite = {
      type: 'unit',
      component: 'customer-app'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/name.*required/i);
  });

  test('should reject request without required type field', async () => {
    const invalidSuite = {
      name: 'Test Suite',
      component: 'customer-app'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/type.*required/i);
  });

  test('should reject request without required component field', async () => {
    const invalidSuite = {
      name: 'Test Suite',
      type: 'unit'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/component.*required/i);
  });

  test('should reject invalid type enum value', async () => {
    const invalidSuite = {
      ...validTestSuite,
      type: 'invalid-type'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/type.*invalid/i);
  });

  test('should reject invalid priority enum value', async () => {
    const invalidSuite = {
      ...validTestSuite,
      priority: 'invalid-priority'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/priority.*invalid/i);
  });

  test('should reject coverage target below 0', async () => {
    const invalidSuite = {
      ...validTestSuite,
      coverageTarget: -10
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/coverageTarget.*minimum/i);
  });

  test('should reject coverage target above 100', async () => {
    const invalidSuite = {
      ...validTestSuite,
      coverageTarget: 110
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(invalidSuite)
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/coverageTarget.*maximum/i);
  });

  test('should handle duplicate test suite names', async () => {
    // First creation should succeed
    await request(app.server)
      .post('/api/test/suites')
      .send(validTestSuite)
      .expect(201);

    // Second creation with same name should fail
    const response = await request(app.server)
      .post('/api/test/suites')
      .send(validTestSuite)
      .expect(409);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/already exists/i);
  });

  test('should reject empty request body', async () => {
    await request(app.server)
      .post('/api/test/suites')
      .send({})
      .expect(400);
  });

  test('should reject malformed JSON', async () => {
    await request(app.server)
      .post('/api/test/suites')
      .send('invalid-json')
      .expect(400);
  });

  test('should return content-type application/json', async () => {
    const response = await request(app.server)
      .post('/api/test/suites')
      .send(validTestSuite)
      .expect(201);

    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  test('should validate name length constraints', async () => {
    // Test empty name
    const emptyNameSuite = { ...validTestSuite, name: '' };
    await request(app.server)
      .post('/api/test/suites')
      .send(emptyNameSuite)
      .expect(400);

    // Test very long name
    const longNameSuite = { ...validTestSuite, name: 'a'.repeat(256) };
    await request(app.server)
      .post('/api/test/suites')
      .send(longNameSuite)
      .expect(400);
  });

  test('should handle special characters in name', async () => {
    const specialCharSuite = {
      ...validTestSuite,
      name: 'Test Suite with åäö & special chars!'
    };

    const response = await request(app.server)
      .post('/api/test/suites')
      .send(specialCharSuite)
      .expect(201);

    expect(response.body.name).toBe(specialCharSuite.name);
  });
});