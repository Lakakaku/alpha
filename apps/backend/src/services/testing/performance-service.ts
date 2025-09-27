import { PerformanceBenchmark, CreateBenchmarkRequest, PerformanceMetric, PerformanceTest } from '@vocilia/types/testing';
import { PerformanceBenchmarkModel } from '@vocilia/database/testing';
import { v4 as uuidv4 } from 'uuid';

export interface PerformanceTestResult {
  benchmarkId: string;
  testName: string;
  metrics: PerformanceMetric[];
  summary: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    throughput: number;
    errorRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  passed: boolean;
  violations: string[];
}

export interface LoadTestConfig {
  duration: number; // seconds
  rampUp: number; // seconds
  targetUsers: number;
  maxUsers?: number;
  testUrl: string;
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage
  requests: LoadTestRequest[];
}

export interface LoadTestRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus?: number;
  timeout?: number;
}

export class PerformanceService {
  private benchmarkModel: PerformanceBenchmarkModel;

  constructor() {
    this.benchmarkModel = new PerformanceBenchmarkModel();
  }

  async createBenchmark(data: CreateBenchmarkRequest): Promise<PerformanceBenchmark> {
    const benchmark: PerformanceBenchmark = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      test_type: data.test_type,
      target_url: data.target_url,
      performance_thresholds: data.performance_thresholds,
      load_configuration: data.load_configuration,
      environment: data.environment || 'test',
      status: 'active',
      tags: data.tags || [],
      created_by: data.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return await this.benchmarkModel.create(benchmark);
  }

  async getBenchmarks(
    test_type?: string,
    environment?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ benchmarks: PerformanceBenchmark[]; total: number }> {
    const filters = {};
    if (test_type) filters['test_type'] = test_type;
    if (environment) filters['environment'] = environment;

    const { data, total } = await this.benchmarkModel.findMany(filters, limit, offset);
    return { benchmarks: data, total };
  }

  async getBenchmarkById(id: string): Promise<PerformanceBenchmark> {
    const benchmark = await this.benchmarkModel.findById(id);
    if (!benchmark) {
      throw new Error(`Performance benchmark with ID ${id} not found`);
    }
    return benchmark;
  }

  async runPerformanceTest(benchmarkId: string): Promise<PerformanceTestResult> {
    const benchmark = await this.getBenchmarkById(benchmarkId);
    
    switch (benchmark.test_type) {
      case 'load':
        return await this.runLoadTest(benchmark);
      case 'stress':
        return await this.runStressTest(benchmark);
      case 'spike':
        return await this.runSpikeTest(benchmark);
      case 'volume':
        return await this.runVolumeTest(benchmark);
      case 'endurance':
        return await this.runEnduranceTest(benchmark);
      default:
        throw new Error(`Unsupported performance test type: ${benchmark.test_type}`);
    }
  }

  private async runLoadTest(benchmark: PerformanceBenchmark): Promise<PerformanceTestResult> {
    const config = benchmark.load_configuration as LoadTestConfig;
    const metrics: PerformanceMetric[] = [];
    const startTime = Date.now();

    try {
      // Simulate load test execution
      // In a real implementation, this would use Artillery, k6, or similar tools
      
      const testDuration = config.duration * 1000; // Convert to milliseconds
      const rampUpDuration = config.rampUp * 1000;
      const targetUsers = config.targetUsers;

      // Simulate ramping up users
      let currentUsers = 0;
      const rampUpIncrement = targetUsers / (rampUpDuration / 1000);
      
      const responseTimes: number[] = [];
      const errors: number[] = [];
      let totalRequests = 0;

      // Simulate test execution
      for (let elapsed = 0; elapsed < testDuration; elapsed += 1000) {
        if (elapsed < rampUpDuration) {
          currentUsers = Math.min(targetUsers, currentUsers + rampUpIncrement);
        }

        // Simulate requests for current second
        const requestsPerSecond = currentUsers * 2; // Assume each user makes 2 requests per second
        totalRequests += requestsPerSecond;

        for (let i = 0; i < requestsPerSecond; i++) {
          // Simulate response time (normally distributed around 200ms)
          const responseTime = this.generateNormalDistribution(200, 50);
          responseTimes.push(responseTime);

          // Simulate error rate (2% baseline)
          if (Math.random() < 0.02) {
            errors.push(1);
          }

          // Create metric entry
          metrics.push({
            timestamp: new Date(startTime + elapsed + i).toISOString(),
            metric_name: 'response_time',
            value: responseTime,
            unit: 'ms',
            tags: { user_count: currentUsers.toString() }
          });
        }
      }

      // Calculate summary statistics
      responseTimes.sort((a, b) => a - b);
      const summary = {
        avgResponseTime: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
        maxResponseTime: Math.max(...responseTimes),
        minResponseTime: Math.min(...responseTimes),
        throughput: totalRequests / (testDuration / 1000),
        errorRate: (errors.length / totalRequests) * 100,
        p95ResponseTime: this.calculatePercentile(responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(responseTimes, 99)
      };

      // Check thresholds
      const violations = this.checkThresholds(summary, benchmark.performance_thresholds);
      const passed = violations.length === 0;

      return {
        benchmarkId: benchmark.id,
        testName: benchmark.name,
        metrics,
        summary,
        passed,
        violations
      };

    } catch (error) {
      throw new Error(`Load test execution failed: ${error.message}`);
    }
  }

  private async runStressTest(benchmark: PerformanceBenchmark): Promise<PerformanceTestResult> {
    // Similar to load test but gradually increases load beyond normal capacity
    const config = benchmark.load_configuration as LoadTestConfig;
    const maxUsers = config.maxUsers || config.targetUsers * 2;
    
    // Override target users for stress testing
    const stressConfig = { ...config, targetUsers: maxUsers };
    const modifiedBenchmark = { ...benchmark, load_configuration: stressConfig };
    
    return this.runLoadTest(modifiedBenchmark);
  }

  private async runSpikeTest(benchmark: PerformanceBenchmark): Promise<PerformanceTestResult> {
    // Sudden spike in load
    const config = benchmark.load_configuration as LoadTestConfig;
    const spikeConfig = { ...config, rampUp: 1 }; // Very quick ramp up
    const modifiedBenchmark = { ...benchmark, load_configuration: spikeConfig };
    
    return this.runLoadTest(modifiedBenchmark);
  }

  private async runVolumeTest(benchmark: PerformanceBenchmark): Promise<PerformanceTestResult> {
    // Large amounts of data
    const config = benchmark.load_configuration as LoadTestConfig;
    const volumeConfig = { 
      ...config, 
      duration: config.duration * 2, // Longer duration
      scenarios: config.scenarios.map(scenario => ({
        ...scenario,
        requests: scenario.requests.map(req => ({
          ...req,
          body: req.body ? req.body.repeat(10) : undefined // Larger payloads
        }))
      }))
    };
    const modifiedBenchmark = { ...benchmark, load_configuration: volumeConfig };
    
    return this.runLoadTest(modifiedBenchmark);
  }

  private async runEnduranceTest(benchmark: PerformanceBenchmark): Promise<PerformanceTestResult> {
    // Extended duration test
    const config = benchmark.load_configuration as LoadTestConfig;
    const enduranceConfig = { ...config, duration: config.duration * 4 }; // Much longer
    const modifiedBenchmark = { ...benchmark, load_configuration: enduranceConfig };
    
    return this.runLoadTest(modifiedBenchmark);
  }

  private generateNormalDistribution(mean: number, stdDev: number): number {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, mean + z0 * stdDev);
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private checkThresholds(summary: any, thresholds: any): string[] {
    const violations: string[] = [];

    if (!thresholds) return violations;

    if (thresholds.max_response_time && summary.avgResponseTime > thresholds.max_response_time) {
      violations.push(`Average response time ${summary.avgResponseTime}ms exceeds threshold ${thresholds.max_response_time}ms`);
    }

    if (thresholds.max_error_rate && summary.errorRate > thresholds.max_error_rate) {
      violations.push(`Error rate ${summary.errorRate}% exceeds threshold ${thresholds.max_error_rate}%`);
    }

    if (thresholds.min_throughput && summary.throughput < thresholds.min_throughput) {
      violations.push(`Throughput ${summary.throughput} req/s below threshold ${thresholds.min_throughput} req/s`);
    }

    if (thresholds.max_p95_response_time && summary.p95ResponseTime > thresholds.max_p95_response_time) {
      violations.push(`P95 response time ${summary.p95ResponseTime}ms exceeds threshold ${thresholds.max_p95_response_time}ms`);
    }

    return violations;
  }

  async getBenchmarkHistory(benchmarkId: string, limit: number = 10): Promise<PerformanceTestResult[]> {
    // In a real implementation, this would fetch historical test results from the database
    // For now, return empty array as this would require a separate results table
    return [];
  }

  async compareBenchmarks(benchmark1Id: string, benchmark2Id: string): Promise<any> {
    const [b1, b2] = await Promise.all([
      this.getBenchmarkById(benchmark1Id),
      this.getBenchmarkById(benchmark2Id)
    ]);

    return {
      benchmark1: b1,
      benchmark2: b2,
      comparison: {
        // Would implement detailed comparison logic
        // For now, basic structure
        differenceAnalysis: 'Comparison not yet implemented'
      }
    };
  }

  async deleteBenchmark(id: string): Promise<void> {
    const existing = await this.benchmarkModel.findById(id);
    if (!existing) {
      throw new Error(`Performance benchmark with ID ${id} not found`);
    }

    await this.benchmarkModel.delete(id);
  }

  async updateBenchmark(id: string, data: Partial<PerformanceBenchmark>): Promise<PerformanceBenchmark> {
    const existing = await this.benchmarkModel.findById(id);
    if (!existing) {
      throw new Error(`Performance benchmark with ID ${id} not found`);
    }

    const updated = {
      ...data,
      updated_at: new Date().toISOString()
    };

    await this.benchmarkModel.update(id, updated);
    return this.getBenchmarkById(id);
  }
}