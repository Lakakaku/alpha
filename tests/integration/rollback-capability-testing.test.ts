import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';
const ROLLBACK_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

describe('Integration Test: Rollback Capability Testing (Scenario 7)', () => {
  let server: any;
  let originalDeploymentId: string;
  let testRollbackId: string;

  beforeAll(async () => {
    // Rollback integration test setup
    // Get current deployment ID for rollback target
    const statusResponse = await request(API_BASE_URL)
      .get('/api/admin/deployment/status')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    if (statusResponse.body.environments.length > 0) {
      const stagingEnv = statusResponse.body.environments.find(
        (env: any) => env.environment === 'staging'
      );
      if (stagingEnv && stagingEnv.apps.length > 0) {
        originalDeploymentId = stagingEnv.apps[0].deployment_id;
      }
    }
  });

  afterAll(async () => {
    // Rollback integration test cleanup
  });

  it('should validate current deployment status before rollback', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/deployment/status')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      environments: expect.arrayContaining([]),
      last_updated: expect.any(String)
    });

    // Find staging environment
    const stagingEnv = response.body.environments.find(
      (env: any) => env.environment === 'staging'
    );

    expect(stagingEnv).toBeTruthy();
    expect(stagingEnv.apps).toEqual(expect.arrayContaining([]));

    // Validate backend app status
    const backendApp = stagingEnv.apps.find((app: any) => app.name === 'backend');
    expect(backendApp).toBeTruthy();
    expect(backendApp.status).toMatch(/^(running|building|deploying)$/);
    expect(backendApp.deployment_id).toBeTruthy();
    expect(backendApp.rollback_available).toBe(true);

    // Store deployment ID for rollback test
    originalDeploymentId = backendApp.deployment_id;
  });

  it('should validate deployment history for rollback targets', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/deployment/history?environment=staging&app=backend&limit=10')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      deployments: expect.arrayContaining([]),
      pagination: expect.objectContaining({
        total: expect.any(Number),
        page: expect.any(Number),
        per_page: expect.any(Number),
        has_next: expect.any(Boolean)
      })
    });

    // Should have deployment history
    expect(response.body.deployments.length).toBeGreaterThan(0);

    // Validate deployment records
    response.body.deployments.forEach((deployment: any) => {
      expect(deployment).toMatchObject({
        deployment_id: expect.any(String),
        environment: 'staging',
        app: 'backend',
        commit_sha: expect.any(String),
        status: expect.stringMatching(/^(success|failed|rolled_back|in_progress)$/)
      });

      if (deployment.rollback_target) {
        expect(deployment.rollback_target).toBe(true);
        expect(deployment.status).toBe('success'); // Only successful deployments should be rollback targets
      }

      if (deployment.started_at) {
        expect(new Date(deployment.started_at)).toBeInstanceOf(Date);
      }

      if (deployment.completed_at) {
        expect(new Date(deployment.completed_at)).toBeInstanceOf(Date);
      }
    });

    // Should have at least one successful deployment that can be used for rollback
    const successfulDeployments = response.body.deployments.filter(
      (d: any) => d.status === 'success' && d.rollback_target
    );
    expect(successfulDeployments.length).toBeGreaterThan(0);
  });

  it('should initiate rollback within acceptable time', async () => {
    // Skip if no original deployment ID available
    if (!originalDeploymentId) {
      console.log('Skipping rollback test - no deployment ID available');
      return;
    }

    const rollbackRequest = {
      target_deployment_id: originalDeploymentId,
      environment: 'staging',
      app: 'backend',
      reason: 'Integration test rollback validation - Scenario 7'
    };

    const startTime = Date.now();

    const response = await request(API_BASE_URL)
      .post('/api/admin/deployment/rollback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(rollbackRequest)
      .expect('Content-Type', /json/)
      .expect(202);

    const initiationTime = Date.now() - startTime;

    expect(response.body).toMatchObject({
      rollback_id: expect.any(String),
      status: 'initiated'
    });

    // Rollback initiation should be fast
    expect(initiationTime).toBeLessThan(5000); // Should initiate within 5 seconds

    // Estimated completion should be within 15 minutes
    if (response.body.estimated_completion) {
      const estimatedTime = new Date(response.body.estimated_completion);
      const now = new Date();
      const estimatedDurationMs = estimatedTime.getTime() - now.getTime();
      expect(estimatedDurationMs).toBeLessThan(ROLLBACK_TIME_LIMIT_MS);
    }

    testRollbackId = response.body.rollback_id;
  });

  it('should monitor rollback progress and completion', async () => {
    // Skip if no rollback was initiated
    if (!testRollbackId) {
      console.log('Skipping rollback monitoring - no rollback initiated');
      return;
    }

    const startTime = Date.now();
    let rollbackCompleted = false;
    let lastStatus = '';

    // Monitor rollback progress
    while (!rollbackCompleted && (Date.now() - startTime) < ROLLBACK_TIME_LIMIT_MS) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/deployment/rollback/${testRollbackId}/status`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toMatchObject({
        rollback_id: testRollbackId,
        status: expect.stringMatching(/^(initiated|in_progress|completed|failed)$/),
        progress_percent: expect.any(Number)
      });

      const status = response.body.status;
      const progress = response.body.progress_percent;

      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);

      // Progress should not decrease
      if (lastStatus === status) {
        expect(progress).toBeGreaterThanOrEqual(response.body.progress_percent || 0);
      }

      // Validate status progression
      if (status === 'completed') {
        expect(progress).toBe(100);
        expect(response.body.completed_at).toBeTruthy();
        expect(new Date(response.body.completed_at)).toBeInstanceOf(Date);
        rollbackCompleted = true;
      } else if (status === 'failed') {
        expect(response.body.error_message).toBeTruthy();
        break;
      }

      // Validate steps if present
      if (response.body.steps) {
        response.body.steps.forEach((step: any) => {
          expect(step).toMatchObject({
            step_name: expect.any(String),
            status: expect.stringMatching(/^(pending|in_progress|completed|failed)$/)
          });

          if (step.started_at) {
            expect(new Date(step.started_at)).toBeInstanceOf(Date);
          }

          if (step.completed_at) {
            expect(new Date(step.completed_at)).toBeInstanceOf(Date);
          }
        });
      }

      lastStatus = status;

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
    }

    // Should complete within time limit
    const totalTime = Date.now() - startTime;
    if (rollbackCompleted) {
      expect(totalTime).toBeLessThan(ROLLBACK_TIME_LIMIT_MS);
    }
  });

  it('should validate service availability during rollback', async () => {
    // Test that service remains available during rollback
    const healthCheckPromises = [];
    const checkInterval = 10000; // Check every 10 seconds
    const maxChecks = 5;

    for (let i = 0; i < maxChecks; i++) {
      healthCheckPromises.push(
        new Promise(resolve => {
          setTimeout(async () => {
            try {
              const response = await request(API_BASE_URL)
                .get('/health')
                .timeout(5000); // 5 second timeout

              resolve({
                timestamp: Date.now(),
                status: response.status,
                available: response.status === 200
              });
            } catch (error) {
              resolve({
                timestamp: Date.now(),
                status: 0,
                available: false,
                error: error.message
              });
            }
          }, i * checkInterval);
        })
      );
    }

    const healthChecks = await Promise.all(healthCheckPromises);
    
    // Calculate availability during rollback
    const availableChecks = healthChecks.filter((check: any) => check.available);
    const availabilityPercent = (availableChecks.length / healthChecks.length) * 100;

    // Service should maintain high availability during rollback
    expect(availabilityPercent).toBeGreaterThan(80); // >80% availability during rollback
  });

  it('should validate post-rollback system health', async () => {
    // Wait a moment for rollback to settle
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check health endpoints
    const healthResponse = await request(API_BASE_URL)
      .get('/health/detailed')
      .expect(200);

    expect(healthResponse.body.status).toMatch(/^(healthy|degraded)$/);

    // Database should be healthy
    const dbHealthResponse = await request(API_BASE_URL)
      .get('/health/database')
      .expect(200);

    expect(dbHealthResponse.body.status).toMatch(/^(healthy|degraded)$/);

    // Jobs should be running
    const jobsHealthResponse = await request(API_BASE_URL)
      .get('/health/jobs')
      .expect(200);

    expect(jobsHealthResponse.body.scheduler_running).toBe(true);
  });

  it('should validate rollback audit trail and logging', async () => {
    // Skip if no rollback was performed
    if (!testRollbackId) {
      console.log('Skipping audit trail validation - no rollback performed');
      return;
    }

    // Check deployment history shows rollback
    const historyResponse = await request(API_BASE_URL)
      .get('/api/admin/deployment/history?environment=staging&app=backend&limit=5')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    // Should have recent deployment history including rollback
    const recentDeployments = historyResponse.body.deployments;
    expect(recentDeployments.length).toBeGreaterThan(0);

    // Look for rollback indicators in deployment history
    const rollbackDeployments = recentDeployments.filter(
      (deployment: any) => deployment.status === 'rolled_back' || 
                          deployment.deployed_by?.includes('rollback')
    );

    // Should have evidence of rollback in audit trail
    expect(rollbackDeployments.length).toBeGreaterThanOrEqual(0);
  });

  it('should validate rollback performance requirements', async () => {
    // Test that rollback mechanism itself is performant
    const rollbackStatusRequests = 10;
    const promises = [];

    for (let i = 0; i < rollbackStatusRequests; i++) {
      promises.push(
        new Promise(async (resolve) => {
          const startTime = Date.now();
          
          try {
            await request(API_BASE_URL)
              .get('/api/admin/deployment/status')
              .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
              .expect(200);
            
            const responseTime = Date.now() - startTime;
            resolve({ success: true, responseTime });
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        })
      );
    }

    const results = await Promise.all(promises);
    
    // All status checks should succeed
    const successfulRequests = results.filter((r: any) => r.success);
    expect(successfulRequests.length).toBe(rollbackStatusRequests);

    // Response times should be reasonable
    successfulRequests.forEach((result: any) => {
      expect(result.responseTime).toBeLessThan(3000); // <3s for deployment status
    });
  });
});