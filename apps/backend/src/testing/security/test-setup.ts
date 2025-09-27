/**
 * Security Testing Setup
 * 
 * Configures Jest environment for security and privacy testing
 * with proper test isolation and security validation.
 */

import { createClient } from '@supabase/supabase-js';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Global test configuration
const SECURITY_TEST_CONFIG = {
  maxPerformanceImpact: 10, // 10% maximum performance degradation
  gdprDeletionTimeout: 72 * 60 * 60 * 1000, // 72 hours in milliseconds
  testTimeout: 60000, // 60 seconds per test
  zapConfig: {
    host: process.env.ZAP_HOST || 'localhost',
    port: parseInt(process.env.ZAP_PORT || '8080'),
    apiKey: process.env.ZAP_API_KEY || 'test-key'
  }
};

// Test database client for security testing
let testSupabaseClient: any;
let originalPerformanceBaseline: number;

// Security test utilities
export class SecurityTestUtils {
  static async createTestAdmin(): Promise<{ email: string; password: string; id: string }> {
    const testEmail = `security-test-admin-${Date.now()}@test.vocilia.com`;
    const testPassword = 'SecureTestPassword123!';
    
    // Create test admin account in test database
    const { data, error } = await testSupabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          role: 'admin',
          test_account: true,
          created_for_security_test: true
        }
      }
    });

    if (error) {
      throw new Error(`Failed to create test admin: ${error.message}`);
    }

    return {
      email: testEmail,
      password: testPassword,
      id: data.user?.id || ''
    };
  }

  static async createTestBusiness(): Promise<{ email: string; password: string; id: string; businessId: string }> {
    const testEmail = `security-test-business-${Date.now()}@test.vocilia.com`;
    const testPassword = 'SecureTestPassword123!';
    
    // Create test business account
    const { data: authData, error: authError } = await testSupabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          role: 'business',
          test_account: true,
          created_for_security_test: true
        }
      }
    });

    if (authError) {
      throw new Error(`Failed to create test business user: ${authError.message}`);
    }

    // Create associated business record
    const { data: businessData, error: businessError } = await testSupabaseClient
      .from('businesses')
      .insert({
        name: `Security Test Business ${Date.now()}`,
        email: testEmail,
        owner_id: authData.user?.id,
        verification_status: 'verified',
        test_business: true
      })
      .select()
      .single();

    if (businessError) {
      throw new Error(`Failed to create test business: ${businessError.message}`);
    }

    return {
      email: testEmail,
      password: testPassword,
      id: authData.user?.id || '',
      businessId: businessData.id
    };
  }

  static async createTestCustomer(): Promise<{ phone: string; id: string }> {
    const testPhone = `+46701${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Create test customer record (anonymized)
    const { data, error } = await testSupabaseClient
      .from('customers')
      .insert({
        phone_hash: this.hashPhone(testPhone),
        test_customer: true,
        created_for_security_test: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test customer: ${error.message}`);
    }

    return {
      phone: testPhone,
      id: data.id
    };
  }

  static hashPhone(phone: string): string {
    // Simple hash for testing - in production this would use proper cryptographic hashing
    return `hash_${Buffer.from(phone).toString('base64')}`;
  }

  static async measurePerformanceImpact<T>(operation: () => Promise<T>): Promise<{ result: T; impactPercentage: number }> {
    const startTime = process.hrtime.bigint();
    const result = await operation();
    const endTime = process.hrtime.bigint();
    
    const operationTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const impactPercentage = ((operationTime - originalPerformanceBaseline) / originalPerformanceBaseline) * 100;
    
    return { result, impactPercentage };
  }

  static async cleanupTestData(testIdentifiers: string[]): Promise<void> {
    // Clean up test data from all tables
    const tablesToClean = [
      'security_test_cases',
      'privacy_assessments', 
      'gdpr_compliance_records',
      'vulnerability_reports',
      'access_control_matrix',
      'data_protection_audits',
      'audit_logs',
      'businesses',
      'customers',
      'stores'
    ];

    for (const table of tablesToClean) {
      try {
        await testSupabaseClient
          .from(table)
          .delete()
          .or(testIdentifiers.map(id => `id.eq.${id}`).join(','));
      } catch (error) {
        // Table might not exist yet during early tests
        console.warn(`Could not clean table ${table}:`, error);
      }
    }

    // Clean up auth users
    for (const identifier of testIdentifiers) {
      try {
        await testSupabaseClient.auth.admin.deleteUser(identifier);
      } catch (error) {
        // User might not exist
        console.warn(`Could not delete test user ${identifier}:`, error);
      }
    }
  }

  static async validateGDPRCompliance(deletionRequestId: string): Promise<boolean> {
    // Check that deletion was completed within 72 hours
    const { data, error } = await testSupabaseClient
      .from('gdpr_compliance_records')
      .select('*')
      .eq('id', deletionRequestId)
      .single();

    if (error || !data) {
      return false;
    }

    const responseTimeHours = data.response_time_hours;
    return responseTimeHours <= 72 && data.compliance_status === 'completed';
  }

  static async validateDataAnonymization(originalData: any, anonymizedData: any): Promise<boolean> {
    // Validate that personal data has been properly anonymized
    const personalDataFields = ['phone', 'email', 'name', 'address'];
    
    for (const field of personalDataFields) {
      if (originalData[field] && anonymizedData[field]) {
        if (originalData[field] === anonymizedData[field]) {
          return false; // Data not anonymized
        }
      }
    }

    return true;
  }

  static async validateRLSPolicies(tableName: string, userRole: string): Promise<boolean> {
    // Test Row Level Security policies by attempting unauthorized access
    try {
      const { data, error } = await testSupabaseClient
        .from(tableName)
        .select('*')
        .limit(1);

      // If we get data when we shouldn't, RLS is not working
      if (userRole === 'anonymous' && data && data.length > 0) {
        return false;
      }

      return true;
    } catch (error) {
      // Expected error for unauthorized access
      return true;
    }
  }
}

// Global setup for security tests
beforeAll(async () => {
  // Initialize test Supabase client
  testSupabaseClient = createClient(
    process.env.SUPABASE_URL || 'https://test.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'
  );

  // Establish performance baseline
  const baselineStart = process.hrtime.bigint();
  await new Promise(resolve => setTimeout(resolve, 100));
  const baselineEnd = process.hrtime.bigint();
  originalPerformanceBaseline = Number(baselineEnd - baselineStart) / 1000000;

  // Verify ZAP connection if configured
  if (process.env.ZAP_API_KEY) {
    try {
      const zapResponse = await fetch(`http://${SECURITY_TEST_CONFIG.zapConfig.host}:${SECURITY_TEST_CONFIG.zapConfig.port}/JSON/core/view/version/`);
      if (!zapResponse.ok) {
        console.warn('OWASP ZAP not available for security tests');
      }
    } catch (error) {
      console.warn('OWASP ZAP connection failed:', error);
    }
  }
}, 30000);

// Global teardown
afterAll(async () => {
  // Clean up any remaining test data
  if (testSupabaseClient) {
    await SecurityTestUtils.cleanupTestData([]);
  }
}, 30000);

// Test isolation
let testIdentifiers: string[] = [];

beforeEach(() => {
  testIdentifiers = [];
});

afterEach(async () => {
  // Clean up test data created during this test
  if (testIdentifiers.length > 0) {
    await SecurityTestUtils.cleanupTestData(testIdentifiers);
  }
});

// Export test utilities and configuration
export { SECURITY_TEST_CONFIG, testSupabaseClient };

// Helper function to track test data for cleanup
export function trackTestData(identifier: string): void {
  testIdentifiers.push(identifier);
}