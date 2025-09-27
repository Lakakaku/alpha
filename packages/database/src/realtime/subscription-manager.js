"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeSubscriptionManager = void 0;
exports.createRealtimeSubscriptionManager = createRealtimeSubscriptionManager;
const utils_js_1 = require("../client/utils.js");
class RealtimeSubscriptionManager {
    client;
    subscriptions = new Map();
    reconnectAttempts = new Map();
    authContext;
    constructor(client) {
        this.client = client;
    }
    setAuthContext(authContext) {
        this.authContext = authContext;
        utils_js_1.dbLogger.debug('Realtime auth context updated', {
            userId: authContext?.user_id,
            businessId: authContext?.business_id,
            role: authContext?.role
        });
    }
    async subscribeFeedbackSessions(callback, config = {}, options = {}) {
        const subscriptionConfig = {
            ...config,
            table: 'feedback_sessions'
        };
        return this.createSubscription('feedback_sessions', subscriptionConfig, callback, options);
    }
    async subscribeTransactions(callback, config = {}, options = {}) {
        const subscriptionConfig = {
            ...config,
            table: 'transactions'
        };
        return this.createSubscription('transactions', subscriptionConfig, callback, options);
    }
    async subscribeVerificationRecords(callback, config = {}, options = {}) {
        const subscriptionConfig = {
            ...config,
            table: 'verification_record'
        };
        return this.createSubscription('verification_record', subscriptionConfig, callback, options);
    }
    async subscribeBusinessFeedback(businessId, callback, options = {}) {
        if (!this.canAccessBusiness(businessId)) {
            throw new Error('Cannot subscribe to feedback for different business');
        }
        const authorizedStoreIds = await this.getAuthorizedStoreIds(businessId);
        if (authorizedStoreIds.length === 0) {
            throw new Error('No stores found for business');
        }
        const config = {
            table: 'feedback_sessions',
            filter: `store_id=in.(${authorizedStoreIds.join(',')})`
        };
        return this.createSubscription(`business_feedback_${businessId}`, config, callback, options);
    }
    async subscribeStoreFeedback(storeId, callback, options = {}) {
        if (!await this.canAccessStore(storeId)) {
            throw new Error('Cannot subscribe to feedback for unauthorized store');
        }
        const config = {
            table: 'feedback_sessions',
            filter: `store_id=eq.${storeId}`
        };
        return this.createSubscription(`store_feedback_${storeId}`, config, callback, options);
    }
    async subscribeBusinessTransactions(businessId, callback, options = {}) {
        if (!this.canAccessBusiness(businessId)) {
            throw new Error('Cannot subscribe to transactions for different business');
        }
        const authorizedStoreIds = await this.getAuthorizedStoreIds(businessId);
        if (authorizedStoreIds.length === 0) {
            throw new Error('No stores found for business');
        }
        const config = {
            table: 'transactions',
            filter: `store_id=in.(${authorizedStoreIds.join(',')})`
        };
        return this.createSubscription(`business_transactions_${businessId}`, config, callback, options);
    }
    async subscribeVerificationUpdates(callback, businessId, options = {}) {
        let config = {
            table: 'verification_record'
        };
        if (businessId) {
            if (!this.canAccessBusiness(businessId)) {
                throw new Error('Cannot subscribe to verification records for different business');
            }
            config.filter = `business_id=eq.${businessId}`;
        }
        else if (this.authContext?.business_id && this.authContext.role !== 'admin') {
            config.filter = `business_id=eq.${this.authContext.business_id}`;
        }
        const subscriptionId = businessId
            ? `verification_updates_${businessId}`
            : 'verification_updates_all';
        return this.createSubscription(subscriptionId, config, callback, options);
    }
    async subscribeActiveWorkflows(callback, options = {}) {
        let config = {
            table: 'feedback_sessions',
            filter: `status=in.(initiated,in_progress)`
        };
        if (this.authContext?.business_id && this.authContext.role !== 'admin') {
            const authorizedStoreIds = await this.getAuthorizedStoreIds(this.authContext.business_id);
            config.filter += `,store_id=in.(${authorizedStoreIds.join(',')})`;
        }
        return this.createSubscription('active_workflows', config, callback, options);
    }
    async createSubscription(subscriptionId, config, callback, options = {}) {
        try {
            utils_js_1.dbLogger.debug('Creating realtime subscription', {
                subscriptionId,
                table: config.table,
                filter: config.filter,
                event: config.event
            });
            if (this.subscriptions.has(subscriptionId)) {
                await this.unsubscribe(subscriptionId);
            }
            const channel = this.client.channel(subscriptionId);
            let query = channel.on('postgres_changes', {
                event: config.event || '*',
                schema: 'public',
                table: config.table,
                filter: config.filter
            }, (payload) => {
                try {
                    utils_js_1.dbLogger.debug('Realtime event received', {
                        subscriptionId,
                        eventType: payload.eventType,
                        table: payload.table
                    });
                    if (this.shouldProcessEvent(payload, config)) {
                        callback(payload);
                    }
                }
                catch (error) {
                    utils_js_1.dbLogger.error('Error processing realtime event', error);
                    if (options.onError) {
                        options.onError(error instanceof Error ? error : new Error(String(error)));
                    }
                }
            });
            const subscribeResult = await channel.subscribe((status, error) => {
                if (status === 'SUBSCRIBED') {
                    utils_js_1.dbLogger.info('Realtime subscription established', { subscriptionId });
                    this.reconnectAttempts.set(subscriptionId, 0);
                }
                else if (status === 'CHANNEL_ERROR') {
                    utils_js_1.dbLogger.error('Realtime subscription error', { subscriptionId, error });
                    if (options.onError) {
                        options.onError(new Error(`Subscription error: ${error?.message || 'Unknown error'}`));
                    }
                    if (options.autoReconnect !== false) {
                        this.handleReconnection(subscriptionId, config, callback, options);
                    }
                }
                else if (status === 'CLOSED') {
                    utils_js_1.dbLogger.warn('Realtime subscription closed', { subscriptionId });
                    this.subscriptions.delete(subscriptionId);
                }
            });
            if (subscribeResult === 'ok') {
                this.subscriptions.set(subscriptionId, channel);
                return subscriptionId;
            }
            else {
                throw new Error(`Failed to subscribe: ${subscribeResult}`);
            }
        }
        catch (error) {
            utils_js_1.dbLogger.error('Failed to create realtime subscription', error);
            throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async handleReconnection(subscriptionId, config, callback, options) {
        const maxAttempts = options.maxReconnectAttempts || 5;
        const delay = options.reconnectDelay || 2000;
        const currentAttempts = this.reconnectAttempts.get(subscriptionId) || 0;
        if (currentAttempts >= maxAttempts) {
            utils_js_1.dbLogger.error('Max reconnection attempts reached', { subscriptionId });
            if (options.onError) {
                options.onError(new Error('Max reconnection attempts reached'));
            }
            return;
        }
        this.reconnectAttempts.set(subscriptionId, currentAttempts + 1);
        setTimeout(async () => {
            try {
                utils_js_1.dbLogger.info('Attempting to reconnect subscription', {
                    subscriptionId,
                    attempt: currentAttempts + 1
                });
                await this.createSubscription(subscriptionId, config, callback, options);
            }
            catch (error) {
                utils_js_1.dbLogger.error('Reconnection attempt failed', { subscriptionId, error });
                await this.handleReconnection(subscriptionId, config, callback, options);
            }
        }, delay * Math.pow(2, currentAttempts));
    }
    shouldProcessEvent(payload, config) {
        if (!this.authContext) {
            return true;
        }
        if (this.authContext.role === 'admin') {
            return true;
        }
        if (config.table === 'feedback_sessions' || config.table === 'transactions') {
            const record = payload.new || payload.old;
            if (record && 'store_id' in record) {
                return this.canAccessStoreSync(record.store_id);
            }
        }
        if (config.table === 'verification_record') {
            const record = payload.new || payload.old;
            if (record && 'business_id' in record) {
                return this.canAccessBusiness(record.business_id);
            }
        }
        if (config.table === 'businesses') {
            const record = payload.new || payload.old;
            if (record && 'id' in record) {
                return this.canAccessBusiness(record.id);
            }
        }
        return true;
    }
    async unsubscribe(subscriptionId) {
        try {
            const channel = this.subscriptions.get(subscriptionId);
            if (channel) {
                utils_js_1.dbLogger.debug('Unsubscribing from realtime channel', { subscriptionId });
                await this.client.removeChannel(channel);
                this.subscriptions.delete(subscriptionId);
                this.reconnectAttempts.delete(subscriptionId);
                utils_js_1.dbLogger.info('Unsubscribed from realtime channel', { subscriptionId });
            }
        }
        catch (error) {
            utils_js_1.dbLogger.error('Error unsubscribing from channel', { subscriptionId, error });
            throw new Error(`Failed to unsubscribe: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async unsubscribeAll() {
        try {
            utils_js_1.dbLogger.debug('Unsubscribing from all realtime channels');
            const subscriptionIds = Array.from(this.subscriptions.keys());
            await Promise.all(subscriptionIds.map(id => this.unsubscribe(id)));
            utils_js_1.dbLogger.info('Unsubscribed from all realtime channels');
        }
        catch (error) {
            utils_js_1.dbLogger.error('Error unsubscribing from all channels', error);
            throw error;
        }
    }
    getActiveSubscriptions() {
        return Array.from(this.subscriptions.keys());
    }
    isSubscribed(subscriptionId) {
        return this.subscriptions.has(subscriptionId);
    }
    getSubscriptionStatus(subscriptionId) {
        const channel = this.subscriptions.get(subscriptionId);
        return channel ? channel.state : null;
    }
    async reconnectAllSubscriptions() {
        try {
            utils_js_1.dbLogger.info('Reconnecting all subscriptions');
            for (const [subscriptionId, channel] of this.subscriptions) {
                try {
                    await channel.unsubscribe();
                    await channel.subscribe();
                }
                catch (error) {
                    utils_js_1.dbLogger.error('Failed to reconnect subscription', { subscriptionId, error });
                }
            }
        }
        catch (error) {
            utils_js_1.dbLogger.error('Error reconnecting all subscriptions', error);
            throw error;
        }
    }
    canAccessBusiness(businessId) {
        if (!this.authContext) {
            return false;
        }
        if (this.authContext.role === 'admin') {
            return true;
        }
        return this.authContext.business_id === businessId;
    }
    async canAccessStore(storeId) {
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
        }
        catch {
            return false;
        }
    }
    canAccessStoreSync(storeId) {
        return true;
    }
    async getAuthorizedStoreIds(businessId) {
        try {
            const { data: stores, error } = await this.client
                .from('stores')
                .select('id')
                .eq('business_id', businessId);
            if (error) {
                utils_js_1.dbLogger.error('Failed to get authorized store IDs', error);
                return [];
            }
            return stores?.map(store => store.id) || [];
        }
        catch (error) {
            utils_js_1.dbLogger.error('Error getting authorized store IDs', error);
            return [];
        }
    }
    async createBusinessFilter(businessId) {
        if (!businessId) {
            if (this.authContext?.business_id && this.authContext.role !== 'admin') {
                businessId = this.authContext.business_id;
            }
            else {
                return undefined;
            }
        }
        const storeIds = await this.getAuthorizedStoreIds(businessId);
        return storeIds.length > 0 ? `store_id=in.(${storeIds.join(',')})` : undefined;
    }
    async subscribeWithBusinessFilter(table, callback, businessId, additionalFilter, options = {}) {
        const businessFilter = await this.createBusinessFilter(businessId);
        let filter = businessFilter;
        if (additionalFilter) {
            filter = filter ? `${filter},${additionalFilter}` : additionalFilter;
        }
        const config = {
            table,
            filter
        };
        const subscriptionId = `${table}_${businessId || 'all'}_${Date.now()}`;
        return this.createSubscription(subscriptionId, config, callback, options);
    }
}
exports.RealtimeSubscriptionManager = RealtimeSubscriptionManager;
function createRealtimeSubscriptionManager(client) {
    return new RealtimeSubscriptionManager(client);
}
//# sourceMappingURL=subscription-manager.js.map