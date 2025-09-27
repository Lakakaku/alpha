import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentTransaction, PaymentTransactionInsert, PaymentTransactionUpdate } from '@vocilia/types';

export class PaymentTransactionQueries {
  constructor(private client: SupabaseClient) {}

  async create(data: PaymentTransactionInsert): Promise<PaymentTransaction> {
    const { data: transaction, error } = await this.client
      .from('payment_transactions')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return transaction;
  }

  async findById(id: string): Promise<PaymentTransaction | null> {
    const { data, error } = await this.client
      .from('payment_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async findByBatchId(batchId: string): Promise<PaymentTransaction[]> {
    const { data, error } = await this.client
      .from('payment_transactions')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findByCustomerPhone(customerPhone: string): Promise<PaymentTransaction[]> {
    const { data, error } = await this.client
      .from('payment_transactions')
      .select('*')
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findByStatus(status: string): Promise<PaymentTransaction[]> {
    const { data, error } = await this.client
      .from('payment_transactions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async update(id: string, data: PaymentTransactionUpdate): Promise<PaymentTransaction> {
    const { data: transaction, error } = await this.client
      .from('payment_transactions')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transaction;
  }

  async aggregateByCustomerForBatch(batchWeek: string): Promise<Map<string, number>> {
    const { data, error } = await this.client
      .rpc('aggregate_pending_rewards_by_customer', { batch_week: batchWeek });

    if (error) throw error;
    
    const aggregated = new Map<string, number>();
    if (data) {
      data.forEach((row: any) => {
        aggregated.set(row.customer_phone, row.total_amount_sek);
      });
    }
    return aggregated;
  }
}