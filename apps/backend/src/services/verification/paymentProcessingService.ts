import { 
  PaymentInvoiceModel, 
  VerificationDatabaseModel, 
  VerificationRecordModel,
  WeeklyVerificationCycleModel 
} from '@vocilia/database';
import type { 
  PaymentInvoice, 
  PaymentStatus, 
  SwishStatus, 
  VerificationRecord 
} from '@vocilia/types/verification';

export interface SwishPaymentRequest {
  amount: number;
  currency: string;
  message: string;
  payeePaymentReference: string;
  callbackUrl?: string;
}

export interface SwishPaymentResponse {
  id: string;
  location: string;
  status: SwishStatus;
  paymentReference?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentSummary {
  invoice_id: string;
  business_id: string;
  phone_number: string;
  total_amount: number;
  transaction_count: number;
  verification_records: VerificationRecord[];
}

export class PaymentProcessingService {
  private readonly swishApiUrl: string;
  private readonly swishCertPath: string;
  private readonly merchantId: string;

  constructor() {
    this.swishApiUrl = process.env.SWISH_API_URL || 'https://mss.cpc.getswish.net/swish-cpcapi/api/v1';
    this.swishCertPath = process.env.SWISH_CERT_PATH || '';
    this.merchantId = process.env.SWISH_MERCHANT_ID || '';
  }

  /**
   * Generate payment invoices for a verification cycle
   */
  async generateInvoices(cycleId: string): Promise<{
    success: boolean;
    invoices: PaymentInvoice[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const invoices: PaymentInvoice[] = [];

    try {
      // Get the verification cycle
      const cycle = await WeeklyVerificationCycleModel.getById(cycleId);
      if (!cycle) {
        throw new Error('Verification cycle not found');
      }

      if (cycle.status !== 'verification_complete') {
        throw new Error('Cycle must have completed verification to generate invoices');
      }

      // Get all databases for the cycle
      const databases = await VerificationDatabaseModel.getByCycleId(cycleId);
      
      // Group verified records by business and phone number
      const paymentGroups = await this.groupVerifiedRecordsByPayment(databases);

      // Generate invoices for each payment group
      for (const group of paymentGroups) {
        try {
          const invoice = await this.createPaymentInvoice(cycleId, group);
          invoices.push(invoice);
        } catch (error) {
          const errorMsg = `Failed to create invoice for business ${group.business_id}, phone ${group.phone_number}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      // Update cycle status if invoices were generated
      if (invoices.length > 0) {
        await WeeklyVerificationCycleModel.updateStatus(cycleId, 'invoices_generated');
      }

      return {
        success: errors.length === 0,
        invoices,
        errors
      };

    } catch (error) {
      const errorMsg = `Failed to generate invoices: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);

      return {
        success: false,
        invoices,
        errors
      };
    }
  }

  /**
   * Group verified records by business and phone number for payment
   */
  private async groupVerifiedRecordsByPayment(
    databases: any[]
  ): Promise<PaymentSummary[]> {
    const paymentGroups = new Map<string, PaymentSummary>();

    for (const database of databases) {
      const verifiedRecords = await VerificationRecordModel.getByDatabaseId(
        database.id,
        { status: 'verified' }
      );

      for (const record of verifiedRecords) {
        // Group by business_id + phone_number (duplicate phone numbers across stores are combined)
        const groupKey = `${database.business_id}:${record.phone_number}`;
        
        if (!paymentGroups.has(groupKey)) {
          paymentGroups.set(groupKey, {
            invoice_id: '', // Will be set when invoice is created
            business_id: database.business_id,
            phone_number: record.phone_number,
            total_amount: 0,
            transaction_count: 0,
            verification_records: []
          });
        }

        const group = paymentGroups.get(groupKey)!;
        group.total_amount += record.amount;
        group.transaction_count += 1;
        group.verification_records.push(record);
      }
    }

    return Array.from(paymentGroups.values());
  }

  /**
   * Create a payment invoice for a group of verified transactions
   */
  private async createPaymentInvoice(
    cycleId: string,
    summary: PaymentSummary
  ): Promise<PaymentInvoice> {
    // Calculate due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const paymentDetails = {
      verification_records: summary.verification_records.map(record => ({
        record_id: record.id,
        amount: record.amount,
        transaction_date: record.transaction_date
      })),
      reward_percentage: 2.0, // 2% reward rate
      processing_fee: this.calculateProcessingFee(summary.total_amount),
      net_amount: this.calculateNetAmount(summary.total_amount)
    };

    return await PaymentInvoiceModel.create({
      weekly_verification_cycle_id: cycleId,
      business_id: summary.business_id,
      phone_number: summary.phone_number,
      total_amount: paymentDetails.net_amount,
      transaction_count: summary.transaction_count,
      due_date: dueDate.toISOString(),
      payment_details: paymentDetails
    });
  }

  /**
   * Calculate processing fee (1% of total amount, minimum 5 SEK)
   */
  private calculateProcessingFee(totalAmount: number): number {
    const fee = Math.max(totalAmount * 0.01, 5);
    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate net amount after processing fee
   */
  private calculateNetAmount(totalAmount: number): number {
    const processingFee = this.calculateProcessingFee(totalAmount);
    return Math.round((totalAmount - processingFee) * 100) / 100;
  }

  /**
   * Initiate Swish payment for an invoice
   */
  async initiateSwishPayment(invoiceId: string): Promise<{
    success: boolean;
    swishReference?: string;
    error?: string;
  }> {
    try {
      const invoice = await PaymentInvoiceModel.getById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      if (invoice.payment_status !== 'pending') {
        return {
          success: false,
          error: 'Invoice is not in pending status'
        };
      }

      // Prepare Swish payment request
      const swishRequest: SwishPaymentRequest = {
        amount: invoice.total_amount,
        currency: 'SEK',
        message: `Vocilia verification reward - Invoice ${invoice.id.substring(0, 8)}`,
        payeePaymentReference: `VER-${invoice.id.substring(0, 8)}`,
        callbackUrl: `${process.env.API_BASE_URL}/api/webhooks/swish/payment/${invoice.id}`
      };

      // Call Swish API
      const swishResponse = await this.callSwishApi(swishRequest);

      if (swishResponse.status === 'initiated' || swishResponse.status === 'pending') {
        // Update invoice with Swish reference
        await PaymentInvoiceModel.updateSwishStatus(
          invoiceId,
          'initiated',
          swishResponse.id
        );

        return {
          success: true,
          swishReference: swishResponse.id
        };
      } else {
        await PaymentInvoiceModel.updateSwishStatus(invoiceId, 'failed');
        return {
          success: false,
          error: swishResponse.errorMessage || 'Swish payment initiation failed'
        };
      }

    } catch (error) {
      console.error('Swish payment initiation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle Swish payment callback
   */
  async handleSwishCallback(
    invoiceId: string,
    swishPaymentStatus: SwishStatus,
    swishReference: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const invoice = await PaymentInvoiceModel.getById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      // Update Swish status
      await PaymentInvoiceModel.updateSwishStatus(
        invoiceId,
        swishPaymentStatus,
        swishReference
      );

      // If payment completed, trigger reward processing
      if (swishPaymentStatus === 'completed') {
        await this.processCompletedPayment(invoice);
      }

      return { success: true };

    } catch (error) {
      console.error('Swish callback handling failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Callback handling failed'
      };
    }
  }

  /**
   * Process completed payment and trigger reward distribution
   */
  private async processCompletedPayment(invoice: PaymentInvoice): Promise<void> {
    try {
      // Here you would integrate with customer reward distribution system
      console.log(`Processing completed payment for invoice ${invoice.id}`);
      
      // Example: Create customer reward batch
      // const rewardBatch = await CustomerRewardBatchModel.create({
      //   weekly_verification_cycle_id: invoice.weekly_verification_cycle_id,
      //   business_id: invoice.business_id,
      //   total_customers: 1,
      //   total_reward_amount: invoice.total_amount,
      //   batch_data: {
      //     phone_number: invoice.phone_number,
      //     reward_amount: invoice.total_amount,
      //     invoice_id: invoice.id
      //   },
      //   export_formats: ['json']
      // });

      console.log(`Payment processing completed for invoice ${invoice.id}`);

    } catch (error) {
      console.error('Failed to process completed payment:', error);
      throw error;
    }
  }

  /**
   * Mock Swish API call (replace with actual Swish integration)
   */
  private async callSwishApi(request: SwishPaymentRequest): Promise<SwishPaymentResponse> {
    // This is a mock implementation
    // In production, you would make actual HTTPS calls to Swish API with certificates
    
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      // Mock successful response for development/testing
      return {
        id: `SWISH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        location: `${this.swishApiUrl}/payments/SWISH-${Date.now()}`,
        status: 'initiated' as SwishStatus,
        paymentReference: request.payeePaymentReference
      };
    }

    // Production implementation would look like:
    // const response = await fetch(`${this.swishApiUrl}/payments`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${await this.getSwishToken()}`
    //   },
    //   body: JSON.stringify(request),
    //   cert: fs.readFileSync(this.swishCertPath),
    //   key: fs.readFileSync(this.swishKeyPath)
    // });

    throw new Error('Swish API integration not implemented for production');
  }

  /**
   * Get payment statistics for a cycle
   */
  async getPaymentStatistics(cycleId: string): Promise<{
    total_invoices: number;
    total_amount: number;
    paid_invoices: number;
    paid_amount: number;
    pending_invoices: number;
    pending_amount: number;
    failed_invoices: number;
    failed_amount: number;
    swish_initiated: number;
    swish_completed: number;
  }> {
    const stats = await PaymentInvoiceModel.getPaymentStatistics(cycleId);
    
    // Get Swish-specific statistics
    const invoices = await PaymentInvoiceModel.getByCycleId(cycleId);
    const swishInitiated = invoices.filter(inv => inv.swish_status === 'initiated').length;
    const swishCompleted = invoices.filter(inv => inv.swish_status === 'completed').length;

    return {
      ...stats,
      failed_invoices: stats.total_invoices - stats.paid_invoices - stats.pending_invoices,
      failed_amount: stats.total_amount - stats.paid_amount - stats.pending_amount,
      swish_initiated: swishInitiated,
      swish_completed: swishCompleted
    };
  }

  /**
   * Retry failed payment
   */
  async retryPayment(invoiceId: string): Promise<{
    success: boolean;
    swishReference?: string;
    error?: string;
  }> {
    try {
      const invoice = await PaymentInvoiceModel.getById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      if (invoice.swish_status !== 'failed') {
        return {
          success: false,
          error: 'Can only retry failed payments'
        };
      }

      // Reset status and retry
      await PaymentInvoiceModel.updateSwishStatus(invoiceId, 'not_initiated');
      return await this.initiateSwishPayment(invoiceId);

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Retry failed'
      };
    }
  }

  /**
   * Process bulk payments for multiple invoices
   */
  async processBulkPayments(invoiceIds: string[]): Promise<{
    successful: string[];
    failed: Array<{
      invoiceId: string;
      error: string;
    }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ invoiceId: string; error: string; }> = [];

    for (const invoiceId of invoiceIds) {
      try {
        const result = await this.initiateSwishPayment(invoiceId);
        
        if (result.success) {
          successful.push(invoiceId);
        } else {
          failed.push({
            invoiceId,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        failed.push({
          invoiceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      successful,
      failed
    };
  }

  /**
   * Cancel pending payment
   */
  async cancelPayment(invoiceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const invoice = await PaymentInvoiceModel.getById(invoiceId);
      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      if (invoice.payment_status === 'paid') {
        return {
          success: false,
          error: 'Cannot cancel paid invoice'
        };
      }

      await PaymentInvoiceModel.updatePaymentStatus(invoiceId, 'cancelled');
      await PaymentInvoiceModel.updateSwishStatus(invoiceId, 'cancelled');

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed'
      };
    }
  }
}