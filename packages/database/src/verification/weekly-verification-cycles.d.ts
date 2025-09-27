import { createClient } from '@supabase/supabase-js';
import { WeeklyVerificationCycle, VerificationCycleStatus } from '@vocilia/types/verification';
export declare class WeeklyVerificationCycleModel {
    private supabase;
    constructor(supabaseClient: ReturnType<typeof createClient>);
    create(data: {
        cycle_week: string;
        created_by: string;
    }): Promise<WeeklyVerificationCycle>;
    findById(id: string): Promise<WeeklyVerificationCycle | null>;
    findByWeek(cycle_week: string): Promise<WeeklyVerificationCycle | null>;
    list(options?: {
        page?: number;
        limit?: number;
        status?: VerificationCycleStatus;
    }): Promise<{
        cycles: WeeklyVerificationCycle[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            total_pages: number;
        };
    }>;
    updateStatus(id: string, status: VerificationCycleStatus): Promise<WeeklyVerificationCycle>;
    updateStoreCount(id: string, total_stores: number, completed_stores: number): Promise<WeeklyVerificationCycle>;
    delete(id: string): Promise<void>;
    getCurrentCycle(): Promise<WeeklyVerificationCycle | null>;
    getActiveCycles(): Promise<WeeklyVerificationCycle[]>;
    markCompleted(id: string): Promise<WeeklyVerificationCycle>;
    markExpired(id: string): Promise<WeeklyVerificationCycle>;
}
//# sourceMappingURL=weekly-verification-cycles.d.ts.map