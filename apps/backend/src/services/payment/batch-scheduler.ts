import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentBatch, PaymentBatchInsert } from '@vocilia/types';
import { PaymentBatchQueries } from '@vocilia/database';
import { PaymentProcessorService } from './payment-processor';

export class BatchSchedulerService {
  private batchQueries: PaymentBatchQueries;

  constructor(
    private client: SupabaseClient,
    private paymentProcessor: PaymentProcessorService
  ) {
    this.batchQueries = new PaymentBatchQueries(client);
  }

  async processBatch(batchWeek: string, forceReprocess: boolean = false): Promise<PaymentBatch> {
    const existingBatch = await this.batchQueries.findByWeek(batchWeek);
    
    if (existingBatch && !forceReprocess) {
      if (existingBatch.status === 'processing') {
        throw new Error('Batch is already being processed');
      }
      if (existingBatch.status === 'completed') {
        throw new Error('Batch already completed. Use forceReprocess=true to rerun.');
      }
    }

    const lockKey = `batch-${batchWeek}-${Date.now()}`;
    const lockedBy = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || 'unknown';

    let batch: PaymentBatch;
    
    if (existingBatch) {
      batch = existingBatch;
    } else {
      const { weekStart, weekEnd } = this.getWeekDates(batchWeek);
      const batchData: PaymentBatchInsert = {
        batch_week: batchWeek,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        status: 'pending'
      };
      batch = await this.batchQueries.create(batchData);
    }

    const lockAcquired = await this.batchQueries.acquireJobLock(batch.id, lockKey, lockedBy);
    
    if (!lockAcquired) {
      throw new Error('Failed to acquire job lock. Another instance may be processing this batch.');
    }

    try {
      await this.batchQueries.update(batch.id, {
        status: 'processing',
        started_at: new Date().toISOString()
      });

      const customerRewards = await this.paymentProcessor.aggregateRewardsByCustomer(batchWeek);
      
      let successfulPayments = 0;
      let failedPayments = 0;
      let totalAmountOre = 0;

      for (const [customerPhone, amountOre] of customerRewards.entries()) {
        try {
          await this.paymentProcessor.processPayment(customerPhone, amountOre, batch.id);
          successfulPayments++;
          totalAmountOre += amountOre;
        } catch (error) {
          failedPayments++;
          console.error(`Payment failed for ${customerPhone}:`, error);
        }
      }

      const finalBatch = await this.batchQueries.update(batch.id, {
        status: failedPayments === 0 ? 'completed' : 'partial',
        total_customers: customerRewards.size,
        total_transactions: successfulPayments + failedPayments,
        total_amount_sek: totalAmountOre,
        successful_payments: successfulPayments,
        failed_payments: failedPayments,
        completed_at: new Date().toISOString()
      });

      await this.batchQueries.releaseJobLock(batch.id);
      
      return finalBatch;
    } catch (error) {
      await this.batchQueries.update(batch.id, {
        status: 'failed',
        completed_at: new Date().toISOString()
      });
      
      await this.batchQueries.releaseJobLock(batch.id);
      throw error;
    }
  }

  private getWeekDates(batchWeek: string): { weekStart: string; weekEnd: string } {
    const [year, week] = batchWeek.split('-W').map(Number);
    
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0]
    };
  }
}