import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FeedbackSession, FeedbackSessionInsert, FeedbackSessionUpdate, FeedbackSessionFilters, FeedbackSessionWithTransaction, FeedbackSessionWithStore, FeedbackStatus, PaginationParams, PaginatedResponse, AuthContext } from '../types/index.js';
export declare class FeedbackSessionQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: FeedbackSessionInsert, authContext?: AuthContext): Promise<FeedbackSession>;
    findById(id: string, authContext?: AuthContext): Promise<FeedbackSession | null>;
    findByTransactionId(transactionId: string, authContext?: AuthContext): Promise<FeedbackSession | null>;
    findByStoreId(storeId: string, filters?: FeedbackSessionFilters, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<FeedbackSession>>;
    findWithTransaction(id: string, authContext?: AuthContext): Promise<FeedbackSessionWithTransaction | null>;
    findWithStore(id: string, authContext?: AuthContext): Promise<FeedbackSessionWithStore | null>;
    findByStatus(status: FeedbackStatus, storeId?: string, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<FeedbackSession>>;
    update(id: string, data: FeedbackSessionUpdate, authContext?: AuthContext): Promise<FeedbackSession>;
    updateStatus(id: string, status: FeedbackStatus, authContext?: AuthContext): Promise<FeedbackSession>;
    completeSession(id: string, qualityGrade: number, rewardPercentage: number, feedbackSummary: Record<string, any>, authContext?: AuthContext): Promise<FeedbackSession>;
    failSession(id: string, reason: string, authContext?: AuthContext): Promise<FeedbackSession>;
    delete(id: string, authContext?: AuthContext): Promise<void>;
    getSessionMetrics(storeId?: string, dateRange?: {
        start: string;
        end: string;
    }, authContext?: AuthContext): Promise<{
        total_sessions: number;
        completed_sessions: number;
        failed_sessions: number;
        average_quality_grade: number;
        average_reward_percentage: number;
        completion_rate: number;
    }>;
    exists(id: string, authContext?: AuthContext): Promise<boolean>;
    count(storeId?: string, status?: FeedbackStatus, authContext?: AuthContext): Promise<number>;
    private validateStoreAccess;
    private validateTransactionAccess;
    private buildAuthorizedStoreIds;
    private hashPhoneNumber;
    private hasCallStartTime;
    findActiveSessions(authContext?: AuthContext): Promise<FeedbackSession[]>;
    findSessionsRequiringAttention(authContext?: AuthContext): Promise<FeedbackSession[]>;
}
export declare function createFeedbackSessionQueries(client: SupabaseClient<Database>): FeedbackSessionQueries;
//# sourceMappingURL=feedback-session.d.ts.map