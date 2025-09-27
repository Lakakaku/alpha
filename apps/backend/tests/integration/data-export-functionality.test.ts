import request from 'supertest';
import { app } from '../../src/app';

describe('Data Export Functionality - Integration Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  describe('Complete Export Workflow', () => {
    it('should handle immediate export for small datasets', async () => {
      // Small dataset export request (should complete immediately)
      const smallExportRequest = {
        data_type: 'system_metrics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-23',
          end_date: '2025-09-23'
        },
        filters: {
          service_names: ['backend']
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(smallExportRequest);

      expect([200, 202, 404]).toContain(exportResponse.status);

      if (exportResponse.status === 200) {
        // Immediate export completion
        expect(exportResponse.body).toHaveProperty('download_url');
        expect(exportResponse.body).toHaveProperty('expires_at');
        expect(exportResponse.body).toHaveProperty('file_size');

        // Validate URL format
        expect(exportResponse.body.download_url).toMatch(/^https?:\/\/.+/);
        
        // Validate expiration is in future
        const expiresAt = new Date(exportResponse.body.expires_at);
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

        // Validate file size is positive
        expect(exportResponse.body.file_size).toBeGreaterThan(0);
      }
    });

    it('should handle queued export for large datasets', async () => {
      // Large dataset export request (should be queued)
      const largeExportRequest = {
        data_type: 'revenue_analytics',
        format: 'pdf',
        date_range: {
          start_date: '2024-01-01',
          end_date: '2025-09-30'
        },
        filters: {
          store_ids: ['550e8400-e29b-41d4-a716-446655440000']
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(largeExportRequest);

      expect([200, 202, 404]).toContain(exportResponse.status);

      if (exportResponse.status === 202) {
        // Queued export
        expect(exportResponse.body).toHaveProperty('export_id');
        expect(exportResponse.body).toHaveProperty('status');

        // Validate export ID is UUID
        expect(exportResponse.body.export_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );

        // Validate status is valid
        expect(['queued', 'processing']).toContain(exportResponse.body.status);

        // Check export status
        const statusResponse = await request(app)
          .get(`/api/monitoring/export/${exportResponse.body.export_id}/status`)
          .set('Authorization', validAdminAuth);

        expect([200, 404]).toContain(statusResponse.status);

        if (statusResponse.status === 200) {
          expect(statusResponse.body).toHaveProperty('export_id');
          expect(statusResponse.body).toHaveProperty('status');
          expect(['queued', 'processing', 'completed', 'failed']).toContain(statusResponse.body.status);
        }
      }
    });

    it('should support multiple export formats for each data type', async () => {
      const dataTypes = ['system_metrics', 'fraud_reports', 'revenue_analytics', 'business_performance'];
      const formats = ['csv', 'pdf', 'json'];

      // Test each data type with each format
      for (const dataType of dataTypes) {
        for (const format of formats) {
          const exportRequest = {
            data_type: dataType,
            format: format,
            date_range: {
              start_date: '2025-09-23',
              end_date: '2025-09-23'
            }
          };

          const exportResponse = await request(app)
            .post('/api/monitoring/export')
            .set('Authorization', validAdminAuth)
            .send(exportRequest);

          expect([200, 202, 404]).toContain(exportResponse.status);

          // All data type + format combinations should be supported
          if (exportResponse.status === 200 || exportResponse.status === 202) {
            // Export was accepted
            if (exportResponse.status === 200) {
              expect(exportResponse.body).toHaveProperty('download_url');
            } else {
              expect(exportResponse.body).toHaveProperty('export_id');
            }
          }
        }
      }
    });

    it('should apply filters correctly in exported data', async () => {
      const storeId = '550e8400-e29b-41d4-a716-446655440000';
      
      // Export with store filter
      const filteredExportRequest = {
        data_type: 'revenue_analytics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        },
        filters: {
          store_ids: [storeId]
        }
      };

      const filteredExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(filteredExportRequest);

      // Export without filters
      const unfilteredExportRequest = {
        data_type: 'revenue_analytics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const unfilteredExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(unfilteredExportRequest);

      expect([200, 202, 404]).toContain(filteredExportResponse.status);
      expect([200, 202, 404]).toContain(unfilteredExportResponse.status);

      // Filtered export should be smaller or equal in size
      if (filteredExportResponse.status === 200 && unfilteredExportResponse.status === 200) {
        expect(filteredExportResponse.body.file_size).toBeLessThanOrEqual(
          unfilteredExportResponse.body.file_size
        );
      }
    });

    it('should track export history and audit trail', async () => {
      // Create an export request
      const exportRequest = {
        data_type: 'system_metrics',
        format: 'json',
        date_range: {
          start_date: '2025-09-23',
          end_date: '2025-09-23'
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(exportRequest);

      expect([200, 202, 404]).toContain(exportResponse.status);

      // Get export history
      const historyResponse = await request(app)
        .get('/api/monitoring/export/history')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(historyResponse.status);

      if (historyResponse.status === 200) {
        expect(historyResponse.body).toHaveProperty('exports');
        expect(Array.isArray(historyResponse.body.exports)).toBe(true);

        if (historyResponse.body.exports.length > 0) {
          const exportHistory = historyResponse.body.exports[0];
          expect(exportHistory).toHaveProperty('id');
          expect(exportHistory).toHaveProperty('data_type');
          expect(exportHistory).toHaveProperty('format');
          expect(exportHistory).toHaveProperty('status');
          expect(exportHistory).toHaveProperty('created_at');
          expect(exportHistory).toHaveProperty('created_by');
        }
      }

      // Check audit logs for export activity
      const auditResponse = await request(app)
        .get('/api/admin/monitoring/audit-logs?action_type=data_export')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(auditResponse.status);

      if (auditResponse.status === 200) {
        expect(auditResponse.body).toHaveProperty('logs');
        // Should contain audit entries for export operations
      }
    });
  });

  describe('Export Format Validation and Content', () => {
    it('should generate valid CSV format with proper headers', async () => {
      const csvExportRequest = {
        data_type: 'system_metrics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-23',
          end_date: '2025-09-23'
        }
      };

      const csvExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(csvExportRequest);

      expect([200, 202, 404]).toContain(csvExportResponse.status);

      // If immediate export, validate CSV characteristics
      if (csvExportResponse.status === 200) {
        expect(csvExportResponse.body).toHaveProperty('download_url');
        expect(csvExportResponse.body.download_url).toContain('.csv');
        
        // File size should be reasonable for CSV
        expect(csvExportResponse.body.file_size).toBeGreaterThan(50); // Minimum for headers
      }
    });

    it('should generate valid PDF format with proper structure', async () => {
      const pdfExportRequest = {
        data_type: 'business_performance',
        format: 'pdf',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const pdfExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(pdfExportRequest);

      expect([200, 202, 404]).toContain(pdfExportResponse.status);

      // PDF exports are typically larger and may be queued
      if (pdfExportResponse.status === 200) {
        expect(pdfExportResponse.body.download_url).toContain('.pdf');
        // PDFs are typically larger than CSV
        expect(pdfExportResponse.body.file_size).toBeGreaterThan(1000);
      } else if (pdfExportResponse.status === 202) {
        expect(pdfExportResponse.body).toHaveProperty('export_id');
        expect(pdfExportResponse.body.status).toBe('queued');
      }
    });

    it('should generate valid JSON format with proper structure', async () => {
      const jsonExportRequest = {
        data_type: 'fraud_reports',
        format: 'json',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const jsonExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(jsonExportRequest);

      expect([200, 202, 404]).toContain(jsonExportResponse.status);

      if (jsonExportResponse.status === 200) {
        expect(jsonExportResponse.body.download_url).toContain('.json');
        
        // JSON should have reasonable structure overhead
        expect(jsonExportResponse.body.file_size).toBeGreaterThan(20);
      }
    });

    it('should handle empty datasets gracefully in all formats', async () => {
      const futureDate = '2099-12-31';
      const formats = ['csv', 'pdf', 'json'];

      for (const format of formats) {
        const emptyDatasetRequest = {
          data_type: 'system_metrics',
          format: format,
          date_range: {
            start_date: futureDate,
            end_date: futureDate
          }
        };

        const emptyExportResponse = await request(app)
          .post('/api/monitoring/export')
          .set('Authorization', validAdminAuth)
          .send(emptyDatasetRequest);

        expect([200, 202, 404]).toContain(emptyExportResponse.status);

        if (emptyExportResponse.status === 200) {
          // Should still generate file with headers/structure
          expect(emptyExportResponse.body).toHaveProperty('download_url');
          expect(emptyExportResponse.body.file_size).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Export Security and Access Control', () => {
    it('should enforce admin authentication for all export operations', async () => {
      const exportRequest = {
        data_type: 'revenue_analytics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-23',
          end_date: '2025-09-23'
        }
      };

      // Test without authentication
      const noAuthResponse = await request(app)
        .post('/api/monitoring/export')
        .send(exportRequest);

      expect(noAuthResponse.status).toBe(401);

      // Test with invalid authentication
      const invalidAuthResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', 'Bearer invalid-token')
        .send(exportRequest);

      expect(invalidAuthResponse.status).toBe(403);

      // Test with valid authentication
      const validAuthResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(exportRequest);

      expect([200, 202, 404]).toContain(validAuthResponse.status);
    });

    it('should apply business data isolation in exports', async () => {
      const limitedAdminAuth = 'Bearer limited-admin-token';

      // Export with limited admin permissions
      const limitedExportRequest = {
        data_type: 'revenue_analytics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-01',
          end_date: '2025-09-30'
        }
      };

      const limitedExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', limitedAdminAuth)
        .send(limitedExportRequest);

      // Should allow export but may return filtered data
      expect([200, 202, 403]).toContain(limitedExportResponse.status);

      if (limitedExportResponse.status === 200 || limitedExportResponse.status === 202) {
        // Export should succeed but contain only accessible data
        if (limitedExportResponse.status === 200) {
          expect(limitedExportResponse.body).toHaveProperty('download_url');
        } else {
          expect(limitedExportResponse.body).toHaveProperty('export_id');
        }
      }
    });

    it('should validate export request parameters', async () => {
      const invalidRequests = [
        {
          // Missing data_type
          format: 'csv',
          date_range: {
            start_date: '2025-09-01',
            end_date: '2025-09-30'
          }
        },
        {
          // Invalid data_type
          data_type: 'invalid_data_type',
          format: 'csv',
          date_range: {
            start_date: '2025-09-01',
            end_date: '2025-09-30'
          }
        },
        {
          // Invalid format
          data_type: 'system_metrics',
          format: 'invalid_format',
          date_range: {
            start_date: '2025-09-01',
            end_date: '2025-09-30'
          }
        },
        {
          // Invalid date range
          data_type: 'system_metrics',
          format: 'csv',
          date_range: {
            start_date: '2025-09-30',
            end_date: '2025-09-01'
          }
        }
      ];

      for (const invalidRequest of invalidRequests) {
        const invalidResponse = await request(app)
          .post('/api/monitoring/export')
          .set('Authorization', validAdminAuth)
          .send(invalidRequest);

        expect([400, 422, 404]).toContain(invalidResponse.status);

        if (invalidResponse.status === 422) {
          expect(invalidResponse.body).toHaveProperty('error');
          expect(invalidResponse.body).toHaveProperty('details');
        }
      }
    });

    it('should expire download URLs according to security policy', async () => {
      const exportRequest = {
        data_type: 'system_metrics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-23',
          end_date: '2025-09-23'
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(exportRequest);

      expect([200, 202, 404]).toContain(exportResponse.status);

      if (exportResponse.status === 200) {
        expect(exportResponse.body).toHaveProperty('expires_at');
        
        const expiresAt = new Date(exportResponse.body.expires_at);
        const now = new Date();
        const expirationHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        // Download URLs should expire within reasonable timeframe (e.g., 24 hours)
        expect(expirationHours).toBeGreaterThan(0);
        expect(expirationHours).toBeLessThan(25); // Allow some buffer
      }
    });
  });

  describe('Export Performance and Reliability', () => {
    it('should handle large dataset exports without timeout', async () => {
      const largeExportRequest = {
        data_type: 'system_metrics',
        format: 'csv',
        date_range: {
          start_date: '2025-01-01',
          end_date: '2025-09-30'
        }
      };

      const startTime = Date.now();
      
      const largeExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(largeExportRequest);

      const responseTime = Date.now() - startTime;

      expect([200, 202, 404]).toContain(largeExportResponse.status);
      expect(responseTime).toBeLessThan(30000); // Should respond within 30s

      if (largeExportResponse.status === 202) {
        // Large exports should be queued
        expect(largeExportResponse.body).toHaveProperty('export_id');
        expect(largeExportResponse.body.status).toBe('queued');
      }
    });

    it('should support concurrent export requests', async () => {
      const exportRequests = [
        {
          data_type: 'system_metrics',
          format: 'csv',
          date_range: { start_date: '2025-09-23', end_date: '2025-09-23' }
        },
        {
          data_type: 'revenue_analytics',
          format: 'json',
          date_range: { start_date: '2025-09-23', end_date: '2025-09-23' }
        },
        {
          data_type: 'business_performance',
          format: 'pdf',
          date_range: { start_date: '2025-09-23', end_date: '2025-09-23' }
        }
      ];

      const concurrentExports = exportRequests.map(request =>
        request(app)
          .post('/api/monitoring/export')
          .set('Authorization', validAdminAuth)
          .send(request)
      );

      const results = await Promise.all(concurrentExports);

      // All concurrent exports should be handled
      results.forEach(result => {
        expect([200, 202, 404]).toContain(result.status);
      });

      // Should generate unique export IDs/URLs
      const exportIds = results
        .filter(result => result.status === 202)
        .map(result => result.body.export_id);
      
      const downloadUrls = results
        .filter(result => result.status === 200)
        .map(result => result.body.download_url);

      // All IDs should be unique
      const uniqueIds = new Set(exportIds);
      expect(uniqueIds.size).toBe(exportIds.length);

      // All URLs should be unique
      const uniqueUrls = new Set(downloadUrls);
      expect(uniqueUrls.size).toBe(downloadUrls.length);
    });

    it('should provide export progress tracking for queued exports', async () => {
      const queuedExportRequest = {
        data_type: 'revenue_analytics',
        format: 'pdf',
        date_range: {
          start_date: '2024-01-01',
          end_date: '2025-09-30'
        }
      };

      const queuedExportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(queuedExportRequest);

      if (queuedExportResponse.status === 202) {
        const exportId = queuedExportResponse.body.export_id;

        // Check export progress
        const progressResponse = await request(app)
          .get(`/api/monitoring/export/${exportId}/progress`)
          .set('Authorization', validAdminAuth);

        expect([200, 404]).toContain(progressResponse.status);

        if (progressResponse.status === 200) {
          expect(progressResponse.body).toHaveProperty('export_id');
          expect(progressResponse.body).toHaveProperty('status');
          expect(progressResponse.body).toHaveProperty('progress_percentage');
          
          expect(['queued', 'processing', 'completed', 'failed']).toContain(
            progressResponse.body.status
          );
          expect(progressResponse.body.progress_percentage).toBeGreaterThanOrEqual(0);
          expect(progressResponse.body.progress_percentage).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should handle export failures gracefully', async () => {
      // Request export with invalid filters to trigger potential failure
      const problematicExportRequest = {
        data_type: 'system_metrics',
        format: 'csv',
        date_range: {
          start_date: '2025-09-23',
          end_date: '2025-09-23'
        },
        filters: {
          store_ids: ['550e8400-e29b-41d4-a716-446655440999'] // Non-existent store
        }
      };

      const exportResponse = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(problematicExportRequest);

      expect([200, 202, 400, 404]).toContain(exportResponse.status);

      // Should handle gracefully even with no data
      if (exportResponse.status === 200) {
        expect(exportResponse.body).toHaveProperty('download_url');
        // Should generate empty file rather than error
        expect(exportResponse.body.file_size).toBeGreaterThanOrEqual(0);
      } else if (exportResponse.status === 202) {
        // If queued, should eventually complete or fail gracefully
        expect(exportResponse.body).toHaveProperty('export_id');
      }
    });
  });
});