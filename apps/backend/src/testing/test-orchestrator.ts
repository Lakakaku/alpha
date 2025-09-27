import { EventEmitter } from 'events';
import { JestRunner } from './runners/jest-runner.js';
import { PlaywrightRunner } from './runners/playwright-runner.js';
import { ArtilleryRunner } from './runners/artillery-runner.js';
import { TestRunner, TestRunResult, TestRunOptions, TestSuite } from '../types/testing.js';

export interface OrchestrationOptions {
  runId: string;
  suites: TestSuite[];
  environment: string;
  parallel?: boolean;
  maxConcurrency?: number;
  stopOnFailure?: boolean;
}

export interface OrchestrationResult {
  runId: string;
  status: 'passed' | 'failed' | 'cancelled' | 'error';
  startTime: number;
  endTime: number;
  duration: number;
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  skippedSuites: number;
  suiteResults: TestRunResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    coverage?: any;
  };
}

export class TestOrchestrator extends EventEmitter {
  private runners: Map<string, TestRunner>;
  private activeRuns: Map<string, Promise<TestRunResult>>;

  constructor() {
    super();
    this.runners = new Map();
    this.activeRuns = new Map();
    
    // Initialize runners
    this.runners.set('jest', new JestRunner());
    this.runners.set('playwright', new PlaywrightRunner());
    this.runners.set('artillery', new ArtilleryRunner());

    // Forward runner events
    this.runners.forEach((runner, type) => {
      runner.on('start', (data) => this.emit('suite-start', { ...data, runner: type }));
      runner.on('output', (data) => this.emit('suite-output', { ...data, runner: type }));
      runner.on('complete', (data) => this.emit('suite-complete', { ...data, runner: type }));
      runner.on('error', (data) => this.emit('suite-error', { ...data, runner: type }));
      runner.on('cancelled', (data) => this.emit('suite-cancelled', { ...data, runner: type }));
    });
  }

  async orchestrate(options: OrchestrationOptions): Promise<OrchestrationResult> {
    const startTime = Date.now();
    this.emit('orchestration-start', { runId: options.runId, suites: options.suites.length });

    try {
      let suiteResults: TestRunResult[];

      if (options.parallel && options.suites.length > 1) {
        suiteResults = await this.runSuitesInParallel(options);
      } else {
        suiteResults = await this.runSuitesSequentially(options);
      }

      const endTime = Date.now();
      const result = this.buildOrchestrationResult(options, suiteResults, startTime, endTime);

      this.emit('orchestration-complete', result);
      return result;
    } catch (error) {
      const endTime = Date.now();
      const errorResult: OrchestrationResult = {
        runId: options.runId,
        status: 'error',
        startTime,
        endTime,
        duration: endTime - startTime,
        totalSuites: options.suites.length,
        passedSuites: 0,
        failedSuites: options.suites.length,
        skippedSuites: 0,
        suiteResults: [],
        summary: {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0
        }
      };

      this.emit('orchestration-error', { ...errorResult, error });
      return errorResult;
    }
  }

  async cancelOrchestration(runId: string): Promise<boolean> {
    const promises = Array.from(this.activeRuns.entries())
      .filter(([key]) => key.startsWith(runId))
      .map(async ([key, promise]) => {
        const [, suiteId] = key.split('-');
        const suite = Array.from(this.runners.values()).find(runner => 
          // This is a simplified lookup - in practice you'd track which runner is handling which suite
          true
        );
        
        if (suite) {
          return suite.cancel();
        }
        return false;
      });

    const results = await Promise.all(promises);
    const cancelled = results.some(result => result);

    if (cancelled) {
      this.emit('orchestration-cancelled', { runId });
    }

    return cancelled;
  }

  private async runSuitesInParallel(options: OrchestrationOptions): Promise<TestRunResult[]> {
    const maxConcurrency = options.maxConcurrency || 3;
    const results: TestRunResult[] = [];
    
    // Group suites by runner type for efficient parallel execution
    const suitesByRunner = this.groupSuitesByRunner(options.suites);
    
    for (const [runnerType, suites] of suitesByRunner.entries()) {
      const runner = this.runners.get(runnerType);
      if (!runner) {
        throw new Error(`Runner not found: ${runnerType}`);
      }

      // Process suites in batches
      const batches = this.createBatches(suites, maxConcurrency);
      
      for (const batch of batches) {
        const batchPromises = batch.map(suite => this.runSuite(runner, suite, options));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Stop on failure if configured
        if (options.stopOnFailure && batchResults.some(r => r.status === 'failed')) {
          this.emit('orchestration-stopped', { 
            runId: options.runId, 
            reason: 'failure',
            failedSuite: batchResults.find(r => r.status === 'failed')?.runId
          });
          break;
        }
      }
    }

    return results;
  }

  private async runSuitesSequentially(options: OrchestrationOptions): Promise<TestRunResult[]> {
    const results: TestRunResult[] = [];

    for (const suite of options.suites) {
      const runnerType = this.getRunnerTypeForSuite(suite);
      const runner = this.runners.get(runnerType);
      
      if (!runner) {
        throw new Error(`Runner not found for suite type: ${suite.type}`);
      }

      const result = await this.runSuite(runner, suite, options);
      results.push(result);

      // Stop on failure if configured
      if (options.stopOnFailure && result.status === 'failed') {
        this.emit('orchestration-stopped', { 
          runId: options.runId, 
          reason: 'failure',
          failedSuite: result.runId
        });
        break;
      }
    }

    return results;
  }

  private async runSuite(runner: TestRunner, suite: TestSuite, options: OrchestrationOptions): Promise<TestRunResult> {
    const suiteRunId = `${options.runId}-${suite.id}`;
    
    const runOptions: TestRunOptions = {
      runId: suiteRunId,
      testPaths: this.getSuiteTestPaths(suite),
      configPath: this.getSuiteConfigPath(suite),
      testPattern: suite.testPattern,
      environment: options.environment,
      maxWorkers: suite.maxWorkers,
      timeout: suite.timeout,
      workingDirectory: process.cwd()
    };

    // Track active run
    const runPromise = runner.runTests(runOptions);
    this.activeRuns.set(suiteRunId, runPromise);

    try {
      const result = await runPromise;
      return result;
    } finally {
      this.activeRuns.delete(suiteRunId);
    }
  }

  private groupSuitesByRunner(suites: TestSuite[]): Map<string, TestSuite[]> {
    const groups = new Map<string, TestSuite[]>();

    for (const suite of suites) {
      const runnerType = this.getRunnerTypeForSuite(suite);
      if (!groups.has(runnerType)) {
        groups.set(runnerType, []);
      }
      groups.get(runnerType)!.push(suite);
    }

    return groups;
  }

  private getRunnerTypeForSuite(suite: TestSuite): string {
    switch (suite.type) {
      case 'unit':
      case 'integration':
        return 'jest';
      case 'e2e':
        return 'playwright';
      case 'performance':
        return 'artillery';
      default:
        throw new Error(`Unknown suite type: ${suite.type}`);
    }
  }

  private getSuiteTestPaths(suite: TestSuite): string[] {
    // In a real implementation, this would derive test paths from suite configuration
    // For now, return paths based on suite type and component
    const basePaths: Record<string, string> = {
      'unit': `tests/unit/${suite.component}/**/*.test.ts`,
      'integration': `tests/integration/${suite.component}/**/*.test.ts`,
      'e2e': `tests/e2e/${suite.component}/**/*.spec.ts`,
      'performance': `tests/performance/${suite.component}/**/*.yml`
    };

    return [basePaths[suite.type] || `tests/**/*.test.ts`];
  }

  private getSuiteConfigPath(suite: TestSuite): string | undefined {
    const configPaths: Record<string, string> = {
      'unit': 'jest.config.js',
      'integration': 'jest.config.js',
      'e2e': 'playwright.config.ts',
      'performance': undefined // Artillery uses individual config files
    };

    return configPaths[suite.type];
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private buildOrchestrationResult(
    options: OrchestrationOptions,
    suiteResults: TestRunResult[],
    startTime: number,
    endTime: number
  ): OrchestrationResult {
    const passedSuites = suiteResults.filter(r => r.status === 'passed').length;
    const failedSuites = suiteResults.filter(r => r.status === 'failed' || r.status === 'error').length;
    const skippedSuites = options.suites.length - suiteResults.length;

    const summary = {
      totalTests: suiteResults.reduce((sum, r) => sum + r.testCount, 0),
      passedTests: suiteResults.reduce((sum, r) => sum + r.passedCount, 0),
      failedTests: suiteResults.reduce((sum, r) => sum + r.failedCount, 0),
      skippedTests: suiteResults.reduce((sum, r) => sum + r.skippedCount, 0),
      coverage: this.aggregateCoverage(suiteResults)
    };

    const status = failedSuites > 0 ? 'failed' : 
                  passedSuites === options.suites.length ? 'passed' : 'failed';

    return {
      runId: options.runId,
      status,
      startTime,
      endTime,
      duration: endTime - startTime,
      totalSuites: options.suites.length,
      passedSuites,
      failedSuites,
      skippedSuites,
      suiteResults,
      summary
    };
  }

  private aggregateCoverage(suiteResults: TestRunResult[]): any {
    const coverageResults = suiteResults
      .map(r => r.metadata?.coverage)
      .filter(c => c);

    if (coverageResults.length === 0) return undefined;

    // Simple coverage aggregation - in practice this would be more sophisticated
    const totalFiles = coverageResults.reduce((sum, c) => sum + (c.files || 0), 0);
    const coveredFiles = coverageResults.reduce((sum, c) => sum + (c.coveredFiles || 0), 0);
    const overallCoverage = coverageResults.reduce((sum, c) => sum + (c.overall || 0), 0) / coverageResults.length;

    return {
      overall: overallCoverage,
      files: totalFiles,
      coveredFiles
    };
  }
}