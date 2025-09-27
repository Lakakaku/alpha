import type { CustomerRewardBatch } from '@vocilia/types/verification';
export declare class CustomerRewardBatchModel {
    private static getSupabaseClient;
    /**
     * Create a new customer reward batch
     */
    static create(data: {
        weekly_verification_cycle_id: string;
        business_id: string;
        total_customers: number;
        total_reward_amount: number;
        batch_data: Record<string, any>;
        export_formats: string[];
    }): Promise<CustomerRewardBatch>;
    /**
     * Get customer reward batches by cycle ID
     */
    static getByCycleId(cycleId: string, options?: {
        status?: 'pending' | 'generated' | 'delivered' | 'failed';
        limit?: number;
        offset?: number;
    }): Promise<CustomerRewardBatch[]>;
    /**
     * Get customer reward batch by ID
     */
    static getById(id: string): Promise<CustomerRewardBatch | null>;
    /**
     * Get batches by business ID
     */
    static getByBusinessId(businessId: string, options?: {
        status?: 'pending' | 'generated' | 'delivered' | 'failed';
        limit?: number;
        offset?: number;
    }): Promise<CustomerRewardBatch[]>;
    /**
     * Update batch status
     */
    static updateStatus(id: string, status: 'pending' | 'generated' | 'delivered' | 'failed', deliveryDetails?: Record<string, any>): Promise<CustomerRewardBatch>;
    /**
     * Update batch export files
     */
    static updateExportFiles(id: string, exportFiles: Record<string, any>): Promise<CustomerRewardBatch>;
    /**
     * Get batch statistics for a cycle
     */
    static getBatchStatistics(cycleId: string): Promise<{
        total_batches: number;
        total_customers: number;
        total_reward_amount: number;
        pending_batches: number;
        generated_batches: number;
        delivered_batches: number;
        failed_batches: number;
    }>;
    /**
     * Bulk create customer reward batches
     */
    static bulkCreate(batches: Array<{
        weekly_verification_cycle_id: string;
        business_id: string;
        total_customers: number;
        total_reward_amount: number;
        batch_data: Record<string, any>;
        export_formats: string[];
    }>): Promise<CustomerRewardBatch[]>;
    /**
     * Get pending batches for processing
     */
    static getPendingBatches(): Promise<CustomerRewardBatch[]>;
    /**
     * Get batches ready for delivery
     */
    static getBatchesReadyForDelivery(): Promise<CustomerRewardBatch[]>;
    /**
     * Delete customer reward batch
     */
    static delete(id: string): Promise<void>;
    /**
     * Update delivery details
     */
    static updateDeliveryDetails(id: string, deliveryDetails: Record<string, any>): Promise<CustomerRewardBatch>;
    /**
     * Get batches by export format
     */
    static getByExportFormat(format: string, options?: {
        status?: 'pending' | 'generated' | 'delivered' | 'failed';
        limit?: number;
        offset?: number;
    }): Promise<CustomerRewardBatch[]>;
}
//# sourceMappingURL=customer-reward-batches.d.ts.map