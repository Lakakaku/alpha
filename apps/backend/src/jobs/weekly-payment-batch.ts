import cron from 'node-cron';
import { BatchSchedulerService } from '../services/payment/batch-scheduler';
import { createClient } from '@supabase/supabase-js';
import { PaymentBatchQueries } from '@vocilia/database';
import { PaymentTransactionQueries } from '@vocilia/database';
import { RewardCalculationQueries } from '@vocilia/database';
import { PaymentProcessorService } from '../services/payment/payment-processor';
import { RewardCalculatorService } from '../services/payment/reward-calculator';
import { MockSwishClient } from '../services/payment/swish-client';
import { PaymentFailureQueries } from '@vocilia/database';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const batchQueries = new PaymentBatchQueries(supabase);
const transactionQueries = new PaymentTransactionQueries(supabase);
const rewardQueries = new RewardCalculationQueries(supabase);
const failureQueries = new PaymentFailureQueries(supabase);
const swishClient = new MockSwishClient();
const rewardCalculator = new RewardCalculatorService(rewardQueries);
const paymentProcessor = new PaymentProcessorService(
  transactionQueries,
  rewardQueries,
  failureQueries,
  swishClient
);
const batchScheduler = new BatchSchedulerService(
  batchQueries,
  paymentProcessor
);

function getPreviousWeekISO(): string {
  const now = new Date();
  const previousWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const year = previousWeekDate.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (firstDayOfYear.getDay() + 6) % 7;
  const firstMonday = new Date(year, 0, 1 + (daysOffset > 0 ? 7 - daysOffset : 0));
  
  const daysSinceFirstMonday = Math.floor(
    (previousWeekDate.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.floor(daysSinceFirstMonday / 7) + 1;
  
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

export function startWeeklyPaymentBatchJob(): cron.ScheduledTask {
  const task = cron.schedule(
    '0 0 * * 0',
    async () => {
      try {
        const batchWeek = getPreviousWeekISO();
        console.log(`[Weekly Payment Batch] Starting batch processing for week ${batchWeek}`);
        
        const batch = await batchScheduler.processBatch(batchWeek);
        
        console.log(`[Weekly Payment Batch] Batch ${batch.id} completed successfully`);
        console.log(`[Weekly Payment Batch] Status: ${batch.status}`);
        console.log(`[Weekly Payment Batch] Successful payments: ${batch.successful_payments}`);
        console.log(`[Weekly Payment Batch] Failed payments: ${batch.failed_payments}`);
        console.log(`[Weekly Payment Batch] Total amount: ${batch.total_amount_sek / 100} SEK`);
      } catch (error) {
        console.error('[Weekly Payment Batch] Error processing batch:', error);
        if (error instanceof Error) {
          console.error('[Weekly Payment Batch] Error message:', error.message);
          console.error('[Weekly Payment Batch] Stack trace:', error.stack);
        }
      }
    },
    {
      scheduled: true,
      timezone: 'Europe/Stockholm'
    }
  );

  console.log('[Weekly Payment Batch] Cron job scheduled for Sunday 00:00 Europe/Stockholm');
  return task;
}