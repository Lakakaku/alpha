import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { AiConversation, AiConversationCreate, AiConversationUpdate } from '@vocilia/types/ai-assistant';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AiConversationModel {
  async create(data: AiConversationCreate): Promise<AiConversation> {
    const conversationData = {
      ...data,
      status: data.status || 'active',
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .insert(conversationData)
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create AI conversation: ${error.message}`);
    }

    return conversation as AiConversation;
  }

  async getById(id: string, businessId: string): Promise<AiConversation | null> {
    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        ),
        ai_messages (
          id,
          content,
          message_type,
          metadata,
          created_at
        )
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get AI conversation: ${error.message}`);
    }

    return conversation as AiConversation;
  }

  async getByStoreId(
    storeId: string, 
    businessId: string,
    options: {
      status?: string;
      conversationType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AiConversation[]> {
    let query = supabase
      .from('ai_conversations')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        ),
        ai_messages (
          id,
          content,
          message_type,
          metadata,
          created_at
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.conversationType) {
      query = query.eq('conversation_type', options.conversationType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: conversations, error } = await query;

    if (error) {
      throw new Error(`Failed to get AI conversations for store: ${error.message}`);
    }

    return conversations as AiConversation[];
  }

  async getByBusinessId(
    businessId: string,
    options: {
      status?: string;
      conversationType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AiConversation[]> {
    let query = supabase
      .from('ai_conversations')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('stores.business_id', businessId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.conversationType) {
      query = query.eq('conversation_type', options.conversationType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: conversations, error } = await query;

    if (error) {
      throw new Error(`Failed to get AI conversations for business: ${error.message}`);
    }

    return conversations as AiConversation[];
  }

  async update(
    id: string, 
    businessId: string, 
    data: AiConversationUpdate
  ): Promise<AiConversation> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const { data: conversation, error } = await supabase
      .from('ai_conversations')
      .update(updateData)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update AI conversation: ${error.message}`);
    }

    return conversation as AiConversation;
  }

  async updateMetadata(
    id: string,
    businessId: string,
    metadata: Record<string, any>
  ): Promise<AiConversation> {
    const { data: current, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('metadata')
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch conversation metadata: ${fetchError.message}`);
    }

    const updatedMetadata = {
      ...current.metadata,
      ...metadata
    };

    return this.update(id, businessId, { metadata: updatedMetadata });
  }

  async getActiveByStoreId(storeId: string, businessId: string): Promise<AiConversation | null> {
    const conversations = await this.getByStoreId(storeId, businessId, {
      status: 'active',
      limit: 1
    });

    return conversations.length > 0 ? conversations[0] : null;
  }

  async getLatestByType(
    storeId: string,
    businessId: string,
    conversationType: string
  ): Promise<AiConversation | null> {
    const conversations = await this.getByStoreId(storeId, businessId, {
      conversationType,
      limit: 1
    });

    return conversations.length > 0 ? conversations[0] : null;
  }

  async delete(id: string, businessId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('stores.business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete AI conversation: ${error.message}`);
    }
  }

  async getContextEntriesCount(conversationId: string, businessId: string): Promise<number> {
    const { data: conversation } = await supabase
      .from('ai_conversations')
      .select('store_id')
      .eq('id', conversationId)
      .eq('stores.business_id', businessId)
      .single();

    if (!conversation) {
      return 0;
    }

    const { count, error } = await supabase
      .from('context_entries')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', conversation.store_id);

    if (error) {
      throw new Error(`Failed to count context entries: ${error.message}`);
    }

    return count || 0;
  }

  async getMessagesCount(conversationId: string, businessId: string): Promise<number> {
    const { count, error } = await supabase
      .from('ai_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (error) {
      throw new Error(`Failed to count messages: ${error.message}`);
    }

    return count || 0;
  }

  async markAsCompleted(id: string, businessId: string): Promise<AiConversation> {
    return this.update(id, businessId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  }

  async markAsPaused(id: string, businessId: string): Promise<AiConversation> {
    return this.update(id, businessId, {
      status: 'paused'
    });
  }

  async markAsActive(id: string, businessId: string): Promise<AiConversation> {
    return this.update(id, businessId, {
      status: 'active'
    });
  }

  async getConversationsByDateRange(
    businessId: string,
    startDate: string,
    endDate: string,
    storeId?: string
  ): Promise<AiConversation[]> {
    let query = supabase
      .from('ai_conversations')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('stores.business_id', businessId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data: conversations, error } = await query;

    if (error) {
      throw new Error(`Failed to get conversations by date range: ${error.message}`);
    }

    return conversations as AiConversation[];
  }
}