import { SupabaseClientManager } from '../client/supabase';
import type { CustomerRewardBatch } from '@vocilia/types/verification';

export class CustomerRewardBatchModel {
  private static getSupabaseClient() {
    return SupabaseClientManager.getInstance().getClient();
  }
  /**
   * Create a new customer reward batch
   */
  static async create(data: {
    weekly_verification_cycle_id: string;
    business_id: string;
    total_customers: number;
    total_reward_amount: number;
    batch_data: Record<string, any>;
    export_formats: string[];
  }): Promise<CustomerRewardBatch> {
    const { data: batch, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .insert({
        weekly_verification_cycle_id: data.weekly_verification_cycle_id,
        business_id: data.business_id,
        total_customers: data.total_customers,
        total_reward_amount: data.total_reward_amount,
        batch_data: data.batch_data,
        export_formats: data.export_formats,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create customer reward batch: ${error.message}`);
    }

    return batch;
  }

  /**
   * Get customer reward batches by cycle ID
   */
  static async getByCycleId(
    cycleId: string,
    options: {
      status?: 'pending' | 'generated' | 'delivered' | 'failed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CustomerRewardBatch[]> {
    let query = supabase
      .from('customer_reward_batches')
      .select('*')
      .eq('weekly_verification_cycle_id', cycleId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    const { data: batches, error } = await query;

    if (error) {
      throw new Error(`Failed to get customer reward batches: ${error.message}`);
    }

    return batches || [];
  }

  /**
   * Get customer reward batch by ID
   */
  static async getById(id: string): Promise<CustomerRewardBatch | null> {
    const { data: batch, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Batch not found
      }
      throw new Error(`Failed to get customer reward batch: ${error.message}`);
    }

    return batch;
  }

  /**
   * Get batches by business ID
   */
  static async getByBusinessId(
    businessId: string,
    options: {
      status?: 'pending' | 'generated' | 'delivered' | 'failed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CustomerRewardBatch[]> {
    let query = supabase
      .from('customer_reward_batches')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    const { data: batches, error } = await query;

    if (error) {
      throw new Error(`Failed to get batches by business: ${error.message}`);
    }

    return batches || [];
  }

  /**
   * Update batch status
   */
  static async updateStatus(
    id: string,
    status: 'pending' | 'generated' | 'delivered' | 'failed',
    deliveryDetails?: Record<string, any>
  ): Promise<CustomerRewardBatch> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (deliveryDetails) {
      updateData.delivery_details = deliveryDetails;
    }

    if (status === 'generated') {
      updateData.generated_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data: batch, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update batch status: ${error.message}`);
    }

    return batch;
  }

  /**
   * Update batch export files
   */
  static async updateExportFiles(
    id: string,
    exportFiles: Record<string, any>
  ): Promise<CustomerRewardBatch> {
    const { data: batch, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .update({
        export_files: exportFiles,
        status: 'generated',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update export files: ${error.message}`);
    }

    return batch;
  }

  /**
   * Get batch statistics for a cycle
   */
  static async getBatchStatistics(cycleId: string): Promise<{
    total_batches: number;
    total_customers: number;
    total_reward_amount: number;
    pending_batches: number;
    generated_batches: number;
    delivered_batches: number;
    failed_batches: number;
  }> {
    const { data: batches, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .select('status, total_customers, total_reward_amount')
      .eq('weekly_verification_cycle_id', cycleId);

    if (error) {
      throw new Error(`Failed to get batch statistics: ${error.message}`);
    }

    const stats = {
      total_batches: 0,
      total_customers: 0,
      total_reward_amount: 0,
      pending_batches: 0,
      generated_batches: 0,
      delivered_batches: 0,
      failed_batches: 0
    };

    batches?.forEach(batch => {
      stats.total_batches++;
      stats.total_customers += batch.total_customers;
      stats.total_reward_amount += batch.total_reward_amount;

      switch (batch.status) {
        case 'pending':
          stats.pending_batches++;
          break;
        case 'generated':
          stats.generated_batches++;
          break;
        case 'delivered':
          stats.delivered_batches++;
          break;
        case 'failed':
          stats.failed_batches++;
          break;
      }
    });

    return stats;
  }

  /**
   * Bulk create customer reward batches
   */
  static async bulkCreate(batches: Array<{
    weekly_verification_cycle_id: string;
    business_id: string;
    total_customers: number;
    total_reward_amount: number;
    batch_data: Record<string, any>;
    export_formats: string[];
  }>): Promise<CustomerRewardBatch[]> {
    const batchData = batches.map(batch => ({
      ...batch,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: createdBatches, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .insert(batchData)
      .select();

    if (error) {
      throw new Error(`Failed to bulk create customer reward batches: ${error.message}`);
    }

    return createdBatches || [];
  }

  /**
   * Get pending batches for processing
   */
  static async getPendingBatches(): Promise<CustomerRewardBatch[]> {
    const { data: batches, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending batches: ${error.message}`);
    }

    return batches || [];
  }

  /**
   * Get batches ready for delivery
   */
  static async getBatchesReadyForDelivery(): Promise<CustomerRewardBatch[]> {
    const { data: batches, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .select('*')
      .eq('status', 'generated')
      .order('generated_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get batches ready for delivery: ${error.message}`);
    }

    return batches || [];
  }

  /**
   * Delete customer reward batch
   */
  static async delete(id: string): Promise<void> {
    const { error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete customer reward batch: ${error.message}`);
    }
  }

  /**
   * Update delivery details
   */
  static async updateDeliveryDetails(
    id: string,
    deliveryDetails: Record<string, any>
  ): Promise<CustomerRewardBatch> {
    const { data: batch, error } = await this.getSupabaseClient()
      .from('customer_reward_batches')
      .update({
        delivery_details: deliveryDetails,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update delivery details: ${error.message}`);
    }

    return batch;
  }

  /**
   * Get batches by export format
   */
  static async getByExportFormat(
    format: string,
    options: {
      status?: 'pending' | 'generated' | 'delivered' | 'failed';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CustomerRewardBatch[]> {
    let query = supabase
      .from('customer_reward_batches')
      .select('*')
      .contains('export_formats', [format])
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
    }

    const { data: batches, error } = await query;

    if (error) {
      throw new Error(`Failed to get batches by export format: ${error.message}`);
    }

    return batches || [];
  }
}