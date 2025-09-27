import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/fraud-reports - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
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
        .get(`/api/monitoring/fraud-reports?store_id=${validStoreId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid UUID format for store_id', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports?store_id=invalid-uuid')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid start_date parameter (YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports?start_date=2025-09-01')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid end_date parameter (YYYY-MM-DD)', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports?end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should accept valid date range', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports?start_date=2025-09-01&end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid date format', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports?start_date=invalid-date')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject end_date before start_date', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports?start_date=2025-09-30&end_date=2025-09-01')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid fraud reports structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reports');
      expect(Array.isArray(response.body.reports)).toBe(true);

      if (response.body.reports.length > 0) {
        const report = response.body.reports[0];

        // Required fields
        expect(report).toHaveProperty('id');
        expect(report).toHaveProperty('report_date');
        expect(report).toHaveProperty('store_id');
        expect(report).toHaveProperty('verification_failure_rate');
        expect(report).toHaveProperty('blocked_transactions');

        // Optional fields
        expect(report).toHaveProperty('suspicious_patterns');
        expect(report).toHaveProperty('false_positive_rate');
        expect(report).toHaveProperty('accuracy_metrics');

        // Validate field types
        expect(typeof report.id).toBe('string');
        expect(typeof report.report_date).toBe('string');
        expect(typeof report.store_id).toBe('string');
        expect(typeof report.verification_failure_rate).toBe('number');
        expect(typeof report.blocked_transactions).toBe('number');
        expect(typeof report.suspicious_patterns).toBe('object');
        expect(typeof report.accuracy_metrics).toBe('object');

        // Validate UUID formats
        expect(report.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(report.store_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Validate date format (YYYY-MM-DD)
        expect(report.report_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(report.report_date)).toBeInstanceOf(Date);

        // Validate numeric ranges
        expect(report.verification_failure_rate).toBeGreaterThanOrEqual(0);
        expect(report.verification_failure_rate).toBeLessThanOrEqual(1);
        expect(report.blocked_transactions).toBeGreaterThanOrEqual(0);

        if (report.false_positive_rate !== null) {
          expect(typeof report.false_positive_rate).toBe('number');
          expect(report.false_positive_rate).toBeGreaterThanOrEqual(0);
          expect(report.false_positive_rate).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should return filtered results when store_id parameter provided', async () => {
      const storeId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await request(app)
        .get(`/api/monitoring/fraud-reports?store_id=${storeId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.reports.length > 0) {
        response.body.reports.forEach((report: any) => {
          expect(report.store_id).toBe(storeId);
        });
      }
    });

    it('should return reports within specified date range', async () => {
      const startDate = '2025-09-01';
      const endDate = '2025-09-15';

      const response = await request(app)
        .get(`/api/monitoring/fraud-reports?start_date=${startDate}&end_date=${endDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.reports.length > 0) {
        response.body.reports.forEach((report: any) => {
          expect(report.report_date).toBeGreaterThanOrEqual(startDate);
          expect(report.report_date).toBeLessThanOrEqual(endDate);
        });
      }
    });

    it('should include suspicious patterns breakdown when available', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.reports.length > 0) {
        const report = response.body.reports[0];
        expect(report.suspicious_patterns).toBeDefined();

        if (Object.keys(report.suspicious_patterns).length > 0) {
          // Should contain pattern descriptions and counts
          Object.values(report.suspicious_patterns).forEach((value: any) => {
            expect(typeof value === 'number' || typeof value === 'string').toBe(true);
          });
        }
      }
    });

    it('should include accuracy metrics when available', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.reports.length > 0) {
        const report = response.body.reports[0];
        expect(report.accuracy_metrics).toBeDefined();

        if (Object.keys(report.accuracy_metrics).length > 0) {
          // Should contain accuracy-related metrics
          Object.values(report.accuracy_metrics).forEach((value: any) => {
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThanOrEqual(0);
          });
        }
      }
    });
  });

  describe('Business Data Isolation', () => {
    it('should only return fraud reports for accessible businesses', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      // RLS policies should enforce business data isolation
      // This contract test ensures the endpoint structure is correct
      // Integration tests will verify the actual data isolation
    });

    it('should respect admin business access permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', 'Bearer limited-admin-token');

      // Should not return 403, but may return filtered results
      expect(response.status).toBe(200);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 1 second for fraud reports endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Analytics endpoints allow up to 1s
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results gracefully', async () => {
      const futureDate = '2099-12-31';
      const response = await request(app)
        .get(`/api/monitoring/fraud-reports?start_date=${futureDate}&end_date=${futureDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.reports).toEqual([]);
    });

    it('should handle single day date range', async () => {
      const singleDate = '2025-09-23';
      const response = await request(app)
        .get(`/api/monitoring/fraud-reports?start_date=${singleDate}&end_date=${singleDate}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
    });

    it('should handle stores with no fraud data', async () => {
      const newStoreId = '550e8400-e29b-41d4-a716-446655440999';
      const response = await request(app)
        .get(`/api/monitoring/fraud-reports?store_id=${newStoreId}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body.reports).toEqual([]);
    });
  });

  describe('Data Aggregation', () => {
    it('should return reports ordered by report_date (newest first)', async () => {
      const response = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.reports.length > 1) {
        for (let i = 1; i < response.body.reports.length; i++) {
          const previousDate = response.body.reports[i - 1].report_date;
          const currentDate = response.body.reports[i].report_date;
          expect(previousDate).toBeGreaterThanOrEqual(currentDate);
        }
      }
    });
  });
});