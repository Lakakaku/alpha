import { supabase } from '@vocilia/database';
import { NotificationProcessor } from './notification-processor';
import { TemplateManager } from './template-manager';
import { SupportTicketManager } from './support-ticket-manager';
import { Logger } from '../loggingService';
import { addBusinessDays, subBusinessDays, isWeekend, format, differenceInBusinessDays } from 'date-fns';
import { sv } from 'date-fns/locale';

export interface VerificationTimeout {
  id: string;
  business_id: string;
  verification_batch_id: string;
  original_deadline: string;
  current_deadline: string;
  days_overdue: number;
  timeout_stage: 'warning' | 'critical' | 'final' | 'suspended';
  notifications_sent: string[];
  escalation_level: number;
  support_ticket_created: boolean;
  support_ticket_id?: string;
  penalties_applied: boolean;
  service_suspended: boolean;
  manual_intervention_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface VerificationBatch {
  id: string;
  business_id: string;
  batch_week: string;
  deadline: string;
  status: 'pending' | 'submitted' | 'verified' | 'overdue' | 'cancelled';
  transaction_count: number;
  total_amount_sek: number;
  database_delivered: boolean;
  database_delivered_at?: string;
  verification_submitted: boolean;
  verification_submitted_at?: string;
  created_at: string;
}

export interface BusinessInfo {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  organization_number: string;
  tier: 'basic' | 'premium' | 'enterprise';
  is_vip: boolean;
  account_manager_id?: string;
  penalty_tolerance: number; // Days of grace period
  auto_suspend_enabled: boolean;
}

export interface TimeoutAction {
  stage: 'warning' | 'critical' | 'final' | 'suspended';
  days_overdue: number;
  actions: ('send_notification' | 'escalate_support' | 'apply_penalty' | 'suspend_service' | 'contact_account_manager')[];
  notification_template: string;
  escalation_recipients: string[];
}

export class VerificationTimeoutHandler {
  private notificationProcessor: NotificationProcessor;
  private templateManager: TemplateManager;
  private supportTicketManager: SupportTicketManager;
  private logger: Logger;

  // Timeout progression stages based on business days overdue
  private timeoutStages: TimeoutAction[] = [
    {
      stage: 'warning',
      days_overdue: 1,
      actions: ['send_notification'],
      notification_template: 'verification_overdue_warning',
      escalation_recipients: []
    },
    {
      stage: 'critical',
      days_overdue: 3,
      actions: ['send_notification', 'escalate_support'],
      notification_template: 'verification_overdue_critical',
      escalation_recipients: ['verification-team@vocilia.se']
    },
    {
      stage: 'final',
      days_overdue: 5,
      actions: ['send_notification', 'escalate_support', 'apply_penalty', 'contact_account_manager'],
      notification_template: 'verification_overdue_final',
      escalation_recipients: ['verification-team@vocilia.se', 'account-managers@vocilia.se']
    },
    {
      stage: 'suspended',
      days_overdue: 7,
      actions: ['send_notification', 'escalate_support', 'suspend_service', 'contact_account_manager'],
      notification_template: 'verification_service_suspended',
      escalation_recipients: ['emergency@vocilia.se', 'account-managers@vocilia.se']
    }
  ];

  constructor() {
    this.notificationProcessor = new NotificationProcessor();
    this.templateManager = new TemplateManager();
    this.supportTicketManager = new SupportTicketManager();
    this.logger = new Logger('VerificationTimeoutHandler');
  }

  /**
   * Check all pending verifications for timeouts (called by cron job)
   */
  async checkVerificationTimeouts(): Promise<VerificationTimeout[]> {
    try {
      this.logger.info('Starting verification timeout check');
      
      // Get all pending verification batches
      const overdueVerifications = await this.getOverdueVerifications();
      
      const processedTimeouts: VerificationTimeout[] = [];
      
      for (const verification of overdueVerifications) {
        try {
          const timeout = await this.processVerificationTimeout(verification);
          if (timeout) {
            processedTimeouts.push(timeout);
          }
        } catch (error) {
          this.logger.error('Failed to process verification timeout', {
            verificationId: verification.id,
            businessId: verification.business_id,
            error: error.message
          });
        }
      }
      
      this.logger.info('Verification timeout check completed', {
        overdueCount: overdueVerifications.length,
        processedCount: processedTimeouts.length
      });
      
      return processedTimeouts;
    } catch (error) {
      this.logger.error('Failed to check verification timeouts', error);
      throw error;
    }
  }

  /**
   * Get all overdue verification batches
   */
  private async getOverdueVerifications(): Promise<VerificationBatch[]> {
    const now = new Date();
    
    const { data, error } = await supabase
      .from('verification_batches')
      .select(`
        *,
        businesses!inner(*)
      `)
      .eq('status', 'pending')
      .lt('deadline', now.toISOString())
      .order('deadline', { ascending: true });
    
    if (error) {
      this.logger.error('Failed to fetch overdue verifications', error);
      throw new Error(`Failed to fetch overdue verifications: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Process a single verification timeout
   */
  private async processVerificationTimeout(verification: VerificationBatch): Promise<VerificationTimeout | null> {
    const business = await this.getBusinessInfo(verification.business_id);
    const daysOverdue = this.calculateBusinessDaysOverdue(verification.deadline);
    
    // Check if we already have a timeout record for this verification
    let existingTimeout = await this.getExistingTimeout(verification.id);
    
    if (!existingTimeout) {
      // Create new timeout record
      existingTimeout = await this.createTimeoutRecord(verification, business, daysOverdue);
    } else {
      // Update existing timeout with current overdue days
      existingTimeout = await this.updateTimeoutRecord(existingTimeout, daysOverdue);
    }
    
    // Determine current stage based on days overdue
    const currentStage = this.determineTimeoutStage(daysOverdue, business);
    
    // Only process if stage has changed or new notifications are needed
    if (this.shouldProcessStage(existingTimeout, currentStage)) {
      await this.executeTimeoutActions(existingTimeout, verification, business, currentStage);
    }
    
    return existingTimeout;
  }

  /**
   * Calculate business days overdue (excluding weekends)
   */
  private calculateBusinessDaysOverdue(deadline: string): number {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    if (now <= deadlineDate) {
      return 0;
    }
    
    return differenceInBusinessDays(now, deadlineDate);
  }

  /**
   * Get business information
   */
  private async getBusinessInfo(businessId: string): Promise<BusinessInfo> {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    
    if (error) {
      this.logger.error('Failed to fetch business info', error);
      throw new Error(`Failed to fetch business info: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Get existing timeout record
   */
  private async getExistingTimeout(verificationBatchId: string): Promise<VerificationTimeout | null> {
    const { data, error } = await supabase
      .from('verification_timeouts')
      .select('*')
      .eq('verification_batch_id', verificationBatchId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      this.logger.error('Failed to fetch existing timeout', error);
      throw new Error(`Failed to fetch existing timeout: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Create new timeout record
   */
  private async createTimeoutRecord(
    verification: VerificationBatch,
    business: BusinessInfo,
    daysOverdue: number
  ): Promise<VerificationTimeout> {
    const timeoutRecord: Partial<VerificationTimeout> = {
      business_id: verification.business_id,
      verification_batch_id: verification.id,
      original_deadline: verification.deadline,
      current_deadline: verification.deadline,
      days_overdue: daysOverdue,
      timeout_stage: 'warning',
      notifications_sent: [],
      escalation_level: 0,
      support_ticket_created: false,
      penalties_applied: false,
      service_suspended: false,
      manual_intervention_required: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('verification_timeouts')
      .insert(timeoutRecord)
      .select()
      .single();
    
    if (error) {
      this.logger.error('Failed to create timeout record', error);
      throw new Error(`Failed to create timeout record: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Update existing timeout record
   */
  private async updateTimeoutRecord(
    timeout: VerificationTimeout,
    daysOverdue: number
  ): Promise<VerificationTimeout> {
    const { data, error } = await supabase
      .from('verification_timeouts')
      .update({
        days_overdue: daysOverdue,
        updated_at: new Date().toISOString()
      })
      .eq('id', timeout.id)
      .select()
      .single();
    
    if (error) {
      this.logger.error('Failed to update timeout record', error);
      throw new Error(`Failed to update timeout record: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Determine timeout stage based on days overdue and business tier
   */
  private determineTimeoutStage(daysOverdue: number, business: BusinessInfo): TimeoutAction {
    // VIP customers get additional grace period
    const gracePeriod = business.is_vip ? 2 : business.penalty_tolerance || 0;
    const adjustedDaysOverdue = Math.max(0, daysOverdue - gracePeriod);
    
    // Find the appropriate stage
    for (let i = this.timeoutStages.length - 1; i >= 0; i--) {
      if (adjustedDaysOverdue >= this.timeoutStages[i].days_overdue) {
        return this.timeoutStages[i];
      }
    }
    
    return this.timeoutStages[0]; // Default to warning stage
  }

  /**
   * Check if we should process this stage
   */
  private shouldProcessStage(timeout: VerificationTimeout, stage: TimeoutAction): boolean {
    // Process if stage has escalated
    if (stage.stage !== timeout.timeout_stage) {
      return true;
    }
    
    // Process daily notifications for critical and final stages
    if (stage.stage === 'critical' || stage.stage === 'final') {
      const lastNotification = timeout.notifications_sent[timeout.notifications_sent.length - 1];
      if (lastNotification) {
        const lastNotificationDate = new Date(lastNotification);
        const hoursSinceLastNotification = (Date.now() - lastNotificationDate.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastNotification >= 24; // Send daily reminders
      }
      return true;
    }
    
    return false;
  }

  /**
   * Execute timeout actions for current stage
   */
  private async executeTimeoutActions(
    timeout: VerificationTimeout,
    verification: VerificationBatch,
    business: BusinessInfo,
    stage: TimeoutAction
  ): Promise<void> {
    this.logger.info('Executing timeout actions', {
      timeoutId: timeout.id,
      businessId: business.id,
      stage: stage.stage,
      daysOverdue: timeout.days_overdue
    });
    
    const actionsExecuted: string[] = [];
    
    for (const action of stage.actions) {
      try {
        switch (action) {
          case 'send_notification':
            await this.sendTimeoutNotification(timeout, verification, business, stage);
            actionsExecuted.push('notification_sent');
            break;
            
          case 'escalate_support':
            if (!timeout.support_ticket_created) {
              await this.createSupportTicket(timeout, verification, business, stage);
              actionsExecuted.push('support_ticket_created');
            }
            await this.escalateToSupport(timeout, business, stage);
            actionsExecuted.push('escalated_to_support');
            break;
            
          case 'apply_penalty':
            if (!timeout.penalties_applied) {
              await this.applyTimeoutPenalties(timeout, verification, business);
              actionsExecuted.push('penalties_applied');
            }
            break;
            
          case 'suspend_service':
            if (!timeout.service_suspended && business.auto_suspend_enabled) {
              await this.suspendBusinessService(timeout, business);
              actionsExecuted.push('service_suspended');
            }
            break;
            
          case 'contact_account_manager':
            await this.contactAccountManager(timeout, verification, business, stage);
            actionsExecuted.push('account_manager_contacted');
            break;
        }
      } catch (actionError) {
        this.logger.error(`Failed to execute timeout action: ${action}`, {
          timeoutId: timeout.id,
          action,
          error: actionError.message
        });
      }
    }
    
    // Update timeout record with executed actions
    await this.updateTimeoutWithActions(timeout.id, stage.stage, actionsExecuted);
  }

  /**
   * Send timeout notification to business
   */
  private async sendTimeoutNotification(
    timeout: VerificationTimeout,
    verification: VerificationBatch,
    business: BusinessInfo,
    stage: TimeoutAction
  ): Promise<void> {
    const template = await this.templateManager.getTemplate(stage.notification_template, 'sv');
    
    const templateData = {
      business_name: business.name,
      days_overdue: timeout.days_overdue,
      original_deadline: format(new Date(timeout.original_deadline), 'PPP', { locale: sv }),
      batch_week: verification.batch_week,
      transaction_count: verification.transaction_count,
      total_amount: (verification.total_amount_sek / 100).toFixed(2),
      stage: stage.stage,
      next_action_days: this.getNextActionDays(stage.stage),
      contact_email: 'verification@vocilia.se',
      contact_phone: '+46 8 123 45 67'
    };
    
    const renderedTemplate = await this.templateManager.renderTemplate(template, templateData);
    
    await this.notificationProcessor.sendNotification({
      type: 'verification_timeout',
      recipient_type: 'business',
      recipient_id: business.id,
      channels: ['email', 'sms'],
      priority: stage.stage === 'suspended' ? 'urgent' : 'high',
      subject: `Verifiering försenad - ${business.name}`,
      content: renderedTemplate.content,
      metadata: {
        timeout_id: timeout.id,
        verification_batch_id: verification.id,
        stage: stage.stage,
        days_overdue: timeout.days_overdue
      }
    });
  }

  /**
   * Create support ticket for timeout
   */
  private async createSupportTicket(
    timeout: VerificationTimeout,
    verification: VerificationBatch,
    business: BusinessInfo,
    stage: TimeoutAction
  ): Promise<void> {
    const ticketData = {
      title: `Verifiering försenad: ${business.name} (${timeout.days_overdue} dagar)`,
      category: 'verification',
      priority: stage.stage === 'suspended' ? 'urgent' : 'high',
      description: `
Automatiskt genererat ärende för försenad verifiering.

Företag: ${business.name} (${business.organization_number})
Verifieringsbatch: ${verification.batch_week}
Ursprunglig deadline: ${format(new Date(timeout.original_deadline), 'PPP', { locale: sv })}
Dagar försenade: ${timeout.days_overdue}
Aktuellt stadium: ${stage.stage}

Transaktioner i batch: ${verification.transaction_count}
Total belopp: ${(verification.total_amount_sek / 100).toFixed(2)} SEK

Kontaktuppgifter:
E-post: ${business.contact_email}
Telefon: ${business.contact_phone}

Åtgärder som utförts:
- Påminnelsemeddelanden skickade
- Automatisk eskalering aktiv

${business.is_vip ? 'OBS: VIP-kund - särskild hantering krävs' : ''}
      `,
      contact_email: business.contact_email,
      business_id: business.id,
      metadata: {
        timeout_id: timeout.id,
        verification_batch_id: verification.id,
        auto_generated: true,
        escalation_stage: stage.stage
      }
    };
    
    const ticket = await this.supportTicketManager.createTicket(ticketData);
    
    // Update timeout record with ticket ID
    await supabase
      .from('verification_timeouts')
      .update({
        support_ticket_created: true,
        support_ticket_id: ticket.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', timeout.id);
  }

  /**
   * Escalate to support team
   */
  private async escalateToSupport(
    timeout: VerificationTimeout,
    business: BusinessInfo,
    stage: TimeoutAction
  ): Promise<void> {
    // Send notification to support team
    for (const recipient of stage.escalation_recipients) {
      await this.notificationProcessor.sendNotification({
        type: 'verification_escalation',
        recipient_type: 'admin',
        recipient_id: recipient,
        channels: ['email'],
        priority: 'urgent',
        subject: `ESCALATION: Verifiering försenad - ${business.name}`,
        content: `
Verifieringsförsekning kräver uppmärksamhet:

Företag: ${business.name}
Stadium: ${stage.stage}
Dagar försenade: ${timeout.days_overdue}
Support-ärende: ${timeout.support_ticket_id || 'Skapas'}

${business.is_vip ? 'VIP-KUND - Prioriterad hantering' : ''}

Åtgärda omedelbart via admin-panelen.
        `,
        metadata: {
          timeout_id: timeout.id,
          business_id: business.id,
          escalation_stage: stage.stage
        }
      });
    }
  }

  /**
   * Apply timeout penalties
   */
  private async applyTimeoutPenalties(
    timeout: VerificationTimeout,
    verification: VerificationBatch,
    business: BusinessInfo
  ): Promise<void> {
    // Calculate penalty based on days overdue and transaction amount
    const penaltyRate = this.calculatePenaltyRate(timeout.days_overdue, business.tier);
    const penaltyAmount = Math.round(verification.total_amount_sek * penaltyRate);
    
    // Create penalty record
    await supabase
      .from('verification_penalties')
      .insert({
        business_id: business.id,
        verification_batch_id: verification.id,
        timeout_id: timeout.id,
        penalty_amount_sek: penaltyAmount,
        penalty_rate: penaltyRate,
        days_overdue: timeout.days_overdue,
        reason: `Verification timeout - ${timeout.days_overdue} business days overdue`,
        applied_at: new Date().toISOString()
      });
    
    // Update timeout record
    await supabase
      .from('verification_timeouts')
      .update({
        penalties_applied: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', timeout.id);
    
    this.logger.warn('Verification timeout penalty applied', {
      businessId: business.id,
      timeoutId: timeout.id,
      penaltyAmount,
      daysOverdue: timeout.days_overdue
    });
  }

  /**
   * Suspend business service
   */
  private async suspendBusinessService(
    timeout: VerificationTimeout,
    business: BusinessInfo
  ): Promise<void> {
    // Suspend business account
    await supabase
      .from('businesses')
      .update({
        account_status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspension_reason: `Verification timeout - ${timeout.days_overdue} days overdue`
      })
      .eq('id', business.id);
    
    // Update timeout record
    await supabase
      .from('verification_timeouts')
      .update({
        service_suspended: true,
        manual_intervention_required: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', timeout.id);
    
    this.logger.error('Business service suspended due to verification timeout', {
      businessId: business.id,
      businessName: business.name,
      timeoutId: timeout.id,
      daysOverdue: timeout.days_overdue
    });
  }

  /**
   * Contact account manager
   */
  private async contactAccountManager(
    timeout: VerificationTimeout,
    verification: VerificationBatch,
    business: BusinessInfo,
    stage: TimeoutAction
  ): Promise<void> {
    if (business.account_manager_id) {
      await this.notificationProcessor.sendNotification({
        type: 'account_manager_alert',
        recipient_type: 'admin',
        recipient_id: business.account_manager_id,
        channels: ['email', 'sms'],
        priority: 'urgent',
        subject: `URGENT: Kund verifiering försenad - ${business.name}`,
        content: `
Din kund har försenad verifiering som kräver din uppmärksamhet:

Företag: ${business.name}
Stadium: ${stage.stage}
Dagar försenade: ${timeout.days_overdue}
Belopp i risk: ${(verification.total_amount_sek / 100).toFixed(2)} SEK

${stage.stage === 'suspended' ? 'TJÄNSTEN ÄR SUSPENDERAD' : 'Suspension inom kort'}

Kontakta kunden omedelbart:
E-post: ${business.contact_email}
Telefon: ${business.contact_phone}

Support-ärende: ${timeout.support_ticket_id}
        `,
        metadata: {
          timeout_id: timeout.id,
          business_id: business.id,
          account_manager_alert: true
        }
      });
    }
  }

  /**
   * Calculate penalty rate based on days overdue and business tier
   */
  private calculatePenaltyRate(daysOverdue: number, tier: string): number {
    const basePenaltyRates = {
      basic: 0.02,    // 2% per day after grace period
      premium: 0.015, // 1.5% per day
      enterprise: 0.01 // 1% per day
    };
    
    const baseRate = basePenaltyRates[tier] || basePenaltyRates.basic;
    
    // Increase penalty rate for longer delays
    if (daysOverdue > 7) {
      return baseRate * 1.5; // 50% increase for extreme delays
    } else if (daysOverdue > 5) {
      return baseRate * 1.25; // 25% increase for severe delays
    }
    
    return baseRate;
  }

  /**
   * Get days until next action
   */
  private getNextActionDays(currentStage: string): number {
    const stageIndex = this.timeoutStages.findIndex(s => s.stage === currentStage);
    
    if (stageIndex < this.timeoutStages.length - 1) {
      const nextStage = this.timeoutStages[stageIndex + 1];
      const currentStageObj = this.timeoutStages[stageIndex];
      return nextStage.days_overdue - currentStageObj.days_overdue;
    }
    
    return 0; // No next action (final stage)
  }

  /**
   * Update timeout record with executed actions
   */
  private async updateTimeoutWithActions(
    timeoutId: string,
    stage: string,
    actionsExecuted: string[]
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    
    await supabase
      .from('verification_timeouts')
      .update({
        timeout_stage: stage,
        notifications_sent: supabase.sql`array_append(notifications_sent, ${timestamp})`,
        escalation_level: supabase.sql`escalation_level + 1`,
        updated_at: timestamp
      })
      .eq('id', timeoutId);
  }

  /**
   * Get timeout statistics for monitoring
   */
  async getTimeoutStatistics(timeframe: 'current' | 'last_week' | 'last_month'): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_verification_timeout_stats', {
        timeframe_param: timeframe
      });
    
    if (error) {
      this.logger.error('Failed to get timeout statistics', error);
      throw new Error(`Failed to get timeout statistics: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Get businesses requiring manual intervention
   */
  async getBusinessesRequiringIntervention(): Promise<VerificationTimeout[]> {
    const { data, error } = await supabase
      .from('verification_timeouts')
      .select(`
        *,
        businesses!inner(*),
        verification_batches!inner(*)
      `)
      .eq('manual_intervention_required', true)
      .eq('resolved', false)
      .order('days_overdue', { ascending: false });
    
    if (error) {
      this.logger.error('Failed to get businesses requiring intervention', error);
      throw new Error(`Failed to get businesses requiring intervention: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Resolve timeout manually (admin action)
   */
  async resolveTimeoutManually(
    timeoutId: string,
    resolution: 'verification_submitted' | 'deadline_extended' | 'penalty_waived' | 'service_restored',
    adminNote: string
  ): Promise<void> {
    await supabase
      .from('verification_timeouts')
      .update({
        resolved: true,
        resolution_method: resolution,
        admin_note: adminNote,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', timeoutId);
    
    this.logger.info('Verification timeout resolved manually', {
      timeoutId,
      resolution,
      adminNote
    });
  }
}