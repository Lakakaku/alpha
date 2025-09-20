import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Database,
  FeedbackSession,
  FeedbackSessionInsert,
  FeedbackSessionUpdate,
  FeedbackSessionFilters,
  FeedbackSessionWithTransaction,
  FeedbackSessionWithStore,
  FeedbackStatus,
  PaginationParams,
  PaginatedResponse,
  AuthContext
} from '../types/index.js';
import { formatDatabaseError, retryWithExponentialBackoff, dbLogger } from '../client/utils.js';

export class FeedbackSessionQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async create(data: FeedbackSessionInsert, authContext?: AuthContext): Promise<FeedbackSession> {
    try {
      dbLogger.debug('Creating feedback session', { store_id: data.store_id, transaction_id: data.transaction_id });

      await this.validateStoreAccess(data.store_id, authContext);
      await this.validateTransactionAccess(data.transaction_id, authContext);

      const hashedPhoneNumber = await this.hashPhoneNumber(data.customer_phone_hash);

      const feedbackSessionData = {
        ...data,
        customer_phone_hash: hashedPhoneNumber
      };

      const { data: feedbackSession, error } = await this.client
        .from('feedback_sessions')
        .insert(feedbackSessionData)
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to create feedback session', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Feedback session created successfully', {
        id: feedbackSession.id,
        store_id: feedbackSession.store_id,
        status: feedbackSession.status
      });
      return feedbackSession;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create feedback session');
    }
  }

  async findById(id: string, authContext?: AuthContext): Promise<FeedbackSession | null> {
    try {
      dbLogger.debug('Finding feedback session by ID', { id });

      const query = this.client
        .from('feedback_sessions')
        .select('*')
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: feedbackSession, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          dbLogger.debug('Feedback session not found', { id });
          return null;
        }
        dbLogger.error('Failed to find feedback session by ID', error);
        throw formatDatabaseError(error);
      }

      return feedbackSession;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find feedback session');
    }
  }

  async findByTransactionId(transactionId: string, authContext?: AuthContext): Promise<FeedbackSession | null> {
    try {
      dbLogger.debug('Finding feedback session by transaction ID', { transactionId });

      await this.validateTransactionAccess(transactionId, authContext);

      const { data: feedbackSession, error } = await this.client
        .from('feedback_sessions')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle();

      if (error) {
        dbLogger.error('Failed to find feedback session by transaction ID', error);
        throw formatDatabaseError(error);
      }

      return feedbackSession;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find feedback session by transaction ID');
    }
  }

  async findByStoreId(
    storeId: string,
    filters: FeedbackSessionFilters = {},
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<FeedbackSession>> {
    try {
      dbLogger.debug('Finding feedback sessions by store ID', { storeId });

      await this.validateStoreAccess(storeId, authContext);

      const { page, limit, order_by = 'created_at', order_direction = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      let query = this.client
        .from('feedback_sessions')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.quality_grade_min !== undefined) {
        query = query.gte('quality_grade', filters.quality_grade_min);
      }

      if (filters.quality_grade_max !== undefined) {
        query = query.lte('quality_grade', filters.quality_grade_max);
      }

      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }

      if (filters.created_before) {
        query = query.lte('created_at', filters.created_before);
      }

      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: feedbackSessions, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to find feedback sessions by store ID', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: feedbackSessions || [],
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        }
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find feedback sessions by store ID');
    }
  }

  async findWithTransaction(id: string, authContext?: AuthContext): Promise<FeedbackSessionWithTransaction | null> {
    try {
      dbLogger.debug('Finding feedback session with transaction', { id });

      const query = this.client
        .from('feedback_sessions')
        .select(`
          *,
          transaction:transactions(*)
        `)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: feedbackSession, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find feedback session with transaction', error);
        throw formatDatabaseError(error);
      }

      return feedbackSession as FeedbackSessionWithTransaction;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find feedback session with transaction');
    }
  }

  async findWithStore(id: string, authContext?: AuthContext): Promise<FeedbackSessionWithStore | null> {
    try {
      dbLogger.debug('Finding feedback session with store', { id });

      const query = this.client
        .from('feedback_sessions')
        .select(`
          *,
          store:stores(*)
        `)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: feedbackSession, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find feedback session with store', error);
        throw formatDatabaseError(error);
      }

      return feedbackSession as FeedbackSessionWithStore;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find feedback session with store');
    }
  }

  async findByStatus(
    status: FeedbackStatus,
    storeId?: string,
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<FeedbackSession>> {
    try {
      dbLogger.debug('Finding feedback sessions by status', { status, storeId });

      const { page, limit, order_by = 'created_at', order_direction = 'asc' } = pagination;
      const offset = (page - 1) * limit;

      let query = this.client
        .from('feedback_sessions')
        .select('*', { count: 'exact' })
        .eq('status', status);

      if (storeId) {
        await this.validateStoreAccess(storeId, authContext);
        query = query.eq('store_id', storeId);
      } else if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      query = query
        .order(order_by, { ascending: order_direction === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: feedbackSessions, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to find feedback sessions by status', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: feedbackSessions || [],
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        }
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find feedback sessions by status');
    }
  }

  async update(id: string, data: FeedbackSessionUpdate, authContext?: AuthContext): Promise<FeedbackSession> {
    try {
      dbLogger.debug('Updating feedback session', { id, fields: Object.keys(data) });

      const query = this.client
        .from('feedback_sessions')
        .update(data)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: feedbackSession, error } = await query.select().single();

      if (error) {
        dbLogger.error('Failed to update feedback session', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Feedback session updated successfully', { id, status: feedbackSession.status });
      return feedbackSession;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update feedback session');
    }
  }

  async updateStatus(id: string, status: FeedbackStatus, authContext?: AuthContext): Promise<FeedbackSession> {
    try {
      const updateData: FeedbackSessionUpdate = { status };

      if (status === 'in_progress' && !await this.hasCallStartTime(id)) {
        updateData.call_started_at = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updateData.call_completed_at = new Date().toISOString();
      }

      return await this.update(id, updateData, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update feedback session status');
    }
  }

  async completeSession(
    id: string,
    qualityGrade: number,
    rewardPercentage: number,
    feedbackSummary: Record<string, any>,
    authContext?: AuthContext
  ): Promise<FeedbackSession> {
    try {
      dbLogger.debug('Completing feedback session', { id, qualityGrade, rewardPercentage });

      if (qualityGrade < 1 || qualityGrade > 10) {
        throw new Error('Quality grade must be between 1 and 10');
      }

      if (rewardPercentage < 2.0 || rewardPercentage > 15.0) {
        throw new Error('Reward percentage must be between 2.0% and 15.0%');
      }

      const updateData: FeedbackSessionUpdate = {
        status: 'completed',
        quality_grade: qualityGrade,
        reward_percentage: rewardPercentage,
        feedback_summary: feedbackSummary,
        call_completed_at: new Date().toISOString()
      };

      return await this.update(id, updateData, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to complete feedback session');
    }
  }

  async failSession(
    id: string,
    reason: string,
    authContext?: AuthContext
  ): Promise<FeedbackSession> {
    try {
      dbLogger.debug('Failing feedback session', { id, reason });

      const updateData: FeedbackSessionUpdate = {
        status: 'failed',
        feedback_summary: { failure_reason: reason, failed_at: new Date().toISOString() },
        call_completed_at: new Date().toISOString()
      };

      return await this.update(id, updateData, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to fail feedback session');
    }
  }

  async delete(id: string, authContext?: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Deleting feedback session', { id });

      const query = this.client
        .from('feedback_sessions')
        .delete()
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { error } = await query;

      if (error) {
        dbLogger.error('Failed to delete feedback session', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Feedback session deleted successfully', { id });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to delete feedback session');
    }
  }

  async getSessionMetrics(
    storeId?: string,
    dateRange?: { start: string; end: string },
    authContext?: AuthContext
  ): Promise<{
    total_sessions: number;
    completed_sessions: number;
    failed_sessions: number;
    average_quality_grade: number;
    average_reward_percentage: number;
    completion_rate: number;
  }> {
    try {
      let query = this.client
        .from('feedback_sessions')
        .select('status, quality_grade, reward_percentage');

      if (storeId) {
        await this.validateStoreAccess(storeId, authContext);
        query = query.eq('store_id', storeId);
      } else if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      if (dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }

      const { data: sessions, error } = await query;

      if (error) {
        throw formatDatabaseError(error);
      }

      const totalSessions = sessions?.length || 0;
      const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0;
      const failedSessions = sessions?.filter(s => s.status === 'failed').length || 0;

      const completedSessionsData = sessions?.filter(s => s.status === 'completed' && s.quality_grade !== null) || [];
      const avgQualityGrade = completedSessionsData.length > 0
        ? completedSessionsData.reduce((sum, s) => sum + (s.quality_grade || 0), 0) / completedSessionsData.length
        : 0;

      const avgRewardPercentage = completedSessionsData.length > 0
        ? completedSessionsData.reduce((sum, s) => sum + (s.reward_percentage || 0), 0) / completedSessionsData.length
        : 0;

      const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

      return {
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        failed_sessions: failedSessions,
        average_quality_grade: Math.round(avgQualityGrade * 100) / 100,
        average_reward_percentage: Math.round(avgRewardPercentage * 100) / 100,
        completion_rate: Math.round(completionRate * 10000) / 100
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to get session metrics');
    }
  }

  async exists(id: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const feedbackSession = await this.findById(id, authContext);
      return feedbackSession !== null;
    } catch {
      return false;
    }
  }

  async count(
    storeId?: string,
    status?: FeedbackStatus,
    authContext?: AuthContext
  ): Promise<number> {
    try {
      let query = this.client
        .from('feedback_sessions')
        .select('*', { count: 'exact', head: true });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { count, error } = await query;

      if (error) {
        throw formatDatabaseError(error);
      }

      return count || 0;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to count feedback sessions');
    }
  }

  private async validateStoreAccess(storeId: string, authContext?: AuthContext): Promise<void> {
    if (!authContext || authContext.role === 'admin') {
      return;
    }

    const { data: store, error } = await this.client
      .from('stores')
      .select('business_id')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      throw new Error('Store not found');
    }

    if (authContext.business_id !== store.business_id) {
      throw new Error('Cannot access feedback sessions for store from different business');
    }
  }

  private async validateTransactionAccess(transactionId: string, authContext?: AuthContext): Promise<void> {
    if (!authContext || authContext.role === 'admin') {
      return;
    }

    const { data: transaction, error } = await this.client
      .from('transactions')
      .select('store_id, stores!inner(business_id)')
      .eq('id', transactionId)
      .single();

    if (error || !transaction) {
      throw new Error('Transaction not found');
    }

    const store = Array.isArray(transaction.stores) ? transaction.stores[0] : transaction.stores;
    if (authContext.business_id !== store?.business_id) {
      throw new Error('Cannot access transaction from different business');
    }
  }

  private buildAuthorizedStoreIds(businessId: string): Promise<string[]> {
    return this.client
      .from('stores')
      .select('id')
      .eq('business_id', businessId)
      .then(({ data }) => data?.map(store => store.id) || []);
  }

  private async hashPhoneNumber(phoneNumber: string): Promise<string> {
    if (phoneNumber.startsWith('hash_')) {
      return phoneNumber;
    }

    const crypto = await import('crypto');
    return `hash_${crypto.createHash('sha256').update(phoneNumber).digest('hex')}`;
  }

  private async hasCallStartTime(id: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('feedback_sessions')
        .select('call_started_at')
        .eq('id', id)
        .single();

      return !error && data?.call_started_at !== null;
    } catch {
      return false;
    }
  }

  async findActiveSessions(authContext?: AuthContext): Promise<FeedbackSession[]> {
    try {
      let query = this.client
        .from('feedback_sessions')
        .select('*')
        .in('status', ['initiated', 'in_progress'])
        .order('created_at', { ascending: true });

      if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: sessions, error } = await query;

      if (error) {
        throw formatDatabaseError(error);
      }

      return sessions || [];
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find active sessions');
    }
  }

  async findSessionsRequiringAttention(authContext?: AuthContext): Promise<FeedbackSession[]> {
    try {
      const thresholdTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago

      let query = this.client
        .from('feedback_sessions')
        .select('*')
        .eq('status', 'in_progress')
        .lt('call_started_at', thresholdTime)
        .order('call_started_at', { ascending: true });

      if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: sessions, error } = await query;

      if (error) {
        throw formatDatabaseError(error);
      }

      return sessions || [];
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find sessions requiring attention');
    }
  }
}

export function createFeedbackSessionQueries(client: SupabaseClient<Database>): FeedbackSessionQueries {
  return new FeedbackSessionQueries(client);
}