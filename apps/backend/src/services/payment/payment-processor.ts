import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentTransaction, PaymentTransactionInsert, PaymentFailureInsert } from '@vocilia/types';
import { PaymentTransactionQueries, PaymentFailureQueries, RewardCalculationQueries } from '@vocilia/database';
import { ISwishClient, SwishError } from './swish-client';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 60000,
  backoffMultiplier: 2
};

export class PaymentProcessorService {
  private transactionQueries: PaymentTransactionQueries;
  private failureQueries: PaymentFailureQueries;
  private rewardQueries: RewardCalculationQueries;
  private retryConfig: RetryConfig;

  constructor(
    private client: SupabaseClient,
    private swishClient: ISwishClient,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.transactionQueries = new PaymentTransactionQueries(client);
    this.failureQueries = new PaymentFailureQueries(client);
    this.rewardQueries = new RewardCalculationQueries(client);
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  async aggregateRewardsByCustomer(batchWeek?: string): Promise<Map<string, number>> {
    const pendingRewards = await this.rewardQueries.findPendingRewards();
    
    const aggregated = new Map<string, number>();
    
    for (const reward of pendingRewards) {
      const existing = aggregated.get(reward.customer_phone) || 0;
      aggregated.set(reward.customer_phone, existing + reward.reward_amount_sek);
    }

    const filtered = new Map<string, number>();
    for (const [phone, totalOre] of aggregated.entries()) {
      if (totalOre >= 500) {
        filtered.set(phone, totalOre);
      }
    }

    return filtered;
  }

  async processPayment(
    customerPhone: string,
    amountOre: number,
    batchId: string
  ): Promise<PaymentTransaction> {
    const transactionData: PaymentTransactionInsert = {
      customer_phone: customerPhone,
      amount_sek: amountOre,
      status: 'pending',
      retry_count: 0,
      batch_id: batchId
    };

    const transaction = await this.transactionQueries.create(transactionData);

    try {
      const swishResponse = await this.swishClient.createPayment({
        amount: (amountOre / 100).toFixed(2),
        currency: 'SEK',
        payeeAlias: customerPhone,
        message: 'Vocilia feedback reward'
      });

      if (swishResponse.status === 'PAID') {
        const updated = await this.transactionQueries.update(transaction.id, {
          status: 'successful',
          swish_payment_reference: swishResponse.paymentReference,
          swish_transaction_id: swishResponse.swishTransactionId,
          processed_at: new Date().toISOString()
        });

        await this.linkRewardsToPayment(customerPhone, transaction.id);
        return updated;
      } else {
        await this.handlePaymentFailure(transaction, 1, swishResponse.errorCode || 'UNKNOWN', swishResponse.errorMessage);
        throw new Error(`Payment failed: ${swishResponse.errorMessage}`);
      }
    } catch (error) {
      if (error instanceof SwishError) {
        await this.handlePaymentFailure(transaction, 1, error.code, error.message);
      }
      throw error;
    }
  }

  async retryFailedPayment(
    transactionId: string,
    updatedPhone?: string
  ): Promise<PaymentTransaction> {
    const transaction = await this.transactionQueries.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === 'successful') {
      throw new Error('Transaction already successful');
    }

    if (transaction.retry_count >= this.retryConfig.maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    const phoneToUse = updatedPhone || transaction.customer_phone;
    const attemptNumber = transaction.retry_count + 1;

    if (updatedPhone) {
      await this.transactionQueries.update(transactionId, {
        customer_phone: updatedPhone
      });
    }

    try {
      const swishResponse = await this.swishClient.createPayment({
        amount: (transaction.amount_sek / 100).toFixed(2),
        currency: 'SEK',
        payeeAlias: phoneToUse,
        message: 'Vocilia feedback reward (retry)'
      });

      if (swishResponse.status === 'PAID') {
        const updated = await this.transactionQueries.update(transactionId, {
          status: 'successful',
          swish_payment_reference: swishResponse.paymentReference,
          swish_transaction_id: swishResponse.swishTransactionId,
          retry_count: attemptNumber,
          processed_at: new Date().toISOString()
        });

        await this.linkRewardsToPayment(phoneToUse, transactionId);
        return updated;
      } else {
        await this.handlePaymentFailure(transaction, attemptNumber + 1, swishResponse.errorCode || 'UNKNOWN', swishResponse.errorMessage);
        
        const updated = await this.transactionQueries.update(transactionId, {
          status: 'failed',
          retry_count: attemptNumber
        });
        
        return updated;
      }
    } catch (error) {
      if (error instanceof SwishError) {
        await this.handlePaymentFailure(transaction, attemptNumber + 1, error.code, error.message);
      }
      
      const updated = await this.transactionQueries.update(transactionId, {
        status: 'failed',
        retry_count: attemptNumber
      });
      
      throw error;
    }
  }

  private async handlePaymentFailure(
    transaction: PaymentTransaction,
    attemptNumber: number,
    errorCode: string,
    errorMessage?: string
  ): Promise<void> {
    const retryScheduledAt = this.calculateNextRetryTime(attemptNumber);
    const resolutionStatus = attemptNumber > this.retryConfig.maxRetries ? 'manual_review' : 'retrying';

    const failureData: PaymentFailureInsert = {
      payment_transaction_id: transaction.id,
      attempt_number: attemptNumber,
      failure_reason: errorMessage || 'Payment failed',
      swish_error_code: errorCode,
      swish_error_message: errorMessage,
      retry_scheduled_at: resolutionStatus === 'retrying' ? retryScheduledAt : undefined,
      resolution_status: resolutionStatus
    };

    await this.failureQueries.create(failureData);
  }

  private calculateNextRetryTime(attemptNumber: number): string {
    const delayMs = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attemptNumber - 1);
    return new Date(Date.now() + delayMs).toISOString();
  }

  private async linkRewardsToPayment(customerPhone: string, paymentTransactionId: string): Promise<void> {
    const rewards = await this.rewardQueries.findByCustomerPhone(customerPhone);
    const pendingRewards = rewards.filter(r => r.verified_by_business && !r.payment_transaction_id);

    for (const reward of pendingRewards) {
      await this.rewardQueries.updatePaymentTransactionId(reward.feedback_id, paymentTransactionId);
    }
  }
}