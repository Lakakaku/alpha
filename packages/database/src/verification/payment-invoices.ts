import { SupabaseClientManager } from '../client/supabase';
import type { PaymentInvoice, PaymentStatus, SwishStatus } from '@vocilia/types/verification';

export class PaymentInvoiceModel {
  private static getSupabaseClient() {
    return SupabaseClientManager.getInstance().getClient();
  }
  /**
   * Create a new payment invoice
   */
  static async create(data: {
    weekly_verification_cycle_id: string;
    business_id: string;
    phone_number: string;
    total_amount: number;
    transaction_count: number;
    due_date: string;
    payment_details: Record<string, any>;
  }): Promise<PaymentInvoice> {
    const { data: invoice, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .insert({
        weekly_verification_cycle_id: data.weekly_verification_cycle_id,
        business_id: data.business_id,
        phone_number: data.phone_number,
        total_amount: data.total_amount,
        transaction_count: data.transaction_count,
        due_date: data.due_date,
        payment_details: data.payment_details,
        payment_status: 'pending',
        swish_status: 'not_initiated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment invoice: ${error.message}`);
    }

    return invoice;
  }

  /**
   * Get payment invoices by cycle ID
   */
  static async getByCycleId(
    cycleId: string,
    options: {
      payment_status?: PaymentStatus;
      swish_status?: SwishStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaymentInvoice[]> {
    let query = supabase
      .from('payment_invoices')
      .select('*')
      .eq('weekly_verification_cycle_id', cycleId)
      .order('created_at', { ascending: false });

    if (options.payment_status) {
      query = query.eq('payment_status', options.payment_status);
    }

    if (options.swish_status) {
      query = query.eq('swish_status', options.swish_status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Failed to get payment invoices: ${error.message}`);
    }

    return invoices || [];
  }

  /**
   * Get payment invoice by ID
   */
  static async getById(id: string): Promise<PaymentInvoice | null> {
    const { data: invoice, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Invoice not found
      }
      throw new Error(`Failed to get payment invoice: ${error.message}`);
    }

    return invoice;
  }

  /**
   * Get invoices by business ID
   */
  static async getByBusinessId(
    businessId: string,
    options: {
      payment_status?: PaymentStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaymentInvoice[]> {
    let query = supabase
      .from('payment_invoices')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (options.payment_status) {
      query = query.eq('payment_status', options.payment_status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Failed to get invoices by business: ${error.message}`);
    }

    return invoices || [];
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    paymentDetails?: Record<string, any>
  ): Promise<PaymentInvoice> {
    const updateData: any = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };

    if (paymentDetails) {
      updateData.payment_details = paymentDetails;
    }

    if (paymentStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: invoice, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    return invoice;
  }

  /**
   * Update Swish status
   */
  static async updateSwishStatus(
    id: string,
    swishStatus: SwishStatus,
    swishReference?: string
  ): Promise<PaymentInvoice> {
    const updateData: any = {
      swish_status: swishStatus,
      updated_at: new Date().toISOString()
    };

    if (swishReference) {
      updateData.swish_reference = swishReference;
    }

    if (swishStatus === 'completed') {
      updateData.paid_at = new Date().toISOString();
      updateData.payment_status = 'paid';
    } else if (swishStatus === 'failed' || swishStatus === 'cancelled') {
      updateData.payment_status = 'failed';
    }

    const { data: invoice, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update Swish status: ${error.message}`);
    }

    return invoice;
  }

  /**
   * Get overdue invoices
   */
  static async getOverdueInvoices(currentDate: Date): Promise<PaymentInvoice[]> {
    const { data: invoices, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .select('*')
      .eq('payment_status', 'pending')
      .lt('due_date', currentDate.toISOString())
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get overdue invoices: ${error.message}`);
    }

    return invoices || [];
  }

  /**
   * Get payment statistics for a cycle
   */
  static async getPaymentStatistics(cycleId: string): Promise<{
    total_invoices: number;
    total_amount: number;
    paid_invoices: number;
    paid_amount: number;
    pending_invoices: number;
    pending_amount: number;
    overdue_invoices: number;
    overdue_amount: number;
  }> {
    const { data: invoices, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .select('payment_status, total_amount, due_date')
      .eq('weekly_verification_cycle_id', cycleId);

    if (error) {
      throw new Error(`Failed to get payment statistics: ${error.message}`);
    }

    const now = new Date();
    const stats = {
      total_invoices: 0,
      total_amount: 0,
      paid_invoices: 0,
      paid_amount: 0,
      pending_invoices: 0,
      pending_amount: 0,
      overdue_invoices: 0,
      overdue_amount: 0
    };

    invoices?.forEach(invoice => {
      stats.total_invoices++;
      stats.total_amount += invoice.total_amount;

      if (invoice.payment_status === 'paid') {
        stats.paid_invoices++;
        stats.paid_amount += invoice.total_amount;
      } else if (invoice.payment_status === 'pending') {
        const dueDate = new Date(invoice.due_date);
        if (dueDate < now) {
          stats.overdue_invoices++;
          stats.overdue_amount += invoice.total_amount;
        } else {
          stats.pending_invoices++;
          stats.pending_amount += invoice.total_amount;
        }
      }
    });

    return stats;
  }

  /**
   * Bulk create payment invoices
   */
  static async bulkCreate(invoices: Array<{
    weekly_verification_cycle_id: string;
    business_id: string;
    phone_number: string;
    total_amount: number;
    transaction_count: number;
    due_date: string;
    payment_details: Record<string, any>;
  }>): Promise<PaymentInvoice[]> {
    const invoiceData = invoices.map(invoice => ({
      ...invoice,
      payment_status: 'pending' as PaymentStatus,
      swish_status: 'not_initiated' as SwishStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: createdInvoices, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .insert(invoiceData)
      .select();

    if (error) {
      throw new Error(`Failed to bulk create payment invoices: ${error.message}`);
    }

    return createdInvoices || [];
  }

  /**
   * Delete payment invoice
   */
  static async delete(id: string): Promise<void> {
    const { error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete payment invoice: ${error.message}`);
    }
  }

  /**
   * Get invoices by phone number
   */
  static async getByPhoneNumber(phoneNumber: string): Promise<PaymentInvoice[]> {
    const { data: invoices, error } = await this.getSupabaseClient()
      .from('payment_invoices')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get invoices by phone number: ${error.message}`);
    }

    return invoices || [];
  }
}