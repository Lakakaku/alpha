import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';
import { ContextEntry, ContextEntryCreate, ContextEntryUpdate } from '@vocilia/types/ai-assistant';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class ContextEntryModel {
  async create(data: ContextEntryCreate): Promise<ContextEntry> {
    const entryData = {
      ...data,
      confidence_score: data.confidence_score || 0.8,
      version: data.version || 1,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: entry, error } = await supabase
      .from('context_entries')
      .insert(entryData)
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
      throw new Error(`Failed to create context entry: ${error.message}`);
    }

    return entry as ContextEntry;
  }

  async getById(id: string, businessId: string): Promise<ContextEntry | null> {
    const { data: entry, error } = await supabase
      .from('context_entries')
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
      throw new Error(`Failed to get context entry: ${error.message}`);
    }

    return entry as ContextEntry;
  }

  async getByStoreId(
    storeId: string,
    businessId: string,
    options: {
      category?: string;
      source?: string;
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    } = {}
  ): Promise<ContextEntry[]> {
    let query = supabase
      .from('context_entries')
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
      .order('created_at', { ascending: false });

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.source) {
      query = query.eq('source', options.source);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: entries, error } = await query;

    if (error) {
      throw new Error(`Failed to get context entries for store: ${error.message}`);
    }

    return entries as ContextEntry[];
  }

  async getByCategory(
    storeId: string,
    businessId: string,
    category: string
  ): Promise<ContextEntry[]> {
    return this.getByStoreId(storeId, businessId, { category });
  }

  async getLatestByCategory(
    storeId: string,
    businessId: string,
    category: string
  ): Promise<ContextEntry | null> {
    const entries = await this.getByCategory(storeId, businessId, category);
    return entries.length > 0 ? entries[0] : null;
  }

  async update(
    id: string,
    businessId: string,
    data: ContextEntryUpdate
  ): Promise<ContextEntry> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const { data: entry, error } = await supabase
      .from('context_entries')
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
      throw new Error(`Failed to update context entry: ${error.message}`);
    }

    return entry as ContextEntry;
  }

  async updateMetadata(
    id: string,
    businessId: string,
    metadata: Record<string, any>
  ): Promise<ContextEntry> {
    const { data: current, error: fetchError } = await supabase
      .from('context_entries')
      .select('metadata')
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch context entry metadata: ${fetchError.message}`);
    }

    const updatedMetadata = {
      ...current.metadata,
      ...metadata
    };

    return this.update(id, businessId, { metadata: updatedMetadata });
  }

  async createOrUpdateByCategory(
    storeId: string,
    businessId: string,
    category: string,
    content: string,
    options: {
      source?: string;
      confidenceScore?: number;
      metadata?: Record<string, any>;
      replaceExisting?: boolean;
    } = {}
  ): Promise<ContextEntry> {
    const existing = await this.getLatestByCategory(storeId, businessId, category);

    if (existing && options.replaceExisting) {
      const newVersion = existing.version + 1;
      await this.update(existing.id, businessId, { is_active: false });

      return this.create({
        store_id: storeId,
        category,
        content,
        source: options.source || 'ai_assistant',
        confidence_score: options.confidenceScore || 0.8,
        version: newVersion,
        metadata: options.metadata || {}
      });
    } else if (existing && !options.replaceExisting) {
      return this.update(existing.id, businessId, {
        content: existing.content + '\n\n' + content,
        confidence_score: Math.max(existing.confidence_score, options.confidenceScore || 0.8),
        metadata: {
          ...existing.metadata,
          ...(options.metadata || {}),
          updated_via: 'enhancement'
        }
      });
    } else {
      return this.create({
        store_id: storeId,
        category,
        content,
        source: options.source || 'ai_assistant',
        confidence_score: options.confidenceScore || 0.8,
        version: 1,
        metadata: options.metadata || {}
      });
    }
  }

  async delete(id: string, businessId: string): Promise<void> {
    const { error } = await supabase
      .from('context_entries')
      .delete()
      .eq('id', id)
      .eq('stores.business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete context entry: ${error.message}`);
    }
  }

  async softDelete(id: string, businessId: string): Promise<ContextEntry> {
    return this.update(id, businessId, { is_active: false });
  }

  async getAllCategories(storeId: string, businessId: string): Promise<string[]> {
    const { data: categories, error } = await supabase
      .from('context_entries')
      .select('category')
      .eq('store_id', storeId)
      .eq('stores.business_id', businessId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }

    return [...new Set(categories.map(c => c.category))];
  }

  async getEntriesByCategories(
    storeId: string,
    businessId: string,
    categories: string[]
  ): Promise<ContextEntry[]> {
    const { data: entries, error } = await supabase
      .from('context_entries')
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
      .in('category', categories)
      .eq('is_active', true)
      .order('category')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get entries by categories: ${error.message}`);
    }

    return entries as ContextEntry[];
  }

  async searchContent(
    storeId: string,
    businessId: string,
    searchTerm: string,
    options: {
      category?: string;
      limit?: number;
    } = {}
  ): Promise<ContextEntry[]> {
    let query = supabase
      .from('context_entries')
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
      .eq('is_active', true)
      .ilike('content', `%${searchTerm}%`)
      .order('confidence_score', { ascending: false });

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data: entries, error } = await query;

    if (error) {
      throw new Error(`Failed to search context entries: ${error.message}`);
    }

    return entries as ContextEntry[];
  }

  async getConflictingEntries(
    storeId: string,
    businessId: string,
    category: string,
    newContent: string
  ): Promise<ContextEntry[]> {
    const existingEntries = await this.getByCategory(storeId, businessId, category);
    
    return existingEntries.filter(entry => {
      const contentLower = entry.content.toLowerCase();
      const newContentLower = newContent.toLowerCase();
      
      const conflictKeywords = {
        operating_hours: ['open', 'close', 'hours', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        price_range: ['$', 'price', 'cost', 'expensive', 'cheap', 'affordable'],
        business_type: ['restaurant', 'cafe', 'bar', 'shop', 'store']
      };

      const keywords = conflictKeywords[category as keyof typeof conflictKeywords] || [];
      
      return keywords.some(keyword => 
        contentLower.includes(keyword) && newContentLower.includes(keyword)
      );
    });
  }

  async getContextSummary(storeId: string, businessId: string): Promise<{
    totalEntries: number;
    categoriesCovered: string[];
    highConfidenceEntries: number;
    lastUpdated: string;
    averageConfidence: number;
  }> {
    const entries = await this.getByStoreId(storeId, businessId);

    const categoriesCovered = [...new Set(entries.map(e => e.category))];
    const highConfidenceEntries = entries.filter(e => e.confidence_score >= 0.8).length;
    const averageConfidence = entries.length > 0
      ? entries.reduce((sum, e) => sum + e.confidence_score, 0) / entries.length
      : 0;

    return {
      totalEntries: entries.length,
      categoriesCovered,
      highConfidenceEntries,
      lastUpdated: entries.length > 0 ? entries[0].updated_at : '',
      averageConfidence
    };
  }

  async getEntriesByConfidenceRange(
    storeId: string,
    businessId: string,
    minConfidence: number,
    maxConfidence: number = 1.0
  ): Promise<ContextEntry[]> {
    const { data: entries, error } = await supabase
      .from('context_entries')
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
      .eq('is_active', true)
      .gte('confidence_score', minConfidence)
      .lte('confidence_score', maxConfidence)
      .order('confidence_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to get entries by confidence range: ${error.message}`);
    }

    return entries as ContextEntry[];
  }

  async getRecentUpdates(
    storeId: string,
    businessId: string,
    hours: number = 24
  ): Promise<ContextEntry[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const { data: entries, error } = await supabase
      .from('context_entries')
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
      .eq('is_active', true)
      .gte('updated_at', cutoffDate.toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get recent updates: ${error.message}`);
    }

    return entries as ContextEntry[];
  }
}