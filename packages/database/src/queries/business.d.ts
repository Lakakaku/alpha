import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Business, BusinessInsert, BusinessUpdate, BusinessFilters, BusinessWithStores, BusinessWithUsers, PaginationParams, PaginatedResponse, AuthContext } from '../types/index.js';
export declare class BusinessQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: BusinessInsert, authContext?: AuthContext): Promise<Business>;
    findById(id: string, authContext?: AuthContext): Promise<Business | null>;
    findByEmail(email: string, authContext?: AuthContext): Promise<Business | null>;
    findWithStores(id: string, authContext?: AuthContext): Promise<BusinessWithStores | null>;
    findWithUsers(id: string, authContext?: AuthContext): Promise<BusinessWithUsers | null>;
    update(id: string, data: BusinessUpdate, authContext?: AuthContext): Promise<Business>;
    delete(id: string, authContext?: AuthContext): Promise<void>;
    list(filters?: BusinessFilters, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<Business>>;
    exists(id: string, authContext?: AuthContext): Promise<boolean>;
    count(filters?: BusinessFilters, authContext?: AuthContext): Promise<number>;
    updateSettings(id: string, settings: Record<string, any>, authContext?: AuthContext): Promise<Business>;
    validateBusinessAccess(businessId: string, authContext: AuthContext): Promise<boolean>;
}
export declare function createBusinessQueries(client: SupabaseClient<Database>): BusinessQueries;
//# sourceMappingURL=business.d.ts.map