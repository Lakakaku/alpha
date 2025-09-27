/**
 * SecurityTestCase Model
 * 
 * @description Represents individual security testing scenarios with comprehensive validation criteria
 * @constitutional_requirement TypeScript strict mode, real data validation, performance limits
 * @performance_target ≤10% impact during test execution
 */

import { z } from 'zod';

// Security test categories aligned with constitutional requirements
export const SecurityTestCategorySchema = z.enum([
  'authentication',
  'authorization', 
  'privacy',
  'gdpr',
  'vulnerability',
  'fraud'
]);

export type SecurityTestCategory = z.infer<typeof SecurityTestCategorySchema>;

// Test execution frequency for automated security testing
export const ExecutionFrequencySchema = z.enum([
  'on_demand',
  'daily',
  'weekly',
  'monthly'
]);

export type ExecutionFrequency = z.infer<typeof ExecutionFrequencySchema>;

// Priority levels for security test execution
export const PriorityLevelSchema = z.enum([
  'critical',
  'high',
  'medium',
  'low'
]);

export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

// Test case status for lifecycle management
export const TestCaseStatusSchema = z.enum([
  'draft',
  'active',
  'maintenance',
  'deprecated'
]);

export type TestCaseStatus = z.infer<typeof TestCaseStatusSchema>;

// Main SecurityTestCase schema with constitutional compliance validation
export const SecurityTestCaseSchema = z.object({
  id: z.string().uuid('Test case ID must be valid UUID'),
  name: z.string()
    .min(1, 'Test case name is required')
    .max(200, 'Test case name must be ≤200 characters'),
  
  category: SecurityTestCategorySchema,
  
  attack_vector: z.string()
    .min(1, 'Attack vector description is required')
    .max(500, 'Attack vector must be ≤500 characters'),
  
  expected_defense: z.string()
    .min(1, 'Expected defense behavior is required')
    .max(500, 'Expected defense must be ≤500 characters'),
  
  pass_criteria: z.array(z.string().min(1))
    .min(1, 'At least one pass criterion is required')
    .max(10, 'Maximum 10 pass criteria allowed'),
  
  // Constitutional requirement: ≤10% performance impact
  performance_impact_limit: z.number()
    .min(0, 'Performance impact limit must be non-negative')
    .max(10, 'Performance impact must be ≤10% (constitutional requirement)'),
  
  execution_frequency: ExecutionFrequencySchema,
  priority: PriorityLevelSchema,
  status: TestCaseStatusSchema,
  
  // Timestamps for audit trail
  created_at: z.string().datetime('Created timestamp must be valid ISO 8601'),
  updated_at: z.string().datetime('Updated timestamp must be valid ISO 8601'),
  
  // Optional fields for enhanced test configuration
  timeout_seconds: z.number()
    .min(1, 'Timeout must be at least 1 second')
    .max(300, 'Timeout cannot exceed 5 minutes')
    .optional(),
  
  prerequisites: z.array(z.string()).optional(),
  
  // Constitutional compliance: Real data only - no mock flags
  target_environment: z.enum(['staging', 'production']).optional(),
  
  // Security test metadata
  owasp_category: z.string().optional(),
  cve_references: z.array(z.string()).optional(),
  
  // Business context for constitutional business data isolation
  store_specific: z.boolean().default(false),
  affects_customer_data: z.boolean().default(false),
  affects_payment_flow: z.boolean().default(false)
});

export type SecurityTestCase = z.infer<typeof SecurityTestCaseSchema>;

// Database entity with validation
export class SecurityTestCaseModel {
  private data: SecurityTestCase;

  constructor(data: unknown) {
    this.data = SecurityTestCaseSchema.parse(data);
  }

  // Getters with constitutional compliance validation
  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get category(): SecurityTestCategory {
    return this.data.category;
  }

  get attackVector(): string {
    return this.data.attack_vector;
  }

  get expectedDefense(): string {
    return this.data.expected_defense;
  }

  get passCriteria(): string[] {
    return [...this.data.pass_criteria]; // Defensive copy
  }

  get performanceImpactLimit(): number {
    return this.data.performance_impact_limit;
  }

  get executionFrequency(): ExecutionFrequency {
    return this.data.execution_frequency;
  }

  get priority(): PriorityLevel {
    return this.data.priority;
  }

  get status(): TestCaseStatus {
    return this.data.status;
  }

  get createdAt(): string {
    return this.data.created_at;
  }

  get updatedAt(): string {
    return this.data.updated_at;
  }

  // Constitutional compliance methods
  
  /**
   * Validates that performance impact meets constitutional ≤10% requirement
   */
  validatePerformanceCompliance(): boolean {
    return this.data.performance_impact_limit <= 10;
  }

  /**
   * Checks if test case affects customer data (constitutional protection)
   */
  affectsCustomerData(): boolean {
    return this.data.affects_customer_data || 
           this.data.category === 'privacy' || 
           this.data.category === 'gdpr';
  }

  /**
   * Checks if test case requires business data isolation
   */
  requiresDataIsolation(): boolean {
    return this.data.store_specific || 
           this.data.affects_customer_data ||
           this.data.category === 'authorization';
  }

  /**
   * Validates test case can run in production (constitutional: real data only)
   */
  canRunInProduction(): boolean {
    // All security tests should be able to run on real data
    return this.validatePerformanceCompliance() && 
           this.data.status === 'active';
  }

  /**
   * Gets test case execution priority score for scheduling
   */
  getExecutionPriorityScore(): number {
    const priorityScores = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25
    };

    const categoryBoosts = {
      gdpr: 20,        // Constitutional GDPR compliance
      privacy: 15,     // Constitutional privacy protection
      authentication: 10,
      authorization: 10,
      vulnerability: 5,
      fraud: 5
    };

    return priorityScores[this.data.priority] + 
           (categoryBoosts[this.data.category] || 0);
  }

  /**
   * Validates test case configuration for constitutional compliance
   */
  validateConstitutionalCompliance(): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Performance impact validation
    if (!this.validatePerformanceCompliance()) {
      violations.push('Performance impact exceeds 10% constitutional limit');
    }

    // Real data requirement - no mock environment flags
    if (this.data.target_environment && this.data.target_environment !== 'production' && this.data.target_environment !== 'staging') {
      violations.push('Invalid target environment - must use real staging or production');
    }

    // Required fields for security testing
    if (this.data.pass_criteria.length === 0) {
      violations.push('Pass criteria required for constitutional validation');
    }

    // Constitutional categories must have specific requirements
    if (this.data.category === 'gdpr' && !this.data.affects_customer_data) {
      violations.push('GDPR tests must affect customer data');
    }

    if (this.data.category === 'privacy' && !this.data.affects_customer_data) {
      violations.push('Privacy tests must affect customer data');
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Updates test case with new data, maintaining constitutional compliance
   */
  update(updates: Partial<SecurityTestCase>): SecurityTestCaseModel {
    const updatedData = {
      ...this.data,
      ...updates,
      updated_at: new Date().toISOString()
    };

    return new SecurityTestCaseModel(updatedData);
  }

  /**
   * Converts to database representation
   */
  toDatabase(): Record<string, unknown> {
    return {
      id: this.data.id,
      name: this.data.name,
      category: this.data.category,
      attack_vector: this.data.attack_vector,
      expected_defense: this.data.expected_defense,
      pass_criteria: JSON.stringify(this.data.pass_criteria),
      performance_impact_limit: this.data.performance_impact_limit,
      execution_frequency: this.data.execution_frequency,
      priority: this.data.priority,
      status: this.data.status,
      created_at: this.data.created_at,
      updated_at: this.data.updated_at,
      timeout_seconds: this.data.timeout_seconds,
      prerequisites: this.data.prerequisites ? JSON.stringify(this.data.prerequisites) : null,
      target_environment: this.data.target_environment,
      owasp_category: this.data.owasp_category,
      cve_references: this.data.cve_references ? JSON.stringify(this.data.cve_references) : null,
      store_specific: this.data.store_specific,
      affects_customer_data: this.data.affects_customer_data,
      affects_payment_flow: this.data.affects_payment_flow
    };
  }

  /**
   * Creates SecurityTestCase from database row
   */
  static fromDatabase(row: Record<string, unknown>): SecurityTestCaseModel {
    const data = {
      id: row.id,
      name: row.name,
      category: row.category,
      attack_vector: row.attack_vector,
      expected_defense: row.expected_defense,
      pass_criteria: row.pass_criteria ? JSON.parse(row.pass_criteria as string) : [],
      performance_impact_limit: row.performance_impact_limit,
      execution_frequency: row.execution_frequency,
      priority: row.priority,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      timeout_seconds: row.timeout_seconds,
      prerequisites: row.prerequisites ? JSON.parse(row.prerequisites as string) : undefined,
      target_environment: row.target_environment,
      owasp_category: row.owasp_category,
      cve_references: row.cve_references ? JSON.parse(row.cve_references as string) : undefined,
      store_specific: row.store_specific,
      affects_customer_data: row.affects_customer_data,
      affects_payment_flow: row.affects_payment_flow
    };

    return new SecurityTestCaseModel(data);
  }

  /**
   * Factory method for creating new test cases with constitutional compliance
   */
  static create(params: {
    name: string;
    category: SecurityTestCategory;
    attackVector: string;
    expectedDefense: string;
    passCriteria: string[];
    performanceImpactLimit?: number;
    executionFrequency?: ExecutionFrequency;
    priority?: PriorityLevel;
  }): SecurityTestCaseModel {
    const now = new Date().toISOString();
    
    const data: SecurityTestCase = {
      id: crypto.randomUUID(),
      name: params.name,
      category: params.category,
      attack_vector: params.attackVector,
      expected_defense: params.expectedDefense,
      pass_criteria: params.passCriteria,
      performance_impact_limit: params.performanceImpactLimit ?? 5, // Safe default under 10%
      execution_frequency: params.executionFrequency ?? 'weekly',
      priority: params.priority ?? 'medium',
      status: 'draft',
      created_at: now,
      updated_at: now,
      store_specific: false,
      affects_customer_data: params.category === 'privacy' || params.category === 'gdpr',
      affects_payment_flow: false
    };

    return new SecurityTestCaseModel(data);
  }
}

// Export for use in services and controllers
export { SecurityTestCaseModel as default };