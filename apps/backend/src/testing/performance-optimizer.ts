import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';
import { createHash } from 'crypto';
import { TestRun, TestResult, TestSuite } from '@vocilia/types';

interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  parallelEfficiency: number;
  cacheHitRate: number;
}

interface OptimizationStrategy {
  parallelWorkers: number;
  enableCaching: boolean;
  skipUnchanged: boolean;
  useIncrementalMode: boolean;
  prioritizeFailedTests: boolean;
}

interface TestExecutionPlan {
  priority: number;
  estimatedDuration: number;
  dependencies: string[];
  canParallelize: boolean;
  cacheKey?: string;
}

export class TestPerformanceOptimizer {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private executionHistory: Map<string, TestExecutionPlan[]> = new Map();
  private cacheEnabled = process.env.NODE_ENV !== 'ci';
  private maxWorkers = Math.max(1, Math.floor(require('os').cpus().length * 0.75));

  /**
   * Optimize test execution strategy based on historical data and current context
   */
  async optimizeTestExecution(
    testSuites: TestSuite[],
    options: Partial<OptimizationStrategy> = {}
  ): Promise<{
    strategy: OptimizationStrategy;
    executionPlan: Map<string, TestExecutionPlan>;
    estimatedDuration: number;
  }> {
    const strategy = this.buildOptimizationStrategy(testSuites, options);
    const executionPlan = await this.createExecutionPlan(testSuites, strategy);
    const estimatedDuration = this.calculateEstimatedDuration(executionPlan);

    return {
      strategy,
      executionPlan,
      estimatedDuration,
    };
  }

  /**
   * Build optimization strategy based on context and historical performance
   */
  private buildOptimizationStrategy(
    testSuites: TestSuite[],
    options: Partial<OptimizationStrategy>
  ): OptimizationStrategy {
    const isCIEnvironment = process.env.CI === 'true';
    const isQuickRun = process.env.QUICK_TESTS === 'true';
    const totalTests = testSuites.reduce((sum, suite) => sum + (suite.test_cases?.length || 0), 0);

    // Adaptive worker count based on test size and environment
    const optimalWorkers = this.calculateOptimalWorkerCount(totalTests, isCIEnvironment);

    return {
      parallelWorkers: options.parallelWorkers ?? optimalWorkers,
      enableCaching: options.enableCaching ?? this.cacheEnabled && !isCIEnvironment,
      skipUnchanged: options.skipUnchanged ?? isQuickRun,
      useIncrementalMode: options.useIncrementalMode ?? !isCIEnvironment,
      prioritizeFailedTests: options.prioritizeFailedTests ?? true,
    };
  }

  /**
   * Create optimized execution plan for test suites
   */
  private async createExecutionPlan(
    testSuites: TestSuite[],
    strategy: OptimizationStrategy
  ): Promise<Map<string, TestExecutionPlan>> {
    const executionPlan = new Map<string, TestExecutionPlan>();

    for (const suite of testSuites) {
      const historicalData = await this.getHistoricalPerformance(suite.id);
      const dependencies = this.analyzeDependencies(suite);
      const canParallelize = this.canParallelizeSuite(suite, dependencies);

      const plan: TestExecutionPlan = {
        priority: this.calculatePriority(suite, historicalData),
        estimatedDuration: historicalData?.averageDuration || this.estimateDuration(suite),
        dependencies: dependencies,
        canParallelize,
        cacheKey: strategy.enableCaching ? this.generateCacheKey(suite) : undefined,
      };

      executionPlan.set(suite.id, plan);
    }

    return this.optimizeExecutionOrder(executionPlan, strategy);
  }

  /**
   * Calculate optimal worker count based on test characteristics
   */
  private calculateOptimalWorkerCount(totalTests: number, isCIEnvironment: boolean): number {
    if (isCIEnvironment) {
      // Conservative approach for CI to avoid resource contention
      return Math.min(this.maxWorkers, Math.ceil(totalTests / 50));
    }

    // Local development - more aggressive parallelization
    if (totalTests < 100) return Math.min(2, this.maxWorkers);
    if (totalTests < 500) return Math.min(4, this.maxWorkers);
    return this.maxWorkers;
  }

  /**
   * Analyze test dependencies to determine execution order
   */
  private analyzeDependencies(suite: TestSuite): string[] {
    const dependencies: string[] = [];

    // Check for database dependencies
    if (suite.category === 'integration' || suite.category === 'e2e') {
      dependencies.push('database-setup');
    }

    // Check for service dependencies
    if (suite.name.includes('api') || suite.category === 'contract') {
      dependencies.push('backend-service');
    }

    // Check for UI dependencies
    if (suite.category === 'e2e' || suite.name.includes('ui')) {
      dependencies.push('frontend-service');
    }

    return dependencies;
  }

  /**
   * Determine if test suite can be parallelized
   */
  private canParallelizeSuite(suite: TestSuite, dependencies: string[]): boolean {
    // Database-heavy tests should run sequentially to avoid conflicts
    if (dependencies.includes('database-setup') && suite.category === 'integration') {
      return false;
    }

    // E2E tests with shared state should be sequential
    if (suite.category === 'e2e' && suite.name.includes('workflow')) {
      return false;
    }

    // Performance tests should run in isolation
    if (suite.category === 'performance') {
      return false;
    }

    return true;
  }

  /**
   * Calculate test priority based on failure rate and criticality
   */
  private calculatePriority(suite: TestSuite, historicalData?: any): number {
    let priority = 50; // Base priority

    // High priority for critical functionality
    if (suite.name.includes('auth') || suite.name.includes('payment')) {
      priority += 30;
    }

    // High priority for frequently failing tests
    if (historicalData?.failureRate > 0.1) {
      priority += 20;
    }

    // Low priority for slow, stable tests
    if (historicalData?.averageDuration > 30000 && historicalData?.failureRate < 0.05) {
      priority -= 10;
    }

    return Math.max(1, Math.min(100, priority));
  }

  /**
   * Generate cache key for test suite based on relevant factors
   */
  private generateCacheKey(suite: TestSuite): string {
    const factors = {
      suiteId: suite.id,
      codeHash: this.getCodeHash(suite),
      dependencies: suite.dependencies || [],
      environment: process.env.NODE_ENV,
    };

    return createHash('sha256')
      .update(JSON.stringify(factors))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get hash of relevant code files for cache invalidation
   */
  private getCodeHash(suite: TestSuite): string {
    // In a real implementation, this would hash the actual source files
    // For now, we'll use a timestamp-based approach
    return createHash('md5')
      .update(`${suite.updated_at || suite.created_at}`)
      .digest('hex');
  }

  /**
   * Optimize execution order based on dependencies and parallelization
   */
  private optimizeExecutionOrder(
    executionPlan: Map<string, TestExecutionPlan>,
    strategy: OptimizationStrategy
  ): Map<string, TestExecutionPlan> {
    const sortedEntries = Array.from(executionPlan.entries()).sort((a, b) => {
      const [, planA] = a;
      const [, planB] = b;

      // Priority-based sorting
      if (strategy.prioritizeFailedTests) {
        return planB.priority - planA.priority;
      }

      // Duration-based sorting (shortest first for quick feedback)
      return planA.estimatedDuration - planB.estimatedDuration;
    });

    return new Map(sortedEntries);
  }

  /**
   * Calculate total estimated duration considering parallelization
   */
  private calculateEstimatedDuration(executionPlan: Map<string, TestExecutionPlan>): number {
    const plans = Array.from(executionPlan.values());
    const parallelPlans = plans.filter(p => p.canParallelize);
    const sequentialPlans = plans.filter(p => !p.canParallelize);

    const sequentialDuration = sequentialPlans.reduce((sum, p) => sum + p.estimatedDuration, 0);
    
    // Parallel duration is the maximum duration of any parallel batch
    const parallelDuration = parallelPlans.length > 0 
      ? Math.max(...parallelPlans.map(p => p.estimatedDuration))
      : 0;

    return sequentialDuration + parallelDuration;
  }

  /**
   * Estimate test duration based on characteristics
   */
  private estimateDuration(suite: TestSuite): number {
    const baseTime = 1000; // 1 second base
    const testCount = suite.test_cases?.length || 1;

    switch (suite.category) {
      case 'unit':
        return baseTime + (testCount * 100); // 100ms per unit test
      case 'contract':
        return baseTime + (testCount * 200); // 200ms per contract test
      case 'integration':
        return baseTime + (testCount * 1000); // 1s per integration test
      case 'e2e':
        return baseTime + (testCount * 5000); // 5s per E2E test
      case 'performance':
        return baseTime + (testCount * 10000); // 10s per performance test
      default:
        return baseTime + (testCount * 500); // 500ms default
    }
  }

  /**
   * Get historical performance data for a test suite
   */
  private async getHistoricalPerformance(suiteId: string): Promise<any> {
    // In a real implementation, this would query the database
    // For now, return mock data based on suite characteristics
    return {
      averageDuration: this.estimateDuration({ id: suiteId } as TestSuite),
      failureRate: Math.random() * 0.2, // 0-20% failure rate
      lastRun: new Date(),
    };
  }

  /**
   * Record performance metrics for optimization learning
   */
  async recordPerformanceMetrics(
    suiteId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    this.metrics.set(suiteId, metrics);

    // Store in database for persistent learning
    if (process.env.NODE_ENV !== 'test') {
      // In a real implementation, this would save to Supabase
      console.log(`Performance metrics recorded for suite ${suiteId}:`, metrics);
    }
  }

  /**
   * Get performance insights and recommendations
   */
  getPerformanceInsights(): {
    totalOptimizationGain: number;
    recommendations: string[];
    bottlenecks: string[];
  } {
    const recommendations: string[] = [];
    const bottlenecks: string[] = [];
    let totalOptimizationGain = 0;

    // Analyze collected metrics
    for (const [suiteId, metrics] of this.metrics.entries()) {
      if (metrics.parallelEfficiency < 0.7) {
        bottlenecks.push(`Suite ${suiteId} has low parallel efficiency (${Math.round(metrics.parallelEfficiency * 100)}%)`);
        recommendations.push(`Consider breaking down ${suiteId} into smaller, independent test units`);
      }

      if (metrics.cacheHitRate < 0.3) {
        recommendations.push(`Enable caching for ${suiteId} to improve performance`);
        totalOptimizationGain += metrics.executionTime * 0.3;
      }

      if (metrics.memoryUsage > 1024 * 1024 * 500) { // 500MB
        bottlenecks.push(`Suite ${suiteId} uses excessive memory (${Math.round(metrics.memoryUsage / 1024 / 1024)}MB)`);
        recommendations.push(`Optimize memory usage in ${suiteId} by reducing test data size or improving cleanup`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Test execution is well-optimized! Consider monitoring for performance regressions.');
    }

    return {
      totalOptimizationGain: Math.round(totalOptimizationGain),
      recommendations,
      bottlenecks,
    };
  }

  /**
   * Create optimized worker pool for parallel test execution
   */
  async createWorkerPool(workerCount: number): Promise<Worker[]> {
    const workers: Worker[] = [];

    for (let i = 0; i < workerCount; i++) {
      // In a real implementation, this would create actual worker threads
      // For now, we'll simulate worker creation
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        parentPort.on('message', async (testSuite) => {
          // Execute test suite
          const result = await executeTestSuite(testSuite);
          parentPort.postMessage(result);
        });
      `, { eval: true });

      workers.push(worker);
    }

    return workers;
  }

  /**
   * Clean up performance optimizer resources
   */
  async cleanup(): Promise<void> {
    this.metrics.clear();
    this.executionHistory.clear();
  }
}

// Singleton instance for global use
export const testPerformanceOptimizer = new TestPerformanceOptimizer();

// Helper function to measure test execution performance
export function measureTestPerformance<T>(
  operation: () => Promise<T>,
  suiteId: string
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const metrics: PerformanceMetrics = {
        executionTime: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        cpuUsage: process.cpuUsage().user + process.cpuUsage().system,
        parallelEfficiency: 0.8, // Would be calculated based on actual parallel execution
        cacheHitRate: 0.5, // Would be calculated based on cache usage
      };

      // Record metrics for future optimization
      testPerformanceOptimizer.recordPerformanceMetrics(suiteId, metrics);

      resolve({ result, metrics });
    } catch (error) {
      reject(error);
    }
  });
}