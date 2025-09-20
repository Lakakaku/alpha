/**
 * Business Authentication Types
 * Feature: Business Authentication & Account Management
 * Task: T003 - Add business authentication types
 */

// ========================================
// BASE TYPES
// ========================================

export type UUID = string;
export type ISODateString = string;

// ========================================
// BUSINESS USER TYPES
// ========================================

export type BusinessVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface BusinessMetadata {
  business_name: string;
  contact_person: string;
  phone_number: string;
  verification_status: BusinessVerificationStatus;
  verification_requested_at?: ISODateString;
  verification_notes?: string;
}

export interface BusinessUser {
  id: UUID;
  email: string;
  email_confirmed_at?: ISODateString;
  user_metadata: BusinessMetadata;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ========================================
// STORE TYPES
// ========================================

export interface Store {
  id: UUID;
  name: string;
  address: string;
  qr_code_id: UUID;
  business_registration_number?: string;
  created_at: ISODateString;
  updated_at: ISODateString;
  is_active: boolean;
}

export interface StorePermissions {
  read_feedback: boolean;
  write_context: boolean;
  manage_qr: boolean;
  view_analytics: boolean;
  admin: boolean;
}

export type BusinessStoreRole = 'owner' | 'manager' | 'viewer';

export interface BusinessStore {
  id: UUID;
  business_id: UUID;
  store_id: UUID;
  permissions: StorePermissions;
  role: BusinessStoreRole;
  created_at: ISODateString;
  created_by?: UUID;
}

export interface StoreWithPermissions extends Store {
  permissions: StorePermissions;
  role: BusinessStoreRole;
}

// ========================================
// SESSION TYPES
// ========================================

export interface BusinessSession {
  id: UUID;
  user_id: UUID;
  current_store_id?: UUID;
  session_token?: string;
  expires_at: ISODateString;
  created_at: ISODateString;
  last_activity: ISODateString;
  ip_address?: string;
  user_agent?: string;
}

export interface SessionInfo {
  id: UUID;
  expires_at: ISODateString;
  last_activity: ISODateString;
}

// ========================================
// ADMIN NOTIFICATION TYPES
// ========================================

export type AdminNotificationType = 'registration' | 'verification';
export type AdminNotificationStatus = 'pending' | 'sent' | 'acknowledged';

export interface AdminNotification {
  id: UUID;
  business_id: UUID;
  notification_type: AdminNotificationType;
  status: AdminNotificationStatus;
  message?: string;
  sent_at?: ISODateString;
  acknowledged_at?: ISODateString;
  acknowledged_by?: UUID;
  created_at: ISODateString;
}

// ========================================
// API REQUEST/RESPONSE TYPES
// ========================================

// Registration
export interface BusinessRegistrationRequest {
  email: string;
  password: string;
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
}

export interface BusinessRegistrationResponse {
  id: UUID;
  email: string;
  verificationStatus: BusinessVerificationStatus;
  message: string;
}

// Login
export interface BusinessLoginRequest {
  email: string;
  password: string;
}

export interface BusinessLoginResponse {
  user: BusinessUser;
  session: SessionInfo;
  stores: StoreWithPermissions[];
  currentStore?: StoreWithPermissions;
}

// Password Reset
export interface PasswordResetRequest {
  email: string;
}

// Store Management
export interface StoreContextRequest {
  storeId: UUID;
}

export interface StoreContextResponse {
  currentStore: StoreWithPermissions;
  message: string;
}

export interface StoreListResponse {
  stores: StoreWithPermissions[];
  total: number;
}

// Admin Approval
export interface BusinessApprovalRequest {
  businessId: UUID;
  action: 'approve' | 'reject';
  notes?: string;
}

export interface BusinessApprovalResponse {
  businessId: UUID;
  newStatus: BusinessVerificationStatus;
  message: string;
}

// Generic Responses
export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
}

// ========================================
// AUTHENTICATION CONTEXT TYPES
// ========================================

export interface BusinessAuthContext {
  user: BusinessUser | null;
  session: SessionInfo | null;
  stores: StoreWithPermissions[];
  currentStore: StoreWithPermissions | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface BusinessAuthActions {
  login: (credentials: BusinessLoginRequest) => Promise<BusinessLoginResponse>;
  logout: () => Promise<void>;
  register: (data: BusinessRegistrationRequest) => Promise<BusinessRegistrationResponse>;
  resetPassword: (data: PasswordResetRequest) => Promise<SuccessResponse>;
  switchStore: (storeId: UUID) => Promise<StoreContextResponse>;
  refreshSession: () => Promise<void>;
}

// ========================================
// VALIDATION TYPES
// ========================================

export interface BusinessValidationRules {
  email: {
    required: boolean;
    businessDomain: boolean; // No gmail, hotmail, etc.
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  businessName: {
    minLength: number;
    maxLength: number;
    required: boolean;
  };
  phoneNumber: {
    required: boolean;
    format: 'swedish'; // +46 or 0 followed by 8-9 digits
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ========================================
// PERMISSION UTILITY TYPES
// ========================================

export type PermissionKey = keyof StorePermissions;

export interface PermissionCheck {
  hasPermission: (storeId: UUID, permission: PermissionKey) => boolean;
  isStoreAdmin: (storeId: UUID) => boolean;
  isStoreOwner: (storeId: UUID) => boolean;
  canReadFeedback: (storeId: UUID) => boolean;
  canWriteContext: (storeId: UUID) => boolean;
  canManageQR: (storeId: UUID) => boolean;
  canViewAnalytics: (storeId: UUID) => boolean;
}

// ========================================
// HOOK RETURN TYPES
// ========================================

export interface UseBusinessAuthReturn extends BusinessAuthContext, BusinessAuthActions {
  permissions: PermissionCheck;
}

export interface UseStoreContextReturn {
  currentStore: StoreWithPermissions | null;
  stores: StoreWithPermissions[];
  switchStore: (storeId: UUID) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export interface UseBusinessRegistrationReturn {
  register: (data: BusinessRegistrationRequest) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isSuccess: boolean;
}

export interface UseAdminApprovalReturn {
  pendingBusinesses: BusinessUser[];
  approveBusinesses: (data: BusinessApprovalRequest) => Promise<void>;
  notifications: AdminNotification[];
  isLoading: boolean;
  error: string | null;
}

// ========================================
// MIDDLEWARE TYPES
// ========================================

export interface AuthenticationMiddlewareConfig {
  publicPaths: string[];
  adminPaths: string[];
  redirectToLogin: string;
  redirectToApproval: string;
  redirectToAdmin: string;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireApproval?: boolean;
  requiredPermissions?: PermissionKey[];
  fallback?: React.ReactNode;
}

// ========================================
// UTILITY EXPORTS
// ========================================

export const DEFAULT_PERMISSIONS: StorePermissions = {
  read_feedback: false,
  write_context: false,
  manage_qr: false,
  view_analytics: false,
  admin: false,
};

export const ADMIN_PERMISSIONS: StorePermissions = {
  read_feedback: true,
  write_context: true,
  manage_qr: true,
  view_analytics: true,
  admin: true,
};

export const VIEWER_PERMISSIONS: StorePermissions = {
  read_feedback: true,
  write_context: false,
  manage_qr: false,
  view_analytics: true,
  admin: false,
};

export const MANAGER_PERMISSIONS: StorePermissions = {
  read_feedback: true,
  write_context: true,
  manage_qr: false,
  view_analytics: true,
  admin: false,
};

export const BUSINESS_VALIDATION_RULES: BusinessValidationRules = {
  email: {
    required: true,
    businessDomain: true,
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  businessName: {
    minLength: 2,
    maxLength: 100,
    required: true,
  },
  phoneNumber: {
    required: true,
    format: 'swedish',
  },
};

// ========================================
// TYPE GUARDS
// ========================================

export function isBusinessUser(user: any): user is BusinessUser {
  return (
    user &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    user.user_metadata &&
    typeof user.user_metadata.business_name === 'string'
  );
}

export function isStoreWithPermissions(store: any): store is StoreWithPermissions {
  return (
    store &&
    typeof store.id === 'string' &&
    typeof store.name === 'string' &&
    store.permissions &&
    typeof store.permissions === 'object'
  );
}

export function isValidPermissions(permissions: any): permissions is StorePermissions {
  if (!permissions || typeof permissions !== 'object') return false;

  const requiredKeys: (keyof StorePermissions)[] = [
    'read_feedback',
    'write_context',
    'manage_qr',
    'view_analytics',
    'admin',
  ];

  return requiredKeys.every(key => typeof permissions[key] === 'boolean');
}