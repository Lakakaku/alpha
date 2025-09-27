import { CallSession, CallSessionStatus } from '@vocilia/types';
import { supabase } from '../config/supabase';

export class CallSessionModel {
  static async create(data: {
    business_id: string;
    customer_phone: string;
    verification_id: string;
    status: CallSessionStatus;
    started_at: string;
    questions_asked?: string[];
    ai_session_id?: string;
    telephony_call_id?: string;
  }): Promise<CallSession> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .insert({
        ...data,
        questions_asked: data.questions_asked || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create call session: ${error.message}`);
    }

    return session;
  }

  static async findById(id: string): Promise<CallSession | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find call session: ${error.message}`);
    }

    return session;
  }

  static async findByBusinessId(businessId: string, options?: {
    status?: CallSessionStatus;
    limit?: number;
    offset?: number;
  }): Promise<CallSession[]> {
    let query = supabase
      .from('call_sessions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw new Error(`Failed to find call sessions: ${error.message}`);
    }

    return sessions || [];
  }

  static async update(id: string, updates: Partial<CallSession>): Promise<CallSession> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update call session: ${error.message}`);
    }

    return session;
  }

  static async updateStatus(id: string, status: CallSessionStatus, metadata?: {
    connected_at?: string;
    ended_at?: string;
    duration_seconds?: number;
    cost_estimate?: number;
    recording_url?: string;
    transcript?: string;
  }): Promise<CallSession> {
    const updates: Partial<CallSession> = {
      status,
      ...metadata,
    };

    return this.update(id, updates);
  }

  static async addQuestion(sessionId: string, questionId: string): Promise<CallSession> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error('Call session not found');
    }

    const updatedQuestions = [...(session.questions_asked || []), questionId];
    
    return this.update(sessionId, {
      questions_asked: updatedQuestions,
    });
  }

  static async findByVerificationId(verificationId: string): Promise<CallSession[]> {
    const { data: sessions, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('verification_id', verificationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find call sessions by verification: ${error.message}`);
    }

    return sessions || [];
  }

  static async findActiveByBusinessId(businessId: string): Promise<CallSession[]> {
    const { data: sessions, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('business_id', businessId)
      .in('status', ['initiated', 'connecting', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to find active call sessions: ${error.message}`);
    }

    return sessions || [];
  }

  static async findByTelephonyCallId(telephonyCallId: string): Promise<CallSession | null> {
    const { data: session, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('telephony_call_id', telephonyCallId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find call session by telephony ID: ${error.message}`);
    }

    return session;
  }

  static async getTotalCostByBusinessId(businessId: string, dateFrom?: string, dateTo?: string): Promise<number> {
    let query = supabase
      .from('call_sessions')
      .select('cost_estimate')
      .eq('business_id', businessId)
      .not('cost_estimate', 'is', null);

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw new Error(`Failed to calculate total costs: ${error.message}`);
    }

    return (sessions || []).reduce((total, session) => total + (session.cost_estimate || 0), 0);
  }

  static async getCallMetrics(businessId: string, dateFrom?: string, dateTo?: string): Promise<{
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    timeoutCalls: number;
    averageDuration: number;
    totalCost: number;
  }> {
    let query = supabase
      .from('call_sessions')
      .select('status, duration_seconds, cost_estimate')
      .eq('business_id', businessId);

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: sessions, error } = await query;

    if (error) {
      throw new Error(`Failed to get call metrics: ${error.message}`);
    }

    const metrics = (sessions || []).reduce(
      (acc, session) => {
        acc.totalCalls++;
        
        if (session.status === 'completed') acc.completedCalls++;
        if (session.status === 'failed') acc.failedCalls++;
        if (session.status === 'timeout') acc.timeoutCalls++;
        
        if (session.duration_seconds) {
          acc.totalDuration += session.duration_seconds;
        }
        
        if (session.cost_estimate) {
          acc.totalCost += session.cost_estimate;
        }
        
        return acc;
      },
      { 
        totalCalls: 0, 
        completedCalls: 0, 
        failedCalls: 0, 
        timeoutCalls: 0, 
        totalDuration: 0, 
        totalCost: 0 
      }
    );

    return {
      ...metrics,
      averageDuration: metrics.totalCalls > 0 ? metrics.totalDuration / metrics.totalCalls : 0,
    };
  }

  static async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from('call_sessions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete call session: ${error.message}`);
    }
  }

  static async isValidStatusTransition(currentStatus: CallSessionStatus, newStatus: CallSessionStatus): boolean {
    const validTransitions: Record<CallSessionStatus, CallSessionStatus[]> = {
      'initiated': ['connecting', 'failed'],
      'connecting': ['in_progress', 'failed'],
      'in_progress': ['completed', 'timeout', 'failed'],
      'completed': [], // Terminal state
      'failed': [], // Terminal state  
      'timeout': [], // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}