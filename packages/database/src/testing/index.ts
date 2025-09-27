// Testing Models
export { TestSuiteModel } from './test-suite';
export type { TestSuite, CreateTestSuiteRequest, UpdateTestSuiteRequest } from './test-suite';

export { TestCaseModel } from './test-case';
export type { TestCase, CreateTestCaseRequest, UpdateTestCaseRequest } from './test-case';

export { TestRunModel } from './test-run';
export type { TestRun, CreateTestRunRequest, UpdateTestRunRequest } from './test-run';

export { TestResultModel } from './test-result';
export type { TestResult, CreateTestResultRequest, UpdateTestResultRequest } from './test-result';

export { TestEnvironmentModel } from './test-environment';
export type { TestEnvironment, CreateTestEnvironmentRequest, UpdateTestEnvironmentRequest } from './test-environment';

export { PerformanceBenchmarkModel } from './performance-benchmark';
export type { PerformanceBenchmark, CreatePerformanceBenchmarkRequest, UpdatePerformanceBenchmarkRequest } from './performance-benchmark';

export { TestDataSetModel } from './test-dataset';
export type { TestDataSet, CreateTestDataSetRequest, UpdateTestDataSetRequest, TestDataRecord, CreateTestDataRecordRequest } from './test-dataset';

// Testing Database Factory
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';
import { TestSuiteModel } from './test-suite';
import { TestCaseModel } from './test-case';
import { TestRunModel } from './test-run';
import { TestResultModel } from './test-result';
import { TestEnvironmentModel } from './test-environment';
import { PerformanceBenchmarkModel } from './performance-benchmark';
import { TestDataSetModel } from './test-dataset';

export class TestingDatabase {
  public readonly testSuites: TestSuiteModel;
  public readonly testCases: TestCaseModel;
  public readonly testRuns: TestRunModel;
  public readonly testResults: TestResultModel;
  public readonly testEnvironments: TestEnvironmentModel;
  public readonly performanceBenchmarks: PerformanceBenchmarkModel;
  public readonly testDataSets: TestDataSetModel;

  constructor(supabase: SupabaseClient<Database>) {
    this.testSuites = new TestSuiteModel(supabase);
    this.testCases = new TestCaseModel(supabase);
    this.testRuns = new TestRunModel(supabase);
    this.testResults = new TestResultModel(supabase);
    this.testEnvironments = new TestEnvironmentModel(supabase);
    this.performanceBenchmarks = new PerformanceBenchmarkModel(supabase);
    this.testDataSets = new TestDataSetModel(supabase);
  }
}