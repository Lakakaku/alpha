import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, stat, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { TestResult, TestSuite, TestRun } from '@vocilia/types';

interface CacheEntry {
  key: string;
  testSuiteId: string;
  codeHash: string;
  dependencyHash: string;
  result: TestResult;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
}

interface CacheConfig {
  enabled: boolean;
  maxSize: number; // Max cache size in MB
  maxAge: number; // Max age in milliseconds
  maxEntries: number;
  compressionEnabled: boolean;
  persistToDisk: boolean;
  cacheDirectory: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  hitRate: number;
}

export class TestResultCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0,
    hitRate: 0,
  };

  private config: CacheConfig = {
    enabled: process.env.NODE_ENV !== 'ci',
    maxSize: 500, // 500MB
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    maxEntries: 10000,
    compressionEnabled: true,
    persistToDisk: true,
    cacheDirectory: join(process.cwd(), '.cache', 'test-results'),
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Initialize cache directory
    if (this.config.persistToDisk) {
      this.initializeCacheDirectory();
    }

    // Load existing cache from disk
    this.loadCacheFromDisk();

    // Set up periodic cleanup
    setInterval(() => this.performMaintenance(), 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Get cached test result if available and valid
   */
  async get(
    testSuite: TestSuite,
    codeHash: string,
    dependencyHash: string
  ): Promise<TestResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.generateCacheKey(testSuite, codeHash, dependencyHash);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry is still valid
    if (this.isEntryExpired(entry) || !this.isEntryValid(entry, codeHash, dependencyHash)) {
      this.cache.delete(cacheKey);
      this.stats.evictions++;
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access information
    entry.lastAccessed = new Date();
    entry.accessCount++;
    this.stats.hits++;
    this.updateHitRate();

    console.log(`🎯 Cache HIT for test suite: ${testSuite.name}`);
    return entry.result;
  }

  /**
   * Store test result in cache
   */
  async set(
    testSuite: TestSuite,
    codeHash: string,
    dependencyHash: string,
    result: TestResult
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(testSuite, codeHash, dependencyHash);
    const entrySize = this.calculateEntrySize(result);

    // Check if we need to evict entries to make space
    await this.ensureSpace(entrySize);

    const entry: CacheEntry = {
      key: cacheKey,
      testSuiteId: testSuite.id,
      codeHash,
      dependencyHash,
      result,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      size: entrySize,
    };

    this.cache.set(cacheKey, entry);
    this.stats.totalSize += entrySize;
    this.stats.entryCount++;

    // Persist to disk if enabled
    if (this.config.persistToDisk) {
      await this.persistEntryToDisk(entry);
    }

    console.log(`💾 Cached test result for suite: ${testSuite.name} (${this.formatBytes(entrySize)})`);
  }

  /**
   * Invalidate cache entries for a specific test suite
   */
  async invalidate(testSuiteId: string): Promise<number> {
    let invalidatedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.testSuiteId === testSuiteId) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        invalidatedCount++;

        // Remove from disk
        if (this.config.persistToDisk) {
          await this.removeEntryFromDisk(entry.key);
        }
      }
    }

    console.log(`🗑️  Invalidated ${invalidatedCount} cache entries for suite: ${testSuiteId}`);
    return invalidatedCount;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const entryCount = this.cache.size;
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      hitRate: 0,
    };

    // Clear disk cache
    if (this.config.persistToDisk) {
      await this.clearDiskCache();
    }

    console.log(`🧹 Cleared ${entryCount} cache entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { config: CacheConfig } {
    return {
      ...this.stats,
      config: { ...this.config },
    };
  }

  /**
   * Generate cache key for test result
   */
  private generateCacheKey(
    testSuite: TestSuite,
    codeHash: string,
    dependencyHash: string
  ): string {
    const keyData = {
      suiteId: testSuite.id,
      suiteName: testSuite.name,
      category: testSuite.category,
      codeHash,
      dependencyHash,
      environment: process.env.NODE_ENV,
    };

    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Check if cache entry is expired
   */
  private isEntryExpired(entry: CacheEntry): boolean {
    const now = new Date();
    const ageMs = now.getTime() - entry.createdAt.getTime();
    return ageMs > this.config.maxAge;
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(
    entry: CacheEntry,
    currentCodeHash: string,
    currentDependencyHash: string
  ): boolean {
    return (
      entry.codeHash === currentCodeHash &&
      entry.dependencyHash === currentDependencyHash
    );
  }

  /**
   * Calculate memory size of cache entry
   */
  private calculateEntrySize(result: TestResult): number {
    // Estimate size based on JSON serialization
    const jsonString = JSON.stringify(result);
    return Buffer.byteLength(jsonString, 'utf8');
  }

  /**
   * Ensure there's enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024; // Convert MB to bytes

    // Check if we exceed max entries
    if (this.cache.size >= this.config.maxEntries) {
      await this.evictLeastRecentlyUsed(1);
    }

    // Check if we exceed max size
    while (this.stats.totalSize + requiredSize > maxSizeBytes && this.cache.size > 0) {
      await this.evictLeastRecentlyUsed(1);
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLeastRecentlyUsed(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [key, entry] = entries[i];
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
      this.stats.evictions++;

      // Remove from disk
      if (this.config.persistToDisk) {
        await this.removeEntryFromDisk(entry.key);
      }
    }
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const totalAccesses = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;
  }

  /**
   * Initialize cache directory
   */
  private async initializeCacheDirectory(): Promise<void> {
    try {
      if (!existsSync(this.config.cacheDirectory)) {
        await mkdir(this.config.cacheDirectory, { recursive: true });
      }
    } catch (error) {
      console.warn(`Failed to initialize cache directory: ${error.message}`);
      this.config.persistToDisk = false;
    }
  }

  /**
   * Load cache from disk on startup
   */
  private async loadCacheFromDisk(): Promise<void> {
    if (!this.config.persistToDisk || !existsSync(this.config.cacheDirectory)) {
      return;
    }

    try {
      const files = await readdir(this.config.cacheDirectory);
      let loadedCount = 0;

      for (const file of files) {
        if (file.endsWith('.cache.json')) {
          try {
            const filePath = join(this.config.cacheDirectory, file);
            const content = await readFile(filePath, 'utf8');
            const entry: CacheEntry = JSON.parse(content);

            // Check if entry is still valid
            if (!this.isEntryExpired(entry)) {
              this.cache.set(entry.key, entry);
              this.stats.totalSize += entry.size;
              this.stats.entryCount++;
              loadedCount++;
            } else {
              // Remove expired entry from disk
              await unlink(filePath);
            }
          } catch (error) {
            console.warn(`Failed to load cache entry ${file}: ${error.message}`);
          }
        }
      }

      if (loadedCount > 0) {
        console.log(`📂 Loaded ${loadedCount} cache entries from disk`);
      }
    } catch (error) {
      console.warn(`Failed to load cache from disk: ${error.message}`);
    }
  }

  /**
   * Persist cache entry to disk
   */
  private async persistEntryToDisk(entry: CacheEntry): Promise<void> {
    if (!this.config.persistToDisk) {
      return;
    }

    try {
      const fileName = `${entry.key}.cache.json`;
      const filePath = join(this.config.cacheDirectory, fileName);
      const content = JSON.stringify(entry, null, 2);
      
      await writeFile(filePath, content, 'utf8');
    } catch (error) {
      console.warn(`Failed to persist cache entry to disk: ${error.message}`);
    }
  }

  /**
   * Remove cache entry from disk
   */
  private async removeEntryFromDisk(key: string): Promise<void> {
    if (!this.config.persistToDisk) {
      return;
    }

    try {
      const fileName = `${key}.cache.json`;
      const filePath = join(this.config.cacheDirectory, fileName);
      
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      console.warn(`Failed to remove cache entry from disk: ${error.message}`);
    }
  }

  /**
   * Clear all cache files from disk
   */
  private async clearDiskCache(): Promise<void> {
    if (!this.config.persistToDisk || !existsSync(this.config.cacheDirectory)) {
      return;
    }

    try {
      const files = await readdir(this.config.cacheDirectory);
      
      for (const file of files) {
        if (file.endsWith('.cache.json')) {
          const filePath = join(this.config.cacheDirectory, file);
          await unlink(filePath);
        }
      }
    } catch (error) {
      console.warn(`Failed to clear disk cache: ${error.message}`);
    }
  }

  /**
   * Perform periodic maintenance
   */
  private async performMaintenance(): Promise<void> {
    // Remove expired entries
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isEntryExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        this.stats.evictions++;

        if (this.config.persistToDisk) {
          await this.removeEntryFromDisk(entry.key);
        }
      }
    }

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Utility functions for different caching strategies

/**
 * Create code hash from file system
 */
export async function generateCodeHash(filePaths: string[]): Promise<string> {
  const hash = createHash('sha256');
  
  for (const filePath of filePaths) {
    try {
      if (existsSync(filePath)) {
        const stats = await stat(filePath);
        const content = await readFile(filePath, 'utf8');
        hash.update(`${filePath}:${stats.mtime.getTime()}:${content}`);
      }
    } catch (error) {
      // If file can't be read, include its path and error in hash
      hash.update(`${filePath}:error:${error.message}`);
    }
  }
  
  return hash.digest('hex');
}

/**
 * Generate dependency hash from package.json and lock files
 */
export async function generateDependencyHash(): Promise<string> {
  const hash = createHash('sha256');
  const dependencyFiles = [
    'package.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
  ];

  for (const file of dependencyFiles) {
    try {
      if (existsSync(file)) {
        const content = await readFile(file, 'utf8');
        hash.update(`${file}:${content}`);
      }
    } catch (error) {
      // Include error in hash if file can't be read
      hash.update(`${file}:error:${error.message}`);
    }
  }

  return hash.digest('hex');
}

/**
 * Smart cache invalidation based on file changes
 */
export async function invalidateCacheForChangedFiles(
  cache: TestResultCache,
  changedFiles: string[]
): Promise<number> {
  let invalidatedCount = 0;

  // Map changed files to potentially affected test suites
  const affectedPatterns = [
    { pattern: /^apps\/backend\//, suites: ['backend-unit', 'backend-integration', 'api-contract'] },
    { pattern: /^apps\/customer\//, suites: ['customer-unit', 'customer-e2e'] },
    { pattern: /^apps\/business\//, suites: ['business-unit', 'business-e2e'] },
    { pattern: /^apps\/admin\//, suites: ['admin-unit', 'admin-e2e'] },
    { pattern: /^packages\//, suites: ['all'] }, // Package changes affect everything
    { pattern: /^supabase\//, suites: ['database', 'integration', 'e2e'] },
  ];

  const suitesToInvalidate = new Set<string>();

  for (const file of changedFiles) {
    for (const { pattern, suites } of affectedPatterns) {
      if (pattern.test(file)) {
        if (suites.includes('all')) {
          // Invalidate all cache
          await cache.clear();
          return -1; // Special value indicating full invalidation
        }
        
        suites.forEach(suite => suitesToInvalidate.add(suite));
      }
    }
  }

  // Invalidate affected test suites
  for (const suiteId of suitesToInvalidate) {
    invalidatedCount += await cache.invalidate(suiteId);
  }

  return invalidatedCount;
}

// Global cache instance
export const testResultCache = new TestResultCache();

// Enhanced caching for different test types
export const unitTestCache = new TestResultCache({
  maxAge: 60 * 60 * 1000, // 1 hour for unit tests
  maxSize: 100, // 100MB
});

export const integrationTestCache = new TestResultCache({
  maxAge: 30 * 60 * 1000, // 30 minutes for integration tests
  maxSize: 200, // 200MB
});

export const e2eTestCache = new TestResultCache({
  maxAge: 15 * 60 * 1000, // 15 minutes for E2E tests
  maxSize: 300, // 300MB
});