import { z } from 'zod';

// Access Control Matrix - Role-based permission testing entity
export const AccessControlMatrixSchema = z.object({
  matrix_id: z.string().uuid(),
  test_name: z.string().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  
  // Role definitions and resource mappings
  user_roles: z.array(z.object({
    role_name: z.enum(['customer', 'business', 'admin', 'super_admin']),
    role_id: z.string(),
    permissions: z.array(z.string()),
    expected_access_level: z.enum(['none', 'read', 'write', 'admin', 'full'])
  })),
  
  system_resources: z.array(z.object({
    resource_type: z.enum(['api_endpoint', 'database_table', 'file_system', 'admin_dashboard']),
    resource_name: z.string(),
    resource_path: z.string(),
    security_level: z.enum(['public', 'authenticated', 'business_only', 'admin_only'])
  })),
  
  // Permission testing results
  authorization_tests: z.array(z.object({
    test_id: z.string().uuid(),
    role_name: z.string(),
    resource_path: z.string(),
    attempted_action: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    expected_result: z.enum(['allow', 'deny']),
    actual_result: z.enum(['allow', 'deny', 'error']),
    test_passed: z.boolean(),
    error_message: z.string().optional(),
    response_time_ms: z.number().min(0),
    tested_at: z.string().datetime()
  })),
  
  // Business data isolation validation
  data_isolation_tests: z.array(z.object({
    business_id: z.string().uuid(),
    tested_role: z.string(),
    cross_business_access_attempted: z.boolean(),
    isolation_maintained: z.boolean(),
    leaked_data_types: z.array(z.enum(['phone_numbers', 'feedback_content', 'transaction_details', 'store_data']))
  })),
  
  // Constitutional compliance validation
  constitutional_compliance: z.object({
    phone_number_protection: z.enum(['compliant', 'violation', 'not_tested']),
    business_data_isolation: z.enum(['compliant', 'violation', 'not_tested']),
    admin_privilege_boundaries: z.enum(['compliant', 'violation', 'not_tested']),
    rls_policy_enforcement: z.enum(['compliant', 'violation', 'not_tested'])
  }),
  
  // Performance validation
  performance_impact: z.object({
    authorization_check_avg_ms: z.number().min(0),
    rls_query_overhead_percent: z.number().min(0),
    session_validation_time_ms: z.number().min(0),
    total_overhead_percent: z.number().min(0).max(10), // Constitutional limit
    performance_compliant: z.boolean()
  }),
  
  // Test execution metadata
  test_status: z.enum(['pending', 'running', 'completed', 'failed']),
  total_tests: z.number().min(0),
  passed_tests: z.number().min(0),
  failed_tests: z.number().min(0),
  coverage_percentage: z.number().min(0).max(100),
  
  // Security findings
  security_violations: z.array(z.object({
    violation_type: z.enum(['unauthorized_access', 'privilege_escalation', 'data_leakage', 'session_hijacking']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    affected_resources: z.array(z.string()),
    description: z.string(),
    remediation_required: z.boolean()
  }))
});

export type AccessControlMatrix = z.infer<typeof AccessControlMatrixSchema>;

export class AccessControlMatrixModel {
  private static readonly MAX_PERFORMANCE_OVERHEAD = 10; // Constitutional limit: ≤10%
  
  static validateConstitutionalCompliance(matrix: AccessControlMatrix): boolean {
    // Validate phone number protection
    if (matrix.constitutional_compliance.phone_number_protection === 'violation') {
      throw new Error('Constitutional violation: Phone number protection failure detected');
    }
    
    // Validate business data isolation
    if (matrix.constitutional_compliance.business_data_isolation === 'violation') {
      throw new Error('Constitutional violation: Business data isolation breach detected');
    }
    
    // Validate admin privilege boundaries
    if (matrix.constitutional_compliance.admin_privilege_boundaries === 'violation') {
      throw new Error('Constitutional violation: Admin privilege boundary violation detected');
    }
    
    // Validate RLS policy enforcement
    if (matrix.constitutional_compliance.rls_policy_enforcement === 'violation') {
      throw new Error('Constitutional violation: Row Level Security policy bypass detected');
    }
    
    return true;
  }
  
  static validatePerformanceCompliance(matrix: AccessControlMatrix): boolean {
    if (matrix.performance_impact.total_overhead_percent > this.MAX_PERFORMANCE_OVERHEAD) {
      throw new Error(`Constitutional violation: Authorization overhead ${matrix.performance_impact.total_overhead_percent}% exceeds 10% limit`);
    }
    
    return true;
  }
  
  static validateBusinessDataIsolation(matrix: AccessControlMatrix): {
    isolated: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    
    // Check for cross-business access attempts
    matrix.data_isolation_tests.forEach(test => {
      if (test.cross_business_access_attempted && !test.isolation_maintained) {
        violations.push(`Business ${test.business_id}: Isolation breach by ${test.tested_role}`);
      }
      
      // Check for leaked sensitive data
      if (test.leaked_data_types.length > 0) {
        violations.push(`Business ${test.business_id}: Data leakage - ${test.leaked_data_types.join(', ')}`);
      }
    });
    
    return {
      isolated: violations.length === 0,
      violations
    };
  }
  
  static calculateSecurityScore(matrix: AccessControlMatrix): {
    overall_score: number;
    authorization_score: number;
    isolation_score: number;
    performance_score: number;
    constitutional_compliance_score: number;
  } {
    // Authorization accuracy score
    const authTests = matrix.authorization_tests;
    const authScore = authTests.length > 0 
      ? (authTests.filter(t => t.test_passed).length / authTests.length) * 100 
      : 0;
    
    // Data isolation score
    const isolationTests = matrix.data_isolation_tests;
    const isolationScore = isolationTests.length > 0
      ? (isolationTests.filter(t => t.isolation_maintained).length / isolationTests.length) * 100
      : 0;
    
    // Performance score (inverse of overhead percentage)
    const perfScore = Math.max(0, 100 - (matrix.performance_impact.total_overhead_percent * 10));
    
    // Constitutional compliance score
    const complianceValues = Object.values(matrix.constitutional_compliance);
    const compliantCount = complianceValues.filter(v => v === 'compliant').length;
    const totalChecks = complianceValues.filter(v => v !== 'not_tested').length;
    const complianceScore = totalChecks > 0 ? (compliantCount / totalChecks) * 100 : 0;
    
    // Overall weighted score (constitutional compliance heavily weighted)
    const overallScore = (
      authScore * 0.25 + 
      isolationScore * 0.25 + 
      perfScore * 0.15 + 
      complianceScore * 0.35
    );
    
    return {
      overall_score: Math.round(overallScore),
      authorization_score: Math.round(authScore),
      isolation_score: Math.round(isolationScore),
      performance_score: Math.round(perfScore),
      constitutional_compliance_score: Math.round(complianceScore)
    };
  }
  
  static generateTestPlan(roles: string[], resources: string[]): Partial<AccessControlMatrix> {
    const testPlan: Partial<AccessControlMatrix> = {
      matrix_id: crypto.randomUUID(),
      test_name: `Access Control Test - ${new Date().toISOString()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      user_roles: roles.map(role => ({
        role_name: role as any,
        role_id: crypto.randomUUID(),
        permissions: this.getDefaultPermissions(role),
        expected_access_level: this.getExpectedAccessLevel(role)
      })),
      
      system_resources: resources.map(resource => ({
        resource_type: this.inferResourceType(resource),
        resource_name: resource,
        resource_path: resource,
        security_level: this.inferSecurityLevel(resource)
      })),
      
      test_status: 'pending',
      total_tests: roles.length * resources.length * 5, // 5 HTTP methods per combination
      passed_tests: 0,
      failed_tests: 0,
      coverage_percentage: 0
    };
    
    return testPlan;
  }
  
  private static getDefaultPermissions(role: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'customer': ['qr:scan', 'feedback:submit', 'profile:read'],
      'business': ['store:manage', 'feedback:read', 'reports:view'],
      'admin': ['users:manage', 'system:monitor', 'audit:read'],
      'super_admin': ['all:access', 'system:configure', 'security:manage']
    };
    
    return permissionMap[role] || [];
  }
  
  private static getExpectedAccessLevel(role: string): 'none' | 'read' | 'write' | 'admin' | 'full' {
    const accessMap: Record<string, 'none' | 'read' | 'write' | 'admin' | 'full'> = {
      'customer': 'read',
      'business': 'write',
      'admin': 'admin',
      'super_admin': 'full'
    };
    
    return accessMap[role] || 'none';
  }
  
  private static inferResourceType(resource: string): 'api_endpoint' | 'database_table' | 'file_system' | 'admin_dashboard' {
    if (resource.startsWith('/api/')) return 'api_endpoint';
    if (resource.startsWith('/admin/')) return 'admin_dashboard';
    if (resource.includes('table') || resource.includes('db')) return 'database_table';
    return 'file_system';
  }
  
  private static inferSecurityLevel(resource: string): 'public' | 'authenticated' | 'business_only' | 'admin_only' {
    if (resource.includes('admin')) return 'admin_only';
    if (resource.includes('business')) return 'business_only';
    if (resource.includes('auth') || resource.includes('secure')) return 'authenticated';
    return 'public';
  }
}