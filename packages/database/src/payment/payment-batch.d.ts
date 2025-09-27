import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentBatch, PaymentBatchInsert, PaymentBatchUpdate } from '@vocilia/types';
export declare class PaymentBatchQueries {
    private client;
    constructor(client: SupabaseClient);
    create(data: PaymentBatchInsert): Promise<PaymentBatch>;
    findById(id: string): Promise<PaymentBatch | null>;
    findByWeek(batchWeek: string): Promise<PaymentBatch | null>;
    update(id: string, data: PaymentBatchUpdate): Promise<PaymentBatch>;
    acquireJobLock(batchId: string, lockKey: string, lockedBy: string): Promise<boolean>;
    releaseJobLock(batchId: string): Promise<void>;
}
//# sourceMappingURL=payment-batch.d.ts.map