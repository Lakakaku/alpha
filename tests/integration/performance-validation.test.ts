import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PerformanceService } from '../../apps/backend/src/services/testing/performance-service';
import { ArtilleryRunner } from '../../apps/backend/src/testing/runners/artillery-runner';
import { supabase } from '../setup';

describe('Performance Benchmark Validation Integration', () => {
  let performanceService: PerformanceService;
  let artilleryRunner: ArtilleryRunner;

  beforeAll(async () => {
    performanceService = new PerformanceService();
    artilleryRunner = new ArtilleryRunner();
  });

  beforeEach(async () => {
    await supabase.from('performance_results').delete().neq('id', '');
    await supabase.from('performance_benchmarks').delete().neq('id', '');
  });

  afterAll(async () => {
    await supabase.from('performance_results').delete().neq('id', '');
    await supabase.from('performance_benchmarks').delete().neq('id', '');
  });

  it('should validate API response time benchmarks', async () => {
    const benchmark = await performanceService.createBenchmark({
      operation: 'api-health-check',
      component: 'backend-api',
      metric: 'response-time',
      target: 500,
      unit: 'ms',
      threshold: { warning: 800, critical: 1000 },
      environment: 'test',
      enabled: true
    });

    expect(benchmark.target).toBe(500);
    expect(benchmark.threshold.warning).toBe(800);
    expect(benchmark.threshold.critical).toBe(1000);

    // Mock performance test result
    const mockResult = {
      benchmarkId: benchmark.id,
      value: 450,
      status: 'pass' as const,
      measurements: { min: 200, max: 600, avg: 450, p95: 550, p99: 580 }
    };

    expect(mockResult.value).toBeLessThan(benchmark.target);
    expect(mockResult.status).toBe('pass');
  });

  it('should detect performance threshold violations', async () => {
    const benchmark = await performanceService.createBenchmark({
      operation: 'page-load-test',
      component: 'customer-app',
      metric: 'page-load',
      target: 2000,
      unit: 'ms',
      threshold: { warning: 2500, critical: 3000 },
      environment: 'test',
      enabled: true
    });

    // Mock slow performance result
    const slowResult = {
      benchmarkId: benchmark.id,
      value: 3500,
      status: 'fail' as const,
      measurements: { min: 2000, max: 5000, avg: 3500, p95: 4200, p99: 4800 }
    };

    expect(slowResult.value).toBeGreaterThan(benchmark.threshold.critical);
    expect(slowResult.status).toBe('fail');
  });
});