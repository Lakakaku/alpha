import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface PerformanceBenchmark {
  id: string;
  operation: string;
  component: string;
  metric: 'response-time' | 'page-load' | 'throughput' | 'error-rate';
  target: number;
  unit: string;
  threshold: {
    warning: number;
    critical: number;
  };
  environment: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePerformanceBenchmarkRequest {
  operation: string;
  component: string;
  metric: 'response-time' | 'page-load' | 'throughput' | 'error-rate';
  target: number;
  unit: string;
  threshold: {
    warning: number;
    critical: number;
  };
  environment: string;
  enabled?: boolean;
}

export interface UpdatePerformanceBenchmarkRequest {
  operation?: string;
  component?: string;
  metric?: 'response-time' | 'page-load' | 'throughput' | 'error-rate';
  target?: number;
  unit?: string;
  threshold?: {
    warning: number;
    critical: number;
  };
  environment?: string;
  enabled?: boolean;
}

export class PerformanceBenchmarkModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreatePerformanceBenchmarkRequest): Promise<PerformanceBenchmark> {
    // Validate threshold values
    if (data.threshold.warning >= data.threshold.critical) {
      throw new Error('Warning threshold must be less than critical threshold');
    }

    if (data.target <= 0) {
      throw new Error('Target value must be positive');
    }

    const { data: benchmark, error } = await this.supabase
      .from('performance_benchmarks')
      .insert({
        operation: data.operation,
        component: data.component,
        metric: data.metric,
        target: data.target,
        unit: data.unit,
        threshold: data.threshold,
        environment: data.environment,
        enabled: data.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create performance benchmark: ${error.message}`);
    }

    return this.mapToPerformanceBenchmark(benchmark);
  }

  async findById(id: string): Promise<PerformanceBenchmark | null> {
    const { data: benchmark, error } = await this.supabase
      .from('performance_benchmarks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find performance benchmark: ${error.message}`);
    }

    return this.mapToPerformanceBenchmark(benchmark);
  }

  async findAll(params?: {
    operation?: string;
    component?: string;
    metric?: string;
    environment?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<PerformanceBenchmark[]> {
    let query = this.supabase.from('performance_benchmarks').select('*');

    if (params?.operation) {
      query = query.eq('operation', params.operation);
    }
    if (params?.component) {
      query = query.eq('component', params.component);
    }
    if (params?.metric) {
      query = query.eq('metric', params.metric);
    }
    if (params?.environment) {
      query = query.eq('environment', params.environment);
    }
    if (params?.enabled !== undefined) {
      query = query.eq('enabled', params.enabled);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: benchmarks, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch performance benchmarks: ${error.message}`);
    }

    return benchmarks?.map(benchmark => this.mapToPerformanceBenchmark(benchmark)) || [];
  }

  async update(id: string, data: UpdatePerformanceBenchmarkRequest): Promise<PerformanceBenchmark> {
    // Validate threshold values if provided
    if (data.threshold && data.threshold.warning >= data.threshold.critical) {
      throw new Error('Warning threshold must be less than critical threshold');
    }

    if (data.target !== undefined && data.target <= 0) {
      throw new Error('Target value must be positive');
    }

    const updateData: any = {};
    
    if (data.operation !== undefined) updateData.operation = data.operation;
    if (data.component !== undefined) updateData.component = data.component;
    if (data.metric !== undefined) updateData.metric = data.metric;
    if (data.target !== undefined) updateData.target = data.target;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.threshold !== undefined) updateData.threshold = data.threshold;
    if (data.environment !== undefined) updateData.environment = data.environment;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const { data: benchmark, error } = await this.supabase
      .from('performance_benchmarks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update performance benchmark: ${error.message}`);
    }

    return this.mapToPerformanceBenchmark(benchmark);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('performance_benchmarks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete performance benchmark: ${error.message}`);
    }
  }

  async findByComponent(component: string): Promise<PerformanceBenchmark[]> {
    return this.findAll({ component, enabled: true });
  }

  async findByOperation(operation: string): Promise<PerformanceBenchmark[]> {
    return this.findAll({ operation, enabled: true });
  }

  async findByMetric(metric: 'response-time' | 'page-load' | 'throughput' | 'error-rate'): Promise<PerformanceBenchmark[]> {
    return this.findAll({ metric, enabled: true });
  }

  async findByEnvironment(environment: string): Promise<PerformanceBenchmark[]> {
    return this.findAll({ environment, enabled: true });
  }

  async findEnabled(): Promise<PerformanceBenchmark[]> {
    return this.findAll({ enabled: true });
  }

  async evaluatePerformance(benchmarkId: string, actualValue: number): Promise<{
    status: 'pass' | 'warning' | 'fail';
    benchmark: PerformanceBenchmark;
    actualValue: number;
    deviation: number;
  }> {
    const benchmark = await this.findById(benchmarkId);
    if (!benchmark) {
      throw new Error('Benchmark not found');
    }

    let status: 'pass' | 'warning' | 'fail';
    
    if (actualValue <= benchmark.threshold.warning) {
      status = 'pass';
    } else if (actualValue <= benchmark.threshold.critical) {
      status = 'warning';
    } else {
      status = 'fail';
    }

    const deviation = ((actualValue - benchmark.target) / benchmark.target) * 100;

    return {
      status,
      benchmark,
      actualValue,
      deviation,
    };
  }

  async getBenchmarksSummary(component?: string): Promise<{
    total: number;
    byMetric: Record<string, number>;
    byEnvironment: Record<string, number>;
    enabled: number;
    disabled: number;
  }> {
    const benchmarks = component 
      ? await this.findByComponent(component)
      : await this.findAll();

    const summary = {
      total: benchmarks.length,
      byMetric: {} as Record<string, number>,
      byEnvironment: {} as Record<string, number>,
      enabled: benchmarks.filter(b => b.enabled).length,
      disabled: benchmarks.filter(b => !b.enabled).length,
    };

    // Group by metric
    benchmarks.forEach(benchmark => {
      summary.byMetric[benchmark.metric] = (summary.byMetric[benchmark.metric] || 0) + 1;
    });

    // Group by environment
    benchmarks.forEach(benchmark => {
      summary.byEnvironment[benchmark.environment] = (summary.byEnvironment[benchmark.environment] || 0) + 1;
    });

    return summary;
  }

  private mapToPerformanceBenchmark(row: any): PerformanceBenchmark {
    return {
      id: row.id,
      operation: row.operation,
      component: row.component,
      metric: row.metric,
      target: row.target,
      unit: row.unit,
      threshold: row.threshold,
      environment: row.environment,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}