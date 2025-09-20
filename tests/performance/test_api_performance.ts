import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { performance } from 'perf_hooks';
import app from '../../apps/backend/src/app';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  FAST: 100,      // < 100ms - very fast
  GOOD: 200,      // < 200ms - good performance (our target)
  SLOW: 500,      // < 500ms - acceptable but slow
  CRITICAL: 1000  // > 1000ms - critical performance issue
};

const CONCURRENT_REQUESTS = 10;
const LOAD_TEST_DURATION = 5000; // 5 seconds

// Mock authentication token for testing
const mockAuthToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

// Test data
const testUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  role: 'business_account'
};

const testBusiness = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Test Business',
  description: 'A test business for performance testing'
};

// Helper function to measure response time
async function measureResponseTime(requestFn: () => Promise<any>): Promise<number> {
  const start = performance.now();
  await requestFn();
  const end = performance.now();
  return end - start;
}

// Helper function to run concurrent requests
async function runConcurrentRequests(requestFn: () => Promise<any>, count: number): Promise<number[]> {
  const requests = Array(count).fill(null).map(() => measureResponseTime(requestFn));
  return Promise.all(requests);
}

// Helper function to calculate statistics
function calculateStats(times: number[]) {
  const sorted = times.sort((a, b) => a - b);
  return {
    min: Math.min(...times),
    max: Math.max(...times),
    avg: times.reduce((sum, time) => sum + time, 0) / times.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

describe('API Performance Tests', () => {
  beforeAll(async () => {
    // Setup test database state if needed
    console.log('Setting up performance test environment...');
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('Cleaning up performance test environment...');
  });

  describe('Health Check Endpoints', () => {
    it('should respond to basic health check in under 100ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);
        
        expect(response.body).toHaveProperty('status');
        return response;
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST);
      console.log(`Health check response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should respond to detailed health check in under 200ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        const response = await request(app)
          .get('/health/detailed')
          .expect(200);
        
        expect(response.body).toHaveProperty('checks');
        return response;
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      console.log(`Detailed health check response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle concurrent health check requests efficiently', async () => {
      const times = await runConcurrentRequests(async () => {
        return request(app).get('/health').expect(200);
      }, CONCURRENT_REQUESTS);

      const stats = calculateStats(times);
      
      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      expect(stats.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      
      console.log('Health check concurrent stats:', {
        avg: `${stats.avg.toFixed(2)}ms`,
        p95: `${stats.p95.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`
      });
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle login requests in under 200ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          })
          .expect((res) => {
            // Accept both success and auth failure for performance testing
            expect([200, 401, 422]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      console.log(`Login response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle token refresh requests in under 100ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .post('/auth/refresh')
          .send({
            refresh_token: 'test_refresh_token'
          })
          .expect((res) => {
            expect([200, 401, 422]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST);
      console.log(`Token refresh response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle profile requests in under 200ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get('/auth/profile')
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      console.log(`Profile fetch response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Business Management Endpoints', () => {
    it('should list businesses in under 200ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get('/businesses')
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      console.log(`Business list response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should get single business in under 150ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get(`/businesses/${testBusiness.id}`)
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401, 404]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(150);
      console.log(`Business get response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should create business in under 300ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .post('/businesses')
          .set('Authorization', mockAuthToken)
          .send({
            name: 'Performance Test Business',
            description: 'Created for performance testing',
            contact_email: 'perf@test.com'
          })
          .expect((res) => {
            expect([201, 400, 401, 422]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(300);
      console.log(`Business create response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should update business in under 250ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .patch(`/businesses/${testBusiness.id}`)
          .set('Authorization', mockAuthToken)
          .send({
            name: 'Updated Performance Test Business'
          })
          .expect((res) => {
            expect([200, 400, 401, 404]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(250);
      console.log(`Business update response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Store Management Endpoints', () => {
    it('should list stores for business in under 200ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get(`/businesses/${testBusiness.id}/stores`)
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401, 404]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      console.log(`Store list response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should get single store in under 150ms', async () => {
      const storeId = '123e4567-e89b-12d3-a456-426614174002';
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get(`/stores/${storeId}`)
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401, 404]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(150);
      console.log(`Store get response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should create store with QR code generation in under 500ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .post(`/businesses/${testBusiness.id}/stores`)
          .set('Authorization', mockAuthToken)
          .send({
            name: 'Performance Test Store',
            description: 'Created for performance testing',
            address: '123 Test Street'
          })
          .expect((res) => {
            expect([201, 400, 401, 404]).toContain(res.status);
          });
      });

      // QR code generation adds some overhead, so we allow up to 500ms
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      console.log(`Store create (with QR) response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Permission Endpoints', () => {
    it('should list permissions in under 150ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get('/permissions')
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(150);
      console.log(`Permissions list response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should get user permissions in under 200ms', async () => {
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get('/auth/permissions')
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401]).toContain(res.status);
          });
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      console.log(`User permissions response time: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Load Tests', () => {
    it('should handle concurrent business list requests', async () => {
      const times = await runConcurrentRequests(async () => {
        return request(app)
          .get('/businesses')
          .set('Authorization', mockAuthToken)
          .expect((res) => {
            expect([200, 401]).toContain(res.status);
          });
      }, CONCURRENT_REQUESTS);

      const stats = calculateStats(times);
      
      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      expect(stats.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      
      console.log('Business list concurrent stats:', {
        requests: CONCURRENT_REQUESTS,
        avg: `${stats.avg.toFixed(2)}ms`,
        p95: `${stats.p95.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`
      });
    });

    it('should handle mixed endpoint requests efficiently', async () => {
      const endpoints = [
        () => request(app).get('/health'),
        () => request(app).get('/businesses').set('Authorization', mockAuthToken),
        () => request(app).get('/permissions').set('Authorization', mockAuthToken),
        () => request(app).get('/auth/profile').set('Authorization', mockAuthToken)
      ];

      const times = await Promise.all(
        Array(CONCURRENT_REQUESTS).fill(null).map(async (_, index) => {
          const endpoint = endpoints[index % endpoints.length];
          return measureResponseTime(async () => {
            return endpoint().expect((res) => {
              expect([200, 401]).toContain(res.status);
            });
          });
        })
      );

      const stats = calculateStats(times);
      
      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      expect(stats.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      
      console.log('Mixed endpoints concurrent stats:', {
        requests: CONCURRENT_REQUESTS,
        avg: `${stats.avg.toFixed(2)}ms`,
        p95: `${stats.p95.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`
      });
    });
  });

  describe('Sustained Load Tests', () => {
    it('should maintain performance under sustained load', async () => {
      const startTime = Date.now();
      const requestTimes: number[] = [];
      
      // Run requests for LOAD_TEST_DURATION
      while (Date.now() - startTime < LOAD_TEST_DURATION) {
        const responseTime = await measureResponseTime(async () => {
          return request(app)
            .get('/health')
            .expect(200);
        });
        
        requestTimes.push(responseTime);
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const stats = calculateStats(requestTimes);
      
      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.GOOD);
      expect(stats.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      expect(requestTimes.length).toBeGreaterThan(10); // Should process multiple requests
      
      console.log('Sustained load test stats:', {
        duration: `${LOAD_TEST_DURATION}ms`,
        totalRequests: requestTimes.length,
        requestsPerSecond: Math.round(requestTimes.length / (LOAD_TEST_DURATION / 1000)),
        avg: `${stats.avg.toFixed(2)}ms`,
        p95: `${stats.p95.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`
      });
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have significant memory leaks during load test', async () => {
      // Get initial memory usage
      const initialMemory = process.memoryUsage();
      
      // Run a series of requests
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health').expect(200);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Check memory usage after load
      const finalMemory = process.memoryUsage();
      
      // Memory should not increase by more than 50MB
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / 1024 / 1024;
      
      expect(memoryIncreaseInMB).toBeLessThan(50);
      
      console.log('Memory usage test:', {
        initialHeap: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        finalHeap: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        increase: `${memoryIncreaseInMB.toFixed(2)}MB`
      });
    });
  });

  describe('Database Performance', () => {
    it('should handle database-heavy operations efficiently', async () => {
      // Test endpoint that requires multiple database queries
      const responseTime = await measureResponseTime(async () => {
        return request(app)
          .get('/health/detailed')
          .expect(200);
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      console.log(`Database-heavy operation response time: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle concurrent database operations', async () => {
      const times = await runConcurrentRequests(async () => {
        return request(app)
          .get('/health/detailed')
          .expect(200);
      }, 5); // Lower concurrency for database tests

      const stats = calculateStats(times);
      
      expect(stats.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.SLOW);
      expect(stats.max).toBeLessThan(PERFORMANCE_THRESHOLDS.CRITICAL);
      
      console.log('Database concurrent stats:', {
        avg: `${stats.avg.toFixed(2)}ms`,
        max: `${stats.max.toFixed(2)}ms`
      });
    });
  });
});