/**
 * Contract Test: GET /api/security/executions/{executionId}
 * Tests security test execution status endpoint contract validation
 * 
 * This test MUST FAIL initially as implementation doesn't exist yet (TDD approach)
 */

import request from 'supertest';
import { app } from '../../apps/backend/src/app';

describe('GET /api/security/executions/{executionId} - Contract Test', () => {
  const adminToken = process.env.ADMIN_TEST_TOKEN || 'test-admin-token';
  const testExecutionId = '550e8400-e29b-41d4-a716-446655440001'; // Mock UUID for testing
  
  describe('Authentication & Authorization', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .expect(401);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });

    it('should require admin privileges', async () => {
      const businessToken = process.env.BUSINESS_TEST_TOKEN || 'test-business-token';
      
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(403);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Forbidden')
      });
    });
  });

  describe('Response Contract Validation', () => {
    it('should return valid execution details for active execution', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Validate response structure according to security-test-api.yaml
      expect(response.body).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        suite_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
        status: expect.stringMatching(/^(queued|running|completed|failed|cancelled)$/),
        started_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/), // ISO 8601 format
        performance_impact: expect.any(Number)
      });

      // Performance impact should be within constitutional limit
      expect(response.body.performance_impact).toBeLessThanOrEqual(10);
    });

    it('should include completed_at for finished executions', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.status === 'completed' || response.body.status === 'failed') {
        expect(response.body).toHaveProperty('completed_at');
        expect(response.body.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
      }
    });

    it('should include test results for completed executions', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.status === 'completed') {
        expect(response.body).toHaveProperty('test_results');
        expect(response.body.test_results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              test_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
              test_name: expect.any(String),
              status: expect.stringMatching(/^(pass|fail|skip|error)$/),
              execution_time: expect.any(Number),
              attack_vector: expect.any(String),
              expected_defense: expect.any(String),
              actual_result: expect.any(String)
            })
          ])
        );
      }
    });

    it('should include execution summary', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.status === 'completed') {
        expect(response.body).toHaveProperty('summary');
        expect(response.body.summary).toMatchObject({
          total_tests: expect.any(Number),
          passed: expect.any(Number),
          failed: expect.any(Number),
          skipped: expect.any(Number)
        });

        // Summary totals should be consistent
        const { total_tests, passed, failed, skipped } = response.body.summary;
        expect(total_tests).toBe(passed + failed + skipped);
      }
    });
  });

  describe('Status Transitions Validation', () => {
    const validStatuses = ['queued', 'running', 'completed', 'failed', 'cancelled'];
    
    validStatuses.forEach(status => {
      it(`should handle ${status} status correctly`, async () => {
        const response = await request(app)
          .get(`/api/security/executions/${testExecutionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        if (response.body.status === status) {
          expect(response.body.status).toBe(status);
          
          // Validate status-specific requirements
          switch (status) {
            case 'queued':
              expect(response.body.started_at).toBeUndefined();
              break;
            case 'running':
              expect(response.body.started_at).toBeDefined();
              expect(response.body.completed_at).toBeUndefined();
              break;
            case 'completed':
            case 'failed':
            case 'cancelled':
              expect(response.body.started_at).toBeDefined();
              expect(response.body.completed_at).toBeDefined();
              break;
          }
        }
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should report actual performance impact within limits', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.performance_impact).toBeGreaterThanOrEqual(0);
      expect(response.body.performance_impact).toBeLessThanOrEqual(10); // Constitutional limit
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // <500ms requirement
    });
  });

  describe('Test Artifacts Validation', () => {
    it('should include test artifacts for security analysis', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.test_results && response.body.test_results.length > 0) {
        response.body.test_results.forEach((result: any) => {
          if (result.artifacts) {
            expect(result.artifacts).toEqual(
              expect.arrayContaining([
                expect.stringMatching(/^https?:\/\/.*\.(log|json|png|html)$/i)
              ])
            );
          }
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent execution ID', async () => {
      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      
      const response = await request(app)
        .get(`/api/security/executions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('not found'),
        resource_id: nonExistentId
      });
    });

    it('should handle invalid execution ID format', async () => {
      const invalidId = 'invalid-uuid-format';
      
      const response = await request(app)
        .get(`/api/security/executions/${invalidId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error).toMatch(/executionId.*format/i);
    });
  });

  describe('Real-time Updates Validation', () => {
    it('should provide current execution progress for running tests', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.status === 'running') {
        // Should include progress indicators
        expect(response.body.test_results).toBeDefined();
        
        // Some tests may be completed while others are still running
        const completedTests = response.body.test_results.filter(
          (result: any) => result.status !== 'running'
        );
        const runningTests = response.body.test_results.filter(
          (result: any) => result.status === 'running'
        );
        
        expect(completedTests.length + runningTests.length).toBe(response.body.test_results.length);
      }
    });
  });

  describe('Security Context Validation', () => {
    it('should include security test context information', async () => {
      const response = await request(app)
        .get(`/api/security/executions/${testExecutionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.suite_id).toBeDefined();
      
      // Should include test execution metadata for security analysis
      if (response.body.test_results && response.body.test_results.length > 0) {
        response.body.test_results.forEach((result: any) => {
          expect(result.attack_vector).toBeDefined();
          expect(result.expected_defense).toBeDefined();
          expect(result.actual_result).toBeDefined();
        });
      }
    });
  });
});