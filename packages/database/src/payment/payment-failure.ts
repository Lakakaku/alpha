import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFailure, PaymentFailureInsert, PaymentFailureUpdate } from '@vocilia/types';

export class PaymentFailureQueries {
  constructor(private client: SupabaseClient) {}

  async create(data: PaymentFailureInsert): Promise<PaymentFailure> {
    const { data: failure, error } = await this.client
      .from('payment_failures')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return failure;
  }

  async findByPaymentTransactionId(paymentTransactionId: string): Promise<PaymentFailure[]> {
    const { data, error } = await this.client
      .from('payment_failures')
      .select('*')
      .eq('payment_transaction_id', paymentTransactionId)
      .order('attempt_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findPendingRetries(): Promise<PaymentFailure[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('payment_failures')
      .select('*')
      .eq('resolution_status', 'retrying')
      .lte('retry_scheduled_at', now)
      .order('retry_scheduled_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async findByStatus(status: string, limit: number = 100, offset: number = 0): Promise<{ failures: PaymentFailure[]; total: number }> {
    const { data, error, count } = await this.client
      .from('payment_failures')
      .select('*, payment_transactions:payment_transaction_id(*)', { count: 'exact' })
      .eq('resolution_status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { failures: data || [], total: count || 0 };
  }

  async update(id: string, data: PaymentFailureUpdate): Promise<PaymentFailure> {
    const { data: failure, error } = await this.client
      .from('payment_failures')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return failure;
  }
}