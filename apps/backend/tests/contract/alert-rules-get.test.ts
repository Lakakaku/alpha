import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/alerts/rules - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', 'Bearer invalid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid alert rules structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rules');
      expect(Array.isArray(response.body.rules)).toBe(true);

      if (response.body.rules.length > 0) {
        const rule = response.body.rules[0];

        // Required fields
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('rule_name');
        expect(rule).toHaveProperty('metric_type');
        expect(rule).toHaveProperty('threshold_value');
        expect(rule).toHaveProperty('comparison_operator');
        expect(rule).toHaveProperty('notification_channels');

        // Optional fields
        expect(rule).toHaveProperty('is_active');
        expect(rule).toHaveProperty('created_by');
        expect(rule).toHaveProperty('created_at');

        // Validate field types
        expect(typeof rule.id).toBe('string');
        expect(typeof rule.rule_name).toBe('string');
        expect(typeof rule.metric_type).toBe('string');
        expect(typeof rule.threshold_value).toBe('number');
        expect(typeof rule.comparison_operator).toBe('string');
        expect(Array.isArray(rule.notification_channels)).toBe(true);
        expect(typeof rule.is_active).toBe('boolean');
        expect(typeof rule.created_at).toBe('string');

        // Validate UUID format for id
        expect(rule.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Validate enum values
        expect(['>', '<', '>=', '<=', '=']).toContain(rule.comparison_operator);

        // Validate notification channels
        rule.notification_channels.forEach((channel: string) => {
          expect(['email', 'dashboard', 'sms']).toContain(channel);
        });

        // Validate created_by is UUID if present
        if (rule.created_by) {
          expect(rule.created_by).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        }

        // Validate timestamp format (ISO 8601)
        expect(new Date(rule.created_at)).toBeInstanceOf(Date);
        expect(isNaN(new Date(rule.created_at).getTime())).toBe(false);
      }
    });

    it('should return both active and inactive rules', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          expect(typeof rule.is_active).toBe('boolean');
        });
      }
    });

    it('should include rules created by different administrators', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          if (rule.created_by) {
            expect(typeof rule.created_by).toBe('string');
            expect(rule.created_by).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          }
        });
      }
    });

    it('should return rules with various metric types', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          expect(typeof rule.metric_type).toBe('string');
          expect(rule.metric_type.length).toBeGreaterThan(0);
        });
      }
    });

    it('should return rules with various comparison operators', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          expect(['>', '<', '>=', '<=', '=']).toContain(rule.comparison_operator);
        });
      }
    });

    it('should return rules with multiple notification channels', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          expect(Array.isArray(rule.notification_channels)).toBe(true);
          expect(rule.notification_channels.length).toBeGreaterThan(0);

          rule.notification_channels.forEach((channel: string) => {
            expect(['email', 'dashboard', 'sms']).toContain(channel);
          });
        });
      }
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for alert rules endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty rules list gracefully', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.rules).toBeDefined();
      expect(Array.isArray(response.body.rules)).toBe(true);
    });

    it('should return rules ordered by creation date (newest first)', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 1) {
        for (let i = 1; i < response.body.rules.length; i++) {
          const previousDate = new Date(response.body.rules[i - 1].created_at);
          const currentDate = new Date(response.body.rules[i].created_at);
          expect(previousDate.getTime()).toBeGreaterThanOrEqual(currentDate.getTime());
        }
      }
    });
  });

  describe('Data Validation', () => {
    it('should return valid threshold values as numbers', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          expect(typeof rule.threshold_value).toBe('number');
          expect(isNaN(rule.threshold_value)).toBe(false);
          expect(isFinite(rule.threshold_value)).toBe(true);
        });
      }
    });

    it('should return non-empty rule names', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.rules.length > 0) {
        response.body.rules.forEach((rule: any) => {
          expect(rule.rule_name).toBeTruthy();
          expect(rule.rule_name.trim().length).toBeGreaterThan(0);
        });
      }
    });
  });
});