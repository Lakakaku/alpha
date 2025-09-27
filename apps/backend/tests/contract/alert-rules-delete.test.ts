import request from 'supertest';
import { app } from '../../src/app';

describe('DELETE /api/monitoring/alerts/rules/{rule_id} - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked
  const validRuleId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', 'Bearer invalid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });

    it('should return 403 when non-owner user tries to delete rule', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', 'Bearer different-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('permission');
    });
  });

  describe('Path Parameter Validation', () => {
    it('should accept valid UUID for rule_id', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid UUID format for rule_id', async () => {
      const response = await request(app)
        .delete('/api/monitoring/alerts/rules/invalid-uuid')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('UUID');
    });

    it('should reject empty rule_id', async () => {
      const response = await request(app)
        .delete('/api/monitoring/alerts/rules/')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(404); // Not found route
    });
  });

  describe('Successful Response', () => {
    it('should return 204 when alert rule deleted successfully', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('should mark rule as inactive rather than hard delete', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(204);

      // Verify rule still exists but is inactive (would be checked in integration test)
      // This contract test ensures the endpoint accepts the request correctly
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when alert rule not found', async () => {
      const nonExistentRuleId = '550e8400-e29b-41d4-a716-446655440999';

      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${nonExistentRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should return 404 when trying to delete already deleted rule', async () => {
      // First delete
      await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      // Second delete attempt
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(404);
    });
  });

  describe('Response Headers', () => {
    it('should not return content for successful deletion', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
    });

    it('should return JSON content type for error responses', async () => {
      const response = await request(app)
        .delete('/api/monitoring/alerts/rules/invalid-uuid')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for delete alert rule endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Audit Trail', () => {
    it('should log alert rule deletion for audit purposes', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(204);
      // Audit logging verification would be handled by integration tests
      // This contract test ensures the endpoint accepts the request correctly
    });
  });

  describe('Cascading Effects', () => {
    it('should handle deletion of rule with existing notifications', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(204);
      // Cascading notification cleanup would be verified in integration tests
    });
  });

  describe('Super Admin Permissions', () => {
    it('should allow super admin to delete any rule', async () => {
      const response = await request(app)
        .delete(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', 'Bearer super-admin-token');

      // Should not return 403 for super admin
      expect(response.status).not.toBe(403);
    });
  });
});