import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { AiMessage, AiMessageCreate, AiMessageUpdate } from '@vocilia/types/ai-assistant';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AiMessageModel {
  async create(data: AiMessageCreate): Promise<AiMessage> {
    const messageData = {
      ...data,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: message, error } = await supabase
      .from('ai_messages')
      .insert(messageData)
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          status
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create AI message: ${error.message}`);
    }

    return message as AiMessage;
  }

  async getById(id: string, businessId: string): Promise<AiMessage | null> {
    const { data: message, error } = await supabase
      .from('ai_messages')
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          stores (
            business_id
          )
        )
      `)
      .eq('id', id)
      .eq('ai_conversations.stores.business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get AI message: ${error.message}`);
    }

    return message as AiMessage;
  }

  async getByConversationId(
    conversationId: string,
    businessId: string,
    options: {
      messageType?: string;
      limit?: number;
      offset?: number;
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<AiMessage[]> {
    let query = supabase
      .from('ai_messages')
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          stores (
            business_id
          )
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('ai_conversations.stores.business_id', businessId)
      .order('created_at', { ascending: options.order === 'asc' });

    if (options.messageType) {
      query = query.eq('message_type', options.messageType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new Error(`Failed to get messages for conversation: ${error.message}`);
    }

    return messages as AiMessage[];
  }

  async getLatestUserMessage(
    conversationId: string,
    businessId: string
  ): Promise<AiMessage | null> {
    const messages = await this.getByConversationId(conversationId, businessId, {
      messageType: 'user',
      limit: 1,
      order: 'desc'
    });

    return messages.length > 0 ? messages[0] : null;
  }

  async getLatestAiMessage(
    conversationId: string,
    businessId: string
  ): Promise<AiMessage | null> {
    const messages = await this.getByConversationId(conversationId, businessId, {
      messageType: 'ai',
      limit: 1,
      order: 'desc'
    });

    return messages.length > 0 ? messages[0] : null;
  }

  async getConversationHistory(
    conversationId: string,
    businessId: string,
    limit: number = 50
  ): Promise<AiMessage[]> {
    return this.getByConversationId(conversationId, businessId, {
      limit,
      order: 'asc'
    });
  }

  async update(
    id: string,
    businessId: string,
    data: AiMessageUpdate
  ): Promise<AiMessage> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const { data: message, error } = await supabase
      .from('ai_messages')
      .update(updateData)
      .eq('id', id)
      .eq('ai_conversations.stores.business_id', businessId)
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          stores (
            business_id
          )
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update AI message: ${error.message}`);
    }

    return message as AiMessage;
  }

  async updateMetadata(
    id: string,
    businessId: string,
    metadata: Record<string, any>
  ): Promise<AiMessage> {
    const { data: current, error: fetchError } = await supabase
      .from('ai_messages')
      .select('metadata')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch message metadata: ${fetchError.message}`);
    }

    const updatedMetadata = {
      ...current.metadata,
      ...metadata
    };

    return this.update(id, businessId, { metadata: updatedMetadata });
  }

  async delete(id: string, businessId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_messages')
      .delete()
      .eq('id', id)
      .eq('ai_conversations.stores.business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete AI message: ${error.message}`);
    }
  }

  async getMessagesByDateRange(
    conversationId: string,
    businessId: string,
    startDate: string,
    endDate: string,
    messageType?: string
  ): Promise<AiMessage[]> {
    let query = supabase
      .from('ai_messages')
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          stores (
            business_id
          )
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('ai_conversations.stores.business_id', businessId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    if (messageType) {
      query = query.eq('message_type', messageType);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new Error(`Failed to get messages by date range: ${error.message}`);
    }

    return messages as AiMessage[];
  }

  async createWithAiResponse(
    userMessageData: AiMessageCreate,
    aiResponseContent: string,
    aiMetadata: Record<string, any> = {}
  ): Promise<{ userMessage: AiMessage; aiMessage: AiMessage }> {
    const userMessage = await this.create(userMessageData);

    const aiMessageData: AiMessageCreate = {
      conversation_id: userMessageData.conversation_id,
      content: aiResponseContent,
      message_type: 'ai',
      metadata: {
        response_to_message_id: userMessage.id,
        processing_time_ms: aiMetadata.processing_time_ms,
        model_used: aiMetadata.model_used || 'gpt-4o-mini',
        tokens_used: aiMetadata.tokens_used,
        context_analysis: aiMetadata.context_analysis,
        suggestions_generated: aiMetadata.suggestions_generated,
        ...aiMetadata
      }
    };

    const aiMessage = await this.create(aiMessageData);

    return {
      userMessage,
      aiMessage
    };
  }

  async getMessageContext(
    messageId: string,
    businessId: string,
    contextWindow: number = 10
  ): Promise<AiMessage[]> {
    const message = await this.getById(messageId, businessId);
    if (!message) {
      return [];
    }

    const { data: contextMessages, error } = await supabase
      .from('ai_messages')
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          stores (
            business_id
          )
        )
      `)
      .eq('conversation_id', message.conversation_id)
      .lte('created_at', message.created_at)
      .order('created_at', { ascending: false })
      .limit(contextWindow);

    if (error) {
      throw new Error(`Failed to get message context: ${error.message}`);
    }

    return (contextMessages as AiMessage[]).reverse();
  }

  async getConversationSummary(
    conversationId: string,
    businessId: string
  ): Promise<{
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    lastActivity: string;
    averageResponseTime: number;
  }> {
    const messages = await this.getByConversationId(conversationId, businessId);

    const userMessages = messages.filter(m => m.message_type === 'user');
    const aiMessages = messages.filter(m => m.message_type === 'ai');

    const responseTimes = aiMessages
      .map(ai => {
        const userMsg = userMessages.find(u => 
          ai.metadata?.response_to_message_id === u.id
        );
        if (userMsg) {
          return new Date(ai.created_at).getTime() - new Date(userMsg.created_at).getTime();
        }
        return null;
      })
      .filter(time => time !== null) as number[];

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      lastActivity: messages.length > 0 ? messages[messages.length - 1].created_at : '',
      averageResponseTime
    };
  }

  async searchMessages(
    conversationId: string,
    businessId: string,
    searchTerm: string,
    options: {
      messageType?: string;
      limit?: number;
    } = {}
  ): Promise<AiMessage[]> {
    let query = supabase
      .from('ai_messages')
      .select(`
        *,
        ai_conversations (
          id,
          store_id,
          conversation_type,
          stores (
            business_id
          )
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('ai_conversations.stores.business_id', businessId)
      .ilike('content', `%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (options.messageType) {
      query = query.eq('message_type', options.messageType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data: messages, error } = await query;

    if (error) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }

    return messages as AiMessage[];
  }
}