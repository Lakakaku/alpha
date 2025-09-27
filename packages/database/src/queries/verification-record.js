"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationRecordQueries = void 0;
exports.createVerificationRecordQueries = createVerificationRecordQueries;
const utils_js_1 = require("../client/utils.js");
class VerificationRecordQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data, authContext) {
        try {
            utils_js_1.dbLogger.debug('Creating verification record', {
                business_id: data.business_id,
                week_identifier: data.week_identifier
            });
            if (authContext?.business_id && authContext.business_id !== data.business_id) {
                throw new Error('Cannot create verification record for different business');
            }
            if (!this.isValidWeekIdentifier(data.week_identifier)) {
                throw new Error('Invalid week identifier format. Expected YYYY-WNN (e.g., 2023-W42)');
            }
            await this.validateBusinessExists(data.business_id);
            const { data: verificationRecord, error } = await this.client
                .from('verification_record')
                .insert(data)
                .select()
                .single();
            if (error) {
                utils_js_1.dbLogger.error('Failed to create verification record', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Verification record created successfully', {
                id: verificationRecord.id,
                week_identifier: verificationRecord.week_identifier,
                status: verificationRecord.status
            });
            return verificationRecord;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to create verification record');
        }
    }
    async findById(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding verification record by ID', { id });
            const query = this.client
                .from('verification_record')
                .select('*')
                .eq('id', id);
            if (authContext?.business_id && authContext.role !== 'admin') {
                query.eq('business_id', authContext.business_id);
            }
            const { data: verificationRecord, error } = await query.single();
            if (error) {
                if (error.code === 'PGRST116') {
                    utils_js_1.dbLogger.debug('Verification record not found', { id });
                    return null;
                }
                utils_js_1.dbLogger.error('Failed to find verification record by ID', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return verificationRecord;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find verification record');
        }
    }
    async findByBusinessAndWeek(businessId, weekIdentifier, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding verification record by business and week', { businessId, weekIdentifier });
            if (authContext?.business_id && authContext.business_id !== businessId && authContext.role !== 'admin') {
                throw new Error('Cannot access verification record for different business');
            }
            const { data: verificationRecord, error } = await this.client
                .from('verification_record')
                .select('*')
                .eq('business_id', businessId)
                .eq('week_identifier', weekIdentifier)
                .maybeSingle();
            if (error) {
                utils_js_1.dbLogger.error('Failed to find verification record by business and week', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return verificationRecord;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find verification record by business and week');
        }
    }
    async findByBusinessId(businessId, pagination = { page: 1, limit: 50 }, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding verification records by business ID', { businessId });
            if (authContext?.business_id && authContext.business_id !== businessId && authContext.role !== 'admin') {
                throw new Error('Cannot access verification records for different business');
            }
            const { page, limit, order_by = 'week_identifier', order_direction = 'desc' } = pagination;
            const offset = (page - 1) * limit;
            const query = this.client
                .from('verification_record')
                .select('*', { count: 'exact' })
                .eq('business_id', businessId)
                .order(order_by, { ascending: order_direction === 'asc' })
                .range(offset, offset + limit - 1);
            const { data: verificationRecords, error, count } = await query;
            if (error) {
                utils_js_1.dbLogger.error('Failed to find verification records by business ID', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            const totalCount = count || 0;
            const totalPages = Math.ceil(totalCount / limit);
            return {
                data: verificationRecords || [],
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
            throw new Error('Failed to find verification records by business ID');
        }
    }
    async findByStatus(status, pagination = { page: 1, limit: 50 }, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding verification records by status', { status });
            const { page, limit, order_by = 'created_at', order_direction = 'asc' } = pagination;
            const offset = (page - 1) * limit;
            let query = this.client
                .from('verification_record')
                .select('*', { count: 'exact' })
                .eq('status', status);
            if (authContext?.business_id && authContext.role !== 'admin') {
                query = query.eq('business_id', authContext.business_id);
            }
            query = query
                .order(order_by, { ascending: order_direction === 'asc' })
                .range(offset, offset + limit - 1);
            const { data: verificationRecords, error, count } = await query;
            if (error) {
                utils_js_1.dbLogger.error('Failed to find verification records by status', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            const totalCount = count || 0;
            const totalPages = Math.ceil(totalCount / limit);
            return {
                data: verificationRecords || [],
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
            throw new Error('Failed to find verification records by status');
        }
    }
    async findWithBusiness(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Finding verification record with business', { id });
            const query = this.client
                .from('verification_record')
                .select(`
          *,
          business:businesses(*)
        `)
                .eq('id', id);
            if (authContext?.business_id && authContext.role !== 'admin') {
                query.eq('business_id', authContext.business_id);
            }
            const { data: verificationRecord, error } = await query.single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                utils_js_1.dbLogger.error('Failed to find verification record with business', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            return verificationRecord;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find verification record with business');
        }
    }
    async update(id, data, authContext) {
        try {
            utils_js_1.dbLogger.debug('Updating verification record', { id, fields: Object.keys(data) });
            const query = this.client
                .from('verification_record')
                .update(data)
                .eq('id', id);
            if (authContext?.business_id && authContext.role !== 'admin') {
                query.eq('business_id', authContext.business_id);
            }
            const { data: verificationRecord, error } = await query.select().single();
            if (error) {
                utils_js_1.dbLogger.error('Failed to update verification record', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Verification record updated successfully', {
                id,
                status: verificationRecord.status,
                week_identifier: verificationRecord.week_identifier
            });
            return verificationRecord;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to update verification record');
        }
    }
    async submitForVerification(id, submissionData, authContext) {
        try {
            utils_js_1.dbLogger.debug('Submitting verification record', { id });
            const verificationRecord = await this.findById(id, authContext);
            if (!verificationRecord) {
                throw new Error('Verification record not found');
            }
            if (verificationRecord.status !== 'pending') {
                throw new Error('Verification record must be in pending status to submit');
            }
            const updateData = {
                status: 'submitted',
                submitted_at: submissionData.submitted_at || new Date().toISOString(),
                transaction_summary: {
                    ...verificationRecord.transaction_summary,
                    submission_data: submissionData,
                    submitted_by: authContext?.user_id,
                    submission_timestamp: new Date().toISOString()
                }
            };
            return await this.update(id, updateData, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to submit verification record');
        }
    }
    async completeVerification(id, adminNotes, authContext) {
        try {
            utils_js_1.dbLogger.debug('Completing verification record', { id });
            if (authContext?.role !== 'admin') {
                throw new Error('Only admin users can complete verification records');
            }
            const verificationRecord = await this.findById(id, authContext);
            if (!verificationRecord) {
                throw new Error('Verification record not found');
            }
            if (verificationRecord.status !== 'submitted') {
                throw new Error('Verification record must be in submitted status to complete');
            }
            const updateData = {
                status: 'completed',
                verified_at: new Date().toISOString(),
                transaction_summary: {
                    ...verificationRecord.transaction_summary,
                    admin_verification: {
                        verified_by: authContext.user_id,
                        verified_at: new Date().toISOString(),
                        admin_notes: adminNotes || '',
                        verification_result: 'approved'
                    }
                }
            };
            return await this.update(id, updateData, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to complete verification record');
        }
    }
    async generateWeeklyVerificationData(businessId, weekIdentifier, authContext) {
        try {
            utils_js_1.dbLogger.debug('Generating weekly verification data', { businessId, weekIdentifier });
            if (authContext?.business_id && authContext.business_id !== businessId && authContext.role !== 'admin') {
                throw new Error('Cannot generate verification data for different business');
            }
            const weekRange = this.parseWeekIdentifier(weekIdentifier);
            const { data: transactions, error: transactionsError } = await this.client
                .from('transactions')
                .select(`
          id,
          customer_time_range,
          customer_amount_range,
          store_id,
          feedback_sessions!inner(quality_grade, reward_percentage)
        `)
                .in('store_id', this.buildAuthorizedStoreIds(businessId))
                .gte('created_at', weekRange.start)
                .lt('created_at', weekRange.end);
            if (transactionsError) {
                throw (0, utils_js_1.formatDatabaseError)(transactionsError);
            }
            const { data: feedbackSessions, error: feedbackError } = await this.client
                .from('feedback_sessions')
                .select('*')
                .in('store_id', this.buildAuthorizedStoreIds(businessId))
                .gte('created_at', weekRange.start)
                .lt('created_at', weekRange.end);
            if (feedbackError) {
                throw (0, utils_js_1.formatDatabaseError)(feedbackError);
            }
            const verificationData = {
                week_identifier: weekIdentifier,
                business_id: businessId,
                transactions: (transactions || []).map(t => ({
                    transaction_id: t.id,
                    customer_time_range: t.customer_time_range,
                    customer_amount_range: t.customer_amount_range,
                    feedback_quality_grade: Array.isArray(t.feedback_sessions) && t.feedback_sessions.length > 0
                        ? t.feedback_sessions[0].quality_grade
                        : null,
                    reward_percentage: Array.isArray(t.feedback_sessions) && t.feedback_sessions.length > 0
                        ? t.feedback_sessions[0].reward_percentage
                        : null
                })),
                total_feedback_sessions: feedbackSessions?.length || 0,
                total_rewards_sek: (feedbackSessions || [])
                    .filter(fs => fs.reward_percentage && fs.status === 'completed')
                    .reduce((sum, fs) => sum + (fs.reward_percentage || 0), 0)
            };
            return verificationData;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to generate weekly verification data');
        }
    }
    async createWeeklyRecord(businessId, weekIdentifier, authContext) {
        try {
            const existingRecord = await this.findByBusinessAndWeek(businessId, weekIdentifier, authContext);
            if (existingRecord) {
                throw new Error('Verification record already exists for this business and week');
            }
            const verificationData = await this.generateWeeklyVerificationData(businessId, weekIdentifier, authContext);
            const recordData = {
                business_id: businessId,
                week_identifier: weekIdentifier,
                status: 'pending',
                transaction_summary: {
                    generated_at: new Date().toISOString(),
                    week_data: verificationData,
                    transaction_count: verificationData.transactions.length,
                    feedback_session_count: verificationData.total_feedback_sessions,
                    total_rewards: verificationData.total_rewards_sek
                }
            };
            return await this.create(recordData, authContext);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to create weekly record');
        }
    }
    async delete(id, authContext) {
        try {
            utils_js_1.dbLogger.debug('Deleting verification record', { id });
            if (authContext?.role !== 'admin') {
                throw new Error('Only admin users can delete verification records');
            }
            const { error } = await this.client
                .from('verification_record')
                .delete()
                .eq('id', id);
            if (error) {
                utils_js_1.dbLogger.error('Failed to delete verification record', error);
                throw (0, utils_js_1.formatDatabaseError)(error);
            }
            utils_js_1.dbLogger.info('Verification record deleted successfully', { id });
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to delete verification record');
        }
    }
    async exists(businessId, weekIdentifier, authContext) {
        try {
            const verificationRecord = await this.findByBusinessAndWeek(businessId, weekIdentifier, authContext);
            return verificationRecord !== null;
        }
        catch {
            return false;
        }
    }
    async count(businessId, status, authContext) {
        try {
            let query = this.client
                .from('verification_record')
                .select('*', { count: 'exact', head: true });
            if (businessId) {
                query = query.eq('business_id', businessId);
            }
            if (status) {
                query = query.eq('status', status);
            }
            if (authContext?.business_id && authContext.role !== 'admin') {
                query = query.eq('business_id', authContext.business_id);
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
            throw new Error('Failed to count verification records');
        }
    }
    async getNextWeekIdentifier(currentWeek) {
        const [year, week] = currentWeek.split('-W').map(Number);
        if (week >= 52) {
            return `${year + 1}-W01`;
        }
        return `${year}-W${String(week + 1).padStart(2, '0')}`;
    }
    async getPreviousWeekIdentifier(currentWeek) {
        const [year, week] = currentWeek.split('-W').map(Number);
        if (week <= 1) {
            return `${year - 1}-W52`;
        }
        return `${year}-W${String(week - 1).padStart(2, '0')}`;
    }
    isValidWeekIdentifier(weekIdentifier) {
        const weekPattern = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-2])$/;
        return weekPattern.test(weekIdentifier);
    }
    parseWeekIdentifier(weekIdentifier) {
        const [year, week] = weekIdentifier.split('-W').map(Number);
        const jan1 = new Date(year, 0, 1);
        const weekStart = new Date(jan1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
        const startOfWeek = new Date(weekStart);
        startOfWeek.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return {
            start: startOfWeek.toISOString(),
            end: endOfWeek.toISOString()
        };
    }
    async validateBusinessExists(businessId) {
        const { data: business, error } = await this.client
            .from('businesses')
            .select('id')
            .eq('id', businessId)
            .single();
        if (error || !business) {
            throw new Error('Business not found');
        }
    }
    buildAuthorizedStoreIds(businessId) {
        return this.client
            .from('stores')
            .select('id')
            .eq('business_id', businessId)
            .then(({ data }) => data?.map(store => store.id) || []);
    }
    async findPendingSubmissions(authContext) {
        try {
            return (await this.findByStatus('pending', { page: 1, limit: 100 }, authContext)).data;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find pending submissions');
        }
    }
    async findSubmittedRecords(authContext) {
        try {
            return (await this.findByStatus('submitted', { page: 1, limit: 100 }, authContext)).data;
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                throw error;
            }
            throw new Error('Failed to find submitted records');
        }
    }
    async getCurrentWeekIdentifier() {
        const now = new Date();
        const year = now.getFullYear();
        const jan1 = new Date(year, 0, 1);
        const weekNumber = Math.ceil((((now.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
        return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }
}
exports.VerificationRecordQueries = VerificationRecordQueries;
function createVerificationRecordQueries(client) {
    return new VerificationRecordQueries(client);
}
//# sourceMappingURL=verification-record.js.map