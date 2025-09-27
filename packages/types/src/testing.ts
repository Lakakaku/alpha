/**
 * Testing Types
 * Core testing infrastructure types for comprehensive testing system
 */

// Test Suite Types
export interface TestSuite {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  component: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  coverageTarget: number; // 0-100
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCase {
  id: string;
  suiteId: string;
  name: string;
  description: string;
  type: 'contract' | 'unit' | 'integration' | 'e2e' | 'performance';
  filePath: string;
  testFunction: string;
  tags: string[];
  timeout: number; // milliseconds
  retries: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Test Environment Types
export interface TestEnvironment {
  id: string;
  name: string;
  type: 'local' | 'branch' | 'preview' | 'staging';
  config: TestEnvironmentConfig;
  browserConfig?: BrowserConfig;
  performanceConfig?: PerformanceConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestEnvironmentConfig {
  databaseUrl: string;
  apiBaseUrl: string;
  frontendUrl: string;
  authConfig: Record<string, any>;
}

export interface BrowserConfig {
  browsers: ('chrome' | 'firefox' | 'safari')[];
  viewport: {
    width: number;
    height: number;
  };
  headless: boolean;
}

export interface PerformanceConfig {
  maxConcurrentUsers: number;
  testDuration: number; // seconds
  thresholds: Record<string, number>;
}

// Test Execution Types
export interface TestRun {
  id: string;
  triggerType: 'commit' | 'pull-request' | 'scheduled' | 'manual';
  triggerReference: string; // commit SHA, PR number, etc.
  branch: string;
  environmentId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  coverage?: CoverageMetrics;
  performanceMetrics?: PerformanceMetrics;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
  duration: number; // milliseconds
  errorMessage?: string;
  stackTrace?: string;
  screenshots: string[]; // URLs
  logs?: string;
  assertions?: AssertionResults;
  coverage?: CoverageData;
  performanceData?: Record<string, any>;
  retryAttempt: number;
  createdAt: Date;
}

// Coverage Types
export interface CoverageMetrics {
  overall: number;
  unit: number;
  integration: number;
}

export interface CoverageData {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface AssertionResults {
  total: number;
  passed: number;
  failed: number;
}

// Performance Types
export interface PerformanceMetrics {
  apiResponseTime: number; // ms
  pageLoadTime: number; // ms
  errorRate: number; // percentage
}

export interface PerformanceBenchmark {
  id: string;
  operation: string; // e.g., "qr-scan", "ai-call", "payment-process"
  component: string; // e.g., "customer-app", "backend-api"
  metric: 'response-time' | 'page-load' | 'throughput' | 'error-rate';
  target: number;
  unit: string; // e.g., "ms", "requests/sec", "percent"
  threshold: PerformanceThreshold;
  environment: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceThreshold {
  warning: number;
  critical: number;
}

export interface PerformanceResult {
  id: string;
  testRunId: string;
  benchmarkId: string;
  value: number;
  status: 'pass' | 'warning' | 'fail';
  measurements: PerformanceMeasurements;
  conditions: TestConditions;
  metadata?: Record<string, any>;
  measuredAt: Date;
}

export interface PerformanceMeasurements {
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

export interface TestConditions {
  concurrentUsers: number;
  duration: number; // seconds
  iterations: number;
}

// Test Data Types
export interface TestDataSet {
  id: string;
  name: string;
  category: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin';
  schema: Record<string, any>;
  generatorConfig: GeneratorConfig;
  sampleSize: number;
  refreshStrategy: 'static' | 'per-run' | 'per-test';
  constraints?: Record<string, any>;
  tags: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDataRecord {
  id: string;
  dataSetId: string;
  data: Record<string, any>;
  checksum: string;
  generatedAt: Date;
  lastUsed?: Date;
}

export interface GeneratorConfig {
  locale: string;
  seed?: number;
  rules: Record<string, any>;
}

// Test Reporting Types
export interface TestReport {
  id: string;
  testRunId: string;
  reportType: 'summary' | 'detailed' | 'coverage' | 'performance';
  period?: {
    startDate: Date;
    endDate: Date;
  };
  metrics: ReportMetrics;
  trends?: Record<string, any>;
  recommendations: string[];
  format: 'json' | 'html' | 'pdf';
  url?: string;
  generatedAt: Date;
}

export interface ReportMetrics {
  totalTests: number;
  passRate: number; // percentage
  coverage: number; // percentage
  performance: Record<string, any>;
}

// Test Configuration Types
export interface TestConfig {
  suites: TestSuiteConfig[];
  environments: TestEnvironmentConfig[];
  coverage: CoverageConfig;
  performance: PerformanceConfig;
  reporting: ReportingConfig;
}

export interface TestSuiteConfig {
  name: string;
  type: TestSuite['type'];
  component: string;
  patterns: string[]; // file patterns
  coverageTarget: number;
  timeout: number;
  retries: number;
  tags: string[];
}

export interface CoverageConfig {
  enabled: boolean;
  threshold: {
    global: CoverageThreshold;
    perFile?: CoverageThreshold;
  };
  reporters: ('text' | 'html' | 'lcov' | 'json')[];
  collectFrom: string[];
  exclude: string[];
}

export interface CoverageThreshold {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface ReportingConfig {
  enabled: boolean;
  formats: ('json' | 'html' | 'pdf')[];
  destinations: string[]; // URLs or file paths
  schedule?: string; // cron expression
}

// Test Execution Context
export interface TestContext {
  runId: string;
  suiteId: string;
  caseId?: string;
  environment: TestEnvironment;
  data: TestDataSet[];
  config: TestConfig;
  startTime: Date;
  timeout: number;
}

// Test Event Types
export interface TestEvent {
  id: string;
  type: TestEventType;
  testRunId: string;
  testCaseId?: string;
  timestamp: Date;
  data: Record<string, any>;
  source: string; // e.g., "jest", "playwright", "artillery"
}

export type TestEventType =
  | 'test-run-started'
  | 'test-run-completed'
  | 'test-run-failed'
  | 'test-run-cancelled'
  | 'test-case-started'
  | 'test-case-completed'
  | 'test-case-failed'
  | 'test-case-skipped'
  | 'test-case-timeout'
  | 'coverage-generated'
  | 'performance-measured'
  | 'report-generated';

// Test Runner Types
export interface TestRunner {
  id: string;
  name: string;
  type: 'jest' | 'playwright' | 'artillery' | 'custom';
  version: string;
  config: Record<string, any>;
  status: 'idle' | 'running' | 'error';
  capabilities: TestRunnerCapabilities;
}

export interface TestRunnerCapabilities {
  supportedTypes: TestCase['type'][];
  parallelExecution: boolean;
  browserSupport?: string[];
  languageSupport: string[];
  coverageSupport: boolean;
  performanceSupport: boolean;
}

// Test Scheduling Types
export interface TestSchedule {
  id: string;
  name: string;
  cron: string; // cron expression
  suiteIds: string[];
  environmentId: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Test Quality Metrics
export interface TestQualityMetrics {
  flakiness: number; // percentage of tests that fail intermittently
  reliability: number; // percentage of consistent results
  maintainability: number; // based on test complexity and dependencies
  coverage: number; // code coverage percentage
  performance: number; // average test execution time
  feedback: number; // time from commit to test results
}

// Error Types
export interface TestError {
  code: string;
  message: string;
  type: 'assertion' | 'timeout' | 'setup' | 'teardown' | 'environment' | 'unknown';
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
}

// Utility Types
export type TestStatus = TestRun['status'] | TestResult['status'];
export type TestType = TestSuite['type'] | TestCase['type'];
export type TestPriority = TestSuite['priority'];
export type EnvironmentType = TestEnvironment['type'];
export type TriggerType = TestRun['triggerType'];
export type MetricType = PerformanceBenchmark['metric'];
export type DataCategory = TestDataSet['category'];
export type RefreshStrategy = TestDataSet['refreshStrategy'];
export type ReportType = TestReport['reportType'];
export type ReportFormat = TestReport['format'];

// Type Guards
export function isTestSuite(obj: any): obj is TestSuite {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string' && 
         ['unit', 'integration', 'e2e', 'performance'].includes(obj.type);
}

export function isTestResult(obj: any): obj is TestResult {
  return obj && typeof obj.id === 'string' && typeof obj.testRunId === 'string' &&
         ['passed', 'failed', 'skipped', 'timeout', 'error'].includes(obj.status);
}

export function isPerformanceResult(obj: any): obj is PerformanceResult {
  return obj && typeof obj.id === 'string' && typeof obj.value === 'number' &&
         ['pass', 'warning', 'fail'].includes(obj.status);
}

// Constants
export const TEST_TIMEOUTS = {
  UNIT: 5000,       // 5 seconds
  INTEGRATION: 30000, // 30 seconds
  E2E: 60000,       // 1 minute
  PERFORMANCE: 300000 // 5 minutes
} as const;

export const COVERAGE_TARGETS = {
  UNIT: 90,
  INTEGRATION: 80,
  E2E: 70,
  PERFORMANCE: 60
} as const;

export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 1000,   // 1 second
  PAGE_LOAD_TIME: 3000,      // 3 seconds
  ERROR_RATE: 1,             // 1%
  THROUGHPUT: 100            // requests/second
} as const;