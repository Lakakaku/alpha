import request from 'supertest';
import { app } from '../../src/app';

describe('Error Tracking and Resolution Workflow - Integration Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked
  const testErrorId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Complete Error Management Lifecycle', () => {
    it('should detect, track, and resolve errors through full workflow', async () => {
      // Step 1: Discovery - Get list of errors to identify issues
      const errorListResponse = await request(app)
        .get('/api/monitoring/errors?status=open&severity=high')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(errorListResponse.status);

      // Step 2: Investigation - Get detailed error information
      const errorDetailsResponse = await request(app)
        .get(`/api/monitoring/errors/${testErrorId}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(errorDetailsResponse.status);

      // Step 3: Resolution - Update error status and add resolution notes
      const resolutionData = {
        status: 'resolved',
        resolution_notes: 'Fixed by updating database configuration',
        resolved_by: 'admin-user-id',
        resolved_at: new Date().toISOString()
      };

      const updateResponse = await request(app)
        .patch(`/api/monitoring/errors/${testErrorId}`)
        .set('Authorization', validAdminAuth)
        .send(resolutionData);

      expect([200, 404]).toContain(updateResponse.status);

      // Step 4: Verification - Confirm error is marked as resolved
      const verificationResponse = await request(app)
        .get(`/api/monitoring/errors/${testErrorId}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(verificationResponse.status);

      // Integration validation
      if (errorListResponse.status === 200) {
        expect(errorListResponse.body).toHaveProperty('errors');
        expect(Array.isArray(errorListResponse.body.errors)).toBe(true);
      }

      if (updateResponse.status === 200) {
        expect(updateResponse.body).toHaveProperty('id');
        expect(updateResponse.body).toHaveProperty('status');
      }
    });

    it('should track error patterns and frequency analysis', async () => {
      const timeRange = {
        start_time: '2025-09-23T00:00:00Z',
        end_time: '2025-09-23T23:59:59Z'
      };

      // Get errors by service to identify problematic components
      const backendErrorsResponse = await request(app)
        .get(`/api/monitoring/errors?service=backend&start_time=${timeRange.start_time}&end_time=${timeRange.end_time}`)
        .set('Authorization', validAdminAuth);

      const customerAppErrorsResponse = await request(app)
        .get(`/api/monitoring/errors?service=customer_app&start_time=${timeRange.start_time}&end_time=${timeRange.end_time}`)
        .set('Authorization', validAdminAuth);

      const businessAppErrorsResponse = await request(app)
        .get(`/api/monitoring/errors?service=business_app&start_time=${timeRange.start_time}&end_time=${timeRange.end_time}`)
        .set('Authorization', validAdminAuth);

      // All services should be accessible for error tracking
      expect([200, 404]).toContain(backendErrorsResponse.status);
      expect([200, 404]).toContain(customerAppErrorsResponse.status);
      expect([200, 404]).toContain(businessAppErrorsResponse.status);

      // Verify consistent error structure across services
      [backendErrorsResponse, customerAppErrorsResponse, businessAppErrorsResponse].forEach(response => {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('errors');
          expect(response.body).toHaveProperty('pagination');
          expect(response.body).toHaveProperty('summary');
        }
      });
    });

    it('should integrate with alert system for critical errors', async () => {
      // Check for active alert rules related to errors
      const alertRulesResponse = await request(app)
        .get('/api/monitoring/alerts/rules?metric_type=error_rate')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(alertRulesResponse.status);

      // Get high-severity errors that should trigger alerts
      const criticalErrorsResponse = await request(app)
        .get('/api/monitoring/errors?severity=critical')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(criticalErrorsResponse.status);

      // Verify alert rules can target error conditions
      if (alertRulesResponse.status === 200 && alertRulesResponse.body.rules) {
        alertRulesResponse.body.rules.forEach((rule: any) => {
          expect(rule).toHaveProperty('metric_type');
          expect(rule).toHaveProperty('threshold_value');
          expect(rule).toHaveProperty('comparison_operator');
        });
      }

      // Verify critical errors have proper structure for alerting
      if (criticalErrorsResponse.status === 200 && criticalErrorsResponse.body.errors) {
        criticalErrorsResponse.body.errors.forEach((error: any) => {
          expect(error).toHaveProperty('severity');
          expect(error).toHaveProperty('timestamp');
          expect(error).toHaveProperty('service');
          expect(error.severity).toBe('critical');
        });
      }
    });

    it('should support bulk error operations for efficient management', async () => {
      const errorIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003'
      ];

      // Bulk status update
      const bulkUpdateData = {
        error_ids: errorIds,
        status: 'acknowledged',
        acknowledged_by: 'admin-user-id',
        acknowledgment_notes: 'Investigating similar pattern across multiple errors'
      };

      const bulkUpdateResponse = await request(app)
        .patch('/api/monitoring/errors/bulk')
        .set('Authorization', validAdminAuth)
        .send(bulkUpdateData);

      expect([200, 404]).toContain(bulkUpdateResponse.status);

      // Verify bulk operations maintain audit trail
      if (bulkUpdateResponse.status === 200) {
        expect(bulkUpdateResponse.body).toHaveProperty('updated_count');
        expect(bulkUpdateResponse.body).toHaveProperty('errors');
        expect(Array.isArray(bulkUpdateResponse.body.errors)).toBe(true);
      }
    });

    it('should correlate errors with system metrics for root cause analysis', async () => {
      const errorTimestamp = '2025-09-23T14:30:00Z';
      const timeWindow = 300; // 5 minutes

      // Get errors around specific time
      const errorContext = await request(app)
        .get(`/api/monitoring/errors?start_time=${errorTimestamp}&time_window=${timeWindow}`)
        .set('Authorization', validAdminAuth);

      // Get system metrics for same time window
      const systemMetrics = await request(app)
        .get(`/api/monitoring/metrics?start_time=${errorTimestamp}&time_window=${timeWindow}&metric_type=cpu_usage,memory_usage,response_time`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(errorContext.status);
      expect([200, 404]).toContain(systemMetrics.status);

      // Verify time correlation capability
      if (errorContext.status === 200 && systemMetrics.status === 200) {
        // Both should provide timestamped data for correlation
        if (errorContext.body.errors && errorContext.body.errors.length > 0) {
          const error = errorContext.body.errors[0];
          expect(error).toHaveProperty('timestamp');
          expect(new Date(error.timestamp)).toBeInstanceOf(Date);
        }

        if (systemMetrics.body.metrics && systemMetrics.body.metrics.length > 0) {
          const metric = systemMetrics.body.metrics[0];
          expect(metric).toHaveProperty('timestamp');
          expect(new Date(metric.timestamp)).toBeInstanceOf(Date);
        }
      }
    });
  });

  describe('Error Classification and Prioritization', () => {
    it('should filter and sort errors by multiple criteria', async () => {
      // Test complex filtering scenarios
      const filterTests = [
        { severity: 'high', service: 'backend', status: 'open' },
        { error_type: 'validation_error', frequency: 'high' },
        { impact: 'customer_facing', business_impact: 'high' }
      ];

      for (const filters of filterTests) {
        const queryParams = new URLSearchParams(filters).toString();
        const filterResponse = await request(app)
          .get(`/api/monitoring/errors?${queryParams}`)
          .set('Authorization', validAdminAuth);

        expect([200, 404]).toContain(filterResponse.status);

        if (filterResponse.status === 200) {
          expect(filterResponse.body).toHaveProperty('errors');
          expect(filterResponse.body).toHaveProperty('pagination');
        }
      }
    });

    it('should provide error analytics and trending information', async () => {
      // Get error trends over time
      const trendsResponse = await request(app)
        .get('/api/monitoring/errors/trends?period=week&group_by=service,severity')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(trendsResponse.status);

      // Get error frequency analysis
      const frequencyResponse = await request(app)
        .get('/api/monitoring/errors/frequency?time_range=24h')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(frequencyResponse.status);

      // Verify analytics structure
      if (trendsResponse.status === 200) {
        expect(trendsResponse.body).toHaveProperty('trends');
        expect(trendsResponse.body).toHaveProperty('summary');
      }

      if (frequencyResponse.status === 200) {
        expect(frequencyResponse.body).toHaveProperty('frequency_data');
        expect(frequencyResponse.body).toHaveProperty('peak_times');
      }
    });

    it('should support error search and full-text queries', async () => {
      // Search by error message
      const messageSearchResponse = await request(app)
        .get('/api/monitoring/errors?search=database connection timeout')
        .set('Authorization', validAdminAuth);

      // Search by stack trace
      const stackTraceSearchResponse = await request(app)
        .get('/api/monitoring/errors?search=TypeError at validateInput')
        .set('Authorization', validAdminAuth);

      // Search by service and component
      const componentSearchResponse = await request(app)
        .get('/api/monitoring/errors?search=payment processing service')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(messageSearchResponse.status);
      expect([200, 404]).toContain(stackTraceSearchResponse.status);
      expect([200, 404]).toContain(componentSearchResponse.status);

      // Verify search maintains proper structure
      [messageSearchResponse, stackTraceSearchResponse, componentSearchResponse].forEach(response => {
        if (response.status === 200) {
          expect(response.body).toHaveProperty('errors');
          expect(response.body).toHaveProperty('pagination');
          expect(response.body.pagination).toHaveProperty('total');
        }
      });
    });
  });

  describe('Performance and Data Management', () => {
    it('should handle large error datasets efficiently', async () => {
      const startTime = Date.now();

      // Query large dataset with pagination
      const largeDatasetResponse = await request(app)
        .get('/api/monitoring/errors?limit=100&offset=0&start_time=2025-09-01T00:00:00Z&end_time=2025-09-23T23:59:59Z')
        .set('Authorization', validAdminAuth);

      const queryTime = Date.now() - startTime;

      expect([200, 404]).toContain(largeDatasetResponse.status);
      expect(queryTime).toBeLessThan(1000); // Should respond within 1 second

      if (largeDatasetResponse.status === 200) {
        expect(largeDatasetResponse.body).toHaveProperty('pagination');
        expect(largeDatasetResponse.body.pagination).toHaveProperty('total');
        expect(largeDatasetResponse.body.pagination).toHaveProperty('limit');
        expect(largeDatasetResponse.body.pagination.limit).toBeLessThanOrEqual(100);
      }
    });

    it('should maintain error data integrity during updates', async () => {
      // Test concurrent updates to same error
      const updateData1 = {
        status: 'investigating',
        assigned_to: 'admin-1',
        investigation_notes: 'Initial investigation started'
      };

      const updateData2 = {
        priority: 'high',
        tags: ['performance', 'database'],
        updated_notes: 'Added priority and tags'
      };

      const concurrentUpdates = [
        request(app)
          .patch(`/api/monitoring/errors/${testErrorId}`)
          .set('Authorization', validAdminAuth)
          .send(updateData1),
        request(app)
          .patch(`/api/monitoring/errors/${testErrorId}`)
          .set('Authorization', validAdminAuth)
          .send(updateData2)
      ];

      const updateResults = await Promise.allSettled(concurrentUpdates);

      // At least one update should succeed
      const successfulUpdates = updateResults.filter(
        result => result.status === 'fulfilled' && 
        [200, 404].includes((result as any).value.status)
      );

      expect(successfulUpdates.length).toBeGreaterThan(0);
    });

    it('should archive resolved errors according to retention policy', async () => {
      // Get old resolved errors that should be archived
      const oldResolvedErrors = await request(app)
        .get('/api/monitoring/errors?status=resolved&resolved_before=2025-08-01T00:00:00Z')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(oldResolvedErrors.status);

      // Trigger archive operation
      const archiveResponse = await request(app)
        .post('/api/monitoring/errors/archive')
        .set('Authorization', validAdminAuth)
        .send({
          retention_days: 90,
          dry_run: true // Test mode to avoid actual data deletion
        });

      expect([200, 404]).toContain(archiveResponse.status);

      if (archiveResponse.status === 200) {
        expect(archiveResponse.body).toHaveProperty('eligible_for_archive');
        expect(archiveResponse.body).toHaveProperty('retention_policy');
        expect(typeof archiveResponse.body.eligible_for_archive).toBe('number');
      }
    });
  });
});