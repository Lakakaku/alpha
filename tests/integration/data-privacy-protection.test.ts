import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../setup';
import { PrivacyAssessmentService } from '../../apps/backend/src/services/security/PrivacyAssessmentService';
import { createSupabaseClient } from '../../packages/database/src/client/supabase';

describe('Data Privacy Protection Validation', () => {
  let app: Express;
  let privacyAssessmentService: PrivacyAssessmentService;
  let supabase: any;
  let testBusinessId: string;
  let testStoreId: string;
  let testCustomerPhone: string;

  beforeEach(async () => {
    app = await createTestApp();
    privacyAssessmentService = new PrivacyAssessmentService();
    supabase = createSupabaseClient();
    
    // Create test data
    testBusinessId = '123e4567-e89b-12d3-a456-426614174000';
    testStoreId = '123e4567-e89b-12d3-a456-426614174001';
    testCustomerPhone = '+46701234567';
    
    // Insert test business and store
    await supabase.from('businesses').upsert({
      id: testBusinessId,
      name: 'Test Business',
      email: 'test@business.com'
    });
    
    await supabase.from('stores').upsert({
      id: testStoreId,
      business_id: testBusinessId,
      name: 'Test Store',
      address: 'Test Address'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('feedback_sessions').delete().eq('store_id', testStoreId);
    await supabase.from('transactions').delete().eq('store_id', testStoreId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
    await supabase.from('privacy_assessments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('Customer Phone Number Protection', () => {
    it('should never expose customer phone numbers to businesses', async () => {
      // Create a feedback session with customer phone
      const feedbackSessionId = '123e4567-e89b-12d3-a456-426614174002';
      await supabase.from('feedback_sessions').insert({
        id: feedbackSessionId,
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        status: 'completed',
        feedback_content: 'Great service!',
        quality_score: 85
      });

      // Business tries to access feedback data
      const businessLoginResponse = await request(app)
        .post('/api/business/auth/login')
        .send({
          email: 'test@business.com',
          password: 'validpassword'
        });

      const businessToken = businessLoginResponse.body.token;

      // Business requests feedback data
      const feedbackResponse = await request(app)
        .get(`/api/business/feedback/${testStoreId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(feedbackResponse.status).toBe(200);
      
      // Verify phone numbers are not included in response
      const feedbackData = feedbackResponse.body;
      expect(JSON.stringify(feedbackData)).not.toContain(testCustomerPhone);
      expect(JSON.stringify(feedbackData)).not.toContain('+46701234567');
      expect(JSON.stringify(feedbackData)).not.toContain('701234567');
      
      // Verify anonymized identifier is used instead
      expect(feedbackData.feedback_sessions).toBeDefined();
      expect(feedbackData.feedback_sessions[0]).toHaveProperty('customer_id');
      expect(feedbackData.feedback_sessions[0].customer_id).toMatch(/^anon_[a-f0-9]{8}$/);
      
      // Record privacy assessment
      await privacyAssessmentService.recordDataExposureTest({
        component_name: 'business_feedback_api',
        data_type: 'customer_phone',
        exposure_detected: false,
        anonymization_verified: true
      });
    });

    it('should anonymize phone numbers in all API responses', async () => {
      // Create transaction data
      await supabase.from('transactions').insert({
        id: '123e4567-e89b-12d3-a456-426614174003',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        amount: 25000, // 250 SEK in öre
        transaction_time: new Date().toISOString(),
        status: 'verified'
      });

      // Test multiple API endpoints that might expose customer data
      const businessToken = await this.getBusinessToken();
      
      const endpoints = [
        `/api/business/transactions/${testStoreId}`,
        `/api/business/analytics/${testStoreId}`,
        `/api/business/reports/${testStoreId}`,
        `/api/business/feedback/${testStoreId}`
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${businessToken}`);

        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          
          // Check for phone number patterns
          expect(responseText).not.toMatch(/\+46\d{9}/); // Swedish phone format
          expect(responseText).not.toMatch(/46\d{9}/);   // Without plus
          expect(responseText).not.toMatch(/0\d{9}/);    // Domestic format
          expect(responseText).not.toContain(testCustomerPhone);
          
          // Verify anonymized customer identifiers are used
          if (response.body.transactions || response.body.feedback_sessions) {
            const data = response.body.transactions || response.body.feedback_sessions;
            if (data.length > 0) {
              expect(data[0]).toHaveProperty('customer_id');
              expect(data[0].customer_id).toMatch(/^anon_[a-f0-9]{8}$/);
            }
          }
        }
      }
    });

    it('should prevent phone number reconstruction from partial data', async () => {
      // Create multiple transactions for same customer with different stores
      const stores = [testStoreId];
      for (let i = 0; i < 5; i++) {
        await supabase.from('transactions').insert({
          id: `123e4567-e89b-12d3-a456-42661417400${i}`,
          store_id: testStoreId,
          customer_phone: testCustomerPhone,
          amount: 10000 + (i * 5000),
          transaction_time: new Date(Date.now() - (i * 86400000)).toISOString(),
          status: 'verified'
        });
      }

      const businessToken = await this.getBusinessToken();
      
      // Get transaction data
      const transactionResponse = await request(app)
        .get(`/api/business/transactions/${testStoreId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(transactionResponse.status).toBe(200);
      
      const transactions = transactionResponse.body.transactions;
      
      // Verify consistent anonymized customer IDs
      const customerIds = transactions.map((t: any) => t.customer_id);
      const uniqueCustomerIds = [...new Set(customerIds)];
      
      // Same customer should have same anonymized ID
      expect(uniqueCustomerIds.length).toBe(1);
      expect(uniqueCustomerIds[0]).toMatch(/^anon_[a-f0-9]{8}$/);
      
      // Verify no correlation patterns that could reveal identity
      expect(transactions.every((t: any) => !t.customer_phone)).toBe(true);
      expect(transactions.every((t: any) => !t.phone_hash)).toBe(true);
      expect(transactions.every((t: any) => !t.phone_partial)).toBe(true);
    });
  });

  describe('Transaction Data Anonymization', () => {
    it('should anonymize transaction patterns for business delivery', async () => {
      // Create transaction pattern that could identify customer
      const transactionPattern = [
        { amount: 15000, time: '2025-01-01T10:00:00Z' },
        { amount: 25000, time: '2025-01-02T10:15:00Z' },
        { amount: 15000, time: '2025-01-03T10:30:00Z' },
        { amount: 30000, time: '2025-01-04T10:45:00Z' }
      ];

      for (let i = 0; i < transactionPattern.length; i++) {
        await supabase.from('transactions').insert({
          id: `123e4567-e89b-12d3-a456-42661417500${i}`,
          store_id: testStoreId,
          customer_phone: testCustomerPhone,
          amount: transactionPattern[i].amount,
          transaction_time: transactionPattern[i].time,
          status: 'verified'
        });
      }

      const businessToken = await this.getBusinessToken();
      
      // Request analytics data
      const analyticsResponse = await request(app)
        .get(`/api/business/analytics/${testStoreId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(analyticsResponse.status).toBe(200);
      
      const analytics = analyticsResponse.body;
      
      // Verify transaction timing is generalized
      if (analytics.transaction_patterns) {
        analytics.transaction_patterns.forEach((pattern: any) => {
          // Times should be rounded to hour or broader
          expect(pattern.time).not.toContain(':15:00');
          expect(pattern.time).not.toContain(':30:00');
          expect(pattern.time).not.toContain(':45:00');
        });
      }
      
      // Verify amounts may be grouped into ranges
      if (analytics.amount_distribution) {
        expect(analytics.amount_distribution).toHaveProperty('ranges');
        expect(Array.isArray(analytics.amount_distribution.ranges)).toBe(true);
      }
    });

    it('should prevent customer identification through transaction inference', async () => {
      // Create unique transaction pattern that could fingerprint customer
      await supabase.from('transactions').insert({
        id: '123e4567-e89b-12d3-a456-426614175001',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        amount: 17239, // Very specific amount
        transaction_time: '2025-01-01T14:27:33Z', // Specific time
        status: 'verified'
      });

      // Create feedback session with specific quality score
      await supabase.from('feedback_sessions').insert({
        id: '123e4567-e89b-12d3-a456-426614175002',
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        quality_score: 73, // Specific score
        feedback_content: 'The coffee was perfect temperature',
        status: 'completed'
      });

      const businessToken = await this.getBusinessToken();
      
      // Business gets aggregated data
      const [transactionResponse, feedbackResponse] = await Promise.all([
        request(app)
          .get(`/api/business/transactions/${testStoreId}`)
          .set('Authorization', `Bearer ${businessToken}`),
        request(app)
          .get(`/api/business/feedback/${testStoreId}`)
          .set('Authorization', `Bearer ${businessToken}`)
      ]);

      // Verify data correlation is prevented
      const transactions = transactionResponse.body.transactions;
      const feedback = feedbackResponse.body.feedback_sessions;
      
      // Customer IDs should be different systems (preventing correlation)
      const transactionCustomerId = transactions[0]?.customer_id;
      const feedbackCustomerId = feedback[0]?.customer_id;
      
      // Either use same consistent anonymized ID or different systems
      if (transactionCustomerId && feedbackCustomerId) {
        // If same ID used, verify it's properly anonymized
        expect(transactionCustomerId).toMatch(/^anon_[a-f0-9]{8}$/);
        expect(feedbackCustomerId).toMatch(/^anon_[a-f0-9]{8}$/);
      }
      
      // Verify exact amounts/scores are not exposed
      expect(transactions[0]?.amount).not.toBe(17239);
      expect(feedback[0]?.quality_score).not.toBe(73);
    });
  });

  describe('Cross-Store Data Isolation', () => {
    it('should prevent businesses from accessing other business data', async () => {
      // Create another business and store
      const otherBusinessId = '123e4567-e89b-12d3-a456-426614174010';
      const otherStoreId = '123e4567-e89b-12d3-a456-426614174011';
      
      await supabase.from('businesses').insert({
        id: otherBusinessId,
        name: 'Other Business',
        email: 'other@business.com'
      });
      
      await supabase.from('stores').insert({
        id: otherStoreId,
        business_id: otherBusinessId,
        name: 'Other Store'
      });

      // Create data for other business
      await supabase.from('transactions').insert({
        id: '123e4567-e89b-12d3-a456-426614175010',
        store_id: otherStoreId,
        customer_phone: '+46709876543',
        amount: 50000,
        transaction_time: new Date().toISOString(),
        status: 'verified'
      });

      const businessToken = await this.getBusinessToken();
      
      // Try to access other business's data
      const unauthorizedResponse = await request(app)
        .get(`/api/business/transactions/${otherStoreId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(unauthorizedResponse.status).toBe(403);
      expect(unauthorizedResponse.body.error).toContain('Forbidden');
      
      // Verify audit logging
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'UNAUTHORIZED_ACCESS_ATTEMPT')
        .eq('resource_id', otherStoreId);
      
      expect(auditLogs.length).toBeGreaterThan(0);
      
      // Clean up
      await supabase.from('transactions').delete().eq('store_id', otherStoreId);
      await supabase.from('stores').delete().eq('id', otherStoreId);
      await supabase.from('businesses').delete().eq('id', otherBusinessId);
    });
  });

  describe('Data Retention and Automatic Deletion', () => {
    it('should automatically delete expired customer data', async () => {
      // Create old transaction data (beyond retention period)
      const oldTransactionId = '123e4567-e89b-12d3-a456-426614175020';
      await supabase.from('transactions').insert({
        id: oldTransactionId,
        store_id: testStoreId,
        customer_phone: testCustomerPhone,
        amount: 20000,
        transaction_time: new Date(Date.now() - (400 * 24 * 60 * 60 * 1000)).toISOString(), // 400 days ago
        status: 'verified'
      });

      // Trigger automatic cleanup (would normally be a cron job)
      await request(app)
        .post('/api/admin/privacy/cleanup-expired-data')
        .set('Authorization', `Bearer ${await this.getAdminToken()}`);

      // Verify old data is deleted
      const { data: remainingData } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', oldTransactionId);

      expect(remainingData.length).toBe(0);
      
      // Verify audit trail exists
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'DATA_DELETION')
        .eq('resource_id', oldTransactionId);

      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Privacy Assessment Reporting', () => {
    it('should generate privacy compliance reports', async () => {
      // Create test data for assessment
      await this.createTestPrivacyData();
      
      const adminToken = await this.getAdminToken();
      
      // Generate privacy assessment report
      const reportResponse = await request(app)
        .post('/api/admin/privacy/assessments')
        .send({
          component_name: 'business_api',
          assessment_type: 'data_exposure_audit'
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(reportResponse.status).toBe(200);
      
      const assessment = reportResponse.body;
      expect(assessment).toHaveProperty('compliance_score');
      expect(assessment.compliance_score).toBeGreaterThanOrEqual(95); // High compliance required
      expect(assessment).toHaveProperty('anonymization_status');
      expect(assessment.anonymization_status).toBe('verified');
      expect(assessment).toHaveProperty('risk_level');
      expect(['low', 'medium']).toContain(assessment.risk_level);
    });
  });

  // Helper methods
  private async getBusinessToken(): Promise<string> {
    const loginResponse = await request(this.app)
      .post('/api/business/auth/login')
      .send({
        email: 'test@business.com',
        password: 'validpassword'
      });
    return loginResponse.body.token;
  }

  private async getAdminToken(): Promise<string> {
    const loginResponse = await request(this.app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@vocilia.com',
        password: 'validpassword'
      });
    return loginResponse.body.token;
  }

  private async createTestPrivacyData(): Promise<void> {
    // Create test data for privacy assessment
    await this.supabase.from('feedback_sessions').insert([
      {
        id: '123e4567-e89b-12d3-a456-426614175030',
        store_id: this.testStoreId,
        customer_phone: this.testCustomerPhone,
        status: 'completed',
        feedback_content: 'Test feedback',
        quality_score: 80
      }
    ]);
  }
});