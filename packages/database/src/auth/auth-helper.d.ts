import { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, AuthContext, RLSContext, UserRole } from '../types/index.js';
export interface JWTClaims {
    sub: string;
    email?: string;
    role?: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    aud?: string;
    exp?: number;
    iat?: number;
    iss?: string;
}
export interface AuthTokenValidation {
    isValid: boolean;
    user?: User;
    claims?: JWTClaims;
    error?: string;
}
export declare class AuthHelper {
    private client;
    private userAccountQueries;
    constructor(client: SupabaseClient<Database>);
    extractJWTClaims(token: string): Promise<JWTClaims | null>;
    validateAuthToken(token?: string): Promise<AuthTokenValidation>;
    createAuthContext(user: User): Promise<AuthContext>;
    createRLSContext(authContext: AuthContext): Promise<RLSContext>;
    setRLSContext(authContext: AuthContext): Promise<void>;
    clearRLSContext(): Promise<void>;
    requireAuth(token?: string): Promise<AuthContext>;
    requireRole(authContext: AuthContext, allowedRoles: UserRole[]): Promise<void>;
    requireBusinessAccess(authContext: AuthContext, businessId: string): Promise<void>;
    requirePermission(authContext: AuthContext, permission: string): Promise<void>;
    hasPermission(authContext: AuthContext, permission: string): boolean;
    canAccessBusiness(authContext: AuthContext, businessId: string): boolean;
    canAccessStore(authContext: AuthContext, storeBelongsToBusiness: string): boolean;
    isAdmin(authContext: AuthContext): boolean;
    isBusinessOwner(authContext: AuthContext): boolean;
    isBusinessStaff(authContext: AuthContext): boolean;
    refreshUserAccount(authContext: AuthContext): Promise<AuthContext>;
    private extractPermissions;
    createSystemAuthContext(): Promise<AuthContext>;
    validateBusinessOwnership(authContext: AuthContext, businessId: string): Promise<boolean>;
    extractAuthFromRequest(request: {
        headers: Record<string, string>;
    }): Promise<AuthContext | null>;
    withAuth<T>(token: string | undefined, operation: (authContext: AuthContext) => Promise<T>): Promise<T>;
    withOptionalAuth<T>(token: string | undefined, operation: (authContext?: AuthContext) => Promise<T>): Promise<T>;
}
export declare function createAuthHelper(client: SupabaseClient<Database>): AuthHelper;
//# sourceMappingURL=auth-helper.d.ts.map