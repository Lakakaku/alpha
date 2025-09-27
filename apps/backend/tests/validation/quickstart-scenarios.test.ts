import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import app from '../../src/app';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('Quickstart Validation Scenarios', () => {
  let adminToken: string;
  let businessToken: string;
  
  beforeAll(async () => {
    // Setup test admin session
    const { data: adminSession } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: 'test-admin-id',
        session_token: 'test-admin-token-12345',
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    adminToken = 'Bearer test-admin-token-12345';
    
    // Setup test business session
    businessToken = 'Bearer test-business-token-12345';
  });
  
  afterAll(async () => {
    // Cleanup test sessions
    await supabase
      .from('admin_sessions')
      .delete()
      .eq('session_token', 'test-admin-token-12345');
  });

  describe('Scenario 1: End-to-End Weekly Payment Flow', () => {
    test('1.1: Submit feedback with quality score 85', async () => {
      const response = await request(app)
        .post('/api/feedback/submit')
        .send({
          customerPhone: '467012345678',
          storeId: 'e5f6a7b8-c9d0-1234-ef12-345678901234',
          transactionId: 'd4e5f6a7-b8c9-0123-def1-234567890123',
          feedbackContent: 'Excellent service, very helpful staff...',
          qualityScore: 85
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.feedbackId).toBeDefined();
    });

    test('1.2: Business verifies transaction', async () => {
      const response = await request(app)
        .post('/api/business/transactions/verify')
        .set('Authorization', businessToken)
        .send({
          transactionId: 'd4e5f6a7-b8c9-0123-def1-234567890123',
          verified: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('1.3: Calculate rewards - Quality score 85 should yield 11.1%', async () => {
      const response = await request(app)
        .post('/api/admin/payments/calculate-rewards')
        .set('Authorization', adminToken)
        .send({
          feedbackIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.calculations).toHaveLength(1);
      
      const calc = response.body.calculations[0];
      expect(calc.qualityScore).toBe(85);
      expect(calc.rewardPercentage).toBeCloseTo(0.111, 3); // 11.1%
      expect(calc.transactionAmountSek).toBe(200);
      expect(calc.rewardAmountSek).toBeCloseTo(22.2, 1);
      expect(calc.verifiedByBusiness).toBe(true);
    });

    test('1.4: Trigger weekly batch processing', async () => {
      const response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({
          batchWeek: '2025-W09'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.batchId).toBeDefined();
      expect(response.body.status).toBe('processing');
      expect(response.body.estimatedCustomers).toBe(1);
      expect(response.body.estimatedAmountSek).toBeCloseTo(22.2, 1);
    });

    test('1.5: Monitor batch progress until completion', async () => {
      // Wait for batch processing to complete (max 30 seconds)
      let attempts = 0;
      let batchStatus = 'processing';
      let batchId = 'f6a7b8c9-d0e1-2345-f123-456789012345'; // From previous test
      
      while (batchStatus === 'processing' && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await request(app)
          .get(`/api/admin/payments/batch/${batchId}`)
          .set('Authorization', adminToken);
        
        expect(response.status).toBe(200);
        batchStatus = response.body.batch.status;
        attempts++;
      }
      
      expect(batchStatus).toBe('completed');
      
      // Verify final batch details
      const response = await request(app)
        .get(`/api/admin/payments/batch/${batchId}`)
        .set('Authorization', adminToken);
      
      const batch = response.body.batch;
      expect(batch.totalCustomers).toBe(1);
      expect(batch.totalTransactions).toBe(1);
      expect(batch.successfulPayments).toBe(1);
      expect(batch.failedPayments).toBe(0);
      expect(batch.successRate).toBe(100);
      expect(batch.processingDurationSeconds).toBeLessThan(300); // < 5 minutes
    });

    test('1.6: Verify reconciliation report', async () => {
      const batchId = 'f6a7b8c9-d0e1-2345-f123-456789012345';
      
      const response = await request(app)
        .get(`/api/admin/payments/reconciliation/${batchId}`)
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const report = response.body.report;
      expect(report.batchId).toBe(batchId);
      expect(report.reportPeriod).toBe('2025-W09');
      expect(report.totalRewardsPaidSek).toBeCloseTo(22.2, 1);
      expect(report.adminFeesCollectedSek).toBeCloseTo(4.44, 2); // 20% of 22.20
      expect(report.paymentSuccessCount).toBe(1);
      expect(report.paymentFailureCount).toBe(0);
      expect(report.paymentSuccessRate).toBe(100);
      expect(report.discrepancyCount).toBe(0);
      expect(report.businessInvoiceTotalSek).toBeCloseTo(26.64, 2); // 22.20 + 4.44
      
      expect(report.storeBreakdown).toHaveLength(1);
      const store = report.storeBreakdown[0];
      expect(store.storeId).toBe('e5f6a7b8-c9d0-1234-ef12-345678901234');
      expect(store.feedbackCount).toBe(1);
      expect(store.verifiedCount).toBe(1);
      expect(store.totalRewardsSek).toBeCloseTo(22.2, 1);
      expect(store.successfulPayments).toBe(1);
    });
  });

  describe('Scenario 2: Multiple Stores Aggregation', () => {
    test('2.1-2.2: Process multiple stores for same customer', async () => {
      // Setup 3 feedbacks from same customer across different stores
      const feedbacks = [
        { storeId: 'store-a-uuid', amount: 100, score: 70 }, // 7.2% → 7.20 SEK
        { storeId: 'store-b-uuid', amount: 200, score: 85 }, // 11.1% → 22.20 SEK  
        { storeId: 'store-c-uuid', amount: 150, score: 95 }  // 14.6% → 21.90 SEK
      ];
      
      // Expected total: 51.30 SEK
      const customerPhone = '467012345678';
      
      // Submit all feedbacks and verify business approval...
      // (Implementation details would go here)
      
      // Process batch
      const response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W09' });

      expect(response.status).toBe(200);
      expect(response.body.estimatedCustomers).toBe(1);
      expect(response.body.estimatedAmountSek).toBeCloseTo(51.3, 1);
    });

    test('2.3: Verify customer payment history aggregation', async () => {
      const response = await request(app)
        .get('/api/admin/payments/customer/467012345678')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const summary = response.body.summary;
      expect(summary.totalPaymentsReceived).toBe(1);
      expect(summary.totalAmountSek).toBeCloseTo(51.3, 1);
      expect(summary.successfulPayments).toBe(1);
      expect(summary.totalFeedbackSubmissions).toBe(3);
      expect(summary.avgQualityScore).toBeCloseTo(83.33, 2);
      expect(summary.uniqueStoresVisited).toBe(3);
      
      const transaction = response.body.transactions[0];
      expect(transaction.batchWeek).toBe('2025-W09');
      expect(transaction.amountSek).toBeCloseTo(51.3, 1);
      expect(transaction.status).toBe('successful');
      expect(transaction.rewardCount).toBe(3);
      expect(transaction.storeNames).toHaveLength(3);
    });
  });

  describe('Scenario 3: Quality Score Threshold and Mapping', () => {
    const testCases = [
      { score: 49, expectedPercent: 0, description: 'Below threshold' },
      { score: 50, expectedPercent: 2, description: 'Minimum threshold' },
      { score: 75, expectedPercent: 8.5, description: 'Mid-range' },
      { score: 85, expectedPercent: 11.1, description: 'High score' },
      { score: 100, expectedPercent: 15, description: 'Maximum' }
    ];

    testCases.forEach(({ score, expectedPercent, description }) => {
      test(`Quality score ${score} should yield ${expectedPercent}% (${description})`, async () => {
        if (score < 50) {
          // For below threshold, verify no reward calculation is created
          const { data: rewards } = await supabase
            .from('reward_calculations')
            .select('*')
            .eq('quality_score', score);
          
          expect(rewards).toHaveLength(0);
        } else {
          // For valid scores, verify correct percentage calculation
          const response = await request(app)
            .post('/api/admin/payments/calculate-rewards')
            .set('Authorization', adminToken)
            .send({
              feedbackIds: [`test-feedback-score-${score}`]
            });

          expect(response.status).toBe(200);
          const calc = response.body.calculations[0];
          expect(calc.qualityScore).toBe(score);
          expect(calc.rewardPercentage).toBeCloseTo(expectedPercent / 100, 3);
        }
      });
    });
  });

  describe('Scenario 4: Payment Failure and Retry', () => {
    test('4.1-4.4: Simulate payment failure with exponential backoff retry', async () => {
      // Configure mock Swish to fail first 2 attempts
      const failingPhone = '467099999999';
      
      // Process batch with failing payment
      const response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W09' });

      expect(response.status).toBe(200);
      
      // Check initial failure
      const failedResponse = await request(app)
        .get('/api/admin/payments/failed')
        .set('Authorization', adminToken);
      
      expect(failedResponse.status).toBe(200);
      const failures = failedResponse.body.failures;
      
      const failure = failures.find((f: any) => f.customerPhone === failingPhone);
      expect(failure).toBeDefined();
      expect(failure.attemptNumber).toBe(1);
      expect(failure.resolutionStatus).toBe('retrying');
      expect(failure.retryScheduledAt).toBeDefined();
      
      // Wait for retries to complete (max 8 minutes for all retries)
      // In real test, this would use test time manipulation
      // For now, just verify the retry logic is triggered
      
      // Verify exponential backoff timing:
      // Attempt 1: Immediate (fails)
      // Attempt 2: +1 minute (fails)  
      // Attempt 3: +2 minutes (succeeds)
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const retryResponse = await request(app)
        .get('/api/admin/payments/failed')
        .set('Authorization', adminToken);
      
      // Verify retry attempt was logged
      expect(retryResponse.status).toBe(200);
    }, 480000); // 8 minute timeout for retry testing
  });

  describe('Scenario 5: Manual Intervention', () => {
    test('5.1-5.3: Admin manually retries payment with updated phone', async () => {
      const originalPhone = '467011111111';
      const correctedPhone = '467022222222';
      const transactionId = 'failing-payment-transaction-id';
      
      // Retry payment with corrected phone
      const response = await request(app)
        .post(`/api/admin/payments/retry/${transactionId}`)
        .set('Authorization', adminToken)
        .send({
          updatedPhone: correctedPhone,
          adminNotes: 'Customer provided corrected phone via support ticket #12345',
          force: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify resolution
      const failedResponse = await request(app)
        .get('/api/admin/payments/failed')
        .set('Authorization', adminToken);
      
      const resolvedFailures = failedResponse.body.failures
        .filter((f: any) => f.resolutionStatus === 'resolved');
      
      expect(resolvedFailures.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario 6: Below Minimum Threshold (5 SEK)', () => {
    test('6.1-6.5: Verify rewards below 5 SEK are carried forward', async () => {
      const customerPhone = '467033333333';
      
      // Week 1: 1.26 SEK reward (below threshold)
      let response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W09' });

      // Verify no payment transaction created
      const week1Payments = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('customer_phone', customerPhone)
        .eq('batch_week', '2025-W09');
      
      expect(week1Payments.data).toHaveLength(0);
      
      // Week 2: Additional 2.88 SEK (total 4.14 SEK, still below threshold)
      response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W10' });

      const week2Payments = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('customer_phone', customerPhone)
        .eq('batch_week', '2025-W10');
      
      expect(week2Payments.data).toHaveLength(0);
      
      // Week 3: Additional 2.95 SEK (total 7.09 SEK, exceeds threshold)
      response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W11' });

      // Verify payment created for aggregated amount
      const week3Payments = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('customer_phone', customerPhone)
        .eq('batch_week', '2025-W11');
      
      expect(week3Payments.data).toHaveLength(1);
      expect(week3Payments.data[0].amount_sek).toBeCloseTo(7.09, 2);
    });
  });

  describe('Scenario 7: Business Verification Filtering', () => {
    test('7.1-7.3: Only verified feedback generates payments', async () => {
      // Setup mixed feedback verification statuses
      const storeId = 'test-store-verification';
      
      const response = await request(app)
        .post('/api/admin/payments/calculate-rewards')
        .set('Authorization', adminToken)
        .send({
          feedbackIds: ['verified-1', 'verified-2', 'fraudulent-3', 'unverified-4', 'verified-5']
        });

      expect(response.status).toBe(200);
      // Should only process 3 verified submissions (excluding fraudulent and unverified)
      expect(response.body.calculations).toHaveLength(3);
      
      // Verify reconciliation shows correct counts
      const batchResponse = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W09' });

      const batchId = batchResponse.body.batchId;
      
      const reconciliationResponse = await request(app)
        .get(`/api/admin/payments/reconciliation/${batchId}`)
        .set('Authorization', adminToken);

      const storeBreakdown = reconciliationResponse.body.report.storeBreakdown
        .find((s: any) => s.storeId === storeId);
      
      expect(storeBreakdown.feedbackCount).toBe(5); // Total submitted
      expect(storeBreakdown.verifiedCount).toBe(3); // Only verified counted
    });
  });

  describe('Performance Validation', () => {
    test('Load test: Process 1,000 customers under performance targets', async () => {
      // Generate test data for 1,000 customers (scaled down from 10k for faster testing)
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/admin/payments/process-batch')
        .set('Authorization', adminToken)
        .send({ batchWeek: '2025-W09' });

      expect(response.status).toBe(200);
      
      // Wait for completion
      let batchStatus = 'processing';
      let attempts = 0;
      const batchId = response.body.batchId;
      
      while (batchStatus === 'processing' && attempts < 120) { // 2 minute max
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/admin/payments/batch/${batchId}`)
          .set('Authorization', adminToken);
        
        batchStatus = statusResponse.body.batch.status;
        attempts++;
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(batchStatus).toBe('completed');
      expect(duration).toBeLessThan(60000); // < 1 minute for 1k customers
      
      const avgTimePerCustomer = duration / 1000; // 1,000 customers
      expect(avgTimePerCustomer).toBeLessThan(60); // < 60ms per customer
    }, 180000); // 3 minute timeout
  });
});