import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { supabase } from '../../src/config/database';
import { RewardCalculatorService } from '../../src/services/payment/reward-calculator';
import { PaymentProcessorService } from '../../src/services/payment/payment-processor';
import { BatchSchedulerService } from '../../src/services/payment/batch-scheduler';
import { ReconciliationService } from '../../src/services/payment/reconciliation';
import type { PaymentBatch, ReconciliationReport } from '@vocilia/types';

describe('Integration: End-to-end weekly payment flow', () => {
  let rewardCalculator: RewardCalculatorService;
  let paymentProcessor: PaymentProcessorService;
  let batchScheduler: BatchSchedulerService;
  let reconciliationService: ReconciliationService;
  
  let testStoreId: string;
  let testBusinessId: string;
  let testFeedbackId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    // Initialize services
    rewardCalculator = new RewardCalculatorService();
    paymentProcessor = new PaymentProcessorService();
    batchScheduler = new BatchSchedulerService(paymentProcessor);
    reconciliationService = new ReconciliationService();

    // Create test business and store
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business E2E',
        subscription_status: 'active'
      })
      .select()
      .single();

    testBusinessId = business.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({
        business_id: testBusinessId,
        name: 'Test Store E2E',
        active: true
      })
      .select()
      .single();

    testStoreId = store.id;

    // Create test transaction
    const { data: transaction } = await supabase
      .from('transactions')
      .insert({
        store_id: testStoreId,
        amount_sek: 200.00,
        status: 'completed',
        verified: true
      })
      .select()
      .single();

    testTransactionId = transaction.id;

    // Create test feedback session with quality score 85
    const { data: feedback } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_phone: '467012345678',
        store_id: testStoreId,
        transaction_id: testTransactionId,
        quality_score: 85,
        ai_feedback: 'Excellent service and food quality',
        verified_by_business: false // Will be verified in test
      })
      .select()
      .single();

    testFeedbackId = feedback.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('feedback_sessions').delete().eq('id', testFeedbackId);
    await supabase.from('transactions').delete().eq('id', testTransactionId);
    await supabase.from('stores').delete().eq('id', testStoreId);
    await supabase.from('businesses').delete().eq('id', testBusinessId);
  });

  it('should complete full payment flow from feedback to reconciliation', async () => {
    // Scenario 1: Submit feedback with quality score 85
    expect(testFeedbackId).toBeDefined();

    // Step 1: Business verifies transaction
    await supabase
      .from('feedback_sessions')
      .update({ verified_by_business: true })
      .eq('id', testFeedbackId);

    // Step 2: Calculate rewards (expect 11.1% of 200 SEK = 22.20 SEK)
    const rewards = await rewardCalculator.calculateRewardsForFeedback([testFeedbackId]);
    
    expect(rewards.length).toBe(1);
    expect(rewards[0].quality_score).toBe(85);
    expect(rewards[0].reward_percentage).toBeCloseTo(11.1, 1); // (85-50)/50 * 13 + 2
    expect(rewards[0].reward_amount_sek).toBeCloseTo(22.20, 2);
    expect(rewards[0].verified_by_business).toBe(true);

    // Step 3: Trigger batch processing
    const batchWeek = '2025-W20';
    const batch = await batchScheduler.processBatch(batchWeek);
    
    expect(batch).toBeDefined();
    expect(batch.batch_week).toBe(batchWeek);
    expect(batch.status).toMatch(/completed|partial/);
    expect(batch.total_customers).toBeGreaterThanOrEqual(1);
    expect(batch.total_amount_sek).toBeGreaterThanOrEqual(22.20);

    // Step 4: Verify payment status successful
    const { data: paymentTransaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('batch_id', batch.id)
      .eq('customer_phone', '467012345678')
      .single();

    expect(paymentTransaction).toBeDefined();
    expect(paymentTransaction.amount_ore).toBe(2220); // 22.20 SEK in öre
    expect(paymentTransaction.status).toMatch(/successful|processing/);

    // Step 5: Verify reconciliation report shows 0 discrepancies
    const report = await reconciliationService.generateReport(batch.id);
    
    expect(report).toBeDefined();
    expect(report.batch_id).toBe(batch.id);
    expect(report.report_period).toBe(batchWeek);
    expect(report.total_rewards_paid_sek).toBeGreaterThanOrEqual(22.20);
    expect(report.admin_fees_collected_sek).toBeGreaterThanOrEqual(4.44); // 20% of 22.20
    expect(report.payment_success_count).toBeGreaterThanOrEqual(1);
    
    // Check for discrepancies
    if (report.discrepancies) {
      const discrepancyCount = Object.keys(report.discrepancies).length;
      expect(discrepancyCount).toBe(0);
    }
  });

  it('should handle business verification requirement', async () => {
    // Create unverified feedback
    const { data: unverifiedFeedback } = await supabase
      .from('feedback_sessions')
      .insert({
        customer_phone: '467087654321',
        store_id: testStoreId,
        transaction_id: testTransactionId,
        quality_score: 90,
        ai_feedback: 'Great experience',
        verified_by_business: false
      })
      .select()
      .single();

    // Attempt to calculate rewards for unverified feedback
    const rewards = await rewardCalculator.calculateRewardsForFeedback([unverifiedFeedback.id]);
    
    // Should not create reward for unverified feedback
    expect(rewards.length).toBe(0);

    // Cleanup
    await supabase.from('feedback_sessions').delete().eq('id', unverifiedFeedback.id);
  });

  it('should correctly calculate admin fees', async () => {
    // Get a recent batch
    const { data: batch } = await supabase
      .from('payment_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (batch) {
      // Generate reconciliation report
      const report = await reconciliationService.generateReport(batch.id);
      
      // Admin fees should be 20% of total rewards
      const expectedAdminFee = report.total_rewards_paid_sek * 0.20;
      expect(report.admin_fees_collected_sek).toBeCloseTo(expectedAdminFee, 2);
      
      // Total business invoices should be rewards + admin fees
      const expectedTotal = report.total_rewards_paid_sek + report.admin_fees_collected_sek;
      expect(report.total_business_invoices_sek).toBeCloseTo(expectedTotal, 2);
    }
  });

  it('should track payment success rate', async () => {
    // Get a recent batch with mixed results
    const { data: batch } = await supabase
      .from('payment_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (batch && batch.successful_payments + batch.failed_payments > 0) {
      const expectedSuccessRate = (batch.successful_payments / (batch.successful_payments + batch.failed_payments)) * 100;
      
      const report = await reconciliationService.generateReport(batch.id);
      expect(report.payment_success_rate).toBeCloseTo(expectedSuccessRate, 2);
    }
  });
});