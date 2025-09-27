/**
 * Contract Test: GET /api/security/test-suites
 * Tests security test suite listing endpoint contract validation
 * 
 * This test MUST FAIL initially as implementation doesn't exist yet (TDD approach)
 */

import request from 'supertest';
import { app } from '../../apps/backend/src/app';

describe('GET /api/security/test-suites - Contract Test', () => {
  const adminToken = process.env.ADMIN_TEST_TOKEN || 'test-admin-token';
  
  describe('Authentication & Authorization', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/security/test-suites')
        .expect(401);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });

    it('should require admin privileges', async () => {
      const businessToken = process.env.BUSINESS_TEST_TOKEN || 'test-business-token';
      
      const response = await request(app)
        .get('/api/security/test-suites')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(403);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Forbidden')
      });
    });
  });

  describe('Response Contract Validation', () => {
    it('should return valid security test suites list', async () => {
      const response = await request(app)
        .get('/api/security/test-suites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Validate response structure according to security-test-api.yaml
      expect(response.body).toMatchObject({
        test_suites: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i), // UUID format
            name: expect.any(String),
            description: expect.any(String),
            category: expect.stringMatching(/^(authentication|authorization|privacy|gdpr|vulnerability|fraud)$/),
            test_count: expect.any(Number),
            estimated_duration: expect.any(Number),
            status: expect.stringMatching(/^(active|maintenance|deprecated)$/)
          })
        ]),
        total_count: expect.any(Number)
      });
    });

    it('should support category filtering', async () => {
      const categories = ['authentication', 'authorization', 'privacy', 'gdpr', 'vulnerability', 'fraud'];
      
      for (const category of categories) {
        const response = await request(app)
          .get('/api/security/test-suites')
          .query({ category })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // All returned test suites should match the requested category
        response.body.test_suites.forEach((suite: any) => {
          expect(suite.category).toBe(category);
        });
      }
    });

    it('should support status filtering', async () => {
      const statuses = ['active', 'maintenance', 'deprecated'];
      
      for (const status of statuses) {
        const response = await request(app)
          .get('/api/security/test-suites')
          .query({ status })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // All returned test suites should match the requested status
        response.body.test_suites.forEach((suite: any) => {
          expect(suite.status).toBe(status);
        });
      }
    });

    it('should include required OWASP test suites', async () => {
      const response = await request(app)
        .get('/api/security/test-suites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const suiteNames = response.body.test_suites.map((suite: any) => suite.name.toLowerCase());
      
      // Verify essential security test suites exist (from quickstart scenarios)
      expect(suiteNames).toEqual(expect.arrayContaining([
        expect.stringMatching(/owasp.*top.*10/i),
        expect.stringMatching(/authentication.*security/i),
        expect.stringMatching(/authorization.*boundary/i),
        expect.stringMatching(/privacy.*protection/i),
        expect.stringMatching(/gdpr.*compliance/i)
      ]));
    });
  });

  describe('Performance Validation', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/security/test-suites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      // Constitutional requirement: API responses <500ms for CRUD operations
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/security/test-suites')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Average response time should still be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(1000); // 1 second average
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid category parameter', async () => {
      const response = await request(app)
        .get('/api/security/test-suites')
        .query({ category: 'invalid_category' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.arrayContaining([
          expect.stringContaining('category')
        ])
      });
    });

    it('should handle invalid status parameter', async () => {
      const response = await request(app)
        .get('/api/security/test-suites')
        .query({ status: 'invalid_status' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.any(String),
        details: expect.arrayContaining([
          expect.stringContaining('status')
        ])
      });
    });
  });

  describe('Security Requirements Validation', () => {
    it('should log security test access for audit purposes', async () => {
      // This test validates that security test access is properly logged
      // Implementation should create audit log entries for security testing access
      
      await request(app)
        .get('/api/security/test-suites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Note: Actual audit log verification would require database access
      // This serves as a contract requirement for implementation
    });

    it('should validate admin permissions for security testing', async () => {
      // Security testers must have full admin access (per clarifications)
      const response = await request(app)
        .get('/api/security/test-suites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Response should include all available test suites for admin user
      expect(response.body.test_suites.length).toBeGreaterThan(0);
      expect(response.body.total_count).toBeGreaterThan(0);
    });
  });
});