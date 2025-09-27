"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackSessionQueries = void 0;
exports.createFeedbackSessionQueries = createFeedbackSessionQueries;
const utils_js_1 = require("../client/utils.js");
class FeedbackSessionQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data, authContext) {
        try {
            utils_js_1.dbLogger.debug('Creating feedback session', { store_id: data.store_id, transaction_id: data.transaction_id });
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
                utils_js_1.dbLogger.error('Failed to create feedback session', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Feedback session created successfully', {
                id: feedbackSession.id,
                store_id: feedbackSession.store_id,
                status: feedbackSession.status
            });
            return feedbackSession;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to create feedback session');
        }
    }
    async findById(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding feedback session by ID', { id });
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
                    utils_js_1.dbLogger.debug('Feedback session not found', { id });
                    return null;
                }
                utils_js_1.dbLogger.error('Failed to find feedback session by ID', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return feedbackSession;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find feedback session');
        }
    }
    async findByTransactionId(transactionId, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding feedback session by transaction ID', { transactionId });
            await this.validateTransactionAccess(transactionId, authContext);
            const { data: feedbackSession, error } = await this.client
                .from('feedback_sessions')
                .select('*')
                .eq('transaction_id', transactionId)
                .maybeSingle();
            if (error) {
                utils_js_1.dbLogger.error('Failed to find feedback session by transaction ID', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return feedbackSession;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find feedback session by transaction ID');
        }
    }
    async findByStoreId(storeId, filters = {}, pagination = { page: 1, limit: 50 }, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding feedback sessions by store ID', { storeId });
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
                utils_js_1.dbLogger.error('Failed to find feedback sessions by store ID', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
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
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find feedback sessions by store ID');
        }
    }
    async findWithTransaction(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding feedback session with transaction', { id });
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
                utils_js_1.dbLogger.error('Failed to find feedback session with transaction', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return feedbackSession;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find feedback session with transaction');
        }
    }
    async findWithStore(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding feedback session with store', { id });
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
                utils_js_1.dbLogger.error('Failed to find feedback session with store', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return feedbackSession;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find feedback session with store');
        }
    }
    async findByStatus(status, storeId, pagination = { page: 1, limit: 50 }, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding feedback sessions by status', { status, storeId });
            const { page, limit, order_by = 'created_at', order_direction = 'asc' } = pagination;
            const offset = (page - 1) * limit;
            let query = this.client
                .from('feedback_sessions')
                .select('*', { count: 'exact' })
                .eq('status', status);
            if (storeId) {
                await this.validateStoreAccess(storeId, authContext);
                query = query.eq('store_id', storeId);
            }
            else if (authContext?.business_id && authContext.role !== 'admin') {
                query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
            }
            query = query
                .order(order_by, { ascending: order_direction === 'asc' })
                .range(offset, offset + limit - 1);
            const { data: feedbackSessions, error, count } = await query;
            if (error) {
                utils_js_1.dbLogger.error('Failed to find feedback sessions by status', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
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
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find feedback sessions by status');
        }
    }
    async update(id, data, authContext) {
        try {
            utils_js_1.dbLogger.debug('Updating feedback session', { id, fields: Object.keys(data) });
            const query = this.client
                .from('feedback_sessions')
                .update(data)
                .eq('id', id);
            if (authContext?.business_id && authContext.role !== 'admin') {
                query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
            }
            const { data: feedbackSession, error } = await query.select().single();
            if (error) {
                utils_js_1.dbLogger.error('Failed to update feedback session', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Feedback session updated successfully', { id, status: feedbackSession.status });
            return feedbackSession;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update feedback session');
        }
    }
    async updateStatus(id, status, authContext) {
        try {
            const updateData = { status };
            if (status === 'in_progress' && !await this.hasCallStartTime(id)) {
                updateData.call_started_at = new Date().toISOString();
            }
            else if (status === 'completed' || status === 'failed') {
                updateData.call_completed_at = new Date().toISOString();
            }
            return await this.update(id, updateData, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update feedback session status');
        }
    }
    async completeSession(id, qualityGrade, rewardPercentage, feedbackSummary, authContext) {
        try {
            utils_js_1.dbLogger.debug('Completing feedback session', { id, qualityGrade, rewardPercentage });
            if (qualityGrade < 1 || qualityGrade > 10) {
                throw new Error('Quality grade must be between 1 and 10');
            }
            if (rewardPercentage < 2.0 || rewardPercentage > 15.0) {
                throw new Error('Reward percentage must be between 2.0% and 15.0%');
            }
            const updateData = {
                status: 'completed',
                quality_grade: qualityGrade,
                reward_percentage: rewardPercentage,
                feedback_summary: feedbackSummary,
                call_completed_at: new Date().toISOString()
            };
            return await this.update(id, updateData, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to complete feedback session');
        }
    }
    async failSession(id, reason, authContext) {
        try {
            utils_js_1.dbLogger.debug('Failing feedback session', { id, reason });
            const updateData = {
                status: 'failed',
                feedback_summary: { failure_reason: reason, failed_at: new Date().toISOString() },
                call_completed_at: new Date().toISOString()
            };
            return await this.update(id, updateData, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to fail feedback session');
        }
    }
    async delete(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Deleting feedback session', { id });
            const query = this.client
                .from('feedback_sessions')
                .delete()
                .eq('id', id);
            if (authContext?.business_id && authContext.role !== 'admin') {
                query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
            }
            const { error } = await query;
            if (error) {
                utils_js_1.dbLogger.error('Failed to delete feedback session', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Feedback session deleted successfully', { id });
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to delete feedback session');
        }
    }
    async getSessionMetrics(storeId, dateRange, authContext) {
        try {
            let query = this.client
                .from('feedback_sessions')
                .select('status, quality_grade, reward_percentage');
            if (storeId) {
                await this.validateStoreAccess(storeId, authContext);
                query = query.eq('store_id', storeId);
            }
            else if (authContext?.business_id && authContext.role !== 'admin') {
                query = query.in('store_id', this.buildAuthorizedStoreIds(authContext.business_id));
            }
            if (dateRange) {
                query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
            }
            const { data: sessions, error } = await query;
            if (error) {
                throw (0, utils_js_1.formatDatabaseError)(error);
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
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to get session metrics');
        }
    }
    async exists(id, authContext) {
        try {
            const feedbackSession = await this.findById(id, authContext);
            return feedbackSession !== null;
        }
        catch {
            return false;
        }
    }
    async count(storeId, status, authContext) {
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
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return count || 0;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to count feedback sessions');
        }
    }
    async validateStoreAccess(storeId, authContext) {
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
    async validateTransactionAccess(transactionId, authContext) {
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
    buildAuthorizedStoreIds(businessId) {
        return this.client
            .from('stores')
            .select('id')
            .eq('business_id', businessId)
            .then(({ data }) => data?.map(store => store.id) || []);
    }
    async hashPhoneNumber(phoneNumber) {
        if (phoneNumber.startsWith('hash_')) {
            return phoneNumber;
        }
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        return `hash_${crypto.createHash('sha256').update(phoneNumber).digest('hex')}`;
    }
    async hasCallStartTime(id) {
        try {
            const { data, error } = await this.client
                .from('feedback_sessions')
                .select('call_started_at')
                .eq('id', id)
                .single();
            return !error && data?.call_started_at !== null;
        }
        catch {
            return false;
        }
    }
    async findActiveSessions(authContext) {
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
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return sessions || [];
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find active sessions');
        }
    }
    async findSessionsRequiringAttention(authContext) {
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
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return sessions || [];
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find sessions requiring attention');
        }
    }
}
exports.FeedbackSessionQueries = FeedbackSessionQueries;
function createFeedbackSessionQueries(client) {
    return new FeedbackSessionQueries(client);
}
//# sourceMappingURL=feedback-session.js.map