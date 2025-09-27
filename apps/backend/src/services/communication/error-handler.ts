import { supabase } from '@vocilia/database';
import { SmsProvider } from './sms-provider';
import { NotificationProcessor } from './notification-processor';
import { SupportTicketManager } from './support-ticket-manager';
import { Logger } from '../loggingService';

export interface CommunicationError {
  id: string;
  type: 'sms_delivery_failed' | 'email_delivery_failed' | 'template_rendering_failed' | 'rate_limit_exceeded' | 'provider_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_id: string; // notification_id, template_id, etc.
  error_code?: string;
  error_message: string;
  error_details?: Record<string, any>;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  resolved: boolean;
  resolved_at?: string;
  resolution_method?: 'auto_retry' | 'manual_intervention' | 'escalation' | 'ignored';
  created_at: string;
  updated_at: string;
}

export interface EscalationRule {
  error_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retry_threshold: number;
  escalation_delay_minutes: number;
  escalation_channels: ('email' | 'sms' | 'support_ticket')[];
  escalation_recipients: string[];
  auto_actions: ('create_support_ticket' | 'notify_admin' | 'disable_template' | 'switch_provider')[];
}

export interface ErrorPattern {
  pattern: string;
  error_type: string;
  suggested_actions: string[];
  auto_resolve: boolean;
}

export class CommunicationErrorHandler {
  private smsProvider: SmsProvider;
  private notificationProcessor: NotificationProcessor;
  private supportTicketManager: SupportTicketManager;
  private logger: Logger;

  private escalationRules: EscalationRule[] = [
    {
      error_type: 'sms_delivery_failed',
      severity: 'high',
      retry_threshold: 3,
      escalation_delay_minutes: 15,
      escalation_channels: ['email', 'support_ticket'],
      escalation_recipients: ['sms-admin@vocilia.se'],
      auto_actions: ['create_support_ticket', 'notify_admin']
    },
    {
      error_type: 'rate_limit_exceeded',
      severity: 'medium',
      retry_threshold: 2,
      escalation_delay_minutes: 30,
      escalation_channels: ['email'],
      escalation_recipients: ['tech-team@vocilia.se'],
      auto_actions: ['notify_admin']
    },
    {
      error_type: 'provider_error',
      severity: 'critical',
      retry_threshold: 1,
      escalation_delay_minutes: 5,
      escalation_channels: ['email', 'sms', 'support_ticket'],
      escalation_recipients: ['emergency@vocilia.se', '+46701234567'],
      auto_actions: ['create_support_ticket', 'notify_admin', 'switch_provider']
    }
  ];

  private errorPatterns: ErrorPattern[] = [
    {
      pattern: 'Invalid phone number|Phone number not found',
      error_type: 'invalid_phone_number',
      suggested_actions: ['Validate phone number format', 'Check customer contact information'],
      auto_resolve: false
    },
    {
      pattern: 'Rate limit exceeded|Too many requests',
      error_type: 'rate_limit_exceeded',
      suggested_actions: ['Implement backoff strategy', 'Spread requests over time'],
      auto_resolve: true
    },
    {
      pattern: 'Network timeout|Connection failed',
      error_type: 'network_error',
      suggested_actions: ['Retry after delay', 'Check provider status'],
      auto_resolve: true
    },
    {
      pattern: 'Account suspended|Authentication failed',
      error_type: 'provider_account_issue',
      suggested_actions: ['Check account status', 'Verify API credentials', 'Contact provider'],
      auto_resolve: false
    }
  ];

  constructor() {
    this.smsProvider = new SmsProvider();
    this.notificationProcessor = new NotificationProcessor();
    this.supportTicketManager = new SupportTicketManager();
    this.logger = new Logger('CommunicationErrorHandler');
  }

  /**
   * Process and handle communication errors
   */
  async handleError(error: Partial<CommunicationError>): Promise<CommunicationError> {
    try {
      // Analyze error and determine type/severity
      const analyzedError = await this.analyzeError(error);
      
      // Store error in database
      const storedError = await this.storeError(analyzedError);
      
      // Check if error should be escalated
      const shouldEscalate = await this.shouldEscalate(storedError);
      
      if (shouldEscalate) {
        await this.escalateError(storedError);
      } else {
        // Attempt automatic resolution
        await this.attemptAutoResolution(storedError);
      }
      
      // Log error for monitoring
      await this.logError(storedError);
      
      return storedError;
    } catch (handlingError) {
      this.logger.error('Failed to handle communication error', {
        originalError: error,
        handlingError: handlingError.message
      });
      throw handlingError;
    }
  }

  /**
   * Analyze error to determine type, severity, and patterns
   */
  private async analyzeError(error: Partial<CommunicationError>): Promise<CommunicationError> {
    const errorMessage = error.error_message || '';
    const errorCode = error.error_code || '';
    
    // Determine error type based on patterns
    let errorType = error.type || 'unknown_error';
    let suggestedActions: string[] = [];
    let autoResolve = false;
    
    for (const pattern of this.errorPatterns) {
      const regex = new RegExp(pattern.pattern, 'i');
      if (regex.test(errorMessage) || regex.test(errorCode)) {
        errorType = pattern.error_type;
        suggestedActions = pattern.suggested_actions;
        autoResolve = pattern.auto_resolve;
        break;
      }
    }
    
    // Determine severity based on error type and context
    const severity = this.determineSeverity(errorType, error);
    
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: errorType as any,
      severity,
      source_id: error.source_id || '',
      error_code: error.error_code,
      error_message: error.error_message || '',
      error_details: {
        ...error.error_details,
        suggested_actions: suggestedActions,
        auto_resolve: autoResolve,
        analyzed_at: new Date().toISOString()
      },
      retry_count: error.retry_count || 0,
      max_retries: error.max_retries || 3,
      next_retry_at: error.next_retry_at,
      resolved: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Determine error severity based on type and context
   */
  private determineSeverity(errorType: string, error: Partial<CommunicationError>): 'low' | 'medium' | 'high' | 'critical' {
    // High priority for customer-facing failures
    if (errorType.includes('sms_delivery_failed') || errorType.includes('email_delivery_failed')) {
      return error.retry_count && error.retry_count > 2 ? 'high' : 'medium';
    }
    
    // Critical for provider or system failures
    if (errorType.includes('provider_error') || errorType.includes('provider_account_issue')) {
      return 'critical';
    }
    
    // Medium for rate limiting (affects throughput)
    if (errorType.includes('rate_limit_exceeded')) {
      return 'medium';
    }
    
    // Low for template or validation errors
    if (errorType.includes('template_rendering_failed') || errorType.includes('invalid_phone_number')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Store error in database for tracking
   */
  private async storeError(error: CommunicationError): Promise<CommunicationError> {
    const { data, error: dbError } = await supabase
      .from('communication_errors')
      .insert(error)
      .select()
      .single();
    
    if (dbError) {
      this.logger.error('Failed to store communication error', dbError);
      throw new Error(`Failed to store error: ${dbError.message}`);
    }
    
    return data;
  }

  /**
   * Check if error should be escalated based on rules
   */
  private async shouldEscalate(error: CommunicationError): Promise<boolean> {
    const rule = this.escalationRules.find(r => 
      r.error_type === error.type && r.severity === error.severity
    );
    
    if (!rule) return false;
    
    // Escalate if retry threshold exceeded
    if (error.retry_count >= rule.retry_threshold) {
      return true;
    }
    
    // Escalate if error is critical
    if (error.severity === 'critical') {
      return true;
    }
    
    // Check if similar errors are occurring frequently
    const recentSimilarErrors = await this.getRecentSimilarErrors(error.type, 60); // Last hour
    if (recentSimilarErrors.length > 10) {
      return true;
    }
    
    return false;
  }

  /**
   * Escalate error according to escalation rules
   */
  private async escalateError(error: CommunicationError): Promise<void> {
    const rule = this.escalationRules.find(r => 
      r.error_type === error.type && r.severity === error.severity
    );
    
    if (!rule) return;
    
    this.logger.warn('Escalating communication error', {
      errorId: error.id,
      errorType: error.type,
      severity: error.severity
    });
    
    // Execute auto actions
    for (const action of rule.auto_actions) {
      try {
        switch (action) {
          case 'create_support_ticket':
            await this.createSupportTicket(error);
            break;
          case 'notify_admin':
            await this.notifyAdministrators(error, rule);
            break;
          case 'disable_template':
            await this.disableProblematicTemplate(error);
            break;
          case 'switch_provider':
            await this.switchSmsProvider(error);
            break;
        }
      } catch (actionError) {
        this.logger.error(`Failed to execute escalation action: ${action}`, actionError);
      }
    }
    
    // Mark error as escalated
    await this.markErrorAsEscalated(error.id);
  }

  /**
   * Attempt automatic resolution of error
   */
  private async attemptAutoResolution(error: CommunicationError): Promise<void> {
    const autoResolve = error.error_details?.auto_resolve;
    
    if (!autoResolve) return;
    
    try {
      switch (error.type) {
        case 'rate_limit_exceeded':
          await this.handleRateLimitError(error);
          break;
        case 'network_error':
          await this.handleNetworkError(error);
          break;
        default:
          // No automatic resolution available
          break;
      }
    } catch (resolutionError) {
      this.logger.error('Failed to auto-resolve error', {
        errorId: error.id,
        resolutionError: resolutionError.message
      });
    }
  }

  /**
   * Handle rate limit errors with backoff strategy
   */
  private async handleRateLimitError(error: CommunicationError): Promise<void> {
    const backoffMinutes = Math.pow(2, error.retry_count) * 5; // Exponential backoff
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    
    await supabase
      .from('communication_errors')
      .update({
        next_retry_at: nextRetryAt.toISOString(),
        error_details: {
          ...error.error_details,
          backoff_minutes: backoffMinutes,
          auto_resolution_attempted: true
        }
      })
      .eq('id', error.id);
    
    // Schedule retry
    setTimeout(async () => {
      await this.retryFailedOperation(error);
    }, backoffMinutes * 60 * 1000);
  }

  /**
   * Handle network errors with immediate retry
   */
  private async handleNetworkError(error: CommunicationError): Promise<void> {
    if (error.retry_count < error.max_retries) {
      // Wait 30 seconds then retry
      setTimeout(async () => {
        await this.retryFailedOperation(error);
      }, 30000);
    }
  }

  /**
   * Retry failed operation
   */
  private async retryFailedOperation(error: CommunicationError): Promise<void> {
    try {
      // Update retry count
      await supabase
        .from('communication_errors')
        .update({
          retry_count: error.retry_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', error.id);
      
      // Attempt to resend based on source type
      if (error.source_id.startsWith('notification_')) {
        await this.notificationProcessor.retryNotification(error.source_id);
      } else if (error.source_id.startsWith('sms_')) {
        // Retry SMS through provider
        const smsDetails = error.error_details?.original_request;
        if (smsDetails) {
          await this.smsProvider.sendSmsWithRetry(smsDetails);
        }
      }
      
      // Mark as resolved if successful
      await this.markErrorAsResolved(error.id, 'auto_retry');
      
    } catch (retryError) {
      this.logger.error('Failed to retry operation', {
        errorId: error.id,
        retryError: retryError.message
      });
      
      // If max retries exceeded, escalate
      if (error.retry_count + 1 >= error.max_retries) {
        await this.escalateError({...error, retry_count: error.retry_count + 1});
      }
    }
  }

  /**
   * Create support ticket for escalated errors
   */
  private async createSupportTicket(error: CommunicationError): Promise<void> {
    const ticketData = {
      title: `Kommunikationsfel: ${error.type}`,
      category: 'technical',
      priority: error.severity === 'critical' ? 'urgent' : 'high',
      description: `
Automatiskt genererat supportärende för kommunikationsfel.

Feltyp: ${error.type}
Allvarlighetsgrad: ${error.severity}
Felmeddelande: ${error.error_message}
Källa: ${error.source_id}
Antal försök: ${error.retry_count}/${error.max_retries}

Fel-ID: ${error.id}
Skapad: ${error.created_at}

Föreslagna åtgärder:
${error.error_details?.suggested_actions?.map(action => `- ${action}`).join('\n') || 'Inga förslag tillgängliga'}
      `,
      contact_email: 'system@vocilia.se',
      metadata: {
        error_id: error.id,
        error_type: error.type,
        auto_generated: true
      }
    };
    
    await this.supportTicketManager.createTicket(ticketData);
  }

  /**
   * Notify administrators about critical errors
   */
  private async notifyAdministrators(error: CommunicationError, rule: EscalationRule): Promise<void> {
    const notification = {
      recipients: rule.escalation_recipients,
      channels: rule.escalation_channels,
      subject: `ALERT: Kommunikationsfel - ${error.type}`,
      message: `
Kritiskt kommunikationsfel upptäckt:

Typ: ${error.type}
Allvarlighetstgrad: ${error.severity}
Meddelande: ${error.error_message}
Källa: ${error.source_id}
Tid: ${error.created_at}

Detta kräver omedelbar uppmärksamhet.
Fel-ID: ${error.id}
      `,
      priority: error.severity === 'critical' ? 'urgent' : 'high'
    };
    
    // Send notifications through available channels
    for (const channel of rule.escalation_channels) {
      try {
        if (channel === 'email') {
          // Send email notification
          await this.sendEmailNotification(notification);
        } else if (channel === 'sms') {
          // Send SMS notification
          await this.sendSmsNotification(notification);
        }
      } catch (notificationError) {
        this.logger.error(`Failed to send ${channel} notification`, notificationError);
      }
    }
  }

  /**
   * Disable problematic template to prevent further errors
   */
  private async disableProblematicTemplate(error: CommunicationError): Promise<void> {
    if (error.source_id.startsWith('template_')) {
      await supabase
        .from('communication_templates')
        .update({
          is_active: false,
          disabled_reason: `Automatic disable due to error: ${error.error_message}`,
          disabled_at: new Date().toISOString()
        })
        .eq('id', error.source_id);
      
      this.logger.warn('Disabled problematic template', {
        templateId: error.source_id,
        errorId: error.id
      });
    }
  }

  /**
   * Switch to backup SMS provider
   */
  private async switchSmsProvider(error: CommunicationError): Promise<void> {
    if (error.type.includes('sms') || error.type.includes('provider')) {
      // Implement provider switching logic
      this.logger.warn('SMS provider switch triggered', {
        errorId: error.id,
        errorType: error.type
      });
      
      // This would trigger failover to backup provider
      // Implementation depends on SMS provider architecture
    }
  }

  /**
   * Get recent similar errors for pattern detection
   */
  private async getRecentSimilarErrors(errorType: string, lastMinutes: number): Promise<CommunicationError[]> {
    const since = new Date(Date.now() - lastMinutes * 60 * 1000);
    
    const { data, error } = await supabase
      .from('communication_errors')
      .select('*')
      .eq('type', errorType)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      this.logger.error('Failed to fetch recent similar errors', error);
      return [];
    }
    
    return data || [];
  }

  /**
   * Mark error as escalated
   */
  private async markErrorAsEscalated(errorId: string): Promise<void> {
    await supabase
      .from('communication_errors')
      .update({
        escalated: true,
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', errorId);
  }

  /**
   * Mark error as resolved
   */
  private async markErrorAsResolved(errorId: string, method: string): Promise<void> {
    await supabase
      .from('communication_errors')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_method: method,
        updated_at: new Date().toISOString()
      })
      .eq('id', errorId);
  }

  /**
   * Log error for monitoring and analytics
   */
  private async logError(error: CommunicationError): Promise<void> {
    this.logger.error('Communication error occurred', {
      errorId: error.id,
      type: error.type,
      severity: error.severity,
      sourceId: error.source_id,
      retryCount: error.retry_count,
      message: error.error_message
    });
  }

  /**
   * Send email notification (placeholder implementation)
   */
  private async sendEmailNotification(notification: any): Promise<void> {
    // Implementation would depend on email service
    this.logger.info('Email notification sent', {
      recipients: notification.recipients,
      subject: notification.subject
    });
  }

  /**
   * Send SMS notification (placeholder implementation)
   */
  private async sendSmsNotification(notification: any): Promise<void> {
    // Implementation would use SMS provider
    this.logger.info('SMS notification sent', {
      recipients: notification.recipients
    });
  }

  /**
   * Get error statistics for monitoring
   */
  async getErrorStatistics(timeframe: 'last_hour' | 'last_day' | 'last_week'): Promise<any> {
    const timeframes = {
      last_hour: 1,
      last_day: 24,
      last_week: 168
    };
    
    const hours = timeframes[timeframe];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .rpc('get_communication_error_stats', {
        since_timestamp: since.toISOString()
      });
    
    if (error) {
      this.logger.error('Failed to get error statistics', error);
      throw new Error(`Failed to get error statistics: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Get unresolved errors requiring attention
   */
  async getUnresolvedErrors(): Promise<CommunicationError[]> {
    const { data, error } = await supabase
      .from('communication_errors')
      .select('*')
      .eq('resolved', false)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: true });
    
    if (error) {
      this.logger.error('Failed to get unresolved errors', error);
      throw new Error(`Failed to get unresolved errors: ${error.message}`);
    }
    
    return data || [];
  }
}