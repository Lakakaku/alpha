import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { performance } from 'perf_hooks';
import jwt from 'jsonwebtoken';
import app from '../../apps/backend/src/app';
import { getServiceClient } from '../../apps/backend/src/config/database';

// Load test configuration
const LOAD_TEST_CONFIG = {
  CONCURRENT_USERS: {
    LOW: 10,
    MEDIUM: 50,
    HIGH: 100,
    STRESS: 200
  },
  TEST_DURATION: {
    SHORT: 30000,  // 30 seconds
    MEDIUM: 60000, // 1 minute
    LONG: 300000   // 5 minutes
  },
  PERFORMANCE_THRESHOLDS: {
    RESPONSE_TIME_P95: 1000,  // 95th percentile under 1s
    RESPONSE_TIME_P99: 2000,  // 99th percentile under 2s
    ERROR_RATE: 0.05,         // Less than 5% error rate
    THROUGHPUT_MIN: 100       // Minimum 100 requests per second
  },
  JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key'
};

// Test user profiles for different scenarios
const USER_PROFILES = {
  BUSINESS_OWNER: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'owner@loadtest.com',
    role: 'business_account',
    business_id: '223e4567-e89b-12d3-a456-426614174000'
  },
  BUSINESS_MEMBER: {
    id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'member@loadtest.com',
    role: 'business_account',
    business_id: '223e4567-e89b-12d3-a456-426614174000'
  },
  ADMIN: {
    id: '123e4567-e89b-12d3-a456-426614174002',
    email: 'admin@loadtest.com',
    role: 'admin_account',
    business_id: null
  }
};

// Test scenarios that simulate real user behavior
const USER_SCENARIOS = {
  TYPICAL_BUSINESS_USER: [
    { method: 'GET', path: '/auth/profile', weight: 30 },
    { method: 'GET', path: '/businesses', weight: 20 },
    { method: 'GET', path: '/businesses/{business_id}/stores', weight: 15 },
    { method: 'GET', path: '/stores/{store_id}', weight: 10 },
    { method: 'POST', path: '/businesses/{business_id}/stores', weight: 5 },
    { method: 'PATCH', path: '/stores/{store_id}', weight: 10 },
    { method: 'GET', path: '/auth/permissions', weight: 10 }
  ],
  ADMIN_USER: [
    { method: 'GET', path: '/auth/profile', weight: 20 },
    { method: 'GET', path: '/businesses', weight: 25 },
    { method: 'GET', path: '/permissions', weight: 15 },
    { method: 'POST', path: '/businesses', weight: 10 },
    { method: 'PATCH', path: '/businesses/{business_id}', weight: 15 },
    { method: 'GET', path: '/health/detailed', weight: 15 }
  ],
  READ_HEAVY_USER: [
    { method: 'GET', path: '/auth/profile', weight: 20 },
    { method: 'GET', path: '/businesses', weight: 30 },
    { method: 'GET', path: '/businesses/{business_id}/stores', weight: 25 },
    { method: 'GET', path: '/stores/{store_id}', weight: 25 }
  ]
};

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  responseTimes: number[];
  throughput: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  concurrentUsers: number;
  testDuration: number;
}

interface UserSession {
  id: string;
  token: string;
  profile: typeof USER_PROFILES.BUSINESS_OWNER;
  scenario: typeof USER_SCENARIOS.TYPICAL_BUSINESS_USER;
}

describe('Load Tests for Concurrent User Sessions', () => {
  let serviceClient: any;
  let testSessions: UserSession[] = [];

  beforeAll(async () => {
    serviceClient = getServiceClient();
    await setupLoadTestData();
    testSessions = await createTestSessions();
  });

  afterAll(async () => {
    await cleanupLoadTestData();
  });

  async function setupLoadTestData() {
    try {
      // Create test business
      await serviceClient
        .from('businesses')
        .insert([{
          id: USER_PROFILES.BUSINESS_OWNER.business_id,
          name: 'Load Test Business',
          description: 'Business for load testing',
          owner_id: USER_PROFILES.BUSINESS_OWNER.id,
          contact_email: 'loadtest@business.com',
          status: 'active',
          subscription_status: 'premium'
        }]);

      // Create test stores
      for (let i = 0; i < 10; i++) {
        await serviceClient
          .from('stores')
          .insert([{
            id: `323e4567-e89b-12d3-a456-42661417400${i}`,
            business_id: USER_PROFILES.BUSINESS_OWNER.business_id,
            name: `Load Test Store ${i + 1}`,
            description: `Store ${i + 1} for load testing`,
            address: `${i + 1} Test Street`,
            qr_code_data: `load-test-qr-${i}`,
            status: 'active'
          }]);
      }
    } catch (error) {
      console.error('Error setting up load test data:', error);
    }
  }

  async function cleanupLoadTestData() {
    try {
      await serviceClient
        .from('stores')
        .delete()
        .eq('business_id', USER_PROFILES.BUSINESS_OWNER.business_id);
      
      await serviceClient
        .from('businesses')
        .delete()
        .eq('id', USER_PROFILES.BUSINESS_OWNER.business_id);
    } catch (error) {
      console.error('Error cleaning up load test data:', error);
    }
  }

  async function createTestSessions(): Promise<UserSession[]> {
    const sessions: UserSession[] = [];
    
    // Create sessions for different user types
    const userTypes = [
      { profile: USER_PROFILES.BUSINESS_OWNER, scenario: USER_SCENARIOS.TYPICAL_BUSINESS_USER, count: 60 },
      { profile: USER_PROFILES.BUSINESS_MEMBER, scenario: USER_SCENARIOS.READ_HEAVY_USER, count: 30 },
      { profile: USER_PROFILES.ADMIN, scenario: USER_SCENARIOS.ADMIN_USER, count: 10 }
    ];

    for (const userType of userTypes) {
      for (let i = 0; i < userType.count; i++) {
        const sessionId = `${userType.profile.id}_session_${i}`;
        const token = jwt.sign(
          {
            userId: `${userType.profile.id}_${i}`,
            email: `${i}_${userType.profile.email}`,
            role: userType.profile.role,
            business_id: userType.profile.business_id
          },
          LOAD_TEST_CONFIG.JWT_SECRET,
          { expiresIn: '2h' }
        );

        sessions.push({
          id: sessionId,
          token,
          profile: userType.profile,
          scenario: userType.scenario
        });
      }
    }

    return sessions;
  }

  function calculateStats(responseTimes: number[]): {
    avg: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } {
    const sorted = responseTimes.sort((a, b) => a - b);
    return {
      avg: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  async function executeUserScenario(session: UserSession, duration: number): Promise<{
    requests: number;
    errors: number;
    responseTimes: number[];
  }> {
    const startTime = Date.now();
    const results = {
      requests: 0,
      errors: 0,
      responseTimes: [] as number[]
    };

    while (Date.now() - startTime < duration) {
      // Select random action based on weight
      const totalWeight = session.scenario.reduce((sum, action) => sum + action.weight, 0);
      const random = Math.random() * totalWeight;
      let currentWeight = 0;
      let selectedAction = session.scenario[0];

      for (const action of session.scenario) {
        currentWeight += action.weight;
        if (random <= currentWeight) {
          selectedAction = action;
          break;
        }
      }

      // Replace placeholders in path
      let path = selectedAction.path;
      path = path.replace('{business_id}', session.profile.business_id || '');
      path = path.replace('{store_id}', '323e4567-e89b-12d3-a456-426614174000'); // Use first test store

      const requestStart = performance.now();
      
      try {
        let response;
        
        switch (selectedAction.method) {
          case 'GET':
            response = await request(app)
              .get(path)
              .set('Authorization', `Bearer ${session.token}`);
            break;
          
          case 'POST':
            const postData = path.includes('/stores') 
              ? {
                  name: `Load Test Store ${Date.now()}`,
                  description: 'Created during load test',
                  address: 'Load Test Address'
                }
              : {
                  name: `Load Test Business ${Date.now()}`,
                  description: 'Created during load test',
                  contact_email: 'loadtest@example.com'
                };
            
            response = await request(app)
              .post(path)
              .set('Authorization', `Bearer ${session.token}`)
              .send(postData);
            break;
          
          case 'PATCH':
            const patchData = {
              description: `Updated during load test at ${Date.now()}`
            };
            
            response = await request(app)
              .patch(path)
              .set('Authorization', `Bearer ${session.token}`)
              .send(patchData);
            break;
          
          default:
            continue;
        }

        const requestEnd = performance.now();
        const responseTime = requestEnd - requestStart;
        
        results.requests++;
        results.responseTimes.push(responseTime);
        
        if (response.status >= 400) {
          results.errors++;
        }

      } catch (error) {
        results.requests++;
        results.errors++;
        results.responseTimes.push(performance.now() - requestStart);
      }

      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }

    return results;
  }

  async function runLoadTest(
    concurrentUsers: number,
    duration: number,
    description: string
  ): Promise<LoadTestResult> {
    console.log(`\nStarting load test: ${description}`);
    console.log(`Concurrent users: ${concurrentUsers}, Duration: ${duration}ms`);

    const selectedSessions = testSessions.slice(0, concurrentUsers);
    const startTime = Date.now();

    // Run concurrent user scenarios
    const promises = selectedSessions.map(session => 
      executeUserScenario(session, duration)
    );

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    // Aggregate results
    const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
    const allResponseTimes = results.flatMap(r => r.responseTimes);
    
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const throughput = totalRequests / (actualDuration / 1000);
    const stats = calculateStats(allResponseTimes);

    const loadTestResult: LoadTestResult = {
      totalRequests,
      successfulRequests: totalRequests - totalErrors,
      failedRequests: totalErrors,
      errorRate,
      responseTimes: allResponseTimes,
      throughput,
      averageResponseTime: stats.avg,
      p95ResponseTime: stats.p95,
      p99ResponseTime: stats.p99,
      concurrentUsers,
      testDuration: actualDuration
    };

    console.log(`Load test results for ${description}:`);
    console.log(`- Total requests: ${totalRequests}`);
    console.log(`- Successful requests: ${totalRequests - totalErrors}`);
    console.log(`- Failed requests: ${totalErrors}`);
    console.log(`- Error rate: ${(errorRate * 100).toFixed(2)}%`);
    console.log(`- Throughput: ${throughput.toFixed(2)} req/s`);
    console.log(`- Average response time: ${stats.avg.toFixed(2)}ms`);
    console.log(`- P95 response time: ${stats.p95.toFixed(2)}ms`);
    console.log(`- P99 response time: ${stats.p99.toFixed(2)}ms`);

    return loadTestResult;
  }

  describe('Low Load Tests (10 concurrent users)', () => {
    it('should handle 10 concurrent users for 30 seconds', async () => {
      const result = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.LOW,
        LOAD_TEST_CONFIG.TEST_DURATION.SHORT,
        '10 concurrent users - 30 seconds'
      );

      expect(result.errorRate).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ERROR_RATE);
      expect(result.p95ResponseTime).toBeLessThan(500); // More strict for low load
      expect(result.throughput).toBeGreaterThan(10);
    }, 60000);
  });

  describe('Medium Load Tests (50 concurrent users)', () => {
    it('should handle 50 concurrent users for 1 minute', async () => {
      const result = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.MEDIUM,
        LOAD_TEST_CONFIG.TEST_DURATION.MEDIUM,
        '50 concurrent users - 1 minute'
      );

      expect(result.errorRate).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ERROR_RATE);
      expect(result.p95ResponseTime).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_P95);
      expect(result.p99ResponseTime).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_P99);
      expect(result.throughput).toBeGreaterThan(50);
    }, 120000);
  });

  describe('High Load Tests (100 concurrent users)', () => {
    it('should handle 100 concurrent users for 1 minute', async () => {
      const result = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.HIGH,
        LOAD_TEST_CONFIG.TEST_DURATION.MEDIUM,
        '100 concurrent users - 1 minute'
      );

      expect(result.errorRate).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ERROR_RATE);
      expect(result.p95ResponseTime).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_P95);
      expect(result.p99ResponseTime).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_P99);
      expect(result.throughput).toBeGreaterThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.THROUGHPUT_MIN);
    }, 120000);
  });

  describe('Stress Tests (200 concurrent users)', () => {
    it('should maintain stability under 200 concurrent users', async () => {
      const result = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.STRESS,
        LOAD_TEST_CONFIG.TEST_DURATION.SHORT,
        '200 concurrent users - stress test'
      );

      // More lenient thresholds for stress test
      expect(result.errorRate).toBeLessThan(0.1); // 10% error rate acceptable under stress
      expect(result.p99ResponseTime).toBeLessThan(5000); // 5 seconds max response time
      expect(result.totalRequests).toBeGreaterThan(100); // Should process at least some requests
    }, 120000);
  });

  describe('Sustained Load Tests', () => {
    it('should handle sustained load over 5 minutes', async () => {
      const result = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.MEDIUM,
        LOAD_TEST_CONFIG.TEST_DURATION.LONG,
        'Sustained load - 50 users for 5 minutes'
      );

      expect(result.errorRate).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ERROR_RATE);
      expect(result.p95ResponseTime).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_P95);
      expect(result.throughput).toBeGreaterThan(50);

      // Check for performance degradation over time
      const firstHalf = result.responseTimes.slice(0, Math.floor(result.responseTimes.length / 2));
      const secondHalf = result.responseTimes.slice(Math.floor(result.responseTimes.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      // Performance should not degrade by more than 50% over time
      expect(secondHalfAvg / firstHalfAvg).toBeLessThan(1.5);
    }, 360000); // 6 minutes timeout
  });

  describe('Mixed Workload Tests', () => {
    it('should handle mixed read/write workloads efficiently', async () => {
      // Create a custom mixed workload
      const mixedSessions = [
        ...testSessions.slice(0, 40), // 40 typical business users
        ...testSessions.slice(40, 50).map(session => ({
          ...session,
          scenario: USER_SCENARIOS.READ_HEAVY_USER
        })), // 10 read-heavy users
        ...testSessions.slice(50, 60).map(session => ({
          ...session,
          scenario: USER_SCENARIOS.ADMIN_USER
        })) // 10 admin users
      ];

      const promises = mixedSessions.map(session => 
        executeUserScenario(session, LOAD_TEST_CONFIG.TEST_DURATION.MEDIUM)
      );

      const results = await Promise.all(promises);
      const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

      expect(errorRate).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ERROR_RATE);
      expect(totalRequests).toBeGreaterThan(1000); // Should handle significant load
    }, 120000);
  });

  describe('Ramp-up Tests', () => {
    it('should handle gradual ramp-up of concurrent users', async () => {
      const rampUpSteps = [10, 25, 50, 75, 100];
      const stepDuration = 30000; // 30 seconds per step
      const results: LoadTestResult[] = [];

      for (const userCount of rampUpSteps) {
        const result = await runLoadTest(
          userCount,
          stepDuration,
          `Ramp-up step: ${userCount} users`
        );
        results.push(result);

        // Each step should maintain acceptable performance
        expect(result.errorRate).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.ERROR_RATE);
        expect(result.p95ResponseTime).toBeLessThan(LOAD_TEST_CONFIG.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_P95);
      }

      // Verify that performance doesn't degrade significantly with increased load
      const baselineP95 = results[0].p95ResponseTime;
      for (let i = 1; i < results.length; i++) {
        // P95 should not increase by more than 3x from baseline
        expect(results[i].p95ResponseTime / baselineP95).toBeLessThan(3);
      }
    }, 300000); // 5 minutes timeout
  });

  describe('Memory and Resource Usage Under Load', () => {
    it('should not have memory leaks under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      
      await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.MEDIUM,
        LOAD_TEST_CONFIG.TEST_DURATION.MEDIUM,
        'Memory leak test'
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / 1024 / 1024;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncreaseInMB).toBeLessThan(100);
      
      console.log(`Memory usage increase: ${memoryIncreaseInMB.toFixed(2)}MB`);
    }, 120000);
  });

  describe('Recovery Tests', () => {
    it('should recover quickly after load spike', async () => {
      // Create a load spike
      const spikeResult = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.STRESS,
        15000, // 15 seconds of high load
        'Load spike test'
      );

      // Wait for system to stabilize
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Test normal load performance after spike
      const recoveryResult = await runLoadTest(
        LOAD_TEST_CONFIG.CONCURRENT_USERS.LOW,
        15000,
        'Recovery test after spike'
      );

      // Performance should recover to normal levels
      expect(recoveryResult.errorRate).toBeLessThan(0.02); // 2% error rate
      expect(recoveryResult.p95ResponseTime).toBeLessThan(800); // Should be back to normal
      
      console.log(`Recovery P95: ${recoveryResult.p95ResponseTime.toFixed(2)}ms`);
    }, 60000);
  });
});