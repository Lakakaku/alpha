// Communication Systems Types
// Feature: Communication Systems
// Created: 2025-09-26

// Core enums matching database schema
export type RecipientType = 'customer' | 'business' | 'admin';

export type NotificationType = 
  | 'reward_earned'
  | 'payment_confirmed'
  | 'verification_request'
  | 'payment_overdue'
  | 'support_response'
  | 'weekly_summary'
  | 'verification_failed';

export type CommunicationChannel = 'sms' | 'email' | 'internal';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export type SupportCategory = 'payment' | 'verification' | 'technical' | 'feedback' | 'general';

export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportStatus = 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';

export type SupportChannel = 'phone' | 'email' | 'web_chat' | 'internal';

export type ChannelPreference = 'sms' | 'email' | 'both' | 'none';

export type UserType = 'customer' | 'business';

export type LogAction = 'sent' | 'delivered' | 'failed' | 'retry' | 'cancelled';

export type RetryStatus = 'scheduled' | 'attempted' | 'succeeded' | 'failed' | 'cancelled';

export type SenderType = 'customer' | 'business' | 'admin' | 'system';

// Main notification entity interface
export interface CommunicationNotification {
  id: string;
  recipient_type: RecipientType;
  recipient_id: string;
  recipient_phone?: string;
  recipient_email?: string;
  notification_type: NotificationType;
  channel: CommunicationChannel;
  template_id?: string;
  content: string;
  status: NotificationStatus;
  retry_count: number;
  scheduled_at: string; // ISO timestamp
  sent_at?: string;
  delivered_at?: string;
  failed_reason?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Template management interface
export interface CommunicationTemplate {
  id: string;
  name: string;
  notification_type: NotificationType;
  channel: CommunicationChannel;
  language: string;
  subject_template?: string; // Required for email, null for SMS
  content_template: string;
  required_variables: string[];
  is_active: boolean;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// User communication preferences interface
export interface CommunicationPreference {
  id: string;
  user_type: UserType;
  user_id: string;
  notification_type: NotificationType;
  channel_preference: ChannelPreference;
  frequency_limit: number;
  language_preference: string;
  quiet_hours_start: string; // Time format "HH:MM"
  quiet_hours_end: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Support ticket interface
export interface SupportTicket {
  id: string;
  ticket_number: string;
  requester_type: UserType;
  requester_id: string;
  requester_contact: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  subject: string;
  description: string;
  assigned_to?: string;
  channel: SupportChannel;
  sla_deadline: string; // ISO timestamp
  first_response_at?: string;
  resolved_at?: string;
  satisfaction_rating?: number; // 1-5 scale
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

// Support ticket message interface
export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_id?: string;
  message_content: string;
  is_internal: boolean;
  attachments: string[];
  created_at: string;
}

// Communication audit log interface
export interface CommunicationLog {
  id: string;
  action: LogAction;
  notification_id?: string;
  admin_user_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Retry schedule interface
export interface CommunicationRetrySchedule {
  id: string;
  notification_id: string;
  attempt_number: number; // 1-3
  scheduled_at: string; // ISO timestamp
  attempted_at?: string;
  status: RetryStatus;
  failure_reason?: string;
  created_at: string;
}

// API request/response types for notifications
export interface CreateNotificationRequest {
  recipient_type: RecipientType;
  recipient_id: string;
  recipient_phone?: string;
  recipient_email?: string;
  notification_type: NotificationType;
  channel: CommunicationChannel;
  template_id?: string;
  content?: string; // If not using template
  scheduled_at?: string;
  metadata?: Record<string, any>;
}

export interface NotificationResponse {
  id: string;
  status: NotificationStatus;
  scheduled_at: string;
  created_at: string;
}

// API types for templates
export interface CreateTemplateRequest {
  name: string;
  notification_type: NotificationType;
  channel: CommunicationChannel;
  language: string;
  subject_template?: string;
  content_template: string;
  required_variables: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  subject_template?: string;
  content_template?: string;
  required_variables?: string[];
  is_active?: boolean;
}

export interface TemplateValidationResult {
  is_valid: boolean;
  missing_variables: string[];
  invalid_syntax: string[];
  character_count: number;
  warnings: string[];
}

// API types for support tickets
export interface CreateSupportTicketRequest {
  requester_type: UserType;
  requester_id: string;
  requester_contact: string;
  category: SupportCategory;
  priority?: SupportPriority;
  subject: string;
  description: string;
  channel: SupportChannel;
}

export interface UpdateSupportTicketRequest {
  priority?: SupportPriority;
  status?: SupportStatus;
  assigned_to?: string;
  internal_notes?: string;
  satisfaction_rating?: number;
}

export interface CreateTicketMessageRequest {
  ticket_id: string;
  sender_type: SenderType;
  sender_id?: string;
  message_content: string;
  is_internal?: boolean;
  attachments?: string[];
}

// API types for communication preferences
export interface UpdatePreferencesRequest {
  preferences: Array<{
    notification_type: NotificationType;
    channel_preference: ChannelPreference;
    frequency_limit?: number;
    language_preference?: string;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
    is_active?: boolean;
  }>;
}

// SMS provider interface (Twilio abstraction)
export interface SMSProvider {
  sendSMS(to: string, body: string, mediaUrls?: string[]): Promise<SMSResult>;
  getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus>;
  validatePhoneNumber(phoneNumber: string): Promise<PhoneValidationResult>;
}

export interface SMSResult {
  success: boolean;
  message_id?: string;
  error?: string;
  cost?: number;
  segments?: number;
}

export interface SMSDeliveryStatus {
  message_id: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  error_code?: string;
  error_message?: string;
  delivered_at?: string;
}

export interface PhoneValidationResult {
  is_valid: boolean;
  formatted_number: string;
  country_code: string;
  carrier?: string;
  line_type?: 'mobile' | 'landline' | 'voip';
}

// Template rendering interface
export interface TemplateRenderer {
  render(template: string, variables: Record<string, any>): Promise<string>;
  validate(template: string, requiredVariables: string[]): TemplateValidationResult;
  getVariablesFromTemplate(template: string): string[];
}

// Notification processing interfaces
export interface NotificationProcessor {
  processNotification(notification: CommunicationNotification): Promise<void>;
  scheduleRetry(notificationId: string, attemptNumber: number): Promise<void>;
  cancelNotification(notificationId: string): Promise<void>;
  getNotificationStatus(notificationId: string): Promise<NotificationStatus>;
}

// Batch processing types
export interface BatchNotificationRequest {
  notifications: CreateNotificationRequest[];
  batch_id?: string;
  priority?: SupportPriority;
}

export interface BatchNotificationResult {
  batch_id: string;
  total_notifications: number;
  successful: number;
  failed: number;
  pending: number;
  failed_notifications: Array<{
    request: CreateNotificationRequest;
    error: string;
  }>;
}

// Webhook types for Twilio callbacks
export interface TwilioWebhookPayload {
  MessageSid: string;
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  ErrorCode?: string;
  ErrorMessage?: string;
  DateSent?: string;
  DateUpdated?: string;
  To: string;
  From: string;
  Body: string;
}

// Analytics and reporting types
export interface CommunicationMetrics {
  total_notifications_sent: number;
  delivery_rate: number;
  failure_rate: number;
  average_delivery_time_seconds: number;
  cost_per_notification: number;
  notifications_by_type: Record<NotificationType, number>;
  notifications_by_channel: Record<CommunicationChannel, number>;
  support_tickets_by_status: Record<SupportStatus, number>;
  average_response_time_hours: number;
  sla_compliance_rate: number;
}

export interface CommunicationReport {
  date_range: {
    start: string;
    end: string;
  };
  metrics: CommunicationMetrics;
  top_failure_reasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  template_performance: Array<{
    template_id: string;
    template_name: string;
    usage_count: number;
    delivery_rate: number;
  }>;
}

// Error types for communication system
export class CommunicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CommunicationError';
  }
}

export class SMSError extends CommunicationError {
  constructor(message: string, public provider_error?: any) {
    super(message, 'SMS_ERROR', { provider_error });
    this.name = 'SMSError';
  }
}

export class TemplateError extends CommunicationError {
  constructor(message: string, public template_id?: string) {
    super(message, 'TEMPLATE_ERROR', { template_id });
    this.name = 'TemplateError';
  }
}

export class SupportTicketError extends CommunicationError {
  constructor(message: string, public ticket_id?: string) {
    super(message, 'SUPPORT_TICKET_ERROR', { ticket_id });
    this.name = 'SupportTicketError';
  }
}

// Export all types for easy importing
export * from './communication';