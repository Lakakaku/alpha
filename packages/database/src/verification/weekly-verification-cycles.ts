import { createClient } from '@supabase/supabase-js';
import { WeeklyVerificationCycle, VerificationCycleStatus } from '@vocilia/types/verification';

export class WeeklyVerificationCycleModel {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient;
  }

  async create(data: {
    cycle_week: string;
    created_by: string;
  }): Promise<WeeklyVerificationCycle> {
    // Validate that cycle_week is a Monday
    const cycleDate = new Date(data.cycle_week);
    if (cycleDate.getDay() !== 1) { // Monday = 1
      throw new Error('Cycle week must start on a Monday');
    }

    // Validate that cycle_week is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (cycleDate < today) {
      throw new Error('Cannot create cycle for past dates');
    }

    const { data: cycle, error } = await this.supabase
      .from('weekly_verification_cycles')
      .insert({
        cycle_week: data.cycle_week,
        status: 'preparing' as VerificationCycleStatus,
        total_stores: 0,
        completed_stores: 0,
        created_by: data.created_by
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Verification cycle for this week already exists');
      }
      throw new Error(`Failed to create verification cycle: ${error.message}`);
    }

    return cycle;
  }

  async findById(id: string): Promise<WeeklyVerificationCycle | null> {
    const { data, error } = await this.supabase
      .from('weekly_verification_cycles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find verification cycle: ${error.message}`);
    }

    return data;
  }

  async findByWeek(cycle_week: string): Promise<WeeklyVerificationCycle | null> {
    const { data, error } = await this.supabase
      .from('weekly_verification_cycles')
      .select('*')
      .eq('cycle_week', cycle_week)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find verification cycle: ${error.message}`);
    }

    return data;
  }

  async list(options: {
    page?: number;
    limit?: number;
    status?: VerificationCycleStatus;
  } = {}): Promise<{
    cycles: WeeklyVerificationCycle[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('weekly_verification_cycles')
      .select('*', { count: 'exact' });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data: cycles, error, count } = await query
      .order('cycle_week', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list verification cycles: ${error.message}`);
    }

    const total = count || 0;
    const total_pages = Math.ceil(total / limit);

    return {
      cycles: cycles || [],
      pagination: {
        page,
        limit,
        total,
        total_pages
      }
    };
  }

  async updateStatus(id: string, status: VerificationCycleStatus): Promise<WeeklyVerificationCycle> {
    const { data, error } = await this.supabase
      .from('weekly_verification_cycles')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update verification cycle status: ${error.message}`);
    }

    return data;
  }

  async updateStoreCount(id: string, total_stores: number, completed_stores: number): Promise<WeeklyVerificationCycle> {
    const { data, error } = await this.supabase
      .from('weekly_verification_cycles')
      .update({ total_stores, completed_stores })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update verification cycle store count: ${error.message}`);
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('weekly_verification_cycles')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete verification cycle: ${error.message}`);
    }
  }

  async getCurrentCycle(): Promise<WeeklyVerificationCycle | null> {
    // Get the current week's Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, Monday = 1
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const cycle_week = monday.toISOString().split('T')[0];

    return this.findByWeek(cycle_week);
  }

  async getActiveCycles(): Promise<WeeklyVerificationCycle[]> {
    const activeStatuses: VerificationCycleStatus[] = [
      'preparing',
      'ready', 
      'distributed',
      'collecting',
      'processing',
      'invoicing'
    ];

    const { data, error } = await this.supabase
      .from('weekly_verification_cycles')
      .select('*')
      .in('status', activeStatuses)
      .order('cycle_week', { ascending: false });

    if (error) {
      throw new Error(`Failed to get active verification cycles: ${error.message}`);
    }

    return data || [];
  }

  async markCompleted(id: string): Promise<WeeklyVerificationCycle> {
    return this.updateStatus(id, 'completed');
  }

  async markExpired(id: string): Promise<WeeklyVerificationCycle> {
    return this.updateStatus(id, 'expired');
  }
}