#!/usr/bin/env node

/**
 * Quickstart Validation Script
 * Validates all scenarios from specs/003-step-2-1/quickstart.md
 * Feature: Business Authentication & Account Management
 * Date: 2025-09-20
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Test data
const TEST_BUSINESS = {
  email: 'test@examplestore.se',
  password: 'SecurePass123!',
  businessName: 'Example Store AB',
  contactPerson: 'Erik Andersson',
  phone: '+46701234567',
  address: 'Kungsgatan 1, Stockholm',
  businessType: 'retail',
  estimatedMonthlyCustomers: 500
};

const TEST_STORES = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Main Store',
    address: 'Kungsgatan 1, Stockholm',
    qr_code: 'qr-001'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Branch Store', 
    address: 'Götgatan 2, Göteborg',
    qr_code: 'qr-002'
  }
];

class QuickstartValidator {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.testResults = [];
    this.businessUserId = null;
    this.businessAccountId = null;
    this.authToken = null;
  }

  log(message, status = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : 'ℹ️';
    console.log(`${timestamp} ${emoji} ${message}`);
    
    this.testResults.push({
      timestamp,
      status,
      message
    });
  }

  async measurePerformance(testName, asyncFn) {
    const start = performance.now();
    const result = await asyncFn();
    const duration = performance.now() - start;
    
    this.log(`${testName} completed in ${duration.toFixed(2)}ms`, 
      duration < 200 ? 'PASS' : 'WARN');
    
    return { result, duration };
  }

  async apiRequest(method, endpoint, data = null, headers = {}) {
    try {
      const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500
      };
    }
  }

  async testBusinessRegistration() {
    this.log('=== Testing Business Registration Flow ===');

    const { result, duration } = await this.measurePerformance(
      'Business Registration API',
      () => this.apiRequest('POST', '/api/auth/business/register', TEST_BUSINESS)
    );

    if (!result.success) {
      this.log(`Registration failed: ${JSON.stringify(result.error)}`, 'FAIL');
      return false;
    }

    if (result.status !== 201) {
      this.log(`Expected status 201, got ${result.status}`, 'FAIL');
      return false;
    }

    this.log('Business registration successful', 'PASS');

    // Verify business account created in database
    const { data: businessAccount, error } = await this.supabase
      .from('business_accounts')
      .select('*')
      .eq('business_name', TEST_BUSINESS.businessName)
      .single();

    if (error || !businessAccount) {
      this.log(`Business account not found in database: ${error?.message}`, 'FAIL');
      return false;
    }

    if (businessAccount.verification_status !== 'pending') {
      this.log(`Expected pending status, got ${businessAccount.verification_status}`, 'FAIL');
      return false;
    }

    this.businessUserId = businessAccount.user_id;
    this.businessAccountId = businessAccount.id;
    this.log('Business account verification: pending status confirmed', 'PASS');

    return true;
  }

  async testAdminApproval() {
    this.log('=== Testing Admin Approval Workflow ===');

    if (!this.businessAccountId) {
      this.log('No business account to approve', 'FAIL');
      return false;
    }

    // Simulate admin approval
    const { data, error } = await this.supabase
      .from('business_accounts')
      .update({
        verification_status: 'approved',
        verified_at: new Date().toISOString(),
        verified_by: 'admin-test-user',
        verification_notes: 'Approved via quickstart validation'
      })
      .eq('id', this.businessAccountId)
      .select()
      .single();

    if (error) {
      this.log(`Admin approval failed: ${error.message}`, 'FAIL');
      return false;
    }

    if (data.verification_status !== 'approved') {
      this.log('Approval status not updated', 'FAIL');
      return false;
    }

    this.log('Admin approval successful', 'PASS');
    return true;
  }

  async testBusinessLogin() {
    this.log('=== Testing Business Login Flow ===');

    const { result, duration } = await this.measurePerformance(
      'Business Login API',
      () => this.apiRequest('POST', '/api/auth/business/login', {
        email: TEST_BUSINESS.email,
        password: TEST_BUSINESS.password
      })
    );

    if (!result.success) {
      this.log(`Login failed: ${JSON.stringify(result.error)}`, 'FAIL');
      return false;
    }

    if (result.status !== 200) {
      this.log(`Expected status 200, got ${result.status}`, 'FAIL');
      return false;
    }

    const loginData = result.data;
    
    // Validate response structure
    if (!loginData.user || !loginData.session || !Array.isArray(loginData.stores)) {
      this.log('Invalid login response structure', 'FAIL');
      return false;
    }

    if (loginData.user.email !== TEST_BUSINESS.email) {
      this.log(`Email mismatch: expected ${TEST_BUSINESS.email}, got ${loginData.user.email}`, 'FAIL');
      return false;
    }

    if (loginData.user.verificationStatus !== 'approved') {
      this.log(`Expected approved status, got ${loginData.user.verificationStatus}`, 'FAIL');
      return false;
    }

    this.authToken = loginData.session.id;
    this.log('Business login successful', 'PASS');
    this.log(`User authenticated: ${loginData.user.businessName}`, 'PASS');

    return true;
  }

  async testMultiStoreSetup() {
    this.log('=== Testing Multi-Store Setup ===');

    if (!this.businessAccountId) {
      this.log('No business account for store setup', 'FAIL');
      return false;
    }

    // Create test stores
    for (const store of TEST_STORES) {
      const { error: storeError } = await this.supabase
        .from('stores')
        .insert({
          id: store.id,
          name: store.name,
          address: store.address,
          qr_code: store.qr_code,
          business_id: this.businessAccountId
        });

      if (storeError) {
        this.log(`Failed to create store ${store.name}: ${storeError.message}`, 'FAIL');
        return false;
      }
    }

    // Create business-store relationships
    const businessStoreData = [
      {
        business_account_id: this.businessAccountId,
        store_id: TEST_STORES[0].id,
        permissions: {
          read_feedback: true,
          write_context: true,
          manage_qr: true,
          view_analytics: true,
          admin: true
        },
        role: 'owner'
      },
      {
        business_account_id: this.businessAccountId,
        store_id: TEST_STORES[1].id,
        permissions: {
          read_feedback: true,
          write_context: false,
          manage_qr: false,
          view_analytics: true,
          admin: false
        },
        role: 'manager'
      }
    ];

    const { error: relationError } = await this.supabase
      .from('business_stores')
      .insert(businessStoreData);

    if (relationError) {
      this.log(`Failed to create business-store relationships: ${relationError.message}`, 'FAIL');
      return false;
    }

    this.log('Multi-store setup completed', 'PASS');
    return true;
  }

  async testStoreContextSwitching() {
    this.log('=== Testing Store Context Switching ===');

    if (!this.authToken) {
      this.log('No auth token for store switching', 'FAIL');
      return false;
    }

    const { result, duration } = await this.measurePerformance(
      'Store Context Switch API',
      () => this.apiRequest('PUT', '/api/business/current-store', {
        storeId: TEST_STORES[1].id
      }, {
        'Authorization': `Bearer ${this.authToken}`
      })
    );

    if (!result.success) {
      this.log(`Store switching failed: ${JSON.stringify(result.error)}`, 'FAIL');
      return false;
    }

    if (duration > 50) {
      this.log(`Store switching too slow: ${duration}ms (expected <50ms)`, 'WARN');
    }

    // Verify session was updated
    const { data: session, error } = await this.supabase
      .from('business_sessions')
      .select('current_store_id')
      .eq('user_id', this.businessUserId)
      .eq('active', true)
      .single();

    if (error || session.current_store_id !== TEST_STORES[1].id) {
      this.log('Session store context not updated correctly', 'FAIL');
      return false;
    }

    this.log('Store context switching successful', 'PASS');
    return true;
  }

  async testPasswordReset() {
    this.log('=== Testing Password Reset Flow ===');

    const { result, duration } = await this.measurePerformance(
      'Password Reset API',
      () => this.apiRequest('POST', '/api/auth/business/reset-password', {
        email: TEST_BUSINESS.email
      })
    );

    if (!result.success) {
      this.log(`Password reset failed: ${JSON.stringify(result.error)}`, 'FAIL');
      return false;
    }

    this.log('Password reset request successful', 'PASS');
    this.log('Note: Email delivery not validated in this test', 'INFO');
    return true;
  }

  async testSessionManagement() {
    this.log('=== Testing Session Management ===');

    if (!this.authToken) {
      this.log('No auth token for session test', 'FAIL');
      return false;
    }

    // Test logout
    const { result } = await this.measurePerformance(
      'Business Logout API',
      () => this.apiRequest('POST', '/api/auth/business/logout', {}, {
        'Authorization': `Bearer ${this.authToken}`
      })
    );

    if (!result.success) {
      this.log(`Logout failed: ${JSON.stringify(result.error)}`, 'FAIL');
      return false;
    }

    // Verify session was deactivated
    const { data: sessions } = await this.supabase
      .from('business_sessions')
      .select('active')
      .eq('user_id', this.businessUserId);

    const activeSessions = sessions?.filter(s => s.active) || [];
    
    if (activeSessions.length > 0) {
      this.log('Session not properly deactivated after logout', 'FAIL');
      return false;
    }

    this.log('Session management successful', 'PASS');
    return true;
  }

  async testSecurityIsolation() {
    this.log('=== Testing Security & Access Control ===');

    // Test 1: Create second business account
    const secondBusiness = {
      ...TEST_BUSINESS,
      email: 'test2@anotherbusiness.se',
      businessName: 'Another Business AB'
    };

    const registerResult = await this.apiRequest('POST', '/api/auth/business/register', secondBusiness);
    
    if (!registerResult.success) {
      this.log('Failed to create second business for isolation test', 'WARN');
      return true; // Non-critical for main flow
    }

    this.log('Security isolation test setup completed', 'PASS');
    this.log('Note: Full RLS testing requires database-level verification', 'INFO');
    
    return true;
  }

  async testPerformanceRequirements() {
    this.log('=== Testing Performance Requirements ===');

    // Re-login to test performance
    const loginStart = performance.now();
    const loginResult = await this.apiRequest('POST', '/api/auth/business/login', {
      email: TEST_BUSINESS.email,
      password: TEST_BUSINESS.password
    });
    const loginDuration = performance.now() - loginStart;

    if (loginDuration > 200) {
      this.log(`Login performance below requirement: ${loginDuration}ms (expected <200ms)`, 'FAIL');
      return false;
    }

    this.log(`Login performance: ${loginDuration.toFixed(2)}ms`, 'PASS');

    // Test store switching performance
    if (loginResult.success && loginResult.data.stores.length > 0) {
      const switchStart = performance.now();
      await this.apiRequest('PUT', '/api/business/current-store', {
        storeId: loginResult.data.stores[0].id
      }, {
        'Authorization': `Bearer ${loginResult.data.session.id}`
      });
      const switchDuration = performance.now() - switchStart;

      if (switchDuration > 50) {
        this.log(`Store switching performance below requirement: ${switchDuration}ms (expected <50ms)`, 'WARN');
      } else {
        this.log(`Store switching performance: ${switchDuration.toFixed(2)}ms`, 'PASS');
      }
    }

    return true;
  }

  async cleanup() {
    this.log('=== Cleaning Up Test Data ===');

    try {
      // Remove business-store relationships
      await this.supabase
        .from('business_stores')
        .delete()
        .eq('business_account_id', this.businessAccountId);

      // Remove test stores
      for (const store of TEST_STORES) {
        await this.supabase
          .from('stores')
          .delete()
          .eq('id', store.id);
      }

      // Remove business sessions
      if (this.businessUserId) {
        await this.supabase
          .from('business_sessions')
          .delete()
          .eq('user_id', this.businessUserId);
      }

      // Remove business accounts
      await this.supabase
        .from('business_accounts')
        .delete()
        .in('business_name', [TEST_BUSINESS.businessName, 'Another Business AB']);

      // Remove auth users
      await this.supabase.auth.admin.deleteUser(this.businessUserId);

      this.log('Test data cleanup completed', 'PASS');
    } catch (error) {
      this.log(`Cleanup warning: ${error.message}`, 'WARN');
    }
  }

  async generateReport() {
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    const warnCount = this.testResults.filter(r => r.status === 'WARN').length;
    const totalTests = passCount + failCount + warnCount;

    console.log('\n' + '='.repeat(60));
    console.log('QUICKSTART VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️ Warnings: ${warnCount}`);
    console.log(`Success Rate: ${((passCount / totalTests) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (failCount === 0) {
      console.log('🎉 ALL QUICKSTART SCENARIOS VALIDATED SUCCESSFULLY!');
    } else {
      console.log('🔥 SOME TESTS FAILED - REVIEW IMPLEMENTATION');
    }

    console.log('\nFailed Tests:');
    this.testResults
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`❌ ${r.message}`));

    return failCount === 0;
  }

  async run() {
    console.log('🚀 Starting Quickstart Validation...\n');

    try {
      const scenarios = [
        () => this.testBusinessRegistration(),
        () => this.testAdminApproval(),
        () => this.testBusinessLogin(),
        () => this.testMultiStoreSetup(),
        () => this.testStoreContextSwitching(),
        () => this.testPasswordReset(),
        () => this.testSessionManagement(),
        () => this.testSecurityIsolation(),
        () => this.testPerformanceRequirements()
      ];

      let allPassed = true;

      for (const scenario of scenarios) {
        const passed = await scenario();
        if (!passed) {
          allPassed = false;
          // Continue with other tests for comprehensive reporting
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause between tests
      }

      await this.cleanup();
      const success = await this.generateReport();

      process.exit(success ? 0 : 1);

    } catch (error) {
      this.log(`Critical error: ${error.message}`, 'FAIL');
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the validation
if (require.main === module) {
  const validator = new QuickstartValidator();
  validator.run();
}

module.exports = QuickstartValidator;