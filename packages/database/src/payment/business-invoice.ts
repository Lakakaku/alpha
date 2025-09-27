import { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessInvoice, BusinessInvoiceInsert, BusinessInvoiceUpdate } from '@vocilia/types';

export class BusinessInvoiceQueries {
  constructor(private client: SupabaseClient) {}

  async create(data: BusinessInvoiceInsert): Promise<BusinessInvoice> {
    const { data: invoice, error } = await this.client
      .from('business_invoices')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return invoice;
  }

  async createMany(data: BusinessInvoiceInsert[]): Promise<BusinessInvoice[]> {
    const { data: invoices, error } = await this.client
      .from('business_invoices')
      .insert(data)
      .select();

    if (error) throw error;
    return invoices || [];
  }

  async findByBusinessId(businessId: string): Promise<BusinessInvoice[]> {
    const { data, error } = await this.client
      .from('business_invoices')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findByBatchId(batchId: string): Promise<BusinessInvoice[]> {
    const { data, error } = await this.client
      .from('business_invoices')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findByPaymentStatus(status: string, limit: number = 100, offset: number = 0): Promise<{ invoices: BusinessInvoice[]; total: number }> {
    const { data, error, count } = await this.client
      .from('business_invoices')
      .select('*, businesses:business_id(name, email)', { count: 'exact' })
      .eq('payment_status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { invoices: data || [], total: count || 0 };
  }

  async update(id: string, data: BusinessInvoiceUpdate): Promise<BusinessInvoice> {
    const { data: invoice, error } = await this.client
      .from('business_invoices')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return invoice;
  }
}