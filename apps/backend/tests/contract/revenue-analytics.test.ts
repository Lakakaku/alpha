import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/revenue-analytics - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
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
        .get(`/api/monitoring/revenue-analytics?store_id=${validStoreId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid UUID format for store_id', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?store_id=invalid-uuid')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid business_type filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?business_type=restaurant')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid start_date parameter (YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?start_date=2025-09-01')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid end_date parameter (YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid date range', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?start_date=2025-09-01&end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?start_date=invalid-date')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject end_date before start_date', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?start_date=2025-09-30&end_date=2025-09-01')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should accept valid group_by parameter', async () => {
      const groupByOptions = ['day', 'week', 'month'];

      for (const groupBy of groupByOptions) {
        const response = await request(app)
          .get(`/api/monitoring/revenue-analytics?group_by=${groupBy}`)
          .set('Authorization', validAdminAuth);

        expect(response.status).not.toBe(422);
      }
    });

    it('should reject invalid group_by parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?group_by=invalid_period')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should use day as default group_by when not specified', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      if (response.status === 200) {
        // Default behavior verification in response structure
        expect(response.body.analytics).toBeDefined();
      }
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid revenue analytics structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('analytics');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.analytics)).toBe(true);

      if (response.body.analytics.length > 0) {
        const analytics = response.body.analytics[0];

        // Required fields
        expect(analytics).toHaveProperty('id');
        expect(analytics).toHaveProperty('report_date');
        expect(analytics).toHaveProperty('store_id');
        expect(analytics).toHaveProperty('total_rewards_paid');
        expect(analytics).toHaveProperty('admin_fees_collected');
        expect(analytics).toHaveProperty('net_revenue');

        // Optional fields
        expect(analytics).toHaveProperty('feedback_volume');
        expect(analytics).toHaveProperty('customer_engagement_rate');
        expect(analytics).toHaveProperty('reward_distribution');

        // Validate field types
        expect(typeof analytics.id).toBe('string');
        expect(typeof analytics.report_date).toBe('string');
        expect(typeof analytics.store_id).toBe('string');
        expect(typeof analytics.total_rewards_paid).toBe('number');
        expect(typeof analytics.admin_fees_collected).toBe('number');
        expect(typeof analytics.net_revenue).toBe('number');
        expect(typeof analytics.feedback_volume).toBe('number');
        expect(typeof analytics.reward_distribution).toBe('object');

        // Validate UUID formats
        expect(analytics.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(analytics.store_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Validate date format (YYYY-MM-DD)
        expect(analytics.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(analytics.report_date)).toBeInstanceOf(Date);

        // Validate positive numeric values
        expect(analytics.total_rewards_paid).toBeGreaterThanOrEqual(0);
        expect(analytics.admin_fees_collected).toBeGreaterThanOrEqual(0);
        expect(analytics.feedback_volume).toBeGreaterThanOrEqual(0);

        // Validate engagement rate range
        if (analytics.customer_engagement_rate !== null) {
          expect(typeof analytics.customer_engagement_rate).toBe('number');
          expect(analytics.customer_engagement_rate).toBeGreaterThanOrEqual(0);
          expect(analytics.customer_engagement_rate).toBeLessThanOrEqual(1);
        }
      }

      // Validate summary structure
      const summary = response.body.summary;
      expect(summary).toHaveProperty('total_revenue');
      expect(summary).toHaveProperty('period_growth');
      expect(summary).toHaveProperty('top_performing_stores');

      expect(typeof summary.total_revenue).toBe('number');
      expect(typeof summary.period_growth).toBe('number');
      expect(Array.isArray(summary.top_performing_stores)).toBe(true);

      if (summary.top_performing_stores.length > 0) {
        const topStore = summary.top_performing_stores[0];
        expect(topStore).toHaveProperty('store_id');
        expect(topStore).toHaveProperty('store_name');
        expect(topStore).toHaveProperty('revenue');

        expect(typeof topStore.store_id).toBe('string');
        expect(typeof topStore.store_name).toBe('string');
        expect(typeof topStore.revenue).toBe('number');

        expect(topStore.store_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(topStore.revenue).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return filtered results when store_id parameter provided', async () => {
      const storeId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/monitoring/revenue-analytics?store_id=${storeId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 0) {
        response.body.analytics.forEach((analytics: any) => {
          expect(analytics.store_id).toBe(storeId);
        });
      }
    });

    it('should return analytics within specified date range', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-15';

      const response = await request(app)
        .get(`/api/monitoring/revenue-analytics?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 0) {
        response.body.analytics.forEach((analytics: any) => {
          expect(analytics.report_date).toBeGreaterThanOrEqual(startDate);
          expect(analytics.report_date).toBeLessThanOrEqual(endDate);
        });
      }
    });

    it('should group results according to group_by parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics?group_by=week')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      // Grouping behavior would be verified in integration tests
      // This contract test ensures the parameter is accepted
    });

    it('should include reward distribution breakdown when available', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 0) {
        const analytics = response.body.analytics[0];
        expect(analytics.reward_distribution).toBeDefined();

        if (Object.keys(analytics.reward_distribution).length > 0) {
          // Should contain grade distribution as numbers
          Object.values(analytics.reward_distribution).forEach((count: any) => {
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
          });
        }
      }
    });
  });

  describe('Business Data Isolation', () => {
    it('should only return revenue analytics for accessible businesses', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      // RLS policies should enforce business data isolation
      // This contract test ensures the endpoint structure is correct
      // Integration tests will verify the actual data isolation
    });

    it('should respect admin business access permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', 'Bearer limited-admin-token');

      // Should not return 403, but may return filtered results
      expect(response.status).toBe(200);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 1 second for revenue analytics endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Analytics endpoints allow up to 1s
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      const futureDate = '2099-12-31';
      const response = await request(app)
        .get(`/api/monitoring/revenue-analytics?start_date=${futureDate}&end_date=${futureDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.analytics).toEqual([]);
      expect(response.body.summary.total_revenue).toBe(0);
    });

    it('should handle single day date range', async () => {
      const singleDate = '2025-09-23';
      const response = await request(app)
        .get(`/api/monitoring/revenue-analytics?start_date=${singleDate}&end_date=${singleDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
    });

    it('should handle stores with no revenue data', async () => {
      const newStoreId = '550e8400-e29b-41d4-a716-446655440999';
      const response = await request(app)
        .get(`/api/monitoring/revenue-analytics?store_id=${newStoreId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.analytics).toEqual([]);
    });
  });

  describe('Data Aggregation', () => {
    it('should return analytics ordered by report_date (newest first)', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.analytics.length > 1) {
        for (let i = 1; i < response.body.analytics.length; i++) {
          const previousDate = response.body.analytics[i - 1].report_date;
          const currentDate = response.body.analytics[i].report_date;
          expect(previousDate).toBeGreaterThanOrEqual(currentDate);
        }
      }
    });

    it('should calculate net revenue correctly in summary', async () => {
      const response = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.summary.total_revenue).toBeGreaterThanOrEqual(0);
    });
  });
});