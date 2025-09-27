import { performance } from 'perf_hooks';
import axios from 'axios';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  responseTimeThreshold: 2000, // 2 seconds
  averageResponseTimeThreshold: 1000, // 1 second
  percentile95Threshold: 2000, // P95 < 2 seconds
  maxConcurrentUsers: 500,
  testDuration: 300000, // 5 minutes
  baseUrls: {
    api: process.env.TEST_API_URL || 'https://staging-api.vocilia.com',
    customer: process.env.TEST_CUSTOMER_URL || 'https://staging-customer.vocilia.com',
    business: process.env.TEST_BUSINESS_URL || 'https://staging-business.vocilia.com',
    admin: process.env.TEST_ADMIN_URL || 'https://staging-admin.vocilia.com',
  },
  endpoints: [
    '/health',
    '/health/detailed',
    '/health/database',
    '/health/jobs',
    '/api/admin/deployment/status',
    '/api/admin/monitoring/uptime',
    '/api/admin/monitoring/performance',
    '/api/admin/monitoring/backups',
  ],
};

interface PerformanceMetric {
  endpoint: string;
  responseTime: number;
  status: number;
  timestamp: number;
  success: boolean;
}

interface PerformanceTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  percentile95: number;
  percentile99: number;
  throughput: number; // requests per second
  errorRate: number; // percentage
}

class PerformanceTester {
  private metrics: PerformanceMetric[] = [];
  private authToken: string | null = null;

  async authenticate(): Promise<void> {
    try {
      const response = await axios.post(`${PERFORMANCE_CONFIG.baseUrls.api}/api/admin/auth/login`, {
        email: process.env.TEST_ADMIN_EMAIL || 'admin@vocilia.com',
        password: process.env.TEST_ADMIN_PASSWORD || 'test-password',
      });
      this.authToken = response.data.token;
    } catch (error) {
      console.warn('Authentication failed, proceeding without auth token');
    }
  }

  async makeRequest(endpoint: string, baseUrl: string = PERFORMANCE_CONFIG.baseUrls.api): Promise<PerformanceMetric> {
    const startTime = performance.now();
    const headers: Record<string, string> = {};
    
    if (this.authToken && endpoint.includes('/api/admin/')) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers,
        timeout: 10000, // 10 second timeout
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        endpoint,
        responseTime,
        status: response.status,
        timestamp: Date.now(),
        success: response.status >= 200 && response.status < 300,
      };
    } catch (error: any) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      return {
        endpoint,
        responseTime,
        status: error.response?.status || 0,
        timestamp: Date.now(),
        success: false,
      };
    }
  }

  calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  analyzeMetrics(endpoint: string): PerformanceTestResult {
    const endpointMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    const responseTimes = endpointMetrics.map(m => m.responseTime);
    const successfulRequests = endpointMetrics.filter(m => m.success).length;

    return {
      endpoint,
      totalRequests: endpointMetrics.length,
      successfulRequests,
      failedRequests: endpointMetrics.length - successfulRequests,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      percentile95: this.calculatePercentile(responseTimes, 95),
      percentile99: this.calculatePercentile(responseTimes, 99),
      throughput: endpointMetrics.length / (PERFORMANCE_CONFIG.testDuration / 1000),
      errorRate: ((endpointMetrics.length - successfulRequests) / endpointMetrics.length) * 100,
    };
  }

  async runSingleRequestTest(endpoint: string): Promise<void> {
    const metric = await this.makeRequest(endpoint);
    this.metrics.push(metric);
  }

  async runConcurrentTest(endpoint: string, concurrency: number, duration: number): Promise<void> {
    const startTime = Date.now();
    const promises: Promise<void>[] = [];

    while (Date.now() - startTime < duration) {
      const batch = Array(concurrency).fill(0).map(() => this.runSingleRequestTest(endpoint));
      promises.push(...batch);
      
      // Wait for current batch to complete before starting next
      await Promise.all(batch);
      
      // Small delay between batches to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await Promise.all(promises);
  }
}

describe('Deployment Performance Tests', () => {
  let tester: PerformanceTester;
  
  beforeAll(async () => {
    tester = new PerformanceTester();
    await tester.authenticate();
  }, 30000);

  describe('Individual Endpoint Performance', () => {
    PERFORMANCE_CONFIG.endpoints.forEach(endpoint => {
      it(`should respond to ${endpoint} within 2 seconds`, async () => {
        const metric = await tester.makeRequest(endpoint);
        
        expect(metric.success).toBe(true);
        expect(metric.responseTime).toBeLessThan(PERFORMANCE_CONFIG.responseTimeThreshold);
        expect(metric.status).toBeGreaterThanOrEqual(200);
        expect(metric.status).toBeLessThan(300);
      }, 10000);
    });

    it('should handle health check requests efficiently', async () => {
      const healthMetric = await tester.makeRequest('/health');
      
      expect(healthMetric.success).toBe(true);
      expect(healthMetric.responseTime).toBeLessThan(500); // Health checks should be very fast
      expect(healthMetric.status).toBe(200);
    });

    it('should handle detailed health checks within limits', async () => {
      const detailedHealthMetric = await tester.makeRequest('/health/detailed');
      
      expect(detailedHealthMetric.success).toBe(true);
      expect(detailedHealthMetric.responseTime).toBeLessThan(1000); // Detailed checks can be slower
      expect(detailedHealthMetric.status).toBe(200);
    });

    it('should handle database health checks efficiently', async () => {
      const dbHealthMetric = await tester.makeRequest('/health/database');
      
      expect(dbHealthMetric.success).toBe(true);
      expect(dbHealthMetric.responseTime).toBeLessThan(1500); // Database checks may take longer
      expect(dbHealthMetric.status).toBe(200);
    });
  });

  describe('Load Testing - Sustained Performance', () => {
    it('should maintain performance under sustained load for /health endpoint', async () => {
      // Run 100 requests over 60 seconds to test sustained performance
      await tester.runConcurrentTest('/health', 10, 60000);
      
      const results = tester.analyzeMetrics('/health');
      
      expect(results.averageResponseTime).toBeLessThan(PERFORMANCE_CONFIG.averageResponseTimeThreshold);
      expect(results.percentile95).toBeLessThan(PERFORMANCE_CONFIG.percentile95Threshold);
      expect(results.errorRate).toBeLessThan(1); // Less than 1% error rate
      expect(results.successfulRequests).toBeGreaterThan(80); // At least 80 successful requests
    }, 120000);

    it('should handle burst traffic for monitoring endpoints', async () => {
      // Simulate burst traffic: 50 concurrent requests over 30 seconds
      await tester.runConcurrentTest('/api/admin/monitoring/uptime', 25, 30000);
      
      const results = tester.analyzeMetrics('/api/admin/monitoring/uptime');
      
      expect(results.averageResponseTime).toBeLessThan(1500); // Slightly higher threshold for admin endpoints
      expect(results.percentile95).toBeLessThan(PERFORMANCE_CONFIG.percentile95Threshold);
      expect(results.errorRate).toBeLessThan(5); // Less than 5% error rate under burst
    }, 60000);
  });

  describe('Frontend Performance Tests', () => {
    it('should load customer app homepage within performance targets', async () => {
      const metric = await tester.makeRequest('/', PERFORMANCE_CONFIG.baseUrls.customer);
      
      expect(metric.success).toBe(true);
      expect(metric.responseTime).toBeLessThan(PERFORMANCE_CONFIG.responseTimeThreshold);
      expect(metric.status).toBe(200);
    });

    it('should load business app homepage within performance targets', async () => {
      const metric = await tester.makeRequest('/', PERFORMANCE_CONFIG.baseUrls.business);
      
      expect(metric.success).toBe(true);
      expect(metric.responseTime).toBeLessThan(PERFORMANCE_CONFIG.responseTimeThreshold);
      expect(metric.status).toBe(200);
    });

    it('should load admin app homepage within performance targets', async () => {
      const metric = await tester.makeRequest('/', PERFORMANCE_CONFIG.baseUrls.admin);
      
      expect(metric.success).toBe(true);
      expect(metric.responseTime).toBeLessThan(PERFORMANCE_CONFIG.responseTimeThreshold);
      expect(metric.status).toBe(200);
    });
  });

  describe('Stress Testing - Peak Load Simulation', () => {
    it('should handle deployment status requests under peak load', async () => {
      // Simulate peak load: 100 concurrent users for 2 minutes
      await tester.runConcurrentTest('/api/admin/deployment/status', 50, 120000);
      
      const results = tester.analyzeMetrics('/api/admin/deployment/status');
      
      expect(results.averageResponseTime).toBeLessThan(2000); // Higher threshold under stress
      expect(results.percentile99).toBeLessThan(5000); // P99 should still be reasonable
      expect(results.errorRate).toBeLessThan(10); // Allow higher error rate under stress
      expect(results.throughput).toBeGreaterThan(0.5); // At least 0.5 requests per second
    }, 180000);

    it('should maintain system stability under mixed workload', async () => {
      // Run multiple endpoints concurrently to simulate real-world mixed load
      const endpoints = ['/health', '/health/detailed', '/api/admin/monitoring/uptime'];
      
      const promises = endpoints.map(endpoint => 
        tester.runConcurrentTest(endpoint, 10, 90000)
      );
      
      await Promise.all(promises);
      
      // Check that all endpoints performed within acceptable limits
      endpoints.forEach(endpoint => {
        const results = tester.analyzeMetrics(endpoint);
        expect(results.averageResponseTime).toBeLessThan(3000); // Relaxed under mixed load
        expect(results.errorRate).toBeLessThan(15); // Allow higher error rate under stress
      });
    }, 150000);
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in critical paths', async () => {
      const criticalEndpoints = ['/health', '/health/database'];
      const baselineResults: Record<string, PerformanceTestResult> = {};
      
      // Establish baseline
      for (const endpoint of criticalEndpoints) {
        await tester.runConcurrentTest(endpoint, 5, 30000);
        baselineResults[endpoint] = tester.analyzeMetrics(endpoint);
      }
      
      // Verify baseline performance meets requirements
      Object.values(baselineResults).forEach(result => {
        expect(result.averageResponseTime).toBeLessThan(PERFORMANCE_CONFIG.averageResponseTimeThreshold);
        expect(result.percentile95).toBeLessThan(PERFORMANCE_CONFIG.percentile95Threshold);
      });
    }, 120000);
  });

  afterAll(async () => {
    // Generate performance report
    const allEndpoints = [...new Set(tester['metrics'].map(m => m.endpoint))];
    const report = allEndpoints.map(endpoint => tester.analyzeMetrics(endpoint));
    
    console.log('\n=== Performance Test Report ===');
    report.forEach(result => {
      console.log(`\nEndpoint: ${result.endpoint}`);
      console.log(`Total Requests: ${result.totalRequests}`);
      console.log(`Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
      console.log(`Average Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`P95 Response Time: ${result.percentile95.toFixed(2)}ms`);
      console.log(`P99 Response Time: ${result.percentile99.toFixed(2)}ms`);
      console.log(`Throughput: ${result.throughput.toFixed(2)} req/s`);
      console.log(`Error Rate: ${result.errorRate.toFixed(2)}%`);
    });
    
    // Save detailed metrics to file for further analysis
    const fs = require('fs').promises;
    const path = require('path');
    
    const reportData = {
      timestamp: new Date().toISOString(),
      config: PERFORMANCE_CONFIG,
      results: report,
      rawMetrics: tester['metrics'],
    };
    
    try {
      await fs.writeFile(
        path.join(__dirname, `performance-report-${Date.now()}.json`),
        JSON.stringify(reportData, null, 2)
      );
    } catch (error) {
      console.warn('Failed to save performance report:', error);
    }
  });
});