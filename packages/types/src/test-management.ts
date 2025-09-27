/**
 * Test Management API Types
 * Types for test management API contracts and requests/responses
 */

import {
  TestSuite,
  TestCase,
  TestRun,
  TestResult,
  TestEnvironment,
  PerformanceBenchmark,
  PerformanceResult,
  TestDataSet,
  TestDataRecord,
  TestReport,
  TestSchedule,
  TestRunner,
  TestQualityMetrics,
  TestError
} from './testing';

// API Request Types
export interface CreateTestSuiteRequest {
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  component: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  coverageTarget?: number; // 0-100, default 80
}

export interface UpdateTestSuiteRequest {
  name?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  coverageTarget?: number; // 0-100
  enabled?: boolean;
}

export interface CreateTestCaseRequest {
  suiteId: string;
  name: string;
  description: string;
  type: 'contract' | 'unit' | 'integration' | 'e2e' | 'performance';
  filePath: string;
  testFunction: string;
  tags?: string[];
  timeout?: number; // milliseconds
  retries?: number;
}

export interface UpdateTestCaseRequest {
  name?: string;
  description?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  enabled?: boolean;
}

export interface TriggerTestRunRequest {
  triggerType: 'commit' | 'pull-request' | 'scheduled' | 'manual';
  triggerReference: string;
  branch: string;
  environmentId?: string;
  suiteIds?: string[]; // if not provided, run all enabled suites
}

export interface CreateTestEnvironmentRequest {
  name: string;
  type: 'local' | 'branch' | 'preview' | 'staging';
  config: {
    databaseUrl: string;
    apiBaseUrl: string;
    frontendUrl: string;
    authConfig: Record<string, any>;
  };
  browserConfig?: {
    browsers: ('chrome' | 'firefox' | 'safari')[];
    viewport: {
      width: number;
      height: number;
    };
    headless: boolean;
  };
  performanceConfig?: {
    maxConcurrentUsers: number;
    testDuration: number;
    thresholds: Record<string, number>;
  };
}

export interface UpdateTestEnvironmentRequest {
  name?: string;
  config?: Partial<CreateTestEnvironmentRequest['config']>;
  browserConfig?: Partial<CreateTestEnvironmentRequest['browserConfig']>;
  performanceConfig?: Partial<CreateTestEnvironmentRequest['performanceConfig']>;
  enabled?: boolean;
}

export interface CreateBenchmarkRequest {
  operation: string;
  component: string;
  metric: 'response-time' | 'page-load' | 'throughput' | 'error-rate';
  target: number;
  unit: string;
  threshold: {
    warning: number;
    critical: number;
  };
  environment: string;
}

export interface UpdateBenchmarkRequest {
  operation?: string;
  target?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
  enabled?: boolean;
}

export interface CreateDataSetRequest {
  name: string;
  category: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin';
  schema: Record<string, any>;
  generatorConfig?: {
    locale: string;
    seed?: number;
    rules: Record<string, any>;
  };
  sampleSize?: number; // default 100
  refreshStrategy?: 'static' | 'per-run' | 'per-test'; // default 'per-run'
}

export interface UpdateDataSetRequest {
  name?: string;
  schema?: Record<string, any>;
  generatorConfig?: Partial<CreateDataSetRequest['generatorConfig']>;
  sampleSize?: number;
  refreshStrategy?: 'static' | 'per-run' | 'per-test';
  enabled?: boolean;
}

export interface GenerateDataRequest {
  count?: number; // 1-10000, default 100
  seed?: number; // for reproducible generation
}

export interface CreateTestScheduleRequest {
  name: string;
  cron: string; // cron expression
  suiteIds: string[];
  environmentId: string;
}

export interface UpdateTestScheduleRequest {
  name?: string;
  cron?: string;
  suiteIds?: string[];
  environmentId?: string;
  enabled?: boolean;
}

// API Response Types
export interface TestSuiteResponse extends TestSuite {
  testCases?: TestCase[];
  lastRun?: TestRun;
  metrics?: {
    totalTests: number;
    passRate: number;
    averageDuration: number;
    lastExecuted?: Date;
  };
}

export interface TestSuiteDetailsResponse extends TestSuiteResponse {
  testCases: TestCase[];
  recentRuns: TestRun[];
  coverage: {
    current: number;
    trend: number; // percentage change from previous
    history: Array<{ date: Date; value: number }>;
  };
}

export interface TestRunResponse extends TestRun {
  environment?: TestEnvironment;
  suite?: TestSuite;
}

export interface TestRunDetailsResponse extends TestRunResponse {
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    duration: number;
  };
  artifacts?: {
    screenshots: string[];
    videos: string[];
    logs: string[];
    reports: string[];
  };
}

export interface TestResultResponse extends TestResult {
  testCase?: TestCase;
  artifacts?: {
    screenshots: string[];
    logs: string;
    coverage?: Record<string, any>;
  };
}

export interface PerformanceBenchmarkResponse extends PerformanceBenchmark {
  recentResults?: PerformanceResult[];
  trend?: {
    direction: 'improving' | 'degrading' | 'stable';
    change: number; // percentage
  };
}

export interface PerformanceResultResponse extends PerformanceResult {
  benchmark?: PerformanceBenchmark;
  comparison?: {
    previous?: PerformanceResult;
    baseline?: PerformanceResult;
    trend: 'better' | 'worse' | 'same';
  };
}

export interface TestDataSetResponse extends TestDataSet {
  recordCount: number;
  lastGenerated?: Date;
  usage: {
    testsUsing: number;
    lastUsed?: Date;
  };
}

export interface TestReportResponse extends TestReport {
  downloadUrl?: string;
  size?: number; // file size in bytes
  status: 'generating' | 'ready' | 'error';
}

export interface TestQualityResponse {
  overall: TestQualityMetrics;
  breakdown: {
    unit: TestQualityMetrics;
    integration: TestQualityMetrics;
    e2e: TestQualityMetrics;
    performance: TestQualityMetrics;
  };
  trends: {
    period: string; // e.g., "last-30-days"
    data: Array<{
      date: Date;
      metrics: TestQualityMetrics;
    }>;
  };
  recommendations: Array<{
    type: 'flakiness' | 'coverage' | 'performance' | 'maintenance';
    priority: 'high' | 'medium' | 'low';
    description: string;
    action: string;
  }>;
}

// List Response Types
export interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

export type TestSuiteListResponse = ListResponse<TestSuiteResponse>;
export type TestRunListResponse = ListResponse<TestRunResponse>;
export type TestResultListResponse = ListResponse<TestResultResponse>;
export type PerformanceBenchmarkListResponse = ListResponse<PerformanceBenchmarkResponse>;
export type PerformanceResultListResponse = ListResponse<PerformanceResultResponse>;
export type TestDataSetListResponse = ListResponse<TestDataSetResponse>;
export type TestDataRecordListResponse = ListResponse<TestDataRecord>;

// Query Parameter Types
export interface TestSuiteQuery {
  component?: string;
  type?: 'unit' | 'integration' | 'e2e' | 'performance';
  enabled?: boolean;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  page?: number;
  pageSize?: number;
  sort?: string; // e.g., "name:asc", "createdAt:desc"
  search?: string;
}

export interface TestRunQuery {
  branch?: string;
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  triggerType?: 'commit' | 'pull-request' | 'scheduled' | 'manual';
  environmentId?: string;
  suiteId?: string;
  since?: string; // ISO date string
  until?: string; // ISO date string
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface TestResultQuery {
  testRunId?: string;
  testCaseId?: string;
  status?: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
  suiteId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface PerformanceQuery {
  component?: string;
  metric?: 'response-time' | 'page-load' | 'throughput' | 'error-rate';
  environment?: string;
  benchmarkId?: string;
  testRunId?: string;
  status?: 'pass' | 'warning' | 'fail';
  since?: string;
  until?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface TestDataQuery {
  category?: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin';
  refreshStrategy?: 'static' | 'per-run' | 'per-test';
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
}

// Error Response Types
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}

export interface ValidationError extends APIError {
  error: APIError['error'] & {
    code: 'VALIDATION_ERROR';
    fields: Array<{
      field: string;
      message: string;
      value?: any;
    }>;
  };
}

export interface NotFoundError extends APIError {
  error: APIError['error'] & {
    code: 'NOT_FOUND';
    resource: string;
    id: string;
  };
}

export interface ConflictError extends APIError {
  error: APIError['error'] & {
    code: 'CONFLICT';
    resource: string;
    conflictingField: string;
  };
}

// Success Response Types
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId: string;
}

export interface CreatedResponse<T = any> extends SuccessResponse<T> {
  data: T & { id: string };
}

export interface UpdatedResponse<T = any> extends SuccessResponse<T> {
  data: T;
  changes: string[]; // list of changed fields
}

export interface DeletedResponse {
  success: true;
  message: string;
  deletedId: string;
  timestamp: string;
  requestId: string;
}

// Health Check Types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: {
    database: ServiceHealth;
    testRunners: ServiceHealth;
    fileStorage: ServiceHealth;
    reportGeneration: ServiceHealth;
  };
  metrics: {
    activeTestRuns: number;
    queuedTests: number;
    averageResponseTime: number;
    uptime: number; // seconds
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number; // milliseconds
  lastCheck: string; // ISO timestamp
  message?: string;
}

// Statistics Types
export interface TestStatistics {
  period: {
    start: Date;
    end: Date;
  };
  totals: {
    testRuns: number;
    testCases: number;
    assertions: number;
    duration: number; // total milliseconds
  };
  success: {
    passRate: number; // percentage
    reliability: number; // percentage
    trend: 'improving' | 'degrading' | 'stable';
  };
  performance: {
    averageRunTime: number; // milliseconds
    p95RunTime: number;
    p99RunTime: number;
    flakiness: number; // percentage
  };
  coverage: {
    overall: number;
    unit: number;
    integration: number;
    e2e: number;
    trend: number; // percentage change
  };
  topFailures: Array<{
    testCase: string;
    failureCount: number;
    failureRate: number;
    lastFailure: Date;
  }>;
  slowestTests: Array<{
    testCase: string;
    averageDuration: number;
    p95Duration: number;
    runCount: number;
  }>;
}

// Webhook Types
export interface TestWebhookPayload {
  event: 'test-run-completed' | 'test-run-failed' | 'coverage-threshold-failed' | 'performance-threshold-exceeded';
  timestamp: string;
  data: TestRun | TestResult | PerformanceResult;
  metadata: {
    projectId: string;
    environment: string;
    branch: string;
    commit?: string;
  };
}

// Export all types for API client usage
export type {
  TestSuite,
  TestCase,
  TestRun,
  TestResult,
  TestEnvironment,
  PerformanceBenchmark,
  PerformanceResult,
  TestDataSet,
  TestDataRecord,
  TestReport,
  TestSchedule,
  TestRunner,
  TestQualityMetrics,
  TestError
} from './testing';