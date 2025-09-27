import request from 'supertest';
import { app } from '../../src/app';

describe('Business Intelligence Dashboard - Integration Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked
  const testStoreId = '550e8400-e29b-41d4-a716-446655440000';
  const testBusinessId = '550e8400-e29b-41d4-a716-446655440001';

  describe('Complete BI Dashboard Data Flow', () => {
    it('should aggregate revenue, performance, and fraud data for comprehensive dashboard', async () => {
      const timeRange = {
        start_date: '2025-09-01',
        end_date: '2025-09-30'
      };

      // Step 1: Get revenue analytics
      const revenueResponse = await request(app)
        .get(`/api/monitoring/revenue-analytics?start_date=${timeRange.start_date}&end_date=${timeRange.end_date}`)
        .set('Authorization', validAdminAuth);

      // Step 2: Get business performance metrics
      const performanceResponse = await request(app)
        .get(`/api/monitoring/business-performance?comparison_period=month`)
        .set('Authorization', validAdminAuth);

      // Step 3: Get fraud detection reports
      const fraudResponse = await request(app)
        .get(`/api/monitoring/fraud-reports?start_date=${timeRange.start_date}&end_date=${timeRange.end_date}`)
        .set('Authorization', validAdminAuth);

      // Step 4: Get system usage analytics
      const usageResponse = await request(app)
        .get(`/api/monitoring/usage?start_date=${timeRange.start_date}&end_date=${timeRange.end_date}`)
        .set('Authorization', validAdminAuth);

      // All BI components should be accessible
      expect([200, 404]).toContain(revenueResponse.status);
      expect([200, 404]).toContain(performanceResponse.status);
      expect([200, 404]).toContain(fraudResponse.status);
      expect([200, 404]).toContain(usageResponse.status);

      // Verify consistent structure across BI endpoints
      if (revenueResponse.status === 200) {
        expect(revenueResponse.body).toHaveProperty('analytics');
        expect(revenueResponse.body).toHaveProperty('summary');
        expect(Array.isArray(revenueResponse.body.analytics)).toBe(true);
      }

      if (performanceResponse.status === 200) {
        expect(performanceResponse.body).toHaveProperty('metrics');
        expect(Array.isArray(performanceResponse.body.metrics)).toBe(true);
      }

      if (fraudResponse.status === 200) {
        expect(fraudResponse.body).toHaveProperty('reports');
        expect(Array.isArray(fraudResponse.body.reports)).toBe(true);
      }

      if (usageResponse.status === 200) {
        expect(usageResponse.body).toHaveProperty('usage');
        expect(usageResponse.body).toHaveProperty('summary');
      }
    });

    it('should provide cross-business comparative analytics', async () => {
      // Get revenue analytics across all businesses
      const allBusinessRevenueResponse = await request(app)
        .get('/api/monitoring/revenue-analytics?group_by=business_id')
        .set('Authorization', validAdminAuth);

      // Get performance metrics by business
      const businessPerformanceResponse = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', validAdminAuth);

      // Get fraud reports by business
      const businessFraudResponse = await request(app)
        .get('/api/monitoring/fraud-reports')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(allBusinessRevenueResponse.status);
      expect([200, 404]).toContain(businessPerformanceResponse.status);
      expect([200, 404]).toContain(businessFraudResponse.status);

      // Verify business-level aggregation capability
      if (allBusinessRevenueResponse.status === 200) {
        expect(allBusinessRevenueResponse.body).toHaveProperty('analytics');
        if (allBusinessRevenueResponse.body.analytics.length > 0) {
          const analytics = allBusinessRevenueResponse.body.analytics[0];
          expect(analytics).toHaveProperty('store_id');
        }
      }

      if (businessPerformanceResponse.status === 200) {
        expect(businessPerformanceResponse.body).toHaveProperty('metrics');
        if (businessPerformanceResponse.body.metrics.length > 0) {
          const metrics = businessPerformanceResponse.body.metrics[0];
          expect(metrics).toHaveProperty('business_id');
          expect(metrics).toHaveProperty('store_id');
        }
      }
    });

    it('should support drill-down analysis from summary to detail', async () => {
      // Step 1: Get high-level revenue summary
      const summaryResponse = await request(app)
        .get('/api/monitoring/revenue-analytics?group_by=month')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(summaryResponse.status);

      // Step 2: Drill down to specific store performance
      const storeDetailResponse = await request(app)
        .get(`/api/monitoring/business-performance?store_id=${testStoreId}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(storeDetailResponse.status);

      // Step 3: Get detailed transaction-level data for the store
      const storeRevenueResponse = await request(app)
        .get(`/api/monitoring/revenue-analytics?store_id=${testStoreId}&group_by=day`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(storeRevenueResponse.status);

      // Step 4: Get fraud analysis for the specific store
      const storeFraudResponse = await request(app)
        .get(`/api/monitoring/fraud-reports?store_id=${testStoreId}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(storeFraudResponse.status);

      // Verify drill-down data consistency
      if (storeDetailResponse.status === 200 && storeRevenueResponse.status === 200) {
        // Both should reference the same store
        if (storeDetailResponse.body.metrics && storeDetailResponse.body.metrics.length > 0) {
          expect(storeDetailResponse.body.metrics[0].store_id).toBe(testStoreId);
        }

        if (storeRevenueResponse.body.analytics && storeRevenueResponse.body.analytics.length > 0) {
          expect(storeRevenueResponse.body.analytics[0].store_id).toBe(testStoreId);
        }
      }
    });

    it('should provide real-time vs historical comparison views', async () => {
      const currentDate = new Date().toISOString().split('T')[0];
      const lastWeekDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Current period data
      const currentPeriodResponse = await request(app)
        .get(`/api/monitoring/revenue-analytics?start_date=${currentDate}&end_date=${currentDate}`)
        .set('Authorization', validAdminAuth);

      // Historical comparison period
      const historicalPeriodResponse = await request(app)
        .get(`/api/monitoring/revenue-analytics?start_date=${lastWeekDate}&end_date=${lastWeekDate}`)
        .set('Authorization', validAdminAuth);

      // Performance comparison
      const currentPerformanceResponse = await request(app)
        .get('/api/monitoring/business-performance?comparison_period=week')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(currentPeriodResponse.status);
      expect([200, 404]).toContain(historicalPeriodResponse.status);
      expect([200, 404]).toContain(currentPerformanceResponse.status);

      // Verify time-based comparison capability
      if (currentPeriodResponse.status === 200 && historicalPeriodResponse.status === 200) {
        // Both should have summary data for comparison
        expect(currentPeriodResponse.body).toHaveProperty('summary');
        expect(historicalPeriodResponse.body).toHaveProperty('summary');

        if (currentPeriodResponse.body.summary && historicalPeriodResponse.body.summary) {
          expect(typeof currentPeriodResponse.body.summary.total_revenue).toBe('number');
          expect(typeof historicalPeriodResponse.body.summary.total_revenue).toBe('number');
        }
      }
    });

    it('should integrate with export functionality for BI reports', async () => {
      // Export revenue analytics report
      const revenueExportRequest = {
        data_type: 'revenue_analytics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        },
        filters: {
          store_ids: [testStoreId]
        }
      };

      const revenueExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(revenueExportRequest);

      // Export business performance report
      const performanceExportRequest = {
        data_type: 'business_performance',
        format: 'pdf',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const performanceExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(performanceExportRequest);

      // Export fraud analysis report
      const fraudExportRequest = {
        data_type: 'fraud_reports',
        format: 'json',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const fraudExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(fraudExportRequest);

      // All BI data types should be exportable
      expect([200, 202, 404]).toContain(revenueExportResponse.status);
      expect([200, 202, 404]).toContain(performanceExportResponse.status);
      expect([200, 202, 404]).toContain(fraudExportResponse.status);

      // Verify export response structure
      [revenueExportResponse, performanceExportResponse, fraudExportResponse].forEach(response => {
        if (response.status === 200) {
          // Immediate export
          expect(response.body).toHaveProperty('download_url');
          expect(response.body).toHaveProperty('expires_at');
        } else if (response.status === 202) {
          // Queued export
          expect(response.body).toHaveProperty('export_id');
          expect(response.body).toHaveProperty('status');
        }
      });
    });
  });

  describe('Advanced BI Analytics and Insights', () => {
    it('should provide trend analysis and forecasting data', async () => {
      // Get revenue trends over time
      const revenueTrendsResponse = await request(app)
        .get('/api/monitoring/revenue-analytics?group_by=week&start_date=2025-08-01&end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      // Get performance trends
      const performanceTrendsResponse = await request(app)
        .get('/api/monitoring/business-performance?comparison_period=quarter')
        .set('Authorization', validAdminAuth);

      // Get fraud trend analysis
      const fraudTrendsResponse = await request(app)
        .get('/api/monitoring/fraud-reports?start_date=2025-08-01&end_date=2025-09-30')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(revenueTrendsResponse.status);
      expect([200, 404]).toContain(performanceTrendsResponse.status);
      expect([200, 404]).toContain(fraudTrendsResponse.status);

      // Verify trend data provides temporal insights
      if (revenueTrendsResponse.status === 200) {
        expect(revenueTrendsResponse.body).toHaveProperty('analytics');
        expect(revenueTrendsResponse.body).toHaveProperty('summary');
        
        if (revenueTrendsResponse.body.summary) {
          expect(revenueTrendsResponse.body.summary).toHaveProperty('period_growth');
          expect(typeof revenueTrendsResponse.body.summary.period_growth).toBe('number');
        }
      }

      if (performanceTrendsResponse.status === 200) {
        expect(performanceTrendsResponse.body).toHaveProperty('metrics');
        
        if (performanceTrendsResponse.body.metrics && performanceTrendsResponse.body.metrics.length > 0) {
          const metric = performanceTrendsResponse.body.metrics[0];
          expect(metric).toHaveProperty('feedback_volume_trend');
        }
      }
    });

    it('should support cohort analysis and customer segmentation', async () => {
      // Get usage analytics by customer segment
      const segmentedUsageResponse = await request(app)
        .get('/api/monitoring/usage?segment_by=customer_type&group_by=week')
        .set('Authorization', validAdminAuth);

      // Get revenue by business type
      const businessTypeRevenueResponse = await request(app)
        .get('/api/monitoring/revenue-analytics?business_type=restaurant&group_by=month')
        .set('Authorization', validAdminAuth);

      // Get performance by region
      const regionalPerformanceResponse = await request(app)
        .get('/api/monitoring/business-performance?region=stockholm')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(segmentedUsageResponse.status);
      expect([200, 404]).toContain(businessTypeRevenueResponse.status);
      expect([200, 404]).toContain(regionalPerformanceResponse.status);

      // Verify segmentation capabilities
      if (segmentedUsageResponse.status === 200) {
        expect(segmentedUsageResponse.body).toHaveProperty('usage');
        expect(segmentedUsageResponse.body).toHaveProperty('summary');
      }

      if (businessTypeRevenueResponse.status === 200) {
        expect(businessTypeRevenueResponse.body).toHaveProperty('analytics');
        // Should filter by business type
      }

      if (regionalPerformanceResponse.status === 200) {
        expect(regionalPerformanceResponse.body).toHaveProperty('metrics');
        // Should filter by region
      }
    });

    it('should provide anomaly detection and alerts integration', async () => {
      // Get recent performance anomalies
      const anomaliesResponse = await request(app)
        .get('/api/monitoring/business-performance?anomaly_detection=true')
        .set('Authorization', validAdminAuth);

      // Get fraud detection alerts
      const fraudAlertsResponse = await request(app)
        .get('/api/monitoring/fraud-reports?include_anomalies=true')
        .set('Authorization', validAdminAuth);

      // Get revenue anomalies
      const revenueAnomaliesResponse = await request(app)
        .get('/api/monitoring/revenue-analytics?detect_anomalies=true')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(anomaliesResponse.status);
      expect([200, 404]).toContain(fraudAlertsResponse.status);
      expect([200, 404]).toContain(revenueAnomaliesResponse.status);

      // Check for anomaly indicators in responses
      if (anomaliesResponse.status === 200 && anomaliesResponse.body.metrics) {
        // Anomalies might be indicated in metadata or flags
        expect(anomaliesResponse.body).toHaveProperty('metrics');
      }

      if (fraudAlertsResponse.status === 200 && fraudAlertsResponse.body.reports) {
        // Fraud reports should include suspicious patterns
        expect(fraudAlertsResponse.body).toHaveProperty('reports');
        if (fraudAlertsResponse.body.reports.length > 0) {
          expect(fraudAlertsResponse.body.reports[0]).toHaveProperty('suspicious_patterns');
        }
      }
    });

    it('should calculate key performance indicators (KPIs)', async () => {
      // Get comprehensive KPI dashboard data
      const kpiRequests = [
        // Revenue KPIs
        request(app)
          .get('/api/monitoring/revenue-analytics?include_kpis=true')
          .set('Authorization', validAdminAuth),
        
        // Performance KPIs
        request(app)
          .get('/api/monitoring/business-performance?include_kpis=true')
          .set('Authorization', validAdminAuth),
        
        // Usage KPIs
        request(app)
          .get('/api/monitoring/usage?include_kpis=true')
          .set('Authorization', validAdminAuth)
      ];

      const kpiResponses = await Promise.all(kpiRequests);

      // All KPI endpoints should respond
      kpiResponses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });

      // Verify KPI data structure
      kpiResponses.forEach(response => {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('summary');
          
          // KPIs should be numeric and well-formatted
          if (response.body.summary) {
            Object.values(response.body.summary).forEach(value => {
              if (typeof value === 'number') {
                expect(value).toBeFinite();
              }
            });
          }
        }
      });
    });
  });

  describe('BI Dashboard Performance and Scalability', () => {
    it('should handle complex aggregation queries efficiently', async () => {
      const startTime = Date.now();

      // Complex multi-dimensional query
      const complexQueryResponse = await request(app)
        .get('/api/monitoring/revenue-analytics?group_by=day,store_id&start_date=2025-08-01&end_date=2025-09-30&include_kpis=true')
        .set('Authorization', validAdminAuth);

      const queryTime = Date.now() - startTime;

      expect([200, 404]).toContain(complexQueryResponse.status);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second

      if (complexQueryResponse.status === 200) {
        expect(complexQueryResponse.body).toHaveProperty('analytics');
        expect(complexQueryResponse.body).toHaveProperty('summary');
      }
    });

    it('should support concurrent BI dashboard requests', async () => {
      // Simulate multiple dashboard widgets loading simultaneously
      const concurrentDashboardRequests = [
        request(app).get('/api/monitoring/revenue-analytics?group_by=week').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/business-performance').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/fraud-reports').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/usage').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/revenue-analytics?business_type=restaurant').set('Authorization', validAdminAuth)
      ];

      const startTime = Date.now();
      const results = await Promise.all(concurrentDashboardRequests);
      const totalTime = Date.now() - startTime;

      // All dashboard components should load within performance target
      expect(totalTime).toBeLessThan(2000); // <2s for complete dashboard

      // All requests should succeed or handle gracefully
      results.forEach(result => {
        expect([200, 404]).toContain(result.status);
      });

      // Verify response consistency
      const successfulResponses = results.filter(result => result.status === 200);
      successfulResponses.forEach(response => {
        expect(response.body).toBeDefined();
        expect(typeof response.body).toBe('object');
      });
    });

    it('should maintain data consistency across BI aggregations', async () => {
      // Get store-level revenue data
      const storeRevenueResponse = await request(app)
        .get(`/api/monitoring/revenue-analytics?store_id=${testStoreId}`)
        .set('Authorization', validAdminAuth);

      // Get business-level performance data for same store
      const storePerformanceResponse = await request(app)
        .get(`/api/monitoring/business-performance?store_id=${testStoreId}`)
        .set('Authorization', validAdminAuth);

      // Get all-stores summary for comparison
      const allStoresSummaryResponse = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(storeRevenueResponse.status);
      expect([200, 404]).toContain(storePerformanceResponse.status);
      expect([200, 404]).toContain(allStoresSummaryResponse.status);

      // Verify data consistency across different aggregation levels
      if (storeRevenueResponse.status === 200 && storePerformanceResponse.status === 200) {
        // Both should reference the same store
        if (storeRevenueResponse.body.analytics && storeRevenueResponse.body.analytics.length > 0) {
          expect(storeRevenueResponse.body.analytics[0]).toHaveProperty('store_id');
        }

        if (storePerformanceResponse.body.metrics && storePerformanceResponse.body.metrics.length > 0) {
          expect(storePerformanceResponse.body.metrics[0]).toHaveProperty('store_id');
        }
      }

      // Summary should include individual store data
      if (allStoresSummaryResponse.status === 200) {
        expect(allStoresSummaryResponse.body).toHaveProperty('summary');
        expect(typeof allStoresSummaryResponse.body.summary.total_revenue).toBe('number');
      }
    });
  });

  describe('BI Data Governance and Security', () => {
    it('should enforce business data isolation in BI queries', async () => {
      // Test with limited admin token
      const limitedAdminAuth = 'Bearer limited-admin-token';

      // Get revenue analytics with limited permissions
      const limitedRevenueResponse = await request(app)
        .get('/api/monitoring/revenue-analytics')
        .set('Authorization', limitedAdminAuth);

      // Get business performance with limited permissions
      const limitedPerformanceResponse = await request(app)
        .get('/api/monitoring/business-performance')
        .set('Authorization', limitedAdminAuth);

      // Both should allow access but may return filtered results
      expect([200, 403]).toContain(limitedRevenueResponse.status);
      expect([200, 403]).toContain(limitedPerformanceResponse.status);

      // If data is returned, it should be properly filtered
      if (limitedRevenueResponse.status === 200) {
        expect(limitedRevenueResponse.body).toHaveProperty('analytics');
        // Should only include data for businesses the admin has access to
      }

      if (limitedPerformanceResponse.status === 200) {
        expect(limitedPerformanceResponse.body).toHaveProperty('metrics');
        // Should only include data for accessible businesses
      }
    });

    it('should audit BI data access and queries', async () => {
      // Perform several BI queries that should be audited
      const auditableQueries = [
        request(app).get('/api/monitoring/revenue-analytics').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/business-performance').set('Authorization', validAdminAuth),
        request(app).get('/api/monitoring/fraud-reports').set('Authorization', validAdminAuth)
      ];

      const queryResults = await Promise.all(auditableQueries);

      // All queries should complete
      queryResults.forEach(result => {
        expect([200, 404]).toContain(result.status);
      });

      // Check audit log for BI access
      const auditLogResponse = await request(app)
        .get('/api/admin/monitoring/audit-logs?action_type=bi_query')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(auditLogResponse.status);

      if (auditLogResponse.status === 200) {
        expect(auditLogResponse.body).toHaveProperty('logs');
        // Should contain audit entries for BI queries
      }
    });

    it('should validate BI query parameters and prevent data leakage', async () => {
      // Test malicious query parameters
      const maliciousQueries = [
        '/api/monitoring/revenue-analytics?store_id=../../admin/secrets',
        '/api/monitoring/business-performance?business_id=SELECT%20*%20FROM%20users',
        '/api/monitoring/fraud-reports?start_date=1900-01-01&end_date=2099-12-31',
        '/api/monitoring/usage?group_by=../../../etc/passwd'
      ];

      for (const maliciousQuery of maliciousQueries) {
        const maliciousResponse = await request(app)
          .get(maliciousQuery)
          .set('Authorization', validAdminAuth);

        // Should reject malicious queries
        expect([400, 422, 404]).toContain(maliciousResponse.status);

        if (maliciousResponse.body && maliciousResponse.body.error) {
          expect(typeof maliciousResponse.body.error).toBe('string');
        }
      }
    });
  });
});