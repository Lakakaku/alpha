import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { 
  SupportTicket, 
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketCategory,
  RecipientType,
  CommunicationChannel
} from '@vocilia/types/communication';
import { addHours, addMinutes } from 'date-fns';

export class SupportTicketModel {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a new support ticket
   */
  async create(ticket: Omit<SupportTicket, 'id' | 'created_at' | 'updated_at' | 'sla_deadline'>): Promise<SupportTicket> {
    // Calculate SLA deadline based on priority and channel
    const slaDeadline = this.calculateSlaDeadline(ticket.priority, ticket.channel);
    
    const ticketData = {
      ...ticket,
      sla_deadline: slaDeadline.toISOString()
    };

    const { data, error } = await this.supabase
      .from('support_tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create support ticket: ${error.message}`);
    }

    return data;
  }

  /**
   * Calculate SLA deadline based on priority and channel
   */
  private calculateSlaDeadline(priority: SupportTicketPriority, channel: CommunicationChannel): Date {
    const now = new Date();
    
    // SLA times based on channel and priority
    const slaMinutes = {
      phone: {
        urgent: 1, // 1 minute for urgent phone calls
        high: 5,   // 5 minutes for high priority phone
        medium: 15, // 15 minutes for medium phone
        low: 30    // 30 minutes for low phone
      },
      email: {
        urgent: 30,   // 30 minutes for urgent email
        high: 60,     // 1 hour for high email
        medium: 120,  // 2 hours for medium email
        low: 240      // 4 hours for low email
      },
      chat: {
        urgent: 15,   // 15 minutes for urgent chat
        high: 30,     // 30 minutes for high chat
        medium: 60,   // 1 hour for medium chat
        low: 120      // 2 hours for low chat
      },
      web: {
        urgent: 60,   // 1 hour for urgent web
        high: 120,    // 2 hours for high web
        medium: 240,  // 4 hours for medium web
        low: 480      // 8 hours for low web
      }
    };

    const minutes = slaMinutes[channel]?.[priority] || slaMinutes.email[priority];
    return addMinutes(now, minutes);
  }

  /**
   * Get ticket by ID
   */
  async findById(id: string): Promise<SupportTicket | null> {
    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to fetch support ticket: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Get tickets by requester
   */
  async findByRequester(
    requesterId: string, 
    requesterType: RecipientType,
    options: {
      status?: SupportTicketStatus;
      category?: SupportTicketCategory;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SupportTicket[]> {
    let query = this.supabase
      .from('support_tickets')
      .select('*')
      .eq('requester_id', requesterId)
      .eq('requester_type', requesterType)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch support tickets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tickets assigned to an agent
   */
  async findByAssignee(
    assigneeId: string,
    options: {
      status?: SupportTicketStatus[];
      priority?: SupportTicketPriority;
      category?: SupportTicketCategory;
      limit?: number;
    } = {}
  ): Promise<SupportTicket[]> {
    let query = this.supabase
      .from('support_tickets')
      .select('*')
      .eq('assigned_to', assigneeId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (options.status) {
      query = query.in('status', options.status);
    }

    if (options.priority) {
      query = query.eq('priority', options.priority);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch assigned tickets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update ticket
   */
  async update(
    id: string, 
    updates: Partial<Omit<SupportTicket, 'id' | 'requester_id' | 'requester_type' | 'created_at' | 'updated_at'>>
  ): Promise<SupportTicket> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Auto-set timestamps based on status changes
    if (updates.status === 'in_progress' && !updates.first_response_at) {
      updateData.first_response_at = new Date().toISOString();
    }

    if (updates.status === 'resolved' && !updates.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
      
      // Calculate resolution time
      const ticket = await this.findById(id);
      if (ticket) {
        const createdTime = new Date(ticket.created_at).getTime();
        const resolvedTime = new Date().getTime();
        updateData.resolution_time_minutes = Math.round((resolvedTime - createdTime) / 1000 / 60);
      }
    }

    if (updates.assigned_to && !updates.assigned_at) {
      updateData.assigned_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update support ticket: ${error.message}`);
    }

    return data;
  }

  /**
   * Assign ticket to agent
   */
  async assign(id: string, assigneeId: string): Promise<SupportTicket> {
    return await this.update(id, {
      assigned_to: assigneeId,
      status: 'in_progress',
      assigned_at: new Date().toISOString()
    });
  }

  /**
   * Escalate ticket priority
   */
  async escalate(id: string, reason?: string): Promise<SupportTicket> {
    const ticket = await this.findById(id);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    let newPriority: SupportTicketPriority;
    switch (ticket.priority) {
      case 'low':
        newPriority = 'medium';
        break;
      case 'medium':
        newPriority = 'high';
        break;
      case 'high':
        newPriority = 'urgent';
        break;
      case 'urgent':
        newPriority = 'urgent'; // Already at highest
        break;
    }

    return await this.update(id, {
      priority: newPriority,
      escalated_at: new Date().toISOString(),
      escalation_reason: reason || 'SLA breach'
    });
  }

  /**
   * Resolve ticket
   */
  async resolve(
    id: string, 
    resolution: {
      resolution_message: string;
      resolution_category: string;
      customer_satisfied?: boolean;
    }
  ): Promise<SupportTicket> {
    return await this.update(id, {
      status: 'resolved',
      resolution_message: resolution.resolution_message,
      resolution_category: resolution.resolution_category,
      customer_satisfied: resolution.customer_satisfied,
      resolved_at: new Date().toISOString()
    });
  }

  /**
   * Close ticket
   */
  async close(id: string, closeReason?: string): Promise<SupportTicket> {
    return await this.update(id, {
      status: 'closed',
      resolution_message: closeReason || 'Ticket closed'
    });
  }

  /**
   * Reopen ticket
   */
  async reopen(id: string, reason: string): Promise<SupportTicket> {
    return await this.update(id, {
      status: 'open',
      resolved_at: null,
      resolution_time_minutes: null,
      escalation_reason: reason
    });
  }

  /**
   * Get tickets that have breached SLA
   */
  async findSlaBreached(): Promise<SupportTicket[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .lt('sla_deadline', now)
      .eq('sla_breached', false)
      .order('sla_deadline', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch SLA breached tickets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Mark tickets as SLA breached
   */
  async markSlaBreached(ticketIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('support_tickets')
      .update({ 
        sla_breached: true,
        updated_at: new Date().toISOString()
      })
      .in('id', ticketIds);

    if (error) {
      throw new Error(`Failed to mark tickets as SLA breached: ${error.message}`);
    }
  }

  /**
   * Get ticket statistics
   */
  async getStats(
    dateRange?: { start: string; end: string },
    filters?: {
      assigneeId?: string;
      category?: SupportTicketCategory;
      priority?: SupportTicketPriority;
    }
  ): Promise<{
    total_tickets: number;
    by_status: Record<SupportTicketStatus, number>;
    by_priority: Record<SupportTicketPriority, number>;
    by_category: Record<SupportTicketCategory, number>;
    sla_compliance_rate: number;
    average_resolution_time_minutes: number;
    customer_satisfaction_rate: number;
  }> {
    let query = this.supabase
      .from('support_tickets')
      .select('status, priority, category, sla_breached, resolution_time_minutes, customer_satisfied');

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }

    if (filters?.assigneeId) {
      query = query.eq('assigned_to', filters.assigneeId);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch ticket stats: ${error.message}`);
    }

    const stats = {
      total_tickets: data?.length || 0,
      by_status: {} as Record<SupportTicketStatus, number>,
      by_priority: {} as Record<SupportTicketPriority, number>,
      by_category: {} as Record<SupportTicketCategory, number>,
      sla_compliance_rate: 0,
      average_resolution_time_minutes: 0,
      customer_satisfaction_rate: 0
    };

    if (data && data.length > 0) {
      let totalResolutionTime = 0;
      let resolvedCount = 0;
      let satisfiedCount = 0;
      let satisfactionResponses = 0;
      let slaCompliantCount = 0;

      data.forEach(ticket => {
        // Count by status
        stats.by_status[ticket.status] = (stats.by_status[ticket.status] || 0) + 1;
        
        // Count by priority
        stats.by_priority[ticket.priority] = (stats.by_priority[ticket.priority] || 0) + 1;
        
        // Count by category
        stats.by_category[ticket.category] = (stats.by_category[ticket.category] || 0) + 1;

        // SLA compliance
        if (!ticket.sla_breached) {
          slaCompliantCount++;
        }

        // Resolution time
        if (ticket.resolution_time_minutes) {
          totalResolutionTime += ticket.resolution_time_minutes;
          resolvedCount++;
        }

        // Customer satisfaction
        if (ticket.customer_satisfied !== null) {
          satisfactionResponses++;
          if (ticket.customer_satisfied) {
            satisfiedCount++;
          }
        }
      });

      stats.sla_compliance_rate = (slaCompliantCount / stats.total_tickets) * 100;
      stats.average_resolution_time_minutes = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0;
      stats.customer_satisfaction_rate = satisfactionResponses > 0 ? (satisfiedCount / satisfactionResponses) * 100 : 0;
    }

    return stats;
  }

  /**
   * Get unassigned tickets for auto-assignment
   */
  async findUnassigned(
    options: {
      priority?: SupportTicketPriority;
      category?: SupportTicketCategory;
      channel?: CommunicationChannel;
      limit?: number;
    } = {}
  ): Promise<SupportTicket[]> {
    let query = this.supabase
      .from('support_tickets')
      .select('*')
      .eq('status', 'open')
      .is('assigned_to', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (options.priority) {
      query = query.eq('priority', options.priority);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.channel) {
      query = query.eq('channel', options.channel);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch unassigned tickets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Auto-assign tickets based on agent availability and skills
   */
  async autoAssignTickets(agentId: string, maxTickets: number = 5): Promise<SupportTicket[]> {
    // Get unassigned tickets
    const unassignedTickets = await this.findUnassigned({ limit: maxTickets });
    
    // Assign tickets to agent
    const assignedTickets: SupportTicket[] = [];
    for (const ticket of unassignedTickets) {
      try {
        const assigned = await this.assign(ticket.id, agentId);
        assignedTickets.push(assigned);
      } catch (error) {
        console.error(`Failed to auto-assign ticket ${ticket.id}:`, error);
      }
    }

    return assignedTickets;
  }

  /**
   * Get ticket workload for an agent
   */
  async getAgentWorkload(agentId: string): Promise<{
    total_assigned: number;
    open_tickets: number;
    in_progress_tickets: number;
    overdue_tickets: number;
    average_response_time_minutes: number;
  }> {
    const { data, error } = await this.supabase
      .from('support_tickets')
      .select('status, sla_deadline, first_response_at, created_at')
      .eq('assigned_to', agentId);

    if (error) {
      throw new Error(`Failed to fetch agent workload: ${error.message}`);
    }

    const workload = {
      total_assigned: data?.length || 0,
      open_tickets: 0,
      in_progress_tickets: 0,
      overdue_tickets: 0,
      average_response_time_minutes: 0
    };

    if (data && data.length > 0) {
      let totalResponseTime = 0;
      let responseCount = 0;
      const now = new Date();

      data.forEach(ticket => {
        if (ticket.status === 'open') workload.open_tickets++;
        if (ticket.status === 'in_progress') workload.in_progress_tickets++;
        
        // Check if overdue
        if (['open', 'in_progress'].includes(ticket.status) && 
            new Date(ticket.sla_deadline) < now) {
          workload.overdue_tickets++;
        }

        // Calculate response time
        if (ticket.first_response_at) {
          const createdTime = new Date(ticket.created_at).getTime();
          const responseTime = new Date(ticket.first_response_at).getTime();
          totalResponseTime += (responseTime - createdTime) / 1000 / 60; // Convert to minutes
          responseCount++;
        }
      });

      workload.average_response_time_minutes = responseCount > 0 ? totalResponseTime / responseCount : 0;
    }

    return workload;
  }
}