import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const CUSTOMER_URL = process.env.CUSTOMER_URL || 'https://customer.vocilia.com';
const PERFORMANCE_TARGET_MS = 2000;
const LOAD_TARGET_USERS = 100;

describe('Integration Test: Performance and Load Testing (Scenario 4)', () => {
  beforeAll(async () => {
    // Performance test setup
  });

  afterAll(async () => {
    // Performance test cleanup
  });

  it('should meet API response time requirements', async () => {
    const endpoints = [
      '/health',
      '/health/detailed', 
      '/health/database',
      '/health/jobs'
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      expect(response.status).toBe(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(PERFORMANCE_TARGET_MS);
    }
  });

  it('should meet frontend page load requirements', async () => {
    const frontendUrls = [
      CUSTOMER_URL,
      process.env.BUSINESS_URL || 'https://business.vocilia.com',
      process.env.ADMIN_URL || 'https://admin.vocilia.com'
    ];

    for (const url of frontendUrls) {
      const startTime = Date.now();
      
      const response = await fetch(url);
      expect(response.status).toBe(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(PERFORMANCE_TARGET_MS);
    }
  });

  it('should handle concurrent API requests efficiently', async () => {
    const concurrentRequests = 50;
    const endpoint = `${API_BASE_URL}/health`;

    const promises = Array.from({ length: concurrentRequests }, () => {
      const startTime = Date.now();
      return fetch(endpoint).then(response => {
        const responseTime = Date.now() - startTime;
        return { status: response.status, responseTime };
      });
    });

    const results = await Promise.all(promises);
    
    // All requests should succeed
    results.forEach(result => {
      expect(result.status).toBe(200);
      expect(result.responseTime).toBeLessThan(PERFORMANCE_TARGET_MS * 1.5); // Allow 50% overhead for concurrent load
    });

    // Calculate average response time
    const avgResponseTime = results.reduce((sum, result) => sum + result.responseTime, 0) / results.length;
    expect(avgResponseTime).toBeLessThan(1000); // Average should be <1s
  });

  it('should maintain database performance under load', async () => {
    const concurrentDbRequests = 20;
    const endpoint = `${API_BASE_URL}/health/database`;

    const promises = Array.from({ length: concurrentDbRequests }, () => {
      const startTime = Date.now();
      return fetch(endpoint).then(async response => {
        const responseTime = Date.now() - startTime;
        const data = await response.json();
        return { status: response.status, responseTime, data };
      });
    });

    const results = await Promise.all(promises);
    
    // All database health checks should succeed
    results.forEach(result => {
      expect(result.status).toBe(200);
      expect(result.responseTime).toBeLessThan(1000); // DB health checks should be <1s
      expect(result.data.connection_pool.pool_utilization).toBeLessThan(90); // Pool shouldn't be overloaded
    });
  });

  it('should validate P95 response time requirements', async () => {
    const samples = 100;
    const endpoint = `${API_BASE_URL}/health/detailed`;
    const responseTimes: number[] = [];

    // Collect response time samples
    for (let i = 0; i < samples; i++) {
      const startTime = Date.now();
      const response = await fetch(endpoint);
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      responseTimes.push(responseTime);
      
      // Small delay between requests to simulate realistic load
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Calculate P95 (95th percentile)
    responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(samples * 0.95);
    const p95ResponseTime = responseTimes[p95Index];

    expect(p95ResponseTime).toBeLessThan(PERFORMANCE_TARGET_MS);
    
    // Also validate average is well below target
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / samples;
    expect(avgResponseTime).toBeLessThan(1000);
  });

  it('should handle memory-intensive operations efficiently', async () => {
    // Test detailed health checks which include memory metrics
    const response = await fetch(`${API_BASE_URL}/health/detailed`);
    expect(response.status).toBe(200);
    
    const healthData = await response.json();
    
    if (healthData.memory) {
      const memoryUsageMB = healthData.memory.heapUsed / (1024 * 1024);
      expect(memoryUsageMB).toBeLessThan(512); // Should use <512MB heap
      
      const heapUtilization = (healthData.memory.heapUsed / healthData.memory.heapTotal) * 100;
      expect(heapUtilization).toBeLessThan(80); // Heap utilization should be <80%
    }

    if (healthData.performance) {
      expect(healthData.performance.memory_usage_percent).toBeLessThan(80);
      expect(healthData.performance.cpu_usage_percent).toBeLessThan(70);
    }
  });

  it('should validate CDN and edge performance', async () => {
    const frontendUrls = [
      CUSTOMER_URL,
      process.env.BUSINESS_URL || 'https://business.vocilia.com',
      process.env.ADMIN_URL || 'https://admin.vocilia.com'
    ];

    for (const url of frontendUrls) {
      // Test static asset performance
      const assetResponse = await fetch(`${url}/favicon.ico`, { method: 'HEAD' });
      
      if (assetResponse.status === 200) {
        const cacheStatus = assetResponse.headers.get('cf-cache-status') || 
                           assetResponse.headers.get('x-cache') ||
                           assetResponse.headers.get('x-vercel-cache');
        
        // Should have CDN cache headers indicating edge caching
        expect(cacheStatus || assetResponse.headers.get('cache-control')).toBeTruthy();
      }
    }
  });

  it('should maintain performance during sustained load', async () => {
    const duration = 30000; // 30 seconds
    const requestInterval = 100; // Request every 100ms
    const startTime = Date.now();
    const responseTimes: number[] = [];

    while (Date.now() - startTime < duration) {
      const reqStartTime = Date.now();
      
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const responseTime = Date.now() - reqStartTime;
        
        if (response.status === 200) {
          responseTimes.push(responseTime);
        }
      } catch (error) {
        // Log but continue - some requests may fail under sustained load
        console.warn('Request failed during sustained load test:', error);
      }

      await new Promise(resolve => setTimeout(resolve, requestInterval));
    }

    // Should have successfully handled most requests
    expect(responseTimes.length).toBeGreaterThan(200); // At least 200 successful requests in 30s
    
    // Performance shouldn't degrade significantly over time
    const firstQuarter = responseTimes.slice(0, Math.floor(responseTimes.length / 4));
    const lastQuarter = responseTimes.slice(-Math.floor(responseTimes.length / 4));
    
    const firstQuarterAvg = firstQuarter.reduce((sum, time) => sum + time, 0) / firstQuarter.length;
    const lastQuarterAvg = lastQuarter.reduce((sum, time) => sum + time, 0) / lastQuarter.length;
    
    // Last quarter shouldn't be more than 50% slower than first quarter
    expect(lastQuarterAvg).toBeLessThan(firstQuarterAvg * 1.5);
  });
});