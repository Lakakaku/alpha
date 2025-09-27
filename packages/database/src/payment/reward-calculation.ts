import { SupabaseClient } from '@supabase/supabase-js';
import type { RewardCalculation, RewardCalculationInsert } from '@vocilia/types';

export class RewardCalculationQueries {
  constructor(private client: SupabaseClient) {}

  async create(data: RewardCalculationInsert): Promise<RewardCalculation> {
    const { data: reward, error } = await this.client
      .from('reward_calculations')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return reward;
  }

  async createMany(data: RewardCalculationInsert[]): Promise<RewardCalculation[]> {
    const { data: rewards, error } = await this.client
      .from('reward_calculations')
      .insert(data)
      .select();

    if (error) throw error;
    return rewards || [];
  }

  async findByFeedbackId(feedbackId: string): Promise<RewardCalculation | null> {
    const { data, error } = await this.client
      .from('reward_calculations')
      .select('*')
      .eq('feedback_id', feedbackId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async findByCustomerPhone(customerPhone: string): Promise<RewardCalculation[]> {
    const { data, error } = await this.client
      .from('reward_calculations')
      .select('*')
      .eq('customer_phone', customerPhone)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findPendingRewards(): Promise<RewardCalculation[]> {
    const { data, error } = await this.client
      .from('reward_calculations')
      .select('*')
      .eq('verified_by_business', true)
      .is('payment_transaction_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async updatePaymentTransactionId(feedbackId: string, paymentTransactionId: string): Promise<void> {
    const { error } = await this.client
      .from('reward_calculations')
      .update({ payment_transaction_id: paymentTransactionId })
      .eq('feedback_id', feedbackId);

    if (error) throw error;
  }

  async aggregateByCustomer(customerPhone: string): Promise<number> {
    const { data, error } = await this.client
      .from('reward_calculations')
      .select('reward_amount_sek')
      .eq('customer_phone', customerPhone)
      .eq('verified_by_business', true)
      .is('payment_transaction_id', null);

    if (error) throw error;
    
    const total = data?.reduce((sum, row) => sum + row.reward_amount_sek, 0) || 0;
    return total;
  }
}