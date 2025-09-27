import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, UserAccount, UserAccountInsert, UserAccountUpdate, UserRole, PaginationParams, PaginatedResponse, AuthContext } from '../types/index.js';
export declare class UserAccountQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: UserAccountInsert, authContext?: AuthContext): Promise<UserAccount>;
    findById(id: string, authContext?: AuthContext): Promise<UserAccount | null>;
    findByEmail(email: string, authContext?: AuthContext): Promise<UserAccount | null>;
    findByBusinessId(businessId: string, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<UserAccount>>;
    findBusinessOwner(businessId: string, authContext?: AuthContext): Promise<UserAccount | null>;
    findByRole(role: UserRole, businessId?: string, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<UserAccount>>;
    update(id: string, data: UserAccountUpdate, authContext?: AuthContext): Promise<UserAccount>;
    delete(id: string, authContext?: AuthContext): Promise<void>;
    updateLastLogin(id: string, timestamp?: string): Promise<UserAccount>;
    updatePermissions(id: string, permissions: Record<string, any>, authContext?: AuthContext): Promise<UserAccount>;
    exists(id: string, authContext?: AuthContext): Promise<boolean>;
    count(businessId?: string, role?: UserRole, authContext?: AuthContext): Promise<number>;
    validateUserAccess(userId: string, authContext: AuthContext): Promise<boolean>;
    isBusinessOwner(userId: string, businessId: string): Promise<boolean>;
    hasPermission(userId: string, permission: string, authContext?: AuthContext): Promise<boolean>;
}
export declare function createUserAccountQueries(client: SupabaseClient<Database>): UserAccountQueries;
//# sourceMappingURL=user-account.d.ts.map