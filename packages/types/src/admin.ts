// Admin Dashboard Foundation Types
// Date: 2025-09-23

export interface AdminAccount {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface AdminSession {
  id: string;
  admin_id: string;
  session_token: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  is_active: boolean;
  ended_at?: string;
}

export interface StoreStatusMetrics {
  id: string;
  store_id: string;
  metric_type: 'sync' | 'error' | 'performance' | 'availability';
  metric_value: number;
  metric_unit: string;
  recorded_at: string;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action_type: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'upload' | 'view';
  resource_type: 'store' | 'admin' | 'session' | 'upload' | 'system';
  resource_id?: string;
  action_details: {
    description: string;
    [key: string]: any;
  };
  ip_address: string;
  user_agent: string;
  performed_at: string;
  success: boolean;
  error_message?: string;
}

// Enhanced Store type with monitoring fields
export interface EnhancedStore {
  id: string;
  name: string;
  business_email: string;
  phone_number?: string;
  physical_address?: string;
  business_registration_number?: string;
  last_sync_at?: string;
  sync_status: 'pending' | 'success' | 'failed';
  error_count: number;
  performance_score?: number;
  online_status: boolean;
  monitoring_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Admin authentication types
export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  admin: AdminAccount;
  session: AdminSession;
  error?: string;
}

export interface AdminAuthContext {
  admin: AdminAccount | null;
  session: AdminSession | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<AdminLoginResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

// Store management types
export interface StoreCreateRequest {
  name: string;
  business_email: string;
  phone_number: string;
  physical_address: string;
  business_registration_number: string;
}

export interface StoreUpdateRequest {
  name?: string;
  business_email?: string;
  phone_number?: string;
  physical_address?: string;
  business_registration_number?: string;
  monitoring_enabled?: boolean;
}

export interface StoreListResponse {
  stores: EnhancedStore[];
  total: number;
  page: number;
  limit: number;
}

export interface DatabaseUploadRequest {
  store_id: string;
  file: File;
  week_start_date: string;
  notes?: string;
}

export interface DatabaseUploadResponse {
  success: boolean;
  upload_id: string;
  records_processed: number;
  error?: string;
}

// Monitoring and metrics types
export interface StoreHealthSummary {
  total_stores: number;
  online_stores: number;
  offline_stores: number;
  stores_with_errors: number;
  recent_sync_failures: number;
  average_performance_score?: number;
}

export interface MetricsFilter {
  store_id?: string;
  metric_type?: StoreStatusMetrics['metric_type'];
  start_date?: string;
  end_date?: string;
}

export interface MetricsChartData {
  timestamp: string;
  value: number;
  metric_type: string;
}

// Audit log types
export interface AuditLogFilter {
  admin_id?: string;
  action_type?: AuditLog['action_type'];
  resource_type?: AuditLog['resource_type'];
  start_date?: string;
  end_date?: string;
  success?: boolean;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

// API Response types
export interface AdminApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Error types
export interface AdminError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class AdminAuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AdminAuthenticationError';
  }
}

export class AdminAuthorizationError extends Error {
  constructor(message: string, public code: string = 'AUTHZ_ERROR') {
    super(message);
    this.name = 'AdminAuthorizationError';
  }
}

export class AdminValidationError extends Error {
  constructor(message: string, public field?: string, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'AdminValidationError';
  }
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isSubmitting: boolean;
  isValid: boolean;
}

// Component prop types
export interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export interface StoreCardProps {
  store: EnhancedStore;
  onClick?: (store: EnhancedStore) => void;
  showActions?: boolean;
}

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'error' | 'pending';
  label?: string;
  tooltip?: string;
}

export interface MetricsChartProps {
  data: MetricsChartData[];
  title: string;
  type: 'line' | 'bar' | 'area';
  height?: number;
}