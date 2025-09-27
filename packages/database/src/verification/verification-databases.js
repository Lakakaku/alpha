"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationDatabaseModel = void 0;
class VerificationDatabaseModel {
    supabase;
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }
    async create(data) {
        const { data: database, error } = await this.supabase
            .from('verification_databases')
            .insert({
            cycle_id: data.cycle_id,
            store_id: data.store_id,
            business_id: data.business_id,
            deadline_at: data.deadline_at,
            transaction_count: data.transaction_count || 0,
            status: 'preparing',
            verified_count: 0,
            fake_count: 0,
            unverified_count: data.transaction_count || 0
        })
            .select()
            .single();
        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error('Verification database for this cycle and store already exists');
            }
            throw new Error(`Failed to create verification database: ${error.message}`);
        }
        return database;
    }
    async findById(id) {
        const { data, error } = await this.supabase
            .from('verification_databases')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to find verification database: ${error.message}`);
        }
        return data;
    }
    async findByCycle(cycle_id) {
        const { data, error } = await this.supabase
            .from('verification_databases')
            .select('*')
            .eq('cycle_id', cycle_id)
            .order('created_at', { ascending: true });
        if (error) {
            throw new Error(`Failed to find verification databases for cycle: ${error.message}`);
        }
        return data || [];
    }
    async findByBusiness(business_id, options = {}) {
        let query = this.supabase
            .from('verification_databases')
            .select(`
        *,
        stores:store_id (
          name,
          address,
          city
        ),
        weekly_verification_cycles:cycle_id (
          cycle_week,
          status
        )
      `)
            .eq('business_id', business_id);
        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.cycle_week) {
            query = query.eq('weekly_verification_cycles.cycle_week', options.cycle_week);
        }
        const { data, error } = await query
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to find verification databases for business: ${error.message}`);
        }
        return data || [];
    }
    async updateStatus(id, status, submitted_at) {
        const updateData = { status };
        if (submitted_at) {
            updateData.submitted_at = submitted_at;
        }
        const { data, error } = await this.supabase
            .from('verification_databases')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update verification database status: ${error.message}`);
        }
        return data;
    }
    async updateFileUrls(id, fileUrls) {
        const { data, error } = await this.supabase
            .from('verification_databases')
            .update(fileUrls)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update verification database file URLs: ${error.message}`);
        }
        return data;
    }
    async updateVerificationCounts(id, counts) {
        const { data, error } = await this.supabase
            .from('verification_databases')
            .update(counts)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update verification counts: ${error.message}`);
        }
        return data;
    }
    async markAsReady(id) {
        return this.updateStatus(id, 'ready');
    }
    async markAsDownloaded(id) {
        return this.updateStatus(id, 'downloaded');
    }
    async markAsSubmitted(id) {
        return this.updateStatus(id, 'submitted', new Date().toISOString());
    }
    async markAsProcessed(id) {
        return this.updateStatus(id, 'processed');
    }
    async markAsExpired(id) {
        return this.updateStatus(id, 'expired');
    }
    async checkAndExpireOverdue() {
        const now = new Date().toISOString();
        const { data, error } = await this.supabase
            .from('verification_databases')
            .update({ status: 'expired' })
            .lt('deadline_at', now)
            .in('status', ['ready', 'downloaded'])
            .select('id');
        if (error) {
            throw new Error(`Failed to expire overdue verification databases: ${error.message}`);
        }
        return data?.length || 0;
    }
    async getBusinessSummary(business_id) {
        const { data, error } = await this.supabase
            .from('verification_databases')
            .select('status, deadline_at')
            .eq('business_id', business_id);
        if (error) {
            throw new Error(`Failed to get business verification summary: ${error.message}`);
        }
        const now = new Date();
        const summary = {
            total_databases: data?.length || 0,
            ready_databases: 0,
            submitted_databases: 0,
            expired_databases: 0,
            overdue_databases: 0
        };
        data?.forEach(db => {
            switch (db.status) {
                case 'ready':
                case 'downloaded':
                    summary.ready_databases++;
                    if (new Date(db.deadline_at) < now) {
                        summary.overdue_databases++;
                    }
                    break;
                case 'submitted':
                case 'processed':
                    summary.submitted_databases++;
                    break;
                case 'expired':
                    summary.expired_databases++;
                    break;
            }
        });
        return summary;
    }
    async delete(id) {
        const { error } = await this.supabase
            .from('verification_databases')
            .delete()
            .eq('id', id);
        if (error) {
            throw new Error(`Failed to delete verification database: ${error.message}`);
        }
    }
    async getDeadlineRemaining(id) {
        const database = await this.findById(id);
        if (!database) {
            throw new Error('Verification database not found');
        }
        const deadline = new Date(database.deadline_at);
        const now = new Date();
        const remainingMs = deadline.getTime() - now.getTime();
        return Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))); // Hours remaining
    }
}
exports.VerificationDatabaseModel = VerificationDatabaseModel;
//# sourceMappingURL=verification-databases.js.map