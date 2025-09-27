import { Router, Request, Response } from 'express';
import { Router, Request, Response } from 'express';
import { adminAuth } from '../../middleware/admin-auth';
import { RewardCalculatorService } from '../../services/payment/reward-calculator';
import { BatchSchedulerService } from '../../services/payment/batch-scheduler';
import { PaymentProcessorService } from '../../services/payment/payment-processor';
import { ReconciliationService } from '../../services/payment/reconciliation';
import { MockSwishClient } from '../../services/payment/swish-client';
import { PaymentBatchQueries, PaymentTransactionQueries, PaymentFailureQueries, RewardCalculationQueries } from '@vocilia/database';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const swishClient = new MockSwishClient(0.9);
const rewardCalculator = new RewardCalculatorService(supabase);
const paymentProcessor = new PaymentProcessorService(supabase, swishClient);
const batchScheduler = new BatchSchedulerService(supabase, paymentProcessor);
const reconciliation = new ReconciliationService(supabase);

const batchQueries = new PaymentBatchQueries(supabase);
const transactionQueries = new PaymentTransactionQueries(supabase);
const failureQueries = new PaymentFailureQueries(supabase);
const rewardQueries = new RewardCalculationQueries(supabase);

interface AdminRequest extends Request {
  admin?: {
    id: string;
    username: string;
  };
}

router.post('/calculate-rewards', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { feedbackIds } = req.body;

    if (!Array.isArray(feedbackIds) || feedbackIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'feedbackIds must be a non-empty array'
      });
    }

    const result = await rewardCalculator.calculateRewardsForFeedback(feedbackIds);

    res.json({
      success: true,
      calculatedCount: result.calculatedCount,
      totalRewardAmountSek: result.totalRewardAmountSek,
      results: result.results
    });
  } catch (error: any) {
    console.error('Calculate rewards error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate rewards'
    });
  }
});

router.post('/process-batch', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { weekPeriod } = req.body;

    if (!weekPeriod || !/^\d{4}-W\d{2}$/.test(weekPeriod)) {
      return res.status(400).json({
        success: false,
        error: 'weekPeriod must be in ISO week format (e.g., 2025-W39)'
      });
    }

    const existingBatch = await batchQueries.findByWeek(weekPeriod);
    if (existingBatch && existingBatch.status === 'processing') {
      return res.status(409).json({
        success: false,
        error: 'Batch is already being processed'
      });
    }

    setTimeout(async () => {
      try {
        await batchScheduler.processBatch(weekPeriod);
      } catch (error) {
        console.error('Batch processing error:', error);
      }
    }, 100);

    res.status(202).json({
      success: true,
      batchId: existingBatch?.id || 'pending',
      weekPeriod,
      status: 'processing',
      estimatedCompletionMinutes: 10
    });
  } catch (error: any) {
    console.error('Process batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process batch'
    });
  }
});

router.get('/batch/:batchId', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { batchId } = req.params;

    const batch = await batchQueries.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    res.json({
      success: true,
      batch: {
        id: batch.id,
        batchWeek: batch.batch_week,
        status: batch.status,
        progress: {
          totalCustomers: batch.total_customers,
          totalTransactions: batch.total_transactions,
          successfulPayments: batch.successful_payments,
          failedPayments: batch.failed_payments
        },
        totalAmountSek: batch.total_amount_sek / 100,
        startedAt: batch.started_at,
        completedAt: batch.completed_at
      }
    });
  } catch (error: any) {
    console.error('Get batch status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get batch status'
    });
  }
});

router.get('/reconciliation/:batchId', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { batchId } = req.params;

    const report = await reconciliation.generateReport(batchId);
    const storeBreakdown = await reconciliation.reportQueries.generateStoreBreakdown(batchId);

    res.json({
      success: true,
      report: {
        id: report.id,
        batchId: report.batch_id,
        reportPeriod: report.report_period,
        summary: {
          totalRewardsPaidSek: report.total_rewards_paid_sek / 100,
          adminFeesCollectedSek: report.admin_fees_collected_sek / 100,
          paymentSuccessCount: report.payment_success_count,
          paymentFailureCount: report.payment_failure_count,
          paymentSuccessRate: report.payment_success_rate,
          discrepancyCount: report.discrepancy_count,
          discrepancyAmountSek: report.discrepancy_amount_sek / 100
        },
        storeBreakdown: storeBreakdown.map(store => ({
          storeId: store.storeId,
          storeName: store.storeName,
          businessId: store.businessId,
          businessName: store.businessName,
          feedbackCount: store.feedbackCount,
          verifiedCount: store.verifiedCount,
          avgQualityScore: store.avgQualityScore,
          totalRewardsSek: store.totalRewardsSek / 100
        })),
        generatedAt: report.generated_at
      }
    });
  } catch (error: any) {
    console.error('Get reconciliation error:', error);
    
    if (error.message === 'Batch not found') {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate reconciliation report'
    });
  }
});

router.get('/failed', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending';
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const { failures, total } = await failureQueries.findByStatus(status, limit, offset);

    res.json({
      success: true,
      payments: failures.map(f => ({
        id: f.id,
        transactionId: f.payment_transaction_id,
        attemptNumber: f.attempt_number,
        failureReason: f.failure_reason,
        swishErrorCode: f.swish_error_code,
        resolutionStatus: f.resolution_status,
        retryScheduledAt: f.retry_scheduled_at,
        createdAt: f.created_at
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error('Get failed payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get failed payments'
    });
  }
});

router.post('/retry/:transactionId', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { updatedPhone } = req.body;

    const transaction = await transactionQueries.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    if (transaction.status === 'successful') {
      return res.status(409).json({
        success: false,
        error: 'Transaction already successful'
      });
    }

    const result = await paymentProcessor.retryFailedPayment(transactionId, updatedPhone);

    res.json({
      success: true,
      transaction: {
        id: result.id,
        customerPhone: result.customer_phone,
        amountSek: result.amount_sek / 100,
        status: result.status,
        retryCount: result.retry_count,
        processedAt: result.processed_at
      },
      updatedPhone: updatedPhone || undefined
    });
  } catch (error: any) {
    console.error('Retry payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry payment'
    });
  }
});

router.get('/customer/:phone', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const [transactions, rewards] = await Promise.all([
      transactionQueries.findByCustomerPhone(phone),
      rewardQueries.findByCustomerPhone(phone)
    ]);

    const totalPaidOre = transactions
      .filter(t => t.status === 'successful')
      .reduce((sum, t) => sum + t.amount_sek, 0);

    const totalPendingOre = rewards
      .filter(r => r.verified_by_business && !r.payment_transaction_id)
      .reduce((sum, r) => sum + r.reward_amount_sek, 0);

    res.json({
      success: true,
      customerPhone: phone,
      summary: {
        totalPaidSek: totalPaidOre / 100,
        totalPendingSek: totalPendingOre / 100,
        transactionCount: transactions.length,
        successfulPayments: transactions.filter(t => t.status === 'successful').length,
        failedPayments: transactions.filter(t => t.status === 'failed').length
      },
      transactions: transactions.map(t => ({
        id: t.id,
        amountSek: t.amount_sek / 100,
        status: t.status,
        batchId: t.batch_id,
        createdAt: t.created_at,
        processedAt: t.processed_at
      })),
      rewards: rewards.map(r => ({
        id: r.id,
        feedbackId: r.feedback_id,
        storeId: r.store_id,
        qualityScore: r.quality_score,
        rewardAmountSek: r.reward_amount_sek / 100,
        verifiedByBusiness: r.verified_by_business,
        paymentTransactionId: r.payment_transaction_id,
        createdAt: r.created_at
      }))
    });
  } catch (error: any) {
    console.error('Get customer history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get customer history'
    });
  }
});

// GET /api/admin/payments/stats - Get payment statistics for dashboard
router.get('/stats', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    // Get current ISO week
    const now = new Date();
    const year = now.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (firstDayOfYear.getDay() + 6) % 7;
    const firstMonday = new Date(year, 0, 1 + (daysOffset > 0 ? 7 - daysOffset : 0));
    const daysSinceFirstMonday = Math.floor((now.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.floor(daysSinceFirstMonday / 7) + 1;
    const currentWeek = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

    // Get batch for current week
    const currentBatch = await batchQueries.findByWeek(currentWeek);
    
    let stats = {
      totalPaymentsThisWeek: 0,
      successRatePercent: 0,
      totalAmountPaidSek: 0,
      failedPaymentsCount: 0
    };

    if (currentBatch) {
      const transactions = await transactionQueries.findByBatchId(currentBatch.id);
      const successfulTransactions = transactions.filter(t => t.status === 'successful');
      const failedTransactions = transactions.filter(t => t.status === 'failed');

      stats = {
        totalPaymentsThisWeek: transactions.length,
        successRatePercent: transactions.length > 0 
          ? (successfulTransactions.length / transactions.length) * 100
          : 0,
        totalAmountPaidSek: successfulTransactions.reduce((sum, t) => sum + (t.amount_sek / 100), 0),
        failedPaymentsCount: failedTransactions.length
      };
    }

    res.json(stats);
  } catch (error: any) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get payment statistics'
    });
  }
});

// GET /api/admin/payments/batch/latest - Get latest batch ID
router.get('/batch/latest', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    // Get most recent batch
    const { data: latestBatch } = await supabase
      .from('payment_batches')
      .select('id, batch_week, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestBatch) {
      return res.status(404).json({
        success: false,
        error: 'No batches found'
      });
    }

    res.json({
      success: true,
      batchId: latestBatch.id,
      batchWeek: latestBatch.batch_week,
      status: latestBatch.status
    });
  } catch (error: any) {
    console.error('Get latest batch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get latest batch'
    });
  }
});

export default router;