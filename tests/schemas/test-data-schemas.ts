/**
 * Test Data Validation Schemas
 * Zod schemas for validating generated test data
 */

import { z } from 'zod';

// Common validation patterns
const uuidSchema = z.string().uuid();
const emailSchema = z.string().email();
const phoneSchema = z.string().regex(/^\+46 7[0-8] \d{3} \d{2} \d{2}$/, 'Invalid Swedish phone number format');
const postalCodeSchema = z.string().regex(/^\d{3} \d{2}$/, 'Invalid Swedish postal code format');
const orgNumberSchema = z.string().regex(/^\d{6}-\d{4}$/, 'Invalid Swedish organization number format');
const vatNumberSchema = z.string().regex(/^SE\d{10}01$/, 'Invalid Swedish VAT number format');
const personalNumberSchema = z.string().regex(/^\d{6}-\d{4}$/, 'Invalid Swedish personal number format');

// Address schema
export const swedishAddressSchema = z.object({
  street: z.string().min(1).max(100),
  streetNumber: z.string().min(1).max(10),
  postalCode: postalCodeSchema,
  city: z.string().min(1).max(100),
  county: z.string().min(1).max(100),
  country: z.literal('Sverige')
});

// Customer schema
export const swedishCustomerSchema = z.object({
  id: uuidSchema,
  phone: phoneSchema,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: emailSchema,
  address: swedishAddressSchema,
  personalNumber: personalNumberSchema.optional(),
  createdAt: z.date()
});

// Business schema
export const swedishBusinessSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  orgNumber: orgNumberSchema,
  vatNumber: vatNumberSchema,
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  address: swedishAddressSchema,
  industry: z.enum([
    'Detaljhandel', 'Grosshandel', 'Restaurang och hotell', 'Bygg och anläggning',
    'Transport och logistik', 'IT och telekom', 'Hälso- och sjukvård', 'Utbildning',
    'Tillverkning', 'Finansiella tjänster', 'Konsulttjänster', 'Försäkring'
  ]),
  employeeCount: z.number().int().min(1).max(10000),
  createdAt: z.date()
});

// Store schema
export const swedishStoreSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  businessId: uuidSchema,
  storeNumber: z.string().min(1).max(10),
  address: swedishAddressSchema,
  coordinates: z.object({
    lat: z.number().min(55.0).max(69.0),
    lng: z.number().min(10.0).max(24.0)
  }),
  openingHours: z.object({
    monday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
    tuesday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
    wednesday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
    thursday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
    friday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
    saturday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
    sunday: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
  }),
  storeType: z.enum([
    'Livsmedelsbutik', 'Klädbutik', 'Elektronikbutik', 'Apotek', 'Bokhandel',
    'Blomsterbutik', 'Sportbutik', 'Leksaksbutik', 'Musikaffär', 'Optik'
  ]),
  createdAt: z.date()
});

// Feedback schema
export const swedishFeedbackSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  storeId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
  categories: z.array(z.enum([
    'service', 'kvalitet', 'pris', 'sortiment', 'miljö', 'tillgänglighet', 'personal'
  ])).min(1).max(7),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  language: z.literal('sv-SE'),
  submittedAt: z.date()
});

// Admin schema
export const swedishAdminSchema = z.object({
  id: uuidSchema,
  email: z.string().email().endsWith('@vocilia.se'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['admin', 'super_admin', 'support']),
  permissions: z.array(z.enum([
    'users:read', 'users:write', 'stores:read', 'stores:write',
    'businesses:read', 'businesses:write', 'analytics:read', 'system:admin'
  ])).min(1).max(8),
  lastLoginAt: z.date().optional(),
  createdAt: z.date()
});

// Test Suite schemas (from data-model.md)
export const testSuiteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  type: z.enum(['unit', 'integration', 'e2e', 'performance']),
  component: z.string().min(1).max(100),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  coverageTarget: z.number().min(0).max(100),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const testCaseSchema = z.object({
  id: z.string().min(1),
  suiteId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  type: z.enum(['contract', 'unit', 'integration', 'e2e', 'performance']),
  filePath: z.string().min(1).max(500),
  testFunction: z.string().min(1).max(200),
  tags: z.array(z.string()).max(20),
  timeout: z.number().int().min(1000).max(1800000), // 1s to 30min
  retries: z.number().int().min(0).max(5),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const testEnvironmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(['local', 'branch', 'preview', 'staging']),
  config: z.object({
    databaseUrl: z.string().url(),
    apiBaseUrl: z.string().url(),
    frontendUrl: z.string().url(),
    authConfig: z.record(z.any())
  }),
  browserConfig: z.object({
    browsers: z.array(z.enum(['chrome', 'firefox', 'safari'])),
    viewport: z.object({
      width: z.number().int().min(320).max(3840),
      height: z.number().int().min(240).max(2160)
    }),
    headless: z.boolean()
  }).optional(),
  performanceConfig: z.object({
    maxConcurrentUsers: z.number().int().min(1).max(10000),
    testDuration: z.number().int().min(1).max(7200), // 1s to 2h
    thresholds: z.record(z.number())
  }).optional(),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const testRunSchema = z.object({
  id: z.string().min(1),
  triggerType: z.enum(['commit', 'pull-request', 'scheduled', 'manual']),
  triggerReference: z.string().min(1).max(200),
  branch: z.string().min(1).max(100),
  environmentId: z.string().min(1),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'cancelled']),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  duration: z.number().int().min(0).optional(),
  coverage: z.object({
    overall: z.number().min(0).max(100),
    unit: z.number().min(0).max(100),
    integration: z.number().min(0).max(100)
  }).optional(),
  performanceMetrics: z.object({
    apiResponseTime: z.number().min(0),
    pageLoadTime: z.number().min(0),
    errorRate: z.number().min(0).max(100)
  }).optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date()
});

export const testResultSchema = z.object({
  id: z.string().min(1),
  testRunId: z.string().min(1),
  testCaseId: z.string().min(1),
  status: z.enum(['passed', 'failed', 'skipped', 'timeout', 'error']),
  duration: z.number().int().min(0),
  errorMessage: z.string().max(5000).optional(),
  stackTrace: z.string().max(10000).optional(),
  screenshots: z.array(z.string().url()).max(10),
  logs: z.string().max(50000).optional(),
  assertions: z.object({
    total: z.number().int().min(0),
    passed: z.number().int().min(0),
    failed: z.number().int().min(0)
  }).optional(),
  coverage: z.record(z.number()).optional(),
  performanceData: z.record(z.any()).optional(),
  retryAttempt: z.number().int().min(0).max(5),
  createdAt: z.date()
});

export const testDataSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  category: z.enum(['users', 'stores', 'transactions', 'feedback', 'admin']),
  schema: z.record(z.any()),
  generatorConfig: z.object({
    locale: z.string().min(2).max(10),
    seed: z.number().int().optional(),
    rules: z.record(z.any())
  }),
  sampleSize: z.number().int().min(1).max(100000),
  refreshStrategy: z.enum(['static', 'per-run', 'per-test']),
  constraints: z.record(z.any()).optional(),
  tags: z.array(z.string()).max(20),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const testDataRecordSchema = z.object({
  id: z.string().min(1),
  dataSetId: z.string().min(1),
  data: z.record(z.any()),
  checksum: z.string().min(32).max(64), // MD5 or SHA256
  generatedAt: z.date(),
  lastUsed: z.date().optional()
});

export const performanceBenchmarkSchema = z.object({
  id: z.string().min(1),
  operation: z.string().min(1).max(200),
  component: z.string().min(1).max(100),
  metric: z.enum(['response-time', 'page-load', 'throughput', 'error-rate']),
  target: z.number().min(0),
  unit: z.string().min(1).max(20),
  threshold: z.object({
    warning: z.number().min(0),
    critical: z.number().min(0)
  }),
  environment: z.string().min(1).max(100),
  enabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const performanceResultSchema = z.object({
  id: z.string().min(1),
  testRunId: z.string().min(1),
  benchmarkId: z.string().min(1),
  value: z.number().min(0),
  status: z.enum(['pass', 'warning', 'fail']),
  measurements: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
    avg: z.number().min(0),
    p95: z.number().min(0),
    p99: z.number().min(0)
  }),
  conditions: z.object({
    concurrentUsers: z.number().int().min(1),
    duration: z.number().int().min(1),
    iterations: z.number().int().min(1)
  }),
  metadata: z.record(z.any()).optional(),
  measuredAt: z.date()
});

export const testReportSchema = z.object({
  id: z.string().min(1),
  testRunId: z.string().min(1),
  reportType: z.enum(['summary', 'detailed', 'coverage', 'performance']),
  period: z.object({
    startDate: z.date(),
    endDate: z.date()
  }).optional(),
  metrics: z.object({
    totalTests: z.number().int().min(0),
    passRate: z.number().min(0).max(100),
    coverage: z.number().min(0).max(100),
    performance: z.record(z.any())
  }),
  trends: z.record(z.any()).optional(),
  recommendations: z.array(z.string()).max(50),
  format: z.enum(['json', 'html', 'pdf']),
  url: z.string().url().optional(),
  generatedAt: z.date()
});

// Validation helper functions
export class TestDataValidator {
  static validateSwedishCustomer(data: any) {
    return swedishCustomerSchema.safeParse(data);
  }

  static validateSwedishBusiness(data: any) {
    return swedishBusinessSchema.safeParse(data);
  }

  static validateSwedishStore(data: any) {
    return swedishStoreSchema.safeParse(data);
  }

  static validateSwedishFeedback(data: any) {
    return swedishFeedbackSchema.safeParse(data);
  }

  static validateSwedishAdmin(data: any) {
    return swedishAdminSchema.safeParse(data);
  }

  static validateTestSuite(data: any) {
    return testSuiteSchema.safeParse(data);
  }

  static validateTestCase(data: any) {
    return testCaseSchema.safeParse(data);
  }

  static validateTestEnvironment(data: any) {
    return testEnvironmentSchema.safeParse(data);
  }

  static validateTestRun(data: any) {
    return testRunSchema.safeParse(data);
  }

  static validateTestResult(data: any) {
    return testResultSchema.safeParse(data);
  }

  static validateTestDataSet(data: any) {
    return testDataSetSchema.safeParse(data);
  }

  static validateTestDataRecord(data: any) {
    return testDataRecordSchema.safeParse(data);
  }

  static validatePerformanceBenchmark(data: any) {
    return performanceBenchmarkSchema.safeParse(data);
  }

  static validatePerformanceResult(data: any) {
    return performanceResultSchema.safeParse(data);
  }

  static validateTestReport(data: any) {
    return testReportSchema.safeParse(data);
  }

  /**
   * Validate an array of data against a schema
   */
  static validateArray<T>(data: any[], validator: (item: any) => { success: boolean; error?: any; data?: T }): {
    success: boolean;
    errors: Array<{ index: number; error: any }>;
    validData: T[];
  } {
    const errors: Array<{ index: number; error: any }> = [];
    const validData: T[] = [];

    data.forEach((item, index) => {
      const result = validator(item);
      if (result.success && result.data) {
        validData.push(result.data);
      } else {
        errors.push({ index, error: result.error });
      }
    });

    return {
      success: errors.length === 0,
      errors,
      validData
    };
  }

  /**
   * Get human-readable error messages from Zod validation errors
   */
  static getErrorMessages(zodError: any): string[] {
    if (!zodError?.issues) return ['Unknown validation error'];
    
    return zodError.issues.map((issue: any) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    });
  }
}

// Type exports for use in tests
export type SwedishCustomer = z.infer<typeof swedishCustomerSchema>;
export type SwedishBusiness = z.infer<typeof swedishBusinessSchema>;
export type SwedishStore = z.infer<typeof swedishStoreSchema>;
export type SwedishFeedback = z.infer<typeof swedishFeedbackSchema>;
export type SwedishAdmin = z.infer<typeof swedishAdminSchema>;
export type SwedishAddress = z.infer<typeof swedishAddressSchema>;
export type TestSuite = z.infer<typeof testSuiteSchema>;
export type TestCase = z.infer<typeof testCaseSchema>;
export type TestEnvironment = z.infer<typeof testEnvironmentSchema>;
export type TestRun = z.infer<typeof testRunSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type TestDataSet = z.infer<typeof testDataSetSchema>;
export type TestDataRecord = z.infer<typeof testDataRecordSchema>;
export type PerformanceBenchmark = z.infer<typeof performanceBenchmarkSchema>;
export type PerformanceResult = z.infer<typeof performanceResultSchema>;
export type TestReport = z.infer<typeof testReportSchema>;