#!/usr/bin/env node

/**
 * Load Testing Script
 * Tests 10 concurrent business users for authentication and dashboard access
 * Feature: Business Authentication & Account Management
 * Date: 2025-09-20
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const CONCURRENT_USERS = 10;
const TEST_DURATION_MINUTES = 2;

class LoadTester {
  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.testUsers = [];
    this.results = {
      registrations: [],
      logins: [],
      storeSwitches: [],
      dashboardLoads: [],
      errors: []
    };
    this.startTime = null;
    this.isRunning = false;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const emoji = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'SUCCESS' ? '✅' : 'ℹ️';
    console.log(`${timestamp} ${emoji} ${message}`);
  }

  generateTestUser(index) {
    return {
      id: index,
      email: `loadtest${index}@business${index}.se`,
      password: `LoadTest123!${index}`,
      businessName: `Load Test Business ${index}`,
      contactPerson: `Test User ${index}`,
      phone: `+4670123456${index.toString().padStart(2, '0')}`,
      address: `Test Address ${index}, Stockholm`,
      businessType: 'retail',
      estimatedMonthlyCustomers: 100 + (index * 50)
    };
  }

  async apiRequest(method, endpoint, data = null, headers = {}) {
    const start = performance.now();
    
    try {
      const config = {
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 5000 // 5 second timeout
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      const duration = performance.now() - start;
      
      return { 
        success: true, 
        data: response.data, 
        status: response.status,
        duration
      };
    } catch (error) {
      const duration = performance.now() - start;
      
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status || 500,
        duration
      };
    }
  }

  async simulateUserRegistration(user) {
    const result = await this.apiRequest('POST', '/api/auth/business/register', user);
    
    this.results.registrations.push({
      userId: user.id,
      success: result.success,
      duration: result.duration,
      timestamp: new Date()
    });

    if (!result.success) {
      this.results.errors.push({
        operation: 'registration',
        userId: user.id,
        error: result.error,
        timestamp: new Date()
      });
    }

    return result;
  }

  async simulateUserLogin(user) {
    const result = await this.apiRequest('POST', '/api/auth/business/login', {
      email: user.email,
      password: user.password
    });

    this.results.logins.push({
      userId: user.id,
      success: result.success,
      duration: result.duration,
      timestamp: new Date()
    });

    if (!result.success) {
      this.results.errors.push({
        operation: 'login',
        userId: user.id,
        error: result.error,
        timestamp: new Date()
      });
      return null;
    }

    return result.data;
  }

  async simulateStoreSwitch(user, authToken, storeId) {
    const result = await this.apiRequest('PUT', '/api/business/current-store', {
      storeId
    }, {
      'Authorization': `Bearer ${authToken}`
    });

    this.results.storeSwitches.push({
      userId: user.id,
      success: result.success,
      duration: result.duration,
      timestamp: new Date()
    });

    if (!result.success) {
      this.results.errors.push({
        operation: 'store_switch',
        userId: user.id,
        error: result.error,
        timestamp: new Date()
      });
    }

    return result;
  }

  async simulateDashboardLoad(user, authToken) {
    // Simulate multiple dashboard API calls
    const dashboardCalls = [
      () => this.apiRequest('GET', '/api/business/stores', null, {
        'Authorization': `Bearer ${authToken}`
      }),
      () => this.apiRequest('GET', '/api/business/profile', null, {
        'Authorization': `Bearer ${authToken}`
      })
    ];

    const start = performance.now();
    const results = await Promise.all(dashboardCalls.map(call => call()));
    const totalDuration = performance.now() - start;

    const allSuccessful = results.every(r => r.success);

    this.results.dashboardLoads.push({
      userId: user.id,
      success: allSuccessful,
      duration: totalDuration,
      timestamp: new Date()
    });

    if (!allSuccessful) {
      this.results.errors.push({
        operation: 'dashboard_load',
        userId: user.id,
        error: 'Some dashboard calls failed',
        timestamp: new Date()
      });
    }

    return totalDuration;
  }

  async setupTestData() {
    this.log('Setting up test users and data...');

    // Generate test users
    for (let i = 1; i <= CONCURRENT_USERS; i++) {
      this.testUsers.push(this.generateTestUser(i));
    }

    // Pre-approve all test users for login testing
    for (const user of this.testUsers) {
      try {
        // Register user
        await this.simulateUserRegistration(user);
        
        // Find and approve the business account
        const { data: businessAccount } = await this.supabase
          .from('business_accounts')
          .select('id, user_id')
          .eq('business_name', user.businessName)
          .single();

        if (businessAccount) {
          await this.supabase
            .from('business_accounts')
            .update({
              verification_status: 'approved',
              verified_at: new Date().toISOString(),
              verified_by: 'load-test-setup'
            })
            .eq('id', businessAccount.id);

          // Create a test store for each business
          const storeId = `store-${user.id}-${Date.now()}`;
          await this.supabase
            .from('stores')
            .insert({
              id: storeId,
              name: `Test Store ${user.id}`,
              address: `Store Address ${user.id}`,
              qr_code: `qr-${user.id}`,
              business_id: businessAccount.id
            });

          // Create business-store relationship
          await this.supabase
            .from('business_stores')
            .insert({
              business_account_id: businessAccount.id,
              store_id: storeId,
              permissions: {
                read_feedback: true,
                write_context: true,
                manage_qr: true,
                view_analytics: true,
                admin: true
              },
              role: 'owner'
            });

          user.storeId = storeId;
          user.businessAccountId = businessAccount.id;
          user.userId = businessAccount.user_id;
        }
      } catch (error) {
        this.log(`Failed to setup user ${user.id}: ${error.message}`, 'WARN');
      }
    }

    this.log(`Test data setup completed for ${this.testUsers.length} users`);
  }

  async simulateUserSession(user) {
    try {
      // Login
      const loginData = await this.simulateUserLogin(user);
      if (!loginData) return;

      const authToken = loginData.session.id;

      // Simulate continuous activity for test duration
      const endTime = Date.now() + (TEST_DURATION_MINUTES * 60 * 1000);
      
      while (Date.now() < endTime && this.isRunning) {
        // Store switching
        if (user.storeId) {
          await this.simulateStoreSwitch(user, authToken, user.storeId);
        }

        // Dashboard loads
        await this.simulateDashboardLoad(user, authToken);

        // Wait before next cycle
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      }

      // Logout
      await this.apiRequest('POST', '/api/auth/business/logout', {}, {
        'Authorization': `Bearer ${authToken}`
      });

    } catch (error) {
      this.results.errors.push({
        operation: 'user_session',
        userId: user.id,
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  async runLoadTest() {
    this.log(`Starting load test with ${CONCURRENT_USERS} concurrent users for ${TEST_DURATION_MINUTES} minutes...`);
    
    this.startTime = Date.now();
    this.isRunning = true;

    // Start all user sessions concurrently
    const userPromises = this.testUsers.map(user => this.simulateUserSession(user));

    // Wait for all sessions to complete or timeout
    await Promise.allSettled(userPromises);

    this.isRunning = false;
    const totalDuration = (Date.now() - this.startTime) / 1000;
    
    this.log(`Load test completed in ${totalDuration.toFixed(1)} seconds`);
  }

  calculateStats(results, operation) {
    if (results.length === 0) return null;

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const durations = successful.map(r => r.duration);

    return {
      operation,
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: ((successful.length / results.length) * 100).toFixed(1),
      avgDuration: durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations).toFixed(2) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations).toFixed(2) : 0,
      p95Duration: durations.length > 0 ? this.percentile(durations, 95).toFixed(2) : 0
    };
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('LOAD TEST REPORT');
    console.log('='.repeat(80));

    const stats = [
      this.calculateStats(this.results.registrations, 'Registration'),
      this.calculateStats(this.results.logins, 'Login'),
      this.calculateStats(this.results.storeSwitches, 'Store Switch'),
      this.calculateStats(this.results.dashboardLoads, 'Dashboard Load')
    ].filter(Boolean);

    console.log('Performance Statistics:');
    console.log('-'.repeat(80));
    console.log('Operation\t\tTotal\tSuccess\tFailed\tSuccess%\tAvg(ms)\tP95(ms)\tMax(ms)');
    console.log('-'.repeat(80));

    stats.forEach(stat => {
      console.log(
        `${stat.operation.padEnd(16)}\t${stat.total}\t${stat.successful}\t${stat.failed}\t` +
        `${stat.successRate}%\t\t${stat.avgDuration}\t${stat.p95Duration}\t${stat.maxDuration}`
      );
    });

    console.log('\nError Summary:');
    console.log('-'.repeat(80));
    
    if (this.results.errors.length === 0) {
      console.log('✅ No errors detected');
    } else {
      const errorsByOperation = this.results.errors.reduce((acc, error) => {
        acc[error.operation] = (acc[error.operation] || 0) + 1;
        return acc;
      }, {});

      Object.entries(errorsByOperation).forEach(([operation, count]) => {
        console.log(`❌ ${operation}: ${count} errors`);
      });
    }

    // Performance requirements check
    console.log('\nPerformance Requirements:');
    console.log('-'.repeat(80));

    const loginStats = stats.find(s => s.operation === 'Login');
    const dashboardStats = stats.find(s => s.operation === 'Dashboard Load');

    if (loginStats) {
      const loginPass = parseFloat(loginStats.avgDuration) < 200;
      console.log(`Login Performance: ${loginStats.avgDuration}ms avg ${loginPass ? '✅' : '❌'} (requirement: <200ms)`);
    }

    if (dashboardStats) {
      const dashboardPass = parseFloat(dashboardStats.avgDuration) < 100;
      console.log(`Dashboard Performance: ${dashboardStats.avgDuration}ms avg ${dashboardPass ? '✅' : '❌'} (requirement: <100ms)`);
    }

    // Overall assessment
    const overallSuccessRate = stats.reduce((acc, stat) => acc + parseFloat(stat.successRate), 0) / stats.length;
    const hasPerformanceIssues = stats.some(stat => 
      (stat.operation === 'Login' && parseFloat(stat.avgDuration) >= 200) ||
      (stat.operation === 'Dashboard Load' && parseFloat(stat.avgDuration) >= 100)
    );

    console.log('\n' + '='.repeat(80));
    console.log(`Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    console.log(`Total Errors: ${this.results.errors.length}`);
    console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
    console.log(`Test Duration: ${TEST_DURATION_MINUTES} minutes`);

    if (overallSuccessRate >= 95 && !hasPerformanceIssues) {
      console.log('🎉 LOAD TEST PASSED - System handles concurrent users well!');
      return true;
    } else {
      console.log('🔥 LOAD TEST ISSUES DETECTED - Review system capacity');
      return false;
    }
  }

  async cleanup() {
    this.log('Cleaning up test data...');

    try {
      // Remove business-store relationships
      const businessAccountIds = this.testUsers
        .filter(u => u.businessAccountId)
        .map(u => u.businessAccountId);

      if (businessAccountIds.length > 0) {
        await this.supabase
          .from('business_stores')
          .delete()
          .in('business_account_id', businessAccountIds);
      }

      // Remove test stores
      const storeIds = this.testUsers
        .filter(u => u.storeId)
        .map(u => u.storeId);

      if (storeIds.length > 0) {
        await this.supabase
          .from('stores')
          .delete()
          .in('id', storeIds);
      }

      // Remove business sessions
      const userIds = this.testUsers
        .filter(u => u.userId)
        .map(u => u.userId);

      if (userIds.length > 0) {
        await this.supabase
          .from('business_sessions')
          .delete()
          .in('user_id', userIds);
      }

      // Remove business accounts
      const businessNames = this.testUsers.map(u => u.businessName);
      await this.supabase
        .from('business_accounts')
        .delete()
        .in('business_name', businessNames);

      // Remove auth users
      for (const user of this.testUsers) {
        if (user.userId) {
          try {
            await this.supabase.auth.admin.deleteUser(user.userId);
          } catch (error) {
            // Ignore deletion errors during cleanup
          }
        }
      }

      this.log('Test data cleanup completed');
    } catch (error) {
      this.log(`Cleanup warning: ${error.message}`, 'WARN');
    }
  }

  async run() {
    console.log('🚀 Starting Load Testing...\n');

    try {
      await this.setupTestData();
      await this.runLoadTest();
      const success = this.generateReport();
      await this.cleanup();

      process.exit(success ? 0 : 1);

    } catch (error) {
      this.log(`Critical error: ${error.message}`, 'ERROR');
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the load test
if (require.main === module) {
  const tester = new LoadTester();
  tester.run();
}

module.exports = LoadTester;