import { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type {
  Database,
  AuthContext,
  FeedbackSessionRealtimePayload,
  TransactionRealtimePayload,
  VerificationRecordRealtimePayload,
  RealtimePayload
} from '../types/index.js';
import { dbLogger } from '../client/utils.js';

export type TableName = 'feedback_sessions' | 'transactions' | 'verification_record' | 'stores' | 'businesses';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SubscriptionConfig {
  table: TableName;
  filter?: string;
  event?: RealtimeEventType | '*';
  businessId?: string;
  storeId?: string;
}

export interface SubscriptionCallback<T = any> {
  (payload: RealtimePostgresChangesPayload<T>): void;
}

export interface ErrorCallback {
  (error: Error): void;
}

export interface SubscriptionOptions {
  onError?: ErrorCallback;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export class RealtimeSubscriptionManager {
  private subscriptions: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private authContext?: AuthContext;

  constructor(private client: SupabaseClient<Database>) {}

  setAuthContext(authContext?: AuthContext): void {
    this.authContext = authContext;
    dbLogger.debug('Realtime auth context updated', {
      userId: authContext?.user_id,
      businessId: authContext?.business_id,
      role: authContext?.role
    });
  }

  async subscribeFeedbackSessions(
    callback: SubscriptionCallback<FeedbackSessionRealtimePayload>,
    config: Omit<SubscriptionConfig, 'table'> = {},
    options: SubscriptionOptions = {}
  ): Promise<string> {
    const subscriptionConfig: SubscriptionConfig = {
      ...config,
      table: 'feedback_sessions'
    };

    return this.createSubscription(
      'feedback_sessions',
      subscriptionConfig,
      callback,
      options
    );
  }

  async subscribeTransactions(
    callback: SubscriptionCallback<TransactionRealtimePayload>,
    config: Omit<SubscriptionConfig, 'table'> = {},
    options: SubscriptionOptions = {}
  ): Promise<string> {
    const subscriptionConfig: SubscriptionConfig = {
      ...config,
      table: 'transactions'
    };

    return this.createSubscription(
      'transactions',
      subscriptionConfig,
      callback,
      options
    );
  }

  async subscribeVerificationRecords(
    callback: SubscriptionCallback<VerificationRecordRealtimePayload>,
    config: Omit<SubscriptionConfig, 'table'> = {},
    options: SubscriptionOptions = {}
  ): Promise<string> {
    const subscriptionConfig: SubscriptionConfig = {
      ...config,
      table: 'verification_record'
    };

    return this.createSubscription(
      'verification_record',
      subscriptionConfig,
      callback,
      options
    );
  }

  async subscribeBusinessFeedback(
    businessId: string,
    callback: SubscriptionCallback<FeedbackSessionRealtimePayload>,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    if (!this.canAccessBusiness(businessId)) {
      throw new Error('Cannot subscribe to feedback for different business');
    }

    const authorizedStoreIds = await this.getAuthorizedStoreIds(businessId);

    if (authorizedStoreIds.length === 0) {
      throw new Error('No stores found for business');
    }

    const config: SubscriptionConfig = {
      table: 'feedback_sessions',
      filter: `store_id=in.(${authorizedStoreIds.join(',')})`
    };

    return this.createSubscription(
      `business_feedback_${businessId}`,
      config,
      callback,
      options
    );
  }

  async subscribeStoreFeedback(
    storeId: string,
    callback: SubscriptionCallback<FeedbackSessionRealtimePayload>,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    if (!await this.canAccessStore(storeId)) {
      throw new Error('Cannot subscribe to feedback for unauthorized store');
    }

    const config: SubscriptionConfig = {
      table: 'feedback_sessions',
      filter: `store_id=eq.${storeId}`
    };

    return this.createSubscription(
      `store_feedback_${storeId}`,
      config,
      callback,
      options
    );
  }

  async subscribeBusinessTransactions(
    businessId: string,
    callback: SubscriptionCallback<TransactionRealtimePayload>,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    if (!this.canAccessBusiness(businessId)) {
      throw new Error('Cannot subscribe to transactions for different business');
    }

    const authorizedStoreIds = await this.getAuthorizedStoreIds(businessId);

    if (authorizedStoreIds.length === 0) {
      throw new Error('No stores found for business');
    }

    const config: SubscriptionConfig = {
      table: 'transactions',
      filter: `store_id=in.(${authorizedStoreIds.join(',')})`
    };

    return this.createSubscription(
      `business_transactions_${businessId}`,
      config,
      callback,
      options
    );
  }

  async subscribeVerificationUpdates(
    callback: SubscriptionCallback<VerificationRecordRealtimePayload>,
    businessId?: string,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    let config: SubscriptionConfig = {
      table: 'verification_record'
    };

    if (businessId) {
      if (!this.canAccessBusiness(businessId)) {
        throw new Error('Cannot subscribe to verification records for different business');
      }
      config.filter = `business_id=eq.${businessId}`;
    } else if (this.authContext?.business_id && this.authContext.role !== 'admin') {
      config.filter = `business_id=eq.${this.authContext.business_id}`;
    }

    const subscriptionId = businessId
      ? `verification_updates_${businessId}`
      : 'verification_updates_all';

    return this.createSubscription(
      subscriptionId,
      config,
      callback,
      options
    );
  }

  async subscribeActiveWorkflows(
    callback: SubscriptionCallback<FeedbackSessionRealtimePayload>,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    let config: SubscriptionConfig = {
      table: 'feedback_sessions',
      filter: `status=in.(initiated,in_progress)`
    };

    if (this.authContext?.business_id && this.authContext.role !== 'admin') {
      const authorizedStoreIds = await this.getAuthorizedStoreIds(this.authContext.business_id);
      config.filter += `,store_id=in.(${authorizedStoreIds.join(',')})`;
    }

    return this.createSubscription(
      'active_workflows',
      config,
      callback,
      options
    );
  }

  private async createSubscription<T>(
    subscriptionId: string,
    config: SubscriptionConfig,
    callback: SubscriptionCallback<T>,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    try {
      dbLogger.debug('Creating realtime subscription', {
        subscriptionId,
        table: config.table,
        filter: config.filter,
        event: config.event
      });

      if (this.subscriptions.has(subscriptionId)) {
        await this.unsubscribe(subscriptionId);
      }

      const channel = this.client.channel(subscriptionId);

      let query = channel.on(
        'postgres_changes',
        {
          event: config.event || '*',
          schema: 'public',
          table: config.table,
          filter: config.filter
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          try {
            dbLogger.debug('Realtime event received', {
              subscriptionId,
              eventType: payload.eventType,
              table: payload.table
            });

            if (this.shouldProcessEvent(payload, config)) {
              callback(payload);
            }
          } catch (error) {
            dbLogger.error('Error processing realtime event', error);
            if (options.onError) {
              options.onError(error instanceof Error ? error : new Error(String(error)));
            }
          }
        }
      );

      const subscribeResult = await channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          dbLogger.info('Realtime subscription established', { subscriptionId });
          this.reconnectAttempts.set(subscriptionId, 0);
        } else if (status === 'CHANNEL_ERROR') {
          dbLogger.error('Realtime subscription error', { subscriptionId, error });
          if (options.onError) {
            options.onError(new Error(`Subscription error: ${error?.message || 'Unknown error'}`));
          }

          if (options.autoReconnect !== false) {
            this.handleReconnection(subscriptionId, config, callback, options);
          }
        } else if (status === 'CLOSED') {
          dbLogger.warn('Realtime subscription closed', { subscriptionId });
          this.subscriptions.delete(subscriptionId);
        }
      });

      if (subscribeResult === 'ok') {
        this.subscriptions.set(subscriptionId, channel);
        return subscriptionId;
      } else {
        throw new Error(`Failed to subscribe: ${subscribeResult}`);
      }
    } catch (error) {
      dbLogger.error('Failed to create realtime subscription', error);
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleReconnection<T>(
    subscriptionId: string,
    config: SubscriptionConfig,
    callback: SubscriptionCallback<T>,
    options: SubscriptionOptions
  ): Promise<void> {
    const maxAttempts = options.maxReconnectAttempts || 5;
    const delay = options.reconnectDelay || 2000;
    const currentAttempts = this.reconnectAttempts.get(subscriptionId) || 0;

    if (currentAttempts >= maxAttempts) {
      dbLogger.error('Max reconnection attempts reached', { subscriptionId });
      if (options.onError) {
        options.onError(new Error('Max reconnection attempts reached'));
      }
      return;
    }

    this.reconnectAttempts.set(subscriptionId, currentAttempts + 1);

    setTimeout(async () => {
      try {
        dbLogger.info('Attempting to reconnect subscription', {
          subscriptionId,
          attempt: currentAttempts + 1
        });

        await this.createSubscription(subscriptionId, config, callback, options);
      } catch (error) {
        dbLogger.error('Reconnection attempt failed', { subscriptionId, error });
        await this.handleReconnection(subscriptionId, config, callback, options);
      }
    }, delay * Math.pow(2, currentAttempts));
  }

  private shouldProcessEvent<T>(
    payload: RealtimePostgresChangesPayload<T>,
    config: SubscriptionConfig
  ): boolean {
    if (!this.authContext) {
      return true;
    }

    if (this.authContext.role === 'admin') {
      return true;
    }

    if (config.table === 'feedback_sessions' || config.table === 'transactions') {
      const record = payload.new || payload.old;
      if (record && 'store_id' in record) {
        return this.canAccessStoreSync(record.store_id as string);
      }
    }

    if (config.table === 'verification_record') {
      const record = payload.new || payload.old;
      if (record && 'business_id' in record) {
        return this.canAccessBusiness(record.business_id as string);
      }
    }

    if (config.table === 'businesses') {
      const record = payload.new || payload.old;
      if (record && 'id' in record) {
        return this.canAccessBusiness(record.id as string);
      }
    }

    return true;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      const channel = this.subscriptions.get(subscriptionId);

      if (channel) {
        dbLogger.debug('Unsubscribing from realtime channel', { subscriptionId });

        await this.client.removeChannel(channel);
        this.subscriptions.delete(subscriptionId);
        this.reconnectAttempts.delete(subscriptionId);

        dbLogger.info('Unsubscribed from realtime channel', { subscriptionId });
      }
    } catch (error) {
      dbLogger.error('Error unsubscribing from channel', { subscriptionId, error });
      throw new Error(`Failed to unsubscribe: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async unsubscribeAll(): Promise<void> {
    try {
      dbLogger.debug('Unsubscribing from all realtime channels');

      const subscriptionIds = Array.from(this.subscriptions.keys());

      await Promise.all(
        subscriptionIds.map(id => this.unsubscribe(id))
      );

      dbLogger.info('Unsubscribed from all realtime channels');
    } catch (error) {
      dbLogger.error('Error unsubscribing from all channels', error);
      throw error;
    }
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  isSubscribed(subscriptionId: string): boolean {
    return this.subscriptions.has(subscriptionId);
  }

  getSubscriptionStatus(subscriptionId: string): string | null {
    const channel = this.subscriptions.get(subscriptionId);
    return channel ? channel.state : null;
  }

  async reconnectAllSubscriptions(): Promise<void> {
    try {
      dbLogger.info('Reconnecting all subscriptions');

      for (const [subscriptionId, channel] of this.subscriptions) {
        try {
          await channel.unsubscribe();
          await channel.subscribe();
        } catch (error) {
          dbLogger.error('Failed to reconnect subscription', { subscriptionId, error });
        }
      }
    } catch (error) {
      dbLogger.error('Error reconnecting all subscriptions', error);
      throw error;
    }
  }

  private canAccessBusiness(businessId: string): boolean {
    if (!this.authContext) {
      return false;
    }

    if (this.authContext.role === 'admin') {
      return true;
    }

    return this.authContext.business_id === businessId;
  }

  private async canAccessStore(storeId: string): Promise<boolean> {
    try {
      const { data: store, error } = await this.client
        .from('stores')
        .select('business_id')
        .eq('id', storeId)
        .single();

      if (error || !store) {
        return false;
      }

      return this.canAccessBusiness(store.business_id);
    } catch {
      return false;
    }
  }

  private canAccessStoreSync(storeId: string): boolean {
    return true;
  }

  private async getAuthorizedStoreIds(businessId: string): Promise<string[]> {
    try {
      const { data: stores, error } = await this.client
        .from('stores')
        .select('id')
        .eq('business_id', businessId);

      if (error) {
        dbLogger.error('Failed to get authorized store IDs', error);
        return [];
      }

      return stores?.map(store => store.id) || [];
    } catch (error) {
      dbLogger.error('Error getting authorized store IDs', error);
      return [];
    }
  }

  async createBusinessFilter(businessId?: string): Promise<string | undefined> {
    if (!businessId) {
      if (this.authContext?.business_id && this.authContext.role !== 'admin') {
        businessId = this.authContext.business_id;
      } else {
        return undefined;
      }
    }

    const storeIds = await this.getAuthorizedStoreIds(businessId);
    return storeIds.length > 0 ? `store_id=in.(${storeIds.join(',')})` : undefined;
  }

  async subscribeWithBusinessFilter<T>(
    table: TableName,
    callback: SubscriptionCallback<T>,
    businessId?: string,
    additionalFilter?: string,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    const businessFilter = await this.createBusinessFilter(businessId);

    let filter = businessFilter;
    if (additionalFilter) {
      filter = filter ? `${filter},${additionalFilter}` : additionalFilter;
    }

    const config: SubscriptionConfig = {
      table,
      filter
    };

    const subscriptionId = `${table}_${businessId || 'all'}_${Date.now()}`;

    return this.createSubscription(subscriptionId, config, callback, options);
  }
}

export function createRealtimeSubscriptionManager(client: SupabaseClient<Database>): RealtimeSubscriptionManager {
  return new RealtimeSubscriptionManager(client);
}