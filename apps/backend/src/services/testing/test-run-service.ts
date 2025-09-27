import { TestRun, TestResult, CreateTestRunRequest, TestRunStatus } from '@vocilia/types/testing';
import { TestRunModel, TestResultModel, TestSuiteModel } from '@vocilia/database/testing';
import { v4 as uuidv4 } from 'uuid';

export class TestRunService {
  private testRunModel: TestRunModel;
  private testResultModel: TestResultModel;
  private testSuiteModel: TestSuiteModel;

  constructor() {
    this.testRunModel = new TestRunModel();
    this.testResultModel = new TestResultModel();
    this.testSuiteModel = new TestSuiteModel();
  }

  async createTestRun(data: CreateTestRunRequest): Promise<TestRun> {
    // Validate test suite exists
    const testSuite = await this.testSuiteModel.findById(data.suite_id);
    if (!testSuite) {
      throw new Error(`Test suite with ID ${data.suite_id} not found`);
    }

    const testRun: TestRun = {
      id: uuidv4(),
      suite_id: data.suite_id,
      environment: data.environment || testSuite.environment || 'test',
      status: 'pending',
      triggered_by: data.triggered_by,
      trigger_reason: data.trigger_reason || 'manual',
      configuration: data.configuration || {},
      tags: data.tags || [],
      scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
      started_at: null,
      completed_at: null,
      duration: null,
      total_tests: 0,
      passed_tests: 0,
      failed_tests: 0,
      skipped_tests: 0,
      error_count: 0,
      warning_count: 0,
      coverage_percentage: null,
      performance_score: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return await this.testRunModel.create(testRun);
  }

  async getTestRuns(
    suite_id?: string,
    environment?: string,
    status?: TestRunStatus,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ runs: TestRun[]; total: number }> {
    const filters = {};
    if (suite_id) filters['suite_id'] = suite_id;
    if (environment) filters['environment'] = environment;
    if (status) filters['status'] = status;

    const { data, total } = await this.testRunModel.findMany(filters, limit, offset);
    return { runs: data, total };
  }

  async getTestRunById(id: string): Promise<TestRun> {
    const testRun = await this.testRunModel.findById(id);
    if (!testRun) {
      throw new Error(`Test run with ID ${id} not found`);
    }
    return testRun;
  }

  async updateTestRunStatus(id: string, status: TestRunStatus, additionalData?: Partial<TestRun>): Promise<TestRun> {
    const existing = await this.testRunModel.findById(id);
    if (!existing) {
      throw new Error(`Test run with ID ${id} not found`);
    }

    const updateData: Partial<TestRun> = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    // Set timestamps based on status
    if (status === 'running' && !existing.started_at) {
      updateData.started_at = new Date().toISOString();
    } else if (['completed', 'failed', 'cancelled'].includes(status) && !existing.completed_at) {
      updateData.completed_at = new Date().toISOString();
      
      // Calculate duration if we have both start and end times
      if (existing.started_at) {
        const startTime = new Date(existing.started_at).getTime();
        const endTime = new Date(updateData.completed_at).getTime();
        updateData.duration = endTime - startTime;
      }
    }

    await this.testRunModel.update(id, updateData);
    return this.getTestRunById(id);
  }

  async cancelTestRun(id: string): Promise<TestRun> {
    const existing = await this.testRunModel.findById(id);
    if (!existing) {
      throw new Error(`Test run with ID ${id} not found`);
    }

    if (!['pending', 'running'].includes(existing.status)) {
      throw new Error(`Cannot cancel test run with status: ${existing.status}`);
    }

    return this.updateTestRunStatus(id, 'cancelled');
  }

  async getTestResults(runId: string): Promise<TestResult[]> {
    const testRun = await this.testRunModel.findById(runId);
    if (!testRun) {
      throw new Error(`Test run with ID ${runId} not found`);
    }

    return await this.testResultModel.findByRunId(runId);
  }

  async addTestResult(runId: string, result: Omit<TestResult, 'id' | 'run_id' | 'created_at'>): Promise<TestResult> {
    const testRun = await this.testRunModel.findById(runId);
    if (!testRun) {
      throw new Error(`Test run with ID ${runId} not found`);
    }

    const testResult: TestResult = {
      id: uuidv4(),
      run_id: runId,
      created_at: new Date().toISOString(),
      ...result
    };

    const created = await this.testResultModel.create(testResult);

    // Update test run statistics
    await this.updateTestRunStatistics(runId);

    return created;
  }

  async updateTestRunStatistics(runId: string): Promise<void> {
    const results = await this.testResultModel.findByRunId(runId);
    
    const stats = results.reduce((acc, result) => {
      acc.total_tests++;
      
      switch (result.status) {
        case 'passed':
          acc.passed_tests++;
          break;
        case 'failed':
          acc.failed_tests++;
          break;
        case 'skipped':
          acc.skipped_tests++;
          break;
      }

      if (result.severity === 'error') {
        acc.error_count++;
      } else if (result.severity === 'warning') {
        acc.warning_count++;
      }

      return acc;
    }, {
      total_tests: 0,
      passed_tests: 0,
      failed_tests: 0,
      skipped_tests: 0,
      error_count: 0,
      warning_count: 0
    });

    // Calculate coverage percentage if available
    const coverageResults = results.filter(r => r.coverage_data);
    let coverage_percentage = null;
    if (coverageResults.length > 0) {
      const totalCoverage = coverageResults.reduce((sum, r) => sum + (r.coverage_data?.percentage || 0), 0);
      coverage_percentage = totalCoverage / coverageResults.length;
    }

    // Calculate performance score
    const performanceResults = results.filter(r => r.performance_data);
    let performance_score = null;
    if (performanceResults.length > 0) {
      const avgDuration = performanceResults.reduce((sum, r) => sum + (r.duration || 0), 0) / performanceResults.length;
      // Simple performance scoring: faster = better (normalized to 0-100)
      performance_score = Math.max(0, Math.min(100, 100 - (avgDuration / 1000))); // Assume 1 second = 0 score
    }

    await this.testRunModel.update(runId, {
      ...stats,
      coverage_percentage,
      performance_score,
      updated_at: new Date().toISOString()
    });
  }

  async getTestRunHistory(suiteId: string, limit: number = 10): Promise<TestRun[]> {
    const { runs } = await this.getTestRuns(suiteId, undefined, undefined, limit, 0);
    return runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getActiveTestRuns(): Promise<TestRun[]> {
    const { runs } = await this.getTestRuns(undefined, undefined, 'running');
    return runs;
  }

  async getTestRunsByEnvironment(environment: string): Promise<TestRun[]> {
    const { runs } = await this.getTestRuns(undefined, environment);
    return runs;
  }

  async retryFailedTests(runId: string): Promise<TestRun> {
    const originalRun = await this.getTestRunById(runId);
    const failedResults = await this.testResultModel.findByRunId(runId, 'failed');

    if (failedResults.length === 0) {
      throw new Error('No failed tests to retry');
    }

    // Create a new test run for retry
    const retryRun = await this.createTestRun({
      suite_id: originalRun.suite_id,
      environment: originalRun.environment,
      triggered_by: originalRun.triggered_by,
      trigger_reason: 'retry',
      configuration: originalRun.configuration,
      tags: [...originalRun.tags, 'retry']
    });

    return retryRun;
  }
}