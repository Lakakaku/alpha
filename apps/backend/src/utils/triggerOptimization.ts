import { TriggerCondition, TriggerContext } from '@vocilia/types';
import { performance } from 'perf_hooks';

export interface TriggerEvaluationResult {
  result: boolean;
  evaluationTime: number;
  cacheHit: boolean;
  conditionsEvaluated: number;
  shortCircuited: boolean;
}

export interface OptimizedTriggerCondition extends TriggerCondition {
  priority?: number;
  estimatedCost?: number;
  cacheKey?: string;
}

export interface TriggerEvaluationOptions {
  enableCache?: boolean;
  enableShortCircuit?: boolean;
  maxEvaluationTime?: number;
  cacheTimeout?: number;
}

export class TriggerOptimizationService {
  private evaluationCache = new Map<string, { result: boolean; timestamp: number; cost: number }>();
  private contextCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private maxCacheSize = 10000;

  constructor() {
    // Precompute common evaluation patterns
    this.initializeOptimizations();
  }

  /**
   * Evaluate trigger conditions with performance optimization
   */
  async evaluateConditionsOptimized(
    conditions: TriggerCondition[],
    context: TriggerContext,
    logic: 'AND' | 'OR' = 'AND',
    options: TriggerEvaluationOptions = {}
  ): Promise<TriggerEvaluationResult> {
    const startTime = performance.now();
    const opts = {
      enableCache: true,
      enableShortCircuit: true,
      maxEvaluationTime: 50, // 50ms target
      cacheTimeout: this.cacheTimeout,
      ...options,
    };

    let conditionsEvaluated = 0;
    let cacheHit = false;
    let shortCircuited = false;

    // Check for cached result
    if (opts.enableCache) {
      const cacheKey = this.generateEvaluationCacheKey(conditions, context, logic);
      const cached = this.getCachedEvaluation(cacheKey);
      if (cached !== null) {
        return {
          result: cached,
          evaluationTime: performance.now() - startTime,
          cacheHit: true,
          conditionsEvaluated: 0,
          shortCircuited: false,
        };
      }
    }

    // Optimize condition order for faster evaluation
    const optimizedConditions = this.optimizeConditionOrder(conditions, context, logic);

    let result = logic === 'AND';

    // Evaluate conditions with short-circuiting
    for (const condition of optimizedConditions) {
      // Check evaluation time limit
      if (performance.now() - startTime > opts.maxEvaluationTime) {
        console.warn(`Trigger evaluation exceeded time limit: ${opts.maxEvaluationTime}ms`);
        break;
      }

      const conditionResult = await this.evaluateConditionOptimized(condition, context, opts);
      conditionsEvaluated++;

      if (logic === 'AND') {
        result = result && conditionResult;
        if (!result && opts.enableShortCircuit) {
          shortCircuited = true;
          break; // Short-circuit on first false for AND
        }
      } else {
        result = result || conditionResult;
        if (result && opts.enableShortCircuit) {
          shortCircuited = true;
          break; // Short-circuit on first true for OR
        }
      }
    }

    // Cache the result
    if (opts.enableCache) {
      const cacheKey = this.generateEvaluationCacheKey(conditions, context, logic);
      this.cacheEvaluation(cacheKey, result, performance.now() - startTime);
    }

    return {
      result,
      evaluationTime: performance.now() - startTime,
      cacheHit,
      conditionsEvaluated,
      shortCircuited,
    };
  }

  /**
   * Evaluate single condition with optimizations
   */
  private async evaluateConditionOptimized(
    condition: TriggerCondition,
    context: TriggerContext,
    options: TriggerEvaluationOptions
  ): Promise<boolean> {
    // Check condition-level cache
    if (options.enableCache) {
      const cacheKey = this.generateConditionCacheKey(condition, context);
      const cached = this.getCachedCondition(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Fast path for simple conditions
    const result = this.evaluateConditionFast(condition, context);

    // Cache the result
    if (options.enableCache) {
      const cacheKey = this.generateConditionCacheKey(condition, context);
      this.cacheCondition(cacheKey, result);
    }

    return result;
  }

  /**
   * Fast condition evaluation without complex processing
   */
  private evaluateConditionFast(condition: TriggerCondition, context: TriggerContext): boolean {
    const value = this.getContextValue(condition.field, context);
    
    if (value === undefined || value === null) {
      return false;
    }

    return this.compareValues(value, condition.operator, condition.value);
  }

  /**
   * Optimized value comparison
   */
  private compareValues(contextValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'eq':
        return contextValue === conditionValue;
      
      case 'neq':
        return contextValue !== conditionValue;
      
      case 'gt':
        return Number(contextValue) > Number(conditionValue);
      
      case 'gte':
        return Number(contextValue) >= Number(conditionValue);
      
      case 'lt':
        return Number(contextValue) < Number(conditionValue);
      
      case 'lte':
        return Number(contextValue) <= Number(conditionValue);
      
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(contextValue);
      
      case 'nin':
        return Array.isArray(conditionValue) && !conditionValue.includes(contextValue);
      
      case 'contains':
        return String(contextValue).includes(String(conditionValue));
      
      case 'starts_with':
        return String(contextValue).startsWith(String(conditionValue));
      
      case 'ends_with':
        return String(contextValue).endsWith(String(conditionValue));
      
      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          const numValue = Number(contextValue);
          return numValue >= Number(conditionValue[0]) && numValue <= Number(conditionValue[1]);
        }
        return false;
      
      case 'time_between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          return this.isTimeBetween(String(contextValue), conditionValue[0], conditionValue[1]);
        }
        return false;
      
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Optimized time comparison
   */
  private isTimeBetween(timeStr: string, startTime: string, endTime: string): boolean {
    const time = this.parseTimeToMinutes(timeStr);
    const start = this.parseTimeToMinutes(startTime);
    const end = this.parseTimeToMinutes(endTime);
    
    if (time === -1 || start === -1 || end === -1) {
      return false;
    }
    
    if (start <= end) {
      return time >= start && time <= end;
    } else {
      // Handle overnight ranges (e.g., 22:00 to 06:00)
      return time >= start || time <= end;
    }
  }

  /**
   * Parse time string to minutes for fast comparison
   */
  private parseTimeToMinutes(timeStr: string): number {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return -1;
    }
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return -1;
    }
    
    return hours * 60 + minutes;
  }

  /**
   * Get context value with optimized field access
   */
  private getContextValue(field: string, context: TriggerContext): any {
    // Use pre-computed field access map for performance
    const fieldAccessors = this.getFieldAccessors();
    const accessor = fieldAccessors[field];
    
    if (accessor) {
      return accessor(context);
    }
    
    // Fallback to direct property access
    return (context as any)[field];
  }

  /**
   * Pre-computed field accessors for common fields
   */
  private getFieldAccessors(): Record<string, (context: TriggerContext) => any> {
    return {
      'current_time': (ctx) => ctx.current_time,
      'current_day': (ctx) => ctx.current_day,
      'visit_count': (ctx) => ctx.visit_count,
      'days_since_last_visit': (ctx) => {
        if (!ctx.last_visit) return null;
        const now = new Date();
        const lastVisit = new Date(ctx.last_visit);
        return Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
      },
      'avg_session_duration': (ctx) => ctx.avg_session_duration,
      'total_spent': (ctx) => ctx.total_spent,
      'customer_segment': (ctx) => ctx.customer_segment,
      'store_rating': (ctx) => ctx.store_rating,
      'peak_hours': (ctx) => ctx.peak_hours,
      'special_event': (ctx) => ctx.special_event,
    };
  }

  /**
   * Optimize condition order for faster evaluation
   */
  private optimizeConditionOrder(
    conditions: TriggerCondition[],
    context: TriggerContext,
    logic: 'AND' | 'OR'
  ): OptimizedTriggerCondition[] {
    // Assign priority scores to conditions
    const optimizedConditions = conditions.map(condition => ({
      ...condition,
      priority: this.calculateConditionPriority(condition, context),
      estimatedCost: this.estimateConditionCost(condition),
    }));

    // Sort conditions for optimal evaluation order
    if (logic === 'AND') {
      // For AND logic, evaluate likely-to-fail conditions first (ascending cost, descending selectivity)
      optimizedConditions.sort((a, b) => {
        const aPriority = a.priority || 0;
        const bPriority = b.priority || 0;
        const aCost = a.estimatedCost || 0;
        const bCost = b.estimatedCost || 0;
        
        // Higher priority (more selective) conditions first for AND
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        // Lower cost conditions first
        return aCost - bCost;
      });
    } else {
      // For OR logic, evaluate likely-to-pass conditions first
      optimizedConditions.sort((a, b) => {
        const aPriority = a.priority || 0;
        const bPriority = b.priority || 0;
        const aCost = a.estimatedCost || 0;
        const bCost = b.estimatedCost || 0;
        
        // Lower priority (less selective) conditions first for OR
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        // Lower cost conditions first
        return aCost - bCost;
      });
    }

    return optimizedConditions;
  }

  /**
   * Calculate condition priority based on selectivity
   */
  private calculateConditionPriority(condition: TriggerCondition, context: TriggerContext): number {
    let priority = 50; // Base priority

    // Adjust based on condition type
    switch (condition.type) {
      case 'time_based':
        priority += 30; // Time conditions are usually quite selective
        break;
      case 'frequency_based':
        priority += 20; // Frequency conditions are moderately selective
        break;
      case 'customer_behavior':
        priority += 10; // Behavior conditions vary in selectivity
        break;
      case 'store_context':
        priority += 5; // Store context is least selective
        break;
    }

    // Adjust based on operator selectivity
    switch (condition.operator) {
      case 'eq':
        priority += 20; // Equality is highly selective
        break;
      case 'between':
      case 'time_between':
        priority += 15; // Range checks are moderately selective
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        priority += 10; // Comparison operators are moderately selective
        break;
      case 'in':
      case 'nin':
        priority += 5; // List operations depend on list size
        break;
      case 'contains':
        priority -= 5; // String contains is less selective
        break;
    }

    // Adjust based on context value availability
    const value = this.getContextValue(condition.field, context);
    if (value === undefined || value === null) {
      priority += 100; // Missing values will fail fast
    }

    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Estimate computational cost of condition
   */
  private estimateConditionCost(condition: TriggerCondition): number {
    let cost = 1; // Base cost

    // Adjust based on condition type
    switch (condition.type) {
      case 'time_based':
        cost += condition.operator === 'time_between' ? 3 : 1;
        break;
      case 'frequency_based':
        cost += condition.field === 'days_since_last_visit' ? 2 : 1;
        break;
      case 'customer_behavior':
        cost += 1;
        break;
      case 'store_context':
        cost += 1;
        break;
    }

    // Adjust based on operator complexity
    switch (condition.operator) {
      case 'eq':
      case 'neq':
        cost += 1;
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        cost += 1;
        break;
      case 'between':
      case 'time_between':
        cost += 2;
        break;
      case 'in':
      case 'nin':
        cost += Array.isArray(condition.value) ? condition.value.length / 10 : 2;
        break;
      case 'contains':
      case 'starts_with':
      case 'ends_with':
        cost += 2;
        break;
      default:
        cost += 3;
        break;
    }

    return Math.max(1, cost);
  }

  /**
   * Generate cache key for evaluation result
   */
  private generateEvaluationCacheKey(
    conditions: TriggerCondition[],
    context: TriggerContext,
    logic: string
  ): string {
    const conditionsHash = this.hashConditions(conditions);
    const contextHash = this.hashContext(context);
    return `eval_${conditionsHash}_${contextHash}_${logic}`;
  }

  /**
   * Generate cache key for single condition
   */
  private generateConditionCacheKey(condition: TriggerCondition, context: TriggerContext): string {
    const conditionStr = `${condition.type}_${condition.field}_${condition.operator}_${JSON.stringify(condition.value)}`;
    const contextValue = this.getContextValue(condition.field, context);
    return `cond_${this.simpleHash(conditionStr)}_${this.simpleHash(String(contextValue))}`;
  }

  /**
   * Hash conditions for cache key
   */
  private hashConditions(conditions: TriggerCondition[]): string {
    const conditionStrs = conditions.map(c => 
      `${c.type}_${c.field}_${c.operator}_${JSON.stringify(c.value)}`
    );
    return this.simpleHash(conditionStrs.join('|'));
  }

  /**
   * Hash context for cache key
   */
  private hashContext(context: TriggerContext): string {
    // Only hash relevant context fields to avoid cache misses
    const relevantFields = [
      'current_time', 'current_day', 'visit_count', 'last_visit',
      'avg_session_duration', 'total_spent', 'customer_segment',
      'store_rating', 'peak_hours', 'special_event'
    ];
    
    const contextStr = relevantFields
      .map(field => `${field}:${(context as any)[field]}`)
      .join('|');
    
    return this.simpleHash(contextStr);
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache evaluation result
   */
  private cacheEvaluation(key: string, result: boolean, cost: number): void {
    this.evaluationCache.set(key, {
      result,
      timestamp: Date.now(),
      cost,
    });

    this.cleanupCacheIfNeeded();
  }

  /**
   * Get cached evaluation result
   */
  private getCachedEvaluation(key: string): boolean | null {
    const cached = this.evaluationCache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.evaluationCache.delete(key);
      return null;
    }
    
    return cached.result;
  }

  /**
   * Cache condition result
   */
  private cacheCondition(key: string, result: boolean): void {
    this.contextCache.set(key, {
      data: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached condition result
   */
  private getCachedCondition(key: string): boolean | null {
    const cached = this.contextCache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.contextCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Cleanup cache if it gets too large
   */
  private cleanupCacheIfNeeded(): void {
    if (this.evaluationCache.size > this.maxCacheSize) {
      // Remove oldest 20% of entries
      const entries = Array.from(this.evaluationCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.evaluationCache.delete(entries[i][0]);
      }
    }
    
    if (this.contextCache.size > this.maxCacheSize) {
      // Remove oldest 20% of entries
      const entries = Array.from(this.contextCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.contextCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Initialize common optimizations
   */
  private initializeOptimizations(): void {
    // Pre-warm cache with common patterns if needed
    // This could include common time ranges, business hours, etc.
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.evaluationCache.clear();
    this.contextCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    evaluationCacheSize: number;
    contextCacheSize: number;
    evaluationHitRate?: number;
    contextHitRate?: number;
  } {
    return {
      evaluationCacheSize: this.evaluationCache.size,
      contextCacheSize: this.contextCache.size,
    };
  }

  /**
   * Batch evaluate multiple trigger sets
   */
  async batchEvaluateConditions(
    triggerSets: Array<{
      conditions: TriggerCondition[];
      context: TriggerContext;
      logic?: 'AND' | 'OR';
    }>,
    options: TriggerEvaluationOptions = {}
  ): Promise<TriggerEvaluationResult[]> {
    // Process in parallel for better performance
    const promises = triggerSets.map(({ conditions, context, logic }) =>
      this.evaluateConditionsOptimized(conditions, context, logic, options)
    );
    
    return Promise.all(promises);
  }
}