import { SupabaseClient } from '@supabase/supabase-js';
import type { ReconciliationReport, ReconciliationReportInsert, BusinessInvoice, BusinessInvoiceInsert, StoreBreakdown } from '@vocilia/types';
import { ReconciliationReportQueries, BusinessInvoiceQueries, PaymentBatchQueries, PaymentTransactionQueries } from '@vocilia/database';

export class ReconciliationService {
  private reportQueries: ReconciliationReportQueries;
  private invoiceQueries: BusinessInvoiceQueries;
  private batchQueries: PaymentBatchQueries;
  private transactionQueries: PaymentTransactionQueries;

  constructor(private client: SupabaseClient) {
    this.reportQueries = new ReconciliationReportQueries(client);
    this.invoiceQueries = new BusinessInvoiceQueries(client);
    this.batchQueries = new PaymentBatchQueries(client);
    this.transactionQueries = new PaymentTransactionQueries(client);
  }

  async generateReport(batchId: string): Promise<ReconciliationReport> {
    const existingReport = await this.reportQueries.findByBatchId(batchId);
    if (existingReport) {
      return existingReport;
    }

    const batch = await this.batchQueries.findById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    const transactions = await this.transactionQueries.findByBatchId(batchId);
    
    const successfulTransactions = transactions.filter(t => t.status === 'successful');
    const failedTransactions = transactions.filter(t => t.status === 'failed');
    
    const totalRewardsOre = successfulTransactions.reduce((sum, t) => sum + t.amount_sek, 0);
    const adminFeesOre = Math.round(totalRewardsOre * 0.20);
    
    const successRate = transactions.length > 0 
      ? Number(((successfulTransactions.length / transactions.length) * 100).toFixed(2))
      : 0;

    const discrepancies = await this.reportQueries.calculateDiscrepancies(batchId);

    const reportData: ReconciliationReportInsert = {
      batch_id: batchId,
      report_period: batch.batch_week,
      total_rewards_paid_sek: totalRewardsOre,
      admin_fees_collected_sek: adminFeesOre,
      payment_success_count: successfulTransactions.length,
      payment_failure_count: failedTransactions.length,
      payment_success_rate: successRate,
      discrepancy_count: discrepancies.count,
      discrepancy_amount_sek: discrepancies.amountSek,
      business_invoice_total_sek: totalRewardsOre + adminFeesOre
    };

    const report = await this.reportQueries.create(reportData);
    return report;
  }

  async generateBusinessInvoices(batchId: string): Promise<BusinessInvoice[]> {
    const batch = await this.batchQueries.findById(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    const { data: rewardsByBusiness } = await this.client
      .from('reward_calculations')
      .select(`
        store_id,
        reward_amount_sek,
        verified_by_business,
        stores!inner(business_id, name),
        businesses!inner(id, name)
      `)
      .not('payment_transaction_id', 'is', null);

    if (!rewardsByBusiness) {
      return [];
    }

    const businessMap = new Map<string, {
      businessId: string;
      storeIds: Set<string>;
      totalFeedbackCount: number;
      verifiedFeedbackCount: number;
      totalRewardOre: number;
    }>();

    for (const reward of rewardsByBusiness) {
      const businessId = (reward.stores as any).business_id;
      
      if (!businessMap.has(businessId)) {
        businessMap.set(businessId, {
          businessId,
          storeIds: new Set(),
          totalFeedbackCount: 0,
          verifiedFeedbackCount: 0,
          totalRewardOre: 0
        });
      }

      const businessData = businessMap.get(businessId)!;
      businessData.storeIds.add(reward.store_id);
      businessData.totalFeedbackCount++;
      if (reward.verified_by_business) {
        businessData.verifiedFeedbackCount++;
        businessData.totalRewardOre += reward.reward_amount_sek;
      }
    }

    const invoices: BusinessInvoiceInsert[] = [];
    const paymentDueDate = new Date();
    paymentDueDate.setDate(paymentDueDate.getDate() + 14);

    for (const [businessId, data] of businessMap.entries()) {
      const adminFeeOre = Math.round(data.totalRewardOre * 0.20);
      const totalInvoiceOre = data.totalRewardOre + adminFeeOre;

      invoices.push({
        business_id: businessId,
        batch_id: batchId,
        invoice_period: batch.batch_week,
        store_count: data.storeIds.size,
        total_feedback_count: data.totalFeedbackCount,
        verified_feedback_count: data.verifiedFeedbackCount,
        total_reward_amount_sek: data.totalRewardOre,
        admin_fee_sek: adminFeeOre,
        total_invoice_amount_sek: totalInvoiceOre,
        payment_due_date: paymentDueDate.toISOString().split('T')[0],
        payment_status: 'pending'
      });
    }

    if (invoices.length > 0) {
      return await this.invoiceQueries.createMany(invoices);
    }

    return [];
  }
}