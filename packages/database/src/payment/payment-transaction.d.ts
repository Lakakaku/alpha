import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentTransaction, PaymentTransactionInsert, PaymentTransactionUpdate } from '@vocilia/types';
export declare class PaymentTransactionQueries {
    private client;
    constructor(client: SupabaseClient);
    create(data: PaymentTransactionInsert): Promise<PaymentTransaction>;
    findById(id: string): Promise<PaymentTransaction | null>;
    findByBatchId(batchId: string): Promise<PaymentTransaction[]>;
    findByCustomerPhone(customerPhone: string): Promise<PaymentTransaction[]>;
    findByStatus(status: string): Promise<PaymentTransaction[]>;
    update(id: string, data: PaymentTransactionUpdate): Promise<PaymentTransaction>;
    aggregateByCustomerForBatch(batchWeek: string): Promise<Map<string, number>>;
}
//# sourceMappingURL=payment-transaction.d.ts.map