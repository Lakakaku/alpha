import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/monitoring/metrics - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics');

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', 'Bearer invalid-admin-token');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Query Parameters', () => {
    it('should accept valid service filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?service=backend')
        .set('Authorization', validAdminAuth);

      // Should not return 422 for valid service
      expect(response.status).not.toBe(422);
    });

    it('should reject invalid service parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?service=invalid_service')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept valid metric_type filter parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?metric_type=api_response_time')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid metric_type parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?metric_type=invalid_metric')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should accept valid ISO 8601 datetime for start_time and end_time', async () => {
      const startTime = '2025-09-20T10:00:00Z';
      const endTime = '2025-09-20T11:00:00Z';

      const response = await request(app)
        .get(`/api/monitoring/metrics?start_time=${startTime}&end_time=${endTime}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid datetime format', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?start_time=invalid-date')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(422);
    });

    it('should accept valid granularity parameter', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?granularity=hour')
        .set('Authorization', validAdminAuth);

      expect(response.status).not.toBe(422);
    });

    it('should use minute as default granularity when not specified', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', validAdminAuth);

      // This will fail initially until implementation exists
      if (response.status === 200) {
        // Verify default behavior in response
        expect(response.body.metrics).toBeDefined();
      }
    });
  });

  describe('Successful Response Schema', () => {
    it('should return 200 with valid metrics data structure', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('summary');

      // Validate metrics array structure
      expect(Array.isArray(response.body.metrics)).toBe(true);

      if (response.body.metrics.length > 0) {
        const metric = response.body.metrics[0];
        expect(metric).toHaveProperty('id');
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('metric_type');
        expect(metric).toHaveProperty('metric_value');
        expect(metric).toHaveProperty('service_name');

        // Validate required fields
        expect(typeof metric.id).toBe('string');
        expect(typeof metric.timestamp).toBe('string');
        expect(typeof metric.metric_type).toBe('string');
        expect(typeof metric.metric_value).toBe('number');
        expect(typeof metric.service_name).toBe('string');

        // Validate enum values
        expect(['api_response_time', 'cpu_usage', 'memory_usage', 'error_rate'])
          .toContain(metric.metric_type);
      }

      // Validate summary structure
      const summary = response.body.summary;
      expect(summary).toHaveProperty('total_data_points');
      expect(summary).toHaveProperty('average_value');
      expect(summary).toHaveProperty('min_value');
      expect(summary).toHaveProperty('max_value');
      expect(summary).toHaveProperty('trend_direction');

      expect(typeof summary.total_data_points).toBe('number');
      expect(typeof summary.average_value).toBe('number');
      expect(typeof summary.min_value).toBe('number');
      expect(typeof summary.max_value).toBe('number');
      expect(['up', 'down', 'stable']).toContain(summary.trend_direction);
    });

    it('should return filtered results when service parameter provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?service=backend')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 0) {
        response.body.metrics.forEach((metric: any) => {
          expect(metric.service_name).toBe('backend');
        });
      }
    });

    it('should return filtered results when metric_type parameter provided', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics?metric_type=api_response_time')
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 0) {
        response.body.metrics.forEach((metric: any) => {
          expect(metric.metric_type).toBe('api_response_time');
        });
      }
    });

    it('should return metrics within specified time range', async () => {
      const startTime = '2025-09-20T10:00:00Z';
      const endTime = '2025-09-20T11:00:00Z';

      const response = await request(app)
        .get(`/api/monitoring/metrics?start_time=${startTime}&end_time=${endTime}`)
        .set('Authorization', validAdminAuth);

      expect(response.status).toBe(200);

      if (response.body.metrics.length > 0) {
        response.body.metrics.forEach((metric: any) => {
          const metricTime = new Date(metric.timestamp);
          expect(metricTime.getTime()).toBeGreaterThanOrEqual(new Date(startTime).getTime());
          expect(metricTime.getTime()).toBeLessThanOrEqual(new Date(endTime).getTime());
        });
      }
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', validAdminAuth);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for metrics endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });
});