import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';

describe('Contract Test: POST /api/admin/deployment/rollback', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should initiate rollback with valid request', async () => {
    const rollbackRequest = {
      target_deployment_id: 'test-deployment-123',
      environment: 'staging',
      app: 'backend',
      reason: 'Contract test rollback'
    };

    const response = await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(rollbackRequest)
      .expect('Content-Type', /json/)
      .expect(202);

    // Contract validation - rollback initiation response
    expect(response.body).toMatchObject({
      rollback_id: expect.any(String),
      status: 'initiated'
    });

    if (response.body.estimated_completion) {
      expect(new Date(response.body.estimated_completion)).toBeInstanceOf(Date);
      
      // Should be within 15 minutes (900 seconds)
      const estimatedTime = new Date(response.body.estimated_completion);
      const now = new Date();
      const diffMinutes = (estimatedTime.getTime() - now.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThanOrEqual(15);
    }

    expect(response.body.rollback_id).toMatch(/^[a-zA-Z0-9\-_]+$/);
  });

  it('should validate required fields', async () => {
    const incompleteRequest = {
      target_deployment_id: 'test-deployment-123',
      environment: 'production'
      // Missing app and reason
    };

    const response = await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(incompleteRequest)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toMatchObject({
      error: expect.any(String),
      message: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    });
  });

  it('should validate environment enum values', async () => {
    const invalidRequest = {
      target_deployment_id: 'test-deployment-123',
      environment: 'invalid-env',
      app: 'backend',
      reason: 'Test invalid environment'
    };

    await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(invalidRequest)
      .expect(400);
  });

  it('should validate app enum values', async () => {
    const invalidRequest = {
      target_deployment_id: 'test-deployment-123',
      environment: 'staging',
      app: 'invalid-app',
      reason: 'Test invalid app'
    };

    await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(invalidRequest)
      .expect(400);
  });

  it('should require admin authentication', async () => {
    const rollbackRequest = {
      target_deployment_id: 'test-deployment-123',
      environment: 'staging',
      app: 'backend',
      reason: 'Unauthorized test'
    };

    await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .send(rollbackRequest)
      .expect(401);
  });

  it('should respond within performance requirements', async () => {
    const rollbackRequest = {
      target_deployment_id: 'test-deployment-123',
      environment: 'staging',
      app: 'backend',
      reason: 'Performance test rollback'
    };

    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(rollbackRequest)
      .expect(202);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000); // Rollback initiation should be <2s
  });
});