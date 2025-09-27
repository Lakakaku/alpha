import { createClient } from '@supabase/supabase-js';
import { VerificationDatabase, VerificationDbStatus } from '@vocilia/types/verification';
export declare class VerificationDatabaseModel {
    private supabase;
    constructor(supabaseClient: ReturnType<typeof createClient>);
    create(data: {
        cycle_id: string;
        store_id: string;
        business_id: string;
        deadline_at: string;
        transaction_count?: number;
    }): Promise<VerificationDatabase>;
    findById(id: string): Promise<VerificationDatabase | null>;
    findByCycle(cycle_id: string): Promise<VerificationDatabase[]>;
    findByBusiness(business_id: string, options?: {
        status?: VerificationDbStatus;
        cycle_week?: string;
    }): Promise<VerificationDatabase[]>;
    updateStatus(id: string, status: VerificationDbStatus, submitted_at?: string): Promise<VerificationDatabase>;
    updateFileUrls(id: string, fileUrls: {
        csv_file_url?: string;
        excel_file_url?: string;
        json_file_url?: string;
    }): Promise<VerificationDatabase>;
    updateVerificationCounts(id: string, counts: {
        verified_count: number;
        fake_count: number;
        unverified_count: number;
    }): Promise<VerificationDatabase>;
    markAsReady(id: string): Promise<VerificationDatabase>;
    markAsDownloaded(id: string): Promise<VerificationDatabase>;
    markAsSubmitted(id: string): Promise<VerificationDatabase>;
    markAsProcessed(id: string): Promise<VerificationDatabase>;
    markAsExpired(id: string): Promise<VerificationDatabase>;
    checkAndExpireOverdue(): Promise<number>;
    getBusinessSummary(business_id: string): Promise<{
        total_databases: number;
        ready_databases: number;
        submitted_databases: number;
        expired_databases: number;
        overdue_databases: number;
    }>;
    delete(id: string): Promise<void>;
    getDeadlineRemaining(id: string): Promise<number>;
}
//# sourceMappingURL=verification-databases.d.ts.map