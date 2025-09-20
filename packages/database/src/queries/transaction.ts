import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Database,
  Transaction,
  TransactionInsert,
  TransactionUpdate,
  TransactionFilters,
  TransactionWithFeedback,
  VerificationStatus,
  TransactionToleranceInput,
  TransactionVerificationResult,
  PaginationParams,
  PaginatedResponse,
  AuthContext
} from '../types/index.js';
import { formatDatabaseError, retryWithExponentialBackoff, dbLogger } from '../client/utils.js';

export class TransactionQueries {
  constructor(private client: SupabaseClient<Database>) {}

  async create(data: TransactionInsert, authContext?: AuthContext): Promise<Transaction> {
    try {
      dbLogger.debug('Creating transaction', { store_id: data.store_id });

      await this.validateStoreAccess(data.store_id, authContext);

      const timeRange = await this.createTimeToleranceRange(data.customer_time_range);
      const amountRange = await this.createAmountToleranceRange(data.customer_amount_range);

      const transactionData = {
        ...data,
        customer_time_range: timeRange,
        customer_amount_range: amountRange
      };

      const { data: transaction, error } = await this.client
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        dbLogger.error('Failed to create transaction', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Transaction created successfully', { id: transaction.id, store_id: transaction.store_id });
      return transaction;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create transaction');
    }
  }

  async createFromToleranceInput(
    storeId: string,
    toleranceInput: TransactionToleranceInput,
    authContext?: AuthContext
  ): Promise<Transaction> {
    try {
      await this.validateStoreAccess(storeId, authContext);

      const timeRange = await this.createTimeToleranceFromTimestamp(toleranceInput.customer_time);
      const amountRange = await this.createAmountToleranceFromValue(toleranceInput.customer_amount);

      const transactionData: TransactionInsert = {
        store_id: storeId,
        customer_time_range: timeRange,
        customer_amount_range: amountRange,
        verification_status: 'pending',
        is_verified: false
      };

      return await this.create(transactionData, authContext);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to create transaction from tolerance input');
    }
  }

  async findById(id: string, authContext?: AuthContext): Promise<Transaction | null> {
    try {
      dbLogger.debug('Finding transaction by ID', { id });

      const query = this.client
        .from('transactions')
        .select('*')
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: transaction, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          dbLogger.debug('Transaction not found', { id });
          return null;
        }
        dbLogger.error('Failed to find transaction by ID', error);
        throw formatDatabaseError(error);
      }

      return transaction;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find transaction');
    }
  }

  async findByStoreId(
    storeId: string,
    filters: TransactionFilters = {},
    pagination: PaginationParams = { page: 1, limit: 50 },
    authContext?: AuthContext
  ): Promise<PaginatedResponse<Transaction>> {
    try {
      dbLogger.debug('Finding transactions by store ID', { storeId });

      await this.validateStoreAccess(storeId, authContext);

      const { page, limit, order_by = 'created_at', order_direction = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      let query = this.client
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

      if (filters.verification_status) {
        query = query.eq('verification_status', filters.verification_status);
      }

      if (filters.is_verified !== undefined) {
        query = query.eq('is_verified', filters.is_verified);
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

      const { data: transactions, error, count } = await query;

      if (error) {
        dbLogger.error('Failed to find transactions by store ID', error);
        throw formatDatabaseError(error);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: transactions || [],
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
      throw new Error('Failed to find transactions by store ID');
    }
  }

  async findWithFeedback(id: string, authContext?: AuthContext): Promise<TransactionWithFeedback | null> {
    try {
      dbLogger.debug('Finding transaction with feedback', { id });

      const query = this.client
        .from('transactions')
        .select(`
          *,
          feedback_session:feedback_sessions(*)
        `)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: transaction, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        dbLogger.error('Failed to find transaction with feedback', error);
        throw formatDatabaseError(error);
      }

      return transaction as TransactionWithFeedback;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find transaction with feedback');
    }
  }

  async findPendingVerification(
    storeId?: string,
    authContext?: AuthContext
  ): Promise<Transaction[]> {
    try {
      dbLogger.debug('Finding pending verification transactions', { storeId });

      let query = this.client
        .from('transactions')
        .select('*')
        .eq('verification_status', 'pending')
        .eq('is_verified', false);

      if (storeId) {
        await this.validateStoreAccess(storeId, authContext);
        query = query.eq('store_id', storeId);
      } else if (authContext?.business_id && authContext.role !== 'admin') {
        query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      query = query.order('created_at', { ascending: true });

      const { data: transactions, error } = await query;

      if (error) {
        dbLogger.error('Failed to find pending verification transactions', error);
        throw formatDatabaseError(error);
      }

      return transactions || [];
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find pending verification transactions');
    }
  }

  async update(id: string, data: TransactionUpdate, authContext?: AuthContext): Promise<Transaction> {
    try {
      dbLogger.debug('Updating transaction', { id, fields: Object.keys(data) });

      const query = this.client
        .from('transactions')
        .update(data)
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { data: transaction, error } = await query.select().single();

      if (error) {
        dbLogger.error('Failed to update transaction', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Transaction updated successfully', { id });
      return transaction;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to update transaction');
    }
  }

  async verifyTransaction(
    id: string,
    actualAmount: number,
    actualTime: string,
    authContext?: AuthContext
  ): Promise<TransactionVerificationResult> {
    try {
      dbLogger.debug('Verifying transaction', { id, actualAmount, actualTime });

      const transaction = await this.findById(id, authContext);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const result = await this.checkToleranceMatch(transaction, actualAmount, actualTime);

      if (result.is_match) {
        await this.update(id, {
          actual_amount: actualAmount,
          actual_time: actualTime,
          verification_status: 'verified',
          is_verified: true
        }, authContext);
      } else {
        await this.update(id, {
          verification_status: 'rejected',
          is_verified: false
        }, authContext);
      }

      dbLogger.info('Transaction verification completed', { id, is_match: result.is_match });
      return result;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to verify transaction');
    }
  }

  async findMatchingTransactions(
    storeId: string,
    actualAmount: number,
    actualTime: string,
    authContext?: AuthContext
  ): Promise<TransactionVerificationResult[]> {
    try {
      dbLogger.debug('Finding matching transactions', { storeId, actualAmount, actualTime });

      await this.validateStoreAccess(storeId, authContext);

      const pendingTransactions = await this.findPendingVerification(storeId, authContext);

      const results: TransactionVerificationResult[] = [];

      for (const transaction of pendingTransactions) {
        const result = await this.checkToleranceMatch(transaction, actualAmount, actualTime);
        results.push(result);
      }

      return results.sort((a, b) => b.confidence_score - a.confidence_score);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to find matching transactions');
    }
  }

  async delete(id: string, authContext?: AuthContext): Promise<void> {
    try {
      dbLogger.debug('Deleting transaction', { id });

      const query = this.client
        .from('transactions')
        .delete()
        .eq('id', id);

      if (authContext?.business_id && authContext.role !== 'admin') {
        query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
      }

      const { error } = await query;

      if (error) {
        dbLogger.error('Failed to delete transaction', error);
        throw formatDatabaseError(error);
      }

      dbLogger.info('Transaction deleted successfully', { id });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw new Error('Failed to delete transaction');
    }
  }

  async exists(id: string, authContext?: AuthContext): Promise<boolean> {
    try {
      const transaction = await this.findById(id, authContext);
      return transaction !== null;
    } catch {
      return false;
    }
  }

  async count(
    storeId?: string,
    verificationStatus?: VerificationStatus,
    authContext?: AuthContext
  ): Promise<number> {
    try {
      let query = this.client
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      if (verificationStatus) {
        query = query.eq('verification_status', verificationStatus);
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
      throw new Error('Failed to count transactions');
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
      throw new Error('Cannot access transactions for store from different business');
    }
  }

  private buildAuthorizedStoreIds(businessId: string): Promise<string[]> {
    return this.client
      .from('stores')
      .select('id')
      .eq('business_id', businessId)
      .then(({ data }) => data?.map(store => store.id) || []);
  }

  private async createTimeToleranceRange(timeRangeString: string): Promise<string> {
    try {
      if (timeRangeString.includes('[') && timeRangeString.includes(')')) {
        return timeRangeString;
      }

      const { data, error } = await this.client
        .rpc('create_time_tolerance', {
          customer_time: timeRangeString
        });

      if (error) {
        dbLogger.warn('Failed to create time tolerance range, using fallback', error);
        return this.createFallbackTimeRange(timeRangeString);
      }

      return data;
    } catch (error) {
      dbLogger.warn('Error creating time tolerance range, using fallback', error);
      return this.createFallbackTimeRange(timeRangeString);
    }
  }

  private async createAmountToleranceRange(amountRangeString: string): Promise<string> {
    try {
      if (amountRangeString.includes('[') && amountRangeString.includes(']')) {
        return amountRangeString;
      }

      const amount = parseFloat(amountRangeString);
      const { data, error } = await this.client
        .rpc('create_amount_tolerance', {
          customer_amount: amount
        });

      if (error) {
        dbLogger.warn('Failed to create amount tolerance range, using fallback', error);
        return this.createFallbackAmountRange(amount);
      }

      return data;
    } catch (error) {
      dbLogger.warn('Error creating amount tolerance range, using fallback', error);
      const amount = parseFloat(amountRangeString) || 0;
      return this.createFallbackAmountRange(amount);
    }
  }

  private async createTimeToleranceFromTimestamp(timestamp: string): Promise<string> {
    return await this.createTimeToleranceRange(timestamp);
  }

  private async createAmountToleranceFromValue(amount: number): Promise<string> {
    return await this.createAmountToleranceRange(amount.toString());
  }

  private createFallbackTimeRange(timeString: string): string {
    const customerTime = new Date(timeString);
    const toleranceMinutes = 2;

    const startTime = new Date(customerTime.getTime() - toleranceMinutes * 60000);
    const endTime = new Date(customerTime.getTime() + toleranceMinutes * 60000);

    return `[${startTime.toISOString()}, ${endTime.toISOString()})`;
  }

  private createFallbackAmountRange(amount: number): string {
    const toleranceSEK = 2.0;
    const minAmount = Math.max(0, amount - toleranceSEK);
    const maxAmount = amount + toleranceSEK;

    return `[${minAmount}, ${maxAmount}]`;
  }

  private async checkToleranceMatch(
    transaction: Transaction,
    actualAmount: number,
    actualTime: string
  ): Promise<TransactionVerificationResult> {
    const actualDateTime = new Date(actualTime);

    const timeRange = this.parseTimeRange(transaction.customer_time_range);
    const amountRange = this.parseAmountRange(transaction.customer_amount_range);

    const isTimeMatch = actualDateTime >= timeRange.start && actualDateTime < timeRange.end;
    const isAmountMatch = actualAmount >= amountRange.min && actualAmount <= amountRange.max;

    const timeDifferenceMs = Math.min(
      Math.abs(actualDateTime.getTime() - timeRange.start.getTime()),
      Math.abs(actualDateTime.getTime() - timeRange.end.getTime())
    );
    const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);

    const amountDifference = Math.min(
      Math.abs(actualAmount - amountRange.min),
      Math.abs(actualAmount - amountRange.max)
    );

    const timeScore = isTimeMatch ? 1 : Math.max(0, 1 - (timeDifferenceMinutes / 10));
    const amountScore = isAmountMatch ? 1 : Math.max(0, 1 - (amountDifference / 10));

    const confidenceScore = (timeScore + amountScore) / 2;

    return {
      transaction_id: transaction.id,
      is_match: isTimeMatch && isAmountMatch,
      time_difference_minutes: timeDifferenceMinutes,
      amount_difference_sek: amountDifference,
      confidence_score: Math.round(confidenceScore * 100) / 100
    };
  }

  private parseTimeRange(timeRangeString: string): { start: Date; end: Date } {
    const match = timeRangeString.match(/\[([^,]+),\s*([^)]+)\)/);
    if (!match) {
      throw new Error('Invalid time range format');
    }

    return {
      start: new Date(match[1].trim()),
      end: new Date(match[2].trim())
    };
  }

  private parseAmountRange(amountRangeString: string): { min: number; max: number } {
    const match = amountRangeString.match(/\[([^,]+),\s*([^\]]+)\]/);
    if (!match) {
      throw new Error('Invalid amount range format');
    }

    return {
      min: parseFloat(match[1].trim()),
      max: parseFloat(match[2].trim())
    };
  }
}

export function createTransactionQueries(client: SupabaseClient<Database>): TransactionQueries {
  return new TransactionQueries(client);
}