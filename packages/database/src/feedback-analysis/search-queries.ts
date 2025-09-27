/**
 * SearchQuery model with AI processing
 * Feature: 008-step-2-6
 * Task: T022
 */

import { supabase } from '../client';
import { openaiService } from '../../../backend/src/config/openai';
import type { SearchQuery, ProcessedQuery, FeedbackRecord, SearchRequest, SearchResponse } from '@vocilia/types/feedback-analysis';

export interface CreateSearchQueryData {
  user_id: string;
  store_id: string;
  business_id: string;
  query_text: string;
  processed_query?: ProcessedQuery;
  results_count: number;
  execution_time_ms: number;
}

export interface SearchQueryFilters {
  user_id?: string;
  store_id?: string;
  business_id?: string;
  date_range?: {
    start_date: string;
    end_date: string;
  };
  limit?: number;
  offset?: number;
}

/**
 * Validation functions
 */
export function validateSearchQueryData(data: CreateSearchQueryData): string[] {
  const errors: string[] = [];

  // Required fields validation
  if (!data.user_id || typeof data.user_id !== 'string') {
    errors.push('user_id is required and must be a string');
  }

  if (!data.store_id || typeof data.store_id !== 'string') {
    errors.push('store_id is required and must be a string');
  }

  if (!data.business_id || typeof data.business_id !== 'string') {
    errors.push('business_id is required and must be a string');
  }

  if (!data.query_text || typeof data.query_text !== 'string') {
    errors.push('query_text is required and must be a string');
  } else if (data.query_text.length < 1 || data.query_text.length > 500) {
    errors.push('query_text must be between 1 and 500 characters');
  }

  if (typeof data.results_count !== 'number' || data.results_count < 0) {
    errors.push('results_count must be a non-negative number');
  }

  if (typeof data.execution_time_ms !== 'number' || data.execution_time_ms < 0) {
    errors.push('execution_time_ms must be a non-negative number');
  }

  return errors;
}

export function validateSearchRequest(request: SearchRequest): string[] {
  const errors: string[] = [];

  if (!request.query_text || typeof request.query_text !== 'string') {
    errors.push('query_text is required and must be a string');
  } else if (request.query_text.length < 1 || request.query_text.length > 500) {
    errors.push('query_text must be between 1 and 500 characters');
  }

  if (request.limit !== undefined) {
    if (typeof request.limit !== 'number' || request.limit < 1 || request.limit > 100) {
      errors.push('limit must be a number between 1 and 100');
    }
  }

  if (request.departments !== undefined) {
    if (!Array.isArray(request.departments)) {
      errors.push('departments must be an array');
    } else {
      request.departments.forEach((dept, index) => {
        if (typeof dept !== 'string') {
          errors.push(`departments[${index}] must be a string`);
        }
      });
    }
  }

  if (request.sentiment_filter !== undefined) {
    const validSentiments = ['positive', 'negative', 'neutral', 'mixed', 'all'];
    if (!validSentiments.includes(request.sentiment_filter)) {
      errors.push(`sentiment_filter must be one of: ${validSentiments.join(', ')}`);
    }
  }

  if (request.date_range !== undefined) {
    if (!request.date_range.start_date || !request.date_range.end_date) {
      errors.push('date_range must include both start_date and end_date');
    } else {
      const startDate = new Date(request.date_range.start_date);
      const endDate = new Date(request.date_range.end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('date_range dates must be valid ISO date strings');
      } else if (startDate >= endDate) {
        errors.push('date_range start_date must be before end_date');
      }
    }
  }

  return errors;
}

/**
 * AI Processing utilities
 */
export class SearchQueryProcessor {
  /**
   * Process natural language query with AI
   */
  static async processNaturalLanguageQuery(queryText: string): Promise<ProcessedQuery> {
    try {
      const processed = await openaiService.processSearchQuery(queryText);
      
      return {
        departments: processed.departments || [],
        sentiment_filter: processed.sentiment_filter || 'all',
        keywords: processed.keywords || [],
        intent: processed.intent || 'General search query',
      };
    } catch (error) {
      console.warn('AI processing failed, using fallback:', error);
      
      // Fallback processing without AI
      return this.fallbackProcessing(queryText);
    }
  }

  /**
   * Fallback processing when AI is unavailable
   */
  private static fallbackProcessing(queryText: string): ProcessedQuery {
    const lowercaseQuery = queryText.toLowerCase();
    const departments: string[] = [];
    let sentiment_filter: ProcessedQuery['sentiment_filter'] = 'all';
    
    // Department detection (Swedish terms)
    const departmentMap: Record<string, string[]> = {
      'kött': ['kött', 'chark', 'slakt', 'meat'],
      'kassa': ['kassa', 'checkout', 'betala', 'kvitto'],
      'bageri': ['bageri', 'bröd', 'bakning', 'bakery'],
      'kundservice': ['service', 'personal', 'hjälp', 'support'],
      'parkering': ['parkering', 'bil', 'parking'],
      'frukt': ['frukt', 'grönt', 'fruit', 'vegetables'],
      'mejeri': ['mjölk', 'ost', 'yoghurt', 'dairy'],
    };

    Object.entries(departmentMap).forEach(([dept, keywords]) => {
      if (keywords.some(keyword => lowercaseQuery.includes(keyword))) {
        departments.push(dept);
      }
    });

    // Sentiment detection
    const positiveWords = ['bra', 'bästa', 'fantastisk', 'excellent', 'good', 'great'];
    const negativeWords = ['dålig', 'värst', 'problem', 'fel', 'bad', 'terrible', 'issue'];
    
    const hasPositive = positiveWords.some(word => lowercaseQuery.includes(word));
    const hasNegative = negativeWords.some(word => lowercaseQuery.includes(word));
    
    if (hasPositive && !hasNegative) {
      sentiment_filter = 'positive';
    } else if (hasNegative && !hasPositive) {
      sentiment_filter = 'negative';
    }

    // Extract keywords (remove common Swedish stop words)
    const stopWords = ['och', 'att', 'det', 'som', 'för', 'på', 'är', 'med', 'av', 'i', 'en', 'till'];
    const keywords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 5); // Limit to 5 keywords

    return {
      departments,
      sentiment_filter,
      keywords,
      intent: `Search for feedback related to: ${keywords.join(', ')}`,
    };
  }

  /**
   * Generate AI summary for search results
   */
  static async generateSearchSummary(
    queryText: string,
    results: FeedbackRecord[],
    executionTimeMs: number
  ): Promise<string> {
    if (results.length === 0) {
      return `Inga resultat hittades för "${queryText}". Försök med andra sökord eller bredare kriterier.`;
    }

    try {
      // Prepare data for AI summary
      const summaryData = results.slice(0, 10).map(feedback => ({
        content: feedback.content.substring(0, 200), // Limit content length
        sentiment: feedback.sentiment,
        department_tags: feedback.department_tags,
      }));

      const prompt = `Sammanfatta dessa sökresultat för frågan "${queryText}":
${JSON.stringify(summaryData)}

Skriv en kort sammanfattning på svenska (max 200 tecken) som täcker huvudämnen och sentiment.`;

      const summary = await openaiService.makeRequest(
        prompt,
        'Du är en AI-assistent som sammanfattar kundfeedback på svenska. Svara endast med sammanfattningen, ingen annan text.',
        200
      );

      return summary.trim();
    } catch (error) {
      console.warn('AI summary generation failed, using fallback:', error);
      
      // Fallback summary
      const sentimentCounts = results.reduce((acc, feedback) => {
        if (feedback.sentiment) {
          acc[feedback.sentiment] = (acc[feedback.sentiment] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const topSentiment = Object.entries(sentimentCounts)
        .sort(([,a], [,b]) => b - a)[0];

      return `Hittade ${results.length} resultat för "${queryText}". ${
        topSentiment ? `Mest vanliga sentiment: ${topSentiment[0]} (${topSentiment[1]} st)` : ''
      }`;
    }
  }
}

/**
 * Database operations
 */
export class SearchQueryService {
  /**
   * Create and log a search query
   */
  static async create(data: CreateSearchQueryData): Promise<SearchQuery> {
    const errors = validateSearchQueryData(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const { data: query, error } = await supabase
      .from('search_queries')
      .insert([{
        ...data,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create search query: ${error.message}`);
    }

    return query as SearchQuery;
  }

  /**
   * Execute search with AI processing
   */
  static async executeSearch(
    request: SearchRequest,
    storeId: string,
    businessId: string,
    userId: string
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Validate request
    const validationErrors = validateSearchRequest(request);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid search request: ${validationErrors.join(', ')}`);
    }

    try {
      // Process query with AI
      const processedQuery = await SearchQueryProcessor.processNaturalLanguageQuery(request.query_text);

      // Build search query
      let searchQuery = supabase
        .from('feedback_records')
        .select('*')
        .eq('store_id', storeId);

      // Apply filters
      if (request.departments && request.departments.length > 0) {
        searchQuery = searchQuery.overlaps('department_tags', request.departments);
      } else if (processedQuery.departments && processedQuery.departments.length > 0) {
        searchQuery = searchQuery.overlaps('department_tags', processedQuery.departments);
      }

      if (request.sentiment_filter && request.sentiment_filter !== 'all') {
        searchQuery = searchQuery.eq('sentiment', request.sentiment_filter);
      } else if (processedQuery.sentiment_filter && processedQuery.sentiment_filter !== 'all') {
        searchQuery = searchQuery.eq('sentiment', processedQuery.sentiment_filter);
      }

      if (request.date_range) {
        searchQuery = searchQuery
          .gte('created_at', request.date_range.start_date)
          .lte('created_at', request.date_range.end_date);
      }

      // Text search in content (if keywords were extracted)
      if (processedQuery.keywords && processedQuery.keywords.length > 0) {
        const searchTerms = processedQuery.keywords.join(' | ');
        searchQuery = searchQuery.textSearch('content', searchTerms);
      } else {
        // Fallback to simple text search
        const searchTerms = request.query_text.split(' ').join(' | ');
        searchQuery = searchQuery.textSearch('content', searchTerms);
      }

      // Apply limit and ordering
      const limit = request.limit || 20;
      searchQuery = searchQuery
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data: results, error: searchError, count } = await searchQuery;

      if (searchError) {
        throw new Error(`Search failed: ${searchError.message}`);
      }

      const executionTime = Date.now() - startTime;
      const feedbackResults = results as FeedbackRecord[];

      // Generate AI summary
      const summary = await SearchQueryProcessor.generateSearchSummary(
        request.query_text,
        feedbackResults,
        executionTime
      );

      // Log the search query
      await this.create({
        user_id: userId,
        store_id: storeId,
        business_id: businessId,
        query_text: request.query_text,
        processed_query: processedQuery,
        results_count: feedbackResults.length,
        execution_time_ms: executionTime,
      });

      return {
        feedback: feedbackResults,
        total_count: count || feedbackResults.length,
        execution_time_ms: executionTime,
        summary,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Log failed search
      try {
        await this.create({
          user_id: userId,
          store_id: storeId,
          business_id: businessId,
          query_text: request.query_text,
          results_count: 0,
          execution_time_ms: executionTime,
        });
      } catch (logError) {
        console.error('Failed to log search query:', logError);
      }

      throw error;
    }
  }

  /**
   * Get search history for a user
   */
  static async getSearchHistory(
    userId: string,
    storeId?: string,
    limit: number = 10
  ): Promise<SearchQuery[]> {
    let query = supabase
      .from('search_queries')
      .select('*')
      .eq('user_id', userId);

    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    const { data: queries, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get search history: ${error.message}`);
    }

    return queries as SearchQuery[];
  }

  /**
   * Get popular search terms for a store
   */
  static async getPopularSearchTerms(
    storeId: string,
    days: number = 30,
    limit: number = 10
  ): Promise<Array<{ term: string; count: number; avg_results: number }>> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const { data, error } = await supabase
      .rpc('get_popular_search_terms', {
        store_id_param: storeId,
        date_limit: dateLimit.toISOString(),
        result_limit: limit,
      });

    if (error) {
      throw new Error(`Failed to get popular search terms: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get search analytics for a store
   */
  static async getSearchAnalytics(
    storeId: string,
    days: number = 30
  ): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    avgResultsPerSearch: number;
    topDepartments: Array<{ department: string; count: number }>;
    searchTrend: Array<{ date: string; count: number }>;
  }> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const { data: analytics, error } = await supabase
      .rpc('get_search_analytics', {
        store_id_param: storeId,
        date_limit: dateLimit.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to get search analytics: ${error.message}`);
    }

    return analytics || {
      totalSearches: 0,
      avgExecutionTime: 0,
      avgResultsPerSearch: 0,
      topDepartments: [],
      searchTrend: [],
    };
  }

  /**
   * List search queries with filters
   */
  static async list(filters: SearchQueryFilters = {}): Promise<SearchQuery[]> {
    let query = supabase
      .from('search_queries')
      .select('*');

    // Apply filters
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters.store_id) {
      query = query.eq('store_id', filters.store_id);
    }

    if (filters.business_id) {
      query = query.eq('business_id', filters.business_id);
    }

    if (filters.date_range) {
      query = query
        .gte('created_at', filters.date_range.start_date)
        .lte('created_at', filters.date_range.end_date);
    }

    // Apply ordering and pagination
    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
    }

    const { data: queries, error } = await query;

    if (error) {
      throw new Error(`Failed to list search queries: ${error.message}`);
    }

    return queries as SearchQuery[];
  }
}

export default SearchQueryService;