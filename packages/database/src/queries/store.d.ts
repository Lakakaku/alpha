import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Store, StoreInsert, StoreUpdate, StoreFilters, StoreWithContext, StoreWithFeedback, PaginationParams, PaginatedResponse, AuthContext } from '../types/index.js';
export declare class StoreQueries {
    private client;
    constructor(client: SupabaseClient<Database>);
    create(data: StoreInsert, authContext?: AuthContext): Promise<Store>;
    findById(id: string, authContext?: AuthContext): Promise<Store | null>;
    findByQRCode(qrCodeData: string, authContext?: AuthContext): Promise<Store | null>;
    findByBusinessId(businessId: string, filters?: StoreFilters, pagination?: PaginationParams, authContext?: AuthContext): Promise<PaginatedResponse<Store>>;
    findWithContext(id: string, authContext?: AuthContext): Promise<StoreWithContext | null>;
    findWithFeedback(id: string, dateRange?: {
        start: string;
        end: string;
    }, authContext?: AuthContext): Promise<StoreWithFeedback | null>;
    update(id: string, data: StoreUpdate, authContext?: AuthContext): Promise<Store>;
    delete(id: string, authContext?: AuthContext): Promise<void>;
    setActive(id: string, isActive: boolean, authContext?: AuthContext): Promise<Store>;
    regenerateQRCode(id: string, authContext?: AuthContext): Promise<Store>;
    updateProfile(id: string, profileUpdates: Record<string, any>, authContext?: AuthContext): Promise<Store>;
    exists(id: string, authContext?: AuthContext): Promise<boolean>;
    count(businessId?: string, authContext?: AuthContext): Promise<number>;
    validateStoreAccess(storeId: string, authContext: AuthContext): Promise<boolean>;
    private generateQRCodeData;
    searchByLocation(coordinates: {
        lat: number;
        lng: number;
    }, radiusKm?: number, authContext?: AuthContext): Promise<Store[]>;
}
export declare function createStoreQueries(client: SupabaseClient<Database>): StoreQueries;
//# sourceMappingURL=store.d.ts.map