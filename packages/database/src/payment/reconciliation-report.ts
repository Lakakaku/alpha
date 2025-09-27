import { SupabaseClient } from '@supabase/supabase-js';
import type { ReconciliationReport, ReconciliationReportInsert, StoreBreakdown } from '@vocilia/types';

export class ReconciliationReportQueries {
  constructor(private client: SupabaseClient) {}

  async create(data: ReconciliationReportInsert): Promise<ReconciliationReport> {
    const { data: report, error } = await this.client
      .from('reconciliation_reports')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return report;
  }

  async findByBatchId(batchId: string): Promise<ReconciliationReport | null> {
    const { data, error } = await this.client
      .from('reconciliation_reports')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async findByReportPeriod(reportPeriod: string): Promise<ReconciliationReport | null> {
    const { data, error } = await this.client
      .from('reconciliation_reports')
      .select('*')
      .eq('report_period', reportPeriod)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async generateStoreBreakdown(batchId: string): Promise<StoreBreakdown[]> {
    const { data, error } = await this.client
      .rpc('generate_store_breakdown', { batch_id: batchId });

    if (error) throw error;
    return data || [];
  }

  async calculateDiscrepancies(batchId: string): Promise<{ count: number; amountSek: number }> {
    const { data, error } = await this.client
      .rpc('calculate_batch_discrepancies', { batch_id: batchId });

    if (error) throw error;
    return data || { count: 0, amountSek: 0 };
  }
}