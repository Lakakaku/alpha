import { createClient } from '@supabase/supabase-js';
import { PaymentProcessingService } from '../services/verification/paymentProcessingService';
import { NotificationService } from '../services/verification/notificationService';

interface PaymentProcessingJob {
  id: string;
  type: 'customer_rewards' | 'invoice_generation' | 'swish_processing';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

interface CustomerRewardBatch {
  id: string;
  cycle_id: string;
  phone_number: string;
  total_reward_amount: number;
  transaction_count: number;
  swish_payment_status: string;
}

interface PaymentInvoice {
  id: string;
  business_id: string;
  business_name: string;
  total_amount: number;
  status: string;
  due_date: string;
}

export class PaymentProcessingJobProcessor {
  private supabase;
  private paymentProcessingService: PaymentProcessingService;
  private notificationService: NotificationService;
  private runningJobs: Map<string, PaymentProcessingJob> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.paymentProcessingService = new PaymentProcessingService();
    this.notificationService = new NotificationService();
  }

  async processCustomerRewards(cycleId: string): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: PaymentProcessingJob = {
      id: jobId,
      type: 'customer_rewards',
      status: 'pending',
      metadata: { cycleId }
    };

    this.runningJobs.set(jobId, job);

    // Start processing in background
    this.processCustomerRewardsJob(jobId, cycleId).catch(error => {
      console.error(`Customer rewards job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  async processSwishPayments(): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: PaymentProcessingJob = {
      id: jobId,
      type: 'swish_processing',
      status: 'pending'
    };

    this.runningJobs.set(jobId, job);

    // Start processing in background
    this.processSwishPaymentsJob(jobId).catch(error => {
      console.error(`Swish payments job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  async generateInvoicesForCycle(cycleId: string): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: PaymentProcessingJob = {
      id: jobId,
      type: 'invoice_generation',
      status: 'pending',
      metadata: { cycleId }
    };

    this.runningJobs.set(jobId, job);

    // Start processing in background
    this.generateInvoicesJob(jobId, cycleId).catch(error => {
      console.error(`Invoice generation job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  private async processCustomerRewardsJob(jobId: string, cycleId: string): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running');
      console.log(`Starting customer rewards processing for cycle ${cycleId}`);

      // Get all customer reward batches for the cycle that are pending
      const rewardBatches = await this.getPendingCustomerRewards(cycleId);
      
      if (rewardBatches.length === 0) {
        console.log(`No pending customer rewards found for cycle ${cycleId}`);
        this.updateJobStatus(jobId, 'completed');
        return;
      }

      console.log(`Processing ${rewardBatches.length} customer reward batches`);

      let successCount = 0;
      let failureCount = 0;

      // Process each reward batch
      for (const batch of rewardBatches) {
        try {
          // Validate phone number format for Swish
          if (!this.isValidSwishNumber(batch.phone_number)) {
            await this.updateRewardBatchStatus(batch.id, 'invalid_number', 'Invalid phone number format for Swish');
            failureCount++;
            continue;
          }

          // Initiate Swish payment
          const swishPaymentId = await this.initiateSwishPayment(
            batch.phone_number,
            batch.total_reward_amount,
            `Vocilia rewards for ${batch.transaction_count} transactions`
          );

          // Update batch with Swish payment ID
          await this.updateRewardBatchStatus(batch.id, 'processing', undefined, swishPaymentId);
          successCount++;

          console.log(`Initiated Swish payment for ${batch.phone_number}: ${swishPaymentId}`);

        } catch (error) {
          console.error(`Failed to process reward batch ${batch.id}:`, error);
          await this.updateRewardBatchStatus(batch.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
          failureCount++;
        }
      }

      console.log(`Customer rewards processing completed: ${successCount} success, ${failureCount} failures`);
      this.updateJobStatus(jobId, 'completed', undefined, { successCount, failureCount });

    } catch (error) {
      console.error(`Customer rewards job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async processSwishPaymentsJob(jobId: string): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running');
      console.log('Starting Swish payment status updates...');

      // Get all processing Swish payments
      const processingPayments = await this.getProcessingSwishPayments();
      
      if (processingPayments.length === 0) {
        console.log('No processing Swish payments found');
        this.updateJobStatus(jobId, 'completed');
        return;
      }

      console.log(`Checking status of ${processingPayments.length} Swish payments`);

      let completedCount = 0;
      let failedCount = 0;

      // Check status of each payment
      for (const batch of processingPayments) {
        try {
          if (!batch.swish_payment_id) continue;

          const paymentStatus = await this.checkSwishPaymentStatus(batch.swish_payment_id);
          
          if (paymentStatus.status === 'PAID') {
            await this.updateRewardBatchStatus(batch.id, 'completed');
            completedCount++;
            console.log(`Swish payment completed for ${batch.phone_number}`);
          } else if (paymentStatus.status === 'ERROR' || paymentStatus.status === 'CANCELLED') {
            await this.updateRewardBatchStatus(batch.id, 'failed', paymentStatus.errorMessage);
            failedCount++;
            console.log(`Swish payment failed for ${batch.phone_number}: ${paymentStatus.errorMessage}`);
          }
          // If still CREATED or PROCESSING, leave as is

        } catch (error) {
          console.error(`Failed to check Swish payment status for batch ${batch.id}:`, error);
        }
      }

      console.log(`Swish payment status update completed: ${completedCount} completed, ${failedCount} failed`);
      this.updateJobStatus(jobId, 'completed', undefined, { completedCount, failedCount });

    } catch (error) {
      console.error(`Swish payments job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async generateInvoicesJob(jobId: string, cycleId: string): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running');
      console.log(`Starting invoice generation for cycle ${cycleId}`);

      // Use the payment processing service to generate invoices
      const result = await this.paymentProcessingService.generateInvoices(cycleId);

      console.log(`Invoice generation completed: ${result.invoicesCreated} invoices, total ${result.totalAmount}`);

      // Send notifications to businesses about new invoices
      await this.notifyBusinessesAboutInvoices(cycleId);

      this.updateJobStatus(jobId, 'completed', undefined, result);

    } catch (error) {
      console.error(`Invoice generation job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async getPendingCustomerRewards(cycleId: string): Promise<CustomerRewardBatch[]> {
    const { data, error } = await this.supabase
      .from('customer_reward_batches')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('swish_payment_status', 'pending');

    if (error) {
      throw new Error(`Failed to get pending customer rewards: ${error.message}`);
    }

    return data || [];
  }

  private async getProcessingSwishPayments(): Promise<CustomerRewardBatch[]> {
    const { data, error } = await this.supabase
      .from('customer_reward_batches')
      .select('*')
      .eq('swish_payment_status', 'processing')
      .not('swish_payment_id', 'is', null);

    if (error) {
      throw new Error(`Failed to get processing Swish payments: ${error.message}`);
    }

    return data || [];
  }

  private async updateRewardBatchStatus(
    batchId: string, 
    status: string, 
    failureReason?: string,
    swishPaymentId?: string
  ): Promise<void> {
    const updateData: any = { 
      swish_payment_status: status 
    };

    if (failureReason) {
      updateData.failure_reason = failureReason;
    }

    if (swishPaymentId) {
      updateData.swish_payment_id = swishPaymentId;
    }

    if (status === 'completed') {
      updateData.paid_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('customer_reward_batches')
      .update(updateData)
      .eq('id', batchId);

    if (error) {
      throw new Error(`Failed to update reward batch status: ${error.message}`);
    }
  }

  private async notifyBusinessesAboutInvoices(cycleId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('payment_invoices')
      .select(`
        id,
        business_id,
        total_amount,
        due_date,
        businesses:business_id(name, contact_email)
      `)
      .eq('cycle_id', cycleId)
      .eq('status', 'pending');

    if (error) {
      console.error('Failed to get invoices for notifications:', error);
      return;
    }

    for (const invoice of data || []) {
      try {
        await this.notificationService.sendInvoiceNotification(
          invoice.businesses?.contact_email || '',
          invoice.businesses?.name || '',
          invoice.total_amount,
          invoice.due_date,
          invoice.id
        );
      } catch (error) {
        console.error(`Failed to send invoice notification for ${invoice.id}:`, error);
      }
    }
  }

  private isValidSwishNumber(phoneNumber: string): boolean {
    // Swedish phone number validation for Swish
    // Should be in format +46XXXXXXXXX or 07XXXXXXXX
    const swishPattern = /^(\+46|0)7[0-9]{8}$/;
    return swishPattern.test(phoneNumber.replace(/\s/g, ''));
  }

  private async initiateSwishPayment(phoneNumber: string, amount: number, message: string): Promise<string> {
    // Mock Swish API integration - replace with actual Swish API calls
    console.log(`Initiating Swish payment: ${phoneNumber}, ${amount} SEK, "${message}"`);
    
    // For now, return a mock payment ID
    const mockPaymentId = `SW${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // In real implementation, you would call Swish API here:
    // const response = await swishApi.createPayment({
    //   payeePaymentReference: mockPaymentId,
    //   payerAlias: phoneNumber,
    //   amount: amount.toString(),
    //   currency: 'SEK',
    //   message: message
    // });
    
    return mockPaymentId;
  }

  private async checkSwishPaymentStatus(swishPaymentId: string): Promise<{
    status: 'CREATED' | 'PROCESSING' | 'PAID' | 'ERROR' | 'CANCELLED';
    errorMessage?: string;
  }> {
    // Mock Swish API status check - replace with actual Swish API calls
    console.log(`Checking Swish payment status: ${swishPaymentId}`);
    
    // For now, randomly determine status for testing
    const statuses = ['CREATED', 'PROCESSING', 'PAID', 'ERROR'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)] as any;
    
    // In real implementation, you would call Swish API here:
    // const response = await swishApi.getPaymentStatus(swishPaymentId);
    
    return {
      status: randomStatus,
      errorMessage: randomStatus === 'ERROR' ? 'Mock error for testing' : undefined
    };
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateJobStatus(
    jobId: string, 
    status: PaymentProcessingJob['status'], 
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const job = this.runningJobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.error = error;
    
    if (metadata) {
      job.metadata = { ...job.metadata, ...metadata };
    }

    if (status === 'running' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    this.runningJobs.set(jobId, job);
  }

  getJobStatus(jobId: string): PaymentProcessingJob | null {
    return this.runningJobs.get(jobId) || null;
  }

  // Scheduled job entry points
  async runDailySwishProcessing(): Promise<void> {
    console.log('Starting daily Swish payment processing...');
    await this.processSwishPayments();
    console.log('Daily Swish payment processing completed');
  }

  async runWeeklyInvoiceGeneration(): Promise<void> {
    console.log('Starting weekly invoice generation...');
    
    // Get cycles that are ready for invoicing
    const { data: cycles, error } = await this.supabase
      .from('weekly_verification_cycles')
      .select('id')
      .eq('status', 'processing');

    if (error) {
      console.error('Failed to get cycles for invoice generation:', error);
      return;
    }

    for (const cycle of cycles || []) {
      try {
        await this.generateInvoicesForCycle(cycle.id);
      } catch (error) {
        console.error(`Failed to generate invoices for cycle ${cycle.id}:`, error);
      }
    }

    console.log('Weekly invoice generation completed');
  }

  // Cleanup completed jobs
  cleanupCompletedJobs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    for (const [jobId, job] of this.runningJobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && 
          job.completedAt < cutoffTime) {
        this.runningJobs.delete(jobId);
      }
    }
  }
}

// Export singleton instance
export const paymentProcessingProcessor = new PaymentProcessingJobProcessor();