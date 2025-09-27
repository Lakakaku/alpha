import { QuestionFilters, PaginationParams, SortOptions } from '@vocilia/types';
import { Database } from '@vocilia/database';

export interface PaginatedQuestionParams extends QuestionFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface QuestionQueryBuilder {
  select: string[];
  joins: string[];
  where: string[];
  params: any[];
  orderBy: string;
  limit: string;
}

export class QuestionPaginationService {
  private db: Database;
  private maxLimit = 100;
  private defaultLimit = 25;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Build optimized query for paginated questions
   */
  buildQuestionQuery(
    businessId: string,
    filters: PaginatedQuestionParams
  ): QuestionQueryBuilder {
    const {
      page = 1,
      limit = this.defaultLimit,
      sort = 'created_at',
      order = 'desc',
      ...questionFilters
    } = filters;

    const query: QuestionQueryBuilder = {
      select: [
        'q.id',
        'q.title',
        'q.description',
        'q.type',
        'q.required',
        'q.active',
        'q.position',
        'q.tags',
        'q.response_count',
        'q.avg_response_time',
        'q.created_at',
        'q.updated_at',
        'c.name as category_name',
        'c.color as category_color',
        'c.id as category_id',
      ],
      joins: [
        'LEFT JOIN question_categories c ON q.category_id = c.id'
      ],
      where: ['q.business_id = ?'],
      params: [businessId],
      orderBy: this.buildOrderByClause(sort, order),
      limit: this.buildLimitClause(page, Math.min(limit, this.maxLimit)),
    };

    // Apply filters
    this.applyFilters(query, questionFilters);

    return query;
  }

  /**
   * Apply various filters to the query
   */
  private applyFilters(query: QuestionQueryBuilder, filters: QuestionFilters): void {
    const { where, params } = query;

    // Category filter
    if (filters.category_id) {
      where.push('q.category_id = ?');
      params.push(filters.category_id);
    }

    // Active status filter
    if (filters.active !== undefined) {
      where.push('q.active = ?');
      params.push(filters.active);
    }

    // Question type filter
    if (filters.type) {
      where.push('q.type = ?');
      params.push(filters.type);
    }

    // Required filter
    if (filters.required !== undefined) {
      where.push('q.required = ?');
      params.push(filters.required);
    }

    // Tags filter (array intersection)
    if (filters.tags && filters.tags.length > 0) {
      // Using PostgreSQL array operators for efficient tag filtering
      where.push('q.tags && ?');
      params.push(JSON.stringify(filters.tags));
    }

    // Search filter (full-text search across title and description)
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      
      // Use PostgreSQL full-text search for better performance
      where.push(`(
        to_tsvector('english', q.title) @@ plainto_tsquery('english', ?) OR
        to_tsvector('english', coalesce(q.description, '')) @@ plainto_tsquery('english', ?) OR
        q.title ILIKE ? OR
        q.description ILIKE ?
      )`);
      params.push(searchTerm, searchTerm, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // Date range filters
    if (filters.created_after) {
      where.push('q.created_at >= ?');
      params.push(filters.created_after);
    }

    if (filters.created_before) {
      where.push('q.created_at <= ?');
      params.push(filters.created_before);
    }

    if (filters.updated_after) {
      where.push('q.updated_at >= ?');
      params.push(filters.updated_after);
    }

    if (filters.updated_before) {
      where.push('q.updated_at <= ?');
      params.push(filters.updated_before);
    }

    // Response count filters
    if (filters.min_responses !== undefined) {
      where.push('q.response_count >= ?');
      params.push(filters.min_responses);
    }

    if (filters.max_responses !== undefined) {
      where.push('q.response_count <= ?');
      params.push(filters.max_responses);
    }

    // Performance filters
    if (filters.min_avg_response_time !== undefined) {
      where.push('q.avg_response_time >= ?');
      params.push(filters.min_avg_response_time);
    }

    if (filters.max_avg_response_time !== undefined) {
      where.push('q.avg_response_time <= ?');
      params.push(filters.max_avg_response_time);
    }

    // Position range filters
    if (filters.min_position !== undefined) {
      where.push('q.position >= ?');
      params.push(filters.min_position);
    }

    if (filters.max_position !== undefined) {
      where.push('q.position <= ?');
      params.push(filters.max_position);
    }
  }

  /**
   * Build ORDER BY clause with safe column validation
   */
  private buildOrderByClause(sort: string, order: 'asc' | 'desc'): string {
    const allowedSortColumns = {
      'title': 'q.title',
      'created_at': 'q.created_at',
      'updated_at': 'q.updated_at',
      'position': 'q.position',
      'response_count': 'q.response_count',
      'avg_response_time': 'q.avg_response_time',
      'category_name': 'c.name',
      'type': 'q.type',
      'active': 'q.active',
      'required': 'q.required',
    };

    const column = allowedSortColumns[sort as keyof typeof allowedSortColumns];
    if (!column) {
      throw new Error(`Invalid sort column: ${sort}`);
    }

    const direction = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    return `${column} ${direction}`;
  }

  /**
   * Build LIMIT and OFFSET clause
   */
  private buildLimitClause(page: number, limit: number): string {
    const offset = (Math.max(1, page) - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }

  /**
   * Execute paginated query and return results with metadata
   */
  async executePaginatedQuery<T>(
    baseQuery: string,
    countQuery: string,
    params: any[]
  ): Promise<PaginationResult<T>> {
    // Execute count query for total records
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult[0]?.count || '0', 10);

    // Execute main query for data
    const data = await this.db.query(baseQuery, params);

    // Extract pagination info from the query
    const limitMatch = baseQuery.match(/LIMIT (\d+) OFFSET (\d+)/);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : this.defaultLimit;
    const offset = limitMatch ? parseInt(limitMatch[2], 10) : 0;
    const page = Math.floor(offset / limit) + 1;

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as T[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get paginated questions with optimized query
   */
  async getPaginatedQuestions(
    businessId: string,
    filters: PaginatedQuestionParams
  ): Promise<PaginationResult<any>> {
    const queryBuilder = this.buildQuestionQuery(businessId, filters);

    // Build main query
    const baseQuery = `
      SELECT ${queryBuilder.select.join(', ')}
      FROM custom_questions q
      ${queryBuilder.joins.join(' ')}
      WHERE ${queryBuilder.where.join(' AND ')}
      ORDER BY ${queryBuilder.orderBy}
      ${queryBuilder.limit}
    `;

    // Build count query (without ORDER BY and LIMIT for better performance)
    const countQuery = `
      SELECT COUNT(*) as count
      FROM custom_questions q
      ${queryBuilder.joins.join(' ')}
      WHERE ${queryBuilder.where.join(' AND ')}
    `;

    return this.executePaginatedQuery(baseQuery, countQuery, queryBuilder.params);
  }

  /**
   * Get paginated categories with question count
   */
  async getPaginatedCategories(
    businessId: string,
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ): Promise<PaginationResult<any>> {
    const {
      page = 1,
      limit = this.defaultLimit,
      search,
      sort = 'name',
      order = 'asc'
    } = filters;

    const where = ['c.business_id = ?'];
    const params = [businessId];

    // Search filter
    if (search && search.trim()) {
      where.push('(c.name ILIKE ? OR c.description ILIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Build ORDER BY
    const allowedSortColumns = {
      'name': 'c.name',
      'created_at': 'c.created_at',
      'updated_at': 'c.updated_at',
      'question_count': 'question_count',
      'is_default': 'c.is_default',
    };

    const column = allowedSortColumns[sort as keyof typeof allowedSortColumns];
    if (!column) {
      throw new Error(`Invalid sort column: ${sort}`);
    }

    const direction = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const orderBy = `${column} ${direction}`;

    const offset = (Math.max(1, page) - 1) * Math.min(limit, this.maxLimit);

    // Main query with question count
    const baseQuery = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.color,
        c.is_default,
        c.created_at,
        c.updated_at,
        COUNT(q.id) as question_count,
        COUNT(CASE WHEN q.active = true THEN 1 END) as active_question_count
      FROM question_categories c
      LEFT JOIN custom_questions q ON c.id = q.category_id
      WHERE ${where.join(' AND ')}
      GROUP BY c.id, c.name, c.description, c.color, c.is_default, c.created_at, c.updated_at
      ORDER BY ${orderBy}
      LIMIT ${Math.min(limit, this.maxLimit)} OFFSET ${offset}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as count
      FROM question_categories c
      WHERE ${where.join(' AND ')}
    `;

    return this.executePaginatedQuery(baseQuery, countQuery, params);
  }

  /**
   * Cache frequently used queries for better performance
   */
  private queryCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get cached query result or execute and cache
   */
  async getCachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.queryCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return cached.data as T;
    }

    const result = await queryFn();
    this.queryCache.set(cacheKey, { data: result, timestamp: now });

    return result;
  }

  /**
   * Clear cache (useful for testing or after data changes)
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get filter suggestions for auto-complete
   */
  async getFilterSuggestions(businessId: string): Promise<{
    categories: Array<{ id: string; name: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
    types: Array<{ type: string; count: number }>;
  }> {
    const cacheKey = `filter_suggestions_${businessId}`;

    return this.getCachedQuery(cacheKey, async () => {
      // Get categories with question count
      const categoryQuery = `
        SELECT 
          c.id,
          c.name,
          COUNT(q.id) as count
        FROM question_categories c
        LEFT JOIN custom_questions q ON c.id = q.category_id AND q.business_id = ?
        WHERE c.business_id = ?
        GROUP BY c.id, c.name
        ORDER BY c.name
      `;

      // Get tag suggestions
      const tagQuery = `
        SELECT 
          tag,
          COUNT(*) as count
        FROM (
          SELECT unnest(tags) as tag
          FROM custom_questions
          WHERE business_id = ?
        ) t
        GROUP BY tag
        ORDER BY count DESC, tag
        LIMIT 50
      `;

      // Get type distribution
      const typeQuery = `
        SELECT 
          type,
          COUNT(*) as count
        FROM custom_questions
        WHERE business_id = ?
        GROUP BY type
        ORDER BY count DESC
      `;

      const [categories, tags, types] = await Promise.all([
        this.db.query(categoryQuery, [businessId, businessId]),
        this.db.query(tagQuery, [businessId]),
        this.db.query(typeQuery, [businessId]),
      ]);

      return { categories, tags, types };
    });
  }

  /**
   * Build search index for better search performance
   */
  async createSearchIndexes(): Promise<void> {
    const indexes = [
      // Full-text search index
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_search 
       ON custom_questions USING gin(to_tsvector('english', title || ' ' || coalesce(description, '')))`,
      
      // Tag search index
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_tags 
       ON custom_questions USING gin(tags)`,
      
      // Composite index for common filters
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_business_active_category
       ON custom_questions(business_id, active, category_id)`,
      
      // Index for sorting by response metrics
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_metrics
       ON custom_questions(business_id, response_count DESC, avg_response_time)`,
      
      // Index for time-based filtering
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_timestamps
       ON custom_questions(business_id, created_at DESC, updated_at DESC)`,
    ];

    for (const indexQuery of indexes) {
      try {
        await this.db.query(indexQuery);
      } catch (error) {
        console.warn(`Failed to create index: ${error.message}`);
      }
    }
  }
}