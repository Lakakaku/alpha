import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, VerificationRecord, VerificationRecordInsert, VerificationRecordUpdate, VerificationRecordWithBusiness, WeeklyVerificationStatus, WeeklyVerificationData, WeeklyVerificationSubmission, PaginationParams, PaginatedResponse, AuthContext } from '../types/index.js';
export declare class VerificationRecordQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: VerificationRecordInsert, authContext?: AuthContext): Promise<VerificationRecord>;
    findById(id: string, authContext?: AuthContext): Promise<VerificationRecord | null>;
    findByBusinessAndWeek(businessId: string, weekIdentifier: string, authContext?: AuthContext): Promise<VerificationRecord | null>;
    findByBusinessId(businessId: string, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<VerificationRecord>>;
    findByStatus(status: WeeklyVerificationStatus, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<VerificationRecord>>;
    findWithBusiness(id: string, authContext?: AuthContext): Promise<VerificationRecordWithBusiness | null>;
    update(id: string, data: VerificationRecordUpdate, authContext?: AuthContext): Promise<VerificationRecord>;
    submitForVerification(id: string, submissionData: WeeklyVerificationSubmission, authContext?: AuthContext): Promise<VerificationRecord>;
    completeVerification(id: string, adminNotes?: string, authContext?: AuthContext): Promise<VerificationRecord>;
    generateWeeklyVerificationData(businessId: string, weekIdentifier: string, authContext?: AuthContext): Promise<WeeklyVerificationData>;
    createWeeklyRecord(businessId: string, weekIdentifier: string, authContext?: AuthContext): Promise<VerificationRecord>;
    delete(id: string, authContext?: AuthContext): Promise<void>;
    exists(businessId: string, weekIdentifier: string, authContext?: AuthContext): Promise<boolean>;
    count(businessId?: string, status?: WeeklyVerificationStatus, authContext?: AuthContext): Promise<number>;
    getNextWeekIdentifier(currentWeek: string): Promise<string>;
    getPreviousWeekIdentifier(currentWeek: string): Promise<string>;
    private isValidWeekIdentifier;
    private parseWeekIdentifier;
    private validateBusinessExists;
    private buildAuthorizedStoreIds;
    findPendingSubmissions(authContext?: AuthContext): Promise<VerificationRecord[]>;
    findSubmittedRecords(authContext?: AuthContext): Promise<VerificationRecord[]>;
    getCurrentWeekIdentifier(): Promise<string>;
}
export declare function createVerificationRecordQueries(client: SupabaseClient<Database>): VerificationRecordQueries;
//# sourceMappingURL=verification-record.d.ts.map