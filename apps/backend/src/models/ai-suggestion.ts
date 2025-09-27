import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { AiSuggestion, AiSuggestionCreate, AiSuggestionUpdate } from '@vocilia/types/ai-assistant';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AiSuggestionModel {
  async create(data: AiSuggestionCreate): Promise<AiSuggestion> {
    const suggestionData = {
      ...data,
      status: data.status || 'pending',
      confidence_score: data.confidence_score || 0.8,
      priority: data.priority || 'medium',
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: suggestion, error } = await supabase
      .from('ai_suggestions')
      .insert(suggestionData)
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
      throw new Error(`Failed to create AI suggestion: ${error.message}`);
    }

    return suggestion as AiSuggestion;
  }

  async getById(id: string, businessId: string): Promise<AiSuggestion | null> {
    const { data: suggestion, error } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get AI suggestion: ${error.message}`);
    }

    return suggestion as AiSuggestion;
  }

  async getByStoreId(
    storeId: string,
    businessId: string,
    options: {
      status?: string;
      category?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AiSuggestion[]> {
    let query = supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .order('priority', { ascending: false })
      .order('confidence_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.priority) {
      query = query.eq('priority', options.priority);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: suggestions, error } = await query;

    if (error) {
      throw new Error(`Failed to get AI suggestions for store: ${error.message}`);
    }

    return suggestions as AiSuggestion[];
  }

  async getPendingSuggestions(
    storeId: string,
    businessId: string,
    limit: number = 10
  ): Promise<AiSuggestion[]> {
    return this.getByStoreId(storeId, businessId, {
      status: 'pending',
      limit
    });
  }

  async getHighPrioritySuggestions(
    storeId: string,
    businessId: string,
    limit: number = 5
  ): Promise<AiSuggestion[]> {
    return this.getByStoreId(storeId, businessId, {
      status: 'pending',
      priority: 'high',
      limit
    });
  }

  async getSuggestionsByCategory(
    storeId: string,
    businessId: string,
    category: string
  ): Promise<AiSuggestion[]> {
    return this.getByStoreId(storeId, businessId, {
      status: 'pending',
      category
    });
  }

  async update(
    id: string,
    businessId: string,
    data: AiSuggestionUpdate
  ): Promise<AiSuggestion> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const { data: suggestion, error } = await supabase
      .from('ai_suggestions')
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
      throw new Error(`Failed to update AI suggestion: ${error.message}`);
    }

    return suggestion as AiSuggestion;
  }

  async updateMetadata(
    id: string,
    businessId: string,
    metadata: Record<string, any>
  ): Promise<AiSuggestion> {
    const { data: current, error: fetchError } = await supabase
      .from('ai_suggestions')
      .select('metadata')
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch suggestion metadata: ${fetchError.message}`);
    }

    const updatedMetadata = {
      ...current.metadata,
      ...metadata
    };

    return this.update(id, businessId, { metadata: updatedMetadata });
  }

  async accept(id: string, businessId: string): Promise<AiSuggestion> {
    return this.update(id, businessId, {
      status: 'accepted',
      accepted_at: new Date().toISOString()
    });
  }

  async reject(id: string, businessId: string, reason?: string): Promise<AiSuggestion> {
    const updateData: AiSuggestionUpdate = {
      status: 'rejected',
      rejected_at: new Date().toISOString()
    };

    if (reason) {
      updateData.metadata = { rejection_reason: reason };
    }

    return this.update(id, businessId, updateData);
  }

  async dismiss(id: string, businessId: string): Promise<AiSuggestion> {
    return this.update(id, businessId, {
      status: 'dismissed',
      dismissed_at: new Date().toISOString()
    });
  }

  async delete(id: string, businessId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_suggestions')
      .delete()
      .eq('id', id)
      .eq('stores.business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete AI suggestion: ${error.message}`);
    }
  }

  async createBatch(suggestions: AiSuggestionCreate[]): Promise<AiSuggestion[]> {
    const suggestionsData = suggestions.map(data => ({
      ...data,
      status: data.status || 'pending',
      confidence_score: data.confidence_score || 0.8,
      priority: data.priority || 'medium',
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: createdSuggestions, error } = await supabase
      .from('ai_suggestions')
      .insert(suggestionsData)
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `);

    if (error) {
      throw new Error(`Failed to create AI suggestions batch: ${error.message}`);
    }

    return createdSuggestions as AiSuggestion[];
  }

  async getExistingSuggestion(
    storeId: string,
    businessId: string,
    category: string,
    content: string
  ): Promise<AiSuggestion | null> {
    const { data: suggestion, error } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .eq('category', category)
      .eq('status', 'pending')
      .ilike('content', `%${content.substring(0, 50)}%`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to check for existing suggestion: ${error.message}`);
    }

    return suggestion as AiSuggestion;
  }

  async createIfNotExists(data: AiSuggestionCreate): Promise<AiSuggestion> {
    const existing = await this.getExistingSuggestion(
      data.store_id,
      data.stores?.business_id || '',
      data.category,
      data.content
    );

    if (existing) {
      return existing;
    }

    return this.create(data);
  }

  async getSuggestionStats(storeId: string, businessId: string): Promise<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    dismissed: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    averageConfidence: number;
  }> {
    const suggestions = await this.getByStoreId(storeId, businessId);

    const stats = {
      total: suggestions.length,
      pending: suggestions.filter(s => s.status === 'pending').length,
      accepted: suggestions.filter(s => s.status === 'accepted').length,
      rejected: suggestions.filter(s => s.status === 'rejected').length,
      dismissed: suggestions.filter(s => s.status === 'dismissed').length,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      averageConfidence: 0
    };

    suggestions.forEach(suggestion => {
      stats.byCategory[suggestion.category] = (stats.byCategory[suggestion.category] || 0) + 1;
      stats.byPriority[suggestion.priority] = (stats.byPriority[suggestion.priority] || 0) + 1;
    });

    stats.averageConfidence = suggestions.length > 0
      ? suggestions.reduce((sum, s) => sum + s.confidence_score, 0) / suggestions.length
      : 0;

    return stats;
  }

  async getRecentSuggestions(
    storeId: string,
    businessId: string,
    hours: number = 24
  ): Promise<AiSuggestion[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const { data: suggestions, error } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get recent suggestions: ${error.message}`);
    }

    return suggestions as AiSuggestion[];
  }

  async expirePendingSuggestions(
    storeId: string,
    businessId: string,
    olderThanHours: number = 168 // 7 days
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const { data: expiredSuggestions, error } = await supabase
      .from('ai_suggestions')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .eq('status', 'pending')
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to expire suggestions: ${error.message}`);
    }

    return expiredSuggestions.length;
  }

  async getSuggestionsByConfidenceRange(
    storeId: string,
    businessId: string,
    minConfidence: number,
    maxConfidence: number = 1.0
  ): Promise<AiSuggestion[]> {
    const { data: suggestions, error } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .eq('status', 'pending')
      .gte('confidence_score', minConfidence)
      .lte('confidence_score', maxConfidence)
      .order('confidence_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get suggestions by confidence range: ${error.message}`);
    }

    return suggestions as AiSuggestion[];
  }

  async searchSuggestions(
    storeId: string,
    businessId: string,
    searchTerm: string,
    options: {
      status?: string;
      category?: string;
      limit?: number;
    } = {}
  ): Promise<AiSuggestion[]> {
    let query = supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores (
          id,
          store_name,
          business_id
        )
      `)
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .or(`content.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
      .order('confidence_score', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data: suggestions, error } = await query;

    if (error) {
      throw new Error(`Failed to search suggestions: ${error.message}`);
    }

    return suggestions as AiSuggestion[];
  }
}