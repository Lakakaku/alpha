import { z } from 'zod';

// Configuration validation schemas
const smsProviderConfigSchema = z.object({
  provider: z.enum(['twilio']),
  accountSid: z.string().min(1, 'SMS Account SID is required'),
  authToken: z.string().min(1, 'SMS Auth Token is required'),
  phoneNumber: z.string().min(1, 'SMS Phone Number is required'),
  webhookUrl: z.string().url('Invalid webhook URL'),
  enabled: z.boolean().default(true),
  rateLimitPerMinute: z.number().min(1).max(1000).default(30),
  maxRetries: z.number().min(0).max(10).default(3),
  retryIntervals: z.array(z.number()).default([0, 300, 1800]), // seconds
  maxCharacterLimit: z.number().min(1).max(1600).default(1600)
});

const templateConfigSchema = z.object({
  defaultLanguage: z.enum(['sv', 'en']).default('sv'),
  supportedLanguages: z.array(z.enum(['sv', 'en'])).default(['sv', 'en']),
  validationEnabled: z.boolean().default(true),
  versionControlEnabled: z.boolean().default(true),
  maxTemplateLength: z.number().min(1).max(1600).default(1600),
  maxVariables: z.number().min(1).max(50).default(20),
  requiredTemplates: z.array(z.string()).default([
    'reward_earned',
    'payment_confirmation',
    'verification_request',
    'payment_reminder',
    'support_response',
    'weekly_summary'
  ])
});

const supportConfigSchema = z.object({
  defaultSlaHours: z.number().min(0.1).max(168).default(2), // Max 1 week
  phoneSlaSeconds: z.number().min(1).max(300).default(30),
  emailSlaHours: z.number().min(0.1).max(48).default(2),
  chatSlaHours: z.number().min(0.1).max(48).default(2),
  escalationEnabled: z.boolean().default(true),
  autoAssignmentEnabled: z.boolean().default(true),
  maxTicketsPerCustomer: z.number().min(1).max(100).default(10),
  priorityLevels: z.array(z.string()).default(['low', 'medium', 'high', 'urgent']),
  categories: z.array(z.string()).default(['payment', 'verification', 'technical', 'account', 'feedback', 'other'])
});

const notificationConfigSchema = z.object({
  processorIntervalSeconds: z.number().min(10).max(3600).default(30),
  batchSize: z.number().min(1).max(1000).default(50),
  retryEnabled: z.boolean().default(true),
  quietHoursStart: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default('22:00'),
  quietHoursEnd: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
  priorityProcessing: z.boolean().default(true),
  maxProcessingTimeMs: z.number().min(1000).max(1800000).default(300000) // 5 minutes
});

const auditConfigSchema = z.object({
  enabled: z.boolean().default(true),
  logRetentionDays: z.number().min(1).max(2555).default(365), // Max 7 years
  metricsEnabled: z.boolean().default(true),
  detailedLogging: z.boolean().default(true),
  sensitiveDataMasking: z.boolean().default(true),
  logLevels: z.array(z.enum(['error', 'warn', 'info', 'debug'])).default(['error', 'warn', 'info'])
});

// Main configuration schema
const communicationConfigSchema = z.object({
  sms: smsProviderConfigSchema,
  templates: templateConfigSchema,
  support: supportConfigSchema,
  notifications: notificationConfigSchema,
  audit: auditConfigSchema,
  environment: z.enum(['development', 'production', 'test']).default('development'),
  timezone: z.string().default('Europe/Stockholm'),
  healthCheckInterval: z.number().min(10).max(3600).default(60) // seconds
});

// Type definitions
export type SMSProviderConfig = z.infer<typeof smsProviderConfigSchema>;
export type TemplateConfig = z.infer<typeof templateConfigSchema>;
export type SupportConfig = z.infer<typeof supportConfigSchema>;
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type AuditConfig = z.infer<typeof auditConfigSchema>;
export type CommunicationConfig = z.infer<typeof communicationConfigSchema>;

// Load and validate configuration
function loadCommunicationConfig(): CommunicationConfig {
  const config = {
    sms: {
      provider: 'twilio' as const,
      accountSid: process.env.TWILIO_SMS_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_SMS_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_SMS_PHONE_NUMBER || '',
      webhookUrl: process.env.TWILIO_SMS_WEBHOOK_URL || '',
      enabled: process.env.SMS_PROVIDER_ENABLED !== 'false',
      rateLimitPerMinute: parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '30'),
      maxRetries: parseInt(process.env.SMS_MAX_RETRIES || '3'),
      retryIntervals: (process.env.SMS_RETRY_INTERVALS || '0,300,1800')
        .split(',')
        .map(interval => parseInt(interval.trim())),
      maxCharacterLimit: parseInt(process.env.SMS_MAX_CHARACTER_LIMIT || '1600')
    },
    templates: {
      defaultLanguage: (process.env.TEMPLATE_DEFAULT_LANGUAGE || 'sv') as 'sv' | 'en',
      supportedLanguages: (process.env.TEMPLATE_SUPPORTED_LANGUAGES || 'sv,en')
        .split(',')
        .map(lang => lang.trim()) as ('sv' | 'en')[],
      validationEnabled: process.env.TEMPLATE_VALIDATION_ENABLED !== 'false',
      versionControlEnabled: process.env.TEMPLATE_VERSION_CONTROL_ENABLED !== 'false',
      maxTemplateLength: parseInt(process.env.TEMPLATE_MAX_LENGTH || '1600'),
      maxVariables: parseInt(process.env.TEMPLATE_MAX_VARIABLES || '20'),
      requiredTemplates: (process.env.TEMPLATE_REQUIRED_TYPES || 'reward_earned,payment_confirmation,verification_request,payment_reminder,support_response,weekly_summary')
        .split(',')
        .map(type => type.trim())
    },
    support: {
      defaultSlaHours: parseFloat(process.env.SUPPORT_DEFAULT_SLA_HOURS || '2'),
      phoneSlaSeconds: parseInt(process.env.SUPPORT_PHONE_SLA_SECONDS || '30'),
      emailSlaHours: parseFloat(process.env.SUPPORT_EMAIL_SLA_HOURS || '2'),
      chatSlaHours: parseFloat(process.env.SUPPORT_CHAT_SLA_HOURS || '2'),
      escalationEnabled: process.env.SUPPORT_ESCALATION_ENABLED !== 'false',
      autoAssignmentEnabled: process.env.SUPPORT_AUTO_ASSIGNMENT_ENABLED !== 'false',
      maxTicketsPerCustomer: parseInt(process.env.SUPPORT_MAX_TICKETS_PER_CUSTOMER || '10'),
      priorityLevels: (process.env.SUPPORT_PRIORITY_LEVELS || 'low,medium,high,urgent')
        .split(',')
        .map(level => level.trim()),
      categories: (process.env.SUPPORT_CATEGORIES || 'payment,verification,technical,account,feedback,other')
        .split(',')
        .map(category => category.trim())
    },
    notifications: {
      processorIntervalSeconds: parseInt(process.env.NOTIFICATION_PROCESSOR_INTERVAL_SECONDS || '30'),
      batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '50'),
      retryEnabled: process.env.NOTIFICATION_RETRY_ENABLED !== 'false',
      quietHoursStart: process.env.NOTIFICATION_QUIET_HOURS_START || '22:00',
      quietHoursEnd: process.env.NOTIFICATION_QUIET_HOURS_END || '08:00',
      priorityProcessing: process.env.NOTIFICATION_PRIORITY_PROCESSING !== 'false',
      maxProcessingTimeMs: parseInt(process.env.NOTIFICATION_MAX_PROCESSING_TIME_MS || '300000')
    },
    audit: {
      enabled: process.env.COMMUNICATION_AUDIT_ENABLED !== 'false',
      logRetentionDays: parseInt(process.env.COMMUNICATION_LOG_RETENTION_DAYS || '365'),
      metricsEnabled: process.env.COMMUNICATION_METRICS_ENABLED !== 'false',
      detailedLogging: process.env.COMMUNICATION_DETAILED_LOGGING !== 'false',
      sensitiveDataMasking: process.env.COMMUNICATION_SENSITIVE_DATA_MASKING !== 'false',
      logLevels: (process.env.COMMUNICATION_LOG_LEVELS || 'error,warn,info')
        .split(',')
        .map(level => level.trim()) as ('error' | 'warn' | 'info' | 'debug')[]
    },
    environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    timezone: process.env.COMMUNICATION_TIMEZONE || 'Europe/Stockholm',
    healthCheckInterval: parseInt(process.env.COMMUNICATION_HEALTH_CHECK_INTERVAL || '60')
  };

  // Validate configuration
  try {
    return communicationConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Invalid communication configuration: ${errorMessages}`);
    }
    throw error;
  }
}

// Configuration constants
export const NOTIFICATION_TYPES = [
  'reward_earned',
  'payment_confirmation', 
  'verification_request',
  'payment_reminder',
  'support_response',
  'status_update',
  'weekly_summary',
  'verification_timeout',
  'fraud_alert'
] as const;

export const COMMUNICATION_CHANNELS = [
  'sms',
  'email',
  'push'
] as const;

export const SUPPORT_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent'
] as const;

export const SUPPORT_CATEGORIES = [
  'payment',
  'verification',
  'technical',
  'account',
  'feedback',
  'other'
] as const;

export const NOTIFICATION_STATUSES = [
  'pending',
  'sent',
  'delivered',
  'failed',
  'cancelled',
  'skipped'
] as const;

export const RETRY_TYPES = [
  'automatic',
  'manual'
] as const;

// Configuration helpers
export class CommunicationConfigManager {
  private config: CommunicationConfig;

  constructor() {
    this.config = loadCommunicationConfig();
  }

  /**
   * Get the full configuration
   */
  public getConfig(): CommunicationConfig {
    return this.config;
  }

  /**
   * Get SMS provider configuration
   */
  public getSMSConfig(): SMSProviderConfig {
    return this.config.sms;
  }

  /**
   * Get template configuration
   */
  public getTemplateConfig(): TemplateConfig {
    return this.config.templates;
  }

  /**
   * Get support configuration
   */
  public getSupportConfig(): SupportConfig {
    return this.config.support;
  }

  /**
   * Get notification processing configuration
   */
  public getNotificationConfig(): NotificationConfig {
    return this.config.notifications;
  }

  /**
   * Get audit configuration
   */
  public getAuditConfig(): AuditConfig {
    return this.config.audit;
  }

  /**
   * Check if SMS is enabled
   */
  public isSMSEnabled(): boolean {
    return this.config.sms.enabled;
  }

  /**
   * Check if template validation is enabled
   */
  public isTemplateValidationEnabled(): boolean {
    return this.config.templates.validationEnabled;
  }

  /**
   * Check if support escalation is enabled
   */
  public isSupportEscalationEnabled(): boolean {
    return this.config.support.escalationEnabled;
  }

  /**
   * Check if audit logging is enabled
   */
  public isAuditEnabled(): boolean {
    return this.config.audit.enabled;
  }

  /**
   * Get maximum SMS character limit
   */
  public getMaxSMSLength(): number {
    return this.config.sms.maxCharacterLimit;
  }

  /**
   * Get SMS retry configuration
   */
  public getSMSRetryConfig(): { maxRetries: number; intervals: number[] } {
    return {
      maxRetries: this.config.sms.maxRetries,
      intervals: this.config.sms.retryIntervals
    };
  }

  /**
   * Get SLA configuration for support channel
   */
  public getSupportSLA(channel: 'phone' | 'email' | 'chat'): number {
    switch (channel) {
      case 'phone':
        return this.config.support.phoneSlaSeconds;
      case 'email':
        return this.config.support.emailSlaHours * 3600; // Convert to seconds
      case 'chat':
        return this.config.support.chatSlaHours * 3600; // Convert to seconds
      default:
        return this.config.support.defaultSlaHours * 3600; // Convert to seconds
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  public isQuietHours(timezone?: string): boolean {
    const tz = timezone || this.config.timezone;
    const now = new Date().toLocaleString('sv-SE', { 
      timeZone: tz,
      hour12: false 
    });
    const currentTime = now.split(' ')[1].substring(0, 5); // Extract HH:MM

    const start = this.config.notifications.quietHoursStart;
    const end = this.config.notifications.quietHoursEnd;

    if (start <= end) {
      // Same day range
      return currentTime >= start && currentTime <= end;
    } else {
      // Overnight range
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): string[] {
    return this.config.templates.supportedLanguages;
  }

  /**
   * Get default language
   */
  public getDefaultLanguage(): string {
    return this.config.templates.defaultLanguage;
  }

  /**
   * Validate notification type
   */
  public isValidNotificationType(type: string): boolean {
    return NOTIFICATION_TYPES.includes(type as any);
  }

  /**
   * Validate communication channel
   */
  public isValidChannel(channel: string): boolean {
    return COMMUNICATION_CHANNELS.includes(channel as any);
  }

  /**
   * Get environment
   */
  public getEnvironment(): string {
    return this.config.environment;
  }

  /**
   * Check if running in production
   */
  public isProduction(): boolean {
    return this.config.environment === 'production';
  }

  /**
   * Check if running in development
   */
  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  /**
   * Reload configuration (useful for hot reloading in development)
   */
  public reloadConfig(): void {
    this.config = loadCommunicationConfig();
  }

  /**
   * Validate configuration
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    try {
      communicationConfigSchema.parse(this.config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { valid: false, errors };
      }
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * Get configuration for health check
   */
  public getHealthCheckConfig(): object {
    return {
      sms_enabled: this.config.sms.enabled,
      template_validation: this.config.templates.validationEnabled,
      audit_enabled: this.config.audit.enabled,
      environment: this.config.environment,
      supported_languages: this.config.templates.supportedLanguages,
      notification_processor_interval: this.config.notifications.processorIntervalSeconds,
      quiet_hours: {
        start: this.config.notifications.quietHoursStart,
        end: this.config.notifications.quietHoursEnd,
        currently_quiet: this.isQuietHours()
      }
    };
  }
}

// Export singleton instance
export const communicationConfig = new CommunicationConfigManager();

// Export for testing
export { communicationConfigSchema, loadCommunicationConfig };