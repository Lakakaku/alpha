import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { NotificationProcessor } from './notification-processor';
import { AuditLoggingService } from '../audit/audit-logging-service';

interface EscalationRule {
  sla_type: 'phone' | 'email' | 'chat';
  threshold_minutes: number;
  escalation_level: 'manager' | 'senior' | 'director';
  notification_template: string;
  auto_actions: ('reassign' | 'priority_increase' | 'create_incident')[];
}

interface SLABreach {
  ticket_id: string;
  breach_type: 'response_time' | 'resolution_time' | 'update_frequency';
  sla_threshold_minutes: number;
  actual_duration_minutes: number;
  severity: 'minor' | 'major' | 'critical';
  escalation_path: string[];
}

interface EscalationAction {
  action_type: 'notify_manager' | 'reassign_agent' | 'increase_priority' | 'create_incident' | 'notify_director';
  target_id?: string;
  notification_message: string;
  priority_level?: 'low' | 'medium' | 'high' | 'urgent';
}

export class SupportEscalationService {
  private supabase: SupabaseClient<Database>;
  private notificationProcessor: NotificationProcessor;
  private auditLogger: AuditLoggingService;

  private escalationRules: EscalationRule[] = [
    {
      sla_type: 'phone',
      threshold_minutes: 1, // 30 seconds exceeded
      escalation_level: 'manager',
      notification_template: 'phone_sla_breach_manager',
      auto_actions: ['reassign', 'priority_increase']
    },
    {
      sla_type: 'phone',
      threshold_minutes: 5, // 5 minutes exceeded
      escalation_level: 'director',
      notification_template: 'phone_sla_critical_director',
      auto_actions: ['create_incident', 'reassign']
    },
    {
      sla_type: 'email',
      threshold_minutes: 30, // 2.5 hours (150 minutes exceeded)
      escalation_level: 'manager',
      notification_template: 'email_sla_breach_manager',
      auto_actions: ['reassign', 'priority_increase']
    },
    {
      sla_type: 'email',
      threshold_minutes: 120, // 4 hours exceeded
      escalation_level: 'senior',
      notification_template: 'email_sla_major_senior',
      auto_actions: ['create_incident', 'priority_increase']
    },
    {
      sla_type: 'email',
      threshold_minutes: 240, // 6 hours exceeded
      escalation_level: 'director',
      notification_template: 'email_sla_critical_director',
      auto_actions: ['create_incident', 'reassign']
    },
    {
      sla_type: 'chat',
      threshold_minutes: 30, // 2.5 hours exceeded
      escalation_level: 'manager',
      notification_template: 'chat_sla_breach_manager',
      auto_actions: ['reassign', 'priority_increase']
    },
    {
      sla_type: 'chat',
      threshold_minutes: 120, // 4 hours exceeded
      escalation_level: 'senior',
      notification_template: 'chat_sla_major_senior',
      auto_actions: ['create_incident', 'priority_increase']
    },
    {
      sla_type: 'chat',
      threshold_minutes: 240, // 6 hours exceeded
      escalation_level: 'director',
      notification_template: 'chat_sla_critical_director',
      auto_actions: ['create_incident', 'reassign']
    }
  ];

  constructor(
    supabase: SupabaseClient<Database>,
    notificationProcessor: NotificationProcessor,
    auditLogger: AuditLoggingService
  ) {
    this.supabase = supabase;
    this.notificationProcessor = notificationProcessor;
    this.auditLogger = auditLogger;
  }

  async checkSLABreaches(): Promise<SLABreach[]> {
    try {
      const { data: tickets, error } = await this.supabase
        .from('support_tickets')
        .select(`
          id,
          title,
          channel,
          priority,
          status,
          created_at,
          first_response_at,
          last_update_at,
          assigned_agent_id,
          customer_id,
          business_id
        `)
        .in('status', ['open', 'in_progress', 'pending_customer'])
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch tickets for SLA check: ${error.message}`);
      }

      const breaches: SLABreach[] = [];
      const now = new Date();

      for (const ticket of tickets || []) {
        const createdAt = new Date(ticket.created_at);
        const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));

        // Check response time SLA
        if (!ticket.first_response_at) {
          const responseTimeBreach = this.checkResponseTimeSLA(ticket, elapsedMinutes);
          if (responseTimeBreach) {
            breaches.push(responseTimeBreach);
          }
        }

        // Check update frequency SLA
        if (ticket.last_update_at) {
          const lastUpdate = new Date(ticket.last_update_at);
          const updateElapsedMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
          const updateBreach = this.checkUpdateFrequencySLA(ticket, updateElapsedMinutes);
          if (updateBreach) {
            breaches.push(updateBreach);
          }
        }

        // Check resolution time SLA for high priority tickets
        if (ticket.priority === 'high' || ticket.priority === 'urgent') {
          const resolutionBreach = this.checkResolutionTimeSLA(ticket, elapsedMinutes);
          if (resolutionBreach) {
            breaches.push(resolutionBreach);
          }
        }
      }

      await this.auditLogger.log({
        action: 'sla_breach_check',
        details: { breaches_found: breaches.length, tickets_checked: tickets?.length || 0 },
        metadata: { timestamp: now.toISOString() }
      });

      return breaches;
    } catch (error) {
      await this.auditLogger.log({
        action: 'sla_breach_check_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        metadata: { timestamp: new Date().toISOString() }
      });
      throw error;
    }
  }

  private checkResponseTimeSLA(ticket: any, elapsedMinutes: number): SLABreach | null {
    const slaThreshold = this.getSLAThreshold(ticket.channel as 'phone' | 'email' | 'chat');
    
    if (elapsedMinutes > slaThreshold) {
      const escalationPath = this.getEscalationPath(ticket.channel, elapsedMinutes - slaThreshold);
      
      return {
        ticket_id: ticket.id,
        breach_type: 'response_time',
        sla_threshold_minutes: slaThreshold,
        actual_duration_minutes: elapsedMinutes,
        severity: this.calculateSeverity(elapsedMinutes - slaThreshold, ticket.channel),
        escalation_path
      };
    }
    
    return null;
  }

  private checkUpdateFrequencySLA(ticket: any, updateElapsedMinutes: number): SLABreach | null {
    // Email and chat tickets should have updates every 4 hours during business hours
    const updateThreshold = ticket.channel === 'phone' ? 15 : 240; // 15 min for phone, 4 hours for email/chat
    
    if (updateElapsedMinutes > updateThreshold && ticket.status !== 'pending_customer') {
      const escalationPath = this.getEscalationPath(ticket.channel, updateElapsedMinutes - updateThreshold);
      
      return {
        ticket_id: ticket.id,
        breach_type: 'update_frequency',
        sla_threshold_minutes: updateThreshold,
        actual_duration_minutes: updateElapsedMinutes,
        severity: this.calculateSeverity(updateElapsedMinutes - updateThreshold, ticket.channel),
        escalation_path
      };
    }
    
    return null;
  }

  private checkResolutionTimeSLA(ticket: any, elapsedMinutes: number): SLABreach | null {
    // High priority: 4 hours, Urgent: 2 hours
    const resolutionThreshold = ticket.priority === 'urgent' ? 120 : 240;
    
    if (elapsedMinutes > resolutionThreshold) {
      const escalationPath = this.getEscalationPath(ticket.channel, elapsedMinutes - resolutionThreshold);
      
      return {
        ticket_id: ticket.id,
        breach_type: 'resolution_time',
        sla_threshold_minutes: resolutionThreshold,
        actual_duration_minutes: elapsedMinutes,
        severity: this.calculateSeverity(elapsedMinutes - resolutionThreshold, ticket.channel),
        escalation_path
      };
    }
    
    return null;
  }

  private getSLAThreshold(channel: 'phone' | 'email' | 'chat'): number {
    switch (channel) {
      case 'phone':
        return 0.5; // 30 seconds
      case 'email':
        return 120; // 2 hours
      case 'chat':
        return 120; // 2 hours
      default:
        return 120;
    }
  }

  private getEscalationPath(channel: string, excessMinutes: number): string[] {
    const applicableRules = this.escalationRules
      .filter(rule => rule.sla_type === channel && excessMinutes >= rule.threshold_minutes)
      .sort((a, b) => b.threshold_minutes - a.threshold_minutes);

    return applicableRules.map(rule => rule.escalation_level);
  }

  private calculateSeverity(excessMinutes: number, channel: string): 'minor' | 'major' | 'critical' {
    if (channel === 'phone') {
      if (excessMinutes > 5) return 'critical';
      if (excessMinutes > 1) return 'major';
      return 'minor';
    } else {
      if (excessMinutes > 240) return 'critical'; // 4+ hours over
      if (excessMinutes > 120) return 'major'; // 2+ hours over
      return 'minor';
    }
  }

  async escalateBreach(breach: SLABreach): Promise<void> {
    try {
      const applicableRules = this.escalationRules.filter(
        rule => rule.sla_type === this.getChannelFromTicket(breach.ticket_id)
      );

      for (const rule of applicableRules) {
        if (breach.escalation_path.includes(rule.escalation_level)) {
          const actions = await this.generateEscalationActions(breach, rule);
          
          for (const action of actions) {
            await this.executeEscalationAction(breach.ticket_id, action);
          }
        }
      }

      // Log the escalation
      await this.supabase
        .from('communication_logs')
        .insert({
          ticket_id: breach.ticket_id,
          log_type: 'escalation',
          details: {
            breach_type: breach.breach_type,
            severity: breach.severity,
            escalation_path: breach.escalation_path,
            excess_minutes: breach.actual_duration_minutes - breach.sla_threshold_minutes
          },
          created_at: new Date().toISOString()
        });

      await this.auditLogger.log({
        action: 'sla_breach_escalated',
        details: { 
          ticket_id: breach.ticket_id, 
          breach_type: breach.breach_type,
          severity: breach.severity 
        },
        metadata: { escalation_path: breach.escalation_path }
      });

    } catch (error) {
      await this.auditLogger.log({
        action: 'escalation_failed',
        details: { 
          ticket_id: breach.ticket_id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        },
        metadata: { breach_details: breach }
      });
      throw error;
    }
  }

  private async getChannelFromTicket(ticketId: string): Promise<'phone' | 'email' | 'chat'> {
    const { data: ticket } = await this.supabase
      .from('support_tickets')
      .select('channel')
      .eq('id', ticketId)
      .single();
    
    return ticket?.channel as 'phone' | 'email' | 'chat' || 'email';
  }

  private async generateEscalationActions(breach: SLABreach, rule: EscalationRule): Promise<EscalationAction[]> {
    const actions: EscalationAction[] = [];

    // Always notify the appropriate escalation level
    actions.push({
      action_type: rule.escalation_level === 'director' ? 'notify_director' : 'notify_manager',
      notification_message: `SLA breach detected for ticket ${breach.ticket_id}. ${breach.breach_type} exceeded by ${breach.actual_duration_minutes - breach.sla_threshold_minutes} minutes. Severity: ${breach.severity}`
    });

    // Execute auto actions based on rule
    for (const autoAction of rule.auto_actions) {
      switch (autoAction) {
        case 'reassign':
          actions.push({
            action_type: 'reassign_agent',
            notification_message: `Ticket ${breach.ticket_id} reassigned due to SLA breach`
          });
          break;
        case 'priority_increase':
          const newPriority = this.getIncreasedPriority(breach.severity);
          actions.push({
            action_type: 'increase_priority',
            priority_level: newPriority,
            notification_message: `Ticket ${breach.ticket_id} priority increased to ${newPriority} due to SLA breach`
          });
          break;
        case 'create_incident':
          actions.push({
            action_type: 'create_incident',
            notification_message: `Incident created for ticket ${breach.ticket_id} due to ${breach.severity} SLA breach`
          });
          break;
      }
    }

    return actions;
  }

  private getIncreasedPriority(severity: 'minor' | 'major' | 'critical'): 'medium' | 'high' | 'urgent' {
    switch (severity) {
      case 'critical':
        return 'urgent';
      case 'major':
        return 'high';
      case 'minor':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private async executeEscalationAction(ticketId: string, action: EscalationAction): Promise<void> {
    switch (action.action_type) {
      case 'notify_manager':
      case 'notify_director':
        await this.notificationProcessor.sendNotification({
          type: 'sla_escalation',
          recipient_type: action.action_type === 'notify_director' ? 'director' : 'manager',
          ticket_id: ticketId,
          message: action.notification_message,
          priority: 'urgent',
          channel: 'email'
        });
        break;

      case 'reassign_agent':
        await this.reassignTicketToAvailableAgent(ticketId);
        break;

      case 'increase_priority':
        await this.supabase
          .from('support_tickets')
          .update({ 
            priority: action.priority_level,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticketId);
        break;

      case 'create_incident':
        await this.createEscalationIncident(ticketId, action.notification_message);
        break;
    }
  }

  private async reassignTicketToAvailableAgent(ticketId: string): Promise<void> {
    // Find available agents (this would integrate with agent management system)
    const { data: availableAgent } = await this.supabase
      .from('admin_accounts')
      .select('id')
      .eq('role', 'support_agent')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (availableAgent) {
      await this.supabase
        .from('support_tickets')
        .update({ 
          assigned_agent_id: availableAgent.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);
    }
  }

  private async createEscalationIncident(ticketId: string, description: string): Promise<void> {
    await this.supabase
      .from('support_tickets')
      .insert({
        title: `ESCALATION INCIDENT - Ticket ${ticketId}`,
        description,
        priority: 'urgent',
        channel: 'internal',
        status: 'open',
        ticket_type: 'incident',
        source_ticket_id: ticketId,
        created_at: new Date().toISOString()
      });
  }

  async getEscalationMetrics(startDate: Date, endDate: Date): Promise<{
    total_breaches: number;
    breaches_by_channel: Record<string, number>;
    breaches_by_severity: Record<string, number>;
    average_escalation_time_minutes: number;
    repeat_offender_tickets: string[];
  }> {
    const { data: logs, error } = await this.supabase
      .from('communication_logs')
      .select('*')
      .eq('log_type', 'escalation')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      throw new Error(`Failed to fetch escalation metrics: ${error.message}`);
    }

    const metrics = {
      total_breaches: logs?.length || 0,
      breaches_by_channel: {} as Record<string, number>,
      breaches_by_severity: {} as Record<string, number>,
      average_escalation_time_minutes: 0,
      repeat_offender_tickets: [] as string[]
    };

    if (logs) {
      // Count breaches by channel and severity
      logs.forEach(log => {
        const details = log.details as any;
        if (details.channel) {
          metrics.breaches_by_channel[details.channel] = (metrics.breaches_by_channel[details.channel] || 0) + 1;
        }
        if (details.severity) {
          metrics.breaches_by_severity[details.severity] = (metrics.breaches_by_severity[details.severity] || 0) + 1;
        }
      });

      // Calculate average escalation time
      const escalationTimes = logs
        .map(log => (log.details as any).excess_minutes)
        .filter(time => typeof time === 'number');
      
      if (escalationTimes.length > 0) {
        metrics.average_escalation_time_minutes = 
          escalationTimes.reduce((sum, time) => sum + time, 0) / escalationTimes.length;
      }

      // Find repeat offender tickets (multiple escalations)
      const ticketCounts = logs.reduce((acc, log) => {
        acc[log.ticket_id] = (acc[log.ticket_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      metrics.repeat_offender_tickets = Object.keys(ticketCounts)
        .filter(ticketId => ticketCounts[ticketId] > 1);
    }

    return metrics;
  }
}