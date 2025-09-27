import { TestRun, TestCase, TestResult, TestSuite, TestRunStatus } from '@vocilia/types/testing';
import { TestRunService } from './test-run-service';
import { TestSuiteService } from './test-suite-service';
import { JestRunner } from '../runners/jest-runner';
import { PlaywrightRunner } from '../runners/playwright-runner';
import { ArtilleryRunner } from '../runners/artillery-runner';
import { EventEmitter } from 'events';

export interface TestExecutionResult {
  runId: string;
  status: TestRunStatus;
  results: TestResult[];
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

export interface ExecutionOptions {
  environment?: string;
  parallel?: boolean;
  timeout?: number;
  retryCount?: number;
  bail?: boolean; // Stop on first failure
  verbose?: boolean;
}

export class TestExecutionService extends EventEmitter {
  private testRunService: TestRunService;
  private testSuiteService: TestSuiteService;
  private jestRunner: JestRunner;
  private playwrightRunner: PlaywrightRunner;
  private artilleryRunner: ArtilleryRunner;
  private activeExecutions: Map<string, AbortController>;

  constructor() {
    super();
    this.testRunService = new TestRunService();
    this.testSuiteService = new TestSuiteService();
    this.jestRunner = new JestRunner();
    this.playwrightRunner = new PlaywrightRunner();
    this.artilleryRunner = new ArtilleryRunner();
    this.activeExecutions = new Map();
  }

  async executeTestSuite(
    suiteId: string, 
    triggeredBy: string, 
    options: ExecutionOptions = {}
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();

    // Get test suite and validate
    const testSuite = await this.testSuiteService.getTestSuiteById(suiteId);
    if (!testSuite.testCases || testSuite.testCases.length === 0) {
      throw new Error(`Test suite ${suiteId} has no test cases`);
    }

    // Create test run
    const testRun = await this.testRunService.createTestRun({
      suite_id: suiteId,
      environment: options.environment || testSuite.environment,
      triggered_by: triggeredBy,
      trigger_reason: 'execution',
      configuration: {
        parallel: options.parallel || false,
        timeout: options.timeout || testSuite.timeout,
        retryCount: options.retryCount || testSuite.retryCount,
        bail: options.bail || false,
        verbose: options.verbose || false
      }
    });

    const abortController = new AbortController();
    this.activeExecutions.set(testRun.id, abortController);

    try {
      // Update status to running
      await this.testRunService.updateTestRunStatus(testRun.id, 'running');
      this.emit('executionStarted', { runId: testRun.id, suiteId });

      // Execute test cases
      const results = await this.executeTestCases(
        testRun.id,
        testSuite.testCases,
        options,
        abortController.signal
      );

      // Calculate final status
      const hasFailures = results.some(r => r.status === 'failed');
      const finalStatus: TestRunStatus = hasFailures ? 'failed' : 'completed';

      // Update test run with final status
      const duration = Date.now() - startTime;
      await this.testRunService.updateTestRunStatus(testRun.id, finalStatus, {
        duration
      });

      const summary = this.calculateSummary(results);

      this.emit('executionCompleted', { 
        runId: testRun.id, 
        suiteId, 
        status: finalStatus,
        summary 
      });

      return {
        runId: testRun.id,
        status: finalStatus,
        results,
        duration,
        summary
      };

    } catch (error) {
      // Update status to failed
      await this.testRunService.updateTestRunStatus(testRun.id, 'failed');
      
      this.emit('executionFailed', { 
        runId: testRun.id, 
        suiteId, 
        error: error.message 
      });

      throw error;
    } finally {
      this.activeExecutions.delete(testRun.id);
    }
  }

  async executeTestCases(
    runId: string,
    testCases: TestCase[],
    options: ExecutionOptions,
    signal: AbortSignal
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (options.parallel) {
      // Execute test cases in parallel
      const promises = testCases.map(testCase => 
        this.executeTestCase(runId, testCase, options, signal)
      );

      const parallelResults = await Promise.allSettled(promises);
      
      for (const result of parallelResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create a failed result for rejected promises
          const errorResult: TestResult = {
            id: `error-${Date.now()}`,
            run_id: runId,
            case_id: 'unknown',
            case_name: 'Unknown',
            status: 'failed',
            message: result.reason?.message || 'Execution failed',
            severity: 'error',
            duration: 0,
            created_at: new Date().toISOString()
          };
          results.push(errorResult);
        }
      }
    } else {
      // Execute test cases sequentially
      for (const testCase of testCases) {
        if (signal.aborted) {
          break;
        }

        try {
          const result = await this.executeTestCase(runId, testCase, options, signal);
          results.push(result);

          // Bail on first failure if configured
          if (options.bail && result.status === 'failed') {
            break;
          }
        } catch (error) {
          const errorResult: TestResult = {
            id: `error-${Date.now()}`,
            run_id: runId,
            case_id: testCase.id,
            case_name: testCase.name,
            status: 'failed',
            message: error.message,
            severity: 'error',
            duration: 0,
            created_at: new Date().toISOString()
          };
          results.push(errorResult);

          if (options.bail) {
            break;
          }
        }
      }
    }

    return results;
  }

  async executeTestCase(
    runId: string,
    testCase: TestCase,
    options: ExecutionOptions,
    signal: AbortSignal
  ): Promise<TestResult> {
    const startTime = Date.now();

    this.emit('testCaseStarted', { 
      runId, 
      caseId: testCase.id, 
      caseName: testCase.name 
    });

    try {
      // Select appropriate runner based on test type
      let runner;
      switch (testCase.test_type) {
        case 'unit':
        case 'integration':
        case 'contract':
          runner = this.jestRunner;
          break;
        case 'e2e':
        case 'ui':
          runner = this.playwrightRunner;
          break;
        case 'performance':
        case 'load':
          runner = this.artilleryRunner;
          break;
        default:
          throw new Error(`Unsupported test type: ${testCase.test_type}`);
      }

      // Execute setup script if provided
      if (testCase.setup_script) {
        await this.executeScript(testCase.setup_script, signal);
      }

      // Execute the test case
      const result = await runner.executeTest(testCase, {
        timeout: options.timeout || testCase.timeout,
        signal
      });

      // Execute teardown script if provided
      if (testCase.teardown_script) {
        await this.executeScript(testCase.teardown_script, signal);
      }

      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        id: `result-${testCase.id}-${Date.now()}`,
        run_id: runId,
        case_id: testCase.id,
        case_name: testCase.name,
        status: result.passed ? 'passed' : 'failed',
        message: result.message || '',
        error_details: result.error,
        severity: result.passed ? 'info' : 'error',
        duration,
        assertion_results: result.assertions,
        coverage_data: result.coverage,
        performance_data: result.performance,
        screenshots: result.screenshots,
        logs: result.logs,
        artifacts: result.artifacts,
        created_at: new Date().toISOString()
      };

      // Store result in database
      await this.testRunService.addTestResult(runId, testResult);

      this.emit('testCaseCompleted', { 
        runId, 
        caseId: testCase.id, 
        status: testResult.status,
        duration 
      });

      return testResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: TestResult = {
        id: `error-${testCase.id}-${Date.now()}`,
        run_id: runId,
        case_id: testCase.id,
        case_name: testCase.name,
        status: 'failed',
        message: error.message,
        error_details: error.stack,
        severity: 'error',
        duration,
        created_at: new Date().toISOString()
      };

      await this.testRunService.addTestResult(runId, errorResult);

      this.emit('testCaseFailed', { 
        runId, 
        caseId: testCase.id, 
        error: error.message 
      });

      return errorResult;
    }
  }

  async cancelExecution(runId: string): Promise<void> {
    const abortController = this.activeExecutions.get(runId);
    if (abortController) {
      abortController.abort();
      await this.testRunService.updateTestRunStatus(runId, 'cancelled');
      this.emit('executionCancelled', { runId });
    }
  }

  async getActiveExecutions(): Promise<string[]> {
    return Array.from(this.activeExecutions.keys());
  }

  private async executeScript(script: string, signal: AbortSignal): Promise<void> {
    // Simple script execution - in a real implementation, you'd want proper
    // sandboxing and security measures
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Script execution aborted'));
        return;
      }

      try {
        // This is a simplified implementation
        // In practice, you'd use a proper script runner
        const scriptFunction = new Function(script);
        scriptFunction();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private calculateSummary(results: TestResult[]): { total: number; passed: number; failed: number; skipped: number } {
    return results.reduce((summary, result) => {
      summary.total++;
      switch (result.status) {
        case 'passed':
          summary.passed++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'skipped':
          summary.skipped++;
          break;
      }
      return summary;
    }, { total: 0, passed: 0, failed: 0, skipped: 0 });
  }
}