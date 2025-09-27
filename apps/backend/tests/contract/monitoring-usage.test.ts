import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/usage - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', 'Bearer invalid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Query Parameters', () => {
    it('should accept valid service filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?service=backend')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid start_date parameter (YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?start_date=2025-09-01')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid end_date parameter (YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid date range', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?start_date=2025-09-01&end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?start_date=invalid-date')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject end_date before start_date', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?start_date=2025-09-30&end_date=2025-09-01')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid usage analytics structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('analytics');
      expect(Array.isArray(response.body.analytics)).toBe(true);

      if (response.body.analytics.length > 0) {
        const usage = response.body.analytics[0];

        // Required fields
        expect(usage).toHaveProperty('date');
        expect(usage).toHaveProperty('service_name');
        expect(usage).toHaveProperty('daily_active_users');
        expect(usage).toHaveProperty('api_call_volume');

        // Optional field
        expect(usage).toHaveProperty('feature_usage');

        // Validate field types
        expect(typeof usage.date).toBe('string');
        expect(typeof usage.service_name).toBe('string');
        expect(typeof usage.daily_active_users).toBe('number');
        expect(typeof usage.api_call_volume).toBe('number');
        expect(typeof usage.feature_usage).toBe('object');

        // Validate date format (YYYY-MM-DD)
        expect(usage.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(usage.date)).toBeInstanceOf(Date);

        // Validate positive numbers
        expect(usage.daily_active_users).toBeGreaterThanOrEqual(0);
        expect(usage.api_call_volume).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return filtered results when service parameter provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage?service=customer_app')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 0) {
        response.body.analytics.forEach((usage: any) => {
          expect(usage.service_name).toBe('customer_app');
        });
      }
    });

    it('should return analytics within specified date range', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-15';

      const response = await request(app)
        .get(`/api/monitoring/usage?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 0) {
        response.body.analytics.forEach((usage: any) => {
          expect(usage.date).toBeGreaterThanOrEqual(startDate);
          expect(usage.date).toBeLessThanOrEqual(endDate);
        });
      }
    });

    it('should include feature usage breakdown when available', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 0) {
        const usage = response.body.analytics[0];
        expect(usage.feature_usage).toBeDefined();

        if (Object.keys(usage.feature_usage).length > 0) {
          // Should contain feature counts as numbers
          Object.values(usage.feature_usage).forEach((count: any) => {
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
          });
        }
      }
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for usage analytics endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      const futureDate = '2099-12-31';
      const response = await request(app)
        .get(`/api/monitoring/usage?start_date=${futureDate}&end_date=${futureDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.analytics).toEqual([]);
    });

    it('should handle single day date range', async () => {
      const singleDate = '2025-09-23';
      const response = await request(app)
        .get(`/api/monitoring/usage?start_date=${singleDate}&end_date=${singleDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
    });
  });
});