import { SupabaseClient } from '@supabase/supabase-js';
import type { RewardCalculation, RewardCalculationInsert } from '@vocilia/types';
export declare class RewardCalculationQueries {
    private client;
    constructor(client: SupabaseClient);
    create(data: RewardCalculationInsert): Promise<RewardCalculation>;
    createMany(data: RewardCalculationInsert[]): Promise<RewardCalculation[]>;
    findByFeedbackId(feedbackId: string): Promise<RewardCalculation | null>;
    findByCustomerPhone(customerPhone: string): Promise<RewardCalculation[]>;
    findPendingRewards(): Promise<RewardCalculation[]>;
    updatePaymentTransactionId(feedbackId: string, paymentTransactionId: string): Promise<void>;
    aggregateByCustomer(customerPhone: string): Promise<number>;
}
//# sourceMappingURL=reward-calculation.d.ts.map