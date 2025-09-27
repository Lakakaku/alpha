/**
 * Performance optimization for large feedback datasets
 * Feature: 008-step-2-6 (T041)
 * Created: 2025-09-22
 */

import { Redis } from 'ioredis';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';

// Performance optimization configuration
export const PERFORMANCE_CONFIG = {
  // Caching settings
  CACHE_TTL_SECONDS: 3600, // 1 hour
  CACHE_PREFIX: 'feedback_analysis',
  
  // Batch processing settings
  BATCH_SIZE: 100,
  MAX_CONCURRENT_BATCHES: 5,
  PROCESSING_TIMEOUT_MS: 30000,
  
  // Database optimization
  CONNECTION_POOL_SIZE: 20,
  QUERY_TIMEOUT_MS: 10000,
  
  // Memory management
  MAX_MEMORY_USAGE_MB: 512,
  GARBAGE_COLLECTION_THRESHOLD: 0.8,
  
  // Performance targets
  MAX_QUERY_TIME_MS: 200,
  MAX_AI_RESPONSE_TIME_MS: 3000,
  MAX_CATEGORIZATION_TIME_MS: 2000,
} as const;

// Performance metrics tracking
export interface PerformanceMetrics {
  query_time_ms: number;
  memory_usage_mb: number;
  cache_hit_rate: number;
  throughput_items_per_second: number;
  error_rate: number;
  ai_response_time_ms?: number;
  database_connection_count: number;
  active_batch_count: number;
}

// Optimization strategies
export type OptimizationStrategy = 
  | 'memory_efficient'
  | 'speed_optimized'
  | 'balanced'
  | 'high_throughput';

// Cache configuration
interface CacheConfig {
  ttl: number;
  key_prefix: string;
  compression: boolean;
  serializer: 'json' | 'msgpack';
}

// Database query optimization
interface QueryOptimization {
  use_indexes: string[];
  batch_size: number;
  parallel_queries: number;
  cursor_pagination: boolean;
  select_fields: string[];
}

// Validation schemas
const PerformanceOptionsSchema = z.object({
  strategy: z.enum(['memory_efficient', 'speed_optimized', 'balanced', 'high_throughput']).default('balanced'),
  max_items: z.number().min(1).max(100000).default(10000),
  enable_caching: z.boolean().default(true),
  enable_compression: z.boolean().default(true),
  parallel_processing: z.boolean().default(true),
  memory_limit_mb: z.number().min(64).max(2048).default(512),
});

type PerformanceOptions = z.infer<typeof PerformanceOptionsSchema>;

export class FeedbackAnalysisPerformanceOptimizer {
  private redis: Redis | null = null;
  private supabase: ReturnType<typeof createClient<Database>>;
  private metrics: PerformanceMetrics;
  private activeConnections: number = 0;
  private activeBatches: number = 0;
  private memoryUsage: number = 0;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'feedback-analysis-optimizer',
          },
        },
      }
    );

    // Initialize Redis if available
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }

    this.metrics = {
      query_time_ms: 0,
      memory_usage_mb: 0,
      cache_hit_rate: 0,
      throughput_items_per_second: 0,
      error_rate: 0,
      database_connection_count: 0,
      active_batch_count: 0,
    };
  }

  /**
   * Optimize feedback query for large datasets
   */
  async optimizeFeedbackQuery(
    storeId: string,
    filters: {
      date_range?: { start: string; end: string };
      departments?: string[];
      sentiment?: string[];
      limit?: number;
      offset?: number;
    },
    options: PerformanceOptions = {}
  ): Promise<{
    data: any[];
    total_count: number;
    performance_metrics: PerformanceMetrics;
    optimization_applied: string[];
  }> {
    const validatedOptions = PerformanceOptionsSchema.parse(options);
    const startTime = Date.now();
    const optimizationsApplied: string[] = [];

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey('feedback_query', {
        storeId,
        filters,
        options: validatedOptions,
      });

      // Try cache first if enabled
      if (validatedOptions.enable_caching && this.redis) {
        const cachedResult = await this.getCachedResult(cacheKey);
        if (cachedResult) {
          optimizationsApplied.push('cache_hit');
          return {
            ...cachedResult,
            optimization_applied: optimizationsApplied,
          };
        }
      }

      // Build optimized query
      const queryConfig = this.buildOptimizedQuery(storeId, filters, validatedOptions);
      optimizationsApplied.push(...queryConfig.optimizations);

      // Execute query with performance monitoring
      const { data, totalCount } = await this.executeOptimizedQuery(queryConfig);

      // Calculate performance metrics
      const queryTime = Date.now() - startTime;
      const currentMetrics = await this.calculateMetrics(queryTime, data.length);

      const result = {
        data,
        total_count: totalCount,
        performance_metrics: currentMetrics,
        optimization_applied: optimizationsApplied,
      };

      // Cache result if enabled
      if (validatedOptions.enable_caching && this.redis) {
        await this.cacheResult(cacheKey, result, validatedOptions);
        optimizationsApplied.push('cache_stored');
      }

      return result;

    } catch (error) {
      console.error('Query optimization failed:', error);
      throw new Error(`Optimized query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build optimized database query
   */
  private buildOptimizedQuery(
    storeId: string,
    filters: any,
    options: PerformanceOptions
  ): {
    query: any;
    optimizations: string[];
  } {
    const optimizations: string[] = [];
    
    // Start with base query
    let query = this.supabase
      .from('feedback')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId);

    // Apply index optimization hints
    const useIndexes = this.selectOptimalIndexes(filters);
    if (useIndexes.length > 0) {
      optimizations.push(`index_hint:${useIndexes.join(',')}`);
    }

    // Apply date range filtering (most selective first)
    if (filters.date_range) {
      query = query
        .gte('created_at', filters.date_range.start)
        .lte('created_at', filters.date_range.end);
      optimizations.push('date_range_filter');
    }

    // Apply department filtering with array operations
    if (filters.departments && filters.departments.length > 0) {
      query = query.overlaps('department_tags', filters.departments);
      optimizations.push('department_array_filter');
    }

    // Apply sentiment filtering
    if (filters.sentiment && filters.sentiment.length > 0) {
      if (filters.sentiment.length === 1) {
        query = query.eq('sentiment', filters.sentiment[0]);
      } else {
        query = query.in('sentiment', filters.sentiment);
      }
      optimizations.push('sentiment_filter');
    }

    // Apply pagination optimization
    const limit = Math.min(filters.limit || 50, PERFORMANCE_CONFIG.BATCH_SIZE);
    query = query.limit(limit);
    
    if (filters.offset) {
      if (filters.offset > 10000) {
        // Use cursor pagination for large offsets
        optimizations.push('cursor_pagination');
      } else {
        query = query.range(filters.offset, filters.offset + limit - 1);
        optimizations.push('offset_pagination');
      }
    }

    // Apply sorting optimization
    query = query.order('created_at', { ascending: false });
    optimizations.push('optimized_sorting');

    // Memory optimization: select only required fields
    if (options.strategy === 'memory_efficient') {
      query = this.supabase
        .from('feedback')
        .select('id, content, sentiment, department_tags, created_at, priority_score')
        .eq('store_id', storeId);
      optimizations.push('field_selection');
    }

    return { query, optimizations };
  }

  /**
   * Execute optimized query with performance monitoring
   */
  private async executeOptimizedQuery(queryConfig: {
    query: any;
    optimizations: string[];
  }): Promise<{ data: any[]; totalCount: number }> {
    const startTime = Date.now();
    this.activeConnections++;

    try {
      // Execute query with timeout
      const queryPromise = queryConfig.query;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), PERFORMANCE_CONFIG.QUERY_TIMEOUT_MS)
      );

      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (result.error) {
        throw new Error(`Database query failed: ${result.error.message}`);
      }

      const queryTime = Date.now() - startTime;
      
      // Log slow queries
      if (queryTime > PERFORMANCE_CONFIG.MAX_QUERY_TIME_MS) {
        console.warn(`Slow query detected: ${queryTime}ms`, {
          optimizations: queryConfig.optimizations,
          result_count: result.data?.length || 0,
        });
      }

      return {
        data: result.data || [],
        totalCount: result.count || 0,
      };

    } finally {
      this.activeConnections--;
    }
  }

  /**
   * Select optimal database indexes based on query filters
   */
  private selectOptimalIndexes(filters: any): string[] {
    const indexes: string[] = [];

    // Always use store_id index
    indexes.push('idx_feedback_store_id');

    // Date range queries benefit from created_at index
    if (filters.date_range) {
      indexes.push('idx_feedback_created_at');
    }

    // Sentiment filtering
    if (filters.sentiment) {
      indexes.push('idx_feedback_sentiment');
    }

    // Department filtering with GIN index
    if (filters.departments) {
      indexes.push('idx_feedback_department_tags_gin');
    }

    // Composite index for common combinations
    if (filters.date_range && filters.sentiment) {
      indexes.push('idx_feedback_store_created_sentiment');
    }

    return indexes;
  }

  /**
   * Implement intelligent caching strategy
   */
  private async getCachedResult(cacheKey: string): Promise<any | null> {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.metrics.cache_hit_rate++;
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.warn('Cache retrieval failed:', error);
      return null;
    }
  }

  private async cacheResult(
    cacheKey: string,
    result: any,
    options: PerformanceOptions
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const serialized = JSON.stringify(result);
      
      // Compress large results if enabled
      let finalData = serialized;
      if (options.enable_compression && serialized.length > 1024) {
        finalData = await this.compressData(serialized);
      }

      await this.redis.setex(
        cacheKey,
        PERFORMANCE_CONFIG.CACHE_TTL_SECONDS,
        finalData
      );
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }
  }

  /**
   * Process large datasets in optimized batches
   */
  async processFeedbackBatch(
    items: any[],
    processor: (batch: any[]) => Promise<any[]>,
    options: PerformanceOptions = {}
  ): Promise<{
    results: any[];
    performance_metrics: PerformanceMetrics;
    processing_summary: {
      total_items: number;
      successful_items: number;
      failed_items: number;
      batch_count: number;
      processing_time_ms: number;
    };
  }> {
    const validatedOptions = PerformanceOptionsSchema.parse(options);
    const startTime = Date.now();
    const totalItems = items.length;
    let successfulItems = 0;
    let failedItems = 0;

    try {
      // Determine optimal batch size based on strategy
      const batchSize = this.calculateOptimalBatchSize(totalItems, validatedOptions);
      const batches = this.createBatches(items, batchSize);
      
      // Process batches with controlled concurrency
      const maxConcurrent = validatedOptions.parallel_processing 
        ? PERFORMANCE_CONFIG.MAX_CONCURRENT_BATCHES 
        : 1;

      const results: any[] = [];
      
      for (let i = 0; i < batches.length; i += maxConcurrent) {
        const concurrentBatches = batches.slice(i, i + maxConcurrent);
        this.activeBatches += concurrentBatches.length;

        try {
          const batchPromises = concurrentBatches.map(async (batch, index) => {
            try {
              // Memory check before processing
              await this.checkMemoryUsage(validatedOptions);
              
              const batchResult = await Promise.race([
                processor(batch),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Batch timeout')), PERFORMANCE_CONFIG.PROCESSING_TIMEOUT_MS)
                ),
              ]);

              successfulItems += batch.length;
              return batchResult;
            } catch (error) {
              failedItems += batch.length;
              console.error(`Batch ${i + index} failed:`, error);
              return [];
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              results.push(...result.value);
            }
          });

        } finally {
          this.activeBatches -= concurrentBatches.length;
        }

        // Memory cleanup between batch groups
        if (i % 10 === 0) {
          await this.performGarbageCollection();
        }
      }

      const processingTime = Date.now() - startTime;
      const metrics = await this.calculateMetrics(processingTime, results.length);

      return {
        results,
        performance_metrics: metrics,
        processing_summary: {
          total_items: totalItems,
          successful_items: successfulItems,
          failed_items: failedItems,
          batch_count: batches.length,
          processing_time_ms: processingTime,
        },
      };

    } catch (error) {
      console.error('Batch processing failed:', error);
      throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate optimal batch size based on dataset and strategy
   */
  private calculateOptimalBatchSize(totalItems: number, options: PerformanceOptions): number {
    switch (options.strategy) {
      case 'memory_efficient':
        return Math.min(25, Math.ceil(totalItems / 100));
      
      case 'speed_optimized':
        return Math.min(200, Math.ceil(totalItems / 10));
      
      case 'high_throughput':
        return Math.min(500, Math.ceil(totalItems / 5));
      
      case 'balanced':
      default:
        return Math.min(100, Math.ceil(totalItems / 20));
    }
  }

  /**
   * Create optimized batches from dataset
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Monitor and manage memory usage
   */
  private async checkMemoryUsage(options: PerformanceOptions): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const currentUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    
    this.memoryUsage = currentUsageMB;
    
    if (currentUsageMB > options.memory_limit_mb * PERFORMANCE_CONFIG.GARBAGE_COLLECTION_THRESHOLD) {
      await this.performGarbageCollection();
      
      // Check again after GC
      const newUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      if (newUsage > options.memory_limit_mb) {
        throw new Error(`Memory limit exceeded: ${newUsage.toFixed(2)}MB > ${options.memory_limit_mb}MB`);
      }
    }
  }

  /**
   * Perform garbage collection and cleanup
   */
  private async performGarbageCollection(): Promise<void> {
    if (global.gc) {
      global.gc();
    }
    
    // Small delay to allow GC to complete
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Calculate current performance metrics
   */
  private async calculateMetrics(queryTime: number, itemCount: number): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    
    return {
      query_time_ms: queryTime,
      memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
      cache_hit_rate: this.metrics.cache_hit_rate,
      throughput_items_per_second: itemCount > 0 ? (itemCount / queryTime) * 1000 : 0,
      error_rate: 0, // To be calculated based on error tracking
      database_connection_count: this.activeConnections,
      active_batch_count: this.activeBatches,
    };
  }

  /**
   * Generate cache key for consistent caching
   */
  private generateCacheKey(operation: string, params: any): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    
    return `${PERFORMANCE_CONFIG.CACHE_PREFIX}:${operation}:${hash}`;
  }

  /**
   * Compress data for caching
   */
  private async compressData(data: string): Promise<string> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed.toString('base64'));
      });
    });
  }

  /**
   * Decompress cached data
   */
  private async decompressData(compressedData: string): Promise<string> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(compressedData, 'base64');
      zlib.gunzip(buffer, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed.toString());
      });
    });
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return await this.calculateMetrics(0, 0);
  }

  /**
   * Optimize database connection pool
   */
  async optimizeConnectionPool(): Promise<{
    current_connections: number;
    optimal_size: number;
    recommendations: string[];
  }> {
    const currentConnections = this.activeConnections;
    const recommendations: string[] = [];
    
    // Analyze connection patterns
    if (currentConnections > PERFORMANCE_CONFIG.CONNECTION_POOL_SIZE * 0.8) {
      recommendations.push('Consider increasing connection pool size');
    }
    
    if (currentConnections < PERFORMANCE_CONFIG.CONNECTION_POOL_SIZE * 0.2) {
      recommendations.push('Connection pool may be oversized');
    }

    return {
      current_connections: currentConnections,
      optimal_size: PERFORMANCE_CONFIG.CONNECTION_POOL_SIZE,
      recommendations,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }
}

// Singleton instance
export const performanceOptimizer = new FeedbackAnalysisPerformanceOptimizer();

// Utility functions for performance monitoring

/**
 * Performance monitoring decorator for functions
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operation: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await fn(...args);
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      console.log(`Performance [${operation}]:`, {
        duration_ms: endTime - startTime,
        memory_delta_mb: (endMemory - startMemory) / 1024 / 1024,
        result_size: JSON.stringify(result).length,
      });

      return result;
    } catch (error) {
      const endTime = Date.now();
      console.error(`Performance [${operation}] ERROR:`, {
        duration_ms: endTime - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }) as T;
}

/**
 * Memory-aware array processing
 */
export async function processLargeArray<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    maxConcurrency?: number;
    memoryLimitMB?: number;
  } = {}
): Promise<R[]> {
  const {
    batchSize = 100,
    maxConcurrency = 5,
    memoryLimitMB = 512,
  } = options;

  const results: R[] = [];
  const batches = [];
  
  // Create batches
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // Process batches with concurrency control
  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const concurrentBatches = batches.slice(i, i + maxConcurrency);
    
    // Check memory before processing
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsage > memoryLimitMB * 0.8) {
      if (global.gc) global.gc();
    }

    const batchPromises = concurrentBatches.map(async (batch) => {
      const batchResults: R[] = [];
      for (const item of batch) {
        try {
          const result = await processor(item);
          batchResults.push(result);
        } catch (error) {
          console.error('Item processing failed:', error);
        }
      }
      return batchResults;
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(batchResult => results.push(...batchResult));
  }

  return results;
}

export { PerformanceOptions, PerformanceMetrics, OptimizationStrategy };