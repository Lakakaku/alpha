import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';

describe('Integration Test: Monitoring and Alerting Validation (Scenario 6)', () => {
  let server: any;

  beforeAll(async () => {
    // Monitoring integration test setup
  });

  afterAll(async () => {
    // Monitoring integration test cleanup
  });

  it('should validate uptime monitoring meets SLA requirements', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/uptime?period=day')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      period: 'day',
      uptime_percent: expect.any(Number),
      sla_target: 99.5,
      sla_status: expect.stringMatching(/^(meeting|at_risk|violated)$/),
      current_status: expect.stringMatching(/^(operational|degraded|outage)$/)
    });

    // Validate SLA compliance
    if (response.body.uptime_percent >= 99.5) {
      expect(response.body.sla_status).toBe('meeting');
    } else if (response.body.uptime_percent >= 98.0) {
      expect(response.body.sla_status).toBe('at_risk');
    } else {
      expect(response.body.sla_status).toBe('violated');
    }

    // Validate current operational status
    expect(response.body.current_status).toBe('operational'); // Should be operational for healthy system

    // Validate downtime tracking
    expect(response.body.total_downtime_minutes).toBeGreaterThanOrEqual(0);
    
    // If there are incidents, validate their structure
    if (response.body.incidents && response.body.incidents.length > 0) {
      response.body.incidents.forEach((incident: any) => {
        expect(incident).toMatchObject({
          incident_id: expect.any(String),
          start_time: expect.any(String),
          duration_minutes: expect.any(Number),
          severity: expect.stringMatching(/^(minor|major|critical)$/)
        });
        
        expect(incident.duration_minutes).toBeGreaterThan(0);
        expect(new Date(incident.start_time)).toBeInstanceOf(Date);
      });
    }
  });

  it('should validate performance monitoring and SLA compliance', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/performance?timeframe=1h')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      timeframe: '1h',
      metrics: expect.arrayContaining([]),
      sla_compliance: expect.objectContaining({
        target_response_time_ms: 2000,
        current_avg_response_time_ms: expect.any(Number),
        p95_response_time_ms: expect.any(Number),
        meets_sla: expect.any(Boolean)
      })
    });

    // Validate SLA compliance logic
    const sla = response.body.sla_compliance;
    expect(sla.meets_sla).toBe(sla.p95_response_time_ms <= sla.target_response_time_ms);

    // Performance should be reasonable
    expect(sla.current_avg_response_time_ms).toBeLessThan(1000); // Average should be <1s
    expect(sla.p95_response_time_ms).toBeLessThan(2000); // P95 should meet SLA

    // Validate metrics structure
    response.body.metrics.forEach((metric: any) => {
      expect(metric).toMatchObject({
        timestamp: expect.any(String),
        app_name: expect.stringMatching(/^(backend|customer|business|admin)$/),
        avg_response_time_ms: expect.any(Number)
      });

      expect(metric.avg_response_time_ms).toBeGreaterThan(0);
      expect(new Date(metric.timestamp)).toBeInstanceOf(Date);

      // Optional fields validation
      if (metric.error_rate_percent) {
        expect(metric.error_rate_percent).toBeLessThan(5); // Error rate should be <5%
      }
    });
  });

  it('should validate alert system responsiveness', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/alerts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      alerts: expect.arrayContaining([]),
      summary: expect.objectContaining({
        total_alerts: expect.any(Number),
        critical_count: expect.any(Number),
        warning_count: expect.any(Number),
        info_count: expect.any(Number)
      })
    });

    // Summary counts should add up
    const summary = response.body.summary;
    expect(summary.total_alerts).toBe(
      summary.critical_count + summary.warning_count + summary.info_count
    );

    // Validate alert structure
    response.body.alerts.forEach((alert: any) => {
      expect(alert).toMatchObject({
        alert_id: expect.any(String),
        created_at: expect.any(String),
        severity: expect.stringMatching(/^(info|warning|critical)$/),
        category: expect.stringMatching(/^(uptime|performance|security|backup|ssl)$/),
        title: expect.any(String),
        status: expect.stringMatching(/^(active|acknowledged|resolved)$/)
      });

      expect(new Date(alert.created_at)).toBeInstanceOf(Date);
      expect(alert.title.length).toBeGreaterThan(0);

      // If alert is resolved, should have resolution timestamp
      if (alert.status === 'resolved') {
        expect(alert.resolved_at).toBeTruthy();
        expect(new Date(alert.resolved_at)).toBeInstanceOf(Date);
      }

      // If alert is acknowledged, should have acknowledger
      if (alert.status === 'acknowledged') {
        expect(alert.acknowledged_by).toBeTruthy();
      }
    });

    // System should not have too many critical alerts
    expect(summary.critical_count).toBeLessThan(5);
  });

  it('should validate SSL certificate monitoring', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/ssl')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toMatchObject({
      certificates: expect.arrayContaining([]),
      overall_status: expect.stringMatching(/^(healthy|warning|critical)$/)
    });

    // Should have certificates for all domains
    const expectedDomains = ['api.vocilia.com', 'customer.vocilia.com', 'business.vocilia.com', 'admin.vocilia.com'];
    const certificateDomains = response.body.certificates.map((cert: any) => cert.domain);
    
    expectedDomains.forEach(domain => {
      expect(certificateDomains).toContain(domain);
    });

    // Validate certificate details
    response.body.certificates.forEach((cert: any) => {
      expect(cert).toMatchObject({
        domain: expect.any(String),
        platform: expect.stringMatching(/^(railway|vercel)$/),
        status: expect.stringMatching(/^(active|pending|expired|failed|renewing)$/),
        expires_at: expect.any(String)
      });

      expect(new Date(cert.expires_at)).toBeInstanceOf(Date);

      // Certificate should not be expired
      const expirationDate = new Date(cert.expires_at);
      const now = new Date();
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());

      // Should have reasonable expiration (not too soon)
      const daysUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysUntilExpiry).toBeGreaterThan(7); // Should have >7 days before expiration

      if (cert.days_until_expiry) {
        expect(cert.days_until_expiry).toBeGreaterThan(7);
      }

      // Auto renewal should be enabled
      if (cert.auto_renewal_enabled !== undefined) {
        expect(cert.auto_renewal_enabled).toBe(true);
      }
    });

    // Check for expiring certificates
    if (response.body.expiring_soon) {
      response.body.expiring_soon.forEach((expiring: any) => {
        expect(expiring).toMatchObject({
          domain: expect.any(String),
          expires_in_days: expect.any(Number)
        });
        
        // Should alert before 30 days
        expect(expiring.expires_in_days).toBeLessThan(30);
        expect(expiring.expires_in_days).toBeGreaterThan(0);
      });
    }
  });

  it('should validate monitoring data aggregation and retention', async () => {
    // Test different time periods
    const periods = ['hour', 'day', 'week'];
    
    for (const period of periods) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/uptime?period=${period}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body.period).toBe(period);
      expect(response.body.uptime_percent).toBeGreaterThanOrEqual(0);
      expect(response.body.uptime_percent).toBeLessThanOrEqual(100);
    }

    // Test performance metrics aggregation
    const timeframes = ['1h', '6h', '24h'];
    
    for (const timeframe of timeframes) {
      const perfResponse = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/performance?timeframe=${timeframe}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(perfResponse.body.timeframe).toBe(timeframe);
      expect(perfResponse.body.metrics).toEqual(expect.arrayContaining([]));
    }
  });

  it('should validate alert escalation and notification system', async () => {
    // Test alert filtering by severity
    const severities = ['info', 'warning', 'critical'];
    
    for (const severity of severities) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/alerts?severity=${severity}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      // All returned alerts should match the requested severity
      response.body.alerts.forEach((alert: any) => {
        expect(alert.severity).toBe(severity);
      });
    }

    // Test alert filtering by category
    const categories = ['uptime', 'performance', 'security', 'backup'];
    
    for (const category of categories) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/alerts?category=${category}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      // All returned alerts should match the requested category
      response.body.alerts.forEach((alert: any) => {
        expect(alert.category).toBe(category);
      });
    }
  });

  it('should validate monitoring system performance under load', async () => {
    // Test concurrent monitoring requests
    const concurrentRequests = 10;
    const endpoints = [
      '/api/admin/monitoring/uptime',
      '/api/admin/monitoring/performance',
      '/api/admin/monitoring/alerts',
      '/api/admin/monitoring/ssl'
    ];

    for (const endpoint of endpoints) {
      const promises = Array.from({ length: concurrentRequests }, () => {
        const startTime = Date.now();
        return request(API_BASE_URL)
          .get(endpoint)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .then(response => {
            const responseTime = Date.now() - startTime;
            return { status: response.status, responseTime };
          });
      });

      const results = await Promise.all(promises);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.responseTime).toBeLessThan(3000); // Monitoring should handle concurrent load
      });
    }
  });

  it('should validate monitoring data consistency across endpoints', async () => {
    // Get uptime data
    const uptimeResponse = await request(API_BASE_URL)
      .get('/api/admin/monitoring/uptime?period=day')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    // Get performance data
    const perfResponse = await request(API_BASE_URL)
      .get('/api/admin/monitoring/performance?timeframe=24h')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    // Data should be consistent
    if (uptimeResponse.body.current_status === 'operational') {
      expect(perfResponse.body.sla_compliance.meets_sla).toBe(true);
    }

    // If uptime is low, should have performance issues or alerts
    if (uptimeResponse.body.uptime_percent < 99.0) {
      const alertsResponse = await request(API_BASE_URL)
        .get('/api/admin/monitoring/alerts?severity=critical')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      // Should have critical alerts for low uptime
      expect(alertsResponse.body.summary.critical_count).toBeGreaterThan(0);
    }
  });
});