"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationRecordModel = void 0;
const supabase_1 = require("../client/supabase");
class VerificationRecordModel {
    static getSupabaseClient() {
        return supabase_1.SupabaseClientManager.getInstance().getClient();
    }
    /**
     * Create a new verification record
     */
    static async create(data) {
        const { data: record, error } = await this.getSupabaseClient()
            .from('verification_records')
            .insert({
            verification_database_id: data.verification_database_id,
            phone_number: data.phone_number,
            amount: data.amount,
            transaction_date: data.transaction_date,
            store_context: data.store_context,
            original_transaction_id: data.original_transaction_id,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create verification record: ${error.message}`);
        }
        return record;
    }
    /**
     * Get verification records by database ID
     */
    static async getByDatabaseId(databaseId, options = {}) {
        let query = supabase
            .from('verification_records')
            .select('*')
            .eq('verification_database_id', databaseId)
            .order('created_at', { ascending: false });
        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }
        if (options.offset) {
            query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1);
        }
        const { data: records, error } = await query;
        if (error) {
            throw new Error(`Failed to get verification records: ${error.message}`);
        }
        return records || [];
    }
    /**
     * Get verification record by ID
     */
    static async getById(id) {
        const { data: record, error } = await this.getSupabaseClient()
            .from('verification_records')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Record not found
            }
            throw new Error(`Failed to get verification record: ${error.message}`);
        }
        return record;
    }
    /**
     * Update verification record status
     */
    static async updateStatus(id, status, verificationDetails) {
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        if (verificationDetails) {
            updateData.verification_details = verificationDetails;
        }
        if (status === 'verified') {
            updateData.verified_at = new Date().toISOString();
        }
        const { data: record, error } = await this.getSupabaseClient()
            .from('verification_records')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update verification record: ${error.message}`);
        }
        return record;
    }
    /**
     * Bulk update verification records
     */
    static async bulkUpdateStatus(ids, status, verificationDetails) {
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        if (verificationDetails) {
            updateData.verification_details = verificationDetails;
        }
        if (status === 'verified') {
            updateData.verified_at = new Date().toISOString();
        }
        const { data: records, error } = await this.getSupabaseClient()
            .from('verification_records')
            .update(updateData)
            .in('id', ids)
            .select();
        if (error) {
            throw new Error(`Failed to bulk update verification records: ${error.message}`);
        }
        return records || [];
    }
    /**
     * Get verification statistics for a database
     */
    static async getStatistics(databaseId) {
        const { data: stats, error } = await this.getSupabaseClient()
            .from('verification_records')
            .select('status')
            .eq('verification_database_id', databaseId);
        if (error) {
            throw new Error(`Failed to get verification statistics: ${error.message}`);
        }
        const counts = {
            total: 0,
            pending: 0,
            verified: 0,
            rejected: 0,
            expired: 0
        };
        stats?.forEach(record => {
            counts.total++;
            counts[record.status]++;
        });
        return counts;
    }
    /**
     * Get records by phone number across databases
     */
    static async getByPhoneNumber(phoneNumber) {
        const { data: records, error } = await this.getSupabaseClient()
            .from('verification_records')
            .select('*')
            .eq('phone_number', phoneNumber)
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to get records by phone number: ${error.message}`);
        }
        return records || [];
    }
    /**
     * Delete verification record
     */
    static async delete(id) {
        const { error } = await this.getSupabaseClient()
            .from('verification_records')
            .delete()
            .eq('id', id);
        if (error) {
            throw new Error(`Failed to delete verification record: ${error.message}`);
        }
    }
    /**
     * Get expired records that need status update
     */
    static async getExpiredRecords(cutoffDate) {
        const { data: records, error } = await this.getSupabaseClient()
            .from('verification_records')
            .select('*')
            .eq('status', 'pending')
            .lt('created_at', cutoffDate.toISOString());
        if (error) {
            throw new Error(`Failed to get expired records: ${error.message}`);
        }
        return records || [];
    }
}
exports.VerificationRecordModel = VerificationRecordModel;
//# sourceMappingURL=verification-records.js.map