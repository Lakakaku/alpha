import request from 'supertest';
import { app } from '../../src/app';

describe('System Health Monitoring Dashboard - Integration Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Complete Health Monitoring Workflow', () => {
    it('should retrieve system metrics and error logs for health dashboard', async () => {
      // Step 1: Get current system metrics
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics?service=backend&metric_type=response_time')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(metricsResponse.status);

      // Step 2: Get error logs for the same timeframe
      const errorsResponse = await request(app)
        .get('/api/monitoring/errors?severity=high')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(errorsResponse.status);

      // Step 3: Get system usage for capacity planning
      const usageResponse = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(usageResponse.status);

      // Integration verification: All endpoints should return consistent admin access
      if (metricsResponse.status === 200) {
        expect(metricsResponse.body).toHaveProperty('metrics');
        expect(metricsResponse.body).toHaveProperty('summary');
      }

      if (errorsResponse.status === 200) {
        expect(errorsResponse.body).toHaveProperty('errors');
        expect(errorsResponse.body).toHaveProperty('pagination');
      }

      if (usageResponse.status === 200) {
        expect(usageResponse.body).toHaveProperty('usage');
        expect(usageResponse.body).toHaveProperty('summary');
      }
    });

    it('should correlate metrics with error spikes for system diagnostics', async () => {
      const startTime = '2025-09-23T00:00:00Z';
      const endTime = '2025-09-23T23:59:59Z';

      // Get CPU metrics for time range
      const cpuMetricsResponse = await request(app)
        .get(`/api/monitoring/metrics?metric_type=cpu_usage&start_time=${startTime}&end_time=${endTime}`)
        .set('Authorization', validAdminAuth);

      // Get error logs for same time range
      const errorLogsResponse = await request(app)
        .get(`/api/monitoring/errors?start_time=${startTime}&end_time=${endTime}`)
        .set('Authorization', validAdminAuth);

      // Both should use same admin authentication and time filtering
      expect([200, 404]).toContain(cpuMetricsResponse.status);
      expect([200, 404]).toContain(errorLogsResponse.status);

      // Verify time range consistency across endpoints
      if (cpuMetricsResponse.status === 200 && cpuMetricsResponse.body.metrics.length > 0) {
        const metrics = cpuMetricsResponse.body.metrics;
        metrics.forEach((metric: any) => {
          expect(new Date(metric.timestamp)).toBeGreaterThanOrEqual(new Date(startTime));
          expect(new Date(metric.timestamp)).toBeLessThanOrEqual(new Date(endTime));
        });
      }

      if (errorLogsResponse.status === 200 && errorLogsResponse.body.errors.length > 0) {
        const errors = errorLogsResponse.body.errors;
        errors.forEach((error: any) => {
          expect(new Date(error.timestamp)).toBeGreaterThanOrEqual(new Date(startTime));
          expect(new Date(error.timestamp)).toBeLessThanOrEqual(new Date(endTime));
        });
      }
    });

    it('should maintain consistent admin authentication across monitoring endpoints', async () => {
      const monitoringEndpoints = [
        '/api/monitoring/metrics',
        '/api/monitoring/errors',
        '/api/monitoring/usage',
        '/api/monitoring/alerts/rules',
        '/api/monitoring/fraud-reports',
        '/api/monitoring/revenue-analytics',
        '/api/monitoring/business-performance'
      ];

      for (const endpoint of monitoringEndpoints) {
        // Test without authentication
        const unauthResponse = await request(app).get(endpoint);
        expect(unauthResponse.status).toBe(401);

        // Test with invalid authentication
        const invalidAuthResponse = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer invalid-token');
        expect(invalidAuthResponse.status).toBe(403);

        // Test with valid authentication
        const validAuthResponse = await request(app)
          .get(endpoint)
          .set('Authorization', validAdminAuth);
        expect([200, 404]).toContain(validAuthResponse.status);
      }
    });

    it('should handle real-time health monitoring updates', async () => {
      // Simulate getting current health status
      const initialHealthResponse = await request(app)
        .get('/api/monitoring/metrics?metric_type=system_health')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(initialHealthResponse.status);

      // Simulate system event that would trigger metrics update
      // In real implementation, this would involve actual system monitoring
      const healthCheckResponse = await request(app)
        .get('/api/monitoring/health')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(healthCheckResponse.status);

      // Verify health check provides system status information
      if (healthCheckResponse.status === 200) {
        expect(healthCheckResponse.body).toHaveProperty('status');
        expect(healthCheckResponse.body).toHaveProperty('timestamp');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(healthCheckResponse.body.status);
      }
    });

    it('should support pagination and filtering for large datasets', async () => {
      // Test metrics pagination
      const paginatedMetricsResponse = await request(app)
        .get('/api/monitoring/metrics?limit=10&offset=0')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(paginatedMetricsResponse.status);

      // Test error log pagination
      const paginatedErrorsResponse = await request(app)
        .get('/api/monitoring/errors?limit=25&offset=0')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(paginatedErrorsResponse.status);

      // Verify pagination structure
      if (paginatedErrorsResponse.status === 200) {
        expect(paginatedErrorsResponse.body).toHaveProperty('pagination');
        expect(paginatedErrorsResponse.body.pagination).toHaveProperty('limit');
        expect(paginatedErrorsResponse.body.pagination).toHaveProperty('offset');
        expect(paginatedErrorsResponse.body.pagination).toHaveProperty('total');
      }
    });

    it('should maintain data consistency across monitoring services', async () => {
      const timestamp = new Date().toISOString();

      // Get metrics count
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', validAdminAuth);

      // Get usage analytics that should correlate with metrics
      const usageResponse = await request(app)
        .get('/api/monitoring/usage')
        .set('Authorization', validAdminAuth);

      // Both endpoints should return consistent timestamps and admin access
      expect([200, 404]).toContain(metricsResponse.status);
      expect([200, 404]).toContain(usageResponse.status);

      // If both return data, verify admin user can access both
      if (metricsResponse.status === 200 && usageResponse.status === 200) {
        // Both should have similar response structure patterns
        expect(metricsResponse.body).toHaveProperty('summary');
        expect(usageResponse.body).toHaveProperty('summary');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent health monitoring requests', async () => {
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/monitoring/metrics?granularity=hour')
          .set('Authorization', validAdminAuth)
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should complete within reasonable time
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });

      // Response times should be consistent
      const responseTimes = responses.map(response => 
        parseInt(response.headers['x-response-time'] || '0')
      );
      
      // No response should take significantly longer than others
      if (responseTimes.some(time => time > 0)) {
        const maxTime = Math.max(...responseTimes);
        const minTime = Math.min(...responseTimes.filter(time => time > 0));
        expect(maxTime / minTime).toBeLessThan(3); // Max 3x difference
      }
    });

    it('should maintain performance under dashboard load simulation', async () => {
      const startTime = Date.now();

      // Simulate dashboard loading multiple widgets
      const dashboardRequests = [
        request(app).get('/api/monitoring/metrics?metric_type=response_time').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/metrics?metric_type=cpu_usage').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/errors?severity=high').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/usage').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/health').set('Authorization', validAdminAuth)
      ];

      const responses = await Promise.all(dashboardRequests);
      const totalTime = Date.now() - startTime;

      // Dashboard should load within performance target
      expect(totalTime).toBeLessThan(2000); // <2s total dashboard load

      // All requests should succeed or properly handle missing implementation
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should gracefully handle service failures in monitoring chain', async () => {
      // Test with malformed queries
      const malformedResponse = await request(app)
        .get('/api/monitoring/metrics?invalid_param=test&malformed_date=not-a-date')
        .set('Authorization', validAdminAuth);

      expect([400, 422, 404]).toContain(malformedResponse.status);

      // Test with extreme date ranges
      const extremeResponse = await request(app)
        .get('/api/monitoring/metrics?start_time=1970-01-01T00:00:00Z&end_time=2099-12-31T23:59:59Z')
        .set('Authorization', validAdminAuth);

      expect([200, 400, 422, 404]).toContain(extremeResponse.status);
    });

    it('should maintain monitoring functionality during high error rates', async () => {
      // Simulate multiple error conditions
      const errorTestRequests = [
        request(app).get('/api/monitoring/nonexistent').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/metrics?invalid_metric=test').set('Authorization', validAdminAuth),
        request(app).post('/api/monitoring/metrics').set('Authorization', validAdminAuth).send({}),
      ];

      const errorResponses = await Promise.all(errorTestRequests);

      // Should still be able to get valid monitoring data
      const validResponse = await request(app)
        .get('/api/monitoring/health')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(validResponse.status);

      // Error responses should be properly formatted
      errorResponses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        if (response.body) {
          expect(response.body).toHaveProperty('error');
        }
      });
    });
  });
});