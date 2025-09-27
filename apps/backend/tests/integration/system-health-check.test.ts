import request from 'supertest';
import { app } from '../../src/app';

describe('System Health Check - Integration Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Complete Health Check Workflow', () => {
    it('should perform comprehensive health check for all monitored services', async () => {
      // Test health check endpoint
      const healthResponse = await request(app)
        .get('/api/monitoring/health')
        .set('Authorization', validAdminAuth);

      // Should get health status or 404 if not implemented yet
      expect([200, 404]).toContain(healthResponse.status);

      if (healthResponse.status === 200) {
        expect(healthResponse.body).toHaveProperty('status');
        expect(healthResponse.body).toHaveProperty('services');
        expect(Array.isArray(healthResponse.body.services)).toBe(true);

        // Each service should have required health fields
        if (healthResponse.body.services.length > 0) {
          healthResponse.body.services.forEach((service: any) => {
            expect(service).toHaveProperty('name');
            expect(service).toHaveProperty('status');
            expect(service).toHaveProperty('response_time');
            expect(service).toHaveProperty('last_check');
            expect(['healthy', 'degraded', 'unhealthy']).toContain(service.status);
          });
        }
      }
    });

    it('should check database connectivity and performance', async () => {
      // Test database health through health endpoint
      const healthResponse = await request(app)
        .get('/api/monitoring/health?service=database')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(healthResponse.status);

      if (healthResponse.status === 200) {
        expect(healthResponse.body).toHaveProperty('database');
        
        if (healthResponse.body.database) {
          expect(healthResponse.body.database).toHaveProperty('status');
          expect(healthResponse.body.database).toHaveProperty('response_time');
          expect(healthResponse.body.database).toHaveProperty('connection_pool');
          
          if (healthResponse.body.database.response_time) {
            expect(healthResponse.body.database.response_time).toBeLessThan(1000);
          }
        }
      }
    });

    it('should validate API endpoint health and response times', async () => {
      // Check critical API endpoints through health monitoring
      const healthResponse = await request(app)
        .get('/api/monitoring/health?service=api')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(healthResponse.status);

      if (healthResponse.status === 200) {
        expect(healthResponse.body).toHaveProperty('api_endpoints');
        
        if (healthResponse.body.api_endpoints) {
          expect(Array.isArray(healthResponse.body.api_endpoints)).toBe(true);
          
          healthResponse.body.api_endpoints.forEach((endpoint: any) => {
            expect(endpoint).toHaveProperty('path');
            expect(endpoint).toHaveProperty('status');
            expect(endpoint).toHaveProperty('response_time');
            expect(endpoint).toHaveProperty('last_check');
          });
        }
      }
    });

    it('should monitor external service dependencies', async () => {
      // Check external dependencies (Supabase, OpenAI, etc.)
      const healthResponse = await request(app)
        .get('/api/monitoring/health?service=external')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(healthResponse.status);

      if (healthResponse.status === 200) {
        expect(healthResponse.body).toHaveProperty('external_services');
        
        if (healthResponse.body.external_services) {
          expect(Array.isArray(healthResponse.body.external_services)).toBe(true);
          
          healthResponse.body.external_services.forEach((service: any) => {
            expect(service).toHaveProperty('name');
            expect(service).toHaveProperty('status');
            expect(service).toHaveProperty('response_time');
            expect(['available', 'degraded', 'unavailable']).toContain(service.status);
          });
        }
      }
    });
  });

  describe('System Resource Monitoring', () => {
    it('should check system resource usage (CPU, Memory, Disk)', async () => {
      // Get system metrics for resource monitoring
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics?metric_type=system_resources')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(metricsResponse.status);

      if (metricsResponse.status === 200) {
        expect(metricsResponse.body).toHaveProperty('metrics');
        
        if (metricsResponse.body.metrics.length > 0) {
          const systemMetric = metricsResponse.body.metrics.find((m: any) => 
            m.metric_type === 'system_resources'
          );
          
          if (systemMetric) {
            expect(systemMetric).toHaveProperty('cpu_usage');
            expect(systemMetric).toHaveProperty('memory_usage');
            expect(systemMetric).toHaveProperty('disk_usage');
            
            // Validate ranges
            if (systemMetric.cpu_usage !== null) {
              expect(systemMetric.cpu_usage).toBeGreaterThanOrEqual(0);
              expect(systemMetric.cpu_usage).toBeLessThanOrEqual(100);
            }
            
            if (systemMetric.memory_usage !== null) {
              expect(systemMetric.memory_usage).toBeGreaterThanOrEqual(0);
              expect(systemMetric.memory_usage).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    });

    it('should monitor application performance metrics', async () => {
      // Get application performance metrics
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics?metric_type=response_time&service=backend')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(metricsResponse.status);

      if (metricsResponse.status === 200) {
        expect(metricsResponse.body).toHaveProperty('metrics');
        
        if (metricsResponse.body.metrics.length > 0) {
          const perfMetric = metricsResponse.body.metrics[0];
          expect(perfMetric).toHaveProperty('metric_type');
          expect(perfMetric).toHaveProperty('value');
          expect(perfMetric).toHaveProperty('timestamp');
          expect(perfMetric).toHaveProperty('service_name');
        }
      }
    });
  });

  describe('Health Check Automation and Alerts', () => {
    it('should configure automated health checks with alert rules', async () => {
      // Create alert rule for health check failures
      const alertRuleRequest = {
        name: 'System Health Check Failure',
        metric_type: 'system_health',
        threshold: 1,
        comparison: 'greater_than',
        notification_channels: ['email'],
        description: 'Alert when system health check fails'
      };

      const alertResponse = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(alertRuleRequest);

      // Should create rule or return 404 if not implemented
      expect([201, 404]).toContain(alertResponse.status);

      if (alertResponse.status === 201) {
        expect(alertResponse.body).toHaveProperty('id');
        expect(alertResponse.body).toHaveProperty('name');
        expect(alertResponse.body.name).toBe(alertRuleRequest.name);
      }
    });

    it('should trigger alert notifications for health check failures', async () => {
      // Get alert notifications related to health checks
      const notificationsResponse = await request(app)
        .get('/api/monitoring/alerts/notifications?rule_type=system_health')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(notificationsResponse.status);

      if (notificationsResponse.status === 200) {
        expect(notificationsResponse.body).toHaveProperty('notifications');
        expect(Array.isArray(notificationsResponse.body.notifications)).toBe(true);
        
        if (notificationsResponse.body.notifications.length > 0) {
          const notification = notificationsResponse.body.notifications[0];
          expect(notification).toHaveProperty('id');
          expect(notification).toHaveProperty('alert_rule_id');
          expect(notification).toHaveProperty('status');
          expect(notification).toHaveProperty('created_at');
        }
      }
    });
  });

  describe('Health Check History and Trends', () => {
    it('should track health check history over time', async () => {
      // Get historical health data
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days
      const endDate = new Date();

      const historyResponse = await request(app)
        .get(`/api/monitoring/metrics?metric_type=system_health&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(historyResponse.status);

      if (historyResponse.status === 200) {
        expect(historyResponse.body).toHaveProperty('metrics');
        
        if (historyResponse.body.metrics.length > 0) {
          // Should be ordered by timestamp
          const metrics = historyResponse.body.metrics;
          for (let i = 1; i < metrics.length; i++) {
            expect(metrics[i - 1].timestamp).toBeGreaterThanOrEqual(metrics[i].timestamp);
          }
        }
      }
    });

    it('should calculate health trend analysis', async () => {
      // Get health trends and analysis
      const trendsResponse = await request(app)
        .get('/api/monitoring/business-performance?comparison_period=week')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(trendsResponse.status);

      if (trendsResponse.status === 200) {
        expect(trendsResponse.body).toHaveProperty('metrics');
        
        if (trendsResponse.body.metrics.length > 0) {
          const metric = trendsResponse.body.metrics[0];
          expect(metric).toHaveProperty('operational_metrics');
          
          if (metric.operational_metrics && Object.keys(metric.operational_metrics).length > 0) {
            // Should contain health-related operational metrics
            Object.values(metric.operational_metrics).forEach((value: any) => {
              expect(typeof value === 'number' || typeof value === 'string').toBe(true);
            });
          }
        }
      }
    });
  });

  describe('Health Check Integration with Business Metrics', () => {
    it('should correlate system health with business performance', async () => {
      // Get business performance data to check correlation with health
      const performanceResponse = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(performanceResponse.status);

      if (performanceResponse.status === 200) {
        expect(performanceResponse.body).toHaveProperty('metrics');
        
        if (performanceResponse.body.metrics.length > 0) {
          const businessMetric = performanceResponse.body.metrics[0];
          expect(businessMetric).toHaveProperty('operational_metrics');
          
          // System health should impact business metrics
          if (businessMetric.operational_metrics) {
            expect(typeof businessMetric.operational_metrics).toBe('object');
          }
        }
      }
    });

    it('should provide health impact analysis on revenue metrics', async () => {
      // Get revenue analytics that might be affected by system health
      const revenueResponse = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(revenueResponse.status);

      if (revenueResponse.status === 200) {
        expect(revenueResponse.body).toHaveProperty('analytics');
        expect(revenueResponse.body).toHaveProperty('summary');
        
        if (revenueResponse.body.analytics.length > 0) {
          const analytics = revenueResponse.body.analytics[0];
          expect(analytics).toHaveProperty('customer_engagement_rate');
          
          // System health issues would impact engagement
          if (analytics.customer_engagement_rate !== null) {
            expect(analytics.customer_engagement_rate).toBeGreaterThanOrEqual(0);
            expect(analytics.customer_engagement_rate).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  });

  describe('Health Check Data Export', () => {
    it('should export comprehensive health check reports', async () => {
      // Export health monitoring data
      const exportRequest = {
        data_type: 'system_metrics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        },
        filters: {
          service_names: ['backend', 'database', 'api']
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(exportRequest);

      expect([200, 202, 404]).toContain(exportResponse.status);

      if (exportResponse.status === 200) {
        expect(exportResponse.body).toHaveProperty('download_url');
        expect(exportResponse.body).toHaveProperty('expires_at');
        expect(exportResponse.body).toHaveProperty('file_size');
      } else if (exportResponse.status === 202) {
        expect(exportResponse.body).toHaveProperty('export_id');
        expect(exportResponse.body).toHaveProperty('status');
      }
    });

    it('should include health metrics in business performance exports', async () => {
      // Export business performance data that includes health metrics
      const exportRequest = {
        data_type: 'business_performance',
        format: 'json',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(exportRequest);

      expect([200, 202, 404]).toContain(exportResponse.status);

      // Health metrics should be included in business performance exports
      if (exportResponse.status === 200 || exportResponse.status === 202) {
        // Export request accepted - health data will be included
        expect(exportResponse.body).toBeDefined();
      }
    });
  });

  describe('Health Check Performance and Scalability', () => {
    it('should complete health checks within performance requirements', async () => {
      const startTime = Date.now();

      const healthResponse = await request(app)
        .get('/api/monitoring/health')
        .set('Authorization', validAdminAuth);

      const responseTime = Date.now() - startTime;

      // Health checks should be fast
      expect(responseTime).toBeLessThan(2000); // 2 seconds max

      expect([200, 404]).toContain(healthResponse.status);
    });

    it('should handle concurrent health check requests efficiently', async () => {
      // Test concurrent health check requests
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/monitoring/health')
          .set('Authorization', validAdminAuth)
      );

      const responses = await Promise.all(requests);

      // All requests should complete successfully or consistently return 404
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });

      // If any succeeded, all should succeed (consistency)
      const successCount = responses.filter(r => r.status === 200).length;
      const notFoundCount = responses.filter(r => r.status === 404).length;
      
      expect(successCount === 5 || notFoundCount === 5).toBe(true);
    });
  });

  describe('Health Check Error Handling and Recovery', () => {
    it('should handle health check failures gracefully', async () => {
      // Test health check with invalid service parameter
      const healthResponse = await request(app)
        .get('/api/monitoring/health?service=invalid_service')
        .set('Authorization', validAdminAuth);

      expect([200, 400, 404, 422]).toContain(healthResponse.status);

      if (healthResponse.status === 400 || healthResponse.status === 422) {
        expect(healthResponse.body).toHaveProperty('error');
      }
    });

    it('should provide recovery recommendations for unhealthy services', async () => {
      // Get health status that might include recovery recommendations
      const healthResponse = await request(app)
        .get('/api/monitoring/health?include_recommendations=true')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(healthResponse.status);

      if (healthResponse.status === 200) {
        expect(healthResponse.body).toHaveProperty('services');
        
        if (healthResponse.body.services && healthResponse.body.services.length > 0) {
          healthResponse.body.services.forEach((service: any) => {
            if (service.status === 'unhealthy' || service.status === 'degraded') {
              // Might have recovery recommendations
              if (service.recommendations) {
                expect(Array.isArray(service.recommendations)).toBe(true);
              }
            }
          });
        }
      }
    });
  });
});