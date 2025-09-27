export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type UserRole = 'business_account' | 'admin_account';
export type SubscriptionStatus = 'active' | 'inactive' | 'suspended';
export type PermissionCategory = 'business' | 'customer' | 'admin';
export type VerificationSessionStatus = 'pending' | 'completed' | 'expired' | 'failed';
export type ValidationStatus = 'valid' | 'out_of_tolerance' | 'invalid';
export type PhoneValidationStatus = 'valid' | 'invalid_format' | 'not_swedish';
export type FraudDetectionType = 'rate_limit' | 'invalid_qr' | 'suspicious_pattern' | 'duplicate_attempt';
export type FraudActionTaken = 'none' | 'warning' | 'block' | 'flag_for_review';
export interface UserProfile {
    id: string;
    role: UserRole;
    business_id: string | null;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}
export interface Business {
    id: string;
    name: string;
    organization_number: string | null;
    contact_email: string | null;
    phone_number: string | null;
    address: Json | null;
    subscription_status: SubscriptionStatus;
    created_at: string;
    updated_at: string;
}
export interface Store {
    id: string;
    business_id: string;
    name: string;
    address: Json | null;
    store_code: string | null;
    qr_code_data: string | null;
    active: boolean;
    current_qr_version: number | null;
    qr_generation_date: string | null;
    verification_enabled: boolean;
    fraud_detection_threshold: number | null;
    created_at: string;
    updated_at: string;
}
export interface VerificationSession {
    id: string;
    store_id: string;
    qr_version: number;
    scan_timestamp: string;
    session_token: string;
    status: VerificationSessionStatus;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    updated_at: string;
}
export interface CustomerVerification {
    id: string;
    session_id: string;
    transaction_time: string;
    transaction_amount: number;
    phone_number_e164: string;
    phone_number_national: string;
    time_validation_status: ValidationStatus;
    amount_validation_status: ValidationStatus;
    phone_validation_status: PhoneValidationStatus;
    tolerance_check_time_diff: number | null;
    tolerance_check_amount_diff: number | null;
    submitted_at: string;
    verified_at: string | null;
}
export interface FraudDetectionLog {
    id: string;
    session_id: string | null;
    detection_type: FraudDetectionType;
    risk_score: number;
    ip_address: string | null;
    user_agent: string | null;
    detection_details: Json | null;
    action_taken: FraudActionTaken;
    detected_at: string;
}
export interface Permission {
    id: string;
    name: string;
    description: string;
    category: PermissionCategory;
    created_at: string;
}
export interface UserPermission {
    id: string;
    user_id: string;
    permission: string;
    granted_by: string;
    granted_at: string;
    expires_at: string | null;
}
export interface ApiKey {
    id: string;
    name: string;
    key_hash: string;
    business_id: string | null;
    permissions: string[];
    last_used_at: string | null;
    expires_at: string;
    active: boolean;
    created_by: string;
    created_at: string;
}
export interface Database {
    public: {
        Tables: {
            user_profiles: {
                Row: UserProfile;
                Insert: Omit<UserProfile, 'created_at' | 'updated_at'> & {
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<UserProfile, 'id' | 'created_at'>> & {
                    updated_at?: string;
                };
            };
            businesses: {
                Row: Business;
                Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'> & {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<Business, 'id' | 'created_at'>> & {
                    updated_at?: string;
                };
            };
            stores: {
                Row: Store;
                Insert: Omit<Store, 'id' | 'created_at' | 'updated_at'> & {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<Store, 'id' | 'created_at'>> & {
                    updated_at?: string;
                };
            };
            permissions: {
                Row: Permission;
                Insert: Omit<Permission, 'id' | 'created_at'> & {
                    id?: string;
                    created_at?: string;
                };
                Update: Partial<Omit<Permission, 'id' | 'created_at'>>;
            };
            user_permissions: {
                Row: UserPermission;
                Insert: Omit<UserPermission, 'id' | 'granted_at'> & {
                    id?: string;
                    granted_at?: string;
                };
                Update: Partial<Omit<UserPermission, 'id' | 'granted_at'>>;
            };
            api_keys: {
                Row: ApiKey;
                Insert: Omit<ApiKey, 'id' | 'created_at' | 'last_used_at'> & {
                    id?: string;
                    created_at?: string;
                    last_used_at?: string;
                };
                Update: Partial<Omit<ApiKey, 'id' | 'created_at'>> & {
                    last_used_at?: string;
                };
            };
            verification_sessions: {
                Row: VerificationSession;
                Insert: Omit<VerificationSession, 'id' | 'created_at' | 'updated_at'> & {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Omit<VerificationSession, 'id' | 'created_at'>> & {
                    updated_at?: string;
                };
            };
            customer_verifications: {
                Row: CustomerVerification;
                Insert: Omit<CustomerVerification, 'id' | 'submitted_at'> & {
                    id?: string;
                    submitted_at?: string;
                };
                Update: Partial<Omit<CustomerVerification, 'id' | 'submitted_at'>>;
            };
            fraud_detection_logs: {
                Row: FraudDetectionLog;
                Insert: Omit<FraudDetectionLog, 'id' | 'detected_at'> & {
                    id?: string;
                    detected_at?: string;
                };
                Update: Partial<Omit<FraudDetectionLog, 'id' | 'detected_at'>>;
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            user_role: UserRole;
            subscription_status: SubscriptionStatus;
            permission_category: PermissionCategory;
            verification_session_status: VerificationSessionStatus;
            validation_status: ValidationStatus;
            phone_validation_status: PhoneValidationStatus;
            fraud_detection_type: FraudDetectionType;
            fraud_action_taken: FraudActionTaken;
        };
    };
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface LoginResponse {
    user: UserProfile;
    access_token: string;
    refresh_token: string;
    expires_in: number;
}
export interface RefreshRequest {
    refresh_token: string;
}
export interface RefreshResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}
export interface ProfileUpdateRequest {
    full_name?: string;
    avatar_url?: string;
}
export interface BusinessCreateRequest {
    name: string;
    organization_number?: string;
    contact_email?: string;
    phone_number?: string;
    address?: Json;
}
export interface BusinessUpdateRequest {
    name?: string;
    organization_number?: string;
    contact_email?: string;
    phone_number?: string;
    address?: Json;
    subscription_status?: SubscriptionStatus;
}
export interface StoreCreateRequest {
    name: string;
    address?: Json;
    store_code?: string;
}
export interface StoreUpdateRequest {
    name?: string;
    address?: Json;
    store_code?: string;
    active?: boolean;
}
export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    version: string;
}
export interface DetailedHealthStatus extends HealthStatus {
    checks: {
        database: {
            status: 'up' | 'down';
            response_time_ms: number;
        };
        auth: {
            status: 'up' | 'down';
            response_time_ms: number;
        };
        external_services: {
            status: 'up' | 'down' | 'partial';
            details: Record<string, {
                status: 'up' | 'down';
                response_time_ms: number;
            }>;
        };
    };
}
export interface ApiError {
    error: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    timestamp: string;
    path: string;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        current_page: number;
        total_pages: number;
        total_count: number;
        page_size: number;
        has_next: boolean;
        has_previous: boolean;
    };
}
export declare const PERMISSIONS: {
    readonly BUSINESS_READ: "business.read";
    readonly BUSINESS_WRITE: "business.write";
    readonly BUSINESS_DELETE: "business.delete";
    readonly CUSTOMERS_READ: "customers.read";
    readonly CUSTOMERS_WRITE: "customers.write";
    readonly FEEDBACK_READ: "feedback.read";
    readonly FEEDBACK_MODERATE: "feedback.moderate";
    readonly ADMIN_USERS: "admin.users";
    readonly ADMIN_BUSINESSES: "admin.businesses";
    readonly ADMIN_SYSTEM: "admin.system";
};
export type PermissionName = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type NonEmptyString<T extends string> = T extends '' ? never : T;
export type ValidEmail<T extends string> = T extends `${string}@${string}.${string}` ? T : never;
export type ValidUUID<T extends string> = T extends `${string}-${string}-${string}-${string}-${string}` ? T : never;
export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    business_id: string | null;
    permissions: string[];
}
export interface AuthContext {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<void>;
    updateProfile: (updates: ProfileUpdateRequest) => Promise<void>;
}
export interface BusinessRouteParams {
    businessId: string;
}
export interface StoreRouteParams {
    storeId: string;
}
export interface BusinessStoreRouteParams {
    businessId: string;
    storeId?: string;
}
export interface QRVerificationRequest {
    ip_address: string;
    user_agent: string;
}
export interface QRVerificationResponse {
    success: boolean;
    session_token: string;
    store_info: {
        store_id: string;
        store_name: string;
        business_name: string;
        logo_url?: string;
    };
    fraud_warning: boolean;
}
export interface VerificationSubmissionRequest {
    transaction_time: string;
    transaction_amount: number;
    phone_number: string;
}
export interface ValidationResult {
    status: ValidationStatus | PhoneValidationStatus;
    difference_minutes?: number;
    difference_sek?: number;
    tolerance_range?: string;
    e164_format?: string;
    national_format?: string;
}
export interface VerificationSubmissionResponse {
    success: boolean;
    verification_id: string;
    validation_results: {
        time_validation: ValidationResult;
        amount_validation: ValidationResult;
        phone_validation: ValidationResult;
        overall_valid: boolean;
    };
    next_steps: string;
}
export interface SessionDetailsResponse {
    session_id: string;
    store_info: {
        store_id: string;
        store_name: string;
        business_name: string;
        logo_url?: string;
    };
    status: VerificationSessionStatus;
    qr_version: number;
    created_at: string;
    expires_at: string;
}
export interface QRVerificationRouteParams {
    storeId: string;
}
export interface SessionRouteParams {
    sessionToken: string;
}
export interface VerificationStatsResponse {
    success: boolean;
    store_id: string;
    period: {
        days: number;
        start_date: string;
        end_date: string;
    };
    statistics: {
        total_sessions: number;
        completed_verifications: number;
        success_rate: number;
        fraud_detections: number;
        average_completion_time_seconds: number;
        most_common_failure_reasons: string[];
        hourly_distribution: Array<{
            hour: number;
            count: number;
        }>;
        daily_trend: Array<{
            date: string;
            successful: number;
            failed: number;
        }>;
    };
}
export interface VerificationDetailsResponse {
    success: boolean;
    store_id: string;
    pagination: {
        limit: number;
        offset: number;
        total: number;
        has_more: boolean;
    };
    filters: {
        status?: string;
        start_date?: string;
        end_date?: string;
    };
    verifications: Array<{
        verification_id: string;
        session_token: string;
        phone_number: string;
        transaction_amount: number;
        transaction_time: string;
        status: string;
        validation_results: any;
        created_at: string;
        completed_at?: string;
        ip_address: string;
        user_agent: string;
        fraud_score?: number;
    }>;
}
export * from './database';
export * from './calls';
export * from './questions';
export * from './feedback-analysis';
export * from './ai-assistant';
export * from './pwa';
export * from './offline';
export * from './support';
export * from './admin';
export * from './ai-call-system';
export * from './payment';
//# sourceMappingURL=index.d.ts.map