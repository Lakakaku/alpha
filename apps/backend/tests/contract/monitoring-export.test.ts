import request from 'supertest';
import { app } from '../../src/app';

describe('POST /api/monitoring/export - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  const validExportRequest = {
    data_type: 'system_metrics',
    format: 'csv',
    date_range: {
      start_date: '2025-09-01',
      end_date: '2025-09-30'
    },
    filters: {
      store_ids: ['550e8400-e29b-41d4-a716-446655440000'],
      service_names: ['backend', 'customer_app']
    }
  };

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .send(validExportRequest);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', 'Bearer invalid-admin-token')
        .send(validExportRequest);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Request Body Validation', () => {
    it('should accept valid export request with all required fields', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(validExportRequest);

      expect(response.status).not.toBe(422);
    });

    it('should reject request missing data_type field', async () => {
      const invalidData = { ...validExportRequest };
      delete invalidData.data_type;

      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'data_type',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing format field', async () => {
      const invalidData = { ...validExportRequest };
      delete invalidData.format;

      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'format',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing date_range field', async () => {
      const invalidData = { ...validExportRequest };
      delete invalidData.date_range;

      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'date_range',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should accept all valid data_type values', async () => {
      const dataTypes = ['system_metrics', 'fraud_reports', 'revenue_analytics', 'business_performance'];

      for (const dataType of dataTypes) {
        const response = await request(app)
          .post('/api/monitoring/export')
          .set('Authorization', validAdminAuth)
          .send({
            ...validExportRequest,
            data_type: dataType
          });

        expect(response.status).not.toBe(422);
      }
    });

    it('should reject invalid data_type value', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          data_type: 'invalid_data_type'
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'data_type',
            message: expect.stringContaining('enum')
          })
        ])
      );
    });

    it('should accept all valid format values', async () => {
      const formats = ['csv', 'pdf', 'json'];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/monitoring/export')
          .set('Authorization', validAdminAuth)
          .send({
            ...validExportRequest,
            format: format
          });

        expect(response.status).not.toBe(422);
      }
    });

    it('should reject invalid format value', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          format: 'invalid_format'
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'format',
            message: expect.stringContaining('enum')
          })
        ])
      );
    });

    it('should reject date_range missing start_date', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          date_range: {
            end_date: '2025-09-30'
          }
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'date_range.start_date',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject date_range missing end_date', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          date_range: {
            start_date: '2025-09-01'
          }
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'date_range.end_date',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject invalid date format in date_range', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          date_range: {
            start_date: 'invalid-date',
            end_date: '2025-09-30'
          }
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'date_range.start_date',
            message: expect.stringContaining('date')
          })
        ])
      );
    });

    it('should reject end_date before start_date in date_range', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          date_range: {
            start_date: '2025-09-30',
            end_date: '2025-09-01'
          }
        });

      expect(response.status).toBe(422);
    });

    it('should accept valid filters with store_ids', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          filters: {
            store_ids: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']
          }
        });

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid UUID format in store_ids filter', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          filters: {
            store_ids: ['invalid-uuid']
          }
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'filters.store_ids',
            message: expect.stringContaining('UUID')
          })
        ])
      );
    });

    it('should accept valid filters with service_names', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          filters: {
            service_names: ['backend', 'customer_app', 'business_app', 'admin_app']
          }
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept request without filters (optional field)', async () => {
      const requestWithoutFilters = { ...validExportRequest };
      delete requestWithoutFilters.filters;

      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(requestWithoutFilters);

      expect(response.status).not.toBe(422);
    });

    it('should accept request with empty filters object', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          filters: {}
        });

      expect(response.status).not.toBe(422);
    });
  });

  describe('Successful Response', () => {
    it('should return 200 for immediate export completion', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(validExportRequest);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('download_url');
        expect(response.body).toHaveProperty('expires_at');
        expect(response.body).toHaveProperty('file_size');

        expect(typeof response.body.download_url).toBe('string');
        expect(typeof response.body.expires_at).toBe('string');
        expect(typeof response.body.file_size).toBe('number');

        // Validate URL format
        expect(response.body.download_url).toMatch(/^https?:\/\/.+/);

        // Validate expires_at is ISO 8601 timestamp
        expect(new Date(response.body.expires_at)).toBeInstanceOf(Date);
        expect(isNaN(new Date(response.body.expires_at).getTime())).toBe(false);

        // Validate file_size is positive
        expect(response.body.file_size).toBeGreaterThan(0);
      }
    });

    it('should return 202 for queued export processing', async () => {
      const largeExportRequest = {
        ...validExportRequest,
        date_range: {
          start_date: '2024-01-01',
          end_date: '2025-09-30'
        }
      };

      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(largeExportRequest);

      if (response.status === 202) {
        expect(response.body).toHaveProperty('export_id');
        expect(response.body).toHaveProperty('status');

        expect(typeof response.body.export_id).toBe('string');
        expect(typeof response.body.status).toBe('string');

        // Validate export_id is UUID
        expect(response.body.export_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // Validate status enum
        expect(['queued', 'processing']).toContain(response.body.status);
      }
    });

    it('should handle CSV export format', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          format: 'csv'
        });

      expect([200, 202]).toContain(response.status);
    });

    it('should handle PDF export format', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          format: 'pdf'
        });

      expect([200, 202]).toContain(response.status);
    });

    it('should handle JSON export format', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send({
          ...validExportRequest,
          format: 'json'
        });

      expect([200, 202]).toContain(response.status);
    });
  });

  describe('Business Data Isolation', () => {
    it('should only export data for accessible businesses', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(validExportRequest);

      expect([200, 202]).toContain(response.status);

      // RLS policies should enforce business data isolation during export
      // This contract test ensures the endpoint structure is correct
      // Integration tests will verify the actual data isolation
    });

    it('should respect admin business access permissions during export', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', 'Bearer limited-admin-token')
        .send(validExportRequest);

      // Should not return 403, but may return filtered export
      expect([200, 202]).toContain(response.status);
    });
  });

  describe('Content Type Validation', () => {
    it('should require JSON content type', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'text/plain')
        .send('data_type=system_metrics');

      expect(response.status).toBe(415); // Unsupported Media Type
    });

    it('should accept application/json content type', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(validExportRequest));

      expect(response.status).not.toBe(415);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(validExportRequest);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 30 seconds for export endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(validExportRequest);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(30000); // Export endpoint allows up to 30s
    });
  });

  describe('Audit Trail', () => {
    it('should log export request for audit purposes', async () => {
      const response = await request(app)
        .post('/api/monitoring/export')
        .set('Authorization', validAdminAuth)
        .send(validExportRequest);

      expect([200, 202]).toContain(response.status);
      // Audit logging verification would be handled by integration tests
      // This contract test ensures the endpoint accepts the request correctly
    });
  });
});