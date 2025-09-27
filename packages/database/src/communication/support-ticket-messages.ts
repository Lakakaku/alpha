import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { 
  SupportTicketMessage, 
  SupportTicketMessageType,
  RecipientType
} from '@vocilia/types/communication';

export class SupportTicketMessageModel {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabaseClient: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a new message in a support ticket
   */
  async create(message: Omit<SupportTicketMessage, 'id' | 'created_at' | 'updated_at'>): Promise<SupportTicketMessage> {
    const { data, error } = await this.supabase
      .from('support_ticket_messages')
      .insert(message)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create support ticket message: ${error.message}`);
    }

    return data;
  }

  /**
   * Get message by ID
   */
  async findById(id: string): Promise<SupportTicketMessage | null> {
    const { data, error } = await this.supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to fetch support ticket message: ${error.message}`);
    }

    return data || null;
  }

  /**
   * Get all messages for a ticket
   */
  async findByTicket(
    ticketId: string,
    options: {
      includeInternal?: boolean;
      messageType?: SupportTicketMessageType;
      senderId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<SupportTicketMessage[]> {
    let query = this.supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (options.includeInternal === false) {
      query = query.eq('is_internal', false);
    }

    if (options.messageType) {
      query = query.eq('message_type', options.messageType);
    }

    if (options.senderId) {
      query = query.eq('sender_id', options.senderId);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch support ticket messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get messages by sender
   */
  async findBySender(
    senderId: string,
    senderType: RecipientType | 'admin',
    options: {
      ticketId?: string;
      messageType?: SupportTicketMessageType;
      isInternal?: boolean;
      limit?: number;
    } = {}
  ): Promise<SupportTicketMessage[]> {
    let query = this.supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('sender_id', senderId)
      .eq('sender_type', senderType)
      .order('created_at', { ascending: false });

    if (options.ticketId) {
      query = query.eq('ticket_id', options.ticketId);
    }

    if (options.messageType) {
      query = query.eq('message_type', options.messageType);
    }

    if (options.isInternal !== undefined) {
      query = query.eq('is_internal', options.isInternal);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages by sender: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update message
   */
  async update(
    id: string, 
    updates: Partial<Omit<SupportTicketMessage, 'id' | 'ticket_id' | 'sender_id' | 'sender_type' | 'created_at' | 'updated_at'>>
  ): Promise<SupportTicketMessage> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('support_ticket_messages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update support ticket message: ${error.message}`);
    }

    return data;
  }

  /**
   * Add agent response to ticket
   */
  async addAgentResponse(
    ticketId: string,
    agentId: string,
    message: string,
    isInternal: boolean = false,
    attachments?: string[]
  ): Promise<SupportTicketMessage> {
    return await this.create({
      ticket_id: ticketId,
      sender_id: agentId,
      sender_type: 'admin',
      message: message,
      message_type: isInternal ? 'internal_note' : 'response',
      is_internal: isInternal,
      attachments: attachments || []
    });
  }

  /**
   * Add customer follow-up message
   */
  async addCustomerFollowUp(
    ticketId: string,
    customerId: string,
    message: string,
    attachments?: string[]
  ): Promise<SupportTicketMessage> {
    return await this.create({
      ticket_id: ticketId,
      sender_id: customerId,
      sender_type: 'customer',
      message: message,
      message_type: 'follow_up',
      is_internal: false,
      attachments: attachments || []
    });
  }

  /**
   * Add business follow-up message
   */
  async addBusinessFollowUp(
    ticketId: string,
    businessId: string,
    message: string,
    attachments?: string[]
  ): Promise<SupportTicketMessage> {
    return await this.create({
      ticket_id: ticketId,
      sender_id: businessId,
      sender_type: 'business',
      message: message,
      message_type: 'follow_up',
      is_internal: false,
      attachments: attachments || []
    });
  }

  /**
   * Add internal note to ticket
   */
  async addInternalNote(
    ticketId: string,
    agentId: string,
    note: string,
    tags?: string[]
  ): Promise<SupportTicketMessage> {
    return await this.create({
      ticket_id: ticketId,
      sender_id: agentId,
      sender_type: 'admin',
      message: note,
      message_type: 'internal_note',
      is_internal: true,
      tags: tags || []
    });
  }

  /**
   * Add system message (automated)
   */
  async addSystemMessage(
    ticketId: string,
    message: string,
    messageType: SupportTicketMessageType = 'system_message'
  ): Promise<SupportTicketMessage> {
    return await this.create({
      ticket_id: ticketId,
      sender_id: 'system',
      sender_type: 'admin',
      message: message,
      message_type: messageType,
      is_internal: false
    });
  }

  /**
   * Get conversation thread for a ticket (chronological order)
   */
  async getConversationThread(
    ticketId: string,
    includeInternal: boolean = false
  ): Promise<{
    messages: SupportTicketMessage[];
    total_messages: number;
    last_customer_message: SupportTicketMessage | null;
    last_agent_response: SupportTicketMessage | null;
  }> {
    const messages = await this.findByTicket(ticketId, { 
      includeInternal 
    });

    const customerMessages = messages.filter(m => 
      ['customer', 'business'].includes(m.sender_type) && !m.is_internal
    );
    
    const agentResponses = messages.filter(m => 
      m.sender_type === 'admin' && !m.is_internal && m.message_type === 'response'
    );

    return {
      messages,
      total_messages: messages.length,
      last_customer_message: customerMessages[customerMessages.length - 1] || null,
      last_agent_response: agentResponses[agentResponses.length - 1] || null
    };
  }

  /**
   * Get message statistics for a ticket
   */
  async getTicketMessageStats(ticketId: string): Promise<{
    total_messages: number;
    customer_messages: number;
    agent_responses: number;
    internal_notes: number;
    average_response_time_minutes: number;
    first_response_time_minutes: number | null;
  }> {
    const messages = await this.findByTicket(ticketId, { includeInternal: true });

    const stats = {
      total_messages: messages.length,
      customer_messages: 0,
      agent_responses: 0,
      internal_notes: 0,
      average_response_time_minutes: 0,
      first_response_time_minutes: null as number | null
    };

    if (messages.length === 0) {
      return stats;
    }

    let customerMessages: SupportTicketMessage[] = [];
    let agentResponses: SupportTicketMessage[] = [];
    let totalResponseTime = 0;
    let responseCount = 0;

    messages.forEach(message => {
      if (['customer', 'business'].includes(message.sender_type) && !message.is_internal) {
        stats.customer_messages++;
        customerMessages.push(message);
      } else if (message.sender_type === 'admin' && message.message_type === 'response') {
        stats.agent_responses++;
        agentResponses.push(message);
      } else if (message.is_internal) {
        stats.internal_notes++;
      }
    });

    // Calculate response times
    if (customerMessages.length > 0 && agentResponses.length > 0) {
      // First response time
      const firstCustomerMessage = customerMessages[0];
      const firstAgentResponse = agentResponses.find(r => 
        new Date(r.created_at) > new Date(firstCustomerMessage.created_at)
      );

      if (firstAgentResponse) {
        const firstResponseTime = new Date(firstAgentResponse.created_at).getTime() - 
          new Date(firstCustomerMessage.created_at).getTime();
        stats.first_response_time_minutes = Math.round(firstResponseTime / 1000 / 60);
      }

      // Average response time for all customer messages
      customerMessages.forEach(customerMsg => {
        const nextAgentResponse = agentResponses.find(agentMsg => 
          new Date(agentMsg.created_at) > new Date(customerMsg.created_at)
        );

        if (nextAgentResponse) {
          const responseTime = new Date(nextAgentResponse.created_at).getTime() - 
            new Date(customerMsg.created_at).getTime();
          totalResponseTime += responseTime / 1000 / 60; // Convert to minutes
          responseCount++;
        }
      });

      stats.average_response_time_minutes = responseCount > 0 ? totalResponseTime / responseCount : 0;
    }

    return stats;
  }

  /**
   * Search messages by content
   */
  async searchMessages(
    searchTerm: string,
    options: {
      ticketId?: string;
      senderId?: string;
      senderType?: RecipientType | 'admin';
      includeInternal?: boolean;
      messageType?: SupportTicketMessageType;
      dateRange?: { start: string; end: string };
      limit?: number;
    } = {}
  ): Promise<SupportTicketMessage[]> {
    let query = this.supabase
      .from('support_ticket_messages')
      .select('*')
      .textSearch('message', searchTerm)
      .order('created_at', { ascending: false });

    if (options.ticketId) {
      query = query.eq('ticket_id', options.ticketId);
    }

    if (options.senderId) {
      query = query.eq('sender_id', options.senderId);
    }

    if (options.senderType) {
      query = query.eq('sender_type', options.senderType);
    }

    if (options.includeInternal === false) {
      query = query.eq('is_internal', false);
    }

    if (options.messageType) {
      query = query.eq('message_type', options.messageType);
    }

    if (options.dateRange) {
      query = query
        .gte('created_at', options.dateRange.start)
        .lte('created_at', options.dateRange.end);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get messages with attachments
   */
  async findMessagesWithAttachments(
    ticketId?: string,
    limit: number = 50
  ): Promise<SupportTicketMessage[]> {
    let query = this.supabase
      .from('support_ticket_messages')
      .select('*')
      .not('attachments', 'is', null)
      .order('created_at', { ascending: false });

    if (ticketId) {
      query = query.eq('ticket_id', ticketId);
    }

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages with attachments: ${error.message}`);
    }

    return (data || []).filter(message => 
      message.attachments && message.attachments.length > 0
    );
  }

  /**
   * Delete message (soft delete by setting is_deleted flag)
   */
  async delete(id: string, deletedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('support_ticket_messages')
      .update({ 
        is_deleted: true,
        deleted_by: deletedBy,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete support ticket message: ${error.message}`);
    }
  }

  /**
   * Get messages by tag
   */
  async findByTag(
    tag: string,
    options: {
      ticketId?: string;
      limit?: number;
    } = {}
  ): Promise<SupportTicketMessage[]> {
    let query = this.supabase
      .from('support_ticket_messages')
      .select('*')
      .contains('tags', [tag])
      .order('created_at', { ascending: false });

    if (options.ticketId) {
      query = query.eq('ticket_id', options.ticketId);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages by tag: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get agent activity statistics
   */
  async getAgentActivity(
    agentId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    total_messages: number;
    responses: number;
    internal_notes: number;
    tickets_participated: number;
    average_messages_per_ticket: number;
  }> {
    let query = this.supabase
      .from('support_ticket_messages')
      .select('ticket_id, message_type, is_internal')
      .eq('sender_id', agentId)
      .eq('sender_type', 'admin');

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch agent activity: ${error.message}`);
    }

    const activity = {
      total_messages: data?.length || 0,
      responses: 0,
      internal_notes: 0,
      tickets_participated: 0,
      average_messages_per_ticket: 0
    };

    if (data && data.length > 0) {
      const uniqueTickets = new Set<string>();
      
      data.forEach(message => {
        uniqueTickets.add(message.ticket_id);
        
        if (message.is_internal) {
          activity.internal_notes++;
        } else if (message.message_type === 'response') {
          activity.responses++;
        }
      });

      activity.tickets_participated = uniqueTickets.size;
      activity.average_messages_per_ticket = activity.total_messages / activity.tickets_participated;
    }

    return activity;
  }
}