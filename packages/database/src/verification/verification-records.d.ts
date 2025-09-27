import type { VerificationRecord, VerificationStatus } from '@vocilia/types/verification';
export declare class VerificationRecordModel {
    private static getSupabaseClient;
    /**
     * Create a new verification record
     */
    static create(data: {
        verification_database_id: string;
        phone_number: string;
        amount: number;
        transaction_date: string;
        store_context: Record<string, any>;
        original_transaction_id: string;
    }): Promise<VerificationRecord>;
    /**
     * Get verification records by database ID
     */
    static getByDatabaseId(databaseId: string, options?: {
        status?: VerificationStatus;
        limit?: number;
        offset?: number;
    }): Promise<VerificationRecord[]>;
    /**
     * Get verification record by ID
     */
    static getById(id: string): Promise<VerificationRecord | null>;
    /**
     * Update verification record status
     */
    static updateStatus(id: string, status: VerificationStatus, verificationDetails?: Record<string, any>): Promise<VerificationRecord>;
    /**
     * Bulk update verification records
     */
    static bulkUpdateStatus(ids: string[], status: VerificationStatus, verificationDetails?: Record<string, any>): Promise<VerificationRecord[]>;
    /**
     * Get verification statistics for a database
     */
    static getStatistics(databaseId: string): Promise<{
        total: number;
        pending: number;
        verified: number;
        rejected: number;
        expired: number;
    }>;
    /**
     * Get records by phone number across databases
     */
    static getByPhoneNumber(phoneNumber: string): Promise<VerificationRecord[]>;
    /**
     * Delete verification record
     */
    static delete(id: string): Promise<void>;
    /**
     * Get expired records that need status update
     */
    static getExpiredRecords(cutoffDate: Date): Promise<VerificationRecord[]>;
}
//# sourceMappingURL=verification-records.d.ts.map