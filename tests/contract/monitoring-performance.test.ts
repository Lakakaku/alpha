import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';

describe('Contract Test: GET /api/admin/monitoring/performance', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return performance metrics for default timeframe', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/performance')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - performance metrics schema
    expect(response.body).toMatchObject({
      timeframe: expect.any(String),
      metrics: expect.arrayContaining([]),
      sla_compliance: expect.objectContaining({
        target_response_time_ms: 2000,
        current_avg_response_time_ms: expect.any(Number),
        p95_response_time_ms: expect.any(Number),
        meets_sla: expect.any(Boolean)
      })
    });

    // SLA compliance validation
    const sla = response.body.sla_compliance;
    expect(sla.current_avg_response_time_ms).toBeGreaterThan(0);
    expect(sla.p95_response_time_ms).toBeGreaterThan(0);
    expect(sla.meets_sla).toBe(sla.p95_response_time_ms <= sla.target_response_time_ms);

    // Metrics validation
    response.body.metrics.forEach((metric: any) => {
      expect(metric).toMatchObject({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        app_name: expect.stringMatching(/^(backend|customer|business|admin)$/),
        avg_response_time_ms: expect.any(Number)
      });

      expect(metric.avg_response_time_ms).toBeGreaterThan(0);
      expect(new Date(metric.timestamp)).toBeInstanceOf(Date);

      // Optional fields validation
      if (metric.p95_response_time_ms) {
        expect(metric.p95_response_time_ms).toBeGreaterThanOrEqual(metric.avg_response_time_ms);
      }
      if (metric.error_rate_percent) {
        expect(metric.error_rate_percent).toBeGreaterThanOrEqual(0);
        expect(metric.error_rate_percent).toBeLessThanOrEqual(100);
      }
      if (metric.request_count) {
        expect(metric.request_count).toBeGreaterThanOrEqual(0);
      }
    });

    // Alerts validation (optional)
    if (response.body.alerts) {
      response.body.alerts.forEach((alert: any) => {
        expect(alert).toMatchObject({
          alert_id: expect.any(String),
          triggered_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
          metric: expect.stringMatching(/^(response_time|error_rate|throughput)$/),
          current_value: expect.any(Number),
          threshold: expect.any(Number),
          severity: expect.stringMatching(/^(warning|critical)$/)
        });
      });
    }
  });

  it('should accept timeframe query parameter', async () => {
    const timeframes = ['1h', '6h', '24h', '7d'];
    
    for (const timeframe of timeframes) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/performance?timeframe=${timeframe}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.timeframe).toBe(timeframe);
    }
  });

  it('should accept app query parameter', async () => {
    const apps = ['backend', 'customer', 'business', 'admin'];
    
    for (const app of apps) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/performance?app=${app}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Should filter metrics to only include the specified app
      response.body.metrics.forEach((metric: any) => {
        expect(metric.app_name).toBe(app);
      });
    }
  });

  it('should indicate SLA violation when response times exceed 2000ms', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/performance')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    const sla = response.body.sla_compliance;
    if (sla.p95_response_time_ms > 2000) {
      expect(sla.meets_sla).toBe(false);
    } else {
      expect(sla.meets_sla).toBe(true);
    }
  });

  it('should require admin authentication', async () => {
    await request(API_BASE_URL)
      .get('/api/admin/monitoring/performance')
      .expect(401);
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/api/admin/monitoring/performance')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000); // Performance monitoring should be <2s
  });
});