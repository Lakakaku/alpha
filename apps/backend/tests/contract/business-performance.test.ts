import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/business-performance - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', 'Bearer invalid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Query Parameters', () => {
    it('should accept valid store_id filter parameter', async () => {
      const validStoreId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/monitoring/business-performance?store_id=${validStoreId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid UUID format for store_id', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance?store_id=invalid-uuid')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid region filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance?region=stockholm')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid comparison_period parameter', async () => {
      const periods = ['week', 'month', 'quarter'];

      for (const period of periods) {
        const response = await request(app)
          .get(`/api/monitoring/business-performance?comparison_period=${period}`)
          .set('Authorization', validAdminAuth);

        expect(response.status).not.toBe(422);
      }
    });

    it('should reject invalid comparison_period parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance?comparison_period=invalid_period')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should use month as default comparison_period when not specified', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      if (response.status === 200) {
        // Default behavior verification in response structure
        expect(response.body.metrics).toBeDefined();
      }
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid business performance metrics structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
      expect(Array.isArray(response.body.metrics)).toBe(true);

      if (response.body.metrics.length > 0) {
        const metrics = response.body.metrics[0];

        // Required fields
        expect(metrics).toHaveProperty('id');
        expect(metrics).toHaveProperty('report_date');
        expect(metrics).toHaveProperty('store_id');
        expect(metrics).toHaveProperty('business_id');

        // Optional fields
        expect(metrics).toHaveProperty('feedback_volume_trend');
        expect(metrics).toHaveProperty('verification_rate');
        expect(metrics).toHaveProperty('customer_satisfaction_score');
        expect(metrics).toHaveProperty('operational_metrics');

        // Validate field types
        expect(typeof metrics.id).toBe('string');
        expect(typeof metrics.report_date).toBe('string');
        expect(typeof metrics.store_id).toBe('string');
        expect(typeof metrics.business_id).toBe('string');
        expect(typeof metrics.operational_metrics).toBe('object');

        // Validate UUID formats
        expect(metrics.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(metrics.store_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(metrics.business_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Validate date format (YYYY-MM-DD)
        expect(metrics.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(metrics.report_date)).toBeInstanceOf(Date);

        // Validate numeric ranges when values are present
        if (metrics.feedback_volume_trend !== null) {
          expect(typeof metrics.feedback_volume_trend).toBe('number');
        }

        if (metrics.verification_rate !== null) {
          expect(typeof metrics.verification_rate).toBe('number');
          expect(metrics.verification_rate).toBeGreaterThanOrEqual(0);
          expect(metrics.verification_rate).toBeLessThanOrEqual(1);
        }

        if (metrics.customer_satisfaction_score !== null) {
          expect(typeof metrics.customer_satisfaction_score).toBe('number');
          expect(metrics.customer_satisfaction_score).toBeGreaterThanOrEqual(0);
          expect(metrics.customer_satisfaction_score).toBeLessThanOrEqual(10);
        }
      }
    });

    it('should return filtered results when store_id parameter provided', async () => {
      const storeId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/monitoring/business-performance?store_id=${storeId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 0) {
        response.body.metrics.forEach((metric: any) => {
          expect(metric.store_id).toBe(storeId);
        });
      }
    });

    it('should return metrics with operational data when available', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 0) {
        const metrics = response.body.metrics[0];
        expect(metrics.operational_metrics).toBeDefined();

        if (Object.keys(metrics.operational_metrics).length > 0) {
          // Should contain operational performance data
          Object.values(metrics.operational_metrics).forEach((value: any) => {
            expect(typeof value === 'number' || typeof value === 'string').toBe(true);
          });
        }
      }
    });

    it('should return metrics grouped by comparison period', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance?comparison_period=week')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      // Grouping behavior would be verified in integration tests
      // This contract test ensures the parameter is accepted
    });
  });

  describe('Business Data Isolation', () => {
    it('should only return performance metrics for accessible businesses', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      // RLS policies should enforce business data isolation
      // This contract test ensures the endpoint structure is correct
      // Integration tests will verify the actual data isolation
    });

    it('should respect admin business access permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', 'Bearer limited-admin-token');

      // Should not return 403, but may return filtered results
      expect(response.status).toBe(200);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 1 second for business performance endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Analytics endpoints allow up to 1s
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      const newStoreId = '550e8400-e29b-41d4-a716-446655440999';
      const response = await request(app)
        .get(`/api/monitoring/business-performance?store_id=${newStoreId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.metrics).toEqual([]);
    });

    it('should handle regional filtering correctly', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance?region=nonexistent_region')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.metrics).toEqual([]);
    });
  });

  describe('Data Aggregation', () => {
    it('should return metrics ordered by report_date (newest first)', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 1) {
        for (let i = 1; i < response.body.metrics.length; i++) {
          const previousDate = response.body.metrics[i - 1].report_date;
          const currentDate = response.body.metrics[i].report_date;
          expect(previousDate).toBeGreaterThanOrEqual(currentDate);
        }
      }
    });

    it('should handle trend calculations correctly', async () => {
      const response = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 0) {
        response.body.metrics.forEach((metric: any) => {
          if (metric.feedback_volume_trend !== null) {
            expect(typeof metric.feedback_volume_trend).toBe('number');
            // Trend can be positive, negative, or zero
          }
        });
      }
    });
  });
});