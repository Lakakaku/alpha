/**
 * AI Response Caching Strategy for Feedback Analysis Dashboard
 * Feature: 008-step-2-6
 * Task: T043
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import Redis from 'ioredis';

// Redis client instance
let redis: Redis | null = null;

// Initialize Redis connection
function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      keepAlive: 30000,
      connectionName: 'ai-cache',
    });

    redis.on('error', (error) => {
      console.error('[AI Cache] Redis connection error:', error);
    });

    redis.on('connect', () => {
      console.info('[AI Cache] Redis connected successfully');
    });

    redis.on('ready', () => {
      console.info('[AI Cache] Redis ready for operations');
    });
  }

  return redis;
}

// Cache configuration
export const CACHE_CONFIG = {
  // Cache TTL by operation type (in seconds)
  TTL: {
    SENTIMENT_ANALYSIS: 7 * 24 * 60 * 60, // 7 days (feedback content rarely changes)
    SEARCH_QUERY: 6 * 60 * 60, // 6 hours (search patterns may evolve)
    WEEKLY_REPORT: 24 * 60 * 60, // 24 hours (reports are weekly)
    TEMPORAL_COMPARISON: 12 * 60 * 60, // 12 hours (comparison data changes)
  },
  
  // Key prefixes for different cache types
  PREFIXES: {
    SENTIMENT: 'ai:sentiment:',
    SEARCH: 'ai:search:',
    REPORT: 'ai:report:',
    TEMPORAL: 'ai:temporal:',
    METADATA: 'ai:meta:',
  },
  
  // Performance settings
  MAX_KEY_LENGTH: 250,
  COMPRESSION_THRESHOLD: 1024, // Compress responses larger than 1KB
  BATCH_SIZE: 100,
  
  // Fallback settings
  FALLBACK_ENABLED: true,
  FALLBACK_TTL: 5 * 60, // 5 minutes for fallback cache
} as const;

// Cache key generation
export function generateCacheKey(
  operation: keyof typeof CACHE_CONFIG.TTL,
  input: string | object,
  storeId?: string,
  userId?: string
): string {
  const prefix = CACHE_CONFIG.PREFIXES[operation as keyof typeof CACHE_CONFIG.PREFIXES] || 'ai:misc:';
  
  // Create deterministic hash of input
  const inputString = typeof input === 'string' ? input : JSON.stringify(input);
  const contentHash = createHash('sha256')
    .update(inputString)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for brevity
  
  // Include context identifiers
  const contextParts = [contentHash];
  if (storeId) contextParts.push(`store:${storeId}`);
  if (userId) contextParts.push(`user:${userId}`);
  
  const key = `${prefix}${contextParts.join(':')}`;
  
  // Ensure key length doesn't exceed Redis limits
  if (key.length > CACHE_CONFIG.MAX_KEY_LENGTH) {
    const keyHash = createHash('sha256').update(key).digest('hex').substring(0, 32);
    return `${prefix}hash:${keyHash}`;
  }
  
  return key;
}

// Compression utilities
function compressData(data: string): string {
  if (data.length < CACHE_CONFIG.COMPRESSION_THRESHOLD) {
    return JSON.stringify({ compressed: false, data });
  }
  
  // Simple compression using JSON.stringify with reduced whitespace
  const compressed = JSON.stringify(JSON.parse(data));
  return JSON.stringify({ compressed: true, data: compressed });
}

function decompressData(compressed: string): string {
  try {
    const parsed = JSON.parse(compressed);
    return parsed.compressed ? parsed.data : parsed.data;
  } catch (error) {
    console.warn('[AI Cache] Failed to decompress data, returning as-is:', error);
    return compressed;
  }
}

// Cache response interface
interface CacheResponse<T = any> {
  data: T;
  cached: boolean;
  timestamp: number;
  ttl: number;
  source: 'redis' | 'memory' | 'fresh';
}

// In-memory fallback cache
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private maxSize = 1000;

  set(key: string, value: any, ttlSeconds: number): void {
    // Clean up expired entries if cache is getting large
    if (this.cache.size > this.maxSize) {
      this.cleanup();
    }

    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data: value, expires });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const memoryCache = new MemoryCache();

// AI Response Cache Service
export class AIResponseCache {
  private static instance: AIResponseCache;
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  static getInstance(): AIResponseCache {
    if (!AIResponseCache.instance) {
      AIResponseCache.instance = new AIResponseCache();
    }
    return AIResponseCache.instance;
  }

  /**
   * Get cached AI response
   */
  async get<T = any>(
    operation: keyof typeof CACHE_CONFIG.TTL,
    input: string | object,
    storeId?: string,
    userId?: string
  ): Promise<CacheResponse<T> | null> {
    const key = generateCacheKey(operation, input, storeId, userId);

    try {
      // Try Redis first
      const cached = await this.redis.get(key);
      if (cached) {
        const decompressed = decompressData(cached);
        const data = JSON.parse(decompressed);
        
        return {
          data,
          cached: true,
          timestamp: Date.now(),
          ttl: await this.redis.ttl(key),
          source: 'redis',
        };
      }
    } catch (error) {
      console.warn('[AI Cache] Redis get failed, trying memory cache:', error);
    }

    // Fallback to memory cache
    if (CACHE_CONFIG.FALLBACK_ENABLED) {
      const memData = memoryCache.get(key);
      if (memData) {
        return {
          data: memData,
          cached: true,
          timestamp: Date.now(),
          ttl: CACHE_CONFIG.FALLBACK_TTL,
          source: 'memory',
        };
      }
    }

    return null;
  }

  /**
   * Set cached AI response
   */
  async set<T = any>(
    operation: keyof typeof CACHE_CONFIG.TTL,
    input: string | object,
    response: T,
    storeId?: string,
    userId?: string,
    customTtl?: number
  ): Promise<void> {
    const key = generateCacheKey(operation, input, storeId, userId);
    const ttl = customTtl || CACHE_CONFIG.TTL[operation];
    const data = JSON.stringify(response);
    const compressed = compressData(data);

    try {
      // Set in Redis
      await this.redis.setex(key, ttl, compressed);
      
      // Also set metadata for analytics
      const metaKey = `${CACHE_CONFIG.PREFIXES.METADATA}${key}`;
      await this.redis.setex(metaKey, ttl, JSON.stringify({
        operation,
        storeId,
        userId,
        timestamp: Date.now(),
        size: compressed.length,
      }));

    } catch (error) {
      console.warn('[AI Cache] Redis set failed, using memory cache:', error);
      
      // Fallback to memory cache
      if (CACHE_CONFIG.FALLBACK_ENABLED) {
        memoryCache.set(key, response, Math.min(ttl, CACHE_CONFIG.FALLBACK_TTL));
      }
    }
  }

  /**
   * Delete cached response
   */
  async delete(
    operation: keyof typeof CACHE_CONFIG.TTL,
    input: string | object,
    storeId?: string,
    userId?: string
  ): Promise<void> {
    const key = generateCacheKey(operation, input, storeId, userId);
    const metaKey = `${CACHE_CONFIG.PREFIXES.METADATA}${key}`;

    try {
      await Promise.all([
        this.redis.del(key),
        this.redis.del(metaKey),
      ]);
    } catch (error) {
      console.warn('[AI Cache] Redis delete failed:', error);
    }

    // Also delete from memory cache
    memoryCache.delete(key);
  }

  /**
   * Clear all cached responses for a store
   */
  async clearStore(storeId: string): Promise<number> {
    try {
      const patterns = Object.values(CACHE_CONFIG.PREFIXES).map(prefix => `${prefix}*store:${storeId}*`);
      let deletedCount = 0;

      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('[AI Cache] Failed to clear store cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redis: { connected: boolean; memory: number; keys: number };
    memory: { size: number; maxSize: number };
    performance: { hitRate: number; totalRequests: number };
  }> {
    try {
      const redisInfo = await this.redis.info('memory');
      const redisKeys = await this.redis.dbsize();
      const redisConnected = this.redis.status === 'ready';

      // Parse memory usage from Redis info
      const memoryMatch = redisInfo.match(/used_memory:(\d+)/);
      const redisMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      return {
        redis: {
          connected: redisConnected,
          memory: redisMemory,
          keys: redisKeys,
        },
        memory: {
          size: memoryCache.size(),
          maxSize: 1000,
        },
        performance: {
          hitRate: 0, // TODO: Implement hit rate tracking
          totalRequests: 0,
        },
      };
    } catch (error) {
      console.error('[AI Cache] Failed to get stats:', error);
      return {
        redis: { connected: false, memory: 0, keys: 0 },
        memory: { size: memoryCache.size(), maxSize: 1000 },
        performance: { hitRate: 0, totalRequests: 0 },
      };
    }
  }

  /**
   * Warm up cache with common queries
   */
  async warmUp(storeId: string, commonQueries: string[]): Promise<void> {
    console.info(`[AI Cache] Warming up cache for store ${storeId} with ${commonQueries.length} queries`);
    
    // This would be called with actual AI responses
    // Implementation depends on AI service integration
    for (const query of commonQueries) {
      const key = generateCacheKey('SEARCH_QUERY', query, storeId);
      // Pre-populate with placeholder that expires quickly
      await this.redis.setex(key, 60, JSON.stringify({ warmup: true }));
    }
  }
}

// Export singleton instance
export const aiCache = AIResponseCache.getInstance();

// Middleware for automatic caching
export function cacheAIResponse(
  operation: keyof typeof CACHE_CONFIG.TTL,
  getInput: (req: Request) => string | object,
  getStoreId?: (req: Request) => string,
  getUserId?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const input = getInput(req);
    const storeId = getStoreId?.(req);
    const userId = getUserId?.(req);

    // Check cache first
    try {
      const cached = await aiCache.get(operation, input, storeId, userId);
      if (cached) {
        // Add cache headers
        res.set({
          'X-Cache-Status': 'HIT',
          'X-Cache-Source': cached.source,
          'X-Cache-TTL': cached.ttl.toString(),
        });

        return res.json(cached.data);
      }
    } catch (error) {
      console.warn('[AI Cache Middleware] Cache check failed:', error);
    }

    // Store original res.json method
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function(body: any) {
      // Cache the response asynchronously
      aiCache.set(operation, input, body, storeId, userId).catch(error => {
        console.warn('[AI Cache Middleware] Failed to cache response:', error);
      });

      // Add cache headers
      res.set({
        'X-Cache-Status': 'MISS',
        'X-Cache-Source': 'fresh',
      });

      // Call original res.json
      return originalJson(body);
    };

    next();
  };
}

// Utility function for cache warming
export async function warmUpCommonQueries(storeId: string): Promise<void> {
  const commonQueries = [
    'kött problem',
    'kassa väntetid',
    'kundservice hjälp',
    'bageri kvalitet',
    'parkering svårigheter',
    'personalens service',
    'renlighet butik',
    'öppettider information',
  ];

  await aiCache.warmUp(storeId, commonQueries);
}

// Cache invalidation utilities
export async function invalidateStoreCache(storeId: string): Promise<void> {
  await aiCache.clearStore(storeId);
  console.info(`[AI Cache] Invalidated cache for store ${storeId}`);
}

export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const patterns = Object.values(CACHE_CONFIG.PREFIXES).map(prefix => `${prefix}*user:${userId}*`);
    const redis = getRedisClient();
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    
    console.info(`[AI Cache] Invalidated cache for user ${userId}`);
  } catch (error) {
    console.error('[AI Cache] Failed to invalidate user cache:', error);
  }
}

// Health check for cache system
export async function cacheHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  redis: boolean;
  memory: boolean;
  latency: number;
}> {
  const startTime = Date.now();
  let redisHealthy = false;
  let memoryHealthy = true;

  try {
    const redis = getRedisClient();
    await redis.ping();
    redisHealthy = true;
  } catch (error) {
    console.warn('[AI Cache] Redis health check failed:', error);
  }

  const latency = Date.now() - startTime;
  const status = redisHealthy ? 'healthy' : (memoryHealthy ? 'degraded' : 'unhealthy');

  return {
    status,
    redis: redisHealthy,
    memory: memoryHealthy,
    latency,
  };
}

// Graceful shutdown
export async function shutdownCache(): Promise<void> {
  console.info('[AI Cache] Shutting down cache connections...');
  
  if (redis) {
    await redis.quit();
    redis = null;
  }
  
  memoryCache.clear();
  console.info('[AI Cache] Cache shutdown complete');
}

// Export all utilities
export default {
  cache: aiCache,
  middleware: cacheAIResponse,
  warmUp: warmUpCommonQueries,
  invalidateStore: invalidateStoreCache,
  invalidateUser: invalidateUserCache,
  healthCheck: cacheHealthCheck,
  shutdown: shutdownCache,
};