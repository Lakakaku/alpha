import { SupabaseClient } from '@supabase/supabase-js';
import type { ReconciliationReport, ReconciliationReportInsert, StoreBreakdown } from '@vocilia/types';
export declare class ReconciliationReportQueries {
    private client;
    constructor(client: SupabaseClient);
    create(data: ReconciliationReportInsert): Promise<ReconciliationReport>;
    findByBatchId(batchId: string): Promise<ReconciliationReport | null>;
    findByReportPeriod(reportPeriod: string): Promise<ReconciliationReport | null>;
    generateStoreBreakdown(batchId: string): Promise<StoreBreakdown[]>;
    calculateDiscrepancies(batchId: string): Promise<{
        count: number;
        amountSek: number;
    }>;
}
//# sourceMappingURL=reconciliation-report.d.ts.map