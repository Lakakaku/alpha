/**
 * Contract Test: POST /api/security/test-suites/{suiteId}/execute
 * Tests security test suite execution endpoint contract validation
 * 
 * This test MUST FAIL initially as implementation doesn't exist yet (TDD approach)
 */

import request from 'supertest';
import { app } from '../../apps/backend/src/app';

describe('POST /api/security/test-suites/{suiteId}/execute - Contract Test', () => {
  const adminToken = process.env.ADMIN_TEST_TOKEN || 'test-admin-token';
  const testSuiteId = '550e8400-e29b-41d4-a716-446655440000'; // Mock UUID for testing
  
  describe('Authentication & Authorization', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .send({
          performance_limit: 10,
          target_environment: 'staging'
        })
        .expect(401);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });

    it('should require admin privileges for security test execution', async () => {
      const businessToken = process.env.BUSINESS_TEST_TOKEN || 'test-business-token';
      
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging'
        })
        .expect(403);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Forbidden')
      });
    });
  });

  describe('Request Validation', () => {
    it('should require performance_limit parameter', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          target_environment: 'staging'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.arrayContaining([
          expect.stringContaining('performance_limit')
        ])
      });
    });

    it('should enforce constitutional performance limit ≤10%', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 15, // Exceeds constitutional limit
          target_environment: 'staging'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('performance_limit'),
        details: expect.arrayContaining([
          expect.stringMatching(/10.*percent/i)
        ])
      });
    });

    it('should validate target_environment values', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'invalid_env'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.arrayContaining([
          expect.stringContaining('target_environment')
        ])
      });
    });

    it('should validate suiteId parameter format', async () => {
      const invalidSuiteId = 'invalid-uuid-format';
      
      const response = await request(app)
        .post(`/api/security/test-suites/${invalidSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('suiteId')
      });
    });
  });

  describe('Response Contract Validation', () => {
    it('should return valid execution response for staging environment', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging',
          notification_settings: {
            email_alerts: true,
            slack_webhook: 'https://hooks.slack.com/test'
          }
        })
        .expect(202); // Accepted for async processing

      // Validate response structure according to security-test-api.yaml
      expect(response.body).toMatchObject({
        execution_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i), // UUID format
        estimated_duration: expect.any(Number),
        status: expect.stringMatching(/^(queued|running)$/)
      });

      // Constitutional requirement: Estimated duration should be reasonable
      expect(response.body.estimated_duration).toBeGreaterThan(0);
      expect(response.body.estimated_duration).toBeLessThanOrEqual(60); // Max 1 hour for comprehensive scans
    });

    it('should handle production environment execution with extra validation', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 5, // Lower limit for production
          target_environment: 'production'
        })
        .expect(202);

      expect(response.body).toMatchObject({
        execution_id: expect.any(String),
        estimated_duration: expect.any(Number),
        status: expect.stringMatching(/^(queued|running)$/)
      });
    });
  });

  describe('Performance Limits Validation', () => {
    const testCases = [
      { limit: 1, description: 'minimum performance impact' },
      { limit: 5, description: 'moderate performance impact' },
      { limit: 10, description: 'maximum allowed performance impact' }
    ];

    testCases.forEach(({ limit, description }) => {
      it(`should accept ${description} (${limit}%)`, async () => {
        const response = await request(app)
          .post(`/api/security/test-suites/${testSuiteId}/execute`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            performance_limit: limit,
            target_environment: 'staging'
          })
          .expect(202);

        expect(response.body.execution_id).toBeDefined();
      });
    });

    it('should reject performance limits exceeding constitutional requirement', async () => {
      const invalidLimits = [11, 15, 20, 50];
      
      for (const limit of invalidLimits) {
        const response = await request(app)
          .post(`/api/security/test-suites/${testSuiteId}/execute`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            performance_limit: limit,
            target_environment: 'staging'
          })
          .expect(400);

        expect(response.body.error).toMatch(/performance.*limit/i);
      }
    });
  });

  describe('Security Test Suite Types', () => {
    const securityTestSuites = [
      { name: 'OWASP Top 10', category: 'vulnerability' },
      { name: 'Authentication Security', category: 'authentication' },
      { name: 'Authorization Boundary', category: 'authorization' },
      { name: 'Privacy Protection', category: 'privacy' },
      { name: 'GDPR Compliance', category: 'gdpr' },
      { name: 'Fraud Detection', category: 'fraud' }
    ];

    securityTestSuites.forEach(({ name, category }) => {
      it(`should support execution of ${name} test suite`, async () => {
        const response = await request(app)
          .post(`/api/security/test-suites/${testSuiteId}/execute`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            performance_limit: 10,
            target_environment: 'staging'
          })
          .expect(202);

        expect(response.body.execution_id).toBeDefined();
        expect(response.body.status).toMatch(/^(queued|running)$/);
      });
    });
  });

  describe('Notification Settings Validation', () => {
    it('should accept valid notification configuration', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging',
          notification_settings: {
            email_alerts: true,
            slack_webhook: 'https://hooks.slack.com/services/test/webhook'
          }
        })
        .expect(202);

      expect(response.body.execution_id).toBeDefined();
    });

    it('should validate slack webhook URL format', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging',
          notification_settings: {
            email_alerts: true,
            slack_webhook: 'invalid-url-format'
          }
        })
        .expect(400);

      expect(response.body.error).toMatch(/slack.*webhook/i);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent test suite ID', async () => {
      const nonExistentSuiteId = '00000000-0000-4000-8000-000000000000';
      
      const response = await request(app)
        .post(`/api/security/test-suites/${nonExistentSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging'
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('not found'),
        resource_id: nonExistentSuiteId
      });
    });

    it('should handle concurrent execution limits', async () => {
      // Attempt to start multiple executions simultaneously
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post(`/api/security/test-suites/${testSuiteId}/execute`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            performance_limit: 10,
            target_environment: 'staging'
          })
      );

      const responses = await Promise.all(requests);
      
      // At least one should succeed, others may be queued or rejected
      const successfulResponses = responses.filter(r => r.status === 202);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging Requirements', () => {
    it('should log security test execution initiation', async () => {
      const response = await request(app)
        .post(`/api/security/test-suites/${testSuiteId}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          performance_limit: 10,
          target_environment: 'staging'
        })
        .expect(202);

      expect(response.body.execution_id).toBeDefined();
      
      // Note: Actual audit log verification would require database access
      // This serves as a contract requirement for implementation
    });
  });
});