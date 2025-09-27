import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFailure, PaymentFailureInsert, PaymentFailureUpdate } from '@vocilia/types';
export declare class PaymentFailureQueries {
    private client;
    constructor(client: SupabaseClient);
    create(data: PaymentFailureInsert): Promise<PaymentFailure>;
    findByPaymentTransactionId(paymentTransactionId: string): Promise<PaymentFailure[]>;
    findPendingRetries(): Promise<PaymentFailure[]>;
    findByStatus(status: string, limit?: number, offset?: number): Promise<{
        failures: PaymentFailure[];
        total: number;
    }>;
    update(id: string, data: PaymentFailureUpdate): Promise<PaymentFailure>;
}
//# sourceMappingURL=payment-failure.d.ts.map