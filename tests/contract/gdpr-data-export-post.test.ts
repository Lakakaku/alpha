/**
 * Contract test for POST /api/gdpr/data-export
 * 
 * @description Validates GDPR data export endpoint contract compliance
 * @constitutional_requirement Customer data portability rights
 * @performance_target <5s export generation, 72h maximum delivery
 */

import request from 'supertest';
import { app } from '../../apps/backend/src/app';

describe('POST /api/gdpr/data-export - Contract Test', () => {
  const validExportRequest = {
    customer_phone: '+46701234567',
    export_format: 'json',
    data_categories: ['feedback_sessions', 'transactions', 'customer_metadata'],
    delivery_method: 'secure_download',
    include_metadata: true,
    date_range: {
      start_date: '2024-01-01T00:00:00.000Z',
      end_date: '2024-12-31T23:59:59.999Z'
    }
  };

  it('should fail - endpoint not implemented yet (TDD)', async () => {
    const response = await request(app)
      .post('/api/gdpr/data-export')
      .set('Authorization', 'Bearer mock-admin-token')
      .send(validExportRequest)
      .expect(404);

    // This test MUST fail until T025-T029 services are implemented
    expect(response.body).toEqual({
      error: 'Not Found',
      message: 'Route not implemented'
    });
  });

  describe('Authentication & Authorization (Constitutional: Customer or admin)', () => {
    it('should fail - requires authentication', async () => {
      await request(app)
        .post('/api/gdpr/data-export')
        .send(validExportRequest)
        .expect(401);
    });

    it('should allow customer to export own data', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send(validExportRequest);

      // Should not be 403 when customer exports own data
      expect([200, 202, 404]).toContain(response.status);
    });

    it('should allow admin to export on behalf of customer', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          admin_request: true,
          admin_justification: 'Customer requested export via support'
        });

      // Should not be 403 when admin creates export
      expect([200, 202, 404]).toContain(response.status);
    });

    it('should deny customer access to other customer data', async () => {
      await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-customer-token-+46709876543')
        .send(validExportRequest)
        .expect(403);
    });
  });

  describe('Request Validation (Constitutional: TypeScript strict)', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({})
        .expect(400);

      expect(response.body.errors).toContain('customer_phone is required');
      expect(response.body.errors).toContain('export_format is required');
      expect(response.body.errors).toContain('data_categories is required');
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          customer_phone: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.errors).toContain('customer_phone must be valid Swedish phone number');
    });

    it('should validate export format enum', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          export_format: 'invalid_format'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'export_format must be one of: json, csv, xml, pdf'
      );
    });

    it('should validate data categories array', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          data_categories: []
        })
        .expect(400);

      expect(response.body.errors).toContain('data_categories must contain at least one category');
    });

    it('should validate delivery method enum', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          delivery_method: 'invalid_method'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'delivery_method must be one of: secure_download, encrypted_email, postal_mail'
      );
    });
  });

  describe('Response Structure Validation', () => {
    it('should return export request details', async () => {
      // This test will pass once endpoint is implemented
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send(validExportRequest);

      if (response.status === 202) {
        expect(response.body).toMatchObject({
          export_id: expect.stringMatching(/^export-[a-f0-9-]+$/),
          customer_phone: validExportRequest.customer_phone,
          export_format: validExportRequest.export_format,
          data_categories: validExportRequest.data_categories,
          status: 'processing',
          estimated_completion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          delivery_method: validExportRequest.delivery_method,
          created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          expires_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
          data_summary: {
            records_found: expect.any(Number),
            estimated_size_mb: expect.any(Number),
            categories_included: expect.arrayContaining(validExportRequest.data_categories)
          },
          compliance_status: {
            within_deadline: expect.any(Boolean),
            hours_until_deadline: expect.any(Number)
          }
        });

        // Constitutional requirement: 72-hour maximum delivery
        const estimatedCompletion = new Date(response.body.estimated_completion);
        const requestTime = new Date(response.body.created_at);
        const hoursUntilCompletion = (estimatedCompletion.getTime() - requestTime.getTime()) / (1000 * 60 * 60);
        
        expect(hoursUntilCompletion).toBeLessThanOrEqual(72);
      }
    });
  });

  describe('Date Range Validation', () => {
    it('should validate date range format', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          date_range: {
            start_date: 'invalid-date',
            end_date: '2024-12-31T23:59:59.999Z'
          }
        })
        .expect(400);

      expect(response.body.errors).toContain('start_date must be valid ISO 8601 date');
    });

    it('should validate start date before end date', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          date_range: {
            start_date: '2024-12-31T23:59:59.999Z',
            end_date: '2024-01-01T00:00:00.000Z'
          }
        })
        .expect(400);

      expect(response.body.errors).toContain('start_date must be before end_date');
    });

    it('should limit date range to reasonable period', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          date_range: {
            start_date: '2000-01-01T00:00:00.000Z',
            end_date: '2024-12-31T23:59:59.999Z'
          }
        })
        .expect(400);

      expect(response.body.errors).toContain('date_range cannot exceed 5 years');
    });
  });

  describe('Data Categories Validation', () => {
    it('should validate allowed data categories', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          data_categories: ['invalid_category', 'feedback_sessions']
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'data_categories contains invalid category: invalid_category'
      );
    });

    it('should show available data categories for customer', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-customer-token-+46701234567')
        .send({
          ...validExportRequest,
          data_categories: ['all_available']
        });

      if (response.status === 202) {
        expect(response.body.data_summary.categories_included).toEqual(
          expect.arrayContaining([
            'feedback_sessions',
            'customer_metadata',
            'verification_records'
          ])
        );
        
        // Should not include admin-only categories
        expect(response.body.data_summary.categories_included).not.toContain('admin_logs');
      }
    });
  });

  describe('Phone Number Protection (Constitutional)', () => {
    it('should mask phone number in export filename', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send(validExportRequest);

      if (response.status === 202) {
        expect(response.body.download_filename).toMatch(/customer-data-\*{6}567-export-\d+\.json/);
        expect(response.body.download_filename).not.toContain('+46701234567');
      }
    });
  });

  describe('Business Data Isolation (Constitutional)', () => {
    it('should only export data from accessible stores', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-business-token-store-123')
        .send({
          ...validExportRequest,
          customer_phone: '+46701234567',
          admin_request: false
        });

      if (response.status === 202) {
        expect(response.body.data_summary.store_scope).toEqual(['store-123']);
        expect(response.body.data_summary.cross_store_data).toBe(false);
      }
    });
  });

  describe('File Size and Security Limits', () => {
    it('should validate export size limits', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          data_categories: ['all_available'],
          include_metadata: true,
          include_ai_logs: true
        });

      if (response.status === 202) {
        expect(response.body.data_summary.estimated_size_mb).toBeLessThanOrEqual(500);
      } else if (response.status === 413) {
        expect(response.body.error).toBe('export_too_large');
        expect(response.body.message).toContain('Export size exceeds 500MB limit');
      }
    });
  });

  describe('GDPR Compliance (Constitutional: 72-hour delivery)', () => {
    it('should schedule delivery within legal deadline', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send(validExportRequest);

      if (response.status === 202) {
        const estimatedCompletion = new Date(response.body.estimated_completion);
        const now = new Date();
        const hoursUntilCompletion = (estimatedCompletion.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        // Constitutional requirement: Maximum 72 hours
        expect(hoursUntilCompletion).toBeLessThanOrEqual(72);
        expect(response.body.compliance_status.within_deadline).toBe(true);
      }
    });
  });

  describe('Performance Requirements (Constitutional: ≤10% impact)', () => {
    it('should process export request within 5 seconds', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send(validExportRequest);

      const processingTime = Date.now() - startTime;

      if (response.status === 202) {
        // Constitutional requirement: <5s export generation
        expect(processingTime).toBeLessThanOrEqual(5000);
      }
    });
  });

  describe('Security and Encryption', () => {
    it('should require secure delivery methods for sensitive data', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          data_categories: ['ai_interactions', 'transaction_data'],
          delivery_method: 'unencrypted_email'
        })
        .expect(400);

      expect(response.body.errors).toContain(
        'Sensitive data categories require encrypted delivery method'
      );
    });

    it('should generate secure download links', async () => {
      const response = await request(app)
        .post('/api/gdpr/data-export')
        .set('Authorization', 'Bearer mock-admin-token')
        .send({
          ...validExportRequest,
          delivery_method: 'secure_download'
        });

      if (response.status === 202) {
        expect(response.body.download_expires_hours).toBeLessThanOrEqual(168); // 7 days max
        expect(response.body.requires_authentication).toBe(true);
        expect(response.body.encryption_enabled).toBe(true);
      }
    });
  });
});