import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../setup';
import { GDPRComplianceService } from '../../apps/backend/src/services/security/GDPRComplianceService';
import { createSupabaseClient } from '../../packages/database/src/client/supabase';

describe('GDPR Compliance Verification', () => {
  let app: Express;
  let gdprService: GDPRComplianceService;
  let supabase: any;
  let testCustomerPhone: string;
  let testStoreId: string;
  let adminToken: string;

  beforeEach(async () => {
    app = await createTestApp();
    gdprService = new GDPRComplianceService();
    supabase = createSupabaseClient();
    testCustomerPhone = '+46701234567';
    testStoreId = '123e4567-e89b-12d3-a456-426614174001';
    
    // Get admin token for GDPR operations
    const adminLogin = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@vocilia.com',
        password: 'validpassword'
      });
    adminToken = adminLogin.body.token;

    // Create test customer data across multiple tables
    await this.createTestCustomerData();
  });

  afterEach(async () => {
    // Clean up test data
    await this.cleanupTestData();
  });

  describe('72-Hour GDPR Deletion Response', () => {
    it('should process deletion requests within 72 hours', async () => {
      const requestStart = new Date();

      // Submit GDPR deletion request
      const deletionResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: true
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deletionResponse.status).toBe(202);
      expect(deletionResponse.body).toHaveProperty('request_id');
      expect(deletionResponse.body).toHaveProperty('estimated_completion');
      
      const requestId = deletionResponse.body.request_id;
      const estimatedCompletion = new Date(deletionResponse.body.estimated_completion);
      const timeDifference = estimatedCompletion.getTime() - requestStart.getTime();
      
      // Verify estimated completion is within 72 hours
      expect(timeDifference).toBeLessThanOrEqual(72 * 60 * 60 * 1000); // 72 hours in milliseconds

      // Process the deletion request (simulate background job)
      await gdprService.processDeletionRequest(requestId);

      // Verify deletion completion
      const statusResponse = await request(app)
        .get(`/api/gdpr/deletion-requests/${requestId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe('completed');
      
      const completionTime = new Date(statusResponse.body.completion_timestamp);
      const actualProcessingTime = completionTime.getTime() - requestStart.getTime();
      
      // Verify actual processing was within 72 hours
      expect(actualProcessingTime).toBeLessThanOrEqual(72 * 60 * 60 * 1000);
    });

    it('should handle urgent deletion requests within 24 hours', async () => {
      const requestStart = new Date();

      // Submit urgent GDPR deletion request
      const urgentDeletionResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'urgent_deletion',
          urgency_reason: 'data_breach_concern',
          customer_consent: true
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(urgentDeletionResponse.status).toBe(202);
      
      const requestId = urgentDeletionResponse.body.request_id;
      const estimatedCompletion = new Date(urgentDeletionResponse.body.estimated_completion);
      const timeDifference = estimatedCompletion.getTime() - requestStart.getTime();
      
      // Urgent requests should be processed within 24 hours
      expect(timeDifference).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      
      // Process urgent deletion
      await gdprService.processDeletionRequest(requestId, { urgent: true });

      const statusResponse = await request(app)
        .get(`/api/gdpr/deletion-requests/${requestId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusResponse.body.status).toBe('completed');
      expect(statusResponse.body.processing_priority).toBe('urgent');
    });
  });

  describe('Complete Data Deletion Verification', () => {
    it('should delete all customer data across all tables', async () => {
      // Submit deletion request
      const deletionResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: true
        })
        .set('Authorization', `Bearer ${adminToken}`);

      const requestId = deletionResponse.body.request_id;
      
      // Process deletion
      await gdprService.processDeletionRequest(requestId);

      // Verify data deletion across all tables
      const tablesToCheck = [
        'transactions',
        'feedback_sessions',
        'verification_records',
        'call_sessions',
        'customer_verifications'
      ];

      for (const table of tablesToCheck) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('customer_phone', testCustomerPhone);

        expect(error).toBeNull();
        expect(data.length).toBe(0);
      }

      // Verify deletion was recorded in audit trail
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'GDPR_DATA_DELETION')
        .eq('resource_id', requestId);

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toHaveProperty('details');
      expect(auditLogs[0].details).toContain('complete_deletion');
    });

    it('should verify deletion completeness with record counting', async () => {
      // Count records before deletion
      const preCountResponse = await request(app)
        .post('/api/gdpr/deletion-requests/pre-count')
        .send({
          customer_identifier: testCustomerPhone
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(preCountResponse.status).toBe(200);
      const expectedDeletions = preCountResponse.body.total_records;
      expect(expectedDeletions).toBeGreaterThan(0);

      // Submit and process deletion
      const deletionResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: true
        })
        .set('Authorization', `Bearer ${adminToken}`);

      const requestId = deletionResponse.body.request_id;
      await gdprService.processDeletionRequest(requestId);

      // Verify deletion with verification endpoint
      const verificationResponse = await request(app)
        .post(`/api/gdpr/deletion-requests/${requestId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(verificationResponse.status).toBe(200);
      expect(verificationResponse.body.verification_status).toBe('complete');
      expect(verificationResponse.body.records_deleted).toBe(expectedDeletions);
      expect(verificationResponse.body.records_remaining).toBe(0);
    });

    it('should maintain deletion audit trail permanently', async () => {
      // Submit deletion request
      const deletionResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: true
        })
        .set('Authorization', `Bearer ${adminToken}`);

      const requestId = deletionResponse.body.request_id;
      
      // Process deletion
      await gdprService.processDeletionRequest(requestId);

      // Verify GDPR compliance record exists
      const { data: gdprRecords } = await supabase
        .from('gdpr_compliance_records')
        .select('*')
        .eq('id', requestId);

      expect(gdprRecords.length).toBe(1);
      const gdprRecord = gdprRecords[0];
      
      expect(gdprRecord.request_type).toBe('DataDeletion');
      expect(gdprRecord.compliance_status).toBe('Completed');
      expect(gdprRecord.audit_trail).toBeDefined();
      expect(Array.isArray(gdprRecord.audit_trail)).toBe(true);
      expect(gdprRecord.audit_trail.length).toBeGreaterThan(0);
      
      // Verify audit trail contains required information
      const auditTrail = gdprRecord.audit_trail;
      expect(auditTrail.some((entry: any) => entry.action === 'request_received')).toBe(true);
      expect(auditTrail.some((entry: any) => entry.action === 'deletion_started')).toBe(true);
      expect(auditTrail.some((entry: any) => entry.action === 'deletion_completed')).toBe(true);
      expect(auditTrail.some((entry: any) => entry.action === 'verification_performed')).toBe(true);
    });
  });

  describe('Data Export Validation', () => {
    it('should provide complete customer data export', async () => {
      // Request data export
      const exportResponse = await request(app)
        .post('/api/gdpr/data-export')
        .send({
          customer_identifier: testCustomerPhone,
          export_format: 'json',
          include_deleted: false
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body).toHaveProperty('export_id');
      expect(exportResponse.body).toHaveProperty('download_url');
      expect(exportResponse.body).toHaveProperty('expiry_date');

      // Download export data
      const downloadResponse = await request(app)
        .get(exportResponse.body.download_url)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(downloadResponse.status).toBe(200);
      
      const exportData = downloadResponse.body;
      expect(exportData).toHaveProperty('customer_data');
      expect(exportData).toHaveProperty('export_metadata');
      
      // Verify all customer data is included
      const customerData = exportData.customer_data;
      expect(customerData).toHaveProperty('transactions');
      expect(customerData).toHaveProperty('feedback_sessions');
      expect(customerData).toHaveProperty('verification_records');
      
      // Verify data completeness
      expect(customerData.transactions.length).toBeGreaterThan(0);
      expect(customerData.feedback_sessions.length).toBeGreaterThan(0);
      
      // Verify export metadata
      const metadata = exportData.export_metadata;
      expect(metadata).toHaveProperty('export_date');
      expect(metadata).toHaveProperty('total_records');
      expect(metadata).toHaveProperty('data_sources');
      expect(metadata.total_records).toBeGreaterThan(0);
    });

    it('should support multiple export formats', async () => {
      const formats = ['json', 'csv', 'xml'];
      
      for (const format of formats) {
        const exportResponse = await request(app)
          .post('/api/gdpr/data-export')
          .send({
            customer_identifier: testCustomerPhone,
            export_format: format
          })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(exportResponse.status).toBe(200);
        expect(exportResponse.body.export_format).toBe(format);
        
        // Verify download works for each format
        const downloadResponse = await request(app)
          .get(exportResponse.body.download_url)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(downloadResponse.status).toBe(200);
        
        // Verify content type matches format
        if (format === 'json') {
          expect(downloadResponse.headers['content-type']).toContain('application/json');
        } else if (format === 'csv') {
          expect(downloadResponse.headers['content-type']).toContain('text/csv');
        } else if (format === 'xml') {
          expect(downloadResponse.headers['content-type']).toContain('application/xml');
        }
      }
    });
  });

  describe('Consent Management', () => {
    it('should validate customer consent for data processing', async () => {
      // Test deletion request without consent
      const noConsentResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: false
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(noConsentResponse.status).toBe(400);
      expect(noConsentResponse.body.error).toContain('consent');

      // Test with valid consent
      const validConsentResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: true,
          consent_timestamp: new Date().toISOString(),
          consent_method: 'verified_phone_call'
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(validConsentResponse.status).toBe(202);
      
      // Verify consent is recorded in GDPR record
      const requestId = validConsentResponse.body.request_id;
      const { data: gdprRecord } = await supabase
        .from('gdpr_compliance_records')
        .select('*')
        .eq('id', requestId);

      expect(gdprRecord[0]).toHaveProperty('legal_basis');
      expect(gdprRecord[0].legal_basis).toContain('customer_consent');
    });
  });

  describe('Data Protection Audit Workflow', () => {
    it('should initiate comprehensive data protection audit', async () => {
      const auditResponse = await request(app)
        .post('/api/privacy/data-protection-audit')
        .send({
          workflow_type: 'comprehensive_audit',
          scope: ['customer_data', 'business_data', 'system_logs'],
          compliance_standards: ['GDPR', 'Swedish_DPA']
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditResponse.status).toBe(202);
      expect(auditResponse.body).toHaveProperty('audit_id');
      expect(auditResponse.body).toHaveProperty('estimated_completion');
      
      const auditId = auditResponse.body.audit_id;
      
      // Check audit progress
      const progressResponse = await request(app)
        .get(`/api/privacy/data-protection-audit/${auditId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(progressResponse.status).toBe(200);
      expect(progressResponse.body).toHaveProperty('audit_status');
      expect(progressResponse.body).toHaveProperty('compliance_score');
      expect(progressResponse.body).toHaveProperty('findings');
      
      // Verify audit results quality
      const audit = progressResponse.body;
      if (audit.audit_status === 'completed') {
        expect(audit.compliance_score).toBeGreaterThanOrEqual(90); // High compliance required
        expect(Array.isArray(audit.findings)).toBe(true);
        expect(audit).toHaveProperty('data_flow_analysis');
        expect(audit).toHaveProperty('retention_compliance');
        expect(audit).toHaveProperty('access_control_review');
      }
    });
  });

  describe('Performance and Monitoring', () => {
    it('should complete GDPR operations within performance limits', async () => {
      const startTime = Date.now();
      
      // Submit deletion request
      const deletionResponse = await request(app)
        .post('/api/gdpr/deletion-requests')
        .send({
          customer_identifier: testCustomerPhone,
          request_type: 'complete_deletion',
          customer_consent: true
        })
        .set('Authorization', `Bearer ${adminToken}`);

      const requestTime = Date.now() - startTime;
      
      // GDPR request submission should be fast
      expect(requestTime).toBeLessThan(2000); // 2 seconds max
      expect(deletionResponse.status).toBe(202);
      
      // Process deletion and measure time
      const processingStart = Date.now();
      const requestId = deletionResponse.body.request_id;
      await gdprService.processDeletionRequest(requestId);
      const processingTime = Date.now() - processingStart;
      
      // Deletion processing should complete quickly for test data
      expect(processingTime).toBeLessThan(10000); // 10 seconds max for test data
      
      // Verify no performance degradation on other operations
      const apiTestStart = Date.now();
      const healthResponse = await request(app).get('/api/health');
      const apiTestTime = Date.now() - apiTestStart;
      
      expect(healthResponse.status).toBe(200);
      expect(apiTestTime).toBeLessThan(1000); // Should not affect other API performance
    });
  });

  // Helper methods
  private async createTestCustomerData(): Promise<void> {
    // Create test business and store
    await supabase.from('businesses').upsert({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Business',
      email: 'test@business.com'
    });
    
    await supabase.from('stores').upsert({
      id: testStoreId,
      business_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Store'
    });

    // Create customer data across multiple tables
    await supabase.from('transactions').insert([
      {
        id: '123e4567-e89b-12d3-a456-426614175001',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        amount: 25000,
        transaction_time: new Date().toISOString(),
        status: 'verified'
      },
      {
        id: '123e4567-e89b-12d3-a456-426614175002',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        amount: 15000,
        transaction_time: new Date(Date.now() - 86400000).toISOString(),
        status: 'verified'
      }
    ]);

    await supabase.from('feedback_sessions').insert([
      {
        id: '123e4567-e89b-12d3-a456-426614175003',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        status: 'completed',
        feedback_content: 'Great service!',
        quality_score: 85
      }
    ]);

    await supabase.from('verification_records').insert([
      {
        id: '123e4567-e89b-12d3-a456-426614175004',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        verification_status: 'verified',
        verification_method: 'phone_call',
        verified_at: new Date().toISOString()
      }
    ]);
  }

  private async cleanupTestData(): Promise<void> {
    // Clean up all test data
    const tables = [
      'gdpr_compliance_records',
      'audit_logs',
      'verification_records', 
      'feedback_sessions',
      'transactions',
      'stores',
      'businesses'
    ];

    for (const table of tables) {
      if (['stores', 'businesses'].includes(table)) {
        await supabase.from(table).delete().eq('id', table === 'stores' ? testStoreId : '123e4567-e89b-12d3-a456-426614174000');
      } else if (table === 'gdpr_compliance_records' || table === 'audit_logs') {
        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        await supabase.from(table).delete().eq('customer_phone', testCustomerPhone);
      }
    }
  }
});