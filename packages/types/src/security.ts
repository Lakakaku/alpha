/**
 * Security Types
 * Task: T030 - Security types
 * 
 * Defines types for security hardening system components:
 * - Audit logging (immutable)
 * - Intrusion detection and response
 * - Row Level Security (RLS) policies
 * - Data encryption and key management
 * - Security monitoring and alerting
 */

// ==================== AUDIT LOGGING ====================

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  user_id: string;
  user_type: UserType;
  action_performed: string;
  resource_type: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  correlation_id: string; // For request tracing
  event_metadata: Record<string, any>;
  result_status: ResultStatus;
  created_at: string; // Immutable timestamp
  session_id?: string;
  request_id?: string;
  duration_ms?: number;
  error_details?: ErrorDetails;
}

export type AuditEventType = 
  | 'authentication'
  | 'authorization' 
  | 'data_access'
  | 'data_modification'
  | 'admin_action'
  | 'security_violation'
  | 'system_event'
  | 'fraud_detection';

export type UserType = 'customer' | 'business' | 'admin' | 'system';

export type ResultStatus = 'success' | 'failure' | 'blocked' | 'warning';

export interface ErrorDetails {
  error_code: string;
  error_message: string;
  stack_trace?: string;
  additional_context?: Record<string, any>;
}

export interface AuditLogRequest {
  event_type: AuditEventType;
  user_id: string;
  user_type: UserType;
  action_performed: string;
  resource_type: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  correlation_id: string;
  event_metadata?: Record<string, any>;
  result_status: ResultStatus;
  session_id?: string;
  request_id?: string;
  duration_ms?: number;
  error_details?: ErrorDetails;
}

export interface AuditLogQuery {
  event_type?: AuditEventType | AuditEventType[];
  user_id?: string;
  user_type?: UserType;
  resource_type?: string;
  result_status?: ResultStatus;
  correlation_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number; // max 1000
  offset?: number;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  pagination: {
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
    current_offset: number;
    limit: number;
  };
  summary?: {
    event_type_distribution: Record<AuditEventType, number>;
    result_status_distribution: Record<ResultStatus, number>;
    unique_users: number;
    time_range: {
      earliest: string;
      latest: string;
    };
  };
}

// ==================== INTRUSION DETECTION ====================

export interface IntrusionEvent {
  id: string;
  event_type: IntrusionType;
  severity_level: SeverityLevel;
  source_ip: string;
  target_resource: string;
  attack_vector: string;
  detection_rule: string;
  event_data: IntrusionEventData;
  geolocation?: GeolocationData;
  user_agent?: string;
  is_resolved: boolean;
  resolution_action?: ResolutionAction;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
  correlation_id: string;
  false_positive?: boolean;
}

export type IntrusionType = 
  | 'brute_force'
  | 'sql_injection'
  | 'xss_attempt'
  | 'ddos_attack'
  | 'unauthorized_access'
  | 'malware_detection'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'suspicious_activity';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface IntrusionEventData {
  request_count?: number;
  time_window_seconds?: number;
  payload_samples?: string[];
  attack_patterns?: string[];
  blocked_requests?: number;
  detection_confidence: number; // 0-100
  attack_sophistication: number; // 0-100
  potential_impact: string[];
  mitigation_applied?: string[];
  additional_metadata?: Record<string, any>;
}

export interface GeolocationData {
  country: string;
  country_code: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  is_proxy?: boolean;
  is_tor?: boolean;
  threat_score?: number; // 0-100
}

export type ResolutionAction = 
  | 'ip_blocked'
  | 'rate_limited'
  | 'user_suspended'
  | 'session_terminated'
  | 'alert_only'
  | 'manual_review'
  | 'automated_mitigation';

export interface IntrusionEventRequest {
  event_type: IntrusionType;
  severity_level: SeverityLevel;
  source_ip: string;
  target_resource: string;
  attack_vector: string;
  detection_rule: string;
  event_data: IntrusionEventData;
  geolocation?: GeolocationData;
  user_agent?: string;
  correlation_id: string;
}

export interface IntrusionEventUpdate {
  is_resolved: boolean;
  resolution_action?: ResolutionAction;
  resolution_notes?: string;
  false_positive?: boolean;
}

export interface IntrusionEventQuery {
  event_type?: IntrusionType | IntrusionType[];
  severity_level?: SeverityLevel | SeverityLevel[];
  source_ip?: string;
  is_resolved?: boolean;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface IntrusionEventResponse {
  events: IntrusionEvent[];
  pagination: {
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
  summary: {
    total_events: number;
    unresolved_events: number;
    critical_events: number;
    severity_distribution: Record<SeverityLevel, number>;
    event_type_distribution: Record<IntrusionType, number>;
    top_source_ips: Array<{
      ip: string;
      event_count: number;
      country?: string;
    }>;
    resolution_rate: number; // 0-100
  };
}

// ==================== RLS POLICIES ====================

export interface RLSPolicy {
  id: string;
  table_name: string;
  policy_name: string;
  policy_type: RLSPolicyType;
  user_roles: string[]; // ['authenticated', 'admin', 'business', etc.]
  policy_expression: string; // SQL expression
  is_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_tested: string;
  test_results?: RLSTestResult[];
  description?: string;
}

export type RLSPolicyType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface RLSTestResult {
  test_case: string;
  expected_result: 'allow' | 'deny';
  actual_result: 'allow' | 'deny';
  test_passed: boolean;
  execution_time_ms: number;
  tested_at: string;
  test_data: Record<string, any>;
}

export interface RLSPolicyRequest {
  table_name: string;
  policy_name: string;
  policy_type: RLSPolicyType;
  user_roles: string[];
  policy_expression: string;
  description?: string;
}

export interface RLSEnforcementStatus {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  policies: Array<{
    policy_name: string;
    policy_type: RLSPolicyType;
    is_enabled: boolean;
  }>;
  last_audit: string;
  compliance_status: 'compliant' | 'warning' | 'violation';
  issues?: string[];
}

// ==================== ENCRYPTION & KEY MANAGEMENT ====================

export interface EncryptionKey {
  id: string;
  key_name: string;
  key_type: KeyType;
  algorithm: EncryptionAlgorithm;
  key_size: number; // bits
  key_status: KeyStatus;
  usage_purpose: KeyUsage[];
  rotation_schedule: number; // days
  created_at: string;
  expires_at?: string;
  rotated_at?: string;
  next_rotation: string;
  usage_count: number;
  max_usage_limit?: number;
  created_by: string;
  key_fingerprint: string; // SHA-256 hash
}

export type KeyType = 'symmetric' | 'asymmetric_public' | 'asymmetric_private' | 'master' | 'data_encryption';

export type EncryptionAlgorithm = 'AES-256-GCM' | 'AES-256-CBC' | 'RSA-4096' | 'Ed25519' | 'ChaCha20-Poly1305';

export type KeyStatus = 'active' | 'inactive' | 'expired' | 'compromised' | 'rotating';

export type KeyUsage = 'data_encryption' | 'data_decryption' | 'token_signing' | 'password_hashing' | 'database_encryption';

export interface EncryptionRequest {
  data: string;
  key_id: string;
  algorithm?: EncryptionAlgorithm;
  additional_data?: string; // For AEAD
}

export interface EncryptionResponse {
  encrypted_data: string; // Base64 encoded
  initialization_vector: string; // Base64 encoded
  authentication_tag?: string; // Base64 encoded for AEAD
  key_id: string;
  algorithm: EncryptionAlgorithm;
  encrypted_at: string;
}

export interface DecryptionRequest {
  encrypted_data: string; // Base64 encoded
  initialization_vector: string; // Base64 encoded
  authentication_tag?: string; // Base64 encoded for AEAD
  key_id: string;
  additional_data?: string; // For AEAD
}

export interface DecryptionResponse {
  decrypted_data: string;
  key_id: string;
  algorithm: EncryptionAlgorithm;
  decrypted_at: string;
  integrity_verified: boolean;
}

export interface KeyRotationRequest {
  key_id: string;
  immediate?: boolean; // If false, follows rotation schedule
  backup_old_key?: boolean;
}

export interface KeyRotationResponse {
  old_key_id: string;
  new_key_id: string;
  rotation_completed_at: string;
  affected_records?: number;
  migration_status: 'completed' | 'in_progress' | 'failed';
  rollback_available: boolean;
}

// ==================== SECURITY MONITORING ====================

export interface SecurityAlert {
  id: string;
  alert_type: AlertType;
  severity: SeverityLevel;
  title: string;
  description: string;
  source_system: string;
  affected_resources: string[];
  detection_time: string;
  acknowledgment_time?: string;
  resolution_time?: string;
  is_acknowledged: boolean;
  is_resolved: boolean;
  alert_data: AlertData;
  correlation_events: string[]; // Related event IDs
  false_positive_probability: number; // 0-100
  mitigation_suggestions: string[];
  assigned_to?: string;
  tags: string[];
}

export type AlertType = 
  | 'authentication_anomaly'
  | 'authorization_violation'
  | 'data_breach_attempt'
  | 'unusual_activity_pattern'
  | 'system_compromise_indicator'
  | 'policy_violation'
  | 'performance_degradation'
  | 'availability_threat'
  | 'compliance_violation'
  | 'fraud_indicator';

export interface AlertData {
  metrics: Record<string, number>;
  thresholds: Record<string, number>;
  trends: Array<{
    timestamp: string;
    value: number;
    baseline: number;
    deviation_percent: number;
  }>;
  geographic_data?: GeolocationData[];
  user_behavior_analysis?: {
    normal_pattern_score: number; // 0-100
    anomaly_score: number; // 0-100
    behavioral_indicators: string[];
  };
  network_indicators?: {
    suspicious_ips: string[];
    unusual_traffic_patterns: string[];
    protocol_anomalies: string[];
  };
}

export interface SecurityMetrics {
  timestamp: string;
  authentication_failures: number;
  successful_logins: number;
  blocked_requests: number;
  intrusion_attempts: number;
  active_sessions: number;
  data_access_volume: number;
  encryption_operations: number;
  audit_log_entries: number;
  rls_policy_violations: number;
  alert_count_by_severity: Record<SeverityLevel, number>;
  response_times: {
    average_ms: number;
    p95_ms: number;
    p99_ms: number;
  };
  system_health: {
    cpu_usage_percent: number;
    memory_usage_percent: number;
    disk_usage_percent: number;
    network_throughput_mbps: number;
  };
}

export interface SecurityDashboard {
  overview: {
    total_alerts: number;
    unresolved_critical: number;
    security_score: number; // 0-100
    compliance_status: 'compliant' | 'warning' | 'violation';
    last_incident: string;
    uptime_percentage: number;
  };
  recent_alerts: SecurityAlert[];
  threat_trends: Array<{
    date: string;
    threat_count: number;
    severity_breakdown: Record<SeverityLevel, number>;
  }>;
  top_threats: Array<{
    threat_type: string;
    count: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  geographic_threats: Array<{
    country: string;
    threat_count: number;
    primary_threat_types: string[];
  }>;
  system_status: {
    database_health: 'healthy' | 'degraded' | 'critical';
    api_availability: number; // 0-100
    monitoring_status: 'active' | 'partial' | 'offline';
  };
}

// ==================== SECURITY CONFIGURATION ====================

export interface SecurityConfig {
  authentication: {
    session_timeout_minutes: number;
    max_failed_attempts: number;
    lockout_duration_minutes: number;
    password_policy: PasswordPolicy;
    mfa_required: boolean;
  };
  encryption: {
    default_algorithm: EncryptionAlgorithm;
    key_rotation_days: number;
    data_at_rest_encryption: boolean;
    data_in_transit_encryption: boolean;
  };
  monitoring: {
    audit_log_retention_days: number;
    alert_retention_days: number;
    real_time_monitoring: boolean;
    anomaly_detection_sensitivity: number; // 0-100
  };
  intrusion_detection: {
    auto_block_enabled: boolean;
    block_duration_minutes: number;
    detection_thresholds: Record<IntrusionType, number>;
    notification_channels: string[];
  };
  compliance: {
    gdpr_enabled: boolean;
    audit_trail_immutable: boolean;
    data_retention_days: number;
    right_to_deletion_enabled: boolean;
  };
}

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  max_age_days: number;
  history_count: number; // Prevent reuse
  dictionary_check: boolean;
}

// ==================== ERROR TYPES ====================

export interface SecurityError {
  error: string;
  message: string;
  code: string;
  severity: SeverityLevel;
  security_context: {
    user_id?: string;
    ip_address?: string;
    resource_accessed?: string;
    permission_required?: string;
    audit_logged: boolean;
  };
  timestamp: string;
  correlation_id: string;
}

export interface AuthorizationError extends SecurityError {
  error: 'authorization_denied';
  required_permissions: string[];
  user_permissions: string[];
  resource_context: Record<string, any>;
}

export interface IntrusionDetectedError extends SecurityError {
  error: 'intrusion_detected';
  intrusion_type: IntrusionType;
  detection_rules_triggered: string[];
  mitigation_applied: ResolutionAction[];
  block_duration_minutes?: number;
}

// ==================== API REQUEST/RESPONSE TYPES ====================

export interface SecurityStatusRequest {
  include_metrics?: boolean;
  include_alerts?: boolean;
  time_range_minutes?: number; // default 60
}

export interface SecurityStatusResponse {
  status: 'secure' | 'warning' | 'critical';
  security_score: number; // 0-100
  active_threats: number;
  security_metrics?: SecurityMetrics;
  recent_alerts?: SecurityAlert[];
  recommendations: string[];
  last_updated: string;
}

export interface BulkAuditLogRequest {
  logs: AuditLogRequest[];
  batch_id: string;
  correlation_id: string;
}

export interface BulkAuditLogResponse {
  success: boolean;
  processed_count: number;
  failed_count: number;
  batch_id: string;
  failed_logs?: Array<{
    log: AuditLogRequest;
    error: string;
  }>;
  processing_time_ms: number;
}

export interface SecurityReportRequest {
  report_type: 'audit' | 'intrusion' | 'compliance' | 'performance';
  start_date: string;
  end_date: string;
  format: 'json' | 'csv' | 'pdf';
  include_raw_data?: boolean;
  filters?: Record<string, any>;
}

export interface SecurityReportResponse {
  report_id: string;
  report_type: string;
  generated_at: string;
  data_url?: string; // For download
  summary: {
    total_records: number;
    date_range: {
      start: string;
      end: string;
    };
    key_findings: string[];
    compliance_status?: string;
    risk_assessment?: string;
  };
  expires_at: string;
}