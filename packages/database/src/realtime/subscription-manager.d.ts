import { SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database, AuthContext, FeedbackSessionRealtimePayload, TransactionRealtimePayload, VerificationRecordRealtimePayload } from '../types/index.js';
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
export declare class RealtimeSubscriptionManager {
    private client;
    private subscriptions;
    private reconnectAttempts;
    private authContext?;
    constructor(client: SupabaseClient<Database>);
    setAuthContext(authContext?: AuthContext): void;
    subscribeFeedbackSessions(callback: SubscriptionCallback<FeedbackSessionRealtimePayload>, config?: Omit<SubscriptionConfig, 'table'>, options?: SubscriptionOptions): Promise<string>;
    subscribeTransactions(callback: SubscriptionCallback<TransactionRealtimePayload>, config?: Omit<SubscriptionConfig, 'table'>, options?: SubscriptionOptions): Promise<string>;
    subscribeVerificationRecords(callback: SubscriptionCallback<VerificationRecordRealtimePayload>, config?: Omit<SubscriptionConfig, 'table'>, options?: SubscriptionOptions): Promise<string>;
    subscribeBusinessFeedback(businessId: string, callback: SubscriptionCallback<FeedbackSessionRealtimePayload>, options?: SubscriptionOptions): Promise<string>;
    subscribeStoreFeedback(storeId: string, callback: SubscriptionCallback<FeedbackSessionRealtimePayload>, options?: SubscriptionOptions): Promise<string>;
    subscribeBusinessTransactions(businessId: string, callback: SubscriptionCallback<TransactionRealtimePayload>, options?: SubscriptionOptions): Promise<string>;
    subscribeVerificationUpdates(callback: SubscriptionCallback<VerificationRecordRealtimePayload>, businessId?: string, options?: SubscriptionOptions): Promise<string>;
    subscribeActiveWorkflows(callback: SubscriptionCallback<FeedbackSessionRealtimePayload>, options?: SubscriptionOptions): Promise<string>;
    private createSubscription;
    private handleReconnection;
    private shouldProcessEvent;
    unsubscribe(subscriptionId: string): Promise<void>;
    unsubscribeAll(): Promise<void>;
    getActiveSubscriptions(): string[];
    isSubscribed(subscriptionId: string): boolean;
    getSubscriptionStatus(subscriptionId: string): string | null;
    reconnectAllSubscriptions(): Promise<void>;
    private canAccessBusiness;
    private canAccessStore;
    private canAccessStoreSync;
    private getAuthorizedStoreIds;
    createBusinessFilter(businessId?: string): Promise<string | undefined>;
    subscribeWithBusinessFilter<T>(table: TableName, callback: SubscriptionCallback<T>, businessId?: string, additionalFilter?: string, options?: SubscriptionOptions): Promise<string>;
}
export declare function createRealtimeSubscriptionManager(client: SupabaseClient<Database>): RealtimeSubscriptionManager;
//# sourceMappingURL=subscription-manager.d.ts.map