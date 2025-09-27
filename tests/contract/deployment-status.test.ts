import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';

describe('Contract Test: GET /api/admin/deployment/status', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return current deployment status for all environments', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/deployment/status')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - deployment status schema
    expect(response.body).toMatchObject({
      environments: expect.arrayContaining([]),
      last_updated: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    });

    expect(new Date(response.body.last_updated)).toBeInstanceOf(Date);

    // Environment validation
    response.body.environments.forEach((env: any) => {
      expect(env).toMatchObject({
        environment: expect.stringMatching(/^(production|staging)$/),
        apps: expect.arrayContaining([]),
        overall_health: expect.stringMatching(/^(healthy|degraded|unhealthy)$/)
      });

      if (env.last_deployment) {
        expect(new Date(env.last_deployment)).toBeInstanceOf(Date);
      }

      // App status validation
      env.apps.forEach((app: any) => {
        expect(app).toMatchObject({
          name: expect.stringMatching(/^(backend|customer|business|admin)$/),
          platform: expect.stringMatching(/^(railway|vercel)$/),
          status: expect.stringMatching(/^(running|building|deploying|failed|stopped)$/),
          version: expect.any(String)
        });

        if (app.deployment_id) {
          expect(app.deployment_id).toMatch(/^[a-zA-Z0-9\-_]+$/);
        }

        if (app.domain) {
          expect(app.domain).toMatch(/^https?:\/\/[a-zA-Z0-9\-\.]+/);
        }

        if (app.ssl_status) {
          expect(app.ssl_status).toMatch(/^(active|pending|expired|failed)$/);
        }

        if (app.last_deployed) {
          expect(new Date(app.last_deployed)).toBeInstanceOf(Date);
        }

        if (app.rollback_available !== undefined) {
          expect(app.rollback_available).toEqual(expect.any(Boolean));
        }
      });
    });
  });

  it('should require admin authentication', async () => {
    await request(API_BASE_URL)
      .get('/api/admin/deployment/status')
      .expect(401);
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/api/admin/deployment/status')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000); // Admin API should be <2s
  });
});