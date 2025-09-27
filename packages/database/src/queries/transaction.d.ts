import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Transaction, TransactionInsert, TransactionUpdate, TransactionFilters, TransactionWithFeedback, VerificationStatus, TransactionToleranceInput, TransactionVerificationResult, PaginationParams, PaginatedResponse, AuthContext } from '../types/index.js';
export declare class TransactionQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: TransactionInsert, authContext?: AuthContext): Promise<Transaction>;
    createFromToleranceInput(storeId: string, toleranceInput: TransactionToleranceInput, authContext?: AuthContext): Promise<Transaction>;
    findById(id: string, authContext?: AuthContext): Promise<Transaction | null>;
    findByStoreId(storeId: string, filters?: TransactionFilters, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<Transaction>>;
    findWithFeedback(id: string, authContext?: AuthContext): Promise<TransactionWithFeedback | null>;
    findPendingVerification(storeId?: string, authContext?: AuthContext): Promise<Transaction[]>;
    update(id: string, data: TransactionUpdate, authContext?: AuthContext): Promise<Transaction>;
    verifyTransaction(id: string, actualAmount: number, actualTime: string, authContext?: AuthContext): Promise<TransactionVerificationResult>;
    findMatchingTransactions(storeId: string, actualAmount: number, actualTime: string, authContext?: AuthContext): Promise<TransactionVerificationResult[]>;
    delete(id: string, authContext?: AuthContext): Promise<void>;
    exists(id: string, authContext?: AuthContext): Promise<boolean>;
    count(storeId?: string, verificationStatus?: VerificationStatus, authContext?: AuthContext): Promise<number>;
    private validateStoreAccess;
    private buildAuthorizedStoreIds;
    private createTimeToleranceRange;
    private createAmountToleranceRange;
    private createTimeToleranceFromTimestamp;
    private createAmountToleranceFromValue;
    private createFallbackTimeRange;
    private createFallbackAmountRange;
    private checkToleranceMatch;
    private parseTimeRange;
    private parseAmountRange;
}
export declare function createTransactionQueries(client: SupabaseClient<Database>): TransactionQueries;
//# sourceMappingURL=transaction.d.ts.map